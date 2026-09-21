import { requireAdminSession } from "../../_admin_session.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
    },
  });
}

function byteLength(value) {
  return new TextEncoder().encode(String(value ?? "")).byteLength;
}

function formatKvCategory(keyName) {
  if (keyName.startsWith("body:")) {
    return {
      id: "body",
      label: "TXT 본문 캐시",
      purpose: "TXT를 다시 열 때 Google Drive 재요청을 줄이기 위한 본문 캐시",
    };
  }

  const exact = {
    "archive:data:v3": {
      id: "archive",
      label: "Drive 목록 캐시",
      purpose: "사용자 콘텐츠 목록의 Drive TXT 원본 인덱스",
    },
    "archive:overrides:v1": {
      id: "archive-overrides",
      label: "제목·작성자 수정값",
      purpose: "자동 파싱 실패 파일의 관리자 수동 수정값",
    },
    "archive:settings:v1": {
      id: "settings",
      label: "사이트 설정",
      purpose: "사이트명·제목·파비콘 등 화면 설정",
    },
    "postype:index:v1": {
      id: "postype",
      label: "POSTYPE 목록 캐시",
      purpose: "Google Sheet에서 동기화한 POSTYPE 작품 인덱스",
    },
    "postype:id-sequence:v1": {
      id: "postype-sequence",
      label: "POSTYPE ID 시퀀스",
      purpose: "P0001 형식의 다음 작품 ID 관리",
    },
    "archive:drive-content-type-overrides:v1": {
      id: "drive-type",
      label: "Drive 작품형태 수동값",
      purpose: "자동 단편/연재 판정을 관리자가 고정한 값",
    },
    "archive:drive-status-overrides:v1": {
      id: "drive-status",
      label: "Drive 상태 수동값",
      purpose: "Drive 연재물의 연재중/완결 수동 상태",
    },
  };

  if (exact[keyName]) return exact[keyName];

  if (keyName.startsWith("postype:")) {
    return {
      id: "postype-other",
      label: "POSTYPE 기타",
      purpose: "POSTYPE 동기화·관리용 보조 데이터",
    };
  }

  if (keyName.startsWith("archive:")) {
    return {
      id: "archive-other",
      label: "Archive 기타",
      purpose: "아카이브 동작을 위한 보조 KV 데이터",
    };
  }

  return {
    id: "other",
    label: "기타 KV",
    purpose: "현재 분류표에 없는 KV 데이터",
  };
}

async function listAllKvKeys(kv) {
  const keys = [];
  let cursor = undefined;

  do {
    const page = await kv.list({
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });

    keys.push(...(page?.keys || []));
    cursor = page?.list_complete ? undefined : page?.cursor;
  } while (cursor);

  return keys;
}

async function measureKvBytes(kv, keys) {
  const sizeByName = new Map();
  const batchSize = 10;

  for (let offset = 0; offset < keys.length; offset += batchSize) {
    const batch = keys.slice(offset, offset + batchSize);

    const values = await Promise.all(
      batch.map(async (key) => {
        const value = await kv.get(key.name, "arrayBuffer");
        return {
          name: key.name,
          bytes: value ? value.byteLength : 0,
        };
      })
    );

    for (const value of values) {
      sizeByName.set(value.name, value.bytes);
    }
  }

  return sizeByName;
}

function aggregateKv(keys, sizeByName = null) {
  const categories = new Map();

  for (const key of keys) {
    const category = formatKvCategory(key.name);
    const current = categories.get(category.id) || {
      id: category.id,
      label: category.label,
      purpose: category.purpose,
      keyCount: 0,
      bytes: sizeByName ? 0 : null,
    };

    current.keyCount += 1;

    if (sizeByName) {
      current.bytes += Number(sizeByName.get(key.name) || 0);
    }

    categories.set(category.id, current);
  }

  const rows = [...categories.values()].sort((a, b) => {
    if (a.id === "body") return -1;
    if (b.id === "body") return 1;
    return b.keyCount - a.keyCount;
  });

  return {
    categories: rows,
    totalBytes: sizeByName
      ? rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0)
      : null,
  };
}

