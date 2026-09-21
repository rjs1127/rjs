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
  driveListBody: document.getElementById("driveListBody"),
  driveListPagination: document.getElementById("driveListPagination"),
  driveListEmpty: document.getElementById("driveListEmpty"),
  driveListMessage: document.getElementById("driveListMessage"),
  driveSummaryFilters: document.getElementById("driveSummaryFilters"),
  settingsForm: document.getElementById("settingsForm"),
  faviconUrlInput: document.getElementById("faviconUrlInput"),
  eyebrowInput: document.getElementById("eyebrowInput"),
  titleInput: document.getElementById("titleInput"),
  settingsMessage: document.getElementById("settingsMessage"),
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
  dashboardTodayVisits: document.getElementById("dashboardTodayVisits"),
  dashboardTotalVisits: document.getElementById("dashboardTotalVisits"),
  dashboardChart: document.getElementById("dashboardChart"),
  dashboardDailyList: document.getElementById("dashboardDailyList"),
  dashboardRefreshButton: document.getElementById("dashboardRefreshButton"),
  userCountBadge: document.getElementById("userCountBadge"),
  userSearchInput: document.getElementById("userSearchInput"),
  userRefreshButton: document.getElementById("userRefreshButton"),
  userTableBody: document.getElementById("userTableBody"),
  userEmpty: document.getElementById("userEmpty"),
  userMessage: document.getElementById("userMessage"),
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
  tabs: Array.from(document.querySelectorAll("[data-tab-target]")),
  panels: Array.from(document.querySelectorAll("[data-tab-panel]")),
};

let deployFiles = [];
let deployBlocked = [];
let deployStatusTimer = null;
let activeDeployCommitSha = localStorage.getItem("archiveAdminLastDeploySha") || "";
let activeDeployCommitUrl = localStorage.getItem("archiveAdminLastDeployUrl") || "";
let pendingDeployVersion = "";
let userAdminData = {
  summary: {},
  daily: [],
  users: [],
};

