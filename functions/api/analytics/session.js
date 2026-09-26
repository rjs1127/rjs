import { jsonResponse } from "../../_shared.js";
import {
  requireUserDb,
  ensureUserSchema,
  requireUser,
} from "../../_user.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_ACTIVE_SECONDS = 12 * 60 * 60;
const MAX_COUNTER = 10000;
const MAX_LOAD_MS = 10 * 60 * 1000;

function kstDateKey(timestamp) {
  return new Date(Number(timestamp) + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function cleanId(value) {
  const text = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]{20,80}$/.test(text) ? text : "";
}

function clampInt(value, min = 0, max = MAX_COUNTER) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function cleanEnum(value, allowed, fallback = "other") {
  const text = String(value || "").trim().toLowerCase();
  return allowed.includes(text) ? text : fallback;
}

function cleanHost(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]/g, "")
    .slice(0, 160);
}

function cleanPerfBucket(value) {
  return {
    sum: clampInt(value?.sum, 0, MAX_LOAD_MS * 500),
    count: clampInt(value?.count, 0, 500),
  };
}

function cleanReaderPerf(value) {
  const source = value && typeof value === "object" ? value : {};
  const cleanGroup = (name, keys) => Object.fromEntries(
    keys.map((key) => [key, cleanPerfBucket(source?.[name]?.[key])])
  );
  return {
    total: cleanPerfBucket(source.total),
    response: cleanPerfBucket(source.response),
    download: cleanPerfBucket(source.download),
    render: cleanPerfBucket(source.render),
    layout: cleanPerfBucket(source.layout),
    cache: cleanGroup("cache", ["hit", "miss", "unknown"]),
    size: cleanGroup("size", ["small", "medium", "large"]),
    mode: cleanGroup("mode", ["scroll", "page"]),
    histogram: {
      under1: clampInt(source?.histogram?.under1, 0, 500),
      oneTo2: clampInt(source?.histogram?.oneTo2, 0, 500),
      twoTo4: clampInt(source?.histogram?.twoTo4, 0, 500),
      fourTo8: clampInt(source?.histogram?.fourTo8, 0, 500),
      over8: clampInt(source?.histogram?.over8, 0, 500),
    },
  };
}

