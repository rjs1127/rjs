import {
  ARCHIVE_CACHE_KEY,
  jsonResponse,
  requireKv,
  getJson,
  getSheetsAccessToken,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const POSTYPE_SPREADSHEET_ID = "1A6SL397yG59Yfs95x4SAlgqz5oVe26YMOw18gDw2fIw";
const POSTYPE_SHEET_NAME = "POSTYPE";
const POSTYPE_INDEX_KEY = "postype:index:v1";
const POSTYPE_ID_SEQUENCE_KEY = "postype:id-sequence:v1";

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

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function getAllowedCombinations(kv) {
  const archive = await getJson(kv, ARCHIVE_CACHE_KEY, null);
  const values = new Set();

  for (const item of archive?.items || []) {
    const combination = normalize(item?.combination);
    if (combination) values.add(combination);
  }

  return [...values];
}

function getHighestSheetId(values, idColumn) {
  let max = 0;

  for (const row of values.slice(1)) {
    const id = normalize(row?.[idColumn]);
    const match = id.match(/^P(\d+)$/i);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }

  return max;
}

function rowHasData(row) {
  return Array.isArray(row) &&
    row.some((value) => normalize(value) !== "");
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
  let disabledCount = 0;
  let totalRows = 0;
  const seenIds = new Set();

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] || [];
    if (!rowHasData(row)) continue;
    totalRows += 1;

    const enabled = cell(row, headerIndex, "enabled").toUpperCase();
    const id = cell(row, headerIndex, "id").toUpperCase();

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

    const lengthType = cell(row, headerIndex, "lengthType");
    const status = cell(row, headerIndex, "status");
    const url = cell(row, headerIndex, "url");

    items.push({
      id,
      source: "postype",
      combination: cell(row, headerIndex, "combination"),
      subCp1: cell(row, headerIndex, "subCp1"),
      subCp2: cell(row, headerIndex, "subCp2"),
      title: cell(row, headerIndex, "title"),
      genre: cell(row, headerIndex, "genre"),
      author: cell(row, headerIndex, "author"),
      status,
      lengthType,
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

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json();

    const combination = normalize(body?.combination).toUpperCase();
    const subCp1 = normalize(body?.subCp1).toUpperCase();
    const subCp2 = normalize(body?.subCp2).toUpperCase();
    const title = normalize(body?.title);
    const genre = normalize(body?.genre);
    const author = normalize(body?.author);
    const status = normalize(body?.status);
    const lengthType = normalize(body?.lengthType);
    const itemUrl = normalize(body?.url);

    const allowedCombinations = await getAllowedCombinations(kv);

    if (!combination || !allowedCombinations.includes(combination)) {
      return jsonResponse(
        { error: "CP는 현재 Google Drive에 등록된 CP 폴더 값 중에서 선택해 주세요." },
        400
      );
    }

    if (!title) {
      return jsonResponse({ error: "제목을 입력해 주세요." }, 400);
    }

    if (!author) {
      return jsonResponse({ error: "작가를 입력해 주세요." }, 400);
    }

    if (!["완결", "연재"].includes(status)) {
      return jsonResponse({ error: "상태 값이 올바르지 않습니다." }, 400);
    }

    if (!["단편", "시리즈"].includes(lengthType)) {
      return jsonResponse({ error: "분량/형태 값이 올바르지 않습니다." }, 400);
    }

    if (lengthType === "단편" && status !== "완결") {
      return jsonResponse(
        { error: "단편은 상태를 완결로 등록해 주세요." },
        400
      );
    }

    if (!isValidUrl(itemUrl)) {
      return jsonResponse({ error: "포스타입 링크를 확인해 주세요." }, 400);
    }

    const accessToken = await getSheetsAccessToken(context.env);
    const values = await readSheet(accessToken);
    const headers = (values[0] || []).map(normalize);
    const headerIndex = buildHeaderIndex(headers);

    const missingHeaders = REQUIRED_HEADERS.filter(
      (name) => !headerIndex.has(name.toLowerCase())
    );

    if (missingHeaders.length) {
      return jsonResponse(
        {
          error:
            `POSTYPE 시트에 필요한 컬럼이 없습니다: ` +
            missingHeaders.join(", "),
        },
        400
      );
    }

    const idColumn = headerIndex.get("id");
    const highestSheetId = getHighestSheetId(values, idColumn);
    const savedSequence = Number(
      (await kv.get(POSTYPE_ID_SEQUENCE_KEY)) || 0
    );
    const nextNumber = Math.max(highestSheetId, savedSequence) + 1;
    const id = `P${String(nextNumber).padStart(4, "0")}`;

    const row = new Array(headers.length).fill("");
    const rowValues = {
      id,
      combination,
      subCp1,
      subCp2,
      title,
      genre,
      author,
      status,
      lengthType,
      url: itemUrl,
      enabled: "Y",
    };

    for (const [name, value] of Object.entries(rowValues)) {
      const columnIndex = headerIndex.get(name.toLowerCase());
      if (columnIndex !== undefined) {
        row[columnIndex] = value;
      }
    }

    const appendRange =
      `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A:Z`;

    const appendUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/` +
      `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
      `${encodeURIComponent(appendRange)}:append` +
      `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [row],
      }),
    });

    const appendData = await appendResponse.json();

    if (!appendResponse.ok) {
      throw new Error(
        appendData?.error?.message ||
        `Google Sheets API 등록 오류 (${appendResponse.status})`
      );
    }

    await kv.put(POSTYPE_ID_SEQUENCE_KEY, String(nextNumber));

    // Re-read after append and immediately rebuild the public POSTYPE cache.
    const updatedValues = await readSheet(accessToken);
    const updatedHeaders = (updatedValues[0] || []).map(normalize);
    const archive = buildArchive(updatedValues, updatedHeaders);

    await kv.put(POSTYPE_INDEX_KEY, JSON.stringify(archive));

    return jsonResponse(
      {
        ok: true,
        id,
        title,
        count: archive.count,
        totalRows: archive.totalRows,
        syncedAt: archive.syncedAt,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message || "포스타입 작품 등록에 실패했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
