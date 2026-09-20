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
  "id", "combination", "subCp1", "subCp2", "title", "genre",
  "author", "status", "lengthType", "latestPublishedDate", "url", "enabled",
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

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}


function isPostypeSeriesUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "postype.com" || hostname.endsWith(".postype.com")) &&
      /\/series\/\d+(?:\/|$)/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function rowHasData(row) {
  return Array.isArray(row) && row.some((value) => normalize(value));
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
    const match = normalize(row?.[idColumn]).match(/^P(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

async function readSheet(accessToken) {
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

function buildArchive(values, headers) {
  const headerIndex = buildHeaderIndex(headers);
  const items = [];
  let disabledCount = 0;
  let totalRows = 0;
  const seenIds = new Set();

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] || [];
    if (!rowHasData(row)) continue;
    totalRows += 1;

    const id = cell(row, headerIndex, "id").toUpperCase();
    const enabled = cell(row, headerIndex, "enabled").toUpperCase();
    if (!id) continue;
    if (seenIds.has(id)) throw new Error(`POSTYPE 시트 중복 ID: ${id}`);
    seenIds.add(id);

    if (enabled === "N") {
      disabledCount += 1;
      continue;
    }
    if (enabled !== "Y") throw new Error(`enabled 값 오류: ${id}`);

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
      latestPublishedDate: cell(row, headerIndex, "latestPublishedDate"),
      url: cell(row, headerIndex, "url"),
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
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return jsonResponse({ error: "등록할 작품이 없습니다." }, 400);
    }
    if (items.length > 300) {
      return jsonResponse({ error: "한 번에 최대 300개까지 등록할 수 있습니다." }, 400);
    }

    const allowedCombinations = await getAllowedCombinations(kv);
    const allowedSet = new Set(allowedCombinations);

    const cleanItems = items.map((raw, index) => {
      const rowNo = index + 1;
      const combination = normalize(raw?.combination).toUpperCase();
      const subCp1 = normalize(raw?.subCp1);
      const subCp2 = normalize(raw?.subCp2);
      const title = normalize(raw?.title);
      const genre = normalize(raw?.genre);
      const author = normalize(raw?.author);
      const status = normalize(raw?.status);
      const lengthType = normalize(raw?.lengthType);
      const latestPublishedDate = normalize(raw?.latestPublishedDate);
      const url = normalize(raw?.url);

      if (!allowedSet.has(combination)) {
        throw new Error(`${rowNo}행: CP "${combination}"은 현재 Drive CP 폴더에 없습니다.`);
      }
      if (!title) throw new Error(`${rowNo}행: 제목이 비어 있습니다.`);
      if (!author) throw new Error(`${rowNo}행: 작가가 비어 있습니다.`);
      if (!["완결", "연재"].includes(status)) {
        throw new Error(`${rowNo}행: 상태는 완결/연재 중 하나여야 합니다.`);
      }
      if (!["단편", "시리즈"].includes(lengthType)) {
        throw new Error(`${rowNo}행: 분량/형태는 단편/시리즈 중 하나여야 합니다.`);
      }
      if (lengthType === "단편" && status !== "완결") {
        throw new Error(`${rowNo}행: 단편은 완결로 등록해 주세요.`);
      }
      if (!isValidUrl(url)) throw new Error(`${rowNo}행: URL을 확인해 주세요.`);
      if (lengthType === "시리즈" && !isPostypeSeriesUrl(url)) {
        throw new Error(`${rowNo}행: 시리즈는 POSTYPE 시리즈 페이지 URL(/series/...)을 입력해 주세요.`);
      }

      return {
        combination,
        subCp1,
        subCp2,
        title,
        genre,
        author,
        status,
        lengthType,
        latestPublishedDate,
        url,
      };
    });

    const accessToken = await getSheetsAccessToken(context.env);
    const values = await readSheet(accessToken);
    const headerInfo = await ensureLatestPublishedDateHeader(accessToken, values);
    const headers = headerInfo.headers;
    const headerIndex = buildHeaderIndex(headers);
    const missing = REQUIRED_HEADERS.filter((name) => !headerIndex.has(name.toLowerCase()));
    if (missing.length) {
      return jsonResponse({ error: `필수 컬럼 누락: ${missing.join(", ")}` }, 400);
    }

    const highestSheetId = getHighestSheetId(values, headerIndex.get("id"));
    const savedSequence = Number((await kv.get(POSTYPE_ID_SEQUENCE_KEY)) || 0);
    let nextNumber = Math.max(highestSheetId, savedSequence) + 1;

    const rows = cleanItems.map((item) => {
      const id = `P${String(nextNumber++).padStart(4, "0")}`;
      const row = new Array(headers.length).fill("");
      const valuesByName = { id, ...item, enabled: "Y" };
      for (const [name, value] of Object.entries(valuesByName)) {
        const col = headerIndex.get(name.toLowerCase());
        if (col !== undefined) row[col] = value;
      }
      return { id, row };
    });

    const appendRange = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A:Z`;
    const appendUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/` +
      `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
      `${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: rows.map(({ row }) => row),
      }),
    });
    const appendData = await appendResponse.json();
    if (!appendResponse.ok) {
      throw new Error(appendData?.error?.message || `Google Sheets API 등록 오류 (${appendResponse.status})`);
    }

    const lastNumber = nextNumber - 1;
    await kv.put(POSTYPE_ID_SEQUENCE_KEY, String(lastNumber));

    const updatedValues = await readSheet(accessToken);
    const archive = buildArchive(updatedValues, (updatedValues[0] || []).map(normalize));
    await kv.put(POSTYPE_INDEX_KEY, JSON.stringify(archive));

    return jsonResponse({
      ok: true,
      addedCount: rows.length,
      firstId: rows[0]?.id || "",
      lastId: rows[rows.length - 1]?.id || "",
      count: archive.count,
      syncedAt: archive.syncedAt,
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      ok: false,
      error: error?.message || "POSTYPE 일괄 등록에 실패했습니다.",
    }, error?.status || 500, { "cache-control": "no-store" });
  }
}