function firstNumericValue(row) {
  if (!row || typeof row !== "object") return null;

  for (const value of Object.values(row)) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

async function inspectD1(db) {
  if (!db) {
    return {
      bound: false,
      tableCount: 0,
      totalRows: 0,
      bytes: null,
      tables: [],
    };
  }

  const knownTables = [
    {
      name: "users",
      label: "사용자 계정",
      purpose: "아이디·비밀번호 hash·가입일",
    },
    {
      name: "user_sessions",
      label: "로그인 세션",
      purpose: "로그인 유지 token hash와 만료시간",
    },
    {
      name: "user_items",
      label: "개인 독서 기록",
      purpose: "이어보기·북마크·최근조회·읽음·다운로드 기록",
    },
    {
      name: "user_visits",
      label: "방문 원본 기록",
      purpose: "로그인 사용자 방문 이벤트",
    },
    {
      name: "user_visit_stats",
      label: "사용자 방문 집계",
      purpose: "사용자별 누적 방문수·최근 방문일",
    },
    {
      name: "daily_user_metrics",
      label: "일별 방문 집계",
      purpose: "관리자 대시보드 일별 방문수",
    },
    {
      name: "user_system_meta",
      label: "사용자 시스템 메타",
      purpose: "D1 사용자 시스템 내부 상태",
    },
  ];

  const sqliteRows = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all();

  const existing = new Set(
    (sqliteRows?.results || []).map((row) => String(row?.name || ""))
  );

  const tables = [];

  for (const table of knownTables) {
    if (!existing.has(table.name)) continue;

    const row = await db
      .prepare(`SELECT COUNT(*) AS count FROM ${table.name}`)
      .first();

    tables.push({
      ...table,
      count: Number(row?.count || 0),
    });
  }

  let bytes = null;
  let pageCount = null;
  let pageSize = null;

  try {
    pageCount = firstNumericValue(
      await db.prepare("PRAGMA page_count").first()
    );
    pageSize = firstNumericValue(
      await db.prepare("PRAGMA page_size").first()
    );

    if (
      Number.isFinite(pageCount) &&
      Number.isFinite(pageSize)
    ) {
      bytes = pageCount * pageSize;
    }
  } catch {
    // Some D1 environments may not expose file-level PRAGMA metrics.
  }

  return {
    bound: true,
    tableCount: tables.length,
    totalRows: tables.reduce((sum, row) => sum + row.count, 0),
    bytes,
    pageCount,
    pageSize,
    tables,
  };
}

async function inspectR2(bucket) {
  if (!bucket) {
    return {
      bound: false,
      appUsesR2: false,
      objectCount: 0,
      bytes: 0,
      note: "현재 운영 코드에서는 R2를 사용하지 않습니다.",
    };
  }

  let cursor = undefined;
  let objectCount = 0;
  let bytes = 0;

  do {
    const page = await bucket.list({
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });

    for (const object of page?.objects || []) {
      objectCount += 1;
      bytes += Number(object?.size || 0);
    }

    cursor = page?.truncated ? page?.cursor : undefined;
  } while (cursor);

  return {
    bound: true,
    appUsesR2: false,
    objectCount,
    bytes,
    note:
      "R2 binding은 남아 있지만 현재 TXT 본문 코드는 R2를 읽거나 쓰지 않습니다. 과거 레거시 객체가 남아 있을 수 있습니다.",
  };
}


const CLOUDFLARE_GRAPHQL_ENDPOINT =
  "https://api.cloudflare.com/client/v4/graphql";
const CLOUDFLARE_API_ENDPOINT =
  "https://api.cloudflare.com/client/v4";
const DEFAULT_PAGES_PROJECT_NAME = "google-drive-archive-site";
const PAGES_FREE_MONTHLY_BUILD_LIMIT = 500;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstMonthRange(now = new Date()) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS);
  const end = new Date(Date.UTC(year, month + 1, 1) - KST_OFFSET_MS);

  return {
    year,
    month: month + 1,
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${year}.${String(month + 1).padStart(2, "0")}`,
    timezone: "Asia/Seoul",
  };
}

function summarizePagesDeployment(item) {
  const metadata = item?.deployment_trigger?.metadata || {};
  const latestStage = item?.latest_stage || {};

  return {
    id: String(item?.id || ""),
    shortId: String(item?.short_id || ""),
    createdOn: String(item?.created_on || ""),
    environment: String(item?.environment || ""),
    status: String(latestStage?.status || (item?.is_skipped ? "skipped" : "unknown")),
    stage: String(latestStage?.name || ""),
    skipped: Boolean(item?.is_skipped),
    triggerType: String(item?.deployment_trigger?.type || ""),
    branch: String(metadata?.branch || ""),
    commitHash: String(metadata?.commit_hash || ""),
    commitMessage: String(metadata?.commit_message || "").slice(0, 160),
  };
}

async function queryCloudflarePagesDeployments(env) {
  const token = String(env.CLOUDFLARE_PAGES_TOKEN || "").trim();
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const projectName = String(
    env.CLOUDFLARE_PAGES_PROJECT_NAME || DEFAULT_PAGES_PROJECT_NAME
  ).trim();
  const range = kstMonthRange();

  if (!token || !accountId || !projectName) {
    return {
      configured: false,
      connected: false,
      projectName,
      limit: PAGES_FREE_MONTHLY_BUILD_LIMIT,
      range,
      apiRequests: 0,
      deployments: [],
      note: "Pages 배포 조회에 필요한 CLOUDFLARE_PAGES_TOKEN, Account ID 또는 Project Name을 확인해 주세요.",
    };
  }

  const deployments = [];
  let apiRequests = 0;
  let page = 1;
  const perPage = 100;
  const maxPages = 10;
  const monthStart = Date.parse(range.start);
  const monthEnd = Date.parse(range.end);

  try {
    while (page <= maxPages) {
      const endpoint =
        `${CLOUDFLARE_API_ENDPOINT}/accounts/${encodeURIComponent(accountId)}` +
        `/pages/projects/${encodeURIComponent(projectName)}/deployments` +
        `?page=${page}&per_page=${perPage}`;

      const response = await fetch(endpoint, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
      });
      apiRequests += 1;

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`Cloudflare Pages 응답을 해석하지 못했습니다. HTTP ${response.status}`);
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(
          payload?.errors?.[0]?.message ||
          `Cloudflare Pages 배포 조회 실패 · HTTP ${response.status}`
        );
      }

      const rows = Array.isArray(payload?.result) ? payload.result : [];
      let reachedBeforeMonth = false;

      for (const row of rows) {
        const created = Date.parse(String(row?.created_on || ""));
        if (!Number.isFinite(created)) continue;
        if (created < monthStart) {
          reachedBeforeMonth = true;
          continue;
        }
        if (created >= monthEnd) continue;
        deployments.push(summarizePagesDeployment(row));
      }

      const totalPages = Number(payload?.result_info?.total_pages || 0);
      if (reachedBeforeMonth || rows.length < perPage || (totalPages && page >= totalPages)) {
        break;
      }
      page += 1;
    }

    deployments.sort((a, b) =>
      Date.parse(b.createdOn || 0) - Date.parse(a.createdOn || 0)
    );

    const counted = deployments.filter((item) => !item.skipped);
    const used = counted.length;
    const success = counted.filter((item) => item.status === "success").length;
    const failure = counted.filter((item) => item.status === "failure").length;
    const canceled = counted.filter((item) => item.status === "canceled").length;
    const active = counted.filter((item) => item.status === "active" || item.status === "idle").length;
    const production = counted.filter((item) => item.environment === "production").length;
    const preview = counted.filter((item) => item.environment === "preview").length;
    const skipped = deployments.length - used;
    const remaining = Math.max(0, PAGES_FREE_MONTHLY_BUILD_LIMIT - used);
    const percent = PAGES_FREE_MONTHLY_BUILD_LIMIT > 0
      ? (used / PAGES_FREE_MONTHLY_BUILD_LIMIT) * 100
      : 0;

    return {
      configured: true,
      connected: true,
      projectName,
      limit: PAGES_FREE_MONTHLY_BUILD_LIMIT,
      range,
      apiRequests,
      used,
      remaining,
      percent,
      success,
      failure,
      canceled,
      active,
      skipped,
      production,
      preview,
      deployments,
      note: "Cloudflare Pages 배포 목록 기준 집계입니다. Git 연동에서는 배포 기록이 월 빌드 사용량을 확인하는 실용적인 기준이며, Cloudflare의 최종 billing counter와 소폭 차이가 있을 수 있습니다.",
    };
  } catch (error) {
    const detail = analyticsErrorMessage(error);
    return {
      configured: true,
      connected: false,
      projectName,
      limit: PAGES_FREE_MONTHLY_BUILD_LIMIT,
      range,
      apiRequests,
      deployments: [],
      note: detail && !/^Authentication error$/i.test(detail)
        ? `Pages 배포 기록을 불러오지 못했습니다. ${detail}`
        : "Pages 배포 기록을 불러오지 못했습니다. CLOUDFLARE_PAGES_TOKEN과 Cloudflare Pages Read 권한을 확인해 주세요.",
    };
  }
}

function utcDateString(date) {
  return date.toISOString().slice(0, 10);
}

function analyticsDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);

  return {
    start: utcDateString(start),
    end: utcDateString(end),
  };
}

async function cloudflareGraphql(token, query, variables) {
  const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `Cloudflare Analytics 응답을 해석하지 못했습니다. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      payload?.errors?.[0]?.message ||
      `Cloudflare Analytics 요청 실패 · HTTP ${response.status}`
    );
  }

  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(
      payload.errors
        .map((item) => item?.message)
        .filter(Boolean)
        .join(" / ") ||
      "Cloudflare Analytics GraphQL 오류"
    );
  }

  return payload?.data || {};
}

