/* V7 ADMIN CLIENT CONTRACT
 * - This file contains behavior only. No CSS and no secrets.
 * - Admin security is enforced by server-side session checks and protected APIs.
 * - New UI code must reuse existing API helpers and DOM sections.
 * - Do not move this code back into functions/admin.js.
 */

const els = {
  adminContent: document.getElementById("adminContent"),
  adminLogoutButton: document.getElementById("adminLogoutButton"),
  adminVersion: document.getElementById("adminVersion"),
  driveTopTotal: document.getElementById("driveTopTotal"),
  driveTopSync: document.getElementById("driveTopSync"),
  driveTopShort: document.getElementById("driveTopShort"),
  driveTopSeries: document.getElementById("driveTopSeries"),
  driveTopOngoing: document.getElementById("driveTopOngoing"),
  driveTopReview: document.getElementById("driveTopReview"),
  driveTopEdited: document.getElementById("driveTopEdited"),
  postypeTopTotal: document.getElementById("postypeTopTotal"),
  postypeTopSync: document.getElementById("postypeTopSync"),
  postypeTopShort: document.getElementById("postypeTopShort"),
  postypeTopSeries: document.getElementById("postypeTopSeries"),
  postypeTopOngoing: document.getElementById("postypeTopOngoing"),
  postypeTopComplete: document.getElementById("postypeTopComplete"),
  postypeTopMissingDate: document.getElementById("postypeTopMissingDate"),
  opsAutomationRunButton: document.getElementById("opsAutomationRunButton"),
  opsAutomationOverall: document.getElementById("opsAutomationOverall"),
  opsAutomationState: document.getElementById("opsAutomationState"),
  opsAutomationCheckedAt: document.getElementById("opsAutomationCheckedAt"),
  opsAutomationSyncState: document.getElementById("opsAutomationSyncState"),
  opsAutomationSyncMeta: document.getElementById("opsAutomationSyncMeta"),
  opsAutomationPerfState: document.getElementById("opsAutomationPerfState"),
  opsAutomationPerfMeta: document.getElementById("opsAutomationPerfMeta"),
  opsAutomationRestoreState: document.getElementById("opsAutomationRestoreState"),
  opsAutomationRestoreMeta: document.getElementById("opsAutomationRestoreMeta"),
  opsAutomationWarnings: document.getElementById("opsAutomationWarnings"),
  opsAutomationMessage: document.getElementById("opsAutomationMessage"),
  syncButton: document.getElementById("syncButton"),
  syncMessage: document.getElementById("syncMessage"),
  postypeBulkGenreInput: document.getElementById("postypeBulkGenreInput"),
  postypeBulkRows: document.getElementById("postypeBulkRows"),
  postypeBulkAddRowsButton: document.getElementById("postypeBulkAddRowsButton"),
  postypeBulkFetchAllButton: document.getElementById("postypeBulkFetchAllButton"),
  postypeBulkRegisterButton: document.getElementById("postypeBulkRegisterButton"),
  postypeBulkClearButton: document.getElementById("postypeBulkClearButton"),
  postypeBulkMessage: document.getElementById("postypeBulkMessage"),
  postypeAssignIdsButton: document.getElementById("postypeAssignIdsButton"),
  postypeSyncButton: document.getElementById("postypeSyncButton"),
  postypeIdMessage: document.getElementById("postypeIdMessage"),
  postypeListRefreshButton: document.getElementById("postypeListRefreshButton"),
  postypeFetchMissingDatesButton: document.getElementById("postypeFetchMissingDatesButton"),
  postypePublishedSyncButton: document.getElementById("postypePublishedSyncButton"),
  postypeListCount: document.getElementById("postypeListCount"),
  postypeMissingDateCount: document.getElementById("postypeMissingDateCount"),
  postypeDirtyCount: document.getElementById("postypeDirtyCount"),
  postypeDuplicateCount: document.getElementById("postypeDuplicateCount"),
  postypeDuplicateFilters: document.getElementById("postypeDuplicateFilters"),
  postypeListBody: document.getElementById("postypeListBody"),
  postypeListPagination: document.getElementById("postypeListPagination"),
  postypeListEmpty: document.getElementById("postypeListEmpty"),
  postypeListMessage: document.getElementById("postypeListMessage"),
  driveListRefreshButton: document.getElementById("driveListRefreshButton"),
  driveRescanButton: document.getElementById("driveRescanButton"),
  driveTypeSaveButton: document.getElementById("driveTypeSaveButton"),
  driveListCount: document.getElementById("driveListCount"),
  driveOverrideCount: document.getElementById("driveOverrideCount"),
  driveMismatchCount: document.getElementById("driveMismatchCount"),
  driveDirtyCount: document.getElementById("driveDirtyCount"),
  driveDuplicateCount: document.getElementById("driveDuplicateCount"),
  driveListBody: document.getElementById("driveListBody"),
  driveListPagination: document.getElementById("driveListPagination"),
  driveListEmpty: document.getElementById("driveListEmpty"),
  driveListMessage: document.getElementById("driveListMessage"),
  driveLastSyncStatus: document.getElementById("driveLastSyncStatus"),
  postypeAutoSyncState: document.getElementById("postypeAutoSyncState"),
  postypeAutoSyncRunButton: document.getElementById("postypeAutoSyncRunButton"),
  postypeAutoSyncSetupButton: document.getElementById("postypeAutoSyncSetupButton"),
  postypeAutoSyncLast: document.getElementById("postypeAutoSyncLast"),
  postypeAutoSyncResult: document.getElementById("postypeAutoSyncResult"),
  postypeAutoSyncFailures: document.getElementById("postypeAutoSyncFailures"),
  postypeAutoSyncFailureCount: document.getElementById("postypeAutoSyncFailureCount"),
  postypeAutoSyncFailureList: document.getElementById("postypeAutoSyncFailureList"),
  driveAutoSyncState: document.getElementById("driveAutoSyncState"),
  driveAutoSyncRunButton: document.getElementById("driveAutoSyncRunButton"),
  driveAutoSyncSetupButton: document.getElementById("driveAutoSyncSetupButton"),
  driveAutoSyncLast: document.getElementById("driveAutoSyncLast"),
  driveAutoSyncResult: document.getElementById("driveAutoSyncResult"),
  textHealthScanButton: document.getElementById("textHealthScanButton"),
  textHealthChecked: document.getElementById("textHealthChecked"),
  textHealthNormal: document.getElementById("textHealthNormal"),
  textHealthSuspect: document.getElementById("textHealthSuspect"),
  textHealthSevere: document.getElementById("textHealthSevere"),
  textHealthProgress: document.getElementById("textHealthProgress"),
  textHealthList: document.getElementById("textHealthList"),
  textHealthEmpty: document.getElementById("textHealthEmpty"),
  driveSummaryFilters: document.getElementById("driveSummaryFilters"),
  settingsForm: document.getElementById("settingsForm"),
  faviconUrlInput: document.getElementById("faviconUrlInput"),
  eyebrowInput: document.getElementById("eyebrowInput"),
  titleInput: document.getElementById("titleInput"),
  settingsMessage: document.getElementById("settingsMessage"),
  searchAliasForm: document.getElementById("searchAliasForm"),
  searchAliasType: document.getElementById("searchAliasType"),
  searchAliasTitle: document.getElementById("searchAliasTitle"),
  searchAliasAuthor: document.getElementById("searchAliasAuthor"),
  searchAliasTargetSearch: document.getElementById("searchAliasTargetSearch"),
  searchAliasTargetLabel: document.getElementById("searchAliasTargetLabel"),
  searchAliasTargetHint: document.getElementById("searchAliasTargetHint"),
  searchAliasSuggestions: document.getElementById("searchAliasSuggestions"),
  searchAliasValues: document.getElementById("searchAliasValues"),
  searchAliasMessage: document.getElementById("searchAliasMessage"),
  searchAliasCount: document.getElementById("searchAliasCount"),
  searchAliasList: document.getElementById("searchAliasList"),
  searchAliasTypeButtons: Array.from(document.querySelectorAll("[data-alias-type]")),
  reviewList: document.getElementById("reviewList"),
  reviewEmpty: document.getElementById("reviewEmpty"),
  reviewCount: document.getElementById("reviewCount"),
  statusNormalCount: document.getElementById("statusNormalCount"),
  statusEditedCount: document.getElementById("statusEditedCount"),
  statusReviewCount: document.getElementById("statusReviewCount"),
  driveDiagnostics: document.getElementById("driveDiagnostics"),
  diagnosticsEmpty: document.getElementById("diagnosticsEmpty"),
  zipInput: document.getElementById("zipInput"),
  zipDropZone: document.getElementById("zipDropZone"),
  commitMessageInput: document.getElementById("commitMessageInput"),
  deployPreview: document.getElementById("deployPreview"),
  deployFileSummary: document.getElementById("deployFileSummary"),
  allowedFileList: document.getElementById("allowedFileList"),
  blockedFileList: document.getElementById("blockedFileList"),
  deployButton: document.getElementById("deployButton"),
  deployMessage: document.getElementById("deployMessage"),
  deployStatusCard: document.getElementById("deployStatusCard"),
  deployStatusRefreshButton: document.getElementById("deployStatusRefreshButton"),
  deployCommitStatusItem: document.getElementById("deployCommitStatusItem"),
  deployCommitStatusText: document.getElementById("deployCommitStatusText"),
  deployCommitStatusMeta: document.getElementById("deployCommitStatusMeta"),
  deployCloudflareStatusItem: document.getElementById("deployCloudflareStatusItem"),
  deployCloudflareStatusText: document.getElementById("deployCloudflareStatusText"),
  deployCloudflareStatusMeta: document.getElementById("deployCloudflareStatusMeta"),
  dashboardTotalUsers: document.getElementById("dashboardTotalUsers"),
  dashboardTodaySignups: document.getElementById("dashboardTodaySignups"),
  visitDataSince: document.getElementById("visitDataSince"),
  visitRefreshButton: document.getElementById("visitRefreshButton"),
  visitTodaySessions: document.getElementById("visitTodaySessions"),
  visitTodayVisitorsText: document.getElementById("visitTodayVisitorsText"),
  visitPeriodVisitors: document.getElementById("visitPeriodVisitors"),
  visitNewVisitorsText: document.getElementById("visitNewVisitorsText"),
  visitPeriodSessions: document.getElementById("visitPeriodSessions"),
  visitSessionPerVisitorText: document.getElementById("visitSessionPerVisitorText"),
  visitGuestShare: document.getElementById("visitGuestShare"),
  visitGuestSplitText: document.getElementById("visitGuestSplitText"),
  visitReturnRateNew: document.getElementById("visitReturnRateNew"),
  visitReturningText: document.getElementById("visitReturningText"),
  visitWorkOpensAvg: document.getElementById("visitWorkOpensAvg"),
  visitEngagedText: document.getElementById("visitEngagedText"),
  visitActiveTimeAvg: document.getElementById("visitActiveTimeAvg"),
  visitTodayWorkOpens: document.getElementById("visitTodayWorkOpens"),
  visitSignupShown: document.getElementById("visitSignupShown"),
  visitSignupClose: document.getElementById("visitSignupClose"),
  visitSignupCloseRate: document.getElementById("visitSignupCloseRate"),
  visitSignupLoginClicks: document.getElementById("visitSignupLoginClicks"),
  visitSignupLoginCompleted: document.getElementById("visitSignupLoginCompleted"),
  visitSignupClicks: document.getElementById("visitSignupClicks"),
  visitSignupClickRate: document.getElementById("visitSignupClickRate"),
  visitSignupCompleted: document.getElementById("visitSignupCompleted"),
  visitSignupCompletionRate: document.getElementById("visitSignupCompletionRate"),
  visitTrendChart: document.getElementById("visitTrendChart"),
  visitDailyListNew: document.getElementById("visitDailyListNew"),
  visitActivityLevels: document.getElementById("visitActivityLevels"),
  visitEngagedRate: document.getElementById("visitEngagedRate"),
  visitSearchAvg: document.getElementById("visitSearchAvg"),
  visitTotalWorkOpens: document.getElementById("visitTotalWorkOpens"),
  visitPageLoad: document.getElementById("visitPageLoad"),
  visitArchiveLoad: document.getElementById("visitArchiveLoad"),
  visitReaderLoad: document.getElementById("visitReaderLoad"),
  visitReaderLoadCount: document.getElementById("visitReaderLoadCount"),
  visitPerfScope: document.getElementById("visitPerfScope"),
  visitPerfScopeMeta: document.getElementById("visitPerfScopeMeta"),
  visitReaderPercentiles: document.getElementById("visitReaderPercentiles"),
  visitReaderPhaseGrid: document.getElementById("visitReaderPhaseGrid"),
  visitReaderRenderDetailMeta: document.getElementById("visitReaderRenderDetailMeta"),
  visitReaderRenderDetailGrid: document.getElementById("visitReaderRenderDetailGrid"),
  visitReaderMissServerMeta: document.getElementById("visitReaderMissServerMeta"),
  visitReaderMissServerGrid: document.getElementById("visitReaderMissServerGrid"),
  visitReaderCacheBreakdown: document.getElementById("visitReaderCacheBreakdown"),
  visitReaderSizeBreakdown: document.getElementById("visitReaderSizeBreakdown"),
  visitReaderModeBreakdown: document.getElementById("visitReaderModeBreakdown"),
  visitHourlyChart: document.getElementById("visitHourlyChart"),
  visitDeviceMix: document.getElementById("visitDeviceMix"),
  visitBrowserMix: document.getElementById("visitBrowserMix"),
  visitSourceMix: document.getElementById("visitSourceMix"),
  visitReferrerList: document.getElementById("visitReferrerList"),
  visitRecentBody: document.getElementById("visitRecentBody"),
  visitRecentEmpty: document.getElementById("visitRecentEmpty"),
  userCountBadge: document.getElementById("userCountBadge"),
  userSearchInput: document.getElementById("userSearchInput"),
  userRefreshButton: document.getElementById("userRefreshButton"),
  userTableBody: document.getElementById("userTableBody"),
  userEmpty: document.getElementById("userEmpty"),
  userMessage: document.getElementById("userMessage"),
  feedbackTabBadge: document.getElementById("feedbackTabBadge"),
  feedbackRefreshButton: document.getElementById("feedbackRefreshButton"),
  feedbackCountAll: document.getElementById("feedbackCountAll"),
  feedbackCountNew: document.getElementById("feedbackCountNew"),
  feedbackCountChecked: document.getElementById("feedbackCountChecked"),
  feedbackCountDone: document.getElementById("feedbackCountDone"),
  feedbackAdminList: document.getElementById("feedbackAdminList"),
  feedbackAdminEmpty: document.getElementById("feedbackAdminEmpty"),
  feedbackAdminMessage: document.getElementById("feedbackAdminMessage"),
  resourceRefreshButton: document.getElementById("resourceRefreshButton"),
  resourcePreciseButton: document.getElementById("resourcePreciseButton"),
  resourceKvState: document.getElementById("resourceKvState"),
  resourceKvMeta: document.getElementById("resourceKvMeta"),
  resourceD1State: document.getElementById("resourceD1State"),
  resourceD1Meta: document.getElementById("resourceD1Meta"),
  resourceR2State: document.getElementById("resourceR2State"),
  resourceR2Meta: document.getElementById("resourceR2Meta"),
  resourceFunctionsState: document.getElementById("resourceFunctionsState"),
  resourceFunctionsMeta: document.getElementById("resourceFunctionsMeta"),
  resourceOverallCard: document.getElementById("resourceOverallCard"),
  resourceOverallState: document.getElementById("resourceOverallState"),
  resourceOverallMeta: document.getElementById("resourceOverallMeta"),
  resourceAnalyticsRange: document.getElementById("resourceAnalyticsRange"),
  resourcePeriodTabs: document.getElementById("resourcePeriodTabs"),
  resourceQuotaList: document.getElementById("resourceQuotaList"),
  resourceAnalyticsApiCalls: document.getElementById("resourceAnalyticsApiCalls"),
  resourceAnalyticsNotice: document.getElementById("resourceAnalyticsNotice"),
  resourceMeasurementNotice: document.getElementById("resourceMeasurementNotice"),
  resourceKvTotal: document.getElementById("resourceKvTotal"),
  resourceKvBreakdown: document.getElementById("resourceKvBreakdown"),
  resourceD1Total: document.getElementById("resourceD1Total"),
  resourceD1Breakdown: document.getElementById("resourceD1Breakdown"),
  resourceD1Users: document.getElementById("resourceD1Users"),
  resourceD1UserItems: document.getElementById("resourceD1UserItems"),
  resourceD1Quotes: document.getElementById("resourceD1Quotes"),
  resourceD1SharedQuotes: document.getElementById("resourceD1SharedQuotes"),
  resourceD1DatabaseSize: document.getElementById("resourceD1DatabaseSize"),
  resourceD1TodayWritten: document.getElementById("resourceD1TodayWritten"),
  resourceOperationBody: document.getElementById("resourceOperationBody"),
  resourceFunctionsNote: document.getElementById("resourceFunctionsNote"),
  resourcePagesBuildCard: document.getElementById("resourcePagesBuildCard"),
  resourcePagesBuildState: document.getElementById("resourcePagesBuildState"),
  resourcePagesBuildMeta: document.getElementById("resourcePagesBuildMeta"),
  resourcePagesBuildRange: document.getElementById("resourcePagesBuildRange"),
  resourcePagesBuildUsed: document.getElementById("resourcePagesBuildUsed"),
  resourcePagesBuildPercent: document.getElementById("resourcePagesBuildPercent"),
  resourcePagesBuildRemaining: document.getElementById("resourcePagesBuildRemaining"),
  resourcePagesBuildResult: document.getElementById("resourcePagesBuildResult"),
  resourcePagesDeploymentList: document.getElementById("resourcePagesDeploymentList"),
  resourcePagesMoreButton: document.getElementById("resourcePagesMoreButton"),
  resourcePagesBuildNotice: document.getElementById("resourcePagesBuildNotice"),
  resourceMessage: document.getElementById("resourceMessage"),
  quotePresetRefreshButton: document.getElementById("quotePresetRefreshButton"),
  quotePresetTotal: document.getElementById("quotePresetTotal"),
  quotePresetVisible: document.getElementById("quotePresetVisible"),
  quotePresetHidden: document.getElementById("quotePresetHidden"),
  quotePresetList: document.getElementById("quotePresetList"),
  quotePresetMessage: document.getElementById("quotePresetMessage"),
  historyRefreshButton: document.getElementById("historyRefreshButton"),
  historyFirstDate: document.getElementById("historyFirstDate"),
  historyCommitCount: document.getElementById("historyCommitCount"),
  historyActiveDays: document.getElementById("historyActiveDays"),
  historyLastDate: document.getElementById("historyLastDate"),
  historyActivityCaption: document.getElementById("historyActivityCaption"),
  historyActivityGraph: document.getElementById("historyActivityGraph"),
  historyActivityModes: document.getElementById("historyActivityModes"),
  historyTimeline: document.getElementById("historyTimeline"),
  historyMessage: document.getElementById("historyMessage"),
  historyDetailModal: document.getElementById("historyDetailModal"),
  historyModalTitle: document.getElementById("historyModalTitle"),
  historyModalMeta: document.getElementById("historyModalMeta"),
  historyModalVersionButton: document.getElementById("historyModalVersionButton"),
  historyModalVersions: document.getElementById("historyModalVersions"),
  historyModalEntries: document.getElementById("historyModalEntries"),
  historyModalCloseButton: document.getElementById("historyModalCloseButton"),
  tabs: Array.from(document.querySelectorAll("[data-tab-target]")),
  panels: Array.from(document.querySelectorAll("[data-tab-panel]")),
};

let deployFiles = [];
let deployBlocked = [];
let deployStatusTimer = null;
let activeDeployCommitSha = localStorage.getItem("archiveAdminLastDeploySha") || "";
let activeDeployCommitUrl = localStorage.getItem("archiveAdminLastDeployUrl") || "";
let pendingDeployVersion = "";
let pendingDeployKind = "web";
let mobileReleaseState = {
  current: null,
  source: null,
  apkFile: null,
  ui: null,
};
let userAdminData = {
  summary: {},
  daily: [],
  users: [],
};
let visitPerformanceScope = "current";
let visitPeriodDays = "14";
let analyticsAdminData = {
  summary: {},
  today: {},
  performance: {},
  daily: [],
  hourly: [],
  devices: [],
  browsers: [],
  sources: [],
  referrers: [],
  recent: [],
};

let postypeCpOptionsHtml = "";
let postypeAdminItems = [];
let postypeAdminLoaded = false;
const POSTYPE_ADMIN_PAGE_SIZE = 30;
let postypeAdminPage = 1;
let postypeAdminFilter = "all";
let driveAdminItems = [];
let driveAdminLoaded = false;
let textHealthLoaded = false;
const DRIVE_ADMIN_PAGE_SIZE = 30;
let driveAdminPage = 1;
let driveAdminFilter = "all";
let feedbackAdminLoaded = false;
let feedbackAdminFilter = "all";
let sharedQuoteAdminLoaded = false;
let sharedQuoteAdminData = { count: 0, items: [] };
let deployInProgress = false;
let resourceUsageLoaded = false;
let resourceUsageData = null;
let resourceAnalyticsPeriod = "today";
let resourcePagesVisibleLimit = 10;
let quotePresetAdminLoaded = false;
let quotePresetAdminData = [];
let historyLoaded = false;
let historyDays = [];
let historyActivityMode = "hour";
let autoSyncStatusLoaded = false;
let autoSyncSetupState = null;
let opsAutomationLoaded = false;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const rawText = await response.text();
  let data = null;

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (response.status === 401) {
    window.location.replace("/admin");
    throw new Error("관리자 로그인이 만료되었습니다.");
  }

  if (!response.ok) {
    const rawMessage = rawText.trim().replace(/\s+/g, " ").slice(0, 240);
    const stage = data?.stage ? ` · 단계: ${String(data.stage)}` : "";
    const message = data?.error
      ? `${data.error}${stage}`
      : rawMessage
        ? `서버 오류 (HTTP ${response.status}): ${rawMessage}`
        : `요청에 실패했습니다. (HTTP ${response.status})`;
    throw new Error(message);
  }

  if (data === null) {
    throw new Error(`서버 응답 형식을 확인할 수 없습니다. (HTTP ${response.status})`);
  }

  return data;
}

