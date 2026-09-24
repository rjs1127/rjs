import { jsonResponse } from "../../_shared.js";
import {
  requireUserDb,
  ensureUserSchema,
  normalizeUserId,
  validateCredentials,
  randomHex,
  hashPassword,
  createSession,
  buildUserSessionCookie,
  userErrorResponse,
} from "../../_user.js";

export async function onRequestPost(context) {
  try {
    const db = requireUserDb(context.env);
    await ensureUserSchema(db);

    const body = await context.request.json();
    const userId = normalizeUserId(body?.userId);
    const password = String(body?.password || "");

    validateCredentials(userId, password);

    const existing = await db.prepare(
      "SELECT user_id FROM users WHERE user_id = ? LIMIT 1"
    ).bind(userId).first();

    if (existing) {
      return jsonResponse({ error: "이미 사용 중인 아이디입니다." }, 409);
    }

    const salt = randomHex(16);
    const passwordHash = await hashPassword(password, salt);
    const now = Date.now();

    await db.prepare(`
      INSERT INTO users(user_id, password_salt, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(userId, salt, passwordHash, now).run();

    const session = await createSession(db, userId);

    return jsonResponse({
      ok: true,
      user: { userId },
      token: session.token,
      expiresAt: session.expiresAt,
    }, 201, {
      "cache-control": "no-store",
      "set-cookie": buildUserSessionCookie(session.token),
    });
  } catch (error) {
    console.error(error);
    return userErrorResponse(error);
  }
}
