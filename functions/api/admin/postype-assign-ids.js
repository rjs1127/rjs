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

function columnToA1(index) {
  let value = Number(index) + 1;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function findIdColumn(headers) {
  return headers.findIndex(
    (header) => normalize(header).toLowerCase() === "id"
  );
}

function getNextNumber(values, idColumn) {
  let max = 0;

  for (const row of values.slice(1)) {
    const id = normalize(row?.[idColumn]);
    const match = id.match(/^P(\d+)$/i);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }

  return max + 1;
}

function hasRowData(row, idColumn) {
  if (!Array.isArray(row)) return false;

  return row.some((cell, index) => {
    if (index === idColumn) return false;
    return normalize(cell) !== "";
  });
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);

    const accessToken = await getSheetsAccessToken(context.env);
    const range = `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!A:Z`;

    const readUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/` +
      `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values/` +
      `${encodeURIComponent(range)}?majorDimension=ROWS`;

    const readResponse = await fetch(readUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const readData = await readResponse.json();

    if (!readResponse.ok) {
      throw new Error(
        readData?.error?.message ||
        `Google Sheets API 읽기 오류 (${readResponse.status})`
      );
    }

    const values = Array.isArray(readData?.values) ? readData.values : [];
    const headers = (values[0] || []).map(normalize);
    const idColumn = findIdColumn(headers);

    if (idColumn < 0) {
      const error = new Error(
        'POSTYPE 시트 첫 행에 "id" 컬럼이 필요합니다.'
      );
      error.status = 400;
      throw error;
    }

    let nextNumber = getNextNumber(values, idColumn);
    const idColumnLetter = columnToA1(idColumn);
    const updates = [];
    const assigned = [];

    for (let index = 1; index < values.length; index += 1) {
      const row = values[index] || [];

      if (!hasRowData(row, idColumn)) continue;
      if (normalize(row[idColumn])) continue;

      const id = `P${String(nextNumber).padStart(4, "0")}`;
      nextNumber += 1;

      const rowNumber = index + 1;
      const cellRange =
        `'${POSTYPE_SHEET_NAME.replace(/'/g, "''")}'!` +
        `${idColumnLetter}${rowNumber}`;

      updates.push({
        range: cellRange,
        values: [[id]],
      });

      assigned.push({
        row: rowNumber,
        id,
      });
    }

    if (updates.length) {
      const writeUrl =
        `https://sheets.googleapis.com/v4/spreadsheets/` +
        `${encodeURIComponent(POSTYPE_SPREADSHEET_ID)}/values:batchUpdate`;

      const writeResponse = await fetch(writeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: updates,
        }),
      });

      const writeData = await writeResponse.json();

      if (!writeResponse.ok) {
        throw new Error(
          writeData?.error?.message ||
          `Google Sheets API 쓰기 오류 (${writeResponse.status})`
        );
      }
    }

    return jsonResponse(
      {
        ok: true,
        spreadsheetId: POSTYPE_SPREADSHEET_ID,
        sheetName: POSTYPE_SHEET_NAME,
        assignedCount: assigned.length,
        assigned,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message || "POSTYPE ID 자동 생성에 실패했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
