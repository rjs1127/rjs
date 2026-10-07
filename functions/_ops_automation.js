import {
  ARCHIVE_CACHE_KEY,
  OVERRIDES_KEY,
  POSTYPE_INDEX_KEY,
  jsonResponse,
  requireKv,
  getJson,
} from "./_shared.js";
import { requireUserDb, ensureUserSchema } from "./_user.js";

const AUTO_SYNC_STATUS_KEYS = { postype: "automation:auto-sync:postype:v1", drive: "automation:auto-sync:drive:v1" };
const OPS_STATUS_KEY = "automation:ops-status:v1";
const RESTORE_INDEX_KEY = "automation:restore-points:index:v1";
const RESTORE_PREFIX = "automation:restore-point:v1:";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const RESTORE_TTL_SECONDS = 30 * 24 * 60 * 60;
const RESTORE_KEEP = 30;

function kstParts(value = Date.now()) {
  const shifted = new Date(Number(value) + KST_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
  };
}

function previousDateKey(dateKey) {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) - 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function scheduledDateForNow() {
  const parts = kstParts();
  return parts.hour >= 23 ? parts.date : previousDateKey(parts.date);
}

function sameKstDate(value, expected) {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return kstParts(parsed).date === expected;
}

export async function createDailyRestorePoint(kv, source, payload, summary = {}) {
  if (!kv || !["drive", "postype"].includes(source)) return null;
  const date = kstParts().date;
  const key = `${RESTORE_PREFIX}${date}:${source}`;
  const existing = await kv.get(key);
  if (existing) return null;

  const createdAt = new Date().toISOString();
  const point = {
    version: 1,
    source,
    date,
    createdAt,
    summary,
    payload,
  };
  await kv.put(key, JSON.stringify(point), { expirationTtl: RESTORE_TTL_SECONDS });

  const currentIndex = await getJson(kv, RESTORE_INDEX_KEY, []);
  const nextIndex = [
    { key, source, date, createdAt, summary },
    ...(Array.isArray(currentIndex) ? currentIndex : []).filter((item) => item?.key !== key),
  ].slice(0, RESTORE_KEEP);
  await kv.put(RESTORE_INDEX_KEY, JSON.stringify(nextIndex));
  return point;
}

function parsePerfRows(rows = []) {
  let hit = 0;
  let miss = 0;
  for (const row of rows) {
    try {
      const perf = JSON.parse(row.reader_perf_json || "{}");
      hit += Number(perf?.cache?.hit?.count || 0);
      miss += Number(perf?.cache?.miss?.count || 0);
    } catch {}
  }
  return { hit, miss };
}

async function collectPerformance(env) {
  const db = requireUserDb(env);
  await ensureUserSchema(db);
  const from = Date.now() - 24 * 60 * 60 * 1000;
  const [summary, perfRows] = await Promise.all([
    db.prepare(`
      SELECT
        AVG(CASE WHEN page_load_ms > 0 THEN page_load_ms END) AS page_avg,
        AVG(CASE WHEN archive_load_ms > 0 THEN archive_load_ms END) AS archive_avg,
        SUM(reader_load_ms_sum) AS reader_sum,
        SUM(reader_load_count) AS reader_count
      FROM analytics_sessions
      WHERE started_at >= ?
    `).bind(from).first(),
    db.prepare(`
      SELECT reader_perf_json
      FROM analytics_sessions
      WHERE started_at >= ? AND reader_perf_json IS NOT NULL AND reader_perf_json <> '{}'
    `).bind(from).all(),
  ]);

  const readerCount = Number(summary?.reader_count || 0);
  const readerAverageMs = readerCount ? Number(summary?.reader_sum || 0) / readerCount : null;
  const cache = parsePerfRows(perfRows?.results || []);
  const cacheTotal = cache.hit + cache.miss;
  const missRate = cacheTotal ? cache.miss / cacheTotal : 0;
  return {
    sampleHours: 24,
    pageAverageMs: summary?.page_avg == null ? null : Number(summary.page_avg),
    archiveAverageMs: summary?.archive_avg == null ? null : Number(summary.archive_avg),
    readerAverageMs,
    readerCount,
    cacheHit: cache.hit,
    cacheMiss: cache.miss,
    cacheMissRate: missRate,
  };
}

function buildPerformanceWarnings(perf) {
  const warnings = [];
  if (perf.readerCount >= 10 && Number(perf.readerAverageMs || 0) >= 3000) {
    warnings.push(`작품 뷰어 평균 ${Math.round(perf.readerAverageMs)}ms`);
  }
  if (Number(perf.pageAverageMs || 0) >= 1800) warnings.push(`페이지 초기 로딩 ${Math.round(perf.pageAverageMs)}ms`);
  if (Number(perf.archiveAverageMs || 0) >= 1500) warnings.push(`목록 로딩 ${Math.round(perf.archiveAverageMs)}ms`);
  const cacheTotal = Number(perf.cacheHit || 0) + Number(perf.cacheMiss || 0);
  if (cacheTotal >= 20 && perf.cacheMissRate >= 0.15) {
    warnings.push(`KV MISS 비율 ${(perf.cacheMissRate * 100).toFixed(1)}%`);
  }
  return warnings;
}

