import {
  jsonResponse,
  getSheetsAccessToken,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const POSTYPE_SPREADSHEET_ID = "1A6SL397yG59Yfs95x4SAlgqz5oVe26YMOw18gDw2fIw";
const POSTYPE_SHEET_NAME = "POSTYPE";

function normalizeHeader(value) {
  return String(value ?? "").trim();
}

function rowToObject(headers, row) {
  const item = {};

  headers.forEach((header, index) => {
    if (!header) return;
    item[header] = String(row?.[index] ?? "").trim();
  });

  return item;
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);

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
      const message =
        data?.error?.message ||
        `Google Sheets API 오류 (${response.status})`;

      return jsonResponse(
        {
          ok: false,
          error: message,
          spreadsheetId: POSTYPE_SPREADSHEET_ID,
          sheetName: POSTYPE_SHEET_NAME,
        },
        response.status >= 400 && response.status < 500 ? 400 : 502,
        { "cache-control": "no-store" }
      );
    }

    const values = Array.isArray(data?.values) ? data.values : [];
    const headers = (values[0] || []).map(normalizeHeader);
    const rows = values
      .slice(1)
      .filter((row) =>
        Array.isArray(row) &&
        row.some((cell) => String(cell ?? "").trim() !== "")
      )
      .map((row) => rowToObject(headers, row));

    return jsonResponse(
      {
        ok: true,
        spreadsheetId: POSTYPE_SPREADSHEET_ID,
        sheetName: POSTYPE_SHEET_NAME,
        range: data?.range || range,
        headers,
        rowCount: rows.length,
        rows,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message || "POSTYPE 시트를 읽지 못했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
