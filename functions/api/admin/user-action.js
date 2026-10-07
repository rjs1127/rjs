import { jsonResponse } from "../../_shared.js";
import {
  requireUserDb,
  normalizeUserId,
  ensurePersonalizationSchema,
  ensureQuoteFeedSchema,
  ensureBookmarkStatsSchema,
  randomHex,
  hashPassword,
  userErrorResponse,
} from "../../_user.js";
import { requireAdminSession } from "../../_admin_session.js";

function createTemporaryPassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let password = "";
  for (const value of bytes) password += alphabet[value % alphabet.length];
  return password;
}

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

    if (action === "reset_password") {
      const temporaryPassword = createTemporaryPassword();
      const salt = randomHex(16);
      const passwordHash = await hashPassword(temporaryPassword, salt);

      await db.batch([
        db.prepare(`
          UPDATE users
          SET password_salt = ?, password_hash = ?
          WHERE user_id = ?
        `).bind(salt, passwordHash, userId),
        db.prepare(`DELETE FROM user_sessions WHERE user_id = ?`).bind(userId),
      ]);

      return jsonResponse({
        ok: true,
        action,
        userId,
        temporaryPassword,
      }, 200, { "cache-control": "no-store" });
    }

    if (action === "delete_user") {
      await ensurePersonalizationSchema(db);
      await ensureQuoteFeedSchema(db);
      await ensureBookmarkStatsSchema(db);
      const now = Date.now();
      const feedbackInfo = await db.prepare("PRAGMA table_info(feedback)").all();
      const feedbackColumns = new Set(
        (feedbackInfo?.results || []).map((column) => String(column?.name || ""))
      );
      const deleteStatements = [
        db.prepare(`
          UPDATE item_bookmark_counts
          SET bookmark_count = MAX(0, bookmark_count - 1),
              updated_at = ?
          WHERE file_id IN (
            SELECT file_id
            FROM user_items
            WHERE user_id = ? AND bookmarked = 1
          )
        `).bind(now, userId),
        db.prepare(`DELETE FROM user_sessions WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_items WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_likes WHERE user_id = ?`).bind(userId),
        // 사용자가 다른 사람의 공개 문장에 남긴 좋아요를 먼저 지워 like_count 트리거를 정상 반영한다.
        db.prepare(`DELETE FROM shared_quote_likes WHERE user_id = ?`).bind(userId),
        // 사용자가 공유한 문장을 지우면 기존 트리거가 해당 문장에 달린 모든 좋아요도 정리한다.
        db.prepare(`DELETE FROM shared_quotes WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_quotes WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM reader_notes WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_visits WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM user_visit_stats WHERE user_id = ?`).bind(userId),
      ];

      // v9.50 이후 계정 문의는 account_user_id/reply_contact를 저장하므로 계정 삭제 때 함께 제거한다.
      if (feedbackColumns.has("account_user_id")) {
        deleteStatements.push(
          db.prepare(`
            DELETE FROM feedback
            WHERE category = '계정 문의' AND account_user_id = ?
          `).bind(userId)
        );
      }

      deleteStatements.push(
        db.prepare(`DELETE FROM analytics_sessions WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM users WHERE user_id = ?`).bind(userId),
        db.prepare(`DELETE FROM item_bookmark_counts WHERE bookmark_count <= 0`)
      );

      await db.batch(deleteStatements);

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
