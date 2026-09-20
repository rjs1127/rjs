import {
  jsonResponse,
  getSheetsAccessToken,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const POSTYPE_SPREADSHEET_ID = "1A6SL397yG59Yfs95x4SAlgqz5oVe26YMOw18gDw2fIw";
const POSTYPE_SHEET_NAME = "POSTYPE";

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

function rowHasData(row) {
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

async function ensurePublishedDateHeader(accessToken, values) {
  const headers = (values[0] || []).map(normalize);
  const existingIndex = headers.findIndex(
    (header) => header.toLowerCase() === "publisheddate"
  );

  if (existingIndex >= 0) {
    return {
      headers,
      publishedDateColumn: existingIndex,
      added: false,
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
      values: [["publishedDate"]],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `publishedDate 컬럼 생성 오류 (${response.status})`
    );
  }

  headers.push("publishedDate");
  if (!values[0]) values[0] = [];
  values[0][columnIndex] = "publishedDate";

  return {
    headers,
    publishedDateColumn: columnIndex,
    added: true,
  };
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);

    const accessToken = await getSheetsAccessToken(context.env);
    const values = await readSheet(accessToken);
    const headerInfo = await ensurePublishedDateHeader(
      accessToken,
      values
    );
    const headerIndex = buildHeaderIndex(headerInfo.headers);

    const items = [];

    for (let index = 1; index < values.length; index += 1) {
      const row = values[index] || [];
      if (!rowHasData(row)) continue;

      items.push({
        rowNumber: index + 1,
        id: cell(row, headerIndex, "id").toUpperCase(),
        combination: cell(row, headerIndex, "combination"),
        subCp1: cell(row, headerIndex, "subCp1"),
        subCp2: cell(row, headerIndex, "subCp2"),
        title: cell(row, headerIndex, "title"),
        genre: cell(row, headerIndex, "genre"),
        author: cell(row, headerIndex, "author"),
        status: cell(row, headerIndex, "status"),
        lengthType: cell(row, headerIndex, "lengthType"),
        publishedDate: cell(row, headerIndex, "publishedDate"),
        url: cell(row, headerIndex, "url"),
        enabled: cell(row, headerIndex, "enabled").toUpperCase(),
      });
    }

    return jsonResponse(
      {
        ok: true,
        headerAdded: headerInfo.added,
        count: items.length,
        missingPublishedDateCount: items.filter(
          (item) => !item.publishedDate
        ).length,
        items,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message ||
          "POSTYPE 작품 목록을 불러오지 못했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
