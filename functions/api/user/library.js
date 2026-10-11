import { userPageOffset, userPageCursor, userPageQuery, userPage } from "../../_user_pagination.js";
import { jsonResponse } from "../../_shared.js";
import {
  requireUser,
  ensureDownloadTrackingSchema,
  userErrorResponse,
} from "../../_user.js";

export async function onRequestGet(context) {
  try {
    const auth = await requireUser(context);
    await ensureDownloadTrackingSchema(auth.db);

    const cursor = userPageCursor(context.request);
    const offset = cursor == null ? userPageOffset(context.request) : 0;
    const result = await auth.db.prepare(`
      SELECT
        file_id,
        progress_percent,
        scroll_top,
        chunk_index,
        chunk_ratio,
        bookmarked,
        viewed_at,
        read_at,
        downloaded_at,
        updated_at
      FROM user_items
      WHERE user_id = ?${userPageQuery("items", cursor).where}
      ORDER BY COALESCE(viewed_at, updated_at) DESC, file_id ASC
      LIMIT 501 OFFSET ?
    `).bind(auth.userId, ...userPageQuery("items", cursor).values, offset).all();

    return jsonResponse({
      ok: true,
      ...userPage({ items: result.results || [] }, offset),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}