let postypeCpOptionsHtml = "";
let postypeAdminItems = [];
let postypeAdminLoaded = false;
const POSTYPE_ADMIN_PAGE_SIZE = 30;
let postypeAdminPage = 1;
let driveAdminItems = [];
let driveAdminLoaded = false;
const DRIVE_ADMIN_PAGE_SIZE = 30;
let driveAdminPage = 1;
let driveAdminFilter = "all";
let resourceUsageLoaded = false;
let resourceUsageData = null;
let resourceAnalyticsPeriod = "today";
let resourcePagesVisibleLimit = 10;

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

  const data = await response.json();

  if (response.status === 401) {
    window.location.replace("/admin");
    throw new Error("관리자 로그인이 만료되었습니다.");
  }

  if (!response.ok) throw new Error(data?.error || "요청에 실패했습니다.");
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

  if (name === "deploy" && activeDeployCommitSha) {
    refreshDeployStatus({ keepPolling: false });
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

  if (name === "postype" && !postypeAdminLoaded) {
    loadPostypeAdminList().catch((error) => {
      console.error(error);
      if (els.postypeListMessage) {
        els.postypeListMessage.hidden = false;
        els.postypeListMessage.textContent = error.message || "POSTYPE 목록을 불러오지 못했습니다.";
      }
    });
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

  els.dashboardTotalUsers.textContent =
    Number(summary.totalUsers || 0).toLocaleString("ko-KR");
  els.dashboardTodaySignups.textContent =
    Number(summary.todaySignups || 0).toLocaleString("ko-KR");
  els.dashboardTodayVisits.textContent =
    Number(summary.todayVisits || 0).toLocaleString("ko-KR");
  els.dashboardTotalVisits.textContent =
    Number(summary.totalVisits || 0).toLocaleString("ko-KR");

  const maxValue = Math.max(
    1,
    ...daily.flatMap((row) => [
      Number(row.signups || 0),
      Number(row.visits || 0),
    ])
  );

  els.dashboardChart.innerHTML = daily.map((row) => {
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

  els.dashboardDailyList.innerHTML = [...daily]
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
          <button class="user-action-button" type="button" data-user-action="reset_sessions">세션 초기화</button>
          <button class="user-action-button danger" type="button" data-user-action="delete_user">계정 삭제</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function loadUserAdminData(showMessage = false) {
  const data = await api("/api/admin/users?days=14");

  userAdminData = {
    summary: data.summary || {},
    daily: data.daily || [],
    users: data.users || [],
  };

  renderDashboard(userAdminData);
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
    `${availableCount}/3 dataset · GraphQL ${Number(
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

async function loadDriveAdminList() {
  if (!els.driveListBody) return;

  els.driveListMessage.hidden = false;
  els.driveListMessage.textContent = "Drive 작품형태 목록을 불러오는 중입니다…";

  const data = await api("/api/admin/drive-items", {
    method: "GET",
  });

  driveAdminItems = (data.items || []).map((item) => ({
    ...item,
    overrideContentType:
      String(item.overrideContentType || ""),
    draftOverrideContentType:
      String(item.overrideContentType || ""),
    overrideStatus:
      String(item.overrideStatus || ""),
    draftOverrideStatus:
      String(item.overrideStatus || ""),
  }));

  driveAdminPage = 1;
  driveAdminFilter = "all";
  driveAdminLoaded = true;
  renderDriveAdminList();

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
    const data = await api("/api/admin/drive-items", {
      method: "POST",
      body: JSON.stringify({
        updates: dirtyItems.map((item) => ({
          id: item.id,
          contentType:
            item.draftOverrideContentType || "auto",
          status:
            item.draftOverrideStatus || "auto",
        })),
      }),
    });

    dirtyItems.forEach((item) => {
      item.overrideContentType =
        item.draftOverrideContentType || "";
      item.contentType =
        item.overrideContentType ||
        item.autoContentType;
      item.overrideStatus =
        item.contentType === "연재물"
          ? (item.draftOverrideStatus || "")
          : "";
      item.draftOverrideStatus = item.overrideStatus;
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

function getSortedPostypeAdminItems() {
  return [...postypeAdminItems].sort((a, b) => {
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
        <td class="postype-library-title">${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title || "제목 없음")}</a>` : escapeHtml(item.title || "제목 없음")}<div class="postype-library-sub">${escapeHtml(item.genre || "-")}${item.enabled === "N" ? " · 숨김" : ""}</div></td>
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
  postypeAdminItems = (data.items || []).map((item) => ({
    ...item,
    latestPublishedDate: String(item.latestPublishedDate || ""),
    draftLatestPublishedDate: String(item.latestPublishedDate || ""),
    publishType: String(item.publishType || (["series", "manual"].includes(item.linkType) ? "다회차" : "단일글")),
    draftPublishType: String(item.publishType || (["series", "manual"].includes(item.linkType) ? "다회차" : "단일글")),
    status: String(item.status || "완결"),
    draftStatus: String(item.status || "완결"),
  }));
  postypeAdminLoaded = true;
  renderPostypeAdminList();

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
  const data = await api("/api/admin/data");

  let archiveData = { items: [], postypeSyncedAt: null };
  try {
    archiveData = await api("/api/archive", { method: "GET" });
  } catch (error) {
    console.warn("상단 소스 요약 로딩 실패", error);
  }

  const reviewCount = Array.isArray(data.needsReview) ? data.needsReview.length : 0;
  const editedCount = Number(data.editedCount || 0);
  const totalCount = Number(data.count || 0);
  const normalCount = Math.max(0, totalCount - reviewCount - editedCount);

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
  ]);

  if (protectedExact.has(normalized)) {
    return { allowed: false, path: normalized, reason: "보호된 설정 파일" };
  }

  if (
    normalized.startsWith(".git/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("credentials/") ||
    normalized.startsWith("secrets/")
  ) {
    return { allowed: false, path: normalized, reason: "보호된 경로" };
  }

  if (
    /(^|\/)(service[-_]?account|credentials|secret|secrets)(\.|\/|$)/i.test(normalized)
  ) {
    return { allowed: false, path: normalized, reason: "민감정보 가능 파일" };
  }

  if (!(normalized.startsWith("public/") || normalized.startsWith("functions/") || (normalized === "README.md" || normalized === "DEVELOPMENT_GUIDE.md"))) {
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
  const headingPattern = /^##\s+(v(\d+)(?:\.(\d+))?(?:\.(\d+))?)(?:\s+.*)?$/gm;
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
  const nextHeading = after.match(/^##\s+v\d+(?:\.\d+)*(?:\s+.*)?$/m);
  const section = nextHeading ? after.slice(0, nextHeading.index) : after;

  return { version: latest.version, section };
}

function buildCommitMessageFromReadme(
  readmeText,
  fallbackFileCount = 0,
  zipFileName = ""
) {
  const { version, section } = getLatestReadmeVersionSection(readmeText);

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

  for (const entry of entries) {
    const normalizedEntryPath = normalizeZipPath(entry.name);

    if (!entry.dir && normalizedEntryPath === "README.md") {
      try {
        readmeText = await entry.async("string");
      } catch {
        readmeText = "";
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

    if (bytes.byteLength > 6 * 1024 * 1024) {
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

  const autoMessage = buildCommitMessageFromReadme(
    readmeText,
    allowed.length,
    file.name
  );

  const readmeVersion = getLatestReadmeVersionSection(readmeText).version;
  const zipVersionMatch = String(file.name || "").match(/v[0-9]+(?:[_\.][0-9]+)*/i);
  pendingDeployVersion = readmeVersion || (
    zipVersionMatch ? zipVersionMatch[0].replaceAll("_", ".").toLowerCase() : ""
  );

  if (els.commitMessageInput) {
    els.commitMessageInput.value = autoMessage;
    els.commitMessageInput.dataset.autoGenerated = "true";
    els.commitMessageInput.title = readmeText
      ? "README.md 최신 버전 변경사항으로 자동 생성됨"
      : "README.md를 찾지 못해 ZIP 이름/파일 수 기준으로 자동 생성됨";
  }

  renderDeployPreview();

  if (els.deployMessage) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = readmeText
      ? `커밋 메시지 자동 생성 완료: ${autoMessage}`
      : `README.md를 찾지 못해 기본 커밋 메시지를 생성했습니다: ${autoMessage}`;
  }
}

function renderDeployPreview() {
  els.deployPreview.hidden = false;
  els.deployFileSummary.textContent =
    `배포 ${deployFiles.length.toLocaleString("ko-KR")}개 · 제외 ${deployBlocked.length.toLocaleString("ko-KR")}개`;

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

els.dashboardRefreshButton?.addEventListener("click", async () => {
  els.dashboardRefreshButton.disabled = true;
  try {
    await loadUserAdminData(false);
  } catch (error) {
    window.alert(error.message || "대시보드를 불러오지 못했습니다.");
  } finally {
    els.dashboardRefreshButton.disabled = false;
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

els.userTableBody?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-user-action]");
  if (!button) return;

  const row = button.closest("[data-user-id]");
  const userId = row?.dataset.userId;
  const action = button.dataset.userAction;

  if (!userId || !action) return;

  const confirmed = window.confirm(
    action === "delete_user"
      ? `${userId} 계정을 삭제할까요?\n이어보기, 북마크, 최근 조회, 방문 기록과 로그인 세션이 모두 삭제됩니다.`
      : `${userId} 계정의 모든 로그인 세션을 초기화할까요?\n현재 로그인된 기기들은 다시 로그인해야 합니다.`
  );

  if (!confirmed) return;

  button.disabled = true;

  try {
    await api("/api/admin/user-action", {
      method: "POST",
      body: JSON.stringify({ action, userId }),
    });

    await loadUserAdminData(false);

    els.userMessage.hidden = false;
    els.userMessage.textContent =
      action === "delete_user"
        ? `${userId} 계정을 삭제했습니다.`
        : `${userId} 계정의 로그인 세션을 초기화했습니다.`;
  } catch (error) {
    els.userMessage.hidden = false;
    els.userMessage.textContent = error.message || "작업에 실패했습니다.";
  } finally {
    button.disabled = false;
  }
});

els.syncButton.addEventListener("click", async () => {
  els.syncButton.disabled = true;
  els.syncMessage.hidden = false;
  els.syncMessage.textContent = "Google Drive를 다시 읽는 중입니다…";

  try {
    const data = await api("/api/admin/sync", {
      method: "POST",
      body: "{}",
    });
    const reconciled = Number(data.reconciledCount || 0);
    els.syncMessage.textContent =
      reconciled > 0
        ? `동기화 완료: ${data.count.toLocaleString("ko-KR")}개 · 정상 파일명으로 복원 ${reconciled.toLocaleString("ko-KR")}개`
        : `동기화 완료: ${data.count.toLocaleString("ko-KR")}개`;
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
    await api("/api/admin/sync", {
      method: "POST",
      body: JSON.stringify({}),
    });
    driveAdminLoaded = false;
    await loadDriveAdminList();
    els.driveListMessage.textContent =
      "Drive 재동기화 및 작품형태 목록 갱신 완료";
  } catch (error) {
    els.driveListMessage.textContent =
      error.message || "Drive 다시 읽기에 실패했습니다.";
  } finally {
    els.driveRescanButton.disabled = false;
  }
});

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
  const totalPages = Math.max(1, Math.ceil(postypeAdminItems.length / POSTYPE_ADMIN_PAGE_SIZE));
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
    const data = await api("/api/admin/postype-published-sync", {
      method: "POST",
      body: JSON.stringify({
        updates: dirtyItems.map((item) => ({
          id: item.id,
          latestPublishedDate: item.draftLatestPublishedDate || "",
          publishType: item.draftPublishType || "단일글",
          status: item.draftStatus || "완결",
        })),
      }),
    });

    els.postypeListMessage.textContent =
      (data.sheetUpdatedCount
        ? `시트 ${Number(data.sheetUpdatedCount).toLocaleString("ko-KR")}개 변경 반영`
        : "시트 변경사항 없음") +
      " · " +
      (data.kvWritten
        ? "KV 업데이트 1회"
        : "KV 업데이트 생략");

    await loadPostypeAdminList(false);
    els.postypeListMessage.hidden = false;
    els.postypeListMessage.textContent =
      (data.sheetUpdatedCount
        ? `시트 ${Number(data.sheetUpdatedCount).toLocaleString("ko-KR")}개 변경 반영`
        : "시트 변경사항 없음") +
      " · " +
      (data.kvWritten
        ? "KV 업데이트 1회"
        : "KV 업데이트 생략");
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

    els.postypeBulkMessage.textContent =
      "일괄 등록 완료: " + Number(data.addedCount || 0).toLocaleString("ko-KR") +
      "개 · " + data.firstId + " ~ " + data.lastId +
      " · 현재 노출 " + Number(data.count || 0).toLocaleString("ko-KR") + "개";

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
    const data = await api("/api/admin/postype-sync", {
      method: "POST",
      body: "{}",
    });

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
  handleZipFile(event.dataTransfer.files?.[0]);
});

async function loadVersionMetadata() {
  if (!els.adminVersion) return null;

  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const version = String(data?.version || "").trim();
    if (!/^v\d+(?:\.\d+)*$/i.test(version)) {
      throw new Error("invalid version metadata");
    }

    els.adminVersion.textContent = `현재 버전 ${version}`;
    if (pendingDeployVersion.toLowerCase() === version.toLowerCase()) {
      pendingDeployVersion = "";
    }
    return version;
  } catch (error) {
    console.warn("현재 버전 확인 실패", error);
    return null;
  }
}

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
  if (!deployFiles.length) return;

  const message = els.commitMessageInput.value.trim() || "Archive site update";

  els.deployButton.disabled = true;
  els.deployButton.textContent = "GitHub 커밋 중…";
  els.deployMessage.hidden = false;
  els.deployMessage.textContent = "GitHub에 변경사항을 커밋하고 있습니다…";

  try {
    // Workers Free의 외부 subrequest 한도를 피하기 위해 GitHub blob 생성은
    // 여러 invocation으로 나누고, 마지막에 한 번만 tree/commit/ref를 생성한다.
    const batchSize = 30;
    const treeEntries = [];
    const totalBatches = Math.ceil(deployFiles.length / batchSize);

    for (let i = 0; i < deployFiles.length; i += batchSize) {
      const batch = deployFiles.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      els.deployButton.textContent = `파일 준비 ${batchNumber}/${totalBatches}`;
      els.deployMessage.textContent =
        `GitHub 파일을 준비하고 있습니다… (${Math.min(i + batch.length, deployFiles.length)}/${deployFiles.length})`;

      const prepared = await api("/api/admin/deploy", {
        method: "POST",
        body: JSON.stringify({
          mode: "blobs",
          files: batch.map(({ path, contentBase64 }) => ({ path, contentBase64 })),
        }),
      });

      if (Array.isArray(prepared.entries)) treeEntries.push(...prepared.entries);
    }

    if (treeEntries.length !== deployFiles.length) {
      throw new Error(`파일 준비 수가 일치하지 않습니다. (${treeEntries.length}/${deployFiles.length})`);
    }

    els.deployButton.textContent = "GitHub 커밋 중…";
    els.deployMessage.textContent = "준비된 파일을 하나의 커밋으로 생성하고 있습니다…";

    const result = await api("/api/admin/deploy", {
      method: "POST",
      body: JSON.stringify({
        mode: "commit",
        message,
        entries: treeEntries,
      }),
    });

    els.deployMessage.innerHTML =
      `GitHub 커밋 완료 · ${result.deployedFiles.length.toLocaleString("ko-KR")}개 파일<br>` +
      `아래에서 Cloudflare Pages 빌드 상태를 자동으로 확인합니다.`;

    showDeployCommitCreated(result.commitSha, result.commitUrl);
    if (pendingDeployVersion && els.adminVersion) {
      els.adminVersion.textContent = `배포 중 ${pendingDeployVersion}`;
    }
    refreshDeployStatus({ keepPolling: true });

    deployFiles = [];
    deployBlocked = [];
    els.deployPreview.hidden = true;
    els.zipInput.value = "";
  } catch (error) {
    els.deployMessage.textContent = error.message;
  } finally {
    els.deployButton.disabled = false;
    els.deployButton.textContent = "GitHub에 배포";
  }
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