function buildSyncHealth(postype, drive) {
  const expectedDate = scheduledDateForNow();
  const rows = [
    { source: "postype", label: "POSTYPE", status: postype },
    { source: "drive", label: "Drive", status: drive },
  ].map((item) => {
    const last = item.status?.lastScheduledAt || "";
    const error = item.status?.lastScheduledError || "";
    const warning = item.status?.lastScheduledWarning || "";
    const scheduledState = item.status?.lastScheduledState || (
      error ? "error" :
      warning ? "warning" :
      item.status?.state === "error" ? "error" :
      "success"
    );
    const onTime = sameKstDate(last, expectedDate);
    const needsAttention = !onTime || scheduledState !== "success" || Boolean(error) || Boolean(warning);
    return {
      ...item,
      expectedDate,
      lastScheduledAt: last,
      onTime,
      needsAttention,
      scheduledState,
      error: error || "",
      warning: warning || "",
    };
  });
  return {
    expectedDate,
    rows,
    delayed: rows.filter((row) => !row.onTime),
    attention: rows.filter((row) => row.needsAttention),
  };
}

export async function runOpsAutomation(env, trigger = "schedule") {
  const kv = requireKv(env);
  const [performance, postype, drive, restorePoints] = await Promise.all([
    collectPerformance(env),
    getJson(kv, AUTO_SYNC_STATUS_KEYS.postype, null),
    getJson(kv, AUTO_SYNC_STATUS_KEYS.drive, null),
    getJson(kv, RESTORE_INDEX_KEY, []),
  ]);

  const perfWarnings = buildPerformanceWarnings(performance);
  const syncHealth = buildSyncHealth(postype, drive);
  const warnings = [
    ...perfWarnings.map((text) => ({ type: "performance", text })),
    ...syncHealth.attention.map((row) => ({
      type: "sync",
      source: row.source,
      text: row.error
        ? `${row.label} 자동동기화 오류: ${row.error}`
        : row.warning
          ? `${row.label} 자동동기화 확인 필요: ${row.warning}`
          : `${row.label} 자동동기화 확인 필요`,
    })),
  ];
  const checkedAt = new Date().toISOString();
  const status = {
    state: warnings.length ? "warning" : "normal",
    trigger,
    checkedAt,
    performance,
    performanceWarnings: perfWarnings,
    syncHealth,
    warnings,
    latestRestorePoint: Array.isArray(restorePoints) && restorePoints.length ? restorePoints[0] : null,
    restorePointCount: Array.isArray(restorePoints) ? restorePoints.length : 0,
  };
  await kv.put(OPS_STATUS_KEY, JSON.stringify(status));
  return status;
}

export async function getOpsAutomationStatus(env) {
  const kv = requireKv(env);
  const [saved, restorePoints, postype, drive] = await Promise.all([
    getJson(kv, OPS_STATUS_KEY, null),
    getJson(kv, RESTORE_INDEX_KEY, []),
    getJson(kv, AUTO_SYNC_STATUS_KEYS.postype, null),
    getJson(kv, AUTO_SYNC_STATUS_KEYS.drive, null),
  ]);
  const syncHealth = buildSyncHealth(postype, drive);
  const performanceWarnings = Array.isArray(saved?.performanceWarnings) ? saved.performanceWarnings : [];
  const syncWarnings = syncHealth.attention.map((row) => ({
    type: "sync",
    source: row.source,
    text: row.error
      ? `${row.label} 자동동기화 오류: ${row.error}`
      : row.warning
        ? `${row.label} 자동동기화 확인 필요: ${row.warning}`
        : `${row.label} 자동동기화 확인 필요`,
  }));
  const warnings = [
    ...performanceWarnings.map((value) => typeof value === "string" ? { type: "performance", text: value } : value),
    ...syncWarnings,
  ];
  const currentStatus = saved ? {
    ...saved,
    state: warnings.length ? "warning" : "normal",
    syncHealth,
    warnings,
  } : null;
  return {
    status: currentStatus,
    syncHealth,
    restorePoints: Array.isArray(restorePoints) ? restorePoints.slice(0, 10) : [],
    schedule: { time: "00:30", timezone: "Asia/Seoul", description: "전날 자동동기화 및 최근 24시간 성능 점검" },
  };
}

export { OPS_STATUS_KEY, RESTORE_INDEX_KEY };
