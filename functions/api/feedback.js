import { jsonResponse } from "../_shared.js";
import { requireUserDb } from "../_user.js";

const CATEGORIES = new Set(["문의", "오류·수정", "기능 제안", "추가 요청", "계정 문의", "기타"]);
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function ensureFeedbackSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS feedback (
      feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      page TEXT,
      version TEXT,
      diagnostic TEXT,
      account_user_id TEXT,
      reply_contact TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  const info = await db.prepare("PRAGMA table_info(feedback)").all();
  const columns = new Set((info?.results || []).map((column) => String(column?.name || "")));
  const migrations = [
    ["diagnostic", `ALTER TABLE feedback ADD COLUMN diagnostic TEXT`],
    ["account_user_id", `ALTER TABLE feedback ADD COLUMN account_user_id TEXT`],
    ["reply_contact", `ALTER TABLE feedback ADD COLUMN reply_contact TEXT`],
  ];
  for (const [column, sql] of migrations) {
    if (columns.has(column)) continue;
    try {
      await db.prepare(sql).run();
    } catch (error) {
      if (!/duplicate column/i.test(String(error?.message || ""))) throw error;
    }
  }
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_feedback_status_created
    ON feedback(status, created_at DESC)
  `).run();
}

function getTurnstileConfig(env) {
  return {
    siteKey: String(env.TURNSTILE_SITE_KEY || "").trim(),
    secretKey: String(env.TURNSTILE_SECRET_KEY || "").trim(),
  };
}

async function verifyTurnstile(env, token) {
  const { secretKey } = getTurnstileConfig(env);
  if (!secretKey) {
    const error = new Error("자동 입력 방지 설정이 완료되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  const value = String(token || "").trim();
  if (!value) {
    const error = new Error("자동 입력 방지 확인을 완료해 주세요.");
    error.status = 400;
    throw error;
  }
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: secretKey, response: value }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success || (result.action && result.action !== "feedback")) {
    const error = new Error("자동 입력 방지 확인에 실패했습니다. 다시 확인해 주세요.");
    error.status = 400;
    throw error;
  }
}

export async function onRequestGet(context) {
  const { siteKey, secretKey } = getTurnstileConfig(context.env);
  if (!siteKey || !secretKey) {
    return jsonResponse({ error: "Turnstile 설정이 아직 완료되지 않았습니다." }, 503, {
      "cache-control": "no-store",
    });
  }
  return jsonResponse({ siteKey }, 200, { "cache-control": "no-store" });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const honeypot = String(body?.website || "").trim();
    if (honeypot) {
      return jsonResponse({ ok: true }, 200, { "cache-control": "no-store" });
    }

    await verifyTurnstile(context.env, body?.turnstileToken);

    const category = CATEGORIES.has(String(body?.category || ""))
      ? String(body.category)
      : "기타";
    const message = String(body?.message || "").trim();
    const page = String(body?.page || "").trim().slice(0, 300);
    const version = String(body?.version || "").trim().slice(0, 40);
    const isAccountInquiry = category === "계정 문의";
    const diagnostic = isAccountInquiry
      ? ""
      : String(body?.diagnostic || "").trim().slice(0, 8000);
    const accountUserId = isAccountInquiry
      ? String(body?.accountUserId || "").trim().toLowerCase()
      : "";
    const replyContact = isAccountInquiry
      ? String(body?.replyContact || "").trim()
      : "";

    if (message.length < 5 || message.length > 3000) {
      return jsonResponse({ error: "내용은 5자 이상 3000자 이하로 입력해 주세요." }, 400);
    }
    if (isAccountInquiry && !/^[a-z0-9_-]{3,20}$/.test(accountUserId)) {
      return jsonResponse({ error: "계정 아이디 형식을 확인해 주세요." }, 400);
    }
    if (isAccountInquiry && (replyContact.length < 3 || replyContact.length > 200)) {
      return jsonResponse({ error: "답변 받을 연락수단은 3~200자로 입력해 주세요." }, 400);
    }

    const db = requireUserDb(context.env);
    await ensureFeedbackSchema(db);
    const now = Date.now();
    const result = await db.prepare(`
      INSERT INTO feedback(
        category, message, page, version, diagnostic, account_user_id, reply_contact, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
    `).bind(
      category,
      message,
      page || null,
      version || null,
      diagnostic || null,
      isAccountInquiry ? accountUserId : null,
      isAccountInquiry ? replyContact : null,
      now,
      now
    ).run();

    return jsonResponse({ ok: true, id: Number(result?.meta?.last_row_id || 0) }, 201, {
      "cache-control": "no-store",
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status >= 500) console.error("feedback submit failed", error);
    return jsonResponse({ error: error.message || "의견을 저장하지 못했습니다." }, status, {
      "cache-control": "no-store",
    });
  }
}
