import { jsonResponse } from "../_shared.js";
import {
  requireUser,
  ensureQuoteFeedSchema,
  userErrorResponse,
} from "../_user.js";

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    await ensureQuoteFeedSchema(auth.db);

    const body = await context.request.json().catch(() => ({}));
    const quoteId = Number(body?.quoteId || 0);
    const liked = body?.liked === true;
    if (!Number.isInteger(quoteId) || quoteId <= 0) {
      return jsonResponse({ error: "문장 ID가 올바르지 않습니다." }, 400);
    }

    const quote = await auth.db.prepare(`
      SELECT quote_id, like_count
      FROM shared_quotes
      WHERE quote_id = ?
      LIMIT 1
    `).bind(quoteId).first();
    if (!quote) return jsonResponse({ error: "공유된 문장을 찾을 수 없습니다." }, 404);

    if (liked) {
      await auth.db.prepare(`
        INSERT OR IGNORE INTO shared_quote_likes(user_id, quote_id, liked_at)
        VALUES (?, ?, ?)
      `).bind(auth.userId, quoteId, Date.now()).run();
    } else {
      await auth.db.prepare(`
        DELETE FROM shared_quote_likes
        WHERE user_id = ? AND quote_id = ?
      `).bind(auth.userId, quoteId).run();
    }

    const current = await auth.db.prepare(`
      SELECT like_count,
             CASE WHEN EXISTS (
               SELECT 1 FROM shared_quote_likes
               WHERE user_id = ? AND quote_id = ?
             ) THEN 1 ELSE 0 END AS liked
      FROM shared_quotes
      WHERE quote_id = ?
      LIMIT 1
    `).bind(auth.userId, quoteId, quoteId).first();

    return jsonResponse({
      ok: true,
      quoteId,
      liked: Number(current?.liked || 0) === 1,
      likeCount: Math.max(0, Number(current?.like_count || 0)),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}
