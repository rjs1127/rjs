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
      WHERE user_id = ?
      ORDER BY COALESCE(viewed_at, updated_at) DESC
      LIMIT 500
    `).bind(auth.userId).all();

    return jsonResponse({
      ok: true,
      items: result.results || [],
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}
