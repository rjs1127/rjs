import {
  jsonResponse,
  requireKv,
  getJson,
  getSheetsAccessToken,
} from "./_shared.js";
import { runDriveSync } from "./api/admin/sync.js";
import { runPostypeSync } from "./api/admin/postype-sync.js";
import { fetchSeriesPostsApi } from "./api/admin/postype-url-meta.js";

export const AUTO_SYNC_STATUS_KEYS = {
  postype: "automation:auto-sync:postype:v1",
  drive: "automation:auto-sync:drive:v1",
};

const POSTYPE_SPREADSHEET_ID = "1A6SL397yG59Yfs95x4SAlgqz5oVe26YMOw18gDw2fIw";
const POSTYPE_SHEET_NAME = "POSTYPE";
const POSTYPE_BATCH_SIZE = 12;

function normalize(value) {
  return String(value ?? "").trim();
}

function buildHeaderIndex(headers) {
  const result = new Map();
  headers.forEach((header, index) => {
    const key = normalize(header);
    if (key) result.set(key.toLowerCase(), index);
  });
  return result;
}

function cell(row, headerIndex, name) {
  const index = headerIndex.get(name.toLowerCase());
  return index === undefined ? "" : normalize(row?.[index]);
}

function columnLetter(index) {
  let value = Number(index) + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function readPostypeSheet(accessToken) {
  const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A:Z`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
    `${encodeURIComponent(range)}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Google Sheets API 읽기 오류 (${response.status})`);
  }
  return Array.isArray(data?.values) ? data.values : [];
}

async function updatePostypeDates(accessToken, updates) {
  if (!updates.length) return 0;

  const data = updates.map((item) => ({
    range: `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!${item.column}${item.row}`,
    majorDimension: "ROWS",
    values: [[item.value]],
  }));

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values:batchUpdate`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message || `Google Sheets API 쓰기 오류 (${response.status})`);
  }
  return updates.length;
}

async function putAutoStatus(kv, source, patch) {
  const key = AUTO_SYNC_STATUS_KEYS[source];
  const previous = await getJson(kv, key, {});
  const next = { ...previous, ...patch, source };
  await kv.put(key, JSON.stringify(next));
  return next;
}

export async function getAutoSyncStatus(env) {
  const kv = requireKv(env);
  const [postype, drive] = await Promise.all([
    getJson(kv, AUTO_SYNC_STATUS_KEYS.postype, null),
    getJson(kv, AUTO_SYNC_STATUS_KEYS.drive, null),
  ]);
  return {
    postype,
    drive,
    tokenConfigured: Boolean(env.AUTO_SYNC_TOKEN),
    schedules: {
      postype: "23:00",
      drive: "23:10",
      timezone: "Asia/Seoul",
    },
  };
}

export async function runDriveAutoSync(env, trigger = "auto") {
  const kv = requireKv(env);
  const startedAt = new Date().toISOString();
  await putAutoStatus(kv, "drive", {
    state: "running",
    trigger,
    startedAt,
    checkedAt: startedAt,
    error: "",
  });

  try {
    const data = await runDriveSync(env);
    const finishedAt = new Date().toISOString();
    const blocked = Boolean(data.blocked);
    const warningText = data.warning || data.cachePurgeWarning || "";
    const status = await putAutoStatus(kv, "drive", {
      state: blocked || warningText ? "warning" : "success",
      trigger,
      startedAt,
      finishedAt,
      checkedAt: data.checkedAt || finishedAt,
      changed: blocked ? false : Boolean(data.changed),
      blocked,
      blockedReason: data.blockedReason || "",
      warning: warningText,
      scanIssues: Array.isArray(data.scanIssues) ? data.scanIssues.slice(0, 20) : [],
      addedCount: Number(data.addedCount || 0),
      updatedCount: Number(data.updatedCount || 0),
      removedCount: Number(data.removedCount || 0),
      candidateRemovedCount: Number(data.candidateRemovedCount || 0),
      candidateCount: Number(data.candidateCount || 0),
      count: Number(data.count || 0),
      ...(trigger === "schedule" ? {
        lastScheduledAt: data.checkedAt || finishedAt,
        lastScheduledChanged: blocked ? false : Boolean(data.changed),
        lastScheduledAddedCount: Number(data.addedCount || 0),
        lastScheduledUpdatedCount: Number(data.updatedCount || 0),
        lastScheduledRemovedCount: Number(data.removedCount || 0),
        lastScheduledState: blocked || warningText ? "warning" : "success",
        lastScheduledWarning: warningText,
        lastScheduledError: "",
      } : {}),
      error: "",
    });
    return { ...data, autoStatus: status, done: true };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await putAutoStatus(kv, "drive", {
      state: "error",
      trigger,
      finishedAt,
      checkedAt: finishedAt,
      ...(trigger === "schedule" ? {
        lastScheduledAt: finishedAt,
        lastScheduledState: "error",
        lastScheduledWarning: "",
        lastScheduledError: error?.message || "Drive 자동 동기화 실패",
      } : {}),
      error: error?.message || "Drive 자동 동기화 실패",
    });
    throw error;
  }
}

