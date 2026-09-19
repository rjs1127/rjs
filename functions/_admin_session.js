const ADMIN_COOKIE_NAME = "rjs_admin_session";
const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(String(value)));
}

function base64UrlDecodeText(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const result = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = value;
  }

  return result;
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(secret, payloadEncoded) {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadEncoded)
  );
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function createAdminSessionToken(env) {
  const secret = env.ADMIN_PASSWORD;
  if (!secret) {
    const error = new Error("Cloudflare Secret 'ADMIN_PASSWORD'가 설정되지 않았습니다.");
    error.status = 503;
    throw error;
  }

  const now = Date.now();
  const payload = {
    iat: now,
    exp: now + ADMIN_SESSION_SECONDS * 1000,
    nonce: crypto.randomUUID(),
  };

  const encoded = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signPayload(secret, encoded);
  return `${encoded}.${signature}`;
}

async function verifyAdminSessionToken(env, token) {
  const secret = env.ADMIN_PASSWORD;
  if (!secret || !token) return false;

  const parts = String(token).split(".");
  if (parts.length !== 2) return false;

  const [encoded, signature] = parts;
  const expected = await signPayload(secret, encoded);

  if (signature !== expected) return false;

  try {
    const payload = JSON.parse(base64UrlDecodeText(encoded));
    return Number(payload.exp || 0) > Date.now();
  } catch {
    return false;
  }
}

async function isAdminSessionValid(context) {
  const cookies = parseCookies(context.request);
  return verifyAdminSessionToken(
    context.env,
    cookies[ADMIN_COOKIE_NAME] || ""
  );
}

async function requireAdminSession(context) {
  const valid = await isAdminSessionValid(context);
  if (!valid) {
    const error = new Error("관리자 로그인이 필요합니다.");
    error.status = 401;
    throw error;
  }
}

function buildAdminCookie(token) {
  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    `Max-Age=${ADMIN_SESSION_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

function buildClearAdminCookie() {
  return [
    `${ADMIN_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminSessionValid,
  requireAdminSession,
  buildAdminCookie,
  buildClearAdminCookie,
};
