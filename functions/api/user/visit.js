import { jsonResponse } from "../../_shared.js";
import { requireUser, userErrorResponse } from "../../_user.js";

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    const now = Date.now();

    await auth.db.prepare(`
      INSERT INTO user_visits(user_id, visited_at)
      VALUES (?, ?)
    `).bind(auth.userId, now).run();

    return jsonResponse(
      { ok: true, visitedAt: now },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    return userErrorResponse(error);
  }
}
