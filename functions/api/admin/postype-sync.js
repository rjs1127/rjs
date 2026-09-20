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
  if (index === undefined) return "";
  return normalize(row?.[index]);
}

function hasAnyData(row) {
  return Array.isArray(row) &&
    row.some((value) => normalize(value) !== "");
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
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

async function ensureLatestPublishedDateHeader(accessToken, values) {
  const headers = (values[0] || []).map(normalize);
  const latestIndex = headers.findIndex(
    (header) => header.toLowerCase() === "latestpublisheddate"
  );

  if (latestIndex >= 0) {
    return {
      headers,
      latestPublishedDateColumn: latestIndex,
      added: false,
      migrated: false,
    };
  }

  const legacyIndex = headers.findIndex(
    (header) => header.toLowerCase() === "publisheddate"
  );

  if (legacyIndex >= 0) {
    const cellRange =
      `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!` +
      `${columnLetter(legacyIndex)}1`;

    const updateUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/` +
      `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
      `${encodeURIComponent(cellRange)}?valueInputOption=RAW`;

    const response = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [["latestPublishedDate"]],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `latestPublishedDate 컬럼명 변경 오류 (${response.status})`
      );
    }

    headers[legacyIndex] = "latestPublishedDate";
    if (!values[0]) values[0] = [];
    values[0][legacyIndex] = "latestPublishedDate";

    return {
      headers,
      latestPublishedDateColumn: legacyIndex,
      added: false,
      migrated: true,
    };
  }

  const columnIndex = headers.length;
  const cellRange =
    `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!` +
    `${columnLetter(columnIndex)}1`;

  const updateUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
    `${encodeURIComponent(cellRange)}?valueInputOption=RAW`;

  const response = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      majorDimension: "ROWS",
      values: [["latestPublishedDate"]],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `latestPublishedDate 컬럼 생성 오류 (${response.status})`
    );
  }

  headers.push("latestPublishedDate");
  if (!values[0]) values[0] = [];
  values[0][columnIndex] = "latestPublishedDate";

  return {
    headers,
    latestPublishedDateColumn: columnIndex,
    added: true,
    migrated: false,
  };
}

function rowError(rowNumber, message) {
  return `행 ${rowNumber}: ${message}`;
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

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);

    const accessToken = await getSheetsAccessToken(context.env);
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

    let data = null;
    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `Google Sheets API 오류 (${response.status})`
      );
    }

    const values = Array.isArray(data?.values) ? data.values : [];
    const headerInfo = await ensureLatestPublishedDateHeader(accessToken, values);
    const headers = headerInfo.headers;
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

    const rows = values
      .slice(1)
      .map((row, index) => ({
        row,
        rowNumber: index + 2,
      }))
      .filter(({ row }) => hasAnyData(row));

    const errors = [];
    const seenIds = new Map();
    const enabledItems = [];
    let disabledCount = 0;

    for (const { row, rowNumber } of rows) {
      const enabled = cell(row, headerIndex, "enabled").toUpperCase();

      if (!["Y", "N"].includes(enabled)) {
        errors.push(
          rowError(rowNumber, 'enabled 값은 "Y" 또는 "N"이어야 합니다.')
        );
        continue;
      }

      const id = cell(row, headerIndex, "id");

      if (!id) {
        errors.push(
          rowError(
            rowNumber,
            'id가 비어 있습니다. 관리자에서 "빈 ID 자동 생성"을 먼저 실행하세요.'
          )
        );
        continue;
      }

      if (!/^P\d{4,}$/i.test(id)) {
        errors.push(
          rowError(rowNumber, `id 형식이 올바르지 않습니다: ${id}`)
        );
        continue;
      }

      const idKey = id.toUpperCase();
      if (seenIds.has(idKey)) {
        errors.push(
          rowError(
            rowNumber,
            `중복 id입니다: ${id} (행 ${seenIds.get(idKey)}와 중복)`
          )
        );
        continue;
      }
      seenIds.set(idKey, rowNumber);

      if (enabled === "N") {
        disabledCount += 1;
        continue;
      }

      const combination = cell(row, headerIndex, "combination");
      const subCp1 = cell(row, headerIndex, "subCp1");
      const subCp2 = cell(row, headerIndex, "subCp2");
      const title = cell(row, headerIndex, "title");
      const genre = cell(row, headerIndex, "genre");
      const author = cell(row, headerIndex, "author");
      const status = cell(row, headerIndex, "status");
      const lengthType = cell(row, headerIndex, "lengthType");
      const latestPublishedDate = cell(row, headerIndex, "latestPublishedDate");
      const itemUrl = cell(row, headerIndex, "url");

      const requiredValues = {
        combination,
        title,
        author,
        status,
        lengthType,
        url: itemUrl,
      };

      for (const [name, value] of Object.entries(requiredValues)) {
        if (!value) {
          errors.push(rowError(rowNumber, `${name} 값이 비어 있습니다.`));
        }
      }

      if (lengthType && !["단편", "시리즈"].includes(lengthType)) {
        errors.push(
          rowError(
            rowNumber,
            `lengthType은 "단편" 또는 "시리즈"여야 합니다: ${lengthType}`
          )
        );
      }

      if (status && !["연재", "완결"].includes(status)) {
        errors.push(
          rowError(
            rowNumber,
            `status는 "연재" 또는 "완결"이어야 합니다: ${status}`
          )
        );
      }

      if (itemUrl && !isValidUrl(itemUrl)) {
        errors.push(rowError(rowNumber, `url 형식이 올바르지 않습니다.`));
      }

      enabledItems.push({
        id: idKey,
        source: "postype",
        combination,
        subCp1,
        subCp2,
        title,
        genre,
        author,
        status,
        lengthType,
        latestPublishedDate,
        url: itemUrl,

        // Drive TXT와 공통 구조를 맞추기 위한 기본 필드.
        fileName: null,
        parseFailed: false,
        createdTime: null,
        modifiedTime: null,
        size: null,
      });
    }

    if (errors.length) {
      const error = new Error(
        `POSTYPE 시트 검증 실패\n${errors.slice(0, 12).join("\n")}` +
        (errors.length > 12
          ? `\n외 ${errors.length - 12}건`
          : "")
      );
      error.status = 400;
      throw error;
    }

    const syncedAt = new Date().toISOString();
    const archive = {
      source: "postype",
      syncedAt,
      count: enabledItems.length,
      totalRows: rows.length,
      disabledCount,
      items: enabledItems,
    };

    const existingArchive = await getJson(
      kv,
      POSTYPE_INDEX_KEY,
      null
    );

    const changed = !archivesEqual(existingArchive, archive);
    let effectiveSyncedAt = existingArchive?.syncedAt || syncedAt;

    if (changed) {
      await kv.put(POSTYPE_INDEX_KEY, JSON.stringify(archive));
      effectiveSyncedAt = syncedAt;
    }

    return jsonResponse(
      {
        ok: true,
        key: POSTYPE_INDEX_KEY,
        changed,
        kvWritten: changed,
        syncedAt: effectiveSyncedAt,
        checkedAt: syncedAt,
        count: archive.count,
        totalRows: archive.totalRows,
        disabledCount: archive.disabledCount,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message || "POSTYPE 시트 동기화에 실패했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
