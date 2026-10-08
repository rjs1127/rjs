import { jsonResponse } from "../../_shared.js";
import { requireUserDb, ensureQuoteFeedSchema, ensurePersonalizationSchema } from "../../_user.js";
import { requireAdminSession } from "../../_admin_session.js";

function clampLimit(value) {
  const parsed = Number(value || 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function clampPage(value) {
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const db = requireUserDb(context.env);
    await ensurePersonalizationSchema(db);
    await ensureQuoteFeedSchema(db);

    const url = new URL(context.request.url);
    const limit = clampLimit(url.searchParams.get("limit"));
    const page = clampPage(url.searchParams.get("page"));
    const offset = (page - 1) * limit;
    const rows = await db.prepare(`
      SELECT quote_id, user_id, work_id, title, author, quote_text,
             shared_at, like_count
      FROM shared_quotes
      ORDER BY shared_at DESC, quote_id DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();
    const count = await db.prepare(`SELECT COUNT(*) AS count FROM shared_quotes`).first();

    return jsonResponse({
      ok: true,
      count: Number(count?.count || 0),
      page,
      limit,
      items: rows?.results || [],
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ error: error?.message || "공개 문장 목록을 불러오지 못했습니다." }, error?.status || 500);
  }
}

export async function onRequestDelete(context) {
  try {
    await requireAdminSession(context);
    const db = requireUserDb(context.env);
    await ensureQuoteFeedSchema(db);

    const body = await context.request.json().catch(() => ({}));
    const quoteId = Number(body?.quoteId || 0);
    if (!Number.isInteger(quoteId) || quoteId <= 0) {
      return jsonResponse({ error: "공개 문장 ID가 올바르지 않습니다." }, 400);
    }

    const result = await db.prepare(`
      DELETE FROM shared_quotes
      WHERE quote_id = ?
    `).bind(quoteId).run();

    if (!Number(result?.meta?.changes || 0)) {
      return jsonResponse({ error: "이미 내려갔거나 찾을 수 없는 공개 문장입니다." }, 404);
    }

    return jsonResponse({ ok: true, quoteId }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ error: error?.message || "공개 문장을 내리지 못했습니다." }, error?.status || 500);
  }
}