function formatDate(value) {
  if (!value) return "아직 없음";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatSummaryDate(value) {
  if (!value) return "없음";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yy}.${mm}.${dd} ${hh}:${min}`;
  } catch {
    return String(value);
  }
}

function formatOpsMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number >= 1000 ? `${(number / 1000).toFixed(number >= 10000 ? 1 : 2)}초` : `${Math.round(number)}ms`;
}

function renderOpsAutomation(data = {}) {
  const status = data.status || null;
  const syncHealth = data.syncHealth || status?.syncHealth || {};
  const perf = status?.performance || {};
  const warnings = Array.isArray(status?.warnings) ? status.warnings : [];
  const restorePoints = Array.isArray(data.restorePoints) ? data.restorePoints : [];
  const syncAttention = Array.isArray(syncHealth?.attention) ? syncHealth.attention : (syncHealth?.delayed || []);
  const normal = status?.state === "normal" && !syncAttention.length;

  if (els.opsAutomationOverall) {
    els.opsAutomationOverall.classList.toggle("is-warning", !normal && Boolean(status));
    els.opsAutomationOverall.classList.toggle("is-normal", normal);
  }
  if (els.opsAutomationState) els.opsAutomationState.textContent = status ? (normal ? "정상" : "확인 필요") : "점검 전";
  if (els.opsAutomationCheckedAt) els.opsAutomationCheckedAt.textContent = status?.checkedAt ? `마지막 점검 ${formatSummaryDate(status.checkedAt)}` : "매일 00:30 자동 점검";

  const delayed = Array.isArray(syncHealth?.delayed) ? syncHealth.delayed : [];
  const attention = Array.isArray(syncHealth?.attention) ? syncHealth.attention : delayed;
  if (els.opsAutomationSyncState) {
    els.opsAutomationSyncState.textContent = attention.length
      ? `확인 ${attention.length}건${delayed.length ? ` · 지연 ${delayed.length}` : ""}`
      : "정상";
  }
  if (els.opsAutomationSyncMeta) {
    const rows = Array.isArray(syncHealth?.rows) ? syncHealth.rows : [];
    els.opsAutomationSyncMeta.textContent = rows.length
      ? rows.map((row) => {
          if (!row.onTime) return `${row.label} 지연`;
          if (row.error) return `${row.label} 오류`;
          if (row.warning || row.scheduledState === "warning" || row.scheduledState === "partial") return `${row.label} 확인`;
          return `${row.label} ✓`;
        }).join(" · ")
      : "POSTYPE · Drive";
  }

  const perfWarnings = Array.isArray(status?.performanceWarnings) ? status.performanceWarnings : [];
  if (els.opsAutomationPerfState) els.opsAutomationPerfState.textContent = status ? (perfWarnings.length ? `주의 ${perfWarnings.length}건` : "정상") : "점검 전";
  if (els.opsAutomationPerfMeta) {
    const reader = perf?.readerCount ? `뷰어 ${formatOpsMs(perf.readerAverageMs)} · ${Number(perf.readerCount).toLocaleString("ko-KR")}회` : "최근 24시간 데이터 대기";
    els.opsAutomationPerfMeta.textContent = reader;
  }

  const latest = restorePoints[0] || status?.latestRestorePoint || null;
  if (els.opsAutomationRestoreState) els.opsAutomationRestoreState.textContent = latest ? `${latest.source === "postype" ? "POSTYPE" : "Drive"} 생성됨` : "변경 대기";
  if (els.opsAutomationRestoreMeta) els.opsAutomationRestoreMeta.textContent = latest?.createdAt ? `${formatSummaryDate(latest.createdAt)} · 최근 ${restorePoints.length || status?.restorePointCount || 0}개` : "실제 변경이 있는 날만 1회 생성";

  if (els.opsAutomationWarnings) {
    if (!warnings.length) {
      els.opsAutomationWarnings.hidden = true;
      els.opsAutomationWarnings.innerHTML = "";
    } else {
      els.opsAutomationWarnings.hidden = false;
      els.opsAutomationWarnings.innerHTML = warnings.map((item) => `<span>${escapeHtml(item.text || "확인 필요")}</span>`).join("");
    }
  }
}

async function loadOpsAutomation(force = false) {
  if (opsAutomationLoaded && !force) return;
  const data = await api("/api/admin/ops-automation", { method: "GET" });
  renderOpsAutomation(data);
  opsAutomationLoaded = true;
}

function renderQuotePresetAdmin() {
  const presets = Array.isArray(quotePresetAdminData) ? quotePresetAdminData : [];
  const visibleCount = presets.filter((preset) => preset.visible).length;
  if (els.quotePresetTotal) els.quotePresetTotal.textContent = String(presets.length);
  if (els.quotePresetVisible) els.quotePresetVisible.textContent = String(visibleCount);
  if (els.quotePresetHidden) els.quotePresetHidden.textContent = String(Math.max(0, presets.length - visibleCount));
  if (!els.quotePresetList) return;
  if (!presets.length) {
    els.quotePresetList.innerHTML = '<div class="empty">등록된 문장 이미지 프리셋이 없습니다.</div>';
    return;
  }
  els.quotePresetList.innerHTML = presets.map((preset) => `
    <article class="quote-preset-item${preset.visible ? " is-visible" : " is-hidden"}" data-quote-preset="${escapeHtml(preset.key)}">
      <div class="quote-preset-main">
        <div><strong>${escapeHtml(preset.name)}</strong><code>${escapeHtml(preset.key)}</code></div>
        <span class="quote-preset-state ${preset.visible ? "is-y" : "is-n"}">${preset.visible ? "노출 Y" : "노출 N"}</span>
      </div>
      <div class="quote-preset-actions">
        <button type="button" class="secondary-admin-button" data-quote-preset-test="${escapeHtml(preset.key)}">실제 편집기 테스트</button>
        <button type="button" class="quote-preset-toggle ${preset.visible ? "is-on" : ""}" role="switch" aria-checked="${preset.visible ? "true" : "false"}" data-quote-preset-toggle="${escapeHtml(preset.key)}">
          <span>${preset.visible ? "Y" : "N"}</span><i aria-hidden="true"></i>
        </button>
      </div>
    </article>`).join("");
}

async function loadQuotePresetAdmin(force = false) {
  if (quotePresetAdminLoaded && !force) return;
  if (els.quotePresetMessage) { els.quotePresetMessage.hidden = true; els.quotePresetMessage.textContent = ""; }
  const data = await api("/api/admin/quote-image-presets", { method: "GET" });
  quotePresetAdminData = Array.isArray(data?.presets) ? data.presets : [];
  quotePresetAdminLoaded = true;
  renderQuotePresetAdmin();
}

async function setQuotePresetVisibility(key, visible, button) {
  if (button) button.disabled = true;
  try {
    const data = await api("/api/admin/quote-image-presets", { method: "POST", body: JSON.stringify({ key, visible }) });
    quotePresetAdminData = Array.isArray(data?.presets) ? data.presets : quotePresetAdminData;
    quotePresetAdminLoaded = true;
    renderQuotePresetAdmin();
    if (els.quotePresetMessage) {
      els.quotePresetMessage.hidden = false;
      els.quotePresetMessage.textContent = visible ? "사용자 노출을 Y로 변경했습니다." : "사용자 노출을 N으로 변경했습니다.";
    }
  } catch (error) {
    if (els.quotePresetMessage) { els.quotePresetMessage.hidden = false; els.quotePresetMessage.textContent = error.message || "노출 설정을 저장하지 못했습니다."; }
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

function setActiveTab(name) {
  els.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tabTarget === name);
  });

  els.panels.forEach((panel) => {
    const active = panel.dataset.tabPanel === name;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });

  sessionStorage.setItem("archiveAdminTab", name);

  if (name === "overview") {
    loadOpsAutomation().catch((error) => {
      console.error(error);
      if (els.opsAutomationMessage) {
        els.opsAutomationMessage.hidden = false;
        els.opsAutomationMessage.textContent = error.message || "운영 자동화 상태를 불러오지 못했습니다.";
      }
    });
  }


  if (name === "quote-images") {
    loadQuotePresetAdmin().catch((error) => {
      console.error(error);
      if (els.quotePresetMessage) { els.quotePresetMessage.hidden = false; els.quotePresetMessage.textContent = error.message || "문장 이미지 프리셋을 불러오지 못했습니다."; }
    });
  }

  if (name === "deploy" && activeDeployCommitSha) {
    refreshDeployStatus({ keepPolling: false });
  }

  if (name === "drive-library" || name === "postype") {
    loadAutoSyncStatus().catch((error) => {
      console.error(error);
      if (els.postypeAutoSyncState) els.postypeAutoSyncState.textContent = "상태 확인 실패";
      if (els.driveAutoSyncState) els.driveAutoSyncState.textContent = "상태 확인 실패";
    });
  }

  if (name === "search-aliases") {
    Promise.all([
      driveAdminLoaded ? Promise.resolve() : loadDriveAdminList(),
      postypeAdminLoaded ? Promise.resolve() : loadPostypeAdminList(false),
    ]).then(() => refreshSearchAliasPicker()).catch((error) => {
      console.error(error);
      if (els.searchAliasMessage) {
        els.searchAliasMessage.hidden = false;
        els.searchAliasMessage.textContent = error.message || "작가·작품 목록을 불러오지 못했습니다.";
      }
    });
  }

  if (name === "drive-library" && !driveAdminLoaded) {
    loadDriveAdminList().catch((error) => {
      console.error(error);
      if (els.driveListMessage) {
        els.driveListMessage.hidden = false;
        els.driveListMessage.textContent = error.message || "Drive 목록을 불러오지 못했습니다.";
      }
    });
  }

  if (name === "drive-library" && !textHealthLoaded) {
    loadTextHealth().catch((error) => {
      console.error(error);
      if (els.textHealthProgress) els.textHealthProgress.textContent = error.message || "텍스트 건강검사 결과를 불러오지 못했습니다.";
    });
  }

  if (name === "postype" && !postypeAdminLoaded) {
    loadPostypeAdminList().catch((error) => {
      console.error(error);
      if (els.postypeListMessage) {
        els.postypeListMessage.hidden = false;
        els.postypeListMessage.textContent = error.message || "POSTYPE 목록을 불러오지 못했습니다.";
      }
    });
  }

  if (name === "history" && !historyLoaded) {
    loadHistory().catch((error) => {
      console.error(error);
      if (els.historyMessage) {
        els.historyMessage.hidden = false;
        els.historyMessage.textContent = error.message || "개발 히스토리를 불러오지 못했습니다.";
      }
    });
  }

  if (name === "feedback") {
    ensureSharedQuoteModerationPanel();
    if (!feedbackAdminLoaded) {
      loadFeedbackAdmin().catch((error) => {
        console.error(error);
        if (els.feedbackAdminMessage) {
          els.feedbackAdminMessage.hidden = false;
          els.feedbackAdminMessage.textContent = error.message || "의견함을 불러오지 못했습니다.";
        }
      });
    }
    if (!sharedQuoteAdminLoaded) {
      loadSharedQuoteAdmin().catch((error) => {
        console.error(error);
        const message = document.getElementById("sharedQuoteAdminMessage");
        if (message) message.textContent = error.message || "공개 문장 목록을 불러오지 못했습니다.";
      });
    }
  }

  if (name === "resources" && !resourceUsageLoaded) {
    loadResourceUsage(false).catch((error) => {
      console.error(error);
      if (els.resourceMessage) {
        els.resourceMessage.hidden = false;
        els.resourceMessage.textContent =
          error.message || "리소스 현황을 불러오지 못했습니다.";
      }
    });
  }
}

function feedbackStatusLabel(status) {
  if (status === "checked") return "확인";
  if (status === "done") return "처리완료";
  return "미확인";
}

function renderFeedbackBadge(value) {
  if (!els.feedbackTabBadge) return;
  const newCount = Math.max(0, Number(value || 0));
  els.feedbackTabBadge.textContent = String(newCount);
  els.feedbackTabBadge.hidden = newCount <= 0;
}

function feedbackAccountSummary(userId) {
  const normalized = String(userId || "").trim().toLowerCase();
  if (!normalized) return "계정 요약 없음";
  const user = (userAdminData.users || []).find((entry) => String(entry.userId || "").toLowerCase() === normalized);
  if (!user) return "현재 불러온 유저 목록에서 계정 요약을 찾지 못했습니다. 유저 관리에서 직접 확인하세요.";
  return [
    `가입 ${formatShortDate(user.createdAt)}`,
    `최근 활동 ${user.lastActivityAt ? formatDate(user.lastActivityAt) : "-"}`,
    `북마크 ${Number(user.bookmarkCount || 0).toLocaleString("ko-KR")}`,
    `최근조회 ${Number(user.recentCount || 0).toLocaleString("ko-KR")}`,
    `읽음 ${Number(user.readCount || 0).toLocaleString("ko-KR")}`,
  ].join(" · ");
}

function renderFeedbackAdmin(data = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  const counts = data.counts || {};
  els.feedbackCountAll.textContent = Number(counts.total || 0).toLocaleString("ko-KR");
  els.feedbackCountNew.textContent = Number(counts.new || 0).toLocaleString("ko-KR");
  els.feedbackCountChecked.textContent = Number(counts.checked || 0).toLocaleString("ko-KR");
  els.feedbackCountDone.textContent = Number(counts.done || 0).toLocaleString("ko-KR");
  renderFeedbackBadge(counts.new);
  document.querySelectorAll("[data-feedback-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.feedbackFilter === feedbackAdminFilter);
  });
  els.feedbackAdminEmpty.hidden = items.length > 0;
  els.feedbackAdminList.innerHTML = items.map((item) => {
    const id = Number(item.feedback_id || 0);
    const status = String(item.status || "new");
    return `
      <article class="feedback-admin-card" data-feedback-id="${id}" data-feedback-category="${escapeHtml(item.category || "기타")}">
        <div class="feedback-admin-card-head">
          <div class="feedback-admin-card-meta">
            <span class="feedback-admin-card-category">${escapeHtml(item.category || "기타")}</span>
            <span>${escapeHtml(formatDate(item.created_at))}</span>
            <span>${escapeHtml(feedbackStatusLabel(status))}</span>
          </div>
          <div class="feedback-admin-actions">
            ${["new", "checked", "done"].map((value) => `<button type="button" data-feedback-status="${value}" class="${status === value ? "is-active" : ""}">${escapeHtml(feedbackStatusLabel(value))}</button>`).join("")}
          </div>
        </div>
        ${item.category === "계정 문의" ? `
          <div class="feedback-admin-account">
            <div><span>계정 ID</span><strong>${escapeHtml(item.account_user_id || "-")}</strong><span class="feedback-admin-account-actions"><button type="button" data-feedback-copy="${escapeHtml(item.account_user_id || "")}" aria-label="계정 아이디 복사" ${item.account_user_id ? "" : "disabled"}>복사</button><button type="button" data-feedback-user-open="${escapeHtml(item.account_user_id || "")}" ${item.account_user_id ? "" : "disabled"}>유저 관리</button></span></div>
            <div><span>연락수단</span><strong>${escapeHtml(item.reply_contact || "-")}</strong><button type="button" data-feedback-copy="${escapeHtml(item.reply_contact || "")}" aria-label="연락수단 복사" ${item.reply_contact ? "" : "disabled"}>복사</button></div>
            <p class="feedback-admin-account-summary">${escapeHtml(feedbackAccountSummary(item.account_user_id))}</p>
            <p class="feedback-admin-account-warning">연락수단만으로는 본인 확인이 되지 않습니다. 문의 내용의 최근 열람·북마크 등 이용 기록을 위 계정 요약 및 유저 관리의 실제 기록과 대조한 뒤 비밀번호를 초기화하세요.</p>
          </div>` : ""}
        <div class="feedback-admin-card-message">${escapeHtml(item.message || "")}</div>
        <button type="button" class="feedback-admin-card-context" data-feedback-context aria-expanded="false">페이지 ${escapeHtml(item.page || "-")} · 버전 ${escapeHtml(item.version || "-")} <span aria-hidden="true">▾</span></button>
        <pre class="feedback-admin-diagnostic" data-feedback-diagnostic hidden>${escapeHtml(item.diagnostic || "이 의견에는 저장된 진단정보가 없습니다.")}</pre>
      </article>`;
  }).join("");
}

async function loadFeedbackAdmin() {
  if (!els.feedbackAdminList) return;
  els.feedbackAdminMessage.hidden = true;
  const data = await api(`/api/admin/feedback?status=${encodeURIComponent(feedbackAdminFilter)}`, { method: "GET" });
  renderFeedbackAdmin(data);
  feedbackAdminLoaded = true;
}

function ensureSharedQuoteModerationPanel() {
  if (document.getElementById("sharedQuoteModerationPanel")) return;
  const feedbackPanel = document.querySelector('[data-tab-panel="feedback"] .panel');
  if (!feedbackPanel) return;

  const section = document.createElement("section");
  section.id = "sharedQuoteModerationPanel";
  section.className = "shared-quote-admin-panel";
  section.innerHTML = `
    <div class="shared-quote-admin-head">
      <div>
        <span>QUOTE FEED MODERATION</span>
        <strong>공개 문장 관리</strong>
        <p>공개 피드에서 내려야 하는 문장만 개별 삭제합니다. 사용자의 개인 저장 문장은 유지됩니다.</p>
      </div>
      <button type="button" id="sharedQuoteAdminRefresh">새로고침</button>
    </div>
    <div class="shared-quote-admin-summary">전체 공개 <strong id="sharedQuoteAdminCount">-</strong></div>
    <div id="sharedQuoteAdminList" class="shared-quote-admin-list"></div>
    <p id="sharedQuoteAdminMessage" class="message" hidden></p>`;
  feedbackPanel.appendChild(section);

  section.querySelector("#sharedQuoteAdminRefresh")?.addEventListener("click", () => {
    sharedQuoteAdminLoaded = false;
    loadSharedQuoteAdmin().catch((error) => {
      const message = document.getElementById("sharedQuoteAdminMessage");
      if (message) { message.hidden = false; message.textContent = error.message || "공개 문장을 불러오지 못했습니다."; }
    });
  });

  section.querySelector("#sharedQuoteAdminList")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-shared-quote-delete]");
    if (!button) return;
    const quoteId = Number(button.dataset.sharedQuoteDelete || 0);
    if (!quoteId || !window.confirm("이 문장을 공개 피드에서 내릴까요? 개인 저장 문장은 삭제되지 않습니다.")) return;
    button.disabled = true;
    try {
      await api("/api/admin/shared-quotes", { method: "DELETE", body: JSON.stringify({ quoteId }) });
      sharedQuoteAdminData.items = (sharedQuoteAdminData.items || []).filter((item) => Number(item.quote_id || 0) !== quoteId);
      sharedQuoteAdminData.count = Math.max(0, Number(sharedQuoteAdminData.count || 0) - 1);
      renderSharedQuoteAdmin();
      const message = document.getElementById("sharedQuoteAdminMessage");
      if (message) { message.hidden = false; message.textContent = "공개 피드에서 문장을 내렸습니다."; }
    } catch (error) {
      const message = document.getElementById("sharedQuoteAdminMessage");
      if (message) { message.hidden = false; message.textContent = error.message || "공개 문장을 내리지 못했습니다."; }
      button.disabled = false;
    }
  });
}

function renderSharedQuoteAdmin() {
  ensureSharedQuoteModerationPanel();
  const count = document.getElementById("sharedQuoteAdminCount");
  const list = document.getElementById("sharedQuoteAdminList");
  if (count) count.textContent = Number(sharedQuoteAdminData.count || 0).toLocaleString("ko-KR");
  if (!list) return;
  const items = Array.isArray(sharedQuoteAdminData.items) ? sharedQuoteAdminData.items : [];
  list.innerHTML = items.length ? items.map((item) => `
    <article class="shared-quote-admin-card">
      <div class="shared-quote-admin-meta"><span>${escapeHtml(item.user_id || "-")}</span><span>${escapeHtml(formatDate(item.shared_at))}</span><span>좋아요 ${Number(item.like_count || 0).toLocaleString("ko-KR")}</span></div>
      <strong>${escapeHtml(item.title || "제목 없음")}${item.author ? ` · ${escapeHtml(item.author)}` : ""}</strong>
      <p>${escapeHtml(item.quote_text || "")}</p>
      <button type="button" data-shared-quote-delete="${Number(item.quote_id || 0)}">피드에서 내리기</button>
    </article>`).join("") : '<div class="shared-quote-admin-empty">현재 공개된 문장이 없습니다.</div>';
}

async function loadSharedQuoteAdmin() {
  ensureSharedQuoteModerationPanel();
  const message = document.getElementById("sharedQuoteAdminMessage");
  if (message) message.hidden = true;
  const data = await api("/api/admin/shared-quotes?limit=100", { method: "GET" });
  sharedQuoteAdminData = { count: Number(data.count || 0), items: data.items || [] };
  sharedQuoteAdminLoaded = true;
  renderSharedQuoteAdmin();
}

function renderDiagnostics(items = []) {
  els.diagnosticsEmpty.hidden = items.length !== 0;
  els.driveDiagnostics.innerHTML = items.map((item) => {
    const lengths = Array.isArray(item.lengthFolders) ? item.lengthFolders : [];

    return `
      <article class="diagnostic-card">
        <div class="diagnostic-head">
          <strong>${escapeHtml(item.combination || "-")}</strong>
          <span class="diagnostic-type">${escapeHtml(item.sourceType || "폴더")}</span>
        </div>
        <div class="diagnostic-lengths">
          ${
            lengths.length
              ? lengths.map((length) => `
                  <div class="diagnostic-row">
                    <span>${escapeHtml(length.name || "-")}${length.sourceType === "바로가기" ? " · 바로가기" : ""}</span>
                    <strong>${Number(length.count || 0).toLocaleString("ko-KR")}개</strong>
                  </div>
                  ${length.error ? `<div class="diagnostic-error">${escapeHtml(length.error)}</div>` : ""}
                `).join("")
              : `<div class="diagnostic-row"><span>단편/장편</span><strong>0개</strong></div>`
          }
        </div>
        <div class="diagnostic-total">
          <span>총 콘텐츠</span>
          <strong>${Number(item.contentCount || 0).toLocaleString("ko-KR")}개</strong>
        </div>
        ${item.error ? `<div class="diagnostic-error">${escapeHtml(item.error)}</div>` : ""}
      </article>
    `;
  }).join("");
}

function renderReview(items) {
  els.reviewCount.textContent = `${items.length.toLocaleString("ko-KR")}개`;
  els.reviewEmpty.hidden = items.length !== 0;

  els.reviewList.innerHTML = items.map((item) => `
    <article class="review-item" data-id="${escapeHtml(item.id)}">
      <div class="review-top">
        <div>
          <div class="file-name">${escapeHtml(item.fileName)}</div>
          <div class="meta">${escapeHtml(item.combination)} · ${escapeHtml(item.lengthType)}</div>
        </div>
      </div>
      <form class="review-form">
        <label>
          <span>제목</span>
          <input name="title" value="${escapeHtml(item.title)}" required />
        </label>
        <label>
          <span>작성자</span>
          <input name="author" value="${escapeHtml(item.author === "작성자 미상" ? "" : item.author)}" placeholder="작성자 미상" />
        </label>
        <button type="submit">저장</button>
      </form>
    </article>
  `).join("");
}


function formatShortDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function formatDashboardDate(value) {
  const date = new Date(`${value}T00:00:00+09:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function renderDashboard(data = userAdminData) {
  const summary = data.summary || {};
  const daily = Array.isArray(data.daily) ? data.daily : [];

  if (els.dashboardTotalUsers) {
    els.dashboardTotalUsers.textContent =
      Number(summary.totalUsers || 0).toLocaleString("ko-KR");
  }
  if (els.dashboardTodaySignups) {
    els.dashboardTodaySignups.textContent =
      Number(summary.todaySignups || 0).toLocaleString("ko-KR");
  }

  if (els.visitTodayVisits) {
    els.visitTodayVisits.textContent =
      Number(summary.todayVisits || 0).toLocaleString("ko-KR");
  }
  if (els.visitTotalVisits) {
    els.visitTotalVisits.textContent =
      Number(summary.totalVisits || 0).toLocaleString("ko-KR");
  }
  if (els.visitPeriodUsers) {
    els.visitPeriodUsers.textContent =
      Number(summary.periodActiveUsers || 0).toLocaleString("ko-KR");
  }
  if (els.visitReturningUsers) {
    els.visitReturningUsers.textContent =
      Number(summary.periodReturningUsers || 0).toLocaleString("ko-KR");
  }
  if (els.visitReturnRate) {
    els.visitReturnRate.textContent = `${Number(summary.returnRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  }
  if (els.visitAverageVisits) {
    els.visitAverageVisits.textContent = Number(summary.averageVisitsPerActive || 0).toLocaleString("ko-KR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  if (!els.visitChart || !els.visitDailyList) return;

  const maxValue = Math.max(
    1,
    ...daily.flatMap((row) => [
      Number(row.signups || 0),
      Number(row.visits || 0),
    ])
  );

  els.visitChart.innerHTML = daily.map((row) => {
    const signupHeight = Math.max(
      row.signups ? 4 : 2,
      (Number(row.signups || 0) / maxValue) * 140
    );
    const visitHeight = Math.max(
      row.visits ? 4 : 2,
      (Number(row.visits || 0) / maxValue) * 140
    );

    return `
      <div class="dashboard-day" title="${escapeHtml(row.date)} · 가입 ${Number(row.signups || 0)} · 방문 ${Number(row.visits || 0)}">
        <div class="dashboard-day-value">${Number(row.signups || 0)}/${Number(row.visits || 0)}</div>
        <div class="dashboard-bars">
          <span class="dashboard-bar signups" style="height:${signupHeight}px"></span>
          <span class="dashboard-bar visits" style="height:${visitHeight}px"></span>
        </div>
        <span class="dashboard-day-label">${escapeHtml(formatDashboardDate(row.date))}</span>
      </div>
    `;
  }).join("");

  els.visitDailyList.innerHTML = [...daily]
    .reverse()
    .map((row) => `
      <div class="dashboard-daily-row">
        <strong>${escapeHtml(row.date)}</strong>
        <span>가입 <strong>${Number(row.signups || 0).toLocaleString("ko-KR")}</strong></span>
        <span>방문 <strong>${Number(row.visits || 0).toLocaleString("ko-KR")}</strong></span>
      </div>
    `)
    .join("");
}


function formatVisitDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  if (value < 60) return `${Math.round(value)}초`;
  if (value < 3600) return `${(value / 60).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}분`;
  return `${(value / 3600).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}시간`;
}

function formatVisitLoad(ms) {
  if (ms == null || !Number.isFinite(Number(ms)) || Number(ms) <= 0) return "측정 전";
  const value = Number(ms);
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}초`;
}

function renderReaderPerfBreakdown(target, group, labels = {}) {
  if (!target) return;
  const entries = Object.entries(group || {}).filter(([, row]) => Number(row?.count || 0) > 0);
  if (!entries.length) {
    target.innerHTML = '<span class="visit-empty-inline">v8.79 이후 측정 대기</span>';
    return;
  }
  target.innerHTML = entries.map(([key, row]) => `
    <div class="visit-reader-breakdown-row">
      <span>${escapeHtml(labels[key] || key)}</span>
      <strong>${formatVisitLoad(row.averageMs)}</strong>
      <small>${Number(row.count || 0).toLocaleString("ko-KR")}회</small>
    </div>
  `).join("");
}

function visitPercent(value, total) {
  const denominator = Math.max(0, Number(total || 0));
  if (!denominator) return 0;
  return (Number(value || 0) / denominator) * 100;
}

function renderVisitMix(target, rows, labelMap = {}) {
  if (!target) return;
  const list = Array.isArray(rows) ? rows : [];
  const total = list.reduce((sum, row) => sum + Number(row.count || 0), 0);
  if (!list.length || !total) {
    target.innerHTML = '<span class="visit-empty-inline">아직 데이터 없음</span>';
    return;
  }

  target.innerHTML = list.slice(0, 6).map((row) => {
    const percent = visitPercent(row.count, total);
    const label = labelMap[row.name] || row.name || "기타";
    return `
      <div class="visit-mix-row">
        <div class="visit-mix-label"><span>${escapeHtml(label)}</span><strong>${percent.toFixed(0)}%</strong></div>
        <div class="visit-mix-track"><i style="width:${Math.max(2, percent)}%"></i></div>
        <small>${Number(row.count || 0).toLocaleString("ko-KR")}세션</small>
      </div>
    `;
  }).join("");
}

function renderVisitAnalytics(data = analyticsAdminData) {
  const summary = data.summary || {};
  const today = data.today || {};
  const performanceRoot = data.performance || {};
  const currentPerformance = performanceRoot.current && typeof performanceRoot.current === "object"
    ? performanceRoot.current
    : null;
  const useCurrentPerformance = visitPerformanceScope === "current" && currentPerformance;
  const performanceData = useCurrentPerformance ? currentPerformance : performanceRoot;
  const periodText = data.periodDays === 'all' ? '전체' : String(data.periodDays || 14) + '일';
  document.querySelectorAll('[data-visit-period-label]').forEach(node => { node.textContent = periodText + ' ' + node.dataset.visitPeriodLabel; });
  const trendTitle = document.getElementById('visitTrendTitle');
  if (trendTitle) trendTitle.textContent = periodText + ' 유입량';
  const acquisition = data.acquisition || {};
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const sessions = Number(summary.sessions || 0);
  const guestSessions = Number(summary.guestSessions || 0);

  if (els.visitDataSince) {
    els.visitDataSince.textContent = data.dataStartedAt
      ? `전체 통계 집계 시작 ${formatDate(data.dataStartedAt)}`
      : "배포 후 첫 방문부터 집계됩니다";
  }
  if (els.visitTodaySessions) els.visitTodaySessions.textContent = Number(today.sessions || 0).toLocaleString("ko-KR");
  if (els.visitTodayVisitorsText) els.visitTodayVisitorsText.textContent = `순방문자 ${Number(today.visitors || 0).toLocaleString("ko-KR")}명`;
  if (els.visitPeriodVisitors) els.visitPeriodVisitors.textContent = Number(summary.visitors || 0).toLocaleString("ko-KR");
  if (els.visitNewVisitorsText) els.visitNewVisitorsText.textContent = `신규 ${Number(summary.newVisitors || 0).toLocaleString("ko-KR")}명`;
  if (els.visitPeriodSessions) els.visitPeriodSessions.textContent = sessions.toLocaleString("ko-KR");
  if (els.visitSessionPerVisitorText) els.visitSessionPerVisitorText.textContent = `1인당 ${Number(summary.averageSessionsPerVisitor || 0).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}회`;
  if (els.visitGuestShare) els.visitGuestShare.textContent = `${visitPercent(guestSessions, sessions).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  if (els.visitGuestSplitText) els.visitGuestSplitText.textContent = `로그인 ${Number(summary.loggedSessions || 0).toLocaleString("ko-KR")} / 비로그인 ${guestSessions.toLocaleString("ko-KR")}`;
  if (els.visitReturnRateNew) els.visitReturnRateNew.textContent = `${Number(summary.returnRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  if (els.visitReturningText) els.visitReturningText.textContent = `재방문 ${Number(summary.returningVisitors || 0).toLocaleString("ko-KR")}명`;
  if (els.visitWorkOpensAvg) els.visitWorkOpensAvg.textContent = Number(summary.averageWorkOpensPerSession || 0).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (els.visitEngagedText) els.visitEngagedText.textContent = `작품 열기 세션 ${Number(summary.engagedRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  if (els.visitActiveTimeAvg) els.visitActiveTimeAvg.textContent = formatVisitDuration(summary.averageActiveSecondsPerSession || 0);
  if (els.visitTodayWorkOpens) els.visitTodayWorkOpens.textContent = Number(today.workOpens || 0).toLocaleString("ko-KR");
  if (els.visitSignupShown) els.visitSignupShown.textContent = Number(acquisition.shown || 0).toLocaleString("ko-KR");
  if (els.visitSignupClose) els.visitSignupClose.textContent = Number(acquisition.close || 0).toLocaleString("ko-KR");
  if (els.visitSignupCloseRate) els.visitSignupCloseRate.textContent = `노출 대비 ${Number(acquisition.signupCloseRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  if (els.visitSignupLoginClicks) els.visitSignupLoginClicks.textContent = Number(acquisition.loginClicks || 0).toLocaleString("ko-KR");
  if (els.visitSignupLoginCompleted) els.visitSignupLoginCompleted.textContent = `완료 ${Number(acquisition.loginCompleted || 0).toLocaleString("ko-KR")}`;
  if (els.visitSignupClicks) els.visitSignupClicks.textContent = Number(acquisition.signupClicks || 0).toLocaleString("ko-KR");
  if (els.visitSignupClickRate) els.visitSignupClickRate.textContent = `노출 대비 ${Number(acquisition.signupClickRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  if (els.visitSignupCompleted) els.visitSignupCompleted.textContent = Number(acquisition.signupCompleted || 0).toLocaleString("ko-KR");
  if (els.visitSignupCompletionRate) els.visitSignupCompletionRate.textContent = `노출 대비 ${Number(acquisition.signupCompletionRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}% · 클릭→완료 ${Number(acquisition.signupClickToCompleteRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;

  if (els.visitTrendChart) {
    const maxValue = Math.max(1, ...daily.flatMap((row) => [Number(row.sessions || 0), Number(row.visitors || 0)]));
    els.visitTrendChart.innerHTML = daily.map((row) => {
      const sessionHeight = Math.max(row.sessions ? 5 : 2, (Number(row.sessions || 0) / maxValue) * 150);
      const visitorHeight = Math.max(row.visitors ? 5 : 2, (Number(row.visitors || 0) / maxValue) * 150);
      return `
        <div class="visit-trend-day" title="${escapeHtml(row.date)} · 세션 ${Number(row.sessions || 0)} · 순방문자 ${Number(row.visitors || 0)}">
          <div class="visit-trend-values">${Number(row.sessions || 0)}/${Number(row.visitors || 0)}</div>
          <div class="visit-trend-bars"><i class="sessions" style="height:${sessionHeight}px"></i><i class="visitors" style="height:${visitorHeight}px"></i></div>
          <span>${escapeHtml(formatDashboardDate(row.date))}</span>
        </div>
      `;
    }).join("");
  }

  if (els.visitDailyListNew) {
    els.visitDailyListNew.innerHTML = [...daily].reverse().map((row) => `
      <div class="visit-daily-row-new">
        <strong>${escapeHtml(row.date)}</strong>
        <span>세션 <b>${Number(row.sessions || 0).toLocaleString("ko-KR")}</b></span>
        <span>방문자 <b>${Number(row.visitors || 0).toLocaleString("ko-KR")}</b></span>
        <span>비로그인 <b>${Number(row.guestSessions || 0).toLocaleString("ko-KR")}</b></span>
        <span>작품 <b>${Number(row.workOpens || 0).toLocaleString("ko-KR")}</b></span>
      </div>
    `).join("");
  }

  if (els.visitActivityLevels) {
    const levels = [
      ["둘러보기", Number(summary.browseSessions || 0), "browse"],
      ["읽기 시작", Number(summary.readingSessions || 0), "reading"],
      ["활발", Number(summary.activeSessions || 0), "active"],
    ];
    els.visitActivityLevels.innerHTML = levels.map(([label, count, cls]) => {
      const percent = visitPercent(count, sessions);
      return `
        <div class="visit-level-row ${cls}">
          <div><span>${label}</span><strong>${count.toLocaleString("ko-KR")}세션 · ${percent.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%</strong></div>
          <div class="visit-level-track"><i style="width:${Math.max(count ? 3 : 0, percent)}%"></i></div>
        </div>
      `;
    }).join("");
  }

  if (els.visitEngagedRate) els.visitEngagedRate.textContent = `${Number(summary.engagedRate || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  if (els.visitSearchAvg) els.visitSearchAvg.textContent = Number(summary.averageSearchesPerSession || 0).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (els.visitTotalWorkOpens) els.visitTotalWorkOpens.textContent = Number(summary.workOpens || 0).toLocaleString("ko-KR");

  if (els.visitPerfScope) {
    els.visitPerfScope.querySelectorAll("[data-perf-scope]").forEach((button) => {
      const scope = button.getAttribute("data-perf-scope");
      button.classList.toggle("is-active", scope === (useCurrentPerformance ? "current" : "overall"));
      if (scope === "current") button.disabled = !currentPerformance;
    });
  }
  if (els.visitPerfScopeMeta) {
    const version = String(performanceRoot.currentVersion || "").trim();
    els.visitPerfScopeMeta.textContent = useCurrentPerformance
      ? `현재 버전 v${version || "-"} · 이 버전에서 새로 측정된 값`
      : "전체 누적 · 이전 버전 성능 포함";
  }

  if (data.performanceDetailAvailable === false && els.visitPerfScopeMeta) els.visitPerfScopeMeta.textContent += ' · 90일/전체 상세 histogram은 화면 조회에서 생략(내보내기에서 제공)';
  if (els.visitPageLoad) els.visitPageLoad.textContent = formatVisitLoad(performanceData.pageLoadMs);
  if (els.visitArchiveLoad) els.visitArchiveLoad.textContent = formatVisitLoad(performanceData.archiveLoadMs);
  if (els.visitReaderLoad) els.visitReaderLoad.textContent = formatVisitLoad(performanceData.readerLoadMs);
  if (els.visitReaderLoadCount) els.visitReaderLoadCount.textContent = `측정 ${Number(performanceData.readerLoadCount || 0).toLocaleString("ko-KR")}회`;

  const readerBreakdown = performanceData.readerBreakdown || {};
  if (els.visitReaderPercentiles) {
    const detailCount = Number(readerBreakdown.count || 0);
    els.visitReaderPercentiles.textContent = detailCount
      ? `세부 ${detailCount.toLocaleString("ko-KR")}회 · 중앙구간 ${readerBreakdown.p50OpenEnded ? "8초 초과" : `≤ ${formatVisitLoad(readerBreakdown.p50ApproxMs)}`} · P95 구간 ${readerBreakdown.p95OpenEnded ? "8초 초과" : `≤ ${formatVisitLoad(readerBreakdown.p95ApproxMs)}`}`
      : "v8.79 이후 데이터 집계";
  }
  if (els.visitReaderPhaseGrid) {
    const phases = readerBreakdown.phases || {};
    const phaseRows = [
      ["서버 응답", phases.responseMs],
      ["본문 수신", phases.downloadMs],
      ["화면 렌더링", phases.renderMs],
      ["초기 레이아웃", phases.layoutMs],
    ];
    els.visitReaderPhaseGrid.innerHTML = Number(readerBreakdown.count || 0)
      ? phaseRows.map(([label, value]) => `<div><span>${label}</span><strong>${formatVisitLoad(value)}</strong></div>`).join("")
      : '<span class="visit-empty-inline">세부 계측 데이터가 쌓이면 단계별 시간이 표시됩니다.</span>';
  }

  if (els.visitReaderRenderDetailGrid) {
    const detail = readerBreakdown.renderDetail || {};
    const detailCount = Number(detail.textInsert?.count || 0);
    const rows = [
      ["DOM 준비", detail.domSetup?.averageMs],
      ["본문 삽입", detail.textInsert?.averageMs],
      ["렌더 안정화", detail.settle?.averageMs],
      ["로딩 커버 정리", detail.overlay?.averageMs],
      ["fade 전 프레임", detail.overlayFrameWait?.averageMs],
      ["fade·transition", detail.overlayTransition?.averageMs],
      ["커버 DOM 제거", detail.overlayRemove?.averageMs],
      ["모드 적용", detail.modeSetup?.averageMs],
      ["첫 화면 반영", detail.paintWait?.averageMs],
      ["위치 초기화·복원", detail.offsetRestore?.averageMs],
    ];
    els.visitReaderRenderDetailGrid.innerHTML = detailCount
      ? rows.map(([label, value]) => `<div><span>${label}</span><strong>${formatVisitLoad(value)}</strong></div>`).join("")
      : '<span class="visit-empty-inline">v8.85 이후 스크롤 렌더링 세부 데이터가 쌓이면 표시됩니다.</span>';
    if (els.visitReaderRenderDetailMeta) {
      els.visitReaderRenderDetailMeta.textContent = detailCount
        ? `스크롤 세부 ${detailCount.toLocaleString("ko-KR")}회`
        : "v8.85 이후 측정";
    }
  }

  if (els.visitReaderMissServerGrid) {
    const missServer = readerBreakdown.missServer || {};
    const missCount = Number(missServer.total?.count || 0);
    const rows = [
      ["KV 조회", missServer.kvRead?.averageMs],
      ["Google 인증", missServer.token?.averageMs],
      ["Drive 경로 검증", missServer.verify?.averageMs],
      ["Drive 원본 요청", missServer.driveRequest?.averageMs],
      ["원본 다운로드", missServer.driveDownload?.averageMs],
      ["디코딩", missServer.decode?.averageMs],
      ["KV 저장", missServer.kvWrite?.averageMs],
      ["서버 전체", missServer.total?.averageMs],
    ];
    els.visitReaderMissServerGrid.innerHTML = missCount
      ? rows.map(([label, value]) => `<div><span>${label}</span><strong>${formatVisitLoad(value)}</strong></div>`).join("")
      : '<span class="visit-empty-inline">KV MISS 세부 계측 데이터가 쌓이면 서버 내부 시간이 표시됩니다.</span>';
    if (els.visitReaderMissServerMeta) {
      els.visitReaderMissServerMeta.textContent = missCount
        ? `MISS 세부 ${missCount.toLocaleString("ko-KR")}회`
        : "v8.79 이후 측정 대기";
    }
  }
    renderReaderPerfBreakdown(els.visitReaderCacheBreakdown, readerBreakdown.cache, { hit: "KV HIT", miss: "KV MISS", unknown: "알 수 없음" });
  renderReaderPerfBreakdown(els.visitReaderSizeBreakdown, readerBreakdown.size, { small: "1MB 미만", medium: "1~5MB", large: "5MB 이상" });
  renderReaderPerfBreakdown(els.visitReaderModeBreakdown, readerBreakdown.mode, { scroll: "스크롤", page: "페이지" });

  if (els.visitHourlyChart) {
    const hourlyMap = new Map((data.hourly || []).map((row) => [Number(row.hour), Number(row.sessions || 0)]));
    const maxHour = Math.max(1, ...hourlyMap.values());
    els.visitHourlyChart.innerHTML = Array.from({ length: 24 }, (_, hour) => {
      const count = Number(hourlyMap.get(hour) || 0);
      const height = Math.max(count ? 4 : 2, (count / maxHour) * 92);
      return `<div class="visit-hour" title="${hour}시 · ${count}세션"><i style="height:${height}px"></i><span>${String(hour).padStart(2, "0")}</span></div>`;
    }).join("");
  }

  renderVisitMix(els.visitDeviceMix, data.devices, { mobile: "모바일", tablet: "태블릿", desktop: "PC", other: "기타" });
  renderVisitMix(els.visitBrowserMix, data.browsers, { safari: "Safari", chrome: "Chrome", samsung: "Samsung", firefox: "Firefox", edge: "Edge", other: "기타" });
  renderVisitMix(els.visitSourceMix, data.sources, { direct: "직접 유입", internal: "내부 이동", search: "검색", social: "SNS", external: "외부 링크" });

  if (els.visitReferrerList) {
    const referrers = Array.isArray(data.referrers) ? data.referrers : [];
    els.visitReferrerList.innerHTML = referrers.length
      ? referrers.map((row) => `<span><b>${escapeHtml(row.name)}</b><em>${Number(row.count || 0).toLocaleString("ko-KR")}</em></span>`).join("")
      : '<span class="visit-empty-inline">외부 유입 데이터 없음</span>';
  }

  if (els.visitRecentBody) {
    const recent = Array.isArray(data.recent) ? data.recent : [];
    if (els.visitRecentEmpty) els.visitRecentEmpty.hidden = recent.length !== 0;
    els.visitRecentBody.innerHTML = recent.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.visitorLabel || "익명")}</strong></td>
        <td>${escapeHtml(formatDate(row.lastSeenAt))}</td>
        <td><span class="visit-type-badge ${row.loggedIn ? "login" : "guest"}">${row.loggedIn ? "로그인" : "비로그인"}</span></td>
        <td>${escapeHtml(formatVisitDuration(row.activeSeconds || 0))}</td>
        <td>${Number(row.workOpens || 0).toLocaleString("ko-KR")}</td>
        <td>${Number(row.searches || 0).toLocaleString("ko-KR")}</td>
        <td>${escapeHtml(`${row.deviceType || "other"} · ${row.browserName || "other"}`)}</td>
        <td>${escapeHtml(row.sourceType || "direct")}</td>
      </tr>
    `).join("");
  }
}

function getFilteredAdminUsers() {
  const query = String(els.userSearchInput?.value || "")
    .trim()
    .toLowerCase();

  if (!query) return userAdminData.users || [];

  return (userAdminData.users || []).filter((user) =>
    String(user.userId || "").toLowerCase().includes(query)
  );
}

function renderAdminUsers() {
  const users = getFilteredAdminUsers();
  const total = (userAdminData.users || []).length;

  els.userCountBadge.textContent = `${total.toLocaleString("ko-KR")}명`;
  els.userEmpty.hidden = users.length !== 0;

  els.userTableBody.innerHTML = users.map((user) => `
    <tr data-user-id="${escapeHtml(user.userId)}">
      <td class="user-id-cell">${escapeHtml(user.userId)}</td>
      <td>${escapeHtml(formatShortDate(user.createdAt))}</td>
      <td>${escapeHtml(user.lastActivityAt ? formatDate(user.lastActivityAt) : "-")}</td>
      <td>${Number(user.visitCount || 0).toLocaleString("ko-KR")}</td>
      <td>${Number(user.bookmarkCount || 0).toLocaleString("ko-KR")}</td>
      <td>${Number(user.recentCount || 0).toLocaleString("ko-KR")}</td>
      <td>${Number(user.readCount || 0).toLocaleString("ko-KR")}</td>
      <td>
        <div class="user-actions">
          <button class="user-action-button" type="button" data-user-action="reset_password">비밀번호 초기화</button>
          <button class="user-action-button" type="button" data-user-action="reset_sessions">세션 초기화</button>
          <button class="user-action-button danger" type="button" data-user-action="delete_user">계정 삭제</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function loadUserAdminData(showMessage = false, strictAnalytics = false) {
  const [data, analytics] = await Promise.all([
    api(`/api/admin/users?days=${visitPeriodDays}`),
    api(`/api/admin/analytics?days=${visitPeriodDays}`).catch((error) => {
      if (strictAnalytics) throw error;
      console.warn("전체 방문 통계를 불러오지 못했습니다.", error);
      return {
        summary: {}, today: {}, performance: {}, acquisition: {}, daily: [], hourly: [],
        devices: [], browsers: [], sources: [], referrers: [], recent: [],
        dataStartedAt: null,
      };
    }),
  ]);

  userAdminData = {
    summary: data.summary || {},
    daily: data.daily || [],
    users: data.users || [],
  };
  analyticsAdminData = {
    periodDays: analytics.periodDays,
    performanceDetailAvailable: analytics.performanceDetailAvailable,
    summary: analytics.summary || {},
    today: analytics.today || {},
    performance: analytics.performance || {},
    acquisition: analytics.acquisition || {},
    daily: analytics.daily || [],
    hourly: analytics.hourly || [],
    devices: analytics.devices || [],
    browsers: analytics.browsers || [],
    sources: analytics.sources || [],
    referrers: analytics.referrers || [],
    recent: analytics.recent || [],
    dataStartedAt: analytics.dataStartedAt || null,
  };

  renderDashboard(userAdminData);
  renderVisitAnalytics(analyticsAdminData);
  renderAdminUsers();

  if (showMessage && els.userMessage) {
    els.userMessage.hidden = false;
    els.userMessage.textContent = "유저 정보를 새로 불러왔습니다.";
  }
}

function formatResourceBytes(value) {
  if (value == null || !Number.isFinite(Number(value))) return "측정 안 함";

  const bytes = Number(value);
  if (bytes < 1024) return `${bytes.toLocaleString("ko-KR")} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString("ko-KR", {
      maximumFractionDigits: 1,
    })} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toLocaleString("ko-KR", {
      maximumFractionDigits: 2,
    })} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })} GB`;
}

function formatResourceNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? number.toLocaleString("ko-KR")
    : "0";
}

function getResourceAnalyticsPeriod(data, productName) {
  return (
    data?.analytics?.products?.[productName]?.periods?.[
      resourceAnalyticsPeriod
    ] || null
  );
}

const RESOURCE_FREE_DAILY_LIMITS = {
  pagesRequests: 100000,
  kvReads: 100000,
  kvWrites: 1000,
  kvLists: 1000,
  d1RowsRead: 5000000,
  d1RowsWritten: 100000,
};

function resourcePeriodDays() {
  return resourceAnalyticsPeriod === "30d"
    ? 30
    : resourceAnalyticsPeriod === "7d"
      ? 7
      : 1;
}

function formatResourcePercent(percent) {
  const value = Number(percent || 0);
  if (!Number.isFinite(value) || value <= 0) return "0%";
  if (value < 0.01) return `${value.toFixed(4)}%`;
  if (value < 0.1) return `${value.toFixed(3)}%`;
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value).toLocaleString("ko-KR")}%`;
}

function resourceUsageTone(percent) {
  const value = Number(percent || 0);

  if (value <= 10) {
    return {
      className: "is-very-safe",
      label: "매우 안전",
    };
  }
  if (value <= 50) {
    return {
      className: "is-safe",
      label: "안전",
    };
  }
  if (value <= 80) {
    return {
      className: "is-watch",
      label: "주의",
    };
  }
  return {
    className: "is-danger",
    label: "한도 근접",
  };
}

function makeResourceQuotaRow({
  name,
  value,
  dailyLimit,
  unit = "회",
  detail = "",
  available = true,
}) {
  const days = resourcePeriodDays();
  const limit = Number(dailyLimit || 0) * days;
  const numericValue = Number(value || 0);
  const percent = limit > 0
    ? (numericValue / limit) * 100
    : 0;
  const tone = resourceUsageTone(percent);
  const barPercent = Math.min(100, Math.max(0, percent));

  return {
    name,
    value: numericValue,
    limit,
    unit,
    detail,
    available,
    percent,
    tone,
    html: available
      ? `
        <article class="resource-quota-row ${tone.className}">
          <div class="resource-quota-name">
            <strong>${escapeHtml(name)}</strong>
            <span>Free 한도 ${formatResourceNumber(limit)}${escapeHtml(unit)}</span>
          </div>

          <div class="resource-quota-main">
            <div class="resource-quota-value-line">
              <b>${formatResourceNumber(numericValue)}${escapeHtml(unit)}</b>
              <span>/ ${formatResourceNumber(limit)}${escapeHtml(unit)}</span>
            </div>
            <div class="resource-quota-track" aria-hidden="true">
              <i style="width:max(${barPercent.toFixed(4)}%, ${numericValue > 0 ? "2px" : "0px"})"></i>
            </div>
            ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
          </div>

          <div class="resource-quota-status">
            <b>${formatResourcePercent(percent)}</b>
            <span>${escapeHtml(tone.label)}</span>
          </div>
        </article>
      `
      : `
        <article class="resource-quota-row is-unavailable">
          <div class="resource-quota-name">
            <strong>${escapeHtml(name)}</strong>
            <span>Free 한도 ${formatResourceNumber(limit)}${escapeHtml(unit)}</span>
          </div>
          <div class="resource-quota-main">
            <div class="resource-quota-value-line">
              <b>-</b>
              <span>데이터 없음</span>
            </div>
            <small>${escapeHtml(detail || "Analytics dataset을 확인할 수 없습니다.")}</small>
          </div>
          <div class="resource-quota-status">
            <span>확인 필요</span>
          </div>
        </article>
      `,
  };
}

function renderResourceAnalytics(data) {
  const analytics = data?.analytics || {};
  const products = analytics?.products || {};

  const periodLabels = {
    today: "오늘",
    "7d": "최근 7일",
    "30d": "최근 30일",
  };

  els.resourcePeriodTabs
    ?.querySelectorAll("[data-resource-period]")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.resourcePeriod === resourceAnalyticsPeriod
      );
    });

  if (!analytics.configured) {
    els.resourceFunctionsState.textContent = "미설정";
    els.resourceFunctionsMeta.textContent =
      "Analytics secret / Account ID 확인 필요";
    els.resourceOverallState.textContent = "확인 필요";
    els.resourceOverallMeta.textContent =
      "Analytics 연결 상태를 확인해 주세요.";
    els.resourceOverallCard.className =
      "resource-overview-card resource-overview-card-status is-watch";
    els.resourceAnalyticsRange.textContent =
      "Cloudflare Analytics 미연결";
    els.resourceQuotaList.innerHTML =
      `<div class="resource-empty">Cloudflare Analytics 환경변수를 확인해 주세요.</div>`;
    els.resourceAnalyticsApiCalls.textContent = "0회";
    els.resourceAnalyticsNotice.textContent =
      analytics.note ||
      "Cloudflare Analytics 환경변수를 확인해 주세요.";
    els.resourceAnalyticsNotice.classList.add("is-error");
    return;
  }

  const availableCount = Object.values(products).filter(
    (item) => item?.available
  ).length;

  els.resourceFunctionsState.textContent =
    analytics.partial
      ? "일부 연결"
      : analytics.connected
        ? "연결됨"
        : "조회 실패";

  els.resourceFunctionsMeta.textContent =
    `${availableCount}/4 dataset · GraphQL ${Number(
      analytics.apiRequests || 0
    ).toLocaleString("ko-KR")}회`;

  els.resourceAnalyticsRange.textContent =
    `${analytics.range?.start || "-"} ~ ${
      analytics.range?.end || "-"
    } · ${analytics.timezone || "UTC"} 기준 · ${
      periodLabels[resourceAnalyticsPeriod] || "선택 기간"
    }`;

  const pages = getResourceAnalyticsPeriod(
    data,
    "pagesFunctions"
  );
  const kv = getResourceAnalyticsPeriod(data, "kv");
  const d1 = getResourceAnalyticsPeriod(data, "d1");

  const rows = [
    makeResourceQuotaRow({
      name: "Pages Functions",
      value: pages?.requests,
      dailyLimit: RESOURCE_FREE_DAILY_LIMITS.pagesRequests,
      detail: products.pagesFunctions?.available
        ? `오류 ${formatResourceNumber(pages?.errors)} · subrequest ${formatResourceNumber(pages?.subrequests)}`
        : products.pagesFunctions?.error || "Pages Functions 데이터 없음",
      available: Boolean(products.pagesFunctions?.available && pages),
    }),
    makeResourceQuotaRow({
      name: "KV Read",
      value: kv?.reads,
      dailyLimit: RESOURCE_FREE_DAILY_LIMITS.kvReads,
      detail: "KV key 읽기",
      available: Boolean(products.kv?.available && kv),
    }),
    makeResourceQuotaRow({
      name: "KV Write",
      value: kv?.writes,
      dailyLimit: RESOURCE_FREE_DAILY_LIMITS.kvWrites,
      detail: "KV key 생성·갱신",
      available: Boolean(products.kv?.available && kv),
    }),
    makeResourceQuotaRow({
      name: "KV List",
      value: kv?.lists,
      dailyLimit: RESOURCE_FREE_DAILY_LIMITS.kvLists,
      detail: `delete ${formatResourceNumber(kv?.deletes)} · 기타 ${formatResourceNumber(kv?.other)}`,
      available: Boolean(products.kv?.available && kv),
    }),
    makeResourceQuotaRow({
      name: "D1 Rows Read",
      value: d1?.rowsRead,
      dailyLimit: RESOURCE_FREE_DAILY_LIMITS.d1RowsRead,
      unit: " rows",
      detail: `read query ${formatResourceNumber(d1?.readQueries)}`,
      available: Boolean(products.d1?.available && d1),
    }),
    makeResourceQuotaRow({
      name: "D1 Rows Written",
      value: d1?.rowsWritten,
      dailyLimit: RESOURCE_FREE_DAILY_LIMITS.d1RowsWritten,
      unit: " rows",
      detail: `write query ${formatResourceNumber(d1?.writeQueries)}`,
      available: Boolean(products.d1?.available && d1),
    }),
  ];

  els.resourceQuotaList.innerHTML = rows
    .map((row) => row.html)
    .join("");

  els.resourceAnalyticsApiCalls.textContent =
    `${Number(analytics.apiRequests || 0).toLocaleString("ko-KR")}회`;

  const availableRows = rows.filter((row) => row.available);
  const highest = availableRows.reduce(
    (best, row) =>
      !best || row.percent > best.percent
        ? row
        : best,
    null
  );

  if (highest) {
    const overall = resourceUsageTone(highest.percent);
    els.resourceOverallState.textContent = overall.label;
    els.resourceOverallMeta.textContent =
      `${highest.name}이(가) 가장 높음 · ${formatResourcePercent(highest.percent)}`;
    els.resourceOverallCard.className =
      `resource-overview-card resource-overview-card-status ${overall.className}`;
  } else {
    els.resourceOverallState.textContent = "확인 필요";
    els.resourceOverallMeta.textContent =
      "사용량 dataset을 확인할 수 없습니다.";
    els.resourceOverallCard.className =
      "resource-overview-card resource-overview-card-status is-watch";
  }

  const failed = Object.entries(products)
    .filter(([, item]) => item && !item.available)
    .map(([name]) => name);

  if (!analytics.connected) {
    els.resourceAnalyticsNotice.classList.add("is-error");
    els.resourceAnalyticsNotice.textContent =
      "Analytics API 인증 또는 dataset 조회에 실패했습니다. Token 권한과 Account ID를 확인해 주세요.";
  } else if (failed.length) {
    els.resourceAnalyticsNotice.classList.add("is-error");
    els.resourceAnalyticsNotice.textContent =
      `일부 dataset만 조회되었습니다: ${failed.join(", ")}. 표시된 오류 메시지를 확인해 주세요.`;
  } else if (highest && highest.percent <= 10) {
    els.resourceAnalyticsNotice.classList.remove("is-error");
    els.resourceAnalyticsNotice.textContent =
      `현재 선택 기간의 최고 사용률은 ${highest.name} ${formatResourcePercent(highest.percent)}입니다. Free 한도 대비 매우 낮은 수준입니다.`;
  } else if (highest && highest.percent <= 50) {
    els.resourceAnalyticsNotice.classList.remove("is-error");
    els.resourceAnalyticsNotice.textContent =
      `현재 선택 기간의 최고 사용률은 ${highest.name} ${formatResourcePercent(highest.percent)}입니다. 아직 충분한 여유가 있습니다.`;
  } else {
    els.resourceAnalyticsNotice.classList.remove("is-error");
    els.resourceAnalyticsNotice.textContent =
      `현재 선택 기간의 최고 사용률은 ${highest?.name || "-"} ${formatResourcePercent(highest?.percent || 0)}입니다. 사용량 추이를 확인해 주세요.`;
  }
}