function isSameOriginPost(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function optionalUserId(context) {
  try {
    const auth = await requireUser(context);
    return auth.userId || null;
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  try {
    if (!isSameOriginPost(context.request)) {
      return jsonResponse({ error: "허용되지 않은 요청입니다." }, 403);
    }

    const db = requireUserDb(context.env);
    await ensureUserSchema(db);

    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse({ error: "잘못된 요청입니다." }, 400);
    }

    const visitorId = cleanId(body.visitorId);
    const sessionId = cleanId(body.sessionId);
    if (!visitorId || !sessionId) {
      return jsonResponse({ error: "방문 식별 정보가 올바르지 않습니다." }, 400);
    }

    const now = Date.now();
    const startedAt = Math.max(
      now - 24 * 60 * 60 * 1000,
      Math.min(now, Number(body.startedAt || now))
    );
    const metricDate = kstDateKey(startedAt);
    const userId = await optionalUserId(context);

    const pageViews = clampInt(body.pageViews, 1);
    const workOpens = clampInt(body.workOpens);
    const searches = clampInt(body.searches);
    const activeSeconds = clampInt(body.activeSeconds, 0, MAX_ACTIVE_SECONDS);
    const pageLoadMs = clampInt(body.pageLoadMs, 0, MAX_LOAD_MS) || null;
    const archiveLoadMs = clampInt(body.archiveLoadMs, 0, MAX_LOAD_MS) || null;
    const readerLoadMsSum = clampInt(body.readerLoadMsSum, 0, MAX_LOAD_MS * 500);
    const readerLoadCount = clampInt(body.readerLoadCount, 0, 500);
    const readerPerfJson = JSON.stringify(cleanReaderPerf(body.readerPerf));
    const signupNudgeShown = clampInt(body.signupNudgeShown, 0, 1);
    const signupNudgeLoginClicks = clampInt(body.signupNudgeLoginClicks, 0, 1);
    const signupNudgeSignupClicks = clampInt(body.signupNudgeSignupClicks, 0, 1);
    const signupNudgeLoginCompleted = clampInt(body.signupNudgeLoginCompleted, 0, 1);
    const signupNudgeSignupCompleted = clampInt(body.signupNudgeSignupCompleted, 0, 1);
    const deviceType = cleanEnum(body.deviceType, ["mobile", "tablet", "desktop"]);
    const browserName = cleanEnum(body.browserName, [
      "safari",
      "chrome",
      "samsung",
      "firefox",
      "edge",
      "other",
    ]);
    const sourceType = cleanEnum(body.sourceType, [
      "direct",
      "internal",
      "search",
      "social",
      "external",
    ], "direct");
    const referrerHost = cleanHost(body.referrerHost);

    await db.prepare(`
      INSERT INTO analytics_sessions(
        session_id,
        visitor_id,
        user_id,
        metric_date,
        started_at,
        last_seen_at,
        page_views,
        work_opens,
        searches,
        active_seconds,
        device_type,
        browser_name,
        source_type,
        referrer_host,
        page_load_ms,
        archive_load_ms,
        reader_load_ms_sum,
        reader_load_count,
        reader_perf_json,
        signup_nudge_shown,
        signup_nudge_login_clicks,
        signup_nudge_signup_clicks,
        signup_nudge_login_completed,
        signup_nudge_signup_completed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        user_id = COALESCE(excluded.user_id, analytics_sessions.user_id),
        last_seen_at = MAX(analytics_sessions.last_seen_at, excluded.last_seen_at),
        page_views = MAX(analytics_sessions.page_views, excluded.page_views),
        work_opens = MAX(analytics_sessions.work_opens, excluded.work_opens),
        searches = MAX(analytics_sessions.searches, excluded.searches),
        active_seconds = MAX(analytics_sessions.active_seconds, excluded.active_seconds),
        page_load_ms = COALESCE(analytics_sessions.page_load_ms, excluded.page_load_ms),
        archive_load_ms = COALESCE(excluded.archive_load_ms, analytics_sessions.archive_load_ms),
        reader_load_ms_sum = MAX(analytics_sessions.reader_load_ms_sum, excluded.reader_load_ms_sum),
        reader_load_count = MAX(analytics_sessions.reader_load_count, excluded.reader_load_count),
        reader_perf_json = excluded.reader_perf_json,
        signup_nudge_shown = MAX(analytics_sessions.signup_nudge_shown, excluded.signup_nudge_shown),
        signup_nudge_login_clicks = MAX(analytics_sessions.signup_nudge_login_clicks, excluded.signup_nudge_login_clicks),
        signup_nudge_signup_clicks = MAX(analytics_sessions.signup_nudge_signup_clicks, excluded.signup_nudge_signup_clicks),
        signup_nudge_login_completed = MAX(analytics_sessions.signup_nudge_login_completed, excluded.signup_nudge_login_completed),
        signup_nudge_signup_completed = MAX(analytics_sessions.signup_nudge_signup_completed, excluded.signup_nudge_signup_completed)
    `).bind(
      sessionId,
      visitorId,
      userId,
      metricDate,
      startedAt,
      now,
      pageViews,
      workOpens,
      searches,
      activeSeconds,
      deviceType,
      browserName,
      sourceType,
      referrerHost || null,
      pageLoadMs,
      archiveLoadMs,
      readerLoadMsSum,
      readerLoadCount,
      readerPerfJson,
      signupNudgeShown,
      signupNudgeLoginClicks,
      signupNudgeSignupClicks,
      signupNudgeLoginCompleted,
      signupNudgeSignupCompleted
    ).run();

    return jsonResponse(
      { ok: true, sessionId, userLinked: Boolean(userId), recordedAt: now },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error("방문 분석 세션 저장 실패", error);
    return jsonResponse(
      { error: "방문 통계를 기록하지 못했습니다." },
      500,
      { "cache-control": "no-store" }
    );
  }
}
