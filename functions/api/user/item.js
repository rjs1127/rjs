import { jsonResponse } from "../../_shared.js";
import {
  requireUser,
  ensureDownloadTrackingSchema,
  userErrorResponse,
} from "../../_user.js";

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    const body = await context.request.json();

    const action = String(body?.action || "").trim();
    const fileId = String(body?.fileId || "").trim();
    const now = Date.now();

    if (action === "clear_bookmarks") {
      await auth.db.prepare(`
        UPDATE user_items
        SET bookmarked = 0, updated_at = ?
        WHERE user_id = ? AND bookmarked = 1
      `).bind(now, auth.userId).run();

      return jsonResponse({ ok: true });
    }

    if (action === "clear_recent") {
      await auth.db.prepare(`
        UPDATE user_items
        SET viewed_at = NULL, updated_at = ?
        WHERE user_id = ? AND viewed_at IS NOT NULL
      `).bind(now, auth.userId).run();

      return jsonResponse({ ok: true });
    }

    if (!fileId) {
      return jsonResponse({ error: "파일 ID가 없습니다." }, 400);
    }

    if (action === "download") {
      await ensureDownloadTrackingSchema(auth.db);

      await auth.db.prepare(`
        INSERT INTO user_items(
          user_id,
          file_id,
          downloaded_at,
          updated_at
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, file_id) DO UPDATE SET
          downloaded_at = excluded.downloaded_at,
          updated_at = excluded.updated_at
        WHERE user_items.downloaded_at IS NULL
      `).bind(auth.userId, fileId, now, now).run();

      return jsonResponse({
        ok: true,
        downloadedAt: now,
      });
    }

    if (action === "remove_recent") {
      await auth.db.prepare(`
        UPDATE user_items
        SET viewed_at = NULL, updated_at = ?
        WHERE user_id = ? AND file_id = ?
      `).bind(now, auth.userId, fileId).run();

      return jsonResponse({ ok: true });
    }

    if (action === "view") {
      await auth.db.prepare(`
        INSERT INTO user_items(user_id, file_id, viewed_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, file_id) DO UPDATE SET
          viewed_at = excluded.viewed_at,
          updated_at = excluded.updated_at
      `).bind(auth.userId, fileId, now, now).run();

      return jsonResponse({ ok: true, viewedAt: now });
    }

    if (action === "bookmark") {
      const bookmarked = body?.bookmarked ? 1 : 0;

      await auth.db.prepare(`
        INSERT INTO user_items(user_id, file_id, bookmarked, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, file_id) DO UPDATE SET
          bookmarked = excluded.bookmarked,
          updated_at = excluded.updated_at
      `).bind(auth.userId, fileId, bookmarked, now).run();

      return jsonResponse({ ok: true, bookmarked: Boolean(bookmarked) });
    }

    if (action === "progress") {
      const percent = Math.max(0, Math.min(100, Number(body?.percent || 0)));
      const mode = body?.mode === "chunk" ? "chunk" : "scroll";
      const scrollTop = Number.isFinite(Number(body?.scrollTop))
        ? Number(body.scrollTop)
        : null;
      const chunkIndex = Number.isFinite(Number(body?.chunkIndex))
        ? Math.max(0, Math.floor(Number(body.chunkIndex)))
        : null;
      const chunkRatio = Number.isFinite(Number(body?.chunkRatio))
        ? Math.max(0, Math.min(1, Number(body.chunkRatio)))
        : null;
      const markRead = body?.read === true;
      const clearLegacyRead = body?.clearLegacyRead === true;
      const readAt = markRead ? now : null;

      await auth.db.prepare(`
        INSERT INTO user_items(
          user_id,
          file_id,
          progress_percent,
          scroll_top,
          chunk_index,
          chunk_ratio,
          read_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, file_id) DO UPDATE SET
          progress_percent = excluded.progress_percent,
          scroll_top = excluded.scroll_top,
          chunk_index = excluded.chunk_index,
          chunk_ratio = excluded.chunk_ratio,
          read_at = CASE
            WHEN excluded.read_at IS NOT NULL THEN excluded.read_at
            WHEN ? = 1 THEN NULL
            ELSE user_items.read_at
          END,
          updated_at = excluded.updated_at
      `).bind(
        auth.userId,
        fileId,
        percent,
        mode === "scroll" ? scrollTop : null,
        mode === "chunk" ? chunkIndex : null,
        mode === "chunk" ? chunkRatio : null,
        readAt,
        now,
        clearLegacyRead ? 1 : 0
      ).run();

      return jsonResponse({
        ok: true,
        progressPercent: percent,
        read: markRead,
        legacyReadCleared: clearLegacyRead && !markRead,
      });
    }

    return jsonResponse({ error: "지원하지 않는 저장 작업입니다." }, 400);
  } catch (error) {
    console.error(error);
    return userErrorResponse(error);
  }
}