function resourceDeploymentStatusLabel(item) {
  if (item?.skipped) return { label: "건너뜀", className: "is-skipped" };

  const status = String(item?.status || "unknown").toLowerCase();
  if (status === "success") return { label: "성공", className: "is-success" };
  if (status === "failure") return { label: "실패", className: "is-failure" };
  if (status === "canceled") return { label: "취소", className: "is-canceled" };
  if (status === "active") return { label: "진행 중", className: "is-active" };
  if (status === "idle") return { label: "대기", className: "is-active" };
  return { label: status || "확인 중", className: "is-unknown" };
}

function renderResourcePagesDeployments(data) {
  const pages = data?.pagesDeployments || {};
  const limit = Number(pages.limit || 500);

  if (!pages.configured || !pages.connected) {
    if (els.resourcePagesBuildCard) {
      els.resourcePagesBuildCard.className =
        "resource-overview-card resource-overview-card-status is-watch";
    }
    if (els.resourcePagesBuildState) els.resourcePagesBuildState.textContent = "조회 실패";
    if (els.resourcePagesBuildMeta) {
      els.resourcePagesBuildMeta.textContent = pages.note || "Pages Read 권한을 확인해 주세요.";
    }
    if (els.resourcePagesBuildRange) {
      els.resourcePagesBuildRange.textContent = "Cloudflare Pages 배포 목록 미연결";
    }
    if (els.resourcePagesBuildUsed) els.resourcePagesBuildUsed.textContent = "-";
    if (els.resourcePagesBuildPercent) els.resourcePagesBuildPercent.textContent = "-";
    if (els.resourcePagesBuildRemaining) els.resourcePagesBuildRemaining.textContent = "-";
    if (els.resourcePagesBuildResult) els.resourcePagesBuildResult.textContent = "-";
    if (els.resourcePagesDeploymentList) {
      els.resourcePagesDeploymentList.innerHTML =
        `<div class="resource-empty">${escapeHtml(pages.note || "Cloudflare Pages 배포 기록을 조회하지 못했습니다.")}</div>`;
    }
    if (els.resourcePagesMoreButton) els.resourcePagesMoreButton.hidden = true;
    if (els.resourcePagesBuildNotice) {
      els.resourcePagesBuildNotice.classList.add("is-error");
      els.resourcePagesBuildNotice.textContent =
        pages.note || "CLOUDFLARE_PAGES_TOKEN과 Cloudflare Pages Read 권한을 확인해 주세요.";
    }
    return;
  }

  const used = Number(pages.used || 0);
  const remaining = Number(pages.remaining ?? Math.max(0, limit - used));
  const percent = Number(pages.percent || 0);
  const tone = resourceUsageTone(percent);
  const deployments = Array.isArray(pages.deployments) ? pages.deployments : [];
  const visible = deployments.slice(0, resourcePagesVisibleLimit);

  if (els.resourcePagesBuildCard) {
    els.resourcePagesBuildCard.className =
      `resource-overview-card resource-overview-card-status ${tone.className}`;
  }
  if (els.resourcePagesBuildState) {
    els.resourcePagesBuildState.textContent = `${formatResourceNumber(used)} / ${formatResourceNumber(limit)}`;
  }
  if (els.resourcePagesBuildMeta) {
    els.resourcePagesBuildMeta.textContent =
      `${formatResourcePercent(percent)} 사용 · ${formatResourceNumber(remaining)}회 남음`;
  }
  if (els.resourcePagesBuildRange) {
    els.resourcePagesBuildRange.textContent =
      `${pages.range?.label || "이번 달"} · ${pages.range?.timezone || "Asia/Seoul"} 기준 · API ${formatResourceNumber(pages.apiRequests)}회`;
  }
  if (els.resourcePagesBuildUsed) {
    els.resourcePagesBuildUsed.textContent = `${formatResourceNumber(used)} / ${formatResourceNumber(limit)}`;
  }
  if (els.resourcePagesBuildPercent) {
    els.resourcePagesBuildPercent.textContent = formatResourcePercent(percent);
  }
  if (els.resourcePagesBuildRemaining) {
    els.resourcePagesBuildRemaining.textContent = `${formatResourceNumber(remaining)}회`;
  }
  if (els.resourcePagesBuildResult) {
    els.resourcePagesBuildResult.textContent =
      `${formatResourceNumber(pages.success)} / ${formatResourceNumber(pages.failure)}`;
  }

  if (els.resourcePagesDeploymentList) {
    els.resourcePagesDeploymentList.innerHTML = visible.length
      ? visible.map((item) => {
          const status = resourceDeploymentStatusLabel(item);
          const environment = item?.environment === "production" ? "production" : "preview";
          const message = String(item?.commitMessage || "").trim();
          const branch = String(item?.branch || "").trim();
          return `
            <article class="resource-pages-deployment-row">
              <div class="resource-pages-deployment-main">
                <div class="resource-pages-deployment-badges">
                  <span class="resource-pages-status ${status.className}">${escapeHtml(status.label)}</span>
                  <span class="resource-pages-env">${escapeHtml(environment)}</span>
                </div>
                <strong>${escapeHtml(message || branch || item?.shortId || "Pages deployment")}</strong>
                <small>${escapeHtml(branch || "-")}${item?.shortId ? ` · ${escapeHtml(item.shortId)}` : ""}</small>
              </div>
              <time datetime="${escapeHtml(item?.createdOn || "")}">${escapeHtml(formatSummaryDate(item?.createdOn))}</time>
            </article>
          `;
        }).join("")
      : `<div class="resource-empty">이번 달 Pages 배포 기록이 없습니다.</div>`;
  }

  if (els.resourcePagesMoreButton) {
    const hasMore = deployments.length > resourcePagesVisibleLimit;
    els.resourcePagesMoreButton.hidden = !hasMore;
    els.resourcePagesMoreButton.textContent = hasMore
      ? `10개 더보기 (${formatResourceNumber(resourcePagesVisibleLimit)} / ${formatResourceNumber(deployments.length)})`
      : "";
  }

  if (els.resourcePagesBuildNotice) {
    els.resourcePagesBuildNotice.classList.remove("is-error");
    const extras = [
      `production ${formatResourceNumber(pages.production)}`,
      `preview ${formatResourceNumber(pages.preview)}`,
      pages.canceled ? `취소 ${formatResourceNumber(pages.canceled)}` : "",
      pages.active ? `진행/대기 ${formatResourceNumber(pages.active)}` : "",
      pages.skipped ? `건너뜀 ${formatResourceNumber(pages.skipped)}` : "",
    ].filter(Boolean).join(" · ");
    els.resourcePagesBuildNotice.textContent =
      `${pages.note || "Cloudflare Pages 배포 목록 기준 집계입니다."}${extras ? ` · ${extras}` : ""}`;
  }
}

function d1TableCount(d1, tableName) {
  const table = (Array.isArray(d1?.tables) ? d1.tables : [])
    .find((item) => item?.name === tableName);
  return table ? Number(table.count || 0) : null;
}

function renderD1DataHealth(data) {
  const d1 = data?.d1 || {};
  const today = data?.analytics?.products?.d1?.periods?.today || null;
  const rowsWritten = data?.analytics?.products?.d1?.available
    ? Number(today?.rowsWritten || 0)
    : null;

  const setCount = (element, value, suffix = "") => {
    if (!element) return;
    element.textContent = value == null
      ? "-"
      : `${Number(value).toLocaleString("ko-KR")}${suffix}`;
  };

  setCount(els.resourceD1Users, d1TableCount(d1, "users"), "명");
  setCount(els.resourceD1UserItems, d1TableCount(d1, "user_items"), "건");
  setCount(els.resourceD1Quotes, d1TableCount(d1, "user_quotes"), "건");
  setCount(els.resourceD1SharedQuotes, d1TableCount(d1, "shared_quotes"), "건");

  if (els.resourceD1DatabaseSize) {
    els.resourceD1DatabaseSize.textContent = d1?.bytes == null
      ? "-"
      : formatResourceBytes(d1.bytes);
  }

  if (els.resourceD1TodayWritten) {
    els.resourceD1TodayWritten.textContent = rowsWritten == null
      ? "-"
      : `${rowsWritten.toLocaleString("ko-KR")} rows`;
  }
}

