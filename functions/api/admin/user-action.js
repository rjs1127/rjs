import { jsonResponse } from "../../_shared.js";
import {
  requireUserDb,
  normalizeUserId,
  ensurePersonalizationSchema,
  userErrorResponse,
} from "../../_user.js";
import { requireAdminSession } from "../../_admin_session.js";

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);

    const db = requireUserDb(context.env);

    const body = await context.request.json();
    const action = String(body?.action || "").trim();
    const userId = normalizeUserId(body?.userId);

    if (!userId) {
      return jsonResponse({ error: "사용자 아이디가 없습니다." }, 400);
    }

    const existing = await db.prepare(`
      SELECT user_id
      FROM users
      WHERE user_id = ?
      LIMIT 1
    `).bind(userId).first();

    if (!existing) {
      return jsonResponse({ error: "해당 사용자를 찾을 수 없습니다." }, 404);
    }

    if (action === "reset_sessions") {
      const result = await db.prepare(`
        DELETE FROM user_sessions
        WHERE user_id = ?
      `).bind(userId).run();

      return jsonResponse({
        ok: true,
        action,
        userId,
        deletedSessions: Number(result.meta?.changes || 0),
      });
    }

    if (action === "delete_user") {
      await ensurePersonalizationSchema(db);
      await db.batch([
        db.prepare(`DELETE FROM user_sessions WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_items WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_likes WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_quotes WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_visits WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_visit_stats WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM users WHERE user_id = ?`).bind(userId),
      ]);

      return jsonResponse({
        ok: true,
        action,
        userId,
      });
    }

    return jsonResponse({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    console.error(error);
    return userErrorResponse(error);
  }
}
