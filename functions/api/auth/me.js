import { jsonResponse } from "../../_shared.js";
import { requireUser, userErrorResponse } from "../../_user.js";

export async function onRequestGet(context) {
  try {
    const auth = await requireUser(context);
    return jsonResponse(
      { ok: true, user: { userId: auth.userId } },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    return userErrorResponse(error);
  }
}