function renderResourceUsage(data) {
  resourceUsageData = data;
  resourceUsageLoaded = true;

  const kv = data?.kv || {};
  const d1 = data?.d1 || {};
  const r2 = data?.r2 || {};

  els.resourceKvState.textContent = kv.bound
    ? `${Number(kv.keyCount || 0).toLocaleString("ko-KR")} keys`
    : "미연결";
  els.resourceKvMeta.textContent = kv.bound
    ? `본문 캐시 ${Number(kv.bodyCacheKeyCount || 0).toLocaleString("ko-KR")}개 · ${
        kv.measuredBytes == null
          ? "용량 미측정"
          : formatResourceBytes(kv.measuredBytes)
      }`
    : "ARCHIVE_KV binding 없음";

  els.resourceD1State.textContent = d1.bound
    ? `${Number(d1.totalRows || 0).toLocaleString("ko-KR")} rows`
    : "미연결";
  els.resourceD1Meta.textContent = d1.bound
    ? `${Number(d1.tableCount || 0).toLocaleString("ko-KR")} tables · ${
        d1.bytes == null
          ? "DB 파일크기 미지원"
          : formatResourceBytes(d1.bytes)
      }`
    : "USER_DB binding 없음";

  els.resourceR2State.textContent = r2.bound
    ? `${Number(r2.objectCount || 0).toLocaleString("ko-KR")} objects`
    : "미사용";
  els.resourceR2Meta.textContent = r2.bound
    ? `${formatResourceBytes(r2.bytes || 0)} · 현재 코드에서는 R2 미사용`
    : "ARCHIVE_BODY 미연결 · 현재 코드에서는 R2 미사용";

  renderResourceAnalytics(data);
  renderResourcePagesDeployments(data);
  renderD1DataHealth(data);

  els.resourceKvTotal.textContent = kv.bound
    ? `${Number(kv.keyCount || 0).toLocaleString("ko-KR")} keys${
        kv.measuredBytes == null
          ? ""
          : ` · ${formatResourceBytes(kv.measuredBytes)}`
      }`
    : "-";

  els.resourceD1Total.textContent = d1.bound
    ? `${Number(d1.totalRows || 0).toLocaleString("ko-KR")} rows`
    : "-";

  const categories = Array.isArray(kv.categories)
    ? kv.categories
    : [];

  els.resourceKvBreakdown.innerHTML = categories.length
    ? categories.map((row) => `
        <div class="resource-breakdown-row">
          <div>
            <strong>${escapeHtml(row.label || "-")}</strong>
            <span>${escapeHtml(row.purpose || "")}</span>
          </div>
          <div class="resource-breakdown-value">
            <b>${Number(row.keyCount || 0).toLocaleString("ko-KR")} key</b>
            <small>${
              row.bytes == null
                ? "용량 미측정"
                : escapeHtml(formatResourceBytes(row.bytes))
            }</small>
          </div>
        </div>
      `).join("")
    : `<div class="resource-empty">저장된 KV key가 없습니다.</div>`;

  const tables = Array.isArray(d1.tables)
    ? d1.tables
    : [];

  els.resourceD1Breakdown.innerHTML = tables.length
    ? tables.map((row) => `
        <div class="resource-breakdown-row">
          <div>
            <strong>${escapeHtml(row.label || row.name || "-")}</strong>
            <span>${escapeHtml(row.purpose || "")}</span>
          </div>
          <div class="resource-breakdown-value">
            <b>${Number(row.count || 0).toLocaleString("ko-KR")} row</b>
            <small>${escapeHtml(row.name || "")}</small>
          </div>
        </div>
      `).join("")
    : `<div class="resource-empty">D1 table 정보가 없습니다.</div>`;

  const profiles = Array.isArray(data?.operationProfile)
    ? data.operationProfile
    : [];

  els.resourceOperationBody.innerHTML = profiles.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.action || "-")}</strong></td>
      <td>${escapeHtml(row.kv || "-")}</td>
      <td>${escapeHtml(row.d1 || "-")}</td>
      <td>${escapeHtml(row.external || "-")}</td>
    </tr>
  `).join("");

  els.resourceFunctionsNote.textContent =
    data?.analytics?.connected
      ? "Workers Free 공식 한도 기준입니다. Pages Functions 100,000 requests/day · KV Read 100,000/day · KV Write/List 1,000/day · D1 Rows Read 5,000,000/day · Rows Written 100,000/day. 7일/30일은 일일 한도에 기간 일수를 곱해 비교합니다. Analytics 값은 billing counter와 완전히 같지는 않을 수 있습니다."
      : data?.functions?.note ||
        "Cloudflare Analytics 연결 상태를 확인해 주세요.";

  if (data?.measurement === "precise") {
    els.resourceMeasurementNotice.classList.add("is-precise");
    els.resourceMeasurementNotice.textContent =
      `KV 정밀 측정 완료 · 현재 ${Number(kv.keyCount || 0).toLocaleString("ko-KR")}개 key를 읽어 총 ${formatResourceBytes(kv.measuredBytes || 0)}를 계산했습니다.`;
  } else {
    els.resourceMeasurementNotice.classList.remove("is-precise");
    els.resourceMeasurementNotice.textContent =
      `빠른 조회 완료 · KV key ${Number(kv.keyCount || 0).toLocaleString("ko-KR")}개. 정확한 byte 측정은 현재 key 수만큼 KV get이 발생하므로 필요할 때만 정밀 측정을 실행하세요.`;
  }
}

async function loadResourceUsage(precise = false) {
  const refreshButton = els.resourceRefreshButton;
  if (!precise) resourcePagesVisibleLimit = 10;
  const preciseButton = els.resourcePreciseButton;

  if (refreshButton) refreshButton.disabled = true;
  if (preciseButton) preciseButton.disabled = true;

  if (els.resourceMessage) {
    els.resourceMessage.hidden = false;
    els.resourceMessage.textContent = precise
      ? "KV 값을 읽어 실제 저장 byte를 계산하고 있습니다…"
      : "리소스 상태를 확인하고 있습니다…";
  }

  try {
    const data = await api(
      `/api/admin/resources${precise ? "?precise=1" : ""}`
    );

    renderResourceUsage(data);

    if (els.resourceMessage) {
      els.resourceMessage.hidden = true;
    }

    return data;
  } finally {
    if (refreshButton) refreshButton.disabled = false;
    if (preciseButton) preciseButton.disabled = false;
  }
}

let duplicateDismissalsLoaded = false;
let duplicateDismissedPairs = new Set();

function duplicatePairKey(aKey, bKey) {
  return [String(aKey || ""), String(bKey || "")].sort().join("||");
}

async function ensureDuplicateDismissalsLoaded() {
  if (duplicateDismissalsLoaded) return;
  const data = await api("/api/admin/duplicate-dismissals", { method: "GET" });
  duplicateDismissedPairs = new Set(Array.isArray(data.pairs) ? data.pairs : []);
  duplicateDismissalsLoaded = true;
}

function normalizeDuplicateText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\s\p{P}\p{S}_]+/gu, "")
    .trim();
}

function normalizeDuplicateAuthor(value = "") {
  return normalizeDuplicateText(value)
    .replace(/^(?:작가|글|by)+/i, "");
}

function normalizeDuplicateUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function normalizeLooseDuplicateTitle(value = "") {
  let text = String(value || "").normalize("NFKC").trim();
  text = text
    .replace(/\s*[\[(【][^\])】]{0,24}(?:완결|완|연재중|연재|외전|번외|후기|에필로그|epilogue)[^\])】]{0,24}[\])】]\s*$/iu, "")
    .replace(/\s*[-–—·|:]\s*(?:완결|완|연재중|연재|외전|번외|후기|에필로그|epilogue)\s*$/iu, "")
    .trim();
  return normalizeDuplicateText(text);
}

function duplicateEntry(source, item, index) {
  const key = source === "postype"
    ? `postype:${String(item.id || item.rowNumber || index)}`
    : `drive:${String(item.id || index)}`;
  item._duplicateEntryKey = key;
  return {
    source,
    key,
    item,
    title: String(item.title || "").trim(),
    author: String(item.author || "").trim(),
    titleKey: normalizeDuplicateText(item.title),
    looseTitleKey: normalizeLooseDuplicateTitle(item.title),
    authorKey: normalizeDuplicateAuthor(item.author),
    urlKey: source === "postype" ? normalizeDuplicateUrl(item.url) : "",
  };
}

function addDuplicateMatch(entry, target, level, reason) {
  if (!entry || !target || entry.key === target.key) return;
  if (duplicateDismissedPairs.has(duplicatePairKey(entry.key, target.key))) return;
  const item = entry.item;
  if (!item._duplicate) item._duplicate = { level: "", matches: [] };
  const existing = item._duplicate.matches.find((match) => match.key === target.key);
  if (existing) {
    if (level === "confirmed") {
      existing.level = "confirmed";
      existing.reason = reason;
    }
  } else {
    item._duplicate.matches.push({
      key: target.key,
      source: target.source,
      id: String(target.item.id || target.item.rowNumber || ""),
      title: target.title,
      author: target.author,
      level,
      reason,
    });
  }
  if (level === "confirmed" || !item._duplicate.level) {
    item._duplicate.level = level;
  }
}

function rebuildDuplicateIndex() {
  [...postypeAdminItems, ...driveAdminItems].forEach((item) => {
    item._duplicate = { level: "", matches: [] };
  });

  const entries = [
    ...postypeAdminItems.map((item, index) => duplicateEntry("postype", item, index)),
    ...driveAdminItems.map((item, index) => duplicateEntry("drive", item, index)),
  ].filter((entry) => entry.titleKey || entry.urlKey);

  for (let i = 0; i < entries.length; i += 1) {
    const a = entries[i];
    for (let j = i + 1; j < entries.length; j += 1) {
      const b = entries[j];
      // Drive TXT와 POSTYPE은 서로 다른 콘텐츠 유형이므로 교차 소스는 중복 후보로 잡지 않는다.
      if (a.source !== b.source) continue;
      let level = "";
      let reason = "";

      if (a.urlKey && b.urlKey && a.urlKey === b.urlKey) {
        level = "confirmed";
        reason = "같은 POSTYPE URL";
      } else if (a.titleKey && a.titleKey === b.titleKey) {
        if (a.authorKey && b.authorKey && a.authorKey === b.authorKey) {
          level = "confirmed";
          reason = "제목·작가 일치";
        } else {
          level = "suspect";
          reason = a.authorKey && b.authorKey
            ? "제목 일치 · 작가 다름"
            : "제목 일치 · 작가 확인 필요";
        }
      } else if (
        a.looseTitleKey &&
        b.looseTitleKey &&
        a.looseTitleKey === b.looseTitleKey &&
        a.looseTitleKey.length >= 3
      ) {
        level = "suspect";
        reason = "제목 표기만 유사";
      }

      if (!level) continue;
      addDuplicateMatch(a, b, level, reason);
      addDuplicateMatch(b, a, level, reason);
    }
  }

  [...postypeAdminItems, ...driveAdminItems].forEach((item) => {
    if (!item._duplicate) return;
    item._duplicate.matches.sort((a, b) => {
      if (a.level !== b.level) return a.level === "confirmed" ? -1 : 1;
      return String(a.title).localeCompare(String(b.title), "ko", { numeric: true });
    });
  });
}

function isDuplicateItem(item) {
  return Boolean(item?._duplicate?.matches?.length);
}

function getDuplicateCounts(items = []) {
  const flagged = items.filter(isDuplicateItem);
  return {
    total: flagged.length,
    confirmed: flagged.filter((item) => item._duplicate?.level === "confirmed").length,
    suspect: flagged.filter((item) => item._duplicate?.level !== "confirmed").length,
  };
}

function renderDuplicateInfo(item) {
  const info = item?._duplicate;
  if (!info?.matches?.length) return "";

  const confirmed = info.level === "confirmed";
  const visible = info.matches.slice(0, 3);
  const rows = visible.map((match) => {
    const sourceLabel = match.source === "postype" ? "POSTYPE" : "Drive";
    const author = match.author ? ` · ${escapeHtml(match.author)}` : "";
    return `<div><b>${sourceLabel}</b> ${escapeHtml(match.title || "제목 없음")}${author}<small>${escapeHtml(match.reason || "중복 확인")}</small></div>`;
  }).join("");
  const more = info.matches.length > visible.length
    ? `<span class="duplicate-more">외 ${info.matches.length - visible.length}건</span>`
    : "";

  const dismissButton = !confirmed
    ? `<button type="button" class="duplicate-dismiss-button" data-duplicate-dismiss-key="${escapeHtml(item._duplicateEntryKey || "")}">중복 아님</button>`
    : "";

  return `
    <div class="duplicate-info ${confirmed ? "is-confirmed" : "is-suspect"}">
      <div class="duplicate-info-head"><span class="duplicate-badge">${confirmed ? "중복 확정" : "중복 의심"}</span>${dismissButton}</div>
      <div class="duplicate-matches">${rows}${more}</div>
    </div>`;
}

async function dismissDuplicateSuspicions(itemKey) {
  const item = [...postypeAdminItems, ...driveAdminItems].find((candidate) => candidate._duplicateEntryKey === itemKey);
  if (!item?._duplicate?.matches?.length) return;
  const pairs = item._duplicate.matches
    .filter((match) => match.level !== "confirmed")
    .map((match) => duplicatePairKey(itemKey, match.key));
  if (!pairs.length) return;

  const data = await api("/api/admin/duplicate-dismissals", {
    method: "POST",
    body: JSON.stringify({ pairs }),
  });
  duplicateDismissedPairs = new Set(Array.isArray(data.pairs) ? data.pairs : [...duplicateDismissedPairs, ...pairs]);
  rebuildDuplicateIndex();
  renderDriveAdminList();
  renderPostypeAdminList();
}

async function ensureDuplicateReferenceData(source) {
  try {
    await ensureDuplicateDismissalsLoaded();
    if (source !== "drive" && !driveAdminLoaded) {
      const driveData = await api("/api/admin/drive-items", { method: "GET" });
      driveAdminItems = mapDriveAdminItems(driveData.items || []);
      driveAdminLoaded = true;
    }
    if (source !== "postype" && !postypeAdminLoaded) {
      const postypeData = await api("/api/admin/postype-list", { method: "GET" });
      postypeAdminItems = mapPostypeAdminItems(postypeData.items || []);
      postypeAdminLoaded = true;
    }
  } catch (error) {
    console.warn("duplicate reference load failed", error);
  }
  rebuildDuplicateIndex();
}

function mapDriveAdminItems(items = []) {
  return items.map((item) => ({
    ...item,
    overrideContentType: String(item.overrideContentType || ""),
    draftOverrideContentType: String(item.overrideContentType || ""),
    overrideStatus: String(item.overrideStatus || ""),
    draftOverrideStatus: String(item.overrideStatus || ""),
  }));
}

function mapPostypeAdminItems(items = []) {
  return items.map((item) => ({
    ...item,
    latestPublishedDate: String(item.latestPublishedDate || ""),
    draftLatestPublishedDate: String(item.latestPublishedDate || ""),
    publishType: String(item.publishType || (["series", "manual"].includes(item.linkType) ? "다회차" : "단일글")),
    draftPublishType: String(item.publishType || (["series", "manual"].includes(item.linkType) ? "다회차" : "단일글")),
    status: String(item.status || "완결"),
    draftStatus: String(item.status || "완결"),
  }));
}

function getPostypeDirtyItems() {
  return postypeAdminItems.filter((item) =>
    String(item.draftLatestPublishedDate || "") !== String(item.latestPublishedDate || "") ||
    String(item.draftPublishType || "") !== String(item.publishType || "") ||
    String(item.draftStatus || "") !== String(item.status || "")
  );
}

function updatePostypeAdminCounts() {
  const missing = postypeAdminItems.filter(
    (item) => !String(item.draftLatestPublishedDate || "").trim()
  ).length;
  const dirty = getPostypeDirtyItems().length;

  if (els.postypeListCount) {
    els.postypeListCount.textContent = postypeAdminItems.length.toLocaleString("ko-KR") + "개";
  }
  if (els.postypeMissingDateCount) {
    els.postypeMissingDateCount.textContent = missing.toLocaleString("ko-KR") + "개";
  }
  if (els.postypeDirtyCount) {
    els.postypeDirtyCount.textContent = dirty.toLocaleString("ko-KR") + "개";
  }
  if (els.postypeDuplicateCount) {
    const duplicateCounts = getDuplicateCounts(postypeAdminItems);
    els.postypeDuplicateCount.textContent = `${duplicateCounts.total.toLocaleString("ko-KR")}개`;
    els.postypeDuplicateCount.title = `확정 ${duplicateCounts.confirmed.toLocaleString("ko-KR")} · 의심 ${duplicateCounts.suspect.toLocaleString("ko-KR")}`;
  }
}

function formatContentTypeLabel(value) {
  return String(value || "") === "연재물" ? "연재" : String(value || "");
}

function formatDriveFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  return `${(size / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} KB`;
}

function getDriveDirtyItems() {
  return driveAdminItems.filter(
    (item) =>
      String(item.draftOverrideContentType || "") !==
        String(item.overrideContentType || "") ||
      String(item.draftOverrideStatus || "") !==
        String(item.overrideStatus || "")
  );
}

function updateDriveAdminCounts() {
  if (els.driveListCount) {
    els.driveListCount.textContent =
      `${driveAdminItems.length.toLocaleString("ko-KR")}개`;
  }
  if (els.driveOverrideCount) {
    els.driveOverrideCount.textContent =
      `${driveAdminItems.filter((item) => item.overrideContentType || item.overrideStatus).length.toLocaleString("ko-KR")}개`;
  }
  if (els.driveMismatchCount) {
    els.driveMismatchCount.textContent =
      `${driveAdminItems.filter(isDriveFolderMismatch).length.toLocaleString("ko-KR")}개`;
  }
  if (els.driveDirtyCount) {
    els.driveDirtyCount.textContent =
      `${getDriveDirtyItems().length.toLocaleString("ko-KR")}개`;
  }
  if (els.driveDuplicateCount) {
    const duplicateCounts = getDuplicateCounts(driveAdminItems);
    els.driveDuplicateCount.textContent = `${duplicateCounts.total.toLocaleString("ko-KR")}개`;
    els.driveDuplicateCount.title = `확정 ${duplicateCounts.confirmed.toLocaleString("ko-KR")} · 의심 ${duplicateCounts.suspect.toLocaleString("ko-KR")}`;
  }
}

function isDriveFolderMismatch(item) {
  const folderExpected =
    item.folderType === "장편"
      ? "연재물"
      : item.folderType === "단편"
        ? "단편"
        : "";

  return Boolean(
    folderExpected &&
    folderExpected !== item.autoContentType
  );
}

function getFilteredDriveAdminItems() {
  if (driveAdminFilter === "manual") {
    return driveAdminItems.filter(
      (item) => Boolean(item.overrideContentType || item.overrideStatus)
    );
  }

  if (driveAdminFilter === "mismatch") {
    return driveAdminItems.filter(isDriveFolderMismatch);
  }

  if (driveAdminFilter === "dirty") {
    return getDriveDirtyItems();
  }

  if (driveAdminFilter === "duplicate") {
    return driveAdminItems.filter(isDuplicateItem);
  }

  return driveAdminItems;
}

function syncDriveSummaryFilterButtons() {
  els.driveSummaryFilters?.querySelectorAll("[data-drive-filter]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.driveFilter === driveAdminFilter
    );
  });
}

function getDriveFilterLabel() {
  if (driveAdminFilter === "manual") return "수동 지정";
  if (driveAdminFilter === "mismatch") return "기존 폴더와 자동판정 불일치";
  if (driveAdminFilter === "dirty") return "수정 대기";
  if (driveAdminFilter === "duplicate") return "중복 확인";
  return "전체";
}

function renderDrivePagination(totalItems) {
  if (!els.driveListPagination) return;

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / DRIVE_ADMIN_PAGE_SIZE)
  );

  driveAdminPage = Math.max(
    1,
    Math.min(driveAdminPage, totalPages)
  );

  if (totalItems <= DRIVE_ADMIN_PAGE_SIZE) {
    els.driveListPagination.hidden = true;
    els.driveListPagination.innerHTML = "";
    return;
  }

  const buttons = [];
  const addPage = (page) => {
    buttons.push(
      `<button type="button" class="postype-library-page-button ${page === driveAdminPage ? "active" : ""}" data-drive-page="${page}" ${page === driveAdminPage ? 'aria-current="page"' : ""}>${page}</button>`
    );
  };
  const addEllipsis = () =>
    buttons.push(
      `<span class="postype-library-page-ellipsis">…</span>`
    );

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) {
      addPage(page);
    }
  } else {
    addPage(1);
    if (driveAdminPage > 4) addEllipsis();

    const start = Math.max(2, driveAdminPage - 1);
    const end = Math.min(
      totalPages - 1,
      driveAdminPage + 1
    );
    for (let page = start; page <= end; page += 1) {
      addPage(page);
    }

    if (driveAdminPage < totalPages - 3) addEllipsis();
    addPage(totalPages);
  }

  els.driveListPagination.hidden = false;
  els.driveListPagination.innerHTML =
    `<button type="button" class="postype-library-page-button" data-drive-page-prev ${driveAdminPage <= 1 ? "disabled" : ""} aria-label="이전 페이지">‹</button>` +
    buttons.join("") +
    `<button type="button" class="postype-library-page-button" data-drive-page-next ${driveAdminPage >= totalPages ? "disabled" : ""} aria-label="다음 페이지">›</button>` +
    `<span class="postype-library-page-info">${driveAdminPage} / ${totalPages} · 페이지당 ${DRIVE_ADMIN_PAGE_SIZE}개</span>`;
}

function renderDriveAdminList() {
  if (!els.driveListBody) return;

  const filteredItems = getFilteredDriveAdminItems();
  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / DRIVE_ADMIN_PAGE_SIZE)
  );

  driveAdminPage = Math.max(
    1,
    Math.min(driveAdminPage, totalPages)
  );

  const startIndex =
    (driveAdminPage - 1) * DRIVE_ADMIN_PAGE_SIZE;

  const pageItems = filteredItems.slice(
    startIndex,
    startIndex + DRIVE_ADMIN_PAGE_SIZE
  );

  els.driveListEmpty.hidden = filteredItems.length !== 0;
  els.driveListEmpty.textContent =
    driveAdminFilter === "all"
      ? "Drive TXT 파일이 없습니다."
      : `${getDriveFilterLabel()} 조건에 해당하는 파일이 없습니다.`;

  els.driveListBody.innerHTML = pageItems.map((item) => {
    const dirty =
      String(item.draftOverrideContentType || "") !==
      String(item.overrideContentType || "");

    const folderExpected =
      item.folderType === "장편"
        ? "연재물"
        : item.folderType === "단편"
          ? "단편"
          : "";

    const mismatch =
      folderExpected &&
      folderExpected !== item.autoContentType;

    const selected =
      item.draftOverrideContentType || "auto";
    const appliedContentType =
      item.draftOverrideContentType || item.autoContentType;
    const selectedStatus =
      appliedContentType === "단편"
        ? "완결"
        : (item.draftOverrideStatus || "완결");

    return `
      <tr data-drive-id="${escapeHtml(item.id)}" class="${dirty ? "postype-library-row-dirty" : ""}">
        <td class="postype-library-title">
          ${escapeHtml(item.title || "제목 없음")}
          <div class="postype-library-sub">${escapeHtml(item.fileName || "")}</div>
          ${renderDuplicateInfo(item)}
        </td>
        <td>${escapeHtml(item.author || "-")}</td>
        <td>${escapeHtml(item.combination || "-")}</td>
        <td>
          ${escapeHtml(item.folderType || "-")}
          ${mismatch ? `<span class="drive-folder-mismatch">용량 자동판정과 다름</span>` : ""}
        </td>
        <td>${escapeHtml(formatDriveFileSize(item.size))}</td>
        <td><span class="drive-auto-badge">${escapeHtml(formatContentTypeLabel(item.autoContentType))}</span></td>
        <td>
          <select data-drive-content-type>
            <option value="auto"${selected === "auto" ? " selected" : ""}>자동 · ${escapeHtml(formatContentTypeLabel(item.autoContentType))}</option>
            <option value="단편"${selected === "단편" ? " selected" : ""}>단편 고정</option>
            <option value="연재물"${selected === "연재물" ? " selected" : ""}>연재 고정</option>
          </select>
        </td>
        <td>
          <select data-drive-status ${appliedContentType === "단편" ? "disabled" : ""}>
            <option value="완결"${selectedStatus === "완결" ? " selected" : ""}>완결</option>
            <option value="연재"${selectedStatus === "연재" ? " selected" : ""}>연재중</option>
          </select>
        </td>
      </tr>`;
  }).join("");

  renderDrivePagination(filteredItems.length);
  updateDriveAdminCounts();
  syncDriveSummaryFilterButtons();
}


function textHealthStatusLabel(status) {
  if (status === "error") return "검사 실패";
  if (status === "severe") return "심각";
  if (status === "suspect") return "확인 필요";
  return "정상";
}

function renderTextHealth(data = {}) {
  const summary = data.summary || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const total = Number(summary.total || 0);
  const checked = Number(summary.checked || 0);
  const pending = Number(summary.pending || 0);
  const errors = Number(summary.errors || 0);

  if (els.textHealthChecked) els.textHealthChecked.textContent = `${checked.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")}`;
  if (els.textHealthNormal) els.textHealthNormal.textContent = Number(summary.normal || 0).toLocaleString("ko-KR");
  if (els.textHealthSuspect) els.textHealthSuspect.textContent = Number(summary.suspect || 0).toLocaleString("ko-KR");
  if (els.textHealthSevere) els.textHealthSevere.textContent = Number(summary.severe || 0).toLocaleString("ko-KR");

  if (els.textHealthEmpty) {
    els.textHealthEmpty.hidden = items.length !== 0 || checked === 0;
    if (checked > 0 && pending === 0 && items.length === 0) {
      els.textHealthEmpty.textContent = "검사한 TXT에서 깨짐 의심 패턴을 찾지 못했습니다.";
    }
  }

  if (els.textHealthList) {
    els.textHealthList.innerHTML = items.map((item) => `
      <article class="text-health-item is-${escapeHtml(item.status || "suspect")}">
        <div class="text-health-item-head">
          <div>
            <strong>${escapeHtml(item.title || item.fileName || "제목 없음")}</strong>
            <span>${escapeHtml(item.author || "-")} · ${escapeHtml(item.combination || "-")} · ${escapeHtml(item.lengthType || "-")}</span>
          </div>
          <span class="text-health-badge">${escapeHtml(textHealthStatusLabel(item.status))} · ${Number(item.score || 0)}점</span>
        </div>
        <div class="text-health-meta">${escapeHtml(item.fileName || "")} · ${escapeHtml(item.encoding || "인코딩 미확인")}</div>
        <div class="text-health-reasons">${(item.reasons || []).map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div>
        ${item.sample ? `<pre class="text-health-sample">${escapeHtml(item.sample)}</pre>` : ""}
        <div class="text-health-actions">
          ${item.status === "error"
            ? `<span class="text-health-retry-note">다음 전체 검사에서 다시 시도합니다.</span>`
            : `<button type="button" class="text-health-normal-button" data-text-health-normal="${escapeHtml(item.id || "")}" data-text-health-modified="${escapeHtml(item.modifiedTime || "")}">정상으로 확인</button>`}
        </div>
      </article>`).join("");
  }

  if (els.textHealthProgress && !els.textHealthScanButton?.disabled) {
    if (!checked) {
      els.textHealthProgress.textContent = "아직 검사하지 않았습니다. ‘전체 검사’를 누르면 TXT를 소량 배치로 나눠 확인합니다.";
    } else if (pending > 0) {
      els.textHealthProgress.textContent = `검사 완료 ${checked.toLocaleString("ko-KR")}개 · 변경/미검사 ${pending.toLocaleString("ko-KR")}개 남음${errors ? ` · 검사 실패 ${errors.toLocaleString("ko-KR")}개` : ""}`;
    } else if (errors > 0) {
      els.textHealthProgress.textContent = `검사 가능한 파일 확인 완료 · 일시적 검사 실패 ${errors.toLocaleString("ko-KR")}개 · 다음 전체 검사에서 재시도`;
    } else {
      const when = summary.lastCheckedAt ? formatAdminDateTime(summary.lastCheckedAt) : "-";
      els.textHealthProgress.textContent = `전체 검사 완료 · 마지막 검사 ${when}`;
    }
  }
}

async function loadTextHealth() {
  if (!els.textHealthList) return;
  const data = await api("/api/admin/text-health", { method: "GET" });
  renderTextHealth(data);
  textHealthLoaded = true;
  return data;
}

async function runTextHealthScan() {
  if (!els.textHealthScanButton) return;
  els.textHealthScanButton.disabled = true;
  els.textHealthScanButton.textContent = "검사 중…";
  let totalProcessed = 0;
  const scanRunId = globalThis.crypto?.randomUUID?.() || `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    while (true) {
      const data = await api("/api/admin/text-health", {
        method: "POST",
        body: JSON.stringify({ limit: 12, scanRunId }),
      });
      totalProcessed += Number(data.processed || 0);
      renderTextHealth(data);
      if (els.textHealthProgress) {
        const summary = data.summary || {};
        els.textHealthProgress.textContent = data.done
          ? `검사 완료 · 이번 실행 ${totalProcessed.toLocaleString("ko-KR")}개 확인`
          : `검사 중… ${Number(summary.checked || 0).toLocaleString("ko-KR")} / ${Number(summary.total || 0).toLocaleString("ko-KR")} · 남은 파일 ${Number(data.remaining || 0).toLocaleString("ko-KR")}개`;
      }
      if (data.done || Number(data.processed || 0) <= 0) break;
    }
    textHealthLoaded = true;
  } finally {
    els.textHealthScanButton.disabled = false;
    els.textHealthScanButton.textContent = "전체 검사";
    const latest = await loadTextHealth().catch(() => null);
    if (latest) renderTextHealth(latest);
  }
}

async function confirmTextHealthNormal(id, modifiedTime, button) {
  if (!id) return;
  if (button) {
    button.disabled = true;
    button.textContent = "저장 중…";
  }
  try {
    const data = await api("/api/admin/text-health", {
      method: "PATCH",
      body: JSON.stringify({ id, modifiedTime }),
    });
    renderTextHealth(data);
    if (els.textHealthProgress) {
      els.textHealthProgress.textContent = "정상 파일로 확인했습니다. 파일이 수정되면 자동으로 다시 검사합니다.";
    }
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "정상으로 확인";
    }
    throw error;
  }
}

function formatAdminDateTime(value) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return date.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

const AUTO_SYNC_STALE_MS = 15 * 60 * 1000;

function isAutoSyncRunningStale(status) {
  if (status?.state !== "running") return false;
  const heartbeat = Date.parse(status.checkedAt || status.startedAt || "");
  return Number.isFinite(heartbeat) && Date.now() - heartbeat > AUTO_SYNC_STALE_MS;
}

function formatAutoSyncResult(source, status) {
  if (!status) return "아직 실행 없음";
  if (isAutoSyncRunningStale(status)) return "15분 이상 상태 갱신 없음 · 다시 실행해 주세요";
  if (status.state === "running") {
    if (source === "postype") {
      return `확인 중 · 시리즈 ${Number(status.processedSeries || 0).toLocaleString("ko-KR")}개 처리`;
    }
    return "Drive 변경사항 확인 중";
  }
  if (status.state === "error") return `실패 · ${status.error || "오류 확인 필요"}`;
  if (status.state === "warning") {
    const pendingRemoved = Number(status.candidateRemovedCount || 0);
    return status.warning || (pendingRemoved > 0
      ? `자동 반영 보류 · 삭제 후보 ${pendingRemoved.toLocaleString("ko-KR")}개`
      : "자동 반영 보류 · 관리자 확인 필요");
  }

  if (source === "postype") {
    const updated = Number(status.updatedLatestDates || 0);
    const checked = Number(status.processedSeries || status.totalSeries || 0);
    const failed = Number(status.failedSeries || 0);
    if (status.state === "partial" || failed > 0) {
      return `발행일 ${updated}개 갱신 · 확인 필요 ${failed}개 · 시리즈 ${checked}개 확인`;
    }
    return updated > 0 || status.changed
      ? `발행일 ${updated}개 갱신 · 목록 반영 완료`
      : `변경 없음 · 시리즈 ${checked}개 확인`;
  }

  const added = Number(status.addedCount || 0);
  const updated = Number(status.updatedCount || 0);
  const removed = Number(status.removedCount || 0);
  return added || updated || removed
    ? `추가 ${added} · 수정 ${updated} · 삭제 ${removed}`
    : "변경 없음";
}

function renderPostypeAutoSyncFailures(status) {
  const details = Array.isArray(status?.failureDetails) ? status.failureDetails : [];
  const failedCount = Number(status?.failedSeries || 0);
  const visible = failedCount > 0;

  if (els.postypeAutoSyncFailures) {
    els.postypeAutoSyncFailures.hidden = !visible;
    if (!visible) els.postypeAutoSyncFailures.open = false;
  }
  if (els.postypeAutoSyncFailureCount) {
    els.postypeAutoSyncFailureCount.textContent = `${failedCount.toLocaleString("ko-KR")}개`;
  }
  if (!els.postypeAutoSyncFailureList) return;

  if (!visible) {
    els.postypeAutoSyncFailureList.innerHTML = "";
    return;
  }
  if (!details.length) {
    els.postypeAutoSyncFailureList.innerHTML = '<p class="auto-sync-failure-legacy">상세 사유는 v8.90 이후 실행부터 기록됩니다. 「지금 실행」 후 다시 확인해주세요.</p>';
    return;
  }

  els.postypeAutoSyncFailureList.innerHTML = details.map((item) => {
    const title = escapeHtml(item?.title || item?.id || "시리즈");
    const id = escapeHtml(item?.id || "");
    const reason = escapeHtml(item?.reason || "최근 발행일을 확인하지 못했습니다.");
    const url = String(item?.url || "").trim();
    const safeUrl = /^https:\/\/(?:www\.)?postype\.com\//i.test(url) ? escapeHtml(url) : "";
    return `
      <article class="auto-sync-failure-item">
        <div class="auto-sync-failure-copy">
          <strong>${title}</strong>
          ${id && id !== title ? `<small>${id}</small>` : ""}
          <p>${reason}</p>
        </div>
        ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">시리즈 열기 ↗</a>` : ""}
      </article>`;
  }).join("");
}

function renderAutoSyncStatus(data, setup = autoSyncSetupState) {
  const tokenConfigured = Boolean(data?.tokenConfigured);
  const installed = Boolean(setup?.installed);
  const scheduleReady = tokenConfigured && installed;

  const renderOne = (source, status, stateEl, lastEl, resultEl, setupButton) => {
    if (stateEl) {
      stateEl.classList.remove("is-ready", "is-warning", "is-running", "is-error");
      if (isAutoSyncRunningStale(status)) {
        stateEl.textContent = "중단됨 · 다시 실행";
        stateEl.classList.add("is-warning");
      } else if (status?.state === "running") {
        stateEl.textContent = "동기화 중";
        stateEl.classList.add("is-running");
      } else if (status?.state === "error") {
        stateEl.textContent = "최근 실행 오류";
        stateEl.classList.add("is-error");
      } else if (status?.state === "warning") {
        stateEl.textContent = "확인 필요";
        stateEl.classList.add("is-warning");
      } else if (scheduleReady) {
        stateEl.textContent = "예약 연결됨";
        stateEl.classList.add("is-ready");
      } else {
        stateEl.textContent = tokenConfigured ? "예약 파일 설정 필요" : "자동 실행 토큰 설정 필요";
        stateEl.classList.add("is-warning");
      }
    }
    if (lastEl) lastEl.textContent = status?.lastScheduledAt
      ? formatAdminDateTime(status.lastScheduledAt)
      : "아직 없음";
    if (resultEl) resultEl.textContent = formatAutoSyncResult(source, status);
    if (setupButton) {
      setupButton.textContent = installed ? "예약 갱신" : "예약 설정";
      setupButton.title = tokenConfigured
        ? "GitHub Actions 예약 파일을 설치하거나 갱신합니다."
        : "Cloudflare Secret AUTO_SYNC_TOKEN 설정 후 GitHub 예약 파일을 설치하세요.";
    }
  };

  renderOne(
    "postype", data?.postype,
    els.postypeAutoSyncState, els.postypeAutoSyncLast,
    els.postypeAutoSyncResult, els.postypeAutoSyncSetupButton
  );
  renderPostypeAutoSyncFailures(data?.postype);
  renderOne(
    "drive", data?.drive,
    els.driveAutoSyncState, els.driveAutoSyncLast,
    els.driveAutoSyncResult, els.driveAutoSyncSetupButton
  );
}

async function loadAutoSyncStatus() {
  const [status, setup] = await Promise.all([
    api("/api/admin/auto-sync", { method: "GET" }),
    api("/api/admin/auto-sync-setup", { method: "GET" }).catch(() => null),
  ]);
  autoSyncSetupState = setup;
  autoSyncStatusLoaded = true;
  renderAutoSyncStatus(status, setup);
  return status;
}

async function runAutoSyncNow(source, button) {
  if (!button) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "확인 중…";
  try {
    if (source === "postype") {
      let cursor = 0;
      for (let step = 0; step < 40; step += 1) {
        const data = await api("/api/admin/auto-sync", {
          method: "POST",
          body: JSON.stringify({ source: "postype", cursor }),
        });
        button.textContent = data.done
          ? "반영 중…"
          : `확인 ${Number(data.nextCursor || 0).toLocaleString("ko-KR")}…`;
        if (data.done) break;
        if (!Number.isFinite(Number(data.nextCursor))) throw new Error("다음 자동동기화 위치를 확인할 수 없습니다.");
        cursor = Number(data.nextCursor);
        if (step === 39) throw new Error("POSTYPE 자동동기화 배치 안전 한도를 초과했습니다.");
      }
      await loadPostypeAdminList(false);
    } else {
      await api("/api/admin/auto-sync", {
        method: "POST",
        body: JSON.stringify({ source: "drive" }),
      });
      await loadDriveAdminList();
    }
    await loadAutoSyncStatus();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function installAutoSyncSchedule(button) {
  if (!button) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "설정 중…";
  try {
    const data = await api("/api/admin/auto-sync-setup", {
      method: "POST",
      body: "{}",
    });
    autoSyncSetupState = { ...autoSyncSetupState, installed: true };
    await loadAutoSyncStatus();
    const secretGuide = data.tokenConfigured
      ? "GitHub 저장소의 Actions Secret ARCHIVE_AUTO_SYNC_TOKEN에 Cloudflare의 AUTO_SYNC_TOKEN과 같은 값을 등록하면 예약 실행이 시작됩니다."
      : "Cloudflare Pages Secret AUTO_SYNC_TOKEN과 GitHub Actions Secret ARCHIVE_AUTO_SYNC_TOKEN을 같은 값으로 각각 1회 설정해야 예약 실행이 시작됩니다.";
    window.alert(`자동동기화 예약 파일을 설치했습니다.\n\n${secretGuide}\n\n포스타입 23:00 · 드라이브 23:10 (KST)`);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function renderDriveLastSyncStatus(lastSync) {
  if (!els.driveLastSyncStatus) return;
  if (!lastSync) {
    els.driveLastSyncStatus.innerHTML = `<strong>마지막 동기화</strong><span>기록 없음</span>`;
    return;
  }
  const added = Number(lastSync.addedCount || 0);
  const updated = Number(lastSync.updatedCount || 0);
  const removed = Number(lastSync.removedCount || 0);
  const warning = lastSync?.state === "warning"
    ? String(lastSync.warning || "동기화 반영 보류 · 관리자 확인 필요")
    : "";
  els.driveLastSyncStatus.innerHTML = `
    <strong>마지막 동기화</strong>
    <span>${escapeHtml(formatAdminDateTime(lastSync.checkedAt || lastSync.syncedAt))}</span>
    <em>${warning ? `확인 필요 · ${escapeHtml(warning)}` : `추가 ${added} · 수정 ${updated} · 삭제 ${removed}`}</em>`;
}

async function loadDriveAdminList() {
  if (!els.driveListBody) return;

  els.driveListMessage.hidden = false;
  els.driveListMessage.textContent = "Drive 작품형태 목록을 불러오는 중입니다…";

  const data = await api("/api/admin/drive-items", {
    method: "GET",
  });

  driveAdminItems = mapDriveAdminItems(data.items || []);
  renderDriveLastSyncStatus(data.lastSync || null);

  driveAdminPage = 1;
  driveAdminFilter = "all";
  driveAdminLoaded = true;
  await ensureDuplicateReferenceData("drive");
  renderDriveAdminList();
  if (postypeAdminLoaded) renderPostypeAdminList();

  els.driveListMessage.textContent =
    `용량 자동판정 기준 ${Number(data.thresholdKb || 200)}KB · ` +
    `${driveAdminItems.length.toLocaleString("ko-KR")}개 불러오기 완료`;
}

async function saveDriveAdminChanges() {
  const dirtyItems = getDriveDirtyItems();

  if (!dirtyItems.length) {
    els.driveListMessage.hidden = false;
    els.driveListMessage.textContent = "저장할 변경사항이 없습니다.";
    return;
  }

  els.driveTypeSaveButton.disabled = true;
  els.driveListMessage.hidden = false;
  els.driveListMessage.textContent =
    `${dirtyItems.length.toLocaleString("ko-KR")}개 작품형태를 저장하는 중입니다…`;

  try {
    // 저장 도중 사용자가 다시 선택을 바꿔도, 실제 서버로 보낸 값만
    // '저장 완료' 기준값으로 반영한다. 이후 편집은 미저장 상태로 남는다.
    const submittedUpdates = dirtyItems.map((item) => ({
      id: item.id,
      contentType: item.draftOverrideContentType || "auto",
      status: item.draftOverrideStatus || "auto",
    }));
    const submittedById = new Map(submittedUpdates.map((item) => [item.id, item]));

    const data = await api("/api/admin/drive-items", {
      method: "POST",
      body: JSON.stringify({ updates: submittedUpdates }),
    });

    dirtyItems.forEach((item) => {
      const submitted = submittedById.get(item.id);
      if (!submitted) return;
      item.overrideContentType =
        submitted.contentType === "auto" ? "" : submitted.contentType;
      item.contentType =
        item.overrideContentType ||
        item.autoContentType;
      item.overrideStatus =
        item.contentType === "연재물" && submitted.status !== "auto"
          ? submitted.status
          : "";
      item.status =
        item.contentType === "연재물"
          ? (item.overrideStatus || "완결")
          : "완결";
    });

    renderDriveAdminList();

    els.driveListMessage.textContent =
      data.kvWritten
        ? `${Number(data.changedCount || 0).toLocaleString("ko-KR")}개 변경 저장 완료 · 수동 지정 ${Number(data.overrideCount || 0).toLocaleString("ko-KR")}개`
        : "실제 변경사항이 없어 KV 쓰기를 생략했습니다.";
  } finally {
    els.driveTypeSaveButton.disabled = false;
  }
}

function getPostypeIdNumber(id) {
  const match = String(id || "").match(/(\d+)$/);
  return match ? Number(match[1]) : -1;
}

function getFilteredPostypeAdminItems() {
  if (postypeAdminFilter === "duplicate") {
    return postypeAdminItems.filter(isDuplicateItem);
  }
  return postypeAdminItems;
}

function syncPostypeDuplicateFilterButtons() {
  els.postypeDuplicateFilters?.querySelectorAll("[data-postype-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.postypeFilter === postypeAdminFilter);
  });
}

function getSortedPostypeAdminItems() {
  return [...getFilteredPostypeAdminItems()].sort((a, b) => {
    const aNumber = getPostypeIdNumber(a.id);
    const bNumber = getPostypeIdNumber(b.id);
    if (bNumber !== aNumber) return bNumber - aNumber;
    return String(b.id || "").localeCompare(String(a.id || ""), "ko", { numeric: true });
  });
}

function renderPostypePagination(totalItems) {
  if (!els.postypeListPagination) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / POSTYPE_ADMIN_PAGE_SIZE));
  postypeAdminPage = Math.max(1, Math.min(postypeAdminPage, totalPages));

  if (totalItems <= POSTYPE_ADMIN_PAGE_SIZE) {
    els.postypeListPagination.hidden = true;
    els.postypeListPagination.innerHTML = "";
    return;
  }

  const pageButtons = [];
  const addPage = (page) => {
    pageButtons.push(
      `<button type="button" class="postype-library-page-button ${page === postypeAdminPage ? "active" : ""}" data-postype-page="${page}" ${page === postypeAdminPage ? 'aria-current="page"' : ""}>${page}</button>`
    );
  };
  const addEllipsis = () => pageButtons.push(`<span class="postype-library-page-ellipsis">…</span>`);

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) addPage(page);
  } else {
    addPage(1);
    if (postypeAdminPage > 4) addEllipsis();

    const start = Math.max(2, postypeAdminPage - 1);
    const end = Math.min(totalPages - 1, postypeAdminPage + 1);
    for (let page = start; page <= end; page += 1) addPage(page);

    if (postypeAdminPage < totalPages - 3) addEllipsis();
    addPage(totalPages);
  }

  els.postypeListPagination.hidden = false;
  els.postypeListPagination.innerHTML =
    `<button type="button" class="postype-library-page-button" data-postype-page-prev ${postypeAdminPage <= 1 ? "disabled" : ""} aria-label="이전 페이지">‹</button>` +
    pageButtons.join("") +
    `<button type="button" class="postype-library-page-button" data-postype-page-next ${postypeAdminPage >= totalPages ? "disabled" : ""} aria-label="다음 페이지">›</button>` +
    `<span class="postype-library-page-info">${postypeAdminPage} / ${totalPages} · 페이지당 ${POSTYPE_ADMIN_PAGE_SIZE}개</span>`;
}

function renderPostypeAdminList() {
  if (!els.postypeListBody) return;

  const sortedItems = getSortedPostypeAdminItems();
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / POSTYPE_ADMIN_PAGE_SIZE));
  postypeAdminPage = Math.max(1, Math.min(postypeAdminPage, totalPages));
  const startIndex = (postypeAdminPage - 1) * POSTYPE_ADMIN_PAGE_SIZE;
  const pageItems = sortedItems.slice(startIndex, startIndex + POSTYPE_ADMIN_PAGE_SIZE);

  els.postypeListEmpty.hidden = sortedItems.length !== 0;
  els.postypeListEmpty.textContent = postypeAdminFilter === "duplicate"
    ? "중복으로 확인할 POSTYPE 작품이 없습니다."
    : "등록된 POSTYPE 작품이 없습니다.";
  els.postypeListBody.innerHTML = pageItems.map((item) => {
    const dirty =
      String(item.draftLatestPublishedDate || "") !== String(item.latestPublishedDate || "") ||
      String(item.draftPublishType || "") !== String(item.publishType || "") ||
      String(item.draftStatus || "") !== String(item.status || "");
    const subCp = [item.subCp1, item.subCp2].filter(Boolean).join(" / " );
    const contentType = item.draftPublishType === "다회차" ? "연재물" : "단편";
    return `
      <tr data-postype-id="${escapeHtml(item.id)}" class="${dirty ? "postype-library-row-dirty" : ""}">
        <td>${escapeHtml(item.id || "-")}</td>
        <td class="postype-library-title">${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title || "제목 없음")}</a>` : escapeHtml(item.title || "제목 없음")}<div class="postype-library-sub">${escapeHtml(item.genre || "-")}${item.enabled === "N" ? " · 숨김" : ""}</div>${renderDuplicateInfo(item)}</td>
        <td>${escapeHtml(item.author || "-")}</td>
        <td>${escapeHtml(item.combination || "-")}${subCp ? `<div class="postype-library-sub">${escapeHtml(subCp)}</div>` : ""}</td>
        <td><select data-postype-content-type><option value="단편"${contentType === "단편" ? " selected" : ""}>단편</option><option value="연재물"${contentType === "연재물" ? " selected" : ""}>연재</option></select></td>
        <td><select data-postype-status><option value="완결"${item.draftStatus === "완결" ? " selected" : ""}>완결</option><option value="연재"${item.draftStatus === "연재" ? " selected" : ""}>연재중</option></select></td>
        <td><input type="date" data-postype-date value="${escapeHtml(item.draftLatestPublishedDate || "")}" /></td>
        <td><a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noopener">열기 ↗</a></td>
        <td><button type="button" class="postype-library-date-fetch" data-postype-date-fetch>불러오기</button></td>
      </tr>`;
  }).join("");
  renderPostypePagination(sortedItems.length);
  updatePostypeAdminCounts();
  syncPostypeDuplicateFilterButtons();
}

