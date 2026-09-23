import { jsonResponse } from "../_shared.js";
import {
  requireUserDb,
  ensureBookmarkStatsSchema,
  userErrorResponse,
} from "../_user.js";

export async function onRequestGet(context) {
  try {
    const db = requireUserDb(context.env);
    await ensureBookmarkStatsSchema(db);

    const result = await db.prepare(`
      SELECT file_id, bookmark_count
      FROM item_bookmark_counts
      WHERE bookmark_count > 0
      ORDER BY bookmark_count DESC, file_id ASC
    `).all();

    const counts = (Array.isArray(result?.results) ? result.results : []).map((row) => ({
      fileId: String(row?.file_id || ""),
      count: Math.max(0, Number(row?.bookmark_count || 0)),
    })).filter((row) => row.fileId);

    return jsonResponse({
      counts,
      generatedAt: Date.now(),
    }, 200, {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    });
  } catch (error) {
    console.error(error);
    return userErrorResponse(error);
  }
}
