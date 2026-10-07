import { jsonResponse } from "../../_shared.js";
import { requireUserDb } from "../../_user.js";
import { requireAdminSession } from "../../_admin_session.js";
import { ensureFeedbackSchema } from "../../_feedback.js";

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const db = requireUserDb(context.env);
    await ensureFeedbackSchema(db);

    const url = new URL(context.request.url);
    const status = String(url.searchParams.get("status") || "all");
    const allowed = new Set(["all", "new", "checked", "done"]);
    const safeStatus = allowed.has(status) ? status : "all";

    const rows = safeStatus === "all"
      ? await db.prepare(`
          SELECT feedback_id, category, message, page, version, diagnostic, account_user_id, reply_contact, status, created_at, updated_at
          FROM feedback
          ORDER BY created_at DESC
          LIMIT 300
        `).all()
      : await db.prepare(`
          SELECT feedback_id, category, message, page, version, diagnostic, account_user_id, reply_contact, status, created_at, updated_at
          FROM feedback
          WHERE status = ?
          ORDER BY created_at DESC
          LIMIT 300
        `).bind(safeStatus).all();

    const counts = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN status = 'checked' THEN 1 ELSE 0 END) AS checked_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count
      FROM feedback
    `).first();

    return jsonResponse({
      items: rows.results || [],
      counts: {
        total: Number(counts?.total || 0),
        new: Number(counts?.new_count || 0),
        checked: Number(counts?.checked_count || 0),
        done: Number(counts?.done_count || 0),
      },
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ error: error.message || "의견함을 불러오지 못했습니다." }, error.status || 500);
  }
}

export async function onRequestPatch(context) {
  try {
    await requireAdminSession(context);
    const db = requireUserDb(context.env);
    await ensureFeedbackSchema(db);

    const body = await context.request.json().catch(() => ({}));
    const id = Number(body?.id || 0);
    const status = String(body?.status || "");
    if (!Number.isInteger(id) || id <= 0) return jsonResponse({ error: "의견 ID가 올바르지 않습니다." }, 400);
    if (!["new", "checked", "done"].includes(status)) return jsonResponse({ error: "상태 값이 올바르지 않습니다." }, 400);

    const now = Date.now();
    await db.prepare(`
      UPDATE feedback
      SET status = ?,
          reply_contact = CASE
            WHEN ? = 'done' AND category = '계정 문의' THEN NULL
            ELSE reply_contact
          END,
          updated_at = ?
      WHERE feedback_id = ?
    `).bind(status, status, now, id).run();

    return jsonResponse({ ok: true }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ error: error.message || "의견 상태를 변경하지 못했습니다." }, error.status || 500);
  }
}