function accountRows(data, fieldName) {
  const accounts = data?.viewer?.accounts;
  const account = Array.isArray(accounts) ? accounts[0] : null;
  const rows = account?.[fieldName];
  return Array.isArray(rows) ? rows : [];
}

function addDailyMetric(map, date, values) {
  if (!date) return;

  const current = map.get(date) || {};
  for (const [key, raw] of Object.entries(values || {})) {
    const value = Number(raw || 0);
    current[key] = Number(current[key] || 0) + (
      Number.isFinite(value) ? value : 0
    );
  }
  map.set(date, current);
}

function sumDailyWindow(dailyMap, endDate, days, keys) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startDate = utcDateString(start);

  const result = Object.fromEntries(
    keys.map((key) => [key, 0])
  );

  for (const [date, row] of dailyMap.entries()) {
    if (date < startDate || date > endDate) continue;

    for (const key of keys) {
      result[key] += Number(row?.[key] || 0);
    }
  }

  return result;
}

function buildPeriods(dailyMap, endDate, keys) {
  return {
    today: sumDailyWindow(dailyMap, endDate, 1, keys),
    "7d": sumDailyWindow(dailyMap, endDate, 7, keys),
    "30d": sumDailyWindow(dailyMap, endDate, 30, keys),
  };
}

