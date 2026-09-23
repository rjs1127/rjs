import { jsonResponse } from "../_shared.js";
import { requireUserDb, ensureQuoteFeedSchema } from "../_user.js";

function clampLimit(value) {
  const parsed = Number(value || 18);
  if (!Number.isFinite(parsed)) return 18;
  return Math.max(1, Math.min(36, Math.floor(parsed)));
}

function parseCursor(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const [sharedAtRaw, quoteIdRaw] = raw.split(":");
  const sharedAt = Number(sharedAtRaw);
  const quoteId = Number(quoteIdRaw);
  if (!Number.isFinite(sharedAt) || !Number.isInteger(quoteId) || quoteId <= 0) return null;
  return { sharedAt, quoteId };
}

export async function onRequestGet(context) {
  try {
    const db = requireUserDb(context.env);
    await ensureQuoteFeedSchema(db);

    const url = new URL(context.request.url);
    const limit = clampLimit(url.searchParams.get("limit"));
    const cursor = parseCursor(url.searchParams.get("cursor"));
    const fetchLimit = limit + 1;

    const query = cursor
      ? db.prepare(`
          SELECT quote_id, work_id, title, author, quote_text, shared_at
          FROM shared_quotes
          WHERE shared_at < ? OR (shared_at = ? AND quote_id < ?)
          ORDER BY shared_at DESC, quote_id DESC
          LIMIT ?
        `).bind(cursor.sharedAt, cursor.sharedAt, cursor.quoteId, fetchLimit)
      : db.prepare(`
          SELECT quote_id, work_id, title, author, quote_text, shared_at
          FROM shared_quotes
          ORDER BY shared_at DESC, quote_id DESC
          LIMIT ?
        `).bind(fetchLimit);

    const result = await query.all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    const last = visible[visible.length - 1];

    return jsonResponse({
      ok: true,
      items: visible,
      nextCursor: hasMore && last ? `${Number(last.shared_at)}:${Number(last.quote_id)}` : null,
    }, 200, {
      "cache-control": "no-store",
    });
  } catch (error) {
    return jsonResponse({ error: error?.message || "문장 피드를 불러오지 못했습니다." }, 500, {
      "cache-control": "no-store",
    });
  }
}
