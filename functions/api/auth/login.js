import { jsonResponse } from "../../_shared.js";
import {
  requireUserDb,
  ensureUserSchema,
  normalizeUserId,
  validateCredentials,
  hashPassword,
  createSession,
  buildUserSessionCookie,
  buildClearUserSessionCookie,
  userErrorResponse,
} from "../../_user.js";

export async function onRequestPost(context) {
  try {
    const db = requireUserDb(context.env);
    await ensureUserSchema(db);

    const body = await context.request.json();
    const userId = normalizeUserId(body?.userId);
    const password = String(body?.password || "");
    const remember = body?.remember !== false;

    validateCredentials(userId, password);

    const user = await db.prepare(`
      SELECT user_id, password_salt, password_hash
      FROM users
      WHERE user_id = ?
      LIMIT 1
    `).bind(userId).first();

    if (!user) {
      return jsonResponse({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
    }

    const passwordHash = await hashPassword(password, user.password_salt);

    if (passwordHash !== user.password_hash) {
      return jsonResponse({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
    }

    const session = await createSession(db, userId);

    return jsonResponse({
      ok: true,
      user: { userId },
      token: session.token,
      expiresAt: session.expiresAt,
    }, 200, {
      "cache-control": "no-store",
      "set-cookie": remember
        ? buildUserSessionCookie(session.token)
        : buildClearUserSessionCookie(),
    });
  } catch (error) {
    console.error(error);
    return userErrorResponse(error);
  }
}
