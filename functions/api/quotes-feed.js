import { jsonResponse } from "../_shared.js";
import {
  requireUserDb,
  ensureQuoteFeedSchema,
  getBearerToken,
  sha256Hex,
} from "../_user.js";

function clampLimit(value) {
  const parsed = Number(value || 18);
  if (!Number.isFinite(parsed)) return 18;
  return Math.max(1, Math.min(36, Math.floor(parsed)));
}

function parseLatestCursor(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const [sharedAtRaw, quoteIdRaw] = raw.split(":");
  const sharedAt = Number(sharedAtRaw);
  const quoteId = Number(quoteIdRaw);
  if (!Number.isFinite(sharedAt) || !Number.isInteger(quoteId) || quoteId <= 0) return null;
  return { sharedAt, quoteId };
}

function parseLikesCursor(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const [likeCountRaw, sharedAtRaw, quoteIdRaw] = raw.split(":");
  const likeCount = Number(likeCountRaw);
  const sharedAt = Number(sharedAtRaw);
  const quoteId = Number(quoteIdRaw);
  if (!Number.isInteger(likeCount) || likeCount < 0 || !Number.isFinite(sharedAt) || !Number.isInteger(quoteId) || quoteId <= 0) return null;
  return { likeCount, sharedAt, quoteId };
}

async function getOptionalUserId(db, request) {
  const token = getBearerToken(request);
  if (!token) return "";
  const tokenHash = await sha256Hex(token);
  const session = await db.prepare(`
    SELECT user_id, expires_at
    FROM user_sessions
    WHERE token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();
  if (!session || Number(session.expires_at) <= Date.now()) return "";
  return String(session.user_id || "");
}

export async function onRequestGet(context) {
  try {
    const db = requireUserDb(context.env);
    await ensureQuoteFeedSchema(db);

    const url = new URL(context.request.url);
    const limit = clampLimit(url.searchParams.get("limit"));
    const sort = url.searchParams.get("sort") === "likes" ? "likes" : "latest";
    const fetchLimit = limit + 1;
    const userId = await getOptionalUserId(db, context.request);

    let query;
    if (sort === "likes") {
      const cursor = parseLikesCursor(url.searchParams.get("cursor"));
      const where = cursor
        ? `WHERE sq.like_count < ? OR (sq.like_count = ? AND (sq.shared_at < ? OR (sq.shared_at = ? AND sq.quote_id < ?)))`
        : "";
      const sql = `
        SELECT sq.quote_id, sq.work_id, sq.title, sq.author, sq.quote_text, sq.shared_at, sq.like_count,
               ${userId ? "CASE WHEN l.quote_id IS NULL THEN 0 ELSE 1 END" : "0"} AS liked
        FROM shared_quotes sq
        ${userId ? "LEFT JOIN shared_quote_likes l ON l.quote_id = sq.quote_id AND l.user_id = ?" : ""}
        ${where}
        ORDER BY sq.like_count DESC, sq.shared_at DESC, sq.quote_id DESC
        LIMIT ?
      `;
      const params = [];
      if (userId) params.push(userId);
      if (cursor) params.push(cursor.likeCount, cursor.likeCount, cursor.sharedAt, cursor.sharedAt, cursor.quoteId);
      params.push(fetchLimit);
      query = db.prepare(sql).bind(...params);
    } else {
      const cursor = parseLatestCursor(url.searchParams.get("cursor"));
      const where = cursor
        ? `WHERE sq.shared_at < ? OR (sq.shared_at = ? AND sq.quote_id < ?)`
        : "";
      const sql = `
        SELECT sq.quote_id, sq.work_id, sq.title, sq.author, sq.quote_text, sq.shared_at, sq.like_count,
               ${userId ? "CASE WHEN l.quote_id IS NULL THEN 0 ELSE 1 END" : "0"} AS liked
        FROM shared_quotes sq
        ${userId ? "LEFT JOIN shared_quote_likes l ON l.quote_id = sq.quote_id AND l.user_id = ?" : ""}
        ${where}
        ORDER BY sq.shared_at DESC, sq.quote_id DESC
        LIMIT ?
      `;
      const params = [];
      if (userId) params.push(userId);
      if (cursor) params.push(cursor.sharedAt, cursor.sharedAt, cursor.quoteId);
      params.push(fetchLimit);
      query = db.prepare(sql).bind(...params);
    }

    const result = await query.all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    const last = visible[visible.length - 1];
    const nextCursor = hasMore && last
      ? (sort === "likes"
          ? `${Number(last.like_count || 0)}:${Number(last.shared_at)}:${Number(last.quote_id)}`
          : `${Number(last.shared_at)}:${Number(last.quote_id)}`)
      : null;

    return jsonResponse({
      ok: true,
      sort,
      items: visible,
      nextCursor,
    }, 200, {
      "cache-control": "no-store",
    });
  } catch (error) {
    return jsonResponse({ error: error?.message || "문장 피드를 불러오지 못했습니다." }, 500, {
      "cache-control": "no-store",
    });
  }
}