export async function runPostypeAutoSyncBatch(env, options = {}) {
  const kv = requireKv(env);
  const trigger = options.trigger || "auto";
  const cursor = Math.max(0, Number(options.cursor || 0));
  const startedAt = cursor === 0 ? new Date().toISOString() : null;

  if (cursor === 0) {
    await putAutoStatus(kv, "postype", {
      state: "running",
      trigger,
      startedAt,
      checkedAt: startedAt,
      processedSeries: 0,
      updatedLatestDates: 0,
      failedSeries: 0,
      failureDetails: [],
      error: "",
    });
  }

  try {
    const accessToken = await getSheetsAccessToken(env);
    const values = await readPostypeSheet(accessToken);
    const headers = (values[0] || []).map(normalize);
    const headerIndex = buildHeaderIndex(headers);
    const latestIndex = headerIndex.get("latestpublisheddate");

    if (latestIndex === undefined) {
      const error = new Error("POSTYPE 시트에 latestPublishedDate 컬럼이 없습니다.");
      error.status = 400;
      throw error;
    }

    const seriesRows = [];
    for (let index = 1; index < values.length; index += 1) {
      const row = values[index] || [];
      if (cell(row, headerIndex, "enabled").toUpperCase() !== "Y") continue;
      const url = cell(row, headerIndex, "url");
      const linkType = cell(row, headerIndex, "linkType").toLowerCase();
      if (linkType !== "series" && !/\/series\/\d+/i.test(url)) continue;
      seriesRows.push({
        rowNumber: index + 1,
        id: cell(row, headerIndex, "id").toUpperCase(),
        title: cell(row, headerIndex, "title"),
        url,
        currentDate: cell(row, headerIndex, "latestPublishedDate"),
      });
    }

    const batch = seriesRows.slice(cursor, cursor + POSTYPE_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (item) => ({ item, result: await fetchSeriesPostsApi(item.url) }))
    );

    const updates = [];
    let failedSeries = 0;
    const failures = [];
    const failureDetails = [];

    for (let settledIndex = 0; settledIndex < settled.length; settledIndex += 1) {
      const entry = settled[settledIndex];
      const batchItem = batch[settledIndex] || {};
      if (entry.status !== "fulfilled") {
        failedSeries += 1;
        const reason = entry.reason?.message || "POSTYPE API 오류";
        failures.push(reason);
        failureDetails.push({
          id: batchItem.id || "",
          title: batchItem.title || "",
          url: batchItem.url || "",
          reason,
        });
        continue;
      }
      const { item, result } = entry.value;
      const latest = normalize(result?.latestPublishedDate);
      if (!result?.ok || !latest) {
        failedSeries += 1;
        const reason = result?.error || result?.message || "최근 발행일 확인 실패";
        failures.push(`${item.id || item.title || item.rowNumber}: ${reason}`);
        failureDetails.push({
          id: item.id || "",
          title: item.title || "",
          url: item.url || "",
          reason,
        });
        continue;
      }
      if (latest !== item.currentDate) {
        updates.push({
          row: item.rowNumber,
          column: columnLetter(latestIndex),
          value: latest,
          id: item.id,
          previous: item.currentDate,
        });
      }
    }

    await updatePostypeDates(accessToken, updates);

    const previousStatus = await getJson(kv, AUTO_SYNC_STATUS_KEYS.postype, {});
    const previousFailureDetails = Array.isArray(previousStatus?.failureDetails)
      ? previousStatus.failureDetails
      : [];
    const combinedFailureDetails = [...previousFailureDetails, ...failureDetails]
      .filter((item, index, list) => {
        const key = `${item?.id || ""}|${item?.url || ""}|${item?.reason || ""}`;
        return list.findIndex((candidate) => `${candidate?.id || ""}|${candidate?.url || ""}|${candidate?.reason || ""}` === key) === index;
      })
      .slice(0, 50);
    const processedSeries = Number(previousStatus?.processedSeries || 0) + batch.length;
    const updatedLatestDates = Number(previousStatus?.updatedLatestDates || 0) + updates.length;
    const totalFailed = Number(previousStatus?.failedSeries || 0) + failedSeries;
    const nextCursor = cursor + batch.length;
    const done = nextCursor >= seriesRows.length;

    if (!done) {
      const status = await putAutoStatus(kv, "postype", {
        state: "running",
        trigger,
        processedSeries,
        updatedLatestDates,
        failedSeries: totalFailed,
        totalSeries: seriesRows.length,
        checkedAt: new Date().toISOString(),
        lastFailures: combinedFailureDetails.map((item) => `${item.id || item.title || "시리즈"}: ${item.reason}`).slice(0, 5),
        failureDetails: combinedFailureDetails,
      });
      return {
        ok: true,
        done: false,
        nextCursor,
        processed: batch.length,
        totalSeries: seriesRows.length,
        updatedLatestDates: updates.length,
        failedSeries,
        autoStatus: status,
      };
    }

    const syncResult = await runPostypeSync(env);
    const finishedAt = new Date().toISOString();
    const blocked = Boolean(syncResult.blocked);
    const changed = Boolean((!blocked && syncResult.changed) || updatedLatestDates > 0);
    const status = await putAutoStatus(kv, "postype", {
      state: blocked ? "warning" : (totalFailed ? "partial" : "success"),
      trigger,
      finishedAt,
      checkedAt: syncResult.checkedAt || finishedAt,
      changed,
      blocked,
      blockedReason: syncResult.blockedReason || "",
      warning: syncResult.warning || "",
      candidateRemovedCount: Number(syncResult.candidateRemovedCount || 0),
      candidateCount: Number(syncResult.candidateCount || 0),
      processedSeries,
      totalSeries: seriesRows.length,
      updatedLatestDates,
      failedSeries: totalFailed,
      count: Number(syncResult.count || 0),
      disabledCount: Number(syncResult.disabledCount || 0),
      kvWritten: Boolean(syncResult.kvWritten),
      lastFailures: combinedFailureDetails.map((item) => `${item.id || item.title || "시리즈"}: ${item.reason}`).slice(0, 5),
      failureDetails: combinedFailureDetails,
      ...(trigger === "schedule" ? {
        lastScheduledAt: syncResult.checkedAt || finishedAt,
        lastScheduledChanged: changed,
        lastScheduledUpdatedLatestDates: updatedLatestDates,
        lastScheduledFailedSeries: totalFailed,
        lastScheduledState: blocked ? "warning" : (totalFailed ? "partial" : "success"),
        lastScheduledWarning: syncResult.warning || (totalFailed ? `시리즈 발행정보 확인 실패 ${totalFailed}건` : ""),
        lastScheduledError: "",
      } : {}),
      error: "",
    });

    return {
      ...syncResult,
      done: true,
      nextCursor: null,
      processed: batch.length,
      totalSeries: seriesRows.length,
      processedSeries,
      updatedLatestDates,
      failedSeries: totalFailed,
      changed,
      autoStatus: status,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    await putAutoStatus(kv, "postype", {
      state: "error",
      trigger,
      finishedAt: failedAt,
      checkedAt: failedAt,
      ...(trigger === "schedule" ? {
        lastScheduledAt: failedAt,
        lastScheduledState: "error",
        lastScheduledWarning: "",
        lastScheduledError: error?.message || "POSTYPE 자동 동기화 실패",
      } : {}),
      error: error?.message || "POSTYPE 자동 동기화 실패",
    });
    throw error;
  }
}

export function autoSyncErrorResponse(error) {
  return jsonResponse(
    { ok: false, error: error?.message || "자동 동기화에 실패했습니다." },
    error?.status || 500,
    { "cache-control": "no-store" }
  );
}
