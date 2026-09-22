import {
  ARCHIVE_CACHE_KEY,
  jsonResponse,
  requireKv,
  getJson,
  refreshPublicArchiveIndex,
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

async function ensurePostypeSchemaHeaders(accessToken, values) {
  const headers = (values[0] || []).map(normalize);
  const original = [...headers];
  const legacyIndex = headers.findIndex((header) => header.toLowerCase() === "publisheddate");
  const latestIndex = headers.findIndex((header) => header.toLowerCase() === "latestpublisheddate");

  if (latestIndex < 0 && legacyIndex >= 0) headers[legacyIndex] = "latestPublishedDate";
  else if (latestIndex < 0) headers.push("latestPublishedDate");

  for (const name of ["workLength", "publishType", "linkType", "manualUrls"]) {
    if (!headers.some((header) => header.toLowerCase() === name.toLowerCase())) headers.push(name);
  }

  const changed = headers.length !== original.length || headers.some((value, index) => value !== original[index]);
  if (changed) {
    const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A1:AZ1`;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
    const response = await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: [headers] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `POSTYPE 컬럼 자동 구성 오류 (${response.status})`);
  }

  if (!values[0]) values[0] = [];
  values[0] = headers;
  return { headers, changed };
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

async function readSheetRange(accessToken, range) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
    `${encodeURIComponent(range)}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const fallback = rawText.trim().replace(/\s+/g, " ").slice(0, 240);
    throw new Error(
      data?.error?.message ||
      fallback ||
      `Google Sheets API 읽기 오류 (${response.status})`
    );
  }

  return Array.isArray(data?.values) ? data.values : [];
}

async function readHeaderRow(accessToken) {
  const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A1:AZ1`;
  return readSheetRange(accessToken, range);
}

async function readIdColumn(accessToken, idColumnIndex) {
  const letter = columnLetter(idColumnIndex);
  const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!${letter}2:${letter}`;
  return readSheetRange(accessToken, range);
}

async function readFullSheet(accessToken) {
  const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A:Z`;
  return readSheetRange(accessToken, range);
}


function buildArchiveItem(id, item) {
  return {
    id,
    source: "postype",
    combination: item.combination,
    subCp1: item.subCp1,
    subCp2: item.subCp2,
    title: item.title,
    genre: item.genre,
    author: item.author,
    status: item.status,
    lengthType: item.lengthType,
    workLength: item.workLength,
    publishType: item.publishType,
    linkType: item.linkType,
    manualUrls: item.manualUrls,
    latestPublishedDate: item.latestPublishedDate,
    url: item.url,
    fileName: null,
    parseFailed: false,
    createdTime: null,
    modifiedTime: null,
    size: null,
  };
}

function appendItemsToArchive(existingArchive, rows, cleanItems) {
  if (!existingArchive || !Array.isArray(existingArchive.items)) return null;

  const appendedItems = rows.map(({ id }, index) => buildArchiveItem(id, cleanItems[index]));
  const existingItems = existingArchive.items.filter((item) => item && item.id);
  const mergedItems = [...existingItems, ...appendedItems];
  const disabledCount = Number(existingArchive.disabledCount || 0);
  const previousTotalRows = Number(
    existingArchive.totalRows ?? (existingItems.length + disabledCount)
  );

  return {
    ...existingArchive,
    source: "postype",
    syncedAt: new Date().toISOString(),
    count: mergedItems.length,
    totalRows: previousTotalRows + appendedItems.length,
    disabledCount,
    items: mergedItems,
  };
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
      status: cell(row, headerIndex, "status"),
      lengthType: cell(row, headerIndex, "lengthType"),
      workLength: cell(row, headerIndex, "workLength") || (["단편", "장편"].includes(cell(row, headerIndex, "lengthType")) ? cell(row, headerIndex, "lengthType") : ""),
      publishType: cell(row, headerIndex, "publishType") || (/\/series\/\d+/i.test(url) ? "다회차" : "단일글"),
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
  let stage = "auth";

  try {
    await requireAdminSession(context);

    stage = "request";
    const kv = requireKv(context.env);
    const body = await context.request.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return jsonResponse({ error: "등록할 작품이 없습니다." }, 400);
    }
    if (items.length > 300) {
      return jsonResponse({ error: "한 번에 최대 300개까지 등록할 수 있습니다." }, 400);
    }

    stage = "validation";
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
      const publishType = normalize(raw?.publishType);
      const workLength = "";
      const lengthType = publishType === "다회차" ? "시리즈" : "단편";
      const linkType = normalize(raw?.linkType);
      const manualUrls = normalize(raw?.manualUrls);
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
      if (!["단일글", "다회차"].includes(publishType)) {
        throw new Error(`${rowNo}행: 게시형태를 확인해 주세요.`);
      }
      if (!["post", "series", "manual"].includes(linkType)) {
        throw new Error(`${rowNo}행: 연결방식을 확인해 주세요.`);
      }
      if (!isValidUrl(url)) throw new Error(`${rowNo}행: URL을 확인해 주세요.`);
      if (linkType === "series" && !isPostypeSeriesUrl(url)) {
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
        workLength,
        publishType,
        linkType,
        manualUrls,
        latestPublishedDate,
        url,
      };
    });

    stage = "google_auth";
    const accessToken = await getSheetsAccessToken(context.env);

    // 등록 전에는 A:Z 전체를 읽지 않는다. 헤더 1행과 ID 열만 읽어
    // 시트가 커져도 등록 요청이 무거워지지 않도록 한다.
    stage = "sheet_header";
    const headerValues = await readHeaderRow(accessToken);
    const headerInfo = await ensurePostypeSchemaHeaders(accessToken, headerValues);
    const headers = headerInfo.headers;
    const headerIndex = buildHeaderIndex(headers);
    const missing = REQUIRED_HEADERS.filter((name) => !headerIndex.has(name.toLowerCase()));
    if (missing.length) {
      return jsonResponse({ error: `필수 컬럼 누락: ${missing.join(", ")}` }, 400);
    }

    stage = "sheet_ids";
    const idColumnIndex = headerIndex.get("id");
    const idValues = await readIdColumn(accessToken, idColumnIndex);
    const highestSheetId = getHighestSheetId([["id"], ...idValues], 0);
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

    stage = "sheet_append";
    const appendRange = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A:AZ`;
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

    const appendText = await appendResponse.text();
    let appendData = null;
    try {
      appendData = appendText ? JSON.parse(appendText) : null;
    } catch {
      appendData = null;
    }

    if (!appendResponse.ok) {
      const fallback = appendText.trim().replace(/\s+/g, " ").slice(0, 240);
      throw new Error(
        appendData?.error?.message ||
        fallback ||
        `Google Sheets API 등록 오류 (${appendResponse.status})`
      );
    }

    const lastNumber = nextNumber - 1;

    stage = "kv_sequence";
    await kv.put(POSTYPE_ID_SEQUENCE_KEY, String(lastNumber));

    // 기존 공개 캐시에 방금 등록한 항목만 합쳐 즉시 노출한다.
    // 매 등록마다 A:Z 전체를 다시 읽는 비용/실패 가능성을 제거한다.
    stage = "kv_index";
    const existingArchive = await getJson(kv, POSTYPE_INDEX_KEY, null);
    let archive = appendItemsToArchive(existingArchive, rows, cleanItems);

    // 캐시가 비어 있는 예외 상황에서만 전체 시트를 읽어 복구한다.
    if (!archive) {
      stage = "sheet_rebuild_fallback";
      const updatedValues = await readFullSheet(accessToken);
      archive = buildArchive(updatedValues, (updatedValues[0] || []).map(normalize));
    }

    await kv.put(POSTYPE_INDEX_KEY, JSON.stringify(archive));
    await refreshPublicArchiveIndex(kv, { postypeArchive: archive });

    return jsonResponse({
      ok: true,
      addedCount: rows.length,
      firstId: rows[0]?.id || "",
      lastId: rows[rows.length - 1]?.id || "",
      count: archive.count,
      syncedAt: archive.syncedAt,
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(`POSTYPE bulk add failed at ${stage}`, error);
    return jsonResponse({
      ok: false,
      stage,
      error: error?.message || "POSTYPE 일괄 등록에 실패했습니다.",
    }, error?.status || 500, { "cache-control": "no-store" });
  }
}