async function loadPostypeAdminList(showMessage = false) {
  if (els.postypeListMessage) {
    els.postypeListMessage.hidden = false;
    els.postypeListMessage.textContent = "POSTYPE 시트에서 작품 목록을 불러오는 중입니다…";
  }

  const data = await api("/api/admin/postype-list", {
    method: "GET",
  });

  postypeAdminPage = 1;
  postypeAdminItems = mapPostypeAdminItems(data.items || []);
  postypeAdminFilter = "all";
  postypeAdminLoaded = true;
  await ensureDuplicateReferenceData("postype");
  renderPostypeAdminList();
  if (driveAdminLoaded) renderDriveAdminList();

  if (els.postypeListMessage) {
    if (data.headerAdded) {
      els.postypeListMessage.hidden = false;
      els.postypeListMessage.textContent = "Google Sheet에 latestPublishedDate 컬럼을 새로 추가했습니다.";
    } else if (showMessage) {
      els.postypeListMessage.hidden = false;
      els.postypeListMessage.textContent = "POSTYPE 목록을 새로 불러왔습니다.";
    } else {
      els.postypeListMessage.hidden = true;
    }
  }
}

async function fetchLatestPublishedDateForItem(item, button = null) {
  if (!item?.url) throw new Error("POSTYPE URL이 없습니다.");

  if (button) {
    button.disabled = true;
    button.textContent = "확인 중…";
  }

  try {
    const metaInput = item.linkType === "manual" && item.manualUrls
      ? item.manualUrls
      : item.url;
    const data = await fetchPostypeUrlMeta(metaInput, item.linkType || "");
    if (!data.latestPublishedDate) {
      throw new Error("공개 페이지에서 최근 발행일을 찾지 못했습니다.");
    }
    item.draftLatestPublishedDate = data.latestPublishedDate;
    return data.latestPublishedDate;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "불러오기";
    }
  }
}

