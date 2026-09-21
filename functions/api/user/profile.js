import { jsonResponse } from "../../_shared.js";
import {
  requireUser,
  ensurePersonalizationSchema,
  userErrorResponse,
} from "../../_user.js";

function cleanText(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

export async function onRequestGet(context) {
  try {
    const auth = await requireUser(context);
    await ensurePersonalizationSchema(auth.db);

    const [user, likes, quotes] = await Promise.all([
      auth.db.prepare(`
        SELECT user_id, created_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `).bind(auth.userId).first(),
      auth.db.prepare(`
        SELECT work_id, title, author, liked_at
        FROM user_likes
        WHERE user_id = ?
        ORDER BY liked_at DESC
        LIMIT 500
      `).bind(auth.userId).all(),
      auth.db.prepare(`
        SELECT id, title, author, quote_text, created_at
        FROM user_quotes
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 500
      `).bind(auth.userId).all(),
    ]);

    return jsonResponse({
      ok: true,
      user: {
        userId: auth.userId,
        createdAt: user?.created_at == null ? null : Number(user.created_at),
      },
      likes: likes?.results || [],
      quotes: quotes?.results || [],
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    await ensurePersonalizationSchema(auth.db);
    const body = await context.request.json();
    const action = String(body?.action || "").trim();
    const now = Date.now();

    if (action === "like") {
      const workId = cleanText(body?.workId, 300);
      const liked = body?.liked === true;
      if (!workId) return jsonResponse({ error: "작품 ID가 없습니다." }, 400);

      if (liked) {
        await auth.db.prepare(`
          INSERT INTO user_likes(user_id, work_id, title, author, liked_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, work_id) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            liked_at = excluded.liked_at
        `).bind(
          auth.userId,
          workId,
          cleanText(body?.title, 300),
          cleanText(body?.author, 200),
          now
        ).run();
      } else {
        await auth.db.prepare(`
          DELETE FROM user_likes
          WHERE user_id = ? AND work_id = ?
        `).bind(auth.userId, workId).run();
      }

      return jsonResponse({ ok: true, liked, likedAt: liked ? now : null });
    }

    if (action === "quote_save") {
      const quoteText = cleanText(body?.quoteText, 4000);
      if (!quoteText) return jsonResponse({ error: "저장할 문장이 없습니다." }, 400);

      const result = await auth.db.prepare(`
        INSERT INTO user_quotes(user_id, title, author, quote_text, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        auth.userId,
        cleanText(body?.title, 300),
        cleanText(body?.author, 200),
        quoteText,
        now
      ).run();

      return jsonResponse({
        ok: true,
        quote: {
          id: Number(result?.meta?.last_row_id || 0),
          title: cleanText(body?.title, 300),
          author: cleanText(body?.author, 200),
          quoteText,
          createdAt: now,
        },
      });
    }

    if (action === "quote_delete") {
      const id = Number(body?.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return jsonResponse({ error: "저장 문장 ID가 올바르지 않습니다." }, 400);
      }
      await auth.db.prepare(`
        DELETE FROM user_quotes
        WHERE user_id = ? AND id = ?
      `).bind(auth.userId, id).run();
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    return userErrorResponse(error);
  }
}
