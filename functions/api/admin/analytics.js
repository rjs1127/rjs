import { jsonResponse } from "../../_shared.js";
import { requireUserDb, ensureUserSchema } from "../../_user.js";
import { requireAdminSession } from "../../_admin_session.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(timestamp) {
  return new Date(Number(timestamp) + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function buildDateKeys(days) {
  const now = Date.now();
  const todayStartUtc =
    Math.floor((now + KST_OFFSET_MS) / 86400000) * 86400000 - KST_OFFSET_MS;

  return Array.from({ length: days }, (_, index) => {
    const start = todayStartUtc - (days - 1 - index) * 86400000;
    return { key: kstDateKey(start), start };
  });
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const db = requireUserDb(context.env);
    await ensureUserSchema(db);

    const url = new URL(context.request.url);
    const days = Math.max(7, Math.min(30, Number(url.searchParams.get("days") || 14)));
    const dateKeys = buildDateKeys(days);
    const from = dateKeys[0].start;
    const fromDate = dateKeys[0].key;
    const todayDate = dateKeys.at(-1).key;

    const [
      summaryRow,
      todayRow,
      visitorRow,
      dailyRows,
      hourlyRows,
      deviceRows,
      browserRows,
      sourceRows,
      referrerRows,
      performanceRow,
      recentRows,
      firstDataRow,
    ] = await Promise.all([
      db.prepare(`
        SELECT
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors,
          SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) AS logged_sessions,
          SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS guest_sessions,
          COALESCE(SUM(page_views), 0) AS page_views,
          COALESCE(SUM(work_opens), 0) AS work_opens,
          COALESCE(SUM(searches), 0) AS searches,
          COALESCE(SUM(active_seconds), 0) AS active_seconds,
          SUM(CASE WHEN work_opens >= 1 THEN 1 ELSE 0 END) AS engaged_sessions,
          SUM(CASE WHEN work_opens >= 3 OR active_seconds >= 600 THEN 1 ELSE 0 END) AS active_sessions,
          SUM(CASE WHEN work_opens = 0 AND active_seconds < 600 THEN 1 ELSE 0 END) AS browse_sessions,
          SUM(CASE WHEN work_opens BETWEEN 1 AND 2 AND active_seconds < 600 THEN 1 ELSE 0 END) AS reading_sessions
        FROM analytics_sessions
        WHERE started_at >= ?
      `).bind(from).first(),

      db.prepare(`
        SELECT
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors,
          SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) AS logged_sessions,
          SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS guest_sessions,
          COALESCE(SUM(work_opens), 0) AS work_opens
        FROM analytics_sessions
        WHERE metric_date = ?
      `).bind(todayDate).first(),

      db.prepare(`
        WITH period_visitors AS (
          SELECT DISTINCT visitor_id
          FROM analytics_sessions
          WHERE started_at >= ?
        ), lifetime AS (
          SELECT
            s.visitor_id,
            COUNT(*) AS session_count,
            MIN(s.started_at) AS first_seen_at
          FROM analytics_sessions s
          INNER JOIN period_visitors p ON p.visitor_id = s.visitor_id
          GROUP BY s.visitor_id
        )
        SELECT
          COUNT(*) AS visitors,
          SUM(CASE WHEN session_count >= 2 THEN 1 ELSE 0 END) AS returning_visitors,
          SUM(CASE WHEN first_seen_at >= ? THEN 1 ELSE 0 END) AS new_visitors
        FROM lifetime
      `).bind(from, from).first(),

      db.prepare(`
        SELECT
          metric_date,
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors,
          SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) AS logged_sessions,
          SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS guest_sessions,
          COALESCE(SUM(work_opens), 0) AS work_opens,
          COALESCE(SUM(searches), 0) AS searches,
          COALESCE(SUM(active_seconds), 0) AS active_seconds
        FROM analytics_sessions
        WHERE metric_date >= ?
        GROUP BY metric_date
        ORDER BY metric_date ASC
      `).bind(fromDate).all(),

      db.prepare(`
        SELECT
          strftime('%H', CAST(started_at / 1000 AS INTEGER), 'unixepoch', '+9 hours') AS hour,
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM analytics_sessions
        WHERE started_at >= ?
        GROUP BY hour
        ORDER BY hour ASC
      `).bind(from).all(),

      db.prepare(`
        SELECT COALESCE(device_type, 'other') AS name, COUNT(*) AS count
        FROM analytics_sessions
        WHERE started_at >= ?
        GROUP BY device_type
        ORDER BY count DESC
      `).bind(from).all(),

      db.prepare(`
        SELECT COALESCE(browser_name, 'other') AS name, COUNT(*) AS count
        FROM analytics_sessions
        WHERE started_at >= ?
        GROUP BY browser_name
        ORDER BY count DESC
      `).bind(from).all(),

      db.prepare(`
        SELECT COALESCE(source_type, 'direct') AS name, COUNT(*) AS count
        FROM analytics_sessions
        WHERE started_at >= ?
        GROUP BY source_type
        ORDER BY count DESC
      `).bind(from).all(),

      db.prepare(`
        SELECT referrer_host AS name, COUNT(*) AS count
        FROM analytics_sessions
        WHERE started_at >= ?
          AND referrer_host IS NOT NULL
          AND referrer_host <> ''
          AND source_type IN ('search', 'social', 'external')
        GROUP BY referrer_host
        ORDER BY count DESC
        LIMIT 8
      `).bind(from).all(),

      db.prepare(`
        SELECT
          AVG(CASE WHEN page_load_ms > 0 THEN page_load_ms END) AS page_load_ms,
          AVG(CASE WHEN archive_load_ms > 0 THEN archive_load_ms END) AS archive_load_ms,
          CASE
            WHEN SUM(reader_load_count) > 0
            THEN CAST(SUM(reader_load_ms_sum) AS REAL) / SUM(reader_load_count)
            ELSE NULL
          END AS reader_load_ms,
          SUM(reader_load_count) AS reader_load_count
        FROM analytics_sessions
        WHERE started_at >= ?
      `).bind(from).first(),

      db.prepare(`
        SELECT
          session_id,
          visitor_id,
          user_id,
          started_at,
          last_seen_at,
          page_views,
          work_opens,
          searches,
          active_seconds,
          device_type,
          browser_name,
          source_type
        FROM analytics_sessions
        WHERE started_at >= ?
        ORDER BY last_seen_at DESC
        LIMIT 30
      `).bind(from).all(),

      db.prepare(`SELECT MIN(started_at) AS started_at FROM analytics_sessions`).first(),
    ]);

    const dailyMap = new Map(dateKeys.map(({ key }) => [key, {
      date: key,
      sessions: 0,
      visitors: 0,
      loggedSessions: 0,
      guestSessions: 0,
      workOpens: 0,
      searches: 0,
      activeSeconds: 0,
    }]));

    for (const row of rows(dailyRows)) {
      if (!dailyMap.has(row.metric_date)) continue;
      dailyMap.set(row.metric_date, {
        date: row.metric_date,
        sessions: Number(row.sessions || 0),
        visitors: Number(row.visitors || 0),
        loggedSessions: Number(row.logged_sessions || 0),
        guestSessions: Number(row.guest_sessions || 0),
        workOpens: Number(row.work_opens || 0),
        searches: Number(row.searches || 0),
        activeSeconds: Number(row.active_seconds || 0),
      });
    }

    const sessions = Number(summaryRow?.sessions || 0);
    const visitors = Number(summaryRow?.visitors || 0);
    const returningVisitors = Number(visitorRow?.returning_visitors || 0);
    const engagedSessions = Number(summaryRow?.engaged_sessions || 0);
    const activeSessions = Number(summaryRow?.active_sessions || 0);

    return jsonResponse({
      ok: true,
      periodDays: days,
      dataStartedAt: Number(firstDataRow?.started_at || 0) || null,
      summary: {
        sessions,
        visitors,
        loggedSessions: Number(summaryRow?.logged_sessions || 0),
        guestSessions: Number(summaryRow?.guest_sessions || 0),
        pageViews: Number(summaryRow?.page_views || 0),
        workOpens: Number(summaryRow?.work_opens || 0),
        searches: Number(summaryRow?.searches || 0),
        activeSeconds: Number(summaryRow?.active_seconds || 0),
        returningVisitors,
        newVisitors: Number(visitorRow?.new_visitors || 0),
        returnRate: visitors ? (returningVisitors / visitors) * 100 : 0,
        averageSessionsPerVisitor: visitors ? sessions / visitors : 0,
        averageWorkOpensPerSession: sessions ? Number(summaryRow?.work_opens || 0) / sessions : 0,
        averageSearchesPerSession: sessions ? Number(summaryRow?.searches || 0) / sessions : 0,
        averageActiveSecondsPerSession: sessions ? Number(summaryRow?.active_seconds || 0) / sessions : 0,
        engagedSessions,
        engagedRate: sessions ? (engagedSessions / sessions) * 100 : 0,
        activeSessions,
        activeRate: sessions ? (activeSessions / sessions) * 100 : 0,
        browseSessions: Number(summaryRow?.browse_sessions || 0),
        readingSessions: Number(summaryRow?.reading_sessions || 0),
      },
      today: {
        sessions: Number(todayRow?.sessions || 0),
        visitors: Number(todayRow?.visitors || 0),
        loggedSessions: Number(todayRow?.logged_sessions || 0),
        guestSessions: Number(todayRow?.guest_sessions || 0),
        workOpens: Number(todayRow?.work_opens || 0),
      },
      performance: {
        pageLoadMs: performanceRow?.page_load_ms == null ? null : Number(performanceRow.page_load_ms),
        archiveLoadMs: performanceRow?.archive_load_ms == null ? null : Number(performanceRow.archive_load_ms),
        readerLoadMs: performanceRow?.reader_load_ms == null ? null : Number(performanceRow.reader_load_ms),
        readerLoadCount: Number(performanceRow?.reader_load_count || 0),
      },
      daily: [...dailyMap.values()],
      hourly: rows(hourlyRows).map((row) => ({
        hour: Number(row.hour || 0),
        sessions: Number(row.sessions || 0),
        visitors: Number(row.visitors || 0),
      })),
      devices: rows(deviceRows).map((row) => ({ name: row.name, count: Number(row.count || 0) })),
      browsers: rows(browserRows).map((row) => ({ name: row.name, count: Number(row.count || 0) })),
      sources: rows(sourceRows).map((row) => ({ name: row.name, count: Number(row.count || 0) })),
      referrers: rows(referrerRows).map((row) => ({ name: row.name, count: Number(row.count || 0) })),
      recent: rows(recentRows).map((row) => ({
        sessionId: row.session_id,
        visitorLabel: row.user_id || `익명 ${String(row.visitor_id || "").slice(0, 6)}`,
        loggedIn: Boolean(row.user_id),
        startedAt: Number(row.started_at || 0),
        lastSeenAt: Number(row.last_seen_at || 0),
        pageViews: Number(row.page_views || 0),
        workOpens: Number(row.work_opens || 0),
        searches: Number(row.searches || 0),
        activeSeconds: Number(row.active_seconds || 0),
        deviceType: row.device_type || "other",
        browserName: row.browser_name || "other",
        sourceType: row.source_type || "direct",
      })),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error("관리자 방문 분석 조회 실패", error);
    return jsonResponse(
      { error: error?.message || "방문 분석을 불러오지 못했습니다." },
      Number(error?.status || 500),
      { "cache-control": "no-store" }
    );
  }
}