function populatePostypeCpOptions(diagnostics = []) {
  const values = [...new Set((diagnostics || [])
    .map((item) => String(item?.combination || "").trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));

  const options = values.length
    ? values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")
    : `<option value="">Drive CP 폴더 없음</option>`;

  postypeCpOptionsHtml = options;

  els.postypeBulkRows?.querySelectorAll('[data-bulk-field="combination"]').forEach((select) => {
    const selected = select.value;
    select.innerHTML = options;
    if (selected && values.includes(selected)) select.value = selected;
  });
}

function splitPostypeUrls(value) {
  return [...new Set(String(value || "")
    .split(/[\s,;]+/)
    .map((url) => url.trim())
    .filter(Boolean))];
}

function getPostypeRowUrls(tr) {
  if (!tr) return [];

  const urls = Array.from(tr.querySelectorAll("[data-bulk-url]"))
    .flatMap((input) => splitPostypeUrls(input.value));

  return [...new Set(urls)];
}

function getPostypeRowUrlValue(tr) {
  return getPostypeRowUrls(tr).join("\n");
}

function invalidatePostypeRowMeta(tr) {
  if (!tr) return;
  delete tr.dataset.latestPublishedDate;
  delete tr.dataset.metaUrl;
  delete tr.dataset.metaLinkType;
  delete tr.dataset.latestPostUrl;
}

function addPostypeUrlInput(tr, value = "", focus = true) {
  const list = tr?.querySelector("[data-bulk-url-list]");
  if (!list) return null;

  const current = list.querySelectorAll("[data-bulk-url]").length;
  if (current >= 20) {
    window.alert("한 작품에는 최대 20개 링크까지 등록할 수 있습니다.");
    return null;
  }

  const row = document.createElement("div");
  row.className = "postype-bulk-url-row";
  row.innerHTML =
    `<input type="text" data-bulk-url placeholder="POSTYPE URL" value="${escapeHtml(value)}" />` +
    `<button class="postype-bulk-url-remove" type="button" data-bulk-url-remove aria-label="이 링크 삭제">×</button>`;

  list.appendChild(row);
  const input = row.querySelector("[data-bulk-url]");
  if (focus) input?.focus();
  return input;
}

function detectPostypeConnection(urlValue) {
  const urls = splitPostypeUrls(urlValue);
  if (urls.length > 1) return { linkType: "manual", publishType: "다회차", urls };
  const url = urls[0] || "";
  if (/\/series\/\d+(?:[/?#]|$)/i.test(url)) return { linkType: "series", publishType: "다회차", urls };
  return { linkType: "post", publishType: "단일글", urls };
}

async function fetchSinglePostypeUrlMeta(url, linkType = "") {
  const value = String(url || "").trim();
  if (!value) throw new Error("포스타입 URL을 입력해 주세요.");
  return api("/api/admin/postype-url-meta", {
    method: "POST",
    body: JSON.stringify({ url: value, linkType: String(linkType || "").trim() }),
  });
}

async function fetchPostypeUrlMeta(urlValue, linkType = "") {
  const detected = detectPostypeConnection(urlValue);
  const effectiveLinkType = linkType || detected.linkType;
  if (effectiveLinkType !== "manual") return fetchSinglePostypeUrlMeta(detected.urls[0] || urlValue, effectiveLinkType);
  if (!detected.urls.length) throw new Error("포스타입 URL을 입력해 주세요.");
  if (detected.urls.length > 20) throw new Error("수동묶음은 한 작품당 최대 20개 URL까지 등록할 수 있습니다.");

  const results = [];
  for (const url of detected.urls) results.push(await fetchSinglePostypeUrlMeta(url, "post"));
  const dated = results.filter((item) => item?.latestPublishedDate)
    .sort((a, b) => String(a.latestPublishedDate).localeCompare(String(b.latestPublishedDate)));
  const latest = dated.at(-1) || results[0] || {};
  const first = results.find((item) => item?.title || item?.author) || results[0] || {};
  return {
    ...first,
    latestPublishedDate: latest.latestPublishedDate || "",
    latestPostUrl: latest.url || latest.latestPostUrl || detected.urls.at(-1) || detected.urls[0],
    manualUrls: detected.urls,
    mode: "manual",
    strategy: "manual-post-list-latest",
  };
}

function applyBulkConnectionFromUrl(tr) {
  if (!tr) return null;
  const urlValue = getPostypeRowUrlValue(tr);
  const detected = detectPostypeConnection(urlValue);
  const contentTypeSelect = tr.querySelector('[data-bulk-field="contentType"]');
  if (contentTypeSelect) {
    if (detected.publishType === "다회차") {
      contentTypeSelect.value = "연재물";
    } else if (tr.dataset.contentTypeTouched !== "1") {
      contentTypeSelect.value = "단편";
    }
  }
  tr.dataset.linkType = detected.linkType;
  return detected;
}

async function fillBulkRowFromUrl(tr) {
  if (!tr) return false;
  const titleInput = tr.querySelector('[data-bulk-field="title"]');
  const authorInput = tr.querySelector('[data-bulk-field="author"]');
  const button = tr.querySelector("[data-bulk-meta]");
  const urlValue = getPostypeRowUrlValue(tr);
  if (!urlValue) return false;

  if (button) { button.disabled = true; button.textContent = "확인 중…"; }
  try {
    const detected = applyBulkConnectionFromUrl(tr);
    const data = await fetchPostypeUrlMeta(urlValue, detected?.linkType || "post");
    if (data.title && titleInput) titleInput.value = data.title;
    if (data.author && authorInput) authorInput.value = data.author;
    tr.dataset.latestPublishedDate = data.latestPublishedDate || "";
    tr.dataset.metaUrl = urlValue;
    tr.dataset.metaLinkType = detected?.linkType || "post";
    tr.dataset.latestPostUrl = data.latestPostUrl || "";
    return Boolean(data.title || data.author || data.latestPublishedDate);
  } finally {
    if (button) { button.disabled = false; button.textContent = "불러오기"; }
  }
}

function addPostypeBulkRows(count = 3) {
  if (!els.postypeBulkRows) return;
  const currentCount = els.postypeBulkRows.querySelectorAll("tr").length;
  for (let index = 0; index < count; index += 1) {
    const rowNumber = currentCount + index + 1;
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class="bulk-row-number">${rowNumber}</td>` +
      `<td><input type="text" data-bulk-field="title" placeholder="작품 제목" /></td>` +
      `<td class="bulk-author-cell"><input type="text" data-bulk-field="author" placeholder="작가명" /></td>` +
      `<td><select data-bulk-field="combination"></select></td>` +
      `<td><input type="text" data-bulk-field="subCp1" placeholder="없으면 비워두기" /></td>` +
      `<td><input type="text" data-bulk-field="subCp2" placeholder="없으면 비워두기" /></td>` +
      `<td><select data-bulk-field="contentType"><option value="단편">단편</option><option value="연재물">연재</option></select></td>` +
      `<td><select data-bulk-field="status"><option value="완결">완결</option><option value="연재">연재중</option></select></td>` +
      `<td class="postype-bulk-url-cell">` +
      `<div class="postype-bulk-url-list" data-bulk-url-list>` +
      `<div class="postype-bulk-url-row is-primary"><input type="text" data-bulk-url placeholder="POSTYPE URL" /></div>` +
      `</div>` +
      `<button class="postype-bulk-url-add" type="button" data-bulk-url-add aria-label="링크 입력칸 추가">+ 링크</button>` +
      `</td>` +
      `<td><div class="postype-bulk-row-actions">` +
      `<button class="postype-bulk-meta" type="button" data-bulk-meta>불러오기</button>` +
      `<button class="postype-bulk-remove" type="button" data-bulk-remove aria-label="행 삭제">×</button>` +
      `</div></td>`;
    els.postypeBulkRows.appendChild(tr);
    const cpSelect = tr.querySelector('[data-bulk-field="combination"]');
    if (cpSelect) cpSelect.innerHTML = postypeCpOptionsHtml || `<option value="">CP 불러오는 중…</option>`;
  }
}

function renumberPostypeBulkRows() {
  els.postypeBulkRows?.querySelectorAll("tr").forEach((tr, index) => {
    const cell = tr.querySelector(".bulk-row-number");
    if (cell) cell.textContent = String(index + 1);
  });
}

function clearPostypeBulkRows() {
  if (!els.postypeBulkRows) return;
  els.postypeBulkRows.innerHTML = "";
  addPostypeBulkRows(3);
}

async function ensureBulkLatestPublishedDates() {
  const rows = Array.from(els.postypeBulkRows?.querySelectorAll("tr") || [])
    .filter((tr) => getPostypeRowUrls(tr).length);
  for (let index = 0; index < rows.length; index += 1) {
    const tr = rows[index];
    const urlValue = getPostypeRowUrlValue(tr);
    const detected = applyBulkConnectionFromUrl(tr);
    const linkType = detected?.linkType || "post";
    const cached = tr.dataset.latestPublishedDate && tr.dataset.metaUrl === urlValue && tr.dataset.metaLinkType === linkType;
    if (cached) continue;
    els.postypeBulkMessage.textContent = `최근 발행일 자동 확인 중 ${index + 1}/${rows.length}…`;
    const data = await fetchPostypeUrlMeta(urlValue, linkType);
    if (!data.latestPublishedDate) throw new Error(`${index + 1}번째 줄: 최근 발행일을 자동으로 확인하지 못했습니다.`);
    tr.dataset.latestPublishedDate = data.latestPublishedDate;
    tr.dataset.metaUrl = urlValue;
    tr.dataset.metaLinkType = linkType;
    tr.dataset.latestPostUrl = data.latestPostUrl || "";
  }
}

function collectPostypeBulkItems() {
  const genre = els.postypeBulkGenreInput?.value.trim() || "";
  const items = [];
  els.postypeBulkRows?.querySelectorAll("tr").forEach((tr, index) => {
    const title = tr.querySelector('[data-bulk-field="title"]')?.value.trim() || "";
    const author = tr.querySelector('[data-bulk-field="author"]')?.value.trim() || "";
    const combination = tr.querySelector('[data-bulk-field="combination"]')?.value || "";
    const subCp1 = tr.querySelector('[data-bulk-field="subCp1"]')?.value.trim() || "";
    const subCp2 = tr.querySelector('[data-bulk-field="subCp2"]')?.value.trim() || "";
    const contentType = tr.querySelector('[data-bulk-field="contentType"]')?.value || "단편";
    const status = tr.querySelector('[data-bulk-field="status"]')?.value || "완결";
    const detected = applyBulkConnectionFromUrl(tr);
    const publishType = contentType === "연재물" ? "다회차" : "단일글";
    const linkType = tr.dataset.linkType || detected?.linkType || "post";
    const urlValue = getPostypeRowUrlValue(tr);
    const urlList = splitPostypeUrls(urlValue);
    const manualUrls = linkType === "manual" ? urlList.join("\n") : "";
    const url = linkType === "manual" ? (tr.dataset.latestPostUrl || urlList[0] || "") : (urlList[0] || "");
    const latestPublishedDate = tr.dataset.latestPublishedDate || "";

    if (!title && !author && !urlValue) return;
    if (!title || !author || !urlValue) throw new Error(`${index + 1}번째 줄의 제목·작가·URL을 모두 입력해 주세요.`);
    if (!combination) throw new Error(`${index + 1}번째 줄의 CP를 선택해 주세요.`);
    if (!["단편", "연재물"].includes(contentType)) throw new Error(`${index + 1}번째 줄의 작품형태를 확인해 주세요.`);
    if (!["완결", "연재"].includes(status)) throw new Error(`${index + 1}번째 줄의 상태를 확인해 주세요.`);

    items.push({
      combination, subCp1, subCp2, title, genre, author, status,
      publishType, linkType, manualUrls, latestPublishedDate, url
    });
  });
  return items;
}

async function loadAdmin() {
  const archiveRequest = api("/api/archive", { method: "GET" })
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error }));

  const [data, archiveResult] = await Promise.all([
    api("/api/admin/data"),
    archiveRequest
  ]);

  let archiveData = { items: [], postypeSyncedAt: null };
  if (archiveResult.ok) {
    archiveData = archiveResult.value;
  } else {
    console.warn("상단 소스 요약 로딩 실패", archiveResult.error);
  }

  const reviewCount = Array.isArray(data.needsReview) ? data.needsReview.length : 0;
  const editedCount = Number(data.editedCount || 0);
  const totalCount = Number(data.count || 0);
  const normalCount = Math.max(0, totalCount - reviewCount - editedCount);
  renderFeedbackBadge(data.feedbackNewCount);

  const archiveItems = Array.isArray(archiveData.items) ? archiveData.items : [];
  const driveItems = archiveItems.filter((item) => (item.source || "drive") !== "postype");
  const postypeItems = archiveItems.filter((item) => item.source === "postype");

  const driveType = (item) => {
    if (["단편", "연재물"].includes(item.contentType)) return item.contentType;
    return Number(item.size || 0) > 200 * 1024 ? "연재물" : "단편";
  };
  const driveShortCount = driveItems.filter((item) => driveType(item) === "단편").length;
  const driveSeriesCount = driveItems.filter((item) => driveType(item) === "연재물").length;
  const driveOngoingCount = driveItems.filter((item) => String(item.status || "") === "연재").length;

  const postypeType = (item) => {
    if (item.publishType === "다회차") return "연재물";
    if (item.publishType === "단일글") return "단편";
    return ["series", "manual"].includes(item.linkType) ? "연재물" : "단편";
  };
  const postypeShortCount = postypeItems.filter((item) => postypeType(item) === "단편").length;
  const postypeSeriesCount = postypeItems.filter((item) => postypeType(item) === "연재물").length;
  const postypeOngoingCount = postypeItems.filter((item) => String(item.status || "") === "연재").length;
  const postypeCompleteCount = postypeItems.filter((item) => String(item.status || "") !== "연재").length;
  const postypeMissingDateCount = postypeItems.filter((item) => !String(item.latestPublishedDate || "").trim()).length;

  els.driveTopTotal.textContent = `${(driveItems.length || totalCount).toLocaleString("ko-KR")}개`;
  els.driveTopSync.textContent = formatSummaryDate(data.syncedAt);
  els.driveTopShort.textContent = `${driveShortCount.toLocaleString("ko-KR")}개`;
  els.driveTopSeries.textContent = `${driveSeriesCount.toLocaleString("ko-KR")}개`;
  els.driveTopOngoing.textContent = `${driveOngoingCount.toLocaleString("ko-KR")}개`;
  els.driveTopReview.textContent = `${reviewCount.toLocaleString("ko-KR")}개`;
  els.driveTopEdited.textContent = `${editedCount.toLocaleString("ko-KR")}개`;

  els.postypeTopTotal.textContent = `${postypeItems.length.toLocaleString("ko-KR")}개`;
  els.postypeTopSync.textContent = formatSummaryDate(archiveData.postypeSyncedAt);
  els.postypeTopShort.textContent = `${postypeShortCount.toLocaleString("ko-KR")}개`;
  els.postypeTopSeries.textContent = `${postypeSeriesCount.toLocaleString("ko-KR")}개`;
  els.postypeTopOngoing.textContent = `${postypeOngoingCount.toLocaleString("ko-KR")}개`;
  els.postypeTopComplete.textContent = `${postypeCompleteCount.toLocaleString("ko-KR")}개`;
  els.postypeTopMissingDate.textContent = `${postypeMissingDateCount.toLocaleString("ko-KR")}개`;

  els.statusNormalCount.textContent = `${normalCount.toLocaleString("ko-KR")}개`;
  els.statusEditedCount.textContent = `${editedCount.toLocaleString("ko-KR")}개`;
  els.statusReviewCount.textContent = `${reviewCount.toLocaleString("ko-KR")}개`;

  els.faviconUrlInput.value = data.settings?.faviconUrl || "";
  els.eyebrowInput.value = data.settings?.eyebrow || "";
  els.titleInput.value = data.settings?.title || "";

  renderReview(data.needsReview || []);
  renderDiagnostics(data.diagnostics || []);
  populatePostypeCpOptions(data.diagnostics || []);

  try {
    await loadUserAdminData();
  } catch (error) {
    console.warn("유저 대시보드 로딩 실패", error);
  }

  setActiveTab(sessionStorage.getItem("archiveAdminTab") || "dashboard");
}

function isMobileDeployPath(path) {
  const normalized = normalizeZipPath(path);
  return (
    normalized.startsWith("mobile/") ||
    normalized === "functions/api/mobile-version.js" ||
    /^public\/downloads\/[^/]+\.apk$/i.test(normalized)
  );
}

function getDeployKindLabel(kind) {
  if (kind === "mobile") return "Android 앱 패치";
  if (kind === "mixed") return "웹 + 앱 혼합 패치";
  return "웹 패치";
}

function getClientDeployFileLimit(path) {
  return /^public\/downloads\/[^/]+\.apk$/i.test(normalizeZipPath(path))
    ? 25 * 1024 * 1024
    : 6 * 1024 * 1024;
}

function buildMobileCommitMessage(
  mobileReadmeText,
  fallbackFileCount = 0,
  zipFileName = "",
  forcedVersion = ""
) {
  const base = buildCommitMessageFromReadme(
    mobileReadmeText,
    fallbackFileCount,
    zipFileName,
    forcedVersion
  );

  if (/^v\d+(?:\.\d+)*\s*:/i.test(base)) return `app ${base}`;
  if (/^Archive update:\s*/i.test(base)) {
    return `app: ${base.replace(/^Archive update:\s*/i, "")}`;
  }
  if (/^Archive update\b/i.test(base)) {
    return `app: ${base.replace(/^Archive update\s*/i, "").trim()}`;
  }
  return `app: ${base}`;
}

function utf8ToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(String(text || "")));
}

function suggestNextMobileVersion(version) {
  const raw = String(version || "").trim().replace(/^v/i, "");
  const parts = raw.split(".").map((item) => Number(item));
  if (!parts.length || parts.some((item) => !Number.isInteger(item) || item < 0)) {
    return "1.0";
  }
  if (parts.length === 1) parts.push(0);
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

function parseSourceAndroidVersion(buildGradleText) {
  const text = String(buildGradleText || "");
  const code = text.match(/\bversionCode\s+(\d+)/);
  const name = text.match(/\bversionName\s+["']([^"']+)["']/);
  return {
    version: name ? name[1] : "",
    build: code ? Number(code[1]) : 0,
  };
}

function updateSourceAndroidVersion(buildGradleText, version, build) {
  let text = String(buildGradleText || "");
  if (
    !/\bversionCode\s+\d+/.test(text) ||
    !/\bversionName\s+["'][^"']+["']/.test(text)
  ) {
    throw new Error("mobile/android/app/build.gradle의 버전 정보를 찾지 못했습니다.");
  }

  text = text.replace(/\bversionCode\s+\d+/, `versionCode ${Number(build)}`);
  text = text.replace(
    /\bversionName\s+["'][^"']+["']/,
    `versionName "${String(version)}"`
  );
  return text;
}

function getKstDateLabel() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const map = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function upsertMobileReadme(readmeText, version, build, message) {
  let text = String(readmeText || "").replace(/\r\n/g, "\n").trim();
  const markerText = "<!-- MOBILE_RELEASE_HISTORY -->";
  const date = getKstDateLabel();

  if (!text) {
    text = [
      "# 셩냥책 Android App",
      "",
      "웹사이트 루트 README.md와 분리된 Android 앱 전용 개발·배포 기록입니다.",
      "웹 버전과 앱 버전은 서로 독립적으로 관리합니다.",
      "",
      "## 운영 기준",
      "",
      "- App ID: `hs.rjs.syungbook`",
      "- 앱 이름: `셩냥책`",
      "- APK 공개 경로: `public/downloads/`",
      "- 최신 앱 버전 API: `functions/api/mobile-version.js`",
      "- Android 버전 기준: `mobile/android/app/build.gradle`",
      "- 관리자 > 배포 > Android 앱 배포에서 APK 릴리즈를 처리합니다.",
      "",
      markerText,
      "",
    ].join("\n");
  }

  if (!text.includes(markerText)) {
    text += `\n\n${markerText}\n`;
  }

  const escaped = String(version).replace(
    /[-/\\^$*+?.()|[\]{}]/g,
    "\\$&"
  );
  const headingPattern = new RegExp(
    `^##\\s+v${escaped}\\b[^\\n]*$`,
    "m"
  );
  const headingMatch = headingPattern.exec(text);

  let existingBody = "";
  let currentStart = -1;
  let currentEnd = -1;

  if (headingMatch) {
    currentStart = headingMatch.index;
    const bodyStart = currentStart + headingMatch[0].length;
    const tail = text.slice(bodyStart);
    const nextHeading = tail.search(/^##\s+v\d/m);
    currentEnd =
      nextHeading >= 0 ? bodyStart + nextHeading : text.length;
    existingBody = text.slice(bodyStart, currentEnd).trim();
  }

  const messageBullet = `- ${String(message || "").trim()}`;
  let body = existingBody;

  if (!body.includes(messageBullet)) {
    body = [messageBullet, body].filter(Boolean).join("\n");
  }

  const section =
    `## v${version} · build ${Number(build)} · ${date}\n\n` +
    `${body.trim()}\n`;

  if (currentStart >= 0) {
    text =
      text.slice(0, currentStart).replace(/\s*$/, "\n\n") +
      section +
      text.slice(currentEnd).replace(/^\s*/, "\n");
  } else {
    const markerIndex = text.indexOf(markerText) + markerText.length;
    text =
      text.slice(0, markerIndex) +
      `\n\n${section}` +
      text.slice(markerIndex).replace(/^\s+/, "\n");
  }

  return `${text.trim()}\n`;
}

function makeMobileVersionSource(version, build, message, downloadUrl) {
  const payload = JSON.stringify({
    enabled: true,
    version: String(version),
    build: Number(build),
    message: String(message || ""),
    downloadUrl: String(downloadUrl || ""),
  });

  return [
    'import { jsonResponse } from "../_shared.js";',
    "",
    "export async function onRequestGet() {",
    "  return jsonResponse(",
    `    ${payload},`,
    "    200,",
    '    { "cache-control": "no-store" }',
    "  );",
    "}",
    "",
  ].join("\n");
}

function ensureMobileReleasePanel() {
  if (document.getElementById("mobileReleasePanel")) return;

  const deployPanel = document.querySelector(
    '[data-tab-panel="deploy"] .deploy-panel'
  );
  if (!deployPanel) return;

  const style = document.createElement("style");
  style.id = "mobileReleasePanelStyle";
  style.textContent = `
    .mobile-release-panel{
      margin-top:22px;
      padding:20px;
      border:1px solid #ded7ce;
      border-radius:18px;
      background:#faf8f4
    }
    .mobile-release-head{
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start
    }
    .mobile-release-head h3{margin:3px 0 5px;font-size:18px}
    .mobile-release-kicker{
      font-size:10px;
      font-weight:900;
      letter-spacing:.12em;
      color:#777069
    }
    .mobile-release-current{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end
    }
    .mobile-release-chip{
      padding:7px 9px;
      border:1px solid #ded7ce;
      border-radius:999px;
      background:#fff;
      font-size:11px;
      font-weight:850
    }
    .mobile-release-grid{
      display:grid;
      grid-template-columns:1fr .65fr;
      gap:10px;
      margin-top:14px
    }
    .mobile-release-grid label,
    .mobile-release-message-field{
      display:grid;
      gap:6px
    }
    .mobile-release-grid label>span,
    .mobile-release-message-field>span{
      font-size:11px;
      font-weight:850;
      color:#5f5953
    }
    .mobile-release-grid input,
    .mobile-release-message-field textarea{
      width:100%;
      border:1px solid #ded7ce;
      border-radius:11px;
      background:#fff;
      padding:10px 11px;
      font:inherit
    }
    .mobile-release-message-field{margin-top:10px}
    .mobile-release-apk{
      margin-top:12px;
      padding:13px;
      border:1px dashed #cfc6bb;
      border-radius:13px;
      background:#fff
    }
    .mobile-release-apk input{width:100%}
    .mobile-release-apk-meta{
      margin-top:7px;
      color:#777069;
      font-size:11px;
      line-height:1.55
    }
    .mobile-release-actions{
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
      margin-top:14px
    }
    .mobile-release-actions .primary{
      border:0;
      background:#1d1c1a;
      color:#fff;
      border-radius:11px;
      padding:11px 14px;
      font-weight:850
    }
    .mobile-release-note{
      font-size:11px;
      color:#777069;
      line-height:1.6
    }
    .mobile-release-status{
      margin-top:12px;
      padding:10px 12px;
      border-radius:10px;
      background:#f1ede7;
      color:#5d574f;
      font-size:12px;
      line-height:1.6
    }
    .mobile-release-status.is-error{
      background:#fff2f2;
      color:#9d3434
    }
    .mobile-release-status.is-success{
      background:#eef8f1;
      color:#2d7549
    }
    @media(max-width:760px){
      .mobile-release-head{display:block}
      .mobile-release-current{
        justify-content:flex-start;
        margin-top:10px
      }
      .mobile-release-grid{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "mobileReleasePanel";
  panel.className = "mobile-release-panel";
  panel.innerHTML = `
    <div class="mobile-release-head">
      <div>
        <span class="mobile-release-kicker">ANDROID APP RELEASE</span>
        <h3>Android 앱 배포</h3>
        <div class="mobile-release-note">
          APK와 버전/build, 안내 문구를 한 번에 GitHub에 반영하고
          기존 배포 상태 카드에서 Cloudflare Pages 상태까지 확인합니다.
        </div>
      </div>
      <div class="mobile-release-current">
        <span id="mobileReleaseCurrentVersion" class="mobile-release-chip">현재 v-</span>
        <span id="mobileReleaseCurrentBuild" class="mobile-release-chip">build -</span>
        <button id="mobileReleaseRefresh" class="deploy-status-refresh" type="button">새로고침</button>
      </div>
    </div>

    <div class="mobile-release-apk">
      <input
        id="mobileReleaseApk"
        type="file"
        accept=".apk,application/vnd.android.package-archive"
      />
      <div id="mobileReleaseApkMeta" class="mobile-release-apk-meta">
        APK를 선택해 주세요. 25MB 이하 파일만 직접 배포할 수 있습니다.
      </div>
    </div>

    <div class="mobile-release-grid">
      <label>
        <span>새 앱 버전</span>
        <input id="mobileReleaseVersion" type="text" inputmode="decimal" placeholder="1.4" />
      </label>
      <label>
        <span>새 build</span>
        <input id="mobileReleaseBuild" type="number" min="1" step="1" placeholder="5" />
      </label>
    </div>

    <label class="mobile-release-message-field">
      <span>업데이트 안내 문구</span>
      <textarea
        id="mobileReleaseMessageInput"
        rows="2"
        placeholder="이번 버전에서 달라진 내용을 입력하세요."
      ></textarea>
    </label>

    <div class="mobile-release-actions">
      <button id="mobileReleaseButton" class="primary" type="button" disabled>
        Android 앱 배포
      </button>
      <span id="mobileReleaseSourceMeta" class="mobile-release-note">
        GitHub Android 소스 상태 확인 중…
      </span>
    </div>

    <div id="mobileReleaseMessage" class="mobile-release-status" hidden></div>
  `;

  const statusCard = deployPanel.querySelector("#deployStatusCard");
  deployPanel.insertBefore(panel, statusCard || null);

  mobileReleaseState.ui = {
    panel,
    currentVersion: panel.querySelector("#mobileReleaseCurrentVersion"),
    currentBuild: panel.querySelector("#mobileReleaseCurrentBuild"),
    refresh: panel.querySelector("#mobileReleaseRefresh"),
    apk: panel.querySelector("#mobileReleaseApk"),
    apkMeta: panel.querySelector("#mobileReleaseApkMeta"),
    version: panel.querySelector("#mobileReleaseVersion"),
    build: panel.querySelector("#mobileReleaseBuild"),
    message: panel.querySelector("#mobileReleaseMessageInput"),
    button: panel.querySelector("#mobileReleaseButton"),
    sourceMeta: panel.querySelector("#mobileReleaseSourceMeta"),
    status: panel.querySelector("#mobileReleaseMessage"),
  };

  mobileReleaseState.ui.refresh.addEventListener("click", () => {
    loadMobileReleaseState(true).catch((error) => {
      showMobileReleaseStatus(
        error.message || "Android 앱 상태를 새로고침하지 못했습니다.",
        "error"
      );
    });
  });

  mobileReleaseState.ui.apk.addEventListener("change", () => {
    const file = mobileReleaseState.ui.apk.files?.[0] || null;
    mobileReleaseState.apkFile = file;

    if (!file) {
      mobileReleaseState.ui.apkMeta.textContent =
        "APK를 선택해 주세요. 25MB 이하 파일만 직접 배포할 수 있습니다.";
      refreshMobileReleaseForm();
      return;
    }

    if (!/\.apk$/i.test(file.name)) {
      mobileReleaseState.ui.apkMeta.textContent =
        "APK 파일만 선택할 수 있습니다.";
      mobileReleaseState.apkFile = null;
      refreshMobileReleaseForm();
      return;
    }

    mobileReleaseState.ui.apkMeta.textContent =
      `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    refreshMobileReleaseForm();
  });

  mobileReleaseState.ui.version.addEventListener(
    "input",
    refreshMobileReleaseForm
  );
  mobileReleaseState.ui.build.addEventListener(
    "input",
    refreshMobileReleaseForm
  );
  mobileReleaseState.ui.message.addEventListener(
    "input",
    refreshMobileReleaseForm
  );
  mobileReleaseState.ui.button.addEventListener(
    "click",
    deployMobileRelease
  );
}

function showMobileReleaseStatus(message, kind = "") {
  const ui = mobileReleaseState.ui;
  if (!ui?.status) return;

  ui.status.hidden = false;
  ui.status.classList.toggle("is-error", kind === "error");
  ui.status.classList.toggle("is-success", kind === "success");
  ui.status.textContent = String(message || "");
}

function refreshMobileReleaseForm() {
  const ui = mobileReleaseState.ui;
  if (!ui) return;

  const version = String(ui.version.value || "")
    .trim()
    .replace(/^v/i, "");
  const build = Number(ui.build.value || 0);
  const currentBuild = Number(mobileReleaseState.current?.build || 0);
  const message = String(ui.message.value || "").trim();
  const file = mobileReleaseState.apkFile;

  const versionOk = /^\d+(?:\.\d+){1,2}$/.test(version);
  const buildOk =
    Number.isInteger(build) &&
    build > 0 &&
    build > currentBuild;
  const fileOk =
    Boolean(file) &&
    /\.apk$/i.test(file.name) &&
    file.size > 0 &&
    file.size <= 25 * 1024 * 1024;

  ui.button.disabled = !(versionOk && buildOk && fileOk && message);
}

async function loadMobileReleaseState(force = false) {
  ensureMobileReleasePanel();
  const ui = mobileReleaseState.ui;
  if (!ui) return;

  ui.refresh.disabled = true;

  try {
    const [latestResponse, source] = await Promise.all([
      fetch(`/api/mobile-version?_=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      }),
      api(`/api/admin/deploy?mobile=source&_=${Date.now()}`, {
        method: "GET",
      }),
    ]);

    const latest = latestResponse.ok
      ? await latestResponse.json()
      : {};

    mobileReleaseState.current = {
      version: String(latest?.version || ""),
      build: Number(latest?.build || 0),
    };
    mobileReleaseState.source = source || {};

    ui.currentVersion.textContent =
      `현재 v${mobileReleaseState.current.version || "-"}`;
    ui.currentBuild.textContent =
      `build ${mobileReleaseState.current.build || "-"}`;

    const sourceVersion = parseSourceAndroidVersion(
      source?.buildGradle || ""
    );

    ui.sourceMeta.textContent =
      `GitHub Android 소스 ${
        sourceVersion.version ? `v${sourceVersion.version}` : "v-"
      } · build ${sourceVersion.build || "-"}`;

    const currentBuild = Number(
      mobileReleaseState.current.build || 0
    );
    const sourceBuild = Number(sourceVersion.build || 0);
    const sourceAhead =
      sourceBuild > currentBuild &&
      Boolean(sourceVersion.version);

    if (!ui.version.value || force) {
      ui.version.value = sourceAhead
        ? sourceVersion.version
        : suggestNextMobileVersion(
            mobileReleaseState.current.version ||
            sourceVersion.version ||
            "1.0"
          );
    }

    if (!ui.build.value || force) {
      ui.build.value = String(
        sourceAhead
          ? sourceBuild
          : Math.max(currentBuild, sourceBuild) + 1
      );
    }

    refreshMobileReleaseForm();
  } finally {
    ui.refresh.disabled = false;
  }
}

async function deployMobileRelease() {
  const ui = mobileReleaseState.ui;
  const apkFile = mobileReleaseState.apkFile;
  if (!ui || !apkFile) return;

  const version = String(ui.version.value || "")
    .trim()
    .replace(/^v/i, "");
  const build = Number(ui.build.value || 0);
  const message = String(ui.message.value || "").trim();
  const currentBuild = Number(mobileReleaseState.current?.build || 0);

  if (!/^\d+(?:\.\d+){1,2}$/.test(version)) {
    showMobileReleaseStatus(
      "앱 버전 형식을 확인해 주세요. 예: 1.4",
      "error"
    );
    return;
  }

  if (!Number.isInteger(build) || build <= currentBuild) {
    showMobileReleaseStatus(
      `build는 현재 build ${currentBuild}보다 커야 합니다.`,
      "error"
    );
    return;
  }

  if (!message) {
    showMobileReleaseStatus(
      "업데이트 안내 문구를 입력해 주세요.",
      "error"
    );
    return;
  }

  if (apkFile.size > 25 * 1024 * 1024) {
    showMobileReleaseStatus(
      "APK가 25MB를 초과합니다.",
      "error"
    );
    return;
  }

  ui.button.disabled = true;
  ui.button.textContent = "배포 준비 중…";
  showMobileReleaseStatus(
    "GitHub Android 소스와 모바일 README를 확인하는 중…"
  );

  try {
    const source = await api(
      `/api/admin/deploy?mobile=source&_=${Date.now()}`,
      { method: "GET" }
    );

    const buildGradle = updateSourceAndroidVersion(
      source?.buildGradle || "",
      version,
      build
    );
    const mobileReadme = upsertMobileReadme(
      source?.mobileReadme || "",
      version,
      build,
      message
    );

    const apkName = `syungbook-v${version}.apk`;
    const apkPath = `public/downloads/${apkName}`;
    const downloadUrl =
      `https://rjs-cj6.pages.dev/downloads/${apkName}`;
    const mobileVersionSource = makeMobileVersionSource(
      version,
      build,
      message,
      downloadUrl
    );

    ui.button.textContent = "APK 읽는 중…";
    const apkBytes = new Uint8Array(
      await apkFile.arrayBuffer()
    );

    const files = [
      {
        path: apkPath,
        contentBase64: bytesToBase64(apkBytes),
      },
      {
        path: "functions/api/mobile-version.js",
        contentBase64: utf8ToBase64(mobileVersionSource),
      },
      {
        path: "mobile/android/app/build.gradle",
        contentBase64: utf8ToBase64(buildGradle),
      },
      {
        path: "mobile/README.md",
        contentBase64: utf8ToBase64(mobileReadme),
      },
    ];

    ui.button.textContent = "GitHub 파일 준비 중…";
    showMobileReleaseStatus(
      "APK · 버전 API · Android 버전 · 모바일 README를 준비하는 중…"
    );

    const prepared = await api("/api/admin/deploy", {
      method: "POST",
      body: JSON.stringify({
        mode: "blobs",
        files,
      }),
    });

    const entries = Array.isArray(prepared?.entries)
      ? prepared.entries
      : [];

    if (entries.length !== files.length) {
      const blocked = Array.isArray(prepared?.blocked)
        ? prepared.blocked
        : [];
      const reason = blocked
        .map((item) => `${item.path}: ${item.reason}`)
        .join(" / ");

      throw new Error(
        `앱 배포 파일 준비 수가 일치하지 않습니다. (${entries.length}/${files.length})` +
        (reason ? ` · ${reason}` : "")
      );
    }

    ui.button.textContent = "GitHub 커밋 중…";

    const result = await api("/api/admin/deploy", {
      method: "POST",
      body: JSON.stringify({
        mode: "commit",
        message: `app v${version}: ${message}`,
        deployVersion: "",
        entries,
      }),
    });

    showDeployCommitCreated(
      result.commitSha,
      result.commitUrl
    );
    refreshDeployStatus({ keepPolling: true });
    historyLoaded = false;

    mobileReleaseState.current = { version, build };
    mobileReleaseState.source = {
      buildGradle,
      mobileReadme,
    };
    mobileReleaseState.apkFile = null;

    ui.apk.value = "";
    ui.apkMeta.textContent =
      "배포 요청 완료 · 다음 APK를 선택할 수 있습니다.";
    ui.currentVersion.textContent =
      `배포 중 v${version}`;
    ui.currentBuild.textContent =
      `build ${build}`;
    ui.version.value = suggestNextMobileVersion(version);
    ui.build.value = String(build + 1);
    ui.message.value = "";

    refreshMobileReleaseForm();

    showMobileReleaseStatus(
      `GitHub 커밋 완료 · Cloudflare Pages 배포가 끝나면 v${version} 업데이트가 사용자 앱에 노출됩니다.`,
      "success"
    );
  } catch (error) {
    console.error(error);
    showMobileReleaseStatus(
      error.message || "Android 앱 배포에 실패했습니다.",
      "error"
    );
  } finally {
    ui.button.textContent = "Android 앱 배포";
    refreshMobileReleaseForm();
  }
}

function normalizeZipPath(path) {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/^google-drive-archive-site[^/]*\//, "");
}

function checkDeployPath(path) {
  const normalized = normalizeZipPath(path);

  if (!normalized || normalized.endsWith("/")) {
    return { allowed: false, path: normalized, reason: "폴더" };
  }

  const protectedExact = new Set([
    "wrangler.toml",
    ".gitignore",
    ".env",
    ".dev.vars",
    "mobile/android/local.properties",
    "mobile/android/key.properties",
    "mobile/key.properties",
  ]);

  if (protectedExact.has(normalized)) {
    return { allowed: false, path: normalized, reason: "보호된 설정 파일" };
  }

  if (
    normalized.startsWith(".git/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("credentials/") ||
    normalized.startsWith("secrets/") ||
    normalized.startsWith("mobile/node_modules/") ||
    normalized.startsWith("mobile/www/") ||
    normalized.startsWith("mobile/releases/") ||
    normalized.startsWith("mobile/.idea/") ||
    normalized.startsWith("mobile/android/.idea/") ||
    normalized.startsWith("mobile/android/.gradle/") ||
    normalized.startsWith("mobile/android/build/") ||
    normalized.startsWith("mobile/android/app/build/") ||
    normalized.startsWith("mobile/android/app/src/main/assets/public/")
  ) {
    return { allowed: false, path: normalized, reason: "보호된 경로" };
  }

  if (
    /(^|\/)(service[-_]?account|credentials|secret|secrets)(\.|\/|$)/i.test(normalized)
  ) {
    return { allowed: false, path: normalized, reason: "민감정보 가능 파일" };
  }

  if (
    normalized.startsWith("mobile/") &&
    (
      /\.(jks|keystore|p12|pfx)$/i.test(normalized) ||
      /(^|\/)(local|key)\.properties$/i.test(normalized)
    )
  ) {
    return { allowed: false, path: normalized, reason: "모바일 서명/로컬 설정 파일" };
  }

  if (!(normalized.startsWith("public/") || normalized.startsWith("functions/") || normalized.startsWith("mobile/") || (normalized === "README.md" || normalized === "DEVELOPMENT_GUIDE.md" || normalized === "GPT_DEVELOPMENT_HANDOFF.md" || normalized === "AUDIT_LOG.md" || normalized === "HELP_GUIDE.md" || normalized === "HISTORY.md"))) {
    return { allowed: false, path: normalized, reason: "허용된 소스 경로가 아님" };
  }

  return { allowed: true, path: normalized };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}


function getLatestReadmeVersionSection(readmeText) {
  const text = String(readmeText || "").replace(/\r\n/g, "\n");
  const headingPattern = /^#{1,2}\s+(v(\d+)(?:\.(\d+))?(?:\.(\d+))?)(?:\s+.*)?$/gm;
  const matches = [];
  let match;

  while ((match = headingPattern.exec(text))) {
    matches.push({
      version: match[1],
      parts: [
        Number(match[2] || 0),
        Number(match[3] || 0),
        Number(match[4] || 0),
      ],
      index: match.index,
      headingLength: match[0].length,
    });
  }

  if (!matches.length) return { version: "", section: text };

  matches.sort((a, b) => {
    for (let i = 0; i < 3; i += 1) {
      if (a.parts[i] !== b.parts[i]) return b.parts[i] - a.parts[i];
    }
    return b.index - a.index;
  });

  const latest = matches[0];
  const sectionStart = latest.index + latest.headingLength;
  const after = text.slice(sectionStart);
  const nextHeading = after.match(/^#{1,2}\s+v\d+(?:\.\d+)*(?:\s+.*)?$/m);
  const section = nextHeading ? after.slice(0, nextHeading.index) : after;

  return { version: latest.version, section };
}

function buildCommitMessageFromReadme(
  readmeText,
  fallbackFileCount = 0,
  zipFileName = "",
  forcedVersion = ""
) {
  const parsed = getLatestReadmeVersionSection(readmeText);
  const version = normalizeVersionLabel(forcedVersion) || parsed.version;
  const section = parsed.section;

  const bulletLines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, "")
        .replace(/`/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.!。]+$/g, "")
        .trim()
    )
    .filter(Boolean);

  let summary = bulletLines.slice(0, 2).join(" / ");

  if (summary.length > 78) {
    summary = summary.slice(0, 75).trimEnd() + "…";
  }

  if (version && summary) return `${version}: ${summary}`;
  if (version) return `${version}: Archive site update`;

  const zipVersion = String(zipFileName || "").match(/v[0-9]+(?:[_\.][0-9]+)*/i);
  const normalizedZipVersion = zipVersion
    ? zipVersion[0].replaceAll("_", ".").toLowerCase()
    : "";

  if (summary) {
    return normalizedZipVersion
      ? `${normalizedZipVersion}: ${summary}`
      : `Archive update: ${summary}`;
  }

  if (normalizedZipVersion) {
    return `${normalizedZipVersion}: Archive site update`;
  }

  return `Archive update (${fallbackFileCount} files)`;
}

async function inspectZip(file) {
  if (!window.JSZip) {
    throw new Error("ZIP 처리 라이브러리를 불러오지 못했습니다.");
  }

  const zip = await JSZip.loadAsync(file);
  const allowed = [];
  const blocked = [];
  const entries = Object.values(zip.files);
  let readmeText = "";
  let mobileReadmeText = "";
  let versionJsonText = "";

  for (const entry of entries) {
    const normalizedEntryPath = normalizeZipPath(entry.name);

    if (!entry.dir && normalizedEntryPath === "public/version.json") {
      try {
        versionJsonText = await entry.async("string");
      } catch {
        versionJsonText = "";
      }
    }

    if (!entry.dir && normalizedEntryPath === "README.md") {
      try {
        readmeText = await entry.async("string");
      } catch {
        readmeText = "";
      }
    }

    if (!entry.dir && normalizedEntryPath === "mobile/README.md") {
      try {
        mobileReadmeText = await entry.async("string");
      } catch {
        mobileReadmeText = "";
      }
    }

    if (entry.dir) continue;

    const check = checkDeployPath(entry.name);

    if (!check.allowed) {
      blocked.push({
        path: check.path || entry.name,
        reason: check.reason,
      });
      continue;
    }

    const bytes = await entry.async("uint8array");

    if (bytes.byteLength > getClientDeployFileLimit(check.path)) {
      blocked.push({
        path: check.path,
        reason: "파일 크기 제한 초과",
      });
      continue;
    }

    allowed.push({
      path: check.path,
      contentBase64: bytesToBase64(bytes),
      size: bytes.byteLength,
    });
  }

  deployFiles = allowed;
  deployBlocked = blocked;

  const mobileFiles = allowed.filter((item) => isMobileDeployPath(item.path));
  const webFiles = allowed.filter((item) => !isMobileDeployPath(item.path));

  pendingDeployKind =
    mobileFiles.length && webFiles.length
      ? "mixed"
      : mobileFiles.length
        ? "mobile"
        : "web";

  let versionJsonVersion = "";
  if (versionJsonText) {
    try {
      versionJsonVersion = normalizeVersionLabel(
        JSON.parse(versionJsonText)?.version || ""
      );
    } catch (_) {}
  }

  const readmeVersion = normalizeVersionLabel(
    getLatestReadmeVersionSection(readmeText).version
  );
  const mobileReadmeVersion = normalizeVersionLabel(
    getLatestReadmeVersionSection(mobileReadmeText).version
  );
  const zipVersionMatch = String(file.name || "")
    .match(/v[0-9]+(?:[_\.][0-9]+)*/i);
  const zipVersion = zipVersionMatch
    ? normalizeVersionLabel(
        zipVersionMatch[0].replaceAll("_", ".")
      )
    : "";

  pendingDeployVersion =
    pendingDeployKind === "mobile"
      ? ""
      : (
          versionJsonVersion ||
          readmeVersion ||
          (pendingDeployKind === "web" ? zipVersion : "")
        );

  let autoMessage = "";

  if (pendingDeployKind === "mobile") {
    autoMessage = buildMobileCommitMessage(
      mobileReadmeText,
      allowed.length,
      file.name,
      mobileReadmeVersion || zipVersion
    );
  } else if (pendingDeployKind === "mixed") {
    const webMessage = buildCommitMessageFromReadme(
      readmeText,
      webFiles.length,
      file.name,
      pendingDeployVersion
    );
    const appMessage = buildMobileCommitMessage(
      mobileReadmeText,
      mobileFiles.length,
      file.name,
      mobileReadmeVersion
    );

    autoMessage = `mixed: ${webMessage} / ${appMessage}`;
    if (autoMessage.length > 120) {
      autoMessage =
        `${autoMessage.slice(0, 117).trimEnd()}…`;
    }
  } else {
    autoMessage = buildCommitMessageFromReadme(
      readmeText,
      allowed.length,
      file.name,
      pendingDeployVersion
    );
  }

  if (els.commitMessageInput) {
    els.commitMessageInput.value = autoMessage;
    els.commitMessageInput.dataset.autoGenerated = "true";
    els.commitMessageInput.title =
      pendingDeployKind === "mobile"
        ? "mobile/README.md 기준 Android 앱 커밋 메시지"
        : pendingDeployKind === "mixed"
          ? "README.md + mobile/README.md를 함께 반영한 혼합 커밋 메시지"
          : (
              readmeText
                ? "version.json 버전 + README.md 최신 변경사항으로 자동 생성됨"
                : "README.md를 찾지 못해 ZIP 이름/파일 수 기준으로 자동 생성됨"
            );
  }

  renderDeployPreview();

  if (els.deployMessage) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent =
      `${getDeployKindLabel(pendingDeployKind)} 감지 · 커밋 메시지 자동 생성 완료: ${autoMessage}`;
  }
}

function renderDeployPreview() {
  els.deployPreview.hidden = false;
  els.deployFileSummary.textContent =
    `${getDeployKindLabel(pendingDeployKind)} · 배포 ${deployFiles.length.toLocaleString("ko-KR")}개 · 제외 ${deployBlocked.length.toLocaleString("ko-KR")}개`;

  els.allowedFileList.innerHTML = deployFiles.length
    ? deployFiles
        .map(
          (file) =>
            `<li>✓ ${escapeHtml(file.path)} <span class="meta">(${Math.ceil(file.size / 1024)} KB)</span></li>`
        )
        .join("")
    : "<li>배포 가능한 파일이 없습니다.</li>";

  els.blockedFileList.innerHTML = deployBlocked.length
    ? deployBlocked
        .map(
          (file) =>
            `<li>! ${escapeHtml(file.path)} — ${escapeHtml(file.reason)}</li>`
        )
        .join("")
    : "<li>제외된 파일이 없습니다.</li>";

  els.deployButton.disabled = deployFiles.length === 0;
}

async function handleZipFile(file) {
  if (!file) return;
  if (deployInProgress) {
    if (els.deployMessage) {
      els.deployMessage.hidden = false;
      els.deployMessage.textContent = "배포가 진행 중입니다. 완료된 뒤 다른 ZIP을 선택해 주세요.";
    }
    return;
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = "ZIP 파일만 업로드할 수 있습니다.";
    return;
  }

  els.deployMessage.hidden = false;
  els.deployMessage.textContent = "ZIP 내용을 확인하는 중…";
  els.deployPreview.hidden = true;

  try {
    await inspectZip(file);
  } catch (error) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = error.message;
  }
}

els.opsAutomationRunButton?.addEventListener("click", async () => {
  els.opsAutomationRunButton.disabled = true;
  if (els.opsAutomationMessage) {
    els.opsAutomationMessage.hidden = false;
    els.opsAutomationMessage.textContent = "운영 상태를 점검하는 중…";
  }
  try {
    const data = await api("/api/admin/ops-automation", { method: "POST", body: "{}" });
    opsAutomationLoaded = false;
    await loadOpsAutomation(true);
    if (els.opsAutomationMessage) {
      els.opsAutomationMessage.textContent = data?.status?.state === "warning"
        ? "점검 완료 · 확인 필요한 항목이 있습니다."
        : "점검 완료 · 현재 운영 상태는 정상입니다.";
    }
  } catch (error) {
    if (els.opsAutomationMessage) els.opsAutomationMessage.textContent = error.message || "운영 자동 점검에 실패했습니다.";
  } finally {
    els.opsAutomationRunButton.disabled = false;
  }
});

els.quotePresetRefreshButton?.addEventListener("click", async () => {
  els.quotePresetRefreshButton.disabled = true;
  try {
    quotePresetAdminLoaded = false;
    await loadQuotePresetAdmin(true);
  } catch (error) {
    console.error(error);
    if (els.quotePresetMessage) {
      els.quotePresetMessage.hidden = false;
      els.quotePresetMessage.textContent = error.message || "프리셋을 새로고침하지 못했습니다.";
    }
  } finally {
    els.quotePresetRefreshButton.disabled = false;
  }
});

els.quotePresetList?.addEventListener("click", (event) => {
  const testButton = event.target.closest("[data-quote-preset-test]");
  if (testButton) {
    const key = String(testButton.dataset.quotePresetTest || "");
    if (key) window.open(`/?quote-test=${encodeURIComponent(key)}`, "_blank", "noopener");
    return;
  }

  const toggle = event.target.closest("[data-quote-preset-toggle]");
  if (!toggle) return;
  const key = String(toggle.dataset.quotePresetToggle || "");
  const current = toggle.getAttribute("aria-checked") === "true";
  if (key) void setQuotePresetVisibility(key, !current, toggle);
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tabTarget));
});


els.resourcePeriodTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-resource-period]");
  if (!button) return;

  const period = String(button.dataset.resourcePeriod || "");
  if (!["today", "7d", "30d"].includes(period)) return;

  resourceAnalyticsPeriod = period;
  if (resourceUsageData) {
    renderResourceAnalytics(resourceUsageData);
  }
});

els.resourceRefreshButton?.addEventListener("click", async () => {
  try {
    await loadResourceUsage(false);
  } catch (error) {
    console.error(error);
    els.resourceMessage.hidden = false;
    els.resourceMessage.textContent =
      error.message || "리소스 현황을 새로고침하지 못했습니다.";
  }
});

els.resourcePagesMoreButton?.addEventListener("click", () => {
  resourcePagesVisibleLimit += 10;
  if (resourceUsageData) renderResourcePagesDeployments(resourceUsageData);
});

els.resourcePreciseButton?.addEventListener("click", async () => {
  const keyCount = Number(resourceUsageData?.kv?.keyCount || 0);
  const message = keyCount > 0
    ? `정밀 측정은 현재 KV key ${keyCount.toLocaleString("ko-KR")}개를 각각 읽어 byte를 계산합니다.\n이 측정 자체가 약 ${keyCount.toLocaleString("ko-KR")}회의 KV get을 사용합니다. 실행할까요?`
    : "KV 저장 byte를 정밀 측정할까요?";

  if (!window.confirm(message)) return;

  try {
    await loadResourceUsage(true);
  } catch (error) {
    console.error(error);
    els.resourceMessage.hidden = false;
    els.resourceMessage.textContent =
      error.message || "KV 정밀 측정에 실패했습니다.";
  }
});

els.visitPerfScope?.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-perf-scope]") : null;
  if (!button || button.disabled) return;
  const scope = button.getAttribute("data-perf-scope");
  if (!["current", "overall"].includes(scope)) return;
  visitPerformanceScope = scope;
  renderVisitAnalytics(analyticsAdminData);
});

els.visitRefreshButton?.addEventListener("click", async () => {
  els.visitRefreshButton.disabled = true;
  try {
    await loadUserAdminData(false);
  } catch (error) {
    window.alert(error.message || "방문 통계를 불러오지 못했습니다.");
  } finally {
    els.visitRefreshButton.disabled = false;
  }
});

els.userRefreshButton?.addEventListener("click", async () => {
  els.userRefreshButton.disabled = true;
  try {
    await loadUserAdminData(true);
  } catch (error) {
    els.userMessage.hidden = false;
    els.userMessage.textContent =
      error.message || "유저 정보를 불러오지 못했습니다.";
  } finally {
    els.userRefreshButton.disabled = false;
  }
});

els.userSearchInput?.addEventListener("input", renderAdminUsers);

function openAdminUserFromFeedback(userId) {
  const normalized = String(userId || "").trim().toLowerCase();
  if (!normalized) return;
  setActiveTab("users");
  if (els.userSearchInput) {
    els.userSearchInput.value = normalized;
    renderAdminUsers();
    els.userSearchInput.focus();
  }
  const matched = getFilteredAdminUsers().some((user) => String(user.userId || "").toLowerCase() === normalized);
  if (els.userMessage) {
    els.userMessage.hidden = false;
    els.userMessage.textContent = matched
      ? `${normalized} 계정을 표시했습니다.`
      : `${normalized} 계정을 현재 불러온 사용자 목록에서 찾지 못했습니다.`;
  }
}

async function copyAdminText(value) {
  const text = String(value || "");
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    let textarea = null;
    try {
      textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      return Boolean(document.execCommand("copy"));
    } catch {
      return false;
    } finally {
      textarea?.remove();
    }
  }
}

function showTemporaryPasswordModal(userId, temporaryPassword) {
  let modal = document.getElementById("temporaryPasswordModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "temporaryPasswordModal";
    modal.className = "admin-password-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="admin-password-modal-backdrop" data-password-modal-close></div>
      <section class="admin-password-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="temporaryPasswordModalTitle">
        <button type="button" class="admin-password-modal-close" data-password-modal-close aria-label="닫기">×</button>
        <span>ACCOUNT RECOVERY</span>
        <h3 id="temporaryPasswordModalTitle">임시 비밀번호 발급 완료</h3>
        <p class="admin-password-modal-user"></p>
        <div class="admin-password-value-row">
          <code></code>
          <button type="button" data-password-copy>복사</button>
        </div>
        <p class="admin-password-modal-note">이 비밀번호 원문은 서버나 DB에 별도 저장되지 않습니다. 창을 닫기 전에 복사해 사용자에게 전달해 주세요. 기존 로그인 세션은 모두 만료되었습니다.</p>
        <button type="button" class="admin-password-modal-done" data-password-modal-close>확인</button>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", async (event) => {
      if (event.target.closest("[data-password-modal-close]")) {
        modal.hidden = true;
        document.body.classList.remove("admin-password-modal-open");
        modal.querySelector("code").textContent = "";
        return;
      }
      const copyButton = event.target.closest("[data-password-copy]");
      if (!copyButton) return;
      const copied = await copyAdminText(modal.querySelector("code")?.textContent || "");
      copyButton.textContent = copied ? "복사됨" : "복사 실패";
      window.setTimeout(() => { copyButton.textContent = "복사"; }, 1200);
    });
  }

  modal.querySelector(".admin-password-modal-user").textContent = `${userId} 계정의 새 임시 비밀번호입니다.`;
  modal.querySelector("code").textContent = String(temporaryPassword || "");
  const copyButton = modal.querySelector("[data-password-copy]");
  if (copyButton) copyButton.textContent = "복사";
  modal.hidden = false;
  document.body.classList.add("admin-password-modal-open");
  window.setTimeout(() => copyButton?.focus(), 0);
}

els.userTableBody?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-user-action]");
  if (!button) return;

  const row = button.closest("[data-user-id]");
  const userId = row?.dataset.userId;
  const action = button.dataset.userAction;

  if (!userId || !action) return;

  const confirmMessage = action === "delete_user"
    ? `${userId} 계정을 삭제할까요?\n세션, 독서 기록, 북마크, 좋아요, 저장 문장·메모, 피드 반응, 계정 연결 통계와 계정 문의 정보가 함께 삭제됩니다.`
    : action === "reset_password"
      ? `${userId} 계정의 비밀번호를 임시 비밀번호로 초기화할까요?\n연락수단만으로 본인 확인하지 말고 가입일·최근 활동·북마크/최근조회 등 문의자가 적은 이용 기록을 대조했는지 확인해 주세요.\n기존 로그인 세션은 모두 만료됩니다.`
      : `${userId} 계정의 모든 로그인 세션을 초기화할까요?\n현재 로그인된 기기들은 다시 로그인해야 합니다.`;

  if (!window.confirm(confirmMessage)) return;

  button.disabled = true;

  try {
    const data = await api("/api/admin/user-action", {
      method: "POST",
      body: JSON.stringify({ action, userId }),
    });

    els.userMessage.hidden = false;
    if (action === "reset_password") {
      const temporaryPassword = String(data?.temporaryPassword || "");
      els.userMessage.textContent = `${userId} 계정의 비밀번호를 초기화했습니다.`;
      showTemporaryPasswordModal(userId, temporaryPassword);
    } else if (action === "delete_user") {
      userAdminData.users = (userAdminData.users || []).filter((user) => user.userId !== userId);
      renderAdminUsers();
      els.userMessage.textContent = `${userId} 계정을 삭제했습니다.`;
    } else {
      els.userMessage.textContent = `${userId} 계정의 로그인 세션을 초기화했습니다.`;
    }

    try {
      await loadUserAdminData(false);
    } catch (refreshError) {
      console.warn("user admin refresh failed after successful action", refreshError);
      els.userMessage.textContent += " 목록 새로고침은 실패했습니다. 새로고침 버튼으로 다시 확인해 주세요.";
    }
  } catch (error) {
    els.userMessage.hidden = false;
    els.userMessage.textContent = error.message || "작업에 실패했습니다.";
  } finally {
    button.disabled = false;
  }
});

async function requestDriveSyncWithSafetyConfirmation() {
  let data = await api("/api/admin/sync", {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (data?.blocked && data.blockedReason === "large_removal") {
    const removed = Number(data.candidateRemovedCount || 0);
    const confirmed = window.confirm(
      `${data.warning || "Drive에서 대량 삭제가 감지되어 자동 반영을 보류했습니다."}\n\n` +
      `삭제 후보 ${removed.toLocaleString("ko-KR")}개를 실제로 반영하려면 확인을 눌러 다시 동기화합니다.`
    );
    if (!confirmed) return data;

    data = await api("/api/admin/sync", {
      method: "POST",
      body: JSON.stringify({ forceLargeRemoval: true }),
    });
  }

  return data;
}

async function requestPostypeSyncWithSafetyConfirmation() {
  let data = await api("/api/admin/postype-sync", {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (data?.blocked && data.blockedReason === "large_removal") {
    const removed = Number(data.candidateRemovedCount || 0);
    const confirmed = window.confirm(
      `${data.warning || "POSTYPE 노출 작품의 대량 감소가 감지되어 자동 반영을 보류했습니다."}\n\n` +
      `감소 후보 ${removed.toLocaleString("ko-KR")}개를 실제로 반영하려면 확인을 눌러 다시 동기화합니다.`
    );
    if (!confirmed) return data;

    data = await api("/api/admin/postype-sync", {
      method: "POST",
      body: JSON.stringify({ forceLargeRemoval: true }),
    });
  }

  return data;
}

els.syncButton.addEventListener("click", async () => {
  els.syncButton.disabled = true;
  els.syncMessage.hidden = false;
  els.syncMessage.textContent = "Google Drive를 다시 읽는 중입니다…";

  try {
    const data = await requestDriveSyncWithSafetyConfirmation();
    if (data?.blocked) {
      els.syncMessage.textContent = data.warning || "Drive 동기화를 안전을 위해 반영하지 않았습니다.";
      renderDiagnostics(data.diagnostics || []);
      return;
    }
    const reconciled = Number(data.reconciledCount || 0);
    const added = Number(data.addedCount || 0);
    const updated = Number(data.updatedCount || 0);
    const removed = Number(data.removedCount || 0);
    const deltaText = added || updated || removed
      ? ` · 변경 ${added + updated + removed}개 (추가 ${added} / 수정 ${updated} / 삭제 ${removed})`
      : " · 변경 없음";
    const reconciledText = reconciled > 0
      ? ` · 정상 파일명으로 복원 ${reconciled.toLocaleString("ko-KR")}개`
      : "";
    els.syncMessage.textContent =
      `동기화 완료: ${data.count.toLocaleString("ko-KR")}개${deltaText}${reconciledText}`;
    renderDiagnostics(data.diagnostics || []);
    await loadAdmin();
  } catch (error) {
    els.syncMessage.textContent = error.message;
  } finally {
    els.syncButton.disabled = false;
  }
});


els.postypeListRefreshButton?.addEventListener("click", async () => {
  els.postypeListRefreshButton.disabled = true;
  try {
    await loadPostypeAdminList(true);
  } catch (error) {
    els.postypeListMessage.hidden = false;
    els.postypeListMessage.textContent = error.message || "POSTYPE 목록을 불러오지 못했습니다.";
  } finally {
    els.postypeListRefreshButton.disabled = false;
  }
});

els.postypeDuplicateFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-postype-filter]");
  if (!button) return;

  postypeAdminFilter = button.dataset.postypeFilter || "all";
  postypeAdminPage = 1;
  renderPostypeAdminList();

  if (els.postypeListMessage) {
    els.postypeListMessage.hidden = false;
    const count = getFilteredPostypeAdminItems().length;
    els.postypeListMessage.textContent = postypeAdminFilter === "duplicate"
      ? `중복 확인 대상 · ${count.toLocaleString("ko-KR")}개 조회`
      : `전체 · ${count.toLocaleString("ko-KR")}개 조회`;
  }
});

els.driveSummaryFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-drive-filter]");
  if (!button) return;

  driveAdminFilter = button.dataset.driveFilter || "all";
  driveAdminPage = 1;
  renderDriveAdminList();

  els.driveListMessage.hidden = false;
  els.driveListMessage.textContent =
    `${getDriveFilterLabel()} · ${getFilteredDriveAdminItems().length.toLocaleString("ko-KR")}개 조회`;
});

els.driveListBody?.addEventListener("input", (event) => {
  const typeSelect = event.target.closest("[data-drive-content-type]");
  const statusSelect = event.target.closest("[data-drive-status]");
  if (!typeSelect && !statusSelect) return;

  const row = (typeSelect || statusSelect).closest("[data-drive-id]");
  const item = driveAdminItems.find(
    (entry) => entry.id === row?.dataset.driveId
  );
  if (!item) return;

  if (typeSelect) {
    item.draftOverrideContentType =
      typeSelect.value === "auto"
        ? ""
        : typeSelect.value;

    const appliedContentType =
      item.draftOverrideContentType ||
      item.autoContentType;

    if (appliedContentType === "단편") {
      item.draftOverrideStatus = "";
    }
  }

  if (statusSelect) {
    item.draftOverrideStatus =
      statusSelect.value === "연재"
        ? "연재"
        : "";
  }

  renderDriveAdminList();
});

els.driveListPagination?.addEventListener("click", (event) => {
  const totalPages = Math.max(
    1,
    Math.ceil(getFilteredDriveAdminItems().length / DRIVE_ADMIN_PAGE_SIZE)
  );

  const pageButton = event.target.closest("[data-drive-page]");
  if (pageButton) {
    driveAdminPage = Math.max(
      1,
      Math.min(
        totalPages,
        Number(pageButton.dataset.drivePage) || 1
      )
    );
    renderDriveAdminList();
    return;
  }

  if (event.target.closest("[data-drive-page-prev]")) {
    if (driveAdminPage > 1) {
      driveAdminPage -= 1;
      renderDriveAdminList();
    }
    return;
  }

  if (event.target.closest("[data-drive-page-next]")) {
    if (driveAdminPage < totalPages) {
      driveAdminPage += 1;
      renderDriveAdminList();
    }
  }
});

els.textHealthScanButton?.addEventListener("click", async () => {
  try {
    await runTextHealthScan();
  } catch (error) {
    if (els.textHealthProgress) els.textHealthProgress.textContent = error.message || "텍스트 건강검사에 실패했습니다.";
    if (els.textHealthScanButton) {
      els.textHealthScanButton.disabled = false;
      els.textHealthScanButton.textContent = "전체 검사";
    }
  }
});

els.textHealthList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-text-health-normal]");
  if (!button) return;
  try {
    await confirmTextHealthNormal(
      button.dataset.textHealthNormal || "",
      button.dataset.textHealthModified || "",
      button
    );
  } catch (error) {
    if (els.textHealthProgress) els.textHealthProgress.textContent = error.message || "정상 확인 상태를 저장하지 못했습니다.";
  }
});

els.driveListRefreshButton?.addEventListener("click", async () => {
  try {
    await loadDriveAdminList();
  } catch (error) {
    els.driveListMessage.hidden = false;
    els.driveListMessage.textContent =
      error.message || "Drive 목록을 불러오지 못했습니다.";
  }
});

els.driveRescanButton?.addEventListener("click", async () => {
  els.driveRescanButton.disabled = true;
  els.driveListMessage.hidden = false;
  els.driveListMessage.textContent =
    "Google Drive를 다시 읽는 중입니다…";

  try {
    const data = await requestDriveSyncWithSafetyConfirmation();
    if (data?.blocked) {
      els.driveListMessage.textContent = data.warning || "Drive 동기화를 안전을 위해 반영하지 않았습니다.";
      return;
    }
    driveAdminLoaded = false;
    await loadDriveAdminList();
    const added = Number(data.addedCount || 0);
    const updated = Number(data.updatedCount || 0);
    const removed = Number(data.removedCount || 0);
    renderDriveLastSyncStatus(data.lastSync || {
      checkedAt: data.checkedAt, addedCount: added, updatedCount: updated, removedCount: removed,
    });
    els.driveListMessage.textContent =
      `Drive 재동기화 완료 · 추가 ${added} / 수정 ${updated} / 삭제 ${removed}`;
    textHealthLoaded = false;
    await loadTextHealth().catch(() => {});
  } catch (error) {
    els.driveListMessage.textContent =
      error.message || "Drive 다시 읽기에 실패했습니다.";
  } finally {
    els.driveRescanButton.disabled = false;
  }
});

for (const container of [els.driveListBody, els.postypeListBody]) {
  container?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-duplicate-dismiss-key]");
    if (!button) return;
    button.disabled = true;
    try {
      const isPostype = Boolean(button.closest("[data-postype-id]"));
      await dismissDuplicateSuspicions(button.dataset.duplicateDismissKey || "");
      const targetMessage = isPostype ? els.postypeListMessage : els.driveListMessage;
      if (targetMessage) {
        targetMessage.hidden = false;
        targetMessage.textContent = "중복 아님으로 저장했습니다. 같은 조합은 다시 중복 의심으로 표시되지 않습니다.";
      }
    } catch (error) {
      const targetMessage = button.closest("[data-postype-id]") ? els.postypeListMessage : els.driveListMessage;
      if (targetMessage) {
        targetMessage.hidden = false;
        targetMessage.textContent = error.message || "중복 제외 저장에 실패했습니다.";
      }
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}

els.driveTypeSaveButton?.addEventListener("click", async () => {
  try {
    await saveDriveAdminChanges();
  } catch (error) {
    els.driveListMessage.hidden = false;
    els.driveListMessage.textContent =
      error.message || "Drive 작품형태 저장에 실패했습니다.";
  }
});

els.postypeListPagination?.addEventListener("click", (event) => {
  const totalPages = Math.max(1, Math.ceil(getFilteredPostypeAdminItems().length / POSTYPE_ADMIN_PAGE_SIZE));
  const pageButton = event.target.closest("[data-postype-page]");

  if (pageButton) {
    postypeAdminPage = Math.max(1, Math.min(totalPages, Number(pageButton.dataset.postypePage) || 1));
    renderPostypeAdminList();
    els.postypeListBody?.closest(".postype-library-table-wrap")?.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  if (event.target.closest("[data-postype-page-prev]")) {
    if (postypeAdminPage > 1) {
      postypeAdminPage -= 1;
      renderPostypeAdminList();
    }
    return;
  }

  if (event.target.closest("[data-postype-page-next]")) {
    if (postypeAdminPage < totalPages) {
      postypeAdminPage += 1;
      renderPostypeAdminList();
    }
  }
});

els.postypeListBody?.addEventListener("input", (event) => {
  const dateInput = event.target.closest("[data-postype-date]");
  const contentTypeInput = event.target.closest("[data-postype-content-type]");
  const statusInput = event.target.closest("[data-postype-status]");
  if (!dateInput && !contentTypeInput && !statusInput) return;

  const row = (dateInput || contentTypeInput || statusInput).closest("[data-postype-id]");
  const item = postypeAdminItems.find((entry) => entry.id === row?.dataset.postypeId);
  if (!item) return;

  if (dateInput) item.draftLatestPublishedDate = dateInput.value || "";
  if (contentTypeInput) item.draftPublishType = contentTypeInput.value === "연재물" ? "다회차" : "단일글";
  if (statusInput) item.draftStatus = statusInput.value || "완결";

  row.classList.toggle(
    "postype-library-row-dirty",
    String(item.draftLatestPublishedDate || "") !== String(item.latestPublishedDate || "") ||
    String(item.draftPublishType || "") !== String(item.publishType || "") ||
    String(item.draftStatus || "") !== String(item.status || "")
  );
  updatePostypeAdminCounts();
});

els.postypeListBody?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-postype-date-fetch]");
  if (!button) return;

  const row = button.closest("[data-postype-id]");
  const item = postypeAdminItems.find(
    (entry) => entry.id === row?.dataset.postypeId
  );
  if (!item) return;

  els.postypeListMessage.hidden = false;

  try {
    const latestPublishedDate = await fetchLatestPublishedDateForItem(item, button);
    const input = row.querySelector("[data-postype-date]");
    if (input) input.value = latestPublishedDate;
    row.classList.toggle(
      "postype-library-row-dirty",
      latestPublishedDate !== String(item.latestPublishedDate || "")
    );
    updatePostypeAdminCounts();
    els.postypeListMessage.textContent =
      item.lengthType === "시리즈"
        ? `${item.id} · 시리즈 최신화 기준 ${latestPublishedDate} 불러오기 완료`
        : `${item.id} · 최근 발행일 ${latestPublishedDate} 불러오기 완료`;
  } catch (error) {
    els.postypeListMessage.textContent = `${item.id} · ${error.message || "최근 발행일을 불러오지 못했습니다."}`;
  }
});

els.postypeFetchMissingDatesButton?.addEventListener("click", async () => {
  const targets = postypeAdminItems.filter(
    (item) => !String(item.draftLatestPublishedDate || "").trim() && item.url
  );

  els.postypeListMessage.hidden = false;

  if (!targets.length) {
    els.postypeListMessage.textContent = "최근 발행일이 비어 있는 작품이 없습니다.";
    return;
  }

  els.postypeFetchMissingDatesButton.disabled = true;
  let success = 0;
  let failed = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const item = targets[index];
    els.postypeListMessage.textContent =
      `빈 최근 발행일 확인 중 ${index + 1}/${targets.length} · ${item.title || item.id}`;

    try {
      await fetchLatestPublishedDateForItem(item);
      success += 1;
    } catch (error) {
      console.warn("POSTYPE latestPublishedDate fetch failed", item.id, error);
      failed += 1;
    }
  }

  renderPostypeAdminList();
  els.postypeListMessage.hidden = false;
  els.postypeListMessage.textContent =
    `최근 발행일 불러오기 완료: 성공 ${success}개` +
    (failed ? ` · 확인 필요 ${failed}개` : "") +
    " · 아직 시트에는 저장하지 않았습니다.";
  els.postypeFetchMissingDatesButton.disabled = false;
});

els.postypePublishedSyncButton?.addEventListener("click", async () => {
  const dirtyItems = getPostypeDirtyItems();

  els.postypePublishedSyncButton.disabled = true;
  els.postypeListMessage.hidden = false;
  els.postypeListMessage.textContent = dirtyItems.length
    ? `${dirtyItems.length.toLocaleString("ko-KR")}개 변경사항을 Google Sheet에 반영하는 중입니다…`
    : "변경사항을 확인하고 KV와 비교하는 중입니다…";

  try {
    const updates = dirtyItems.map((item) => ({
      id: item.id,
      latestPublishedDate: item.draftLatestPublishedDate || "",
      publishType: item.draftPublishType || "단일글",
      status: item.draftStatus || "완결",
    }));
    const submit = (forceLargeRemoval = false) => api("/api/admin/postype-published-sync", {
      method: "POST",
      body: JSON.stringify({ updates, forceLargeRemoval }),
    });

    let data = await submit(false);
    if (data.blocked && data.blockedReason === "large_removal") {
      const confirmed = window.confirm(
        `${data.warning || "POSTYPE 작품이 대량으로 줄어들 예정입니다."}\n\n` +
        `후보 삭제 ${Number(data.candidateRemovedCount || 0).toLocaleString("ko-KR")}개 · 반영 후 ${Number(data.candidateCount || 0).toLocaleString("ko-KR")}개\n` +
        "정말 이 상태를 공개 목록에 반영할까요?"
      );
      if (!confirmed) {
        els.postypeListMessage.textContent = "대량 감소 반영을 취소했습니다. Google Sheet 변경값은 유지되고 공개 목록은 기존 상태를 유지합니다.";
        return;
      }
      data = await submit(true);
    }

    const resultMessage =
      (data.sheetUpdatedCount
        ? `시트 ${Number(data.sheetUpdatedCount).toLocaleString("ko-KR")}개 변경 반영`
        : "시트 변경사항 없음") +
      " · " +
      (data.kvWritten
        ? "KV 업데이트 1회"
        : data.publicIndexRepaired
          ? "공개 인덱스 복구 완료"
          : "KV 업데이트 생략");

    els.postypeListMessage.textContent = resultMessage;

    await loadPostypeAdminList(false);
    els.postypeListMessage.hidden = false;
    els.postypeListMessage.textContent = resultMessage;
  } catch (error) {
    els.postypeListMessage.textContent = error.message || "최근 발행일 동기화에 실패했습니다.";
  } finally {
    els.postypePublishedSyncButton.disabled = false;
  }
});

els.postypeBulkAddRowsButton?.addEventListener("click", () => {
  addPostypeBulkRows(5);
});

els.postypeBulkRows?.addEventListener("change", async (event) => {
  const urlInput = event.target.closest("[data-bulk-url]");
  if (urlInput) {
    const tr = urlInput.closest("tr");
    delete tr.dataset.contentTypeTouched;
    if (!urlInput.value.trim()) return;

    applyBulkConnectionFromUrl(tr);
    invalidatePostypeRowMeta(tr);

    els.postypeBulkMessage.hidden = false;
    els.postypeBulkMessage.textContent = "URL에서 작품 정보를 자동으로 불러오는 중입니다…";
    try {
      const loaded = await fillBulkRowFromUrl(tr);
      const date = tr.dataset.latestPublishedDate || "";
      els.postypeBulkMessage.textContent = loaded
        ? "URL 정보 자동 불러오기 완료" + (date ? ` · 최근 발행일 ${date}` : "")
        : "URL은 확인했지만 제목·작가 정보를 자동으로 찾지 못했습니다.";
    } catch (error) {
      els.postypeBulkMessage.textContent = error.message || "URL 정보를 자동으로 불러오지 못했습니다.";
    }
    return;
  }

  const changedSelect = event.target.closest('[data-bulk-field="contentType"]');
  if (!changedSelect) return;

  const tr = changedSelect.closest("tr");
  tr.dataset.contentTypeTouched = "1";
  invalidatePostypeRowMeta(tr);
});

els.postypeBulkRows?.addEventListener("click", async (event) => {
  const addUrlButton = event.target.closest("[data-bulk-url-add]");
  if (addUrlButton) {
    const tr = addUrlButton.closest("tr");
    addPostypeUrlInput(tr);
    invalidatePostypeRowMeta(tr);
    return;
  }

  const removeUrlButton = event.target.closest("[data-bulk-url-remove]");
  if (removeUrlButton) {
    const tr = removeUrlButton.closest("tr");
    removeUrlButton.closest(".postype-bulk-url-row")?.remove();
    invalidatePostypeRowMeta(tr);
    delete tr.dataset.contentTypeTouched;
    applyBulkConnectionFromUrl(tr);
    return;
  }

  const metaButton = event.target.closest("[data-bulk-meta]");
  if (metaButton) {
    els.postypeBulkMessage.hidden = false;
    try {
      const loaded = await fillBulkRowFromUrl(metaButton.closest("tr"));
      els.postypeBulkMessage.textContent = loaded
        ? "URL에서 제목·작가·최근 발행일을 불러왔습니다."
        : "URL은 확인했지만 자동으로 찾을 수 있는 제목/작가 정보가 없었습니다.";
    } catch (error) {
      els.postypeBulkMessage.textContent = error.message || "URL 정보를 불러오지 못했습니다.";
    }
    return;
  }

  const removeButton = event.target.closest("[data-bulk-remove]");
  if (!removeButton) return;
  removeButton.closest("tr")?.remove();
  renumberPostypeBulkRows();
  if (!els.postypeBulkRows.children.length) addPostypeBulkRows(5);
});

els.postypeBulkFetchAllButton?.addEventListener("click", async () => {
  const rows = Array.from(els.postypeBulkRows?.querySelectorAll("tr") || [])
    .filter((tr) => getPostypeRowUrls(tr).length);

  els.postypeBulkMessage.hidden = false;
  if (!rows.length) {
    els.postypeBulkMessage.textContent = "먼저 URL을 한 개 이상 입력해 주세요.";
    return;
  }

  els.postypeBulkFetchAllButton.disabled = true;
  let success = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index += 1) {
    els.postypeBulkMessage.textContent =
      "URL 정보 확인 중 " + (index + 1) + "/" + rows.length + "…";
    try {
      if (await fillBulkRowFromUrl(rows[index])) success += 1;
      else failed += 1;
    } catch (error) {
      console.warn("POSTYPE URL metadata fetch failed", error);
      failed += 1;
    }
  }

  els.postypeBulkMessage.textContent =
    "URL 정보 불러오기 완료: 성공 " + success + "개" +
    (failed ? " · 확인 필요 " + failed + "개" : "");
  els.postypeBulkFetchAllButton.disabled = false;
});

els.postypeBulkClearButton?.addEventListener("click", () => {
  clearPostypeBulkRows();
  els.postypeBulkMessage.hidden = true;
});

els.postypeBulkRegisterButton?.addEventListener("click", async () => {
  els.postypeBulkMessage.hidden = false;
  els.postypeBulkRegisterButton.disabled = true;
  els.postypeBulkRegisterButton.textContent = "정보 확인 중…";

  let items;
  try {
    await ensureBulkLatestPublishedDates();
    items = collectPostypeBulkItems();
    if (!items.length) throw new Error("등록할 작품을 입력해 주세요.");
  } catch (error) {
    els.postypeBulkMessage.textContent = error.message;
    els.postypeBulkRegisterButton.disabled = false;
    els.postypeBulkRegisterButton.textContent = "입력한 작품 등록";
    return;
  }

  els.postypeBulkRegisterButton.disabled = true;
  els.postypeBulkRegisterButton.textContent = "일괄 등록 중…";
  els.postypeBulkMessage.textContent =
    items.length.toLocaleString("ko-KR") + "개 작품을 등록하는 중입니다…";

  try {
    const data = await api("/api/admin/postype-bulk-add", {
      method: "POST",
      body: JSON.stringify({ items }),
    });

    if (data.refreshPending) {
      els.postypeBulkMessage.textContent =
        `Google Sheet 등록 완료: ${Number(data.addedCount || 0).toLocaleString("ko-KR")}개 · ${data.firstId || ""} ~ ${data.lastId || ""} · ` +
        (data.warning || "공개 목록 갱신이 남았습니다. POSTYPE 동기화를 다시 실행해 주세요.");
    } else {
      els.postypeBulkMessage.textContent =
        "일괄 등록 완료: " + Number(data.addedCount || 0).toLocaleString("ko-KR") +
        "개 · " + data.firstId + " ~ " + data.lastId +
        " · 현재 노출 " + Number(data.count || 0).toLocaleString("ko-KR") + "개";
    }

    // Sheet append가 성공한 응답이면 입력을 남겨 재시도로 중복 등록하지 않는다.
    clearPostypeBulkRows();
  } catch (error) {
    els.postypeBulkMessage.textContent = error.message || "일괄 등록에 실패했습니다.";
  } finally {
    els.postypeBulkRegisterButton.disabled = false;
    els.postypeBulkRegisterButton.textContent = "입력한 작품 등록";
  }
});

els.postypeAssignIdsButton?.addEventListener("click", async () => {
  els.postypeAssignIdsButton.disabled = true;
  els.postypeIdMessage.hidden = false;
  els.postypeIdMessage.textContent = "POSTYPE 시트를 확인하고 빈 ID를 채우는 중입니다…";

  try {
    const data = await api("/api/admin/postype-assign-ids", {
      method: "POST",
      body: "{}",
    });

    const count = Number(data.assignedCount || 0);
    if (count > 0) {
      const preview = (data.assigned || [])
        .slice(0, 5)
        .map((item) => String(item.id || "") + " (행 " + String(item.row || "") + ")")
        .join(", ");

      els.postypeIdMessage.textContent =
        "완료: " + count.toLocaleString("ko-KR") + "개 ID 생성" +
        (preview ? " · " + preview : "");
    } else {
      els.postypeIdMessage.textContent =
        "빈 ID가 없습니다. 현재 모든 데이터 행에 ID가 있습니다.";
    }
  } catch (error) {
    els.postypeIdMessage.textContent =
      error.message || "ID 자동 생성에 실패했습니다.";
  } finally {
    els.postypeAssignIdsButton.disabled = false;
  }
});

els.postypeSyncButton?.addEventListener("click", async () => {
  els.postypeSyncButton.disabled = true;
  els.postypeAssignIdsButton.disabled = true;
  els.postypeIdMessage.hidden = false;
  els.postypeIdMessage.textContent = "POSTYPE 시트를 읽어 KV에 저장하는 중입니다…";

  try {
    const data = await requestPostypeSyncWithSafetyConfirmation();
    if (data?.blocked) {
      els.postypeIdMessage.textContent = data.warning || "POSTYPE 동기화를 안전을 위해 반영하지 않았습니다.";
      return;
    }

    els.postypeIdMessage.textContent =
      (data.changed
        ? "변경사항 반영 완료 · KV 업데이트 1회"
        : "변경사항 없음 · KV 업데이트 생략") +
      " · 노출 " + Number(data.count || 0).toLocaleString("ko-KR") +
      "개 · 숨김 " + Number(data.disabledCount || 0).toLocaleString("ko-KR") +
      "개 · 전체 데이터 행 " + Number(data.totalRows || 0).toLocaleString("ko-KR") + "개";
  } catch (error) {
    els.postypeIdMessage.textContent =
      error.message || "POSTYPE 시트 동기화에 실패했습니다.";
  } finally {
    els.postypeSyncButton.disabled = false;
    els.postypeAssignIdsButton.disabled = false;
  }
});

els.postypeAutoSyncRunButton?.addEventListener("click", async () => {
  try {
    await runAutoSyncNow("postype", els.postypeAutoSyncRunButton);
  } catch (error) {
    if (els.postypeAutoSyncResult) els.postypeAutoSyncResult.textContent = error.message || "자동동기화 실행 실패";
  }
});

els.driveAutoSyncRunButton?.addEventListener("click", async () => {
  try {
    await runAutoSyncNow("drive", els.driveAutoSyncRunButton);
  } catch (error) {
    if (els.driveAutoSyncResult) els.driveAutoSyncResult.textContent = error.message || "자동동기화 실행 실패";
  }
});

els.postypeAutoSyncSetupButton?.addEventListener("click", async () => {
  try {
    await installAutoSyncSchedule(els.postypeAutoSyncSetupButton);
  } catch (error) {
    window.alert(error.message || "자동동기화 예약 설정에 실패했습니다.");
  }
});

els.driveAutoSyncSetupButton?.addEventListener("click", async () => {
  try {
    await installAutoSyncSchedule(els.driveAutoSyncSetupButton);
  } catch (error) {
    window.alert(error.message || "자동동기화 예약 설정에 실패했습니다.");
  }
});

let searchAliasData = { authors: {}, works: {} };
let searchAliasPickerItems = [];

function searchAliasNorm(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function buildSearchAliasPickerItems() {
  const type = els.searchAliasType?.value || "author";
  const seen = new Set();
  const result = [];
  [...driveAdminItems, ...postypeAdminItems].forEach((item) => {
    const author = String(item.author || item.writer || "").trim();
    const title = String(item.title || "").trim();
    if (!author) return;
    if (type === "author") {
      const key = searchAliasNorm(author);
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push({ author, title: "", label: author, search: searchAliasNorm(author) });
      return;
    }
    if (!title) return;
    const key = `${searchAliasNorm(title)}\u001f${searchAliasNorm(author)}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ author, title, label: `${title} · ${author}`, search: searchAliasNorm(`${title} ${author}`) });
  });
  return result.sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

function renderSearchAliasSuggestions(query = "") {
  if (!els.searchAliasSuggestions) return;
  const q = searchAliasNorm(query);
  const matches = searchAliasPickerItems.filter((item) => !q || item.search.includes(q)).slice(0, 40);
  els.searchAliasSuggestions.innerHTML = matches.length ? matches.map((item) => `
    <button type="button" class="alias-suggestion" data-alias-pick data-title="${escapeHtml(item.title)}" data-author="${escapeHtml(item.author)}">
      <strong>${escapeHtml(els.searchAliasType.value === "work" ? item.title : item.author)}</strong>
      ${els.searchAliasType.value === "work" ? `<small>${escapeHtml(item.author)}</small>` : ""}
    </button>`).join("") : '<div class="alias-suggestion-empty">일치하는 항목이 없습니다.</div>';
  els.searchAliasSuggestions.hidden = false;
}

function refreshSearchAliasPicker({ keepSelection = false } = {}) {
  searchAliasPickerItems = buildSearchAliasPickerItems();
  const isWork = els.searchAliasType?.value === "work";
  if (els.searchAliasTargetLabel) els.searchAliasTargetLabel.textContent = isWork ? "작품 선택" : "작가 선택";
  if (els.searchAliasTargetHint) els.searchAliasTargetHint.textContent = isWork ? "제목 또는 작가명으로 검색해 작품을 선택합니다." : "Drive와 POSTYPE에 등록된 작가 중에서 선택합니다.";
  if (els.searchAliasTargetSearch) els.searchAliasTargetSearch.placeholder = isWork ? "작품명 또는 작가명을 검색하세요" : "작가명을 검색해서 선택하세요";
  if (!keepSelection) {
    if (els.searchAliasTitle) els.searchAliasTitle.value = "";
    if (els.searchAliasAuthor) els.searchAliasAuthor.value = "";
    if (els.searchAliasTargetSearch) els.searchAliasTargetSearch.value = "";
  }
  if (els.searchAliasSuggestions) els.searchAliasSuggestions.hidden = true;
  renderSearchAliases();
}

function setSearchAliasType(type, options = {}) {
  if (!els.searchAliasType) return;
  els.searchAliasType.value = type === "work" ? "work" : "author";
  els.searchAliasTypeButtons?.forEach((button) => button.classList.toggle("is-active", button.dataset.aliasType === els.searchAliasType.value));
  refreshSearchAliasPicker(options);
}

function selectSearchAliasTarget(title, author) {
  if (els.searchAliasTitle) els.searchAliasTitle.value = title || "";
  if (els.searchAliasAuthor) els.searchAliasAuthor.value = author || "";
  if (els.searchAliasTargetSearch) els.searchAliasTargetSearch.value = els.searchAliasType.value === "work" ? `${title} · ${author}` : author;
  if (els.searchAliasSuggestions) els.searchAliasSuggestions.hidden = true;
}

function countSearchAliasMatches(entry) {
  const items = [...driveAdminItems, ...postypeAdminItems];
  const authorKey = searchAliasNorm(entry?.author || "");
  if (!authorKey) return 0;
  if (entry?.type === "author") {
    return items.filter((item) => searchAliasNorm(item.author || item.writer || "") === authorKey).length;
  }
  const titleKey = searchAliasNorm(entry?.title || "");
  if (!titleKey) return 0;
  return items.filter((item) =>
    searchAliasNorm(item.title || "") === titleKey &&
    searchAliasNorm(item.author || item.writer || "") === authorKey
  ).length;
}

function renderSearchAliases() {
  if (!els.searchAliasList) return;
  const rows = [];
  Object.values(searchAliasData.authors || {}).forEach((entry) => rows.push({ type: "author", ...entry }));
  Object.values(searchAliasData.works || {}).forEach((entry) => rows.push({ type: "work", ...entry }));
  rows.sort((a, b) => `${a.author || ""} ${a.title || ""}`.localeCompare(`${b.author || ""} ${b.title || ""}`, "ko"));
  if (els.searchAliasCount) els.searchAliasCount.textContent = `${rows.length.toLocaleString("ko-KR")}개`;
  els.searchAliasList.innerHTML = rows.length ? rows.map((entry) => {
    const matchCount = countSearchAliasMatches(entry);
    const matchLabel = matchCount > 0 ? `현재 매칭 ${matchCount.toLocaleString("ko-KR")}개` : "현재 매칭 0개 · 고아";
    return `
    <article class="alias-row ${matchCount > 0 ? "" : "is-orphan"}">
      <div class="alias-row-main"><span class="alias-kind">${entry.type === "work" ? "작품" : "작가"}</span><div><strong>${escapeHtml(entry.type === "work" ? entry.title : entry.author)}</strong>${entry.type === "work" ? `<small>${escapeHtml(entry.author)}</small>` : ""}<small class="alias-match-status">${escapeHtml(matchLabel)}</small></div></div>
      <div class="alias-chips">${(entry.aliases || []).map((alias) => `<span>${escapeHtml(alias)}</span>`).join("")}</div>
      <div class="alias-row-actions"><button type="button" class="secondary-admin-button" data-alias-edit="${entry.type}" data-title="${escapeHtml(entry.title || "")}" data-author="${escapeHtml(entry.author || "")}">수정</button><button type="button" class="secondary-admin-button" data-alias-delete="${entry.type}" data-title="${escapeHtml(entry.title || "")}" data-author="${escapeHtml(entry.author || "")}">삭제</button></div>
    </article>`;
  }).join("") : '<div class="alias-empty"><strong>아직 등록된 검색 별칭이 없습니다.</strong><span>위에서 작가나 작품을 선택해 첫 별칭을 추가해보세요.</span></div>';
}

async function loadSearchAliases() {
  const data = await api("/api/admin/search-aliases", { method: "GET" });
  searchAliasData = data.aliases || { authors: {}, works: {} };
  renderSearchAliases();
}

els.searchAliasTypeButtons?.forEach((button) => button.addEventListener("click", () => setSearchAliasType(button.dataset.aliasType)));
els.searchAliasTargetSearch?.addEventListener("focus", () => renderSearchAliasSuggestions(els.searchAliasTargetSearch.value));
els.searchAliasTargetSearch?.addEventListener("input", () => {
  els.searchAliasTitle.value = "";
  els.searchAliasAuthor.value = "";
  renderSearchAliasSuggestions(els.searchAliasTargetSearch.value);
});
els.searchAliasSuggestions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-alias-pick]");
  if (!button) return;
  selectSearchAliasTarget(button.dataset.title || "", button.dataset.author || "");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".alias-picker") && els.searchAliasSuggestions) els.searchAliasSuggestions.hidden = true;
});

