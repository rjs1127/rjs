import { jsonResponse } from "./_shared.js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;

function requireUserDb(env) {
  if (!env.USER_DB) {
    const error = new Error("D1 binding 'USER_DB'가 설정되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  return env.USER_DB;
}

let schemaReadyPromise = null;

let downloadSchemaReadyPromise = null;

let personalizationSchemaReadyPromise = null;

let quoteFeedSchemaReadyPromise = null;

async function ensurePersonalizationSchema(db) {
  if (personalizationSchemaReadyPromise) return personalizationSchemaReadyPromise;

  personalizationSchemaReadyPromise = db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_likes (
        user_id TEXT NOT NULL,
        work_id TEXT NOT NULL,
        title TEXT,
        author TEXT,
        liked_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, work_id)
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_likes_user_time
      ON user_likes(user_id, liked_at DESC)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT,
        author TEXT,
        quote_text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_quotes_user_time
      ON user_quotes(user_id, created_at DESC)
    `),
  ]).catch((error) => {
    personalizationSchemaReadyPromise = null;
    throw error;
  });

  return personalizationSchemaReadyPromise;
}


async function ensureQuoteFeedSchema(db) {
  if (quoteFeedSchemaReadyPromise) return quoteFeedSchemaReadyPromise;

  quoteFeedSchemaReadyPromise = db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS shared_quotes (
        quote_id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL,
        work_id TEXT,
        title TEXT,
        author TEXT,
        quote_text TEXT NOT NULL,
        shared_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_shared_quotes_time
      ON shared_quotes(shared_at DESC, quote_id DESC)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_shared_quotes_user
      ON shared_quotes(user_id, quote_id)
    `),
  ]).catch((error) => {
    quoteFeedSchemaReadyPromise = null;
    throw error;
  });

  return quoteFeedSchemaReadyPromise;
}

async function ensureDownloadTrackingSchema(db) {
  if (downloadSchemaReadyPromise) return downloadSchemaReadyPromise;

  downloadSchemaReadyPromise = (async () => {
    const info = await db.prepare(
      "PRAGMA table_info(user_items)"
    ).all();

    const columns = Array.isArray(info?.results) ? info.results : [];
    const hasDownloadedAt = columns.some(
      (column) => String(column?.name || "") === "downloaded_at"
    );

    if (!hasDownloadedAt) {
      await db.prepare(
        "ALTER TABLE user_items ADD COLUMN downloaded_at INTEGER"
      ).run();
    }
  })().catch((error) => {
    downloadSchemaReadyPromise = null;
    throw error;
  });

  return downloadSchemaReadyPromise;
}

async function ensureUserSchema(db) {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user
      ON user_sessions(user_id)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_items (
        user_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        progress_percent REAL DEFAULT 0,
        scroll_top REAL,
        chunk_index INTEGER,
        chunk_ratio REAL,
        bookmarked INTEGER DEFAULT 0,
        viewed_at INTEGER,
        read_at INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, file_id)
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_items_recent
      ON user_items(user_id, viewed_at DESC)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_items_bookmark
      ON user_items(user_id, bookmarked)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        visited_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_visits_user
      ON user_visits(user_id, visited_at DESC)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_visits_time
      ON user_visits(visited_at DESC)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_visit_stats (
        user_id TEXT PRIMARY KEY,
        visit_count INTEGER NOT NULL DEFAULT 0,
        last_visit_at INTEGER
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS daily_user_metrics (
        metric_date TEXT PRIMARY KEY,
        visit_count INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_system_meta (
        meta_key TEXT PRIMARY KEY,
        meta_value TEXT,
        updated_at INTEGER NOT NULL
      )
    `),
  ]).catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

function normalizeUserId(value) {
  return String(value || "").trim().toLowerCase();
}

function validateCredentials(userId, password) {
  if (!/^[a-z0-9_-]{3,20}$/.test(userId)) {
    const error = new Error("아이디는 영문 소문자, 숫자, _ - 조합으로 3~20자만 사용할 수 있습니다.");
    error.status = 400;
    throw error;
  }

  if (String(password || "").length < 6 || String(password || "").length > 50) {
    const error = new Error("비밀번호는 6~50자로 입력해주세요.");
    error.status = 400;
    throw error;
  }
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value))
  );
  return bytesToHex(digest);
}

async function hashPassword(password, salt) {
  return sha256Hex(`${salt}::${password}`);
}

async function createSession(db, userId) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;

  await db.prepare(`
    INSERT INTO user_sessions(token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(tokenHash, userId, expiresAt, now).run();

  return { token, expiresAt };
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function requireUser(context) {
  const db = requireUserDb(context.env);

  const token = getBearerToken(context.request);
  if (!token) {
    const error = new Error("로그인이 필요합니다.");
    error.status = 401;
    throw error;
  }

  const tokenHash = await sha256Hex(token);
  const now = Date.now();

  const session = await db.prepare(`
    SELECT user_id, expires_at
    FROM user_sessions
    WHERE token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();

  if (!session || Number(session.expires_at) <= now) {
    if (session) {
      await db.prepare(
        "DELETE FROM user_sessions WHERE token_hash = ?"
      ).bind(tokenHash).run();
    }

    const error = new Error("로그인이 만료되었습니다. 다시 로그인해주세요.");
    error.status = 401;
    throw error;
  }

  return {
    db,
    userId: session.user_id,
    tokenHash,
  };
}

function userErrorResponse(error) {
  return jsonResponse(
    { error: error?.message || "요청을 처리하지 못했습니다." },
    error?.status || 500,
    { "cache-control": "no-store" }
  );
}

export {
  requireUserDb,
  ensureUserSchema,
  ensureDownloadTrackingSchema,
  ensurePersonalizationSchema,
  ensureQuoteFeedSchema,
  normalizeUserId,
  validateCredentials,
  randomHex,
  hashPassword,
  sha256Hex,
  createSession,
  getBearerToken,
  requireUser,
  userErrorResponse,
};
