import { jsonResponse } from "../../_shared.js";
import { requireUser, userErrorResponse } from "../../_user.js";

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    await auth.db.prepare(
      "DELETE FROM user_sessions WHERE token_hash = ?"
    ).bind(auth.tokenHash).run();

    return jsonResponse({ ok: true }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}