els.searchAliasForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.searchAliasMessage.hidden = false;
  if (!String(els.searchAliasAuthor.value || "").trim() || (els.searchAliasType.value === "work" && !String(els.searchAliasTitle.value || "").trim())) {
    els.searchAliasMessage.textContent = els.searchAliasType.value === "work" ? "목록에서 작품을 먼저 선택해주세요." : "목록에서 작가를 먼저 선택해주세요.";
    els.searchAliasTargetSearch?.focus();
    return;
  }
  els.searchAliasMessage.textContent = "저장 중…";
  try {
    const data = await api("/api/admin/search-aliases", { method: "POST", body: JSON.stringify({
      type: els.searchAliasType.value,
      title: els.searchAliasTitle.value,
      author: els.searchAliasAuthor.value,
      aliases: els.searchAliasValues.value,
    }) });
    searchAliasData = data.aliases || searchAliasData;
    renderSearchAliases();
    els.searchAliasValues.value = "";
    refreshSearchAliasPicker();
    els.searchAliasMessage.textContent = data.changed === false
      ? "변경된 내용이 없어 다시 저장하지 않았습니다."
      : data.indexRefreshed === false
        ? (data.warning || "별칭은 저장했지만 공개 검색 인덱스는 갱신되지 않았습니다.")
        : "저장했습니다. 사용자 통합검색에 바로 반영됩니다.";
  } catch (error) { els.searchAliasMessage.textContent = error.message || "저장에 실패했습니다."; }
});