function analyticsErrorMessage(error) {
  const message = String(
    error?.message ||
    "Cloudflare Analytics 조회 실패"
  );

  // Never return auth headers or secret material.
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .slice(0, 500);
}

async function queryCloudflareAnalytics(env) {
  const token = String(
    env.CLOUDFLARE_ANALYTICS_TOKEN || ""
  ).trim();
  const accountId = String(
    env.CLOUDFLARE_ACCOUNT_ID || ""
  ).trim();

  if (!token || !accountId) {
    return {
      configured: false,
      connected: false,
      partial: false,
      apiRequests: 0,
      range: analyticsDateRange(),
      timezone: "UTC",
      note:
        "CLOUDFLARE_ANALYTICS_TOKEN 또는 CLOUDFLARE_ACCOUNT_ID가 등록되지 않았습니다.",
      products: {},
    };
  }

  const range = analyticsDateRange();
  const variables = {
    accountTag: accountId,
    start: range.start,
    end: range.end,
  };

  const kvQuery = `
    query KvUsage(
      $accountTag: string!
      $start: Date!
      $end: Date!
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          kvOperationsAdaptiveGroups(
            filter: {
              date_geq: $start
              date_leq: $end
            }
            limit: 10000
            orderBy: [date_ASC]
          ) {
            sum {
              requests
            }
            dimensions {
              date
              actionType
            }
          }
        }
      }
    }
  `;

  const d1Query = `
    query D1Usage(
      $accountTag: string!
      $start: Date!
      $end: Date!
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(
            filter: {
              date_geq: $start
              date_leq: $end
            }
            limit: 10000
            orderBy: [date_ASC]
          ) {
            sum {
              readQueries
              writeQueries
              rowsRead
              rowsWritten
            }
            dimensions {
              date
            }
          }
        }
      }
    }
  `;

  const pagesQuery = `
    query PagesFunctionsUsage(
      $accountTag: string!
      $start: Date!
      $end: Date!
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          pagesFunctionsInvocationsAdaptiveGroups(
            filter: {
              date_geq: $start
              date_leq: $end
            }
            limit: 10000
            orderBy: [date_ASC]
          ) {
            sum {
              requests
              errors
              subrequests
            }
            dimensions {
              date
            }
          }
        }
      }
    }
  `;

  const [kvSettled, d1Settled, pagesSettled] =
    await Promise.allSettled([
      cloudflareGraphql(token, kvQuery, variables),
      cloudflareGraphql(token, d1Query, variables),
      cloudflareGraphql(token, pagesQuery, variables),
    ]);

  const products = {};

  if (kvSettled.status === "fulfilled") {
    const rows = accountRows(
      kvSettled.value,
      "kvOperationsAdaptiveGroups"
    );
    const daily = new Map();

    for (const row of rows) {
      const date = String(row?.dimensions?.date || "");
      const action = String(
        row?.dimensions?.actionType || "other"
      ).toLowerCase();
      const requests = Number(row?.sum?.requests || 0);

      const metric =
        action === "read" ? "reads" :
        action === "write" ? "writes" :
        action === "delete" ? "deletes" :
        action === "list" ? "lists" :
        "other";

      addDailyMetric(daily, date, {
        total: requests,
        [metric]: requests,
      });
    }

    products.kv = {
      available: true,
      periods: buildPeriods(
        daily,
        range.end,
        ["total", "reads", "writes", "lists", "deletes", "other"]
      ),
    };
  } else {
    products.kv = {
      available: false,
      error: analyticsErrorMessage(kvSettled.reason),
    };
  }

  if (d1Settled.status === "fulfilled") {
    const rows = accountRows(
      d1Settled.value,
      "d1AnalyticsAdaptiveGroups"
    );
    const daily = new Map();

    for (const row of rows) {
      addDailyMetric(
        daily,
        String(row?.dimensions?.date || ""),
        {
          readQueries: row?.sum?.readQueries,
          writeQueries: row?.sum?.writeQueries,
          rowsRead: row?.sum?.rowsRead,
          rowsWritten: row?.sum?.rowsWritten,
        }
      );
    }

    products.d1 = {
      available: true,
      periods: buildPeriods(
        daily,
        range.end,
        ["readQueries", "writeQueries", "rowsRead", "rowsWritten"]
      ),
    };
  } else {
    products.d1 = {
      available: false,
      error: analyticsErrorMessage(d1Settled.reason),
    };
  }

  if (pagesSettled.status === "fulfilled") {
    const rows = accountRows(
      pagesSettled.value,
      "pagesFunctionsInvocationsAdaptiveGroups"
    );
    const daily = new Map();

    for (const row of rows) {
      addDailyMetric(
        daily,
        String(row?.dimensions?.date || ""),
        {
          requests: row?.sum?.requests,
          errors: row?.sum?.errors,
          subrequests: row?.sum?.subrequests,
        }
      );
    }

    products.pagesFunctions = {
      available: true,
      periods: buildPeriods(
        daily,
        range.end,
        ["requests", "errors", "subrequests"]
      ),
    };
  } else {
    products.pagesFunctions = {
      available: false,
      error: analyticsErrorMessage(pagesSettled.reason),
    };
  }

  const availableCount = Object.values(products).filter(
    (product) => product?.available
  ).length;

  return {
    configured: true,
    connected: availableCount > 0,
    partial: availableCount > 0 && availableCount < 3,
    apiRequests: 3,
    range,
    timezone: "UTC",
    generatedAt: new Date().toISOString(),
    products,
    note:
      "Cloudflare GraphQL Analytics 관측값입니다. Cloudflare 청구용 billing counter와 완전히 동일한 값은 아닐 수 있습니다.",
  };
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);

    const url = new URL(context.request.url);
    const preciseKv = url.searchParams.get("precise") === "1";

    const kv = context.env.ARCHIVE_KV || null;
    const db = context.env.USER_DB || null;
    const bucket = context.env.ARCHIVE_BODY || null;

    let kvResult = {
      bound: false,
      keyCount: 0,
      bodyCacheKeyCount: 0,
      measuredBytes: null,
      categories: [],
      precise: preciseKv,
      preciseReadCost: 0,
    };

    if (kv) {
      const keys = await listAllKvKeys(kv);
      const sizeByName = preciseKv
        ? await measureKvBytes(kv, keys)
        : null;
      const aggregate = aggregateKv(keys, sizeByName);

      kvResult = {
        bound: true,
        keyCount: keys.length,
        bodyCacheKeyCount: keys.filter((key) =>
          key.name.startsWith("body:")
        ).length,
        measuredBytes: aggregate.totalBytes,
        categories: aggregate.categories,
        precise: preciseKv,
        preciseReadCost: preciseKv ? keys.length : 0,
        nextPreciseReadCost: preciseKv ? 0 : keys.length,
      };
    }

    const [d1Result, r2Result, analyticsResult, pagesDeploymentsResult] =
      await Promise.all([
        inspectD1(db),
        inspectR2(bucket),
        queryCloudflareAnalytics(context.env),
        queryCloudflarePagesDeployments(context.env),
      ]);

    return jsonResponse({
      ok: true,
      generatedAt: new Date().toISOString(),
      measurement: preciseKv ? "precise" : "quick",
      kv: kvResult,
      d1: d1Result,
      r2: r2Result,
      analytics: analyticsResult,
      pagesDeployments: pagesDeploymentsResult,
      functions: {
        measurableInsideApp: Boolean(analyticsResult?.connected),
        note: analyticsResult?.connected
          ? "Cloudflare Analytics API가 연결되어 Pages Functions / KV / D1의 최근 사용량을 조회합니다."
          : analyticsResult?.note ||
            "Cloudflare Analytics API 연결 상태를 확인해 주세요.",
      },
      external: {
        googleDrive:
          "Drive 다시 읽기 또는 TXT 본문 KV cache miss일 때만 Google Drive API를 사용합니다.",
        googleSheets:
          "POSTYPE 등록·수정·동기화를 실행할 때 Google Sheets API를 사용합니다.",
      },
      operationProfile: [
        {
          action: "사용자 콘텐츠 목록 열기",
          kv: "평상시 KV get 약 6회",
          d1: "비로그인 0회",
          external: "Drive 0회 (archive cache가 있을 때)",
        },
        {
          action: "TXT 열기 · 본문 KV hit",
          kv: "KV get 1회",
          d1: "로그인 시 조회/진도 기록 별도",
          external: "Drive 0회",
        },
        {
          action: "TXT 열기 · 본문 KV miss",
          kv: "KV get 1회 + KV put 1회",
          d1: "로그인 시 조회/진도 기록 별도",
          external: "Drive 파일 검증 + 본문 fetch",
        },
        {
          action: "이어보기/북마크/읽음 저장",
          kv: "0회",
          d1: "세션 확인 + user_items 갱신",
          external: "없음",
        },
        {
          action: "관리자 Drive 다시 읽기",
          kv: "새 archive 목록 KV put",
          d1: "0회",
          external: "Google Drive 폴더/파일 목록 scan",
        },
        {
          action: "관리자 POSTYPE 동기화",
          kv: "POSTYPE index/보조값 갱신",
          d1: "0회",
          external: "Google Sheets + 필요한 POSTYPE metadata 요청",
        },
      ],
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      {
        error:
          error?.message ||
          "리소스 현황을 불러오지 못했습니다.",
      },
      error?.status || 500
    );
  }
}
