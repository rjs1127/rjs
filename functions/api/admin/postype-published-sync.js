import {
  jsonResponse,
  requireKv,
  getJson,
  getSheetsAccessToken,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const POSTYPE_SPREADSHEET_ID = "1A6SL397yG59Yfs95x4SAlgqz5oVe26YMOw18gDw2fIw";
const POSTYPE_SHEET_NAME = "POSTYPE";
const POSTYPE_INDEX_KEY = "postype:index:v1";

const REQUIRED_HEADERS = [
  "id",
  "combination",
  "subCp1",
  "subCp2",
  "title",
  "genre",
  "author",
  "status",
  "lengthType",
  "latestPublishedDate",
  "url",
  "enabled",
];

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

function hasAnyData(row) {
  return Array.isArray(row) &&
    row.some((value) => normalize(value) !== "");
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

function isValidLatestPublishedDate(value) {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function readSheet(accessToken) {
  const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A:Z`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
    `${encodeURIComponent(range)}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Google Sheets API 읽기 오류 (${response.status})`
    );
  }

  return Array.isArray(data?.values) ? data.values : [];
}

async function ensureLatestPublishedDateHeader(accessToken, values) {
  const headers = (values[0] || []).map(normalize);
  let changed = false;
  let latestIndex = headers.findIndex((header) => header.toLowerCase() === "latestpublisheddate");
  const legacyIndex = headers.findIndex((header) => header.toLowerCase() === "publisheddate");
  if (latestIndex < 0 && legacyIndex >= 0) { headers[legacyIndex] = "latestPublishedDate"; latestIndex = legacyIndex; changed = true; }
  else if (latestIndex < 0) { headers.push("latestPublishedDate"); latestIndex = headers.length - 1; changed = true; }
  let workLengthIndex = headers.findIndex((header) => header.toLowerCase() === "worklength");
  if (workLengthIndex < 0) { headers.push("workLength"); workLengthIndex = headers.length - 1; changed = true; }
  let publishTypeIndex = headers.findIndex((header) => header.toLowerCase() === "publishtype");
  if (publishTypeIndex < 0) { headers.push("publishType"); publishTypeIndex = headers.length - 1; changed = true; }
  const statusIndex = headers.findIndex((header) => header.toLowerCase() === "status");
  if (changed) {
    const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A1:AZ1`;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
    const response = await fetch(updateUrl, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ majorDimension: "ROWS", values: [headers] }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `POSTYPE 컬럼 구성 오류 (${response.status})`);
  }
  if (!values[0]) values[0] = []; values[0] = headers;
  return { headers, latestPublishedDateColumn: latestIndex, workLengthColumn: workLengthIndex, publishTypeColumn: publishTypeIndex, statusColumn: statusIndex, added: changed, migrated: legacyIndex >= 0 };
}

function comparableArchive(archive) {
  if (!archive || typeof archive !== "object") return null;

  return {
    source: "postype",
    count: Number(archive.count || 0),
    totalRows: Number(archive.totalRows || 0),
    disabledCount: Number(archive.disabledCount || 0),
    items: Array.isArray(archive.items) ? archive.items : [],
  };
}

function archivesEqual(left, right) {
  return JSON.stringify(comparableArchive(left)) ===
    JSON.stringify(comparableArchive(right));
}

function buildArchive(values, headers) {
  const headerIndex = buildHeaderIndex(headers);
  const missingHeaders = REQUIRED_HEADERS.filter(
    (name) => !headerIndex.has(name.toLowerCase())
  );

  if (missingHeaders.length) {
    const error = new Error(
      `POSTYPE 시트에 필요한 컬럼이 없습니다: ${missingHeaders.join(", ")}`
    );
    error.status = 400;
    throw error;
  }

  const items = [];
  let totalRows = 0;
  let disabledCount = 0;
  const seenIds = new Set();

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] || [];
    if (!hasAnyData(row)) continue;
    totalRows += 1;

    const id = cell(row, headerIndex, "id").toUpperCase();
    const enabled = cell(row, headerIndex, "enabled").toUpperCase();

    if (!id) continue;

    if (seenIds.has(id)) {
      const error = new Error(`POSTYPE 시트에 중복 ID가 있습니다: ${id}`);
      error.status = 400;
      throw error;
    }
    seenIds.add(id);

    if (enabled === "N") {
      disabledCount += 1;
      continue;
    }

    if (enabled !== "Y") {
      const error = new Error(
        `POSTYPE 시트의 enabled 값은 Y 또는 N이어야 합니다. ID: ${id}`
      );
      error.status = 400;
      throw error;
    }

    const url = cell(row, headerIndex, "url");
    if (url && !isValidUrl(url)) {
      const error = new Error(`POSTYPE URL 형식이 올바르지 않습니다. ID: ${id}`);
      error.status = 400;
      throw error;
    }

    items.push({
      id,
      source: "postype",
      combination: cell(row, headerIndex, "combination"),
      subCp1: cell(row, headerIndex, "subCp1"),
      subCp2: cell(row, headerIndex, "subCp2"),
      title: cell(row, headerIndex, "title"),
      genre: cell(row, headerIndex, "genre"),
      author: cell(row, headerIndex, "author"),
      status: cell(row, headerIndex, "status"),
      lengthType: cell(row, headerIndex, "lengthType"),
      workLength: cell(row, headerIndex, "workLength"),
      publishType: cell(row, headerIndex, "publishType") || (/\/series\/\d+/i.test(url) || cell(row, headerIndex, "linkType") === "manual" ? "다회차" : "단일글"),
      linkType: cell(row, headerIndex, "linkType") || (/\/series\/\d+/i.test(url) ? "series" : "post"),
      manualUrls: cell(row, headerIndex, "manualUrls"),
      latestPublishedDate: cell(row, headerIndex, "latestPublishedDate"),
      url,
      fileName: null,
      parseFailed: false,
      createdTime: null,
      modifiedTime: null,
      size: null,
    });
  }

  return {
    source: "postype",
    syncedAt: new Date().toISOString(),
    count: items.length,
    totalRows,
    disabledCount,
    items,
  };
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);

    const kv = requireKv(context.env);
    const body = await context.request.json();
    const requestedUpdates = Array.isArray(body?.updates)
      ? body.updates
      : [];

    if (requestedUpdates.length > 1000) {
      return jsonResponse(
        { error: "한 번에 최대 1000개까지 동기화할 수 있습니다." },
        400
      );
    }

    const accessToken = await getSheetsAccessToken(context.env);
    const values = await readSheet(accessToken);
    const headerInfo = await ensureLatestPublishedDateHeader(
      accessToken,
      values
    );
    const headers = headerInfo.headers;
    const headerIndex = buildHeaderIndex(headers);

    const idColumn = headerIndex.get("id");
    const latestPublishedDateColumn =
      headerInfo.latestPublishedDateColumn ?? headerIndex.get("latestpublisheddate");
    const workLengthColumn = headerInfo.workLengthColumn ?? headerIndex.get("worklength");
    const publishTypeColumn = headerInfo.publishTypeColumn ?? headerIndex.get("publishtype");
    const statusColumn = headerInfo.statusColumn ?? headerIndex.get("status");

    if (!Number.isInteger(latestPublishedDateColumn)) {
      return jsonResponse(
        {
          error:
            "latestPublishedDate 컬럼 위치를 찾지 못했습니다. POSTYPE 시트 헤더를 확인해 주세요.",
        },
        400
      );
    }

    const rowById = new Map();

    for (let index = 1; index < values.length; index += 1) {
      const id = normalize(values[index]?.[idColumn]).toUpperCase();
      if (id) rowById.set(id, index);
    }

    const updates = [];
    const changedCells = [];

    for (const raw of requestedUpdates) {
      const id = normalize(raw?.id).toUpperCase();
      const latestPublishedDate = normalize(raw?.latestPublishedDate);
      const publishType = normalize(raw?.publishType);
      const status = normalize(raw?.status);

      if (!id) continue;

      if (!isValidLatestPublishedDate(latestPublishedDate)) {
        return jsonResponse(
          {
            error:
              `${id}: 최근 발행일은 YYYY-MM-DD 형식으로 입력해 주세요.`,
          },
          400
        );
      }

      if (!["단일글", "다회차"].includes(publishType)) {
        return jsonResponse(
          { error: `${id}: 작품형태 값을 확인해 주세요.` },
          400
        );
      }

      if (!["연재", "완결"].includes(status)) {
        return jsonResponse(
          { error: `${id}: 상태 값을 확인해 주세요.` },
          400
        );
      }

      const rowIndex = rowById.get(id);
      if (rowIndex === undefined) {
        return jsonResponse(
          { error: `시트에서 ID를 찾지 못했습니다: ${id}` },
          400
        );
      }

      const rowNumber = rowIndex + 1;
      let rowChanged = false;

      if (!values[rowIndex]) values[rowIndex] = [];

      const currentDate =
        normalize(values[rowIndex]?.[latestPublishedDateColumn]);

      if (currentDate !== latestPublishedDate) {
        changedCells.push({
          range:
            `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!` +
            `${columnLetter(latestPublishedDateColumn)}${rowNumber}`,
          majorDimension: "ROWS",
          values: [[latestPublishedDate]],
        });

        values[rowIndex][latestPublishedDateColumn] =
          latestPublishedDate;
        rowChanged = true;
      }

      if (Number.isInteger(publishTypeColumn)) {
        const currentPublishType =
          normalize(values[rowIndex]?.[publishTypeColumn]);

        if (currentPublishType !== publishType) {
          changedCells.push({
            range:
              `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!` +
              `${columnLetter(publishTypeColumn)}${rowNumber}`,
            majorDimension: "ROWS",
            values: [[publishType]],
          });

          values[rowIndex][publishTypeColumn] = publishType;
          rowChanged = true;
        }
      }

      if (Number.isInteger(statusColumn)) {
        const currentStatus =
          normalize(values[rowIndex]?.[statusColumn]);

        if (currentStatus !== status) {
          changedCells.push({
            range:
              `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!` +
              `${columnLetter(statusColumn)}${rowNumber}`,
            majorDimension: "ROWS",
            values: [[status]],
          });

          values[rowIndex][statusColumn] = status;
          rowChanged = true;
        }
      }

      if (rowChanged) {
        updates.push({
          id,
          latestPublishedDate,
          publishType,
          status,
          rowNumber,
        });
      }
    }

    if (changedCells.length) {
      const batchUrl =
        `https://sheets.googleapis.com/v4/spreadsheets/` +
        `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values:batchUpdate`;

      const response = await fetch(batchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: changedCells,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          `Google Sheets API 일괄 수정 오류 (${response.status})`
        );
      }
    }

    const archive = buildArchive(values, headers);
    const existingArchive = await getJson(
      kv,
      POSTYPE_INDEX_KEY,
      null
    );
    const kvChanged = !archivesEqual(existingArchive, archive);
    let effectiveSyncedAt =
      existingArchive?.syncedAt || archive.syncedAt;

    if (kvChanged) {
      await kv.put(POSTYPE_INDEX_KEY, JSON.stringify(archive));
      effectiveSyncedAt = archive.syncedAt;
    }

    return jsonResponse(
      {
        ok: true,
        headerAdded: headerInfo.added,
        sheetChanged: updates.length > 0,
        sheetUpdatedCount: updates.length,
        updated: updates,
        kvChanged,
        kvWritten: kvChanged,
        count: archive.count,
        totalRows: archive.totalRows,
        disabledCount: archive.disabledCount,
        syncedAt: effectiveSyncedAt,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error:
          error?.message ||
          "POSTYPE 발행일 동기화에 실패했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