els.searchAliasList?.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-alias-edit]");
  const del = event.target.closest("[data-alias-delete]");
  const button = edit || del;
  if (!button) return;
  const type = edit ? edit.dataset.aliasEdit : del.dataset.aliasDelete;
  const title = button.dataset.title || "";
  const author = button.dataset.author || "";
  const key = type === "author" ? searchAliasNorm(author) : `${searchAliasNorm(title)}\u001f${searchAliasNorm(author)}`;
  const entry = type === "author" ? searchAliasData.authors?.[key] : searchAliasData.works?.[key];
  if (edit) {
    setSearchAliasType(type, { keepSelection: true });
    selectSearchAliasTarget(title, author);
    els.searchAliasValues.value = (entry?.aliases || []).join(", ");
    els.searchAliasValues.focus();
    els.searchAliasForm?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!window.confirm("이 검색 별칭을 삭제할까요?")) return;
  try {
    const data = await api("/api/admin/search-aliases", { method: "POST", body: JSON.stringify({ action: "delete", type, title, author }) });
    searchAliasData = data.aliases || searchAliasData;
    renderSearchAliases();
  } catch (error) { window.alert(error.message || "삭제에 실패했습니다."); }
});

setSearchAliasType("author");
loadSearchAliases().catch((error) => console.warn("검색 별칭 로딩 실패", error));

els.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.settingsMessage.hidden = false;
  els.settingsMessage.textContent = "저장 중…";

  try {
    await api("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({
        faviconUrl: els.faviconUrlInput.value,
        eyebrow: els.eyebrowInput.value,
        title: els.titleInput.value,
      }),
    });
    els.settingsMessage.textContent = "저장했습니다. 파비콘·메인 문구를 반영했습니다. 사이트 이름은 wrangler.toml의 SITE_NAME 변경 후 재배포하면 반영됩니다.";
  } catch (error) {
    els.settingsMessage.textContent = error.message;
  }
});

els.reviewList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".review-form");
  if (!form) return;
  event.preventDefault();

  const item = form.closest(".review-item");
  const button = form.querySelector("button");
  const title = form.elements.title.value.trim();
  const author = form.elements.author.value.trim();

  button.disabled = true;
  button.textContent = "저장 중…";

  try {
    await api("/api/admin/item", {
      method: "POST",
      body: JSON.stringify({
        id: item.dataset.id,
        title,
        author,
      }),
    });

    await loadAdmin();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = "저장";
  }
});

els.commitMessageInput?.addEventListener("input", () => {
  els.commitMessageInput.dataset.autoGenerated = "false";
  els.commitMessageInput.title = "직접 수정한 커밋 메시지";
});

els.zipInput.addEventListener("change", (event) => {
  if (deployInProgress) return;
  handleZipFile(event.target.files?.[0]);
});

els.zipDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.zipDropZone.classList.add("dragover");
});

els.zipDropZone.addEventListener("dragleave", () => {
  els.zipDropZone.classList.remove("dragover");
});

els.zipDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.zipDropZone.classList.remove("dragover");
  if (deployInProgress) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = "배포가 진행 중입니다. 완료된 뒤 다른 ZIP을 선택해 주세요.";
    return;
  }
  handleZipFile(event.dataTransfer.files?.[0]);
});

function normalizeVersionLabel(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^v?(\d+(?:\.\d+)*)$/i);
  return match ? `v${match[1]}` : "";
}

async function loadVersionMetadata() {
  if (!els.adminVersion) return null;

  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const version = normalizeVersionLabel(data?.version);
    if (!version) throw new Error("invalid version metadata");

    els.adminVersion.textContent = `현재 버전 ${version}`;
    if (normalizeVersionLabel(pendingDeployVersion) === version) {
      pendingDeployVersion = "";
    }
    return version;
  } catch (error) {
    console.warn("현재 버전 확인 실패", error);
    els.adminVersion.textContent = "현재 버전 확인 실패";
    return null;
  }
}

function formatHistoryDateLabel(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "-");
  return `${match[1]}. ${Number(match[2])}. ${Number(match[3])}.`;
}

function getHistoryVersion(message) {
  return String(message || "").match(/\bv?(\d+\.\d+(?:\.\d+)?)\b/i)?.[0] || "";
}

function parseHistoryDateUtc(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatHistoryBucketDate(date) {
  return date.toISOString().slice(0, 10);
}

function getHistoryActivityRows(days = [], mode = "month") {
  if (mode === "hour") {
    const counts = Array.from({ length: 24 }, () => 0);
    for (const day of days) {
      for (const entry of Array.isArray(day.entries) ? day.entries : []) {
        const hour = Number(String(entry.time || "").slice(0, 2));
        if (Number.isInteger(hour) && hour >= 0 && hour < 24) counts[hour] += 1;
      }
    }
    return counts.map((count, hour) => ({
      key: String(hour).padStart(2, "0"),
      label: `${String(hour).padStart(2, "0")}시`,
      count,
      title: `${String(hour).padStart(2, "0")}:00–${String(hour).padStart(2, "0")}:59`,
    }));
  }

  const dateCounts = new Map(days.map((day) => [String(day.date || ""), Array.isArray(day.entries) ? day.entries.length : 0]));
  const latestDate = days.map((day) => parseHistoryDateUtc(day.date)).filter(Boolean).sort((a, b) => b - a)[0];
  if (!latestDate) return [];

  if (mode === "day") {
    const rows = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const date = new Date(latestDate.getTime() - offset * 86400000);
      const key = formatHistoryBucketDate(date);
      rows.push({ key, label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`, count: dateCounts.get(key) || 0, title: key });
    }
    return rows;
  }

  if (mode === "week") {
    const weekday = latestDate.getUTCDay();
    const mondayOffset = (weekday + 6) % 7;
    const latestMonday = new Date(latestDate.getTime() - mondayOffset * 86400000);
    const rows = [];
    for (let offset = 15; offset >= 0; offset -= 1) {
      const start = new Date(latestMonday.getTime() - offset * 7 * 86400000);
      let count = 0;
      for (let i = 0; i < 7; i += 1) {
        const key = formatHistoryBucketDate(new Date(start.getTime() + i * 86400000));
        count += dateCounts.get(key) || 0;
      }
      const key = formatHistoryBucketDate(start);
      rows.push({ key, label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`, count, title: `${key} 시작 주` });
    }
    return rows;
  }

  const monthly = new Map();
  for (const day of days) {
    const month = String(day.date || "").slice(0, 7);
    if (month) monthly.set(month, (monthly.get(month) || 0) + (Array.isArray(day.entries) ? day.entries.length : 0));
  }
  const latestMonth = new Date(Date.UTC(latestDate.getUTCFullYear(), latestDate.getUTCMonth(), 1));
  const rows = [];
  for (let offset = 17; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(latestMonth.getUTCFullYear(), latestMonth.getUTCMonth() - offset, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    rows.push({ key, label: `${date.getUTCMonth() + 1}월`, count: monthly.get(key) || 0, title: key });
  }
  return rows;
}

function renderHistoryActivity(days = historyDays, mode = historyActivityMode) {
  if (!els.historyActivityGraph) return;
  const rows = getHistoryActivityRows(days, mode);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const labelEvery = mode === "day" ? 5 : mode === "hour" ? 3 : mode === "week" ? 2 : 1;

  els.historyActivityGraph.dataset.mode = mode;
  els.historyActivityGraph.innerHTML = rows.length
    ? rows.map((row, index) => {
        const height = row.count ? Math.max(6, Math.round((row.count / max) * 100)) : 2;
        const showLabel = index === 0 || index === rows.length - 1 || index % labelEvery === 0;
        const showCount = row.count > 0 && (mode === "day" || mode === "hour" ? showLabel : true);
        return `<div class="history-activity-column${row.count ? "" : " is-empty"}${showLabel ? " has-label" : ""}" title="${escapeHtml(row.title)} · ${row.count.toLocaleString("ko-KR")}개 커밋">
          <span class="history-activity-count">${showCount ? row.count.toLocaleString("ko-KR") : ""}</span>
          <i style="height:${height}%"></i>
          <small>${showLabel ? escapeHtml(row.label) : ""}</small>
        </div>`;
      }).join("")
    : `<div class="history-empty">표시할 활동 데이터가 없습니다.</div>`;

  const captions = {
    hour: "전체 기간 · 시간대별 커밋 수",
    day: "최근 30일 · 일자별 커밋 수",
    week: "최근 16주 · 주간별 커밋 수",
    month: "최근 18개월 · 월별 커밋 수",
  };
  if (els.historyActivityCaption) els.historyActivityCaption.textContent = rows.length ? captions[mode] : "활동 데이터 없음";
  els.historyActivityModes?.querySelectorAll("[data-history-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.historyMode === mode);
  });
}

function renderHistoryTimeline(days = []) {
  if (!els.historyTimeline) return;
  if (!days.length) {
    els.historyTimeline.innerHTML = `<div class="history-empty">GitHub main에 표시할 커밋 기록이 없습니다.</div>`;
    return;
  }

  els.historyTimeline.innerHTML = days.map((day, index) => {
    const entries = Array.isArray(day.entries) ? day.entries : [];
    const version = entries.map((entry) => getHistoryVersion(entry.message)).find(Boolean) || "";
    return `<article class="history-day${index === 0 ? " is-latest" : ""}">
      <div class="history-rail" aria-hidden="true"><span></span></div>
      <button class="history-day-card" type="button" data-history-date="${escapeHtml(day.date)}" aria-label="${escapeHtml(formatHistoryDateLabel(day.date))} 변경 내역 보기">
        <div class="history-day-head">
          <div>
            <time datetime="${escapeHtml(day.date)}">${escapeHtml(formatHistoryDateLabel(day.date))}</time>
            ${version ? `<b>${escapeHtml(version)}</b>` : ""}
          </div>
          <span>${entries.length.toLocaleString("ko-KR")} changes <em>상세보기 ›</em></span>
        </div>
      </button>
    </article>`;
  }).join("");
}

function closeHistoryModal() {
  if (!els.historyDetailModal) return;
  els.historyDetailModal.hidden = true;
  document.body.classList.remove("history-modal-open");
}

function openHistoryModal(date) {
  const day = historyDays.find((item) => item.date === date);
  if (!day || !els.historyDetailModal) return;
  const entries = Array.isArray(day.entries) ? day.entries : [];
  const versions = [...new Set(entries.map((entry) => getHistoryVersion(entry.message)).filter(Boolean))];
  if (els.historyModalTitle) els.historyModalTitle.textContent = formatHistoryDateLabel(day.date);
  if (els.historyModalMeta) els.historyModalMeta.textContent = "";
  if (els.historyModalVersionButton) {
    els.historyModalVersionButton.textContent = `${entries.length.toLocaleString("ko-KR")}개 변경`;
    els.historyModalVersionButton.setAttribute("aria-expanded", "false");
    els.historyModalVersionButton.disabled = versions.length === 0;
  }
  if (els.historyModalVersions) {
    els.historyModalVersions.hidden = true;
    els.historyModalVersions.innerHTML = versions.length
      ? `<span>포함 버전</span><div>${versions.map((version) => `<b>${escapeHtml(version)}</b>`).join("")}</div>`
      : "";
  }
  if (els.historyModalEntries) {
    els.historyModalEntries.innerHTML = entries.length
      ? entries.map((entry) => `<div class="history-modal-entry">
          <time>${escapeHtml(entry.time || "--:--")}</time>
          <p>${escapeHtml(entry.message || "변경사항 기록")}</p>
        </div>`).join("")
      : `<div class="history-empty">표시할 변경 내역이 없습니다.</div>`;
  }
  els.historyDetailModal.hidden = false;
  document.body.classList.add("history-modal-open");
  els.historyModalCloseButton?.focus();
}

els.historyActivityModes?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-mode]");
  if (!button) return;
  const mode = button.dataset.historyMode;
  if (!["hour", "day", "week", "month"].includes(mode)) return;
  historyActivityMode = mode;
  renderHistoryActivity(historyDays, historyActivityMode);
});

els.historyModalVersionButton?.addEventListener("click", () => {
  if (!els.historyModalVersions || els.historyModalVersionButton.disabled) return;
  const nextExpanded = els.historyModalVersions.hidden;
  els.historyModalVersions.hidden = !nextExpanded;
  els.historyModalVersionButton.setAttribute("aria-expanded", String(nextExpanded));
});

els.historyTimeline?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-date]");
  if (button) openHistoryModal(button.dataset.historyDate);
});

els.historyModalCloseButton?.addEventListener("click", closeHistoryModal);
els.historyDetailModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-history-modal-close]")) closeHistoryModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.historyDetailModal && !els.historyDetailModal.hidden) closeHistoryModal();
});

async function loadHistory(force = false) {
  if (historyLoaded && !force) return;
  if (els.historyMessage) els.historyMessage.hidden = true;
  if (els.historyRefreshButton) els.historyRefreshButton.disabled = true;

  try {
    const data = await api("/api/admin/history", { method: "GET" });
    const summary = data?.summary || {};
    const days = Array.isArray(data?.days) ? data.days : [];
    historyDays = days;

    if (els.historyFirstDate) els.historyFirstDate.textContent = summary.firstDate ? formatHistoryDateLabel(summary.firstDate) : "-";
    if (els.historyCommitCount) els.historyCommitCount.textContent = Number(summary.commitCount || 0).toLocaleString("ko-KR");
    if (els.historyActiveDays) els.historyActiveDays.textContent = Number(summary.activeDays || 0).toLocaleString("ko-KR");
    if (els.historyLastDate) els.historyLastDate.textContent = summary.lastDate ? formatHistoryDateLabel(summary.lastDate) : "-";

    renderHistoryActivity(days, historyActivityMode);
    renderHistoryTimeline(days);
    if (data?.source === "github-main" && els.historyMessage) {
      els.historyMessage.hidden = false;
      els.historyMessage.textContent = "GitHub main의 실제 커밋 이력입니다. 최대 5분간 캐시되며, Cloudflare 배포 횟수와는 별도입니다.";
    }
    historyLoaded = true;
  } finally {
    if (els.historyRefreshButton) els.historyRefreshButton.disabled = false;
  }
}

els.historyRefreshButton?.addEventListener("click", () => {
  historyLoaded = false;
  loadHistory(true).catch((error) => {
    if (els.historyMessage) {
      els.historyMessage.hidden = false;
      els.historyMessage.textContent = error.message || "개발 히스토리를 불러오지 못했습니다.";
    }
  });
});

function setDeployStatusVisual(item, stateName) {
  if (!item) return;
  item.classList.remove("is-waiting", "is-building", "is-success", "is-failure");
  item.classList.add(
    stateName === "success" ? "is-success" :
    stateName === "failure" ? "is-failure" :
    stateName === "building" ? "is-building" :
    "is-waiting"
  );
}

function showDeployCommitCreated(sha, commitUrl) {
  activeDeployCommitSha = String(sha || "");
  activeDeployCommitUrl = String(commitUrl || "");
  if (activeDeployCommitSha) localStorage.setItem("archiveAdminLastDeploySha", activeDeployCommitSha);
  if (activeDeployCommitUrl) localStorage.setItem("archiveAdminLastDeployUrl", activeDeployCommitUrl);

  els.deployStatusCard.hidden = false;
  setDeployStatusVisual(els.deployCommitStatusItem, "success");
  els.deployCommitStatusText.textContent = "커밋 완료";
  const shortSha = activeDeployCommitSha.slice(0, 7);
  els.deployCommitStatusMeta.innerHTML = activeDeployCommitUrl
    ? `${escapeHtml(shortSha)} · <a href="${escapeHtml(activeDeployCommitUrl)}" target="_blank" rel="noopener">커밋 보기 ↗</a>`
    : escapeHtml(shortSha);

  setDeployStatusVisual(els.deployCloudflareStatusItem, "waiting");
  els.deployCloudflareStatusText.textContent = "배포 시작 대기";
  els.deployCloudflareStatusMeta.textContent = "GitHub 커밋을 감지한 뒤 Cloudflare Pages 빌드가 시작됩니다.";
}

function renderDeployStatus(data) {
  if (!data) return;
  els.deployStatusCard.hidden = false;

  setDeployStatusVisual(els.deployCommitStatusItem, "success");
  els.deployCommitStatusText.textContent = "커밋 완료";

  const shortSha = String(data.commitSha || activeDeployCommitSha || "").slice(0, 7);
  const commitUrl = data.commitUrl || activeDeployCommitUrl || "";
  els.deployCommitStatusMeta.innerHTML = commitUrl
    ? `${escapeHtml(shortSha)} · <a href="${escapeHtml(commitUrl)}" target="_blank" rel="noopener">커밋 보기 ↗</a>`
    : escapeHtml(shortSha);

  const cfState = data.cloudflare?.state || "waiting";
  const cfLabel =
    cfState === "building" ? "Building" :
    cfState === "success" ? "배포 완료" :
    cfState === "failure" ? "배포 실패" :
    "배포 시작 대기";

  setDeployStatusVisual(els.deployCloudflareStatusItem, cfState);
  els.deployCloudflareStatusText.textContent = cfLabel;

  const details = [];
  if (data.cloudflare?.name) details.push(escapeHtml(data.cloudflare.name));
  if (data.cloudflare?.detailsUrl) {
    details.push(`<a href="${escapeHtml(data.cloudflare.detailsUrl)}" target="_blank" rel="noopener">상세/로그 확인 ↗</a>`);
  }
  if (data.checkedAt) details.push(`확인 ${escapeHtml(formatDate(data.checkedAt))}`);
  if (!details.length && cfState === "waiting") {
    details.push("GitHub Checks에서 Cloudflare Pages 상태를 기다리는 중입니다.");
  }
  els.deployCloudflareStatusMeta.innerHTML = details.join(" · ");

  if (cfState === "success") {
    loadVersionMetadata();
  }
}

function stopDeployStatusPolling() {
  if (!deployStatusTimer) return;
  clearTimeout(deployStatusTimer);
  deployStatusTimer = null;
}

async function refreshDeployStatus({ keepPolling = false } = {}) {
  const sha = activeDeployCommitSha || localStorage.getItem("archiveAdminLastDeploySha") || "";
  if (!sha) return;

  activeDeployCommitSha = sha;

  try {
    const data = await api(`/api/admin/deploy?sha=${encodeURIComponent(sha)}`, { method: "GET" });
    renderDeployStatus(data);

    const cfState = data.cloudflare?.state || "waiting";
    if (keepPolling && (cfState === "waiting" || cfState === "building")) {
      stopDeployStatusPolling();
      deployStatusTimer = setTimeout(() => refreshDeployStatus({ keepPolling: true }), 3500);
    } else {
      stopDeployStatusPolling();
    }
  } catch (error) {
    els.deployStatusCard.hidden = false;
    setDeployStatusVisual(els.deployCloudflareStatusItem, "failure");
    els.deployCloudflareStatusText.textContent = "상태 확인 실패";
    els.deployCloudflareStatusMeta.textContent = error.message || "배포 상태를 확인하지 못했습니다.";

    if (keepPolling) {
      stopDeployStatusPolling();
      deployStatusTimer = setTimeout(() => refreshDeployStatus({ keepPolling: true }), 5000);
    }
  }
}

els.deployStatusRefreshButton?.addEventListener("click", () => {
  refreshDeployStatus({ keepPolling: false });
});

els.deployButton.addEventListener("click", async () => {
  if (deployInProgress || !deployFiles.length) return;

  // 배포 시작 순간의 ZIP/버전/종류를 고정한다. 배치 업로드 도중
  // 다른 ZIP을 선택해 서로 다른 소스가 한 커밋에 섞이는 일을 막는다.
  const deployment = {
    files: deployFiles.map((file) => ({ ...file })),
    version: pendingDeployVersion,
    kind: pendingDeployKind,
    message: els.commitMessageInput.value.trim() || "Archive site update",
  };
  deployInProgress = true;
  if (els.zipInput) els.zipInput.disabled = true;
  if (els.commitMessageInput) els.commitMessageInput.disabled = true;
  els.zipDropZone?.classList.add("is-disabled");

  const message = deployment.message;

  els.deployButton.disabled = true;
  els.deployButton.textContent = "GitHub 커밋 중…";
  els.deployMessage.hidden = false;
  els.deployMessage.textContent = "GitHub에 변경사항을 커밋하고 있습니다…";

  try {
    // Workers Free의 외부 subrequest 한도를 피하기 위해 GitHub blob 생성은
    // 여러 invocation으로 나누고, 마지막에 한 번만 tree/commit/ref를 생성한다.
    const batchSize = 30;
    const treeEntries = [];
    const totalBatches = Math.ceil(deployment.files.length / batchSize);

    for (let i = 0; i < deployment.files.length; i += batchSize) {
      const batch = deployment.files.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      els.deployButton.textContent = `파일 준비 ${batchNumber}/${totalBatches}`;
      els.deployMessage.textContent =
        `GitHub 파일을 준비하고 있습니다… (${Math.min(i + batch.length, deployment.files.length)}/${deployment.files.length})`;

      const prepared = await api("/api/admin/deploy", {
        method: "POST",
        body: JSON.stringify({
          mode: "blobs",
          files: batch.map(({ path, contentBase64 }) => ({ path, contentBase64 })),
        }),
      });

      if (Array.isArray(prepared.entries)) treeEntries.push(...prepared.entries);
    }

    if (treeEntries.length !== deployment.files.length) {
      throw new Error(`파일 준비 수가 일치하지 않습니다. (${treeEntries.length}/${deployment.files.length})`);
    }

    els.deployButton.textContent = "GitHub 커밋 중…";
    els.deployMessage.textContent = "준비된 파일을 하나의 커밋으로 생성하고 있습니다…";

    const result = await api("/api/admin/deploy", {
      method: "POST",
      body: JSON.stringify({
        mode: "commit",
        message,
        deployVersion: deployment.kind === "mobile" ? "" : deployment.version,
        entries: treeEntries,
      }),
    });

    els.deployMessage.innerHTML =
      `GitHub 커밋 완료 · ${result.deployedFiles.length.toLocaleString("ko-KR")}개 파일<br>` +
      `아래에서 Cloudflare Pages 빌드 상태를 자동으로 확인합니다.`;

    showDeployCommitCreated(result.commitSha, result.commitUrl);
    if (deployment.kind !== "mobile" && deployment.version && els.adminVersion) {
      els.adminVersion.textContent = `배포 중 ${deployment.version}`;
    }
    refreshDeployStatus({ keepPolling: true });
    historyLoaded = false;

    deployFiles = [];
    deployBlocked = [];
    pendingDeployKind = "web";
    pendingDeployVersion = "";
    els.deployPreview.hidden = true;
    els.zipInput.value = "";
  } catch (error) {
    els.deployMessage.textContent = error.message;
  } finally {
    deployInProgress = false;
    if (els.zipInput) els.zipInput.disabled = false;
    if (els.commitMessageInput) els.commitMessageInput.disabled = false;
    els.zipDropZone?.classList.remove("is-disabled");
    els.deployButton.disabled = deployFiles.length === 0;
    els.deployButton.textContent = "GitHub에 배포";
  }
});



els.feedbackRefreshButton?.addEventListener("click", () => {
  feedbackAdminLoaded = false;
  loadFeedbackAdmin().catch((error) => {
    els.feedbackAdminMessage.hidden = false;
    els.feedbackAdminMessage.textContent = error.message || "의견함을 불러오지 못했습니다.";
  });
});

document.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-feedback-filter]");
  if (filterButton) {
    feedbackAdminFilter = filterButton.dataset.feedbackFilter || "all";
    feedbackAdminLoaded = false;
    loadFeedbackAdmin().catch(console.error);
    return;
  }
  const userOpenButton = event.target.closest("[data-feedback-user-open]");
  if (userOpenButton) {
    openAdminUserFromFeedback(userOpenButton.dataset.feedbackUserOpen || "");
    return;
  }

  const copyButton = event.target.closest("[data-feedback-copy]");
  if (copyButton) {
    const original = copyButton.textContent;
    copyAdminText(copyButton.dataset.feedbackCopy || "").then((copied) => {
      copyButton.textContent = copied ? "복사됨" : "복사 실패";
      window.setTimeout(() => { copyButton.textContent = original; }, 1200);
    });
    return;
  }

  const contextButton = event.target.closest("[data-feedback-context]");
  if (contextButton) {
    const card = contextButton.closest("[data-feedback-id]");
    const detail = card?.querySelector("[data-feedback-diagnostic]");
    if (detail) {
      const opening = detail.hidden;
      detail.hidden = !opening;
      contextButton.setAttribute("aria-expanded", opening ? "true" : "false");
      const arrow = contextButton.querySelector("span");
      if (arrow) arrow.textContent = opening ? "▴" : "▾";
    }
    return;
  }

  const statusButton = event.target.closest("[data-feedback-status]");
  if (!statusButton) return;
  const card = statusButton.closest("[data-feedback-id]");
  const id = Number(card?.dataset.feedbackId || 0);
  if (!id) return;
  const nextStatus = statusButton.dataset.feedbackStatus;
  if (card?.dataset.feedbackCategory === "계정 문의" && nextStatus === "done") {
    const confirmed = window.confirm("계정 문의를 처리완료로 바꾸면 저장된 답변 연락수단이 삭제됩니다. 처리완료로 변경할까요?");
    if (!confirmed) return;
  }
  statusButton.disabled = true;
  api("/api/admin/feedback", {
    method: "PATCH",
    body: JSON.stringify({ id, status: nextStatus }),
  }).then(() => {
    feedbackAdminLoaded = false;
    return loadFeedbackAdmin();
  }).catch((error) => {
    els.feedbackAdminMessage.hidden = false;
    els.feedbackAdminMessage.textContent = error.message || "상태를 변경하지 못했습니다.";
  }).finally(() => {
    statusButton.disabled = false;
  });
});

els.adminLogoutButton?.addEventListener("click", async () => {
  try {
    await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "same-origin",
    });
  } finally {
    window.location.replace("/admin");
  }
});

addPostypeBulkRows(5);

ensureMobileReleasePanel();
loadMobileReleaseState().catch((error) => {
  console.warn("Android 앱 배포 상태 로딩 실패", error);
  showMobileReleaseStatus(
    error.message || "Android 앱 상태를 불러오지 못했습니다.",
    "error"
  );
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-source-jump]");
  if (!button) return;
  setActiveTab(button.dataset.sourceJump);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

loadVersionMetadata();

if (activeDeployCommitSha) {
  refreshDeployStatus({ keepPolling: false });
}

loadAdmin().catch((error) => {
  console.error(error);
  if (String(error?.message || "").includes("로그인")) {
    window.location.replace("/admin");
  }
});
// Admin statistics export: load the local OOXML writer only on demand.
const statsModal = document.getElementById('statsExportModal');
const statsOpen = document.getElementById('statsExportOpen');
const statsPeriod = document.getElementById('visitPeriodSelect');
let reportWriterPromise = null;
let exportingStats = false;
function closeStatsExport() {
  if (exportingStats || !statsModal) return;
  statsModal.hidden = true;
  document.body.classList.remove('history-modal-open');
  statsOpen?.focus();
}
statsOpen?.addEventListener('click', () => {
  statsModal.hidden = false;
  document.body.classList.add('history-modal-open');
  document.getElementById('statsExportPeriod').focus();
});
statsModal?.querySelectorAll('[data-export-close]').forEach(button => button.addEventListener('click', closeStatsExport));
document.addEventListener('keydown', event => {
  if (!statsModal || statsModal.hidden) return;
  if (event.key === 'Escape') closeStatsExport();
  if (event.key === 'Tab') {
    const nodes = [...statsModal.querySelectorAll('button,input,select')].filter(node=>!node.disabled);
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
});
statsPeriod?.addEventListener('change', async () => {
  const previous=visitPeriodDays;
  visitPeriodDays=statsPeriod.value;
  statsPeriod.disabled=true;
  try { await loadUserAdminData(false, true); }
  catch(error){visitPeriodDays=previous;statsPeriod.value=previous;window.alert(error.message);}
  finally{statsPeriod.disabled=false;}
});
function loadReportWriter() {
  if (window.AdminReportXlsx) return Promise.resolve();
  if (!reportWriterPromise) reportWriterPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='/admin-report-xlsx.js?v=961';
    script.onload=()=>window.AdminReportXlsx?resolve():reject(new Error('XLSX 생성기를 불러오지 못했습니다.'));
    script.onerror=()=>{script.remove();reject(new Error('XLSX 생성기를 불러오지 못했습니다. 다시 시도해 주세요.'));};
    document.head.appendChild(script);
  }).catch(error=>{reportWriterPromise=null;throw error;});
  return reportWriterPromise;
}
document.getElementById('statsExportForm')?.addEventListener('submit', async event => {
  event.preventDefault();if(exportingStats)return;
  const button=document.getElementById('statsExportGenerate'),status=document.getElementById('statsExportStatus');
  const choice=document.getElementById('statsExportPeriod').value;
  const include=[...statsModal.querySelectorAll('input[name=section]:checked')].map(node=>node.value);
  exportingStats=true;button.disabled=true;status.textContent='데이터를 같은 기준 시각으로 조회하고 있습니다…';
  try{
    const report=await api('/api/admin/stats-export',{method:'POST',body:JSON.stringify({days:choice==='current'?visitPeriodDays:choice,include})});
    if(report.validationFailed)throw new Error('일부 통계 검증 불일치가 발견되어 다운로드를 중단했습니다. 다시 조회해 주세요.');
    status.textContent='XLSX를 생성하고 있습니다…';await loadReportWriter();
    const blob=window.AdminReportXlsx.create(report),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=report.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    status.textContent='완료 · XLSX 생성 및 검산을 마쳤습니다. 저장되지 않은 이력/제외 항목은 N/A로 표시됩니다.';
  }catch(error){status.textContent='실패 · '+(error.message||'통계를 내보내지 못했습니다.');}
  finally{exportingStats=false;button.disabled=false;}
});
