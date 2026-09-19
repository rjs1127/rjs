import { jsonResponse } from "../../_shared.js";
import {
  requireUser,
  ensureUserSchema,
  userErrorResponse,
} from "../../_user.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKstDateKey(timestamp) {
  return new Date(timestamp + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export async function onRequestPost(context) {
  try {
    // New metric tables are checked only once per Worker isolate,
    // not on every authenticated API request.
    const db = context.env.USER_DB;
    await ensureUserSchema(db);

    const auth = await requireUser(context);
    const now = Date.now();
    const metricDate = getKstDateKey(now);

    await auth.db.batch([
      auth.db.prepare(`
        INSERT INTO user_visit_stats(user_id, visit_count, last_visit_at)
        VALUES (?, 1, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          visit_count = user_visit_stats.visit_count + 1,
          last_visit_at = excluded.last_visit_at
      `).bind(auth.userId, now),

      auth.db.prepare(`
        INSERT INTO daily_user_metrics(metric_date, visit_count, updated_at)
        VALUES (?, 1, ?)
        ON CONFLICT(metric_date) DO UPDATE SET
          visit_count = daily_user_metrics.visit_count + 1,
          updated_at = excluded.updated_at
      `).bind(metricDate, now),
    ]);

    return jsonResponse(
      { ok: true, visitedAt: now },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    return userErrorResponse(error);
  }
}
