// The worker handles public bodies only; unsupported/private contexts keep normal reads.
const offlineBodyReady = (async () => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext || window.Capacitor?.isNativePlatform?.()) return;
  try {
    await navigator.serviceWorker.register('/body-sw.js', { scope: '/', updateViaCache: 'none' });
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        const ready = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', ready); resolve(); };
        const timer = setTimeout(ready, 2500);
        navigator.serviceWorker.addEventListener('controllerchange', ready);
        if (navigator.serviceWorker.controller) ready();
      });
    }
  } catch (error) { console.warn('오프라인 본문 저장을 사용할 수 없습니다.', error); }
})();

function isOfflineBodySupported() {
  return Boolean(
    'serviceWorker' in navigator &&
    window.isSecureContext &&
    !window.Capacitor?.isNativePlatform?.()
  );
}

function hasOfflineBody(itemOrId) {
  if (itemOrId && typeof itemOrId === "object" && itemOrId.source === "postype") return false;
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return Boolean(id && state.offlineBodyIds.has(String(id)));
}

function getOfflineArchiveItems() {
  return state.items.filter((item) => item.source !== "postype" && hasOfflineBody(item));
}

function applyOfflineBodyIds(ids, { rerender = true, bytes = state.offlineBodyBytes, maxBytes = state.offlineBodyMaxBytes, maxItems = state.offlineBodyMaxItems } = {}) {
  const next = new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean));
  state.offlineBodyBytes = Math.max(0, Number(bytes) || 0);
  state.offlineBodyMaxBytes = Math.max(1, Number(maxBytes) || (32 * 1024 * 1024));
  state.offlineBodyMaxItems = Math.max(1, Number(maxItems) || 40);
  if (typeof updateOfflineStorageUsage === "function") updateOfflineStorageUsage();
  const previous = state.offlineBodyIds;
  const idsChanged = !(previous.size === next.size && [...next].every((id) => previous.has(id)));
  if (idsChanged) state.offlineBodyIds = next;
  const readerOpen = Boolean(els.readerOverlay && !els.readerOverlay.hidden);
  if (rerender && idsChanged && state.items.length && !readerOpen) render();
  else if (rerender && state.profileOpen && !readerOpen) renderProfilePage();
  return idsChanged;
}

async function requestOfflineBodyIds() {
  if (!isOfflineBodySupported()) return [];
  await offlineBodyReady;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return [];

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve([]), 1800);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      const ids = Array.isArray(event.data?.ids) ? event.data.ids : [];
      applyOfflineBodyIds(ids, { bytes: event.data?.bytes, maxBytes: event.data?.maxBytes, maxItems: event.data?.maxItems });
      resolve(ids);
    };
    try {
      controller.postMessage({ type: "offline-bodies-list" }, [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve([]);
    }
  });
}

async function deleteOfflineBodies(ids = [], { all = false } = {}) {
  if (!isOfflineBodySupported()) throw new Error("오프라인 저장을 사용할 수 없습니다.");
  await offlineBodyReady;
  const controller = navigator.serviceWorker.controller;
  if (!controller) throw new Error("오프라인 저장을 아직 사용할 수 없습니다.");

  const normalized = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  if (!all && !normalized.length) return [...state.offlineBodyIds];

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error("오프라인 저장 삭제 응답이 지연되고 있습니다.")), 2500);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      if (event.data?.error) {
        reject(new Error(event.data.error));
        return;
      }
      const nextIds = Array.isArray(event.data?.ids) ? event.data.ids : [];
      applyOfflineBodyIds(nextIds, { bytes: event.data?.bytes, maxBytes: event.data?.maxBytes, maxItems: event.data?.maxItems });
      resolve(nextIds);
    };
    try {
      controller.postMessage(
        all ? { type: "offline-bodies-clear" } : { type: "offline-bodies-delete", ids: normalized },
        [channel.port2],
      );
    } catch (error) {
      window.clearTimeout(timer);
      reject(error);
    }
  });
}

if (isOfflineBodySupported()) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "offline-bodies-changed") return;
    applyOfflineBodyIds(event.data.ids, { bytes: event.data?.bytes, maxBytes: event.data?.maxBytes, maxItems: event.data?.maxItems });
  });
  offlineBodyReady.then(() => requestOfflineBodyIds()).catch(() => {});
}

/* V7 PUBLIC CLIENT CONTRACT
 * - Internal content type remains `연재물`; UI label is `연재`.
 * - Filter changes never mutate another filter implicitly.
 * - Reader has three visual states only: normal / loading-locked / reader-compact.
 * - Future UI patches must edit the canonical V7 CSS sections instead of appending version overrides.
 */

const state = {
  items: [],
  combination: "전체",
  contentType: "전체",
  statusFilter: "전체",
  source: "전체",
  search: "",
  sort: localStorage.getItem("archiveSort") || "title",
  initialRecentPostypeBoost: true,
  view: localStorage.getItem("archiveViewV2") || "list",
  mobileFiltersOpen: false,
  activeReaderItem: null,
  readerRenderToken: 0,
  suspendReaderProgressSave: false,
  readerLoadingStartedAt: 0,
  largeReaderChunks: null,
  largeReaderRenderedCount: 0,
  largeReaderRendering: false,
  readerText: "",
  readerDisplayMode: localStorage.getItem("rjsReaderDisplayModeV1") === "page" ? "page" : "scroll",
  readerPageStart: 0,
  readerPageEnd: 0,
  readerPageHasNavigated: false,
  readerPageResizeTimer: 0,
  readerPageTouchStartX: null,
  readerPageTouchStartY: null,
  readerPageLastSwipeAt: 0,
  readerPageAnimationTimer: 0,
  readerEstimatedTotalPages: 1,
  readerHistoryActive: false,
  user: null,
  userLibrary: new Map(),
  userLikes: new Map(),
  savedQuotes: [],
  savedQuoteCount: null,
  savedQuotesLoaded: false,
  savedQuotesLoading: false,
  savedQuotesError: false,
  readerNotes: [],
  myLibraryLoaded: false,
  myLibraryLoading: false,
  myLibraryError: false,
  myLibraryDetailWorkId: "",
  myLibraryDetailTab: "all",
  profileLibraryMode: "records",
  offlineBodyIds: new Set(),
  offlineBodyBytes: 0,
  offlineBodyMaxBytes: 32 * 1024 * 1024,
  offlineBodyMaxItems: 40,
  offlineDeleteMode: false,
  offlineDeleteSelection: new Set(),
  readerReturnToMyLibrary: false,
  quoteFeedItems: [],
  quoteFeedNextCursor: null,
  quoteFeedLoading: false,
  quoteFeedError: "",
  quoteFeedLoaded: false,
  quoteFeedSort: "latest",
  quoteFeedLikeSaving: new Set(),
  quoteFeedOpen: false,
  quoteFeedActiveItem: null,
  contentPageReturnScrollY: 0,
  profileUserCreatedAt: null,
  profileTab: "bookmarks",
  profileSearch: "",
  profileOpen: false,
  profileVisibleLimit: 15,
  authMode: "login",
  pendingAuthReason: "",
  authRestoreInFlight: false,
  authRestoreRetryNeeded: false,
  authRestoreRetryCount: 0,
  authRestoreRetryTimer: 0,
  remoteProgressSyncedAt: new Map(),
  progressSavePending: new Map(),
  localProgressSavedAt: new Map(),
  lastExitProgressSignature: "",
  lastExitProgressAt: 0,
  libraryKind: "bookmarks",
  librarySearch: "",
  libraryVisibleLimit: 10,
  visitRecordedUserId: "",
  remoteProgressState: new Map(),
  bookmarkSaveTimers: new Map(),
  bookmarkPersistedValues: new Map(),
  bookmarkCounts: new Map(),
  bookmarkCountsLoaded: false,
  bookmarkCountsLoadedAt: 0,
  bookmarkCountsLoadingPromise: null,
  bookmarkOnly: false,
  readingOnly: false,
  resumeShortcutItemId: "",
  readerResumeSaved: null,
  readerShareText: "",
  readerShareSourceItem: null,
  readerShareLocation: null,
  readerShareBackground: 0,
  readerShareWeight: "regular",
  visibleItemLimit: 40,
  paginationSignature: "",
};

const LARGE_FILE_LOADING_THRESHOLD_BYTES = 810 * 1024;
const LARGE_FILE_MIN_LOADING_VISIBLE_MS = 1700;
const READER_LOCAL_SAVE_INTERVAL_MS = 10 * 1000;
const READER_REMOTE_SYNC_INTERVAL_MS = 120 * 1000;
const READER_MIN_MEANINGFUL_SCROLL_PX = 24;
const READER_END_DISTANCE_PX = 140;
const READER_PROGRESS_PRECISION = 100; // 0.01% 단위 저장 (모드 간 위치 정밀도 향상)
const READER_LEGACY_READ_VALID_PERCENT = 99.9;
const CONTENT_PAGE_SIZE = 40;
const BOOKMARK_COUNTS_CACHE_MS = 60 * 1000;
const LIBRARY_PAGE_SIZE = 10;
const READER_DISPLAY_MODE_KEY = "rjsReaderDisplayModeV1";
const READER_PAGE_PROBE_CHARS = 14000;

// v8.71 - 전체 방문 분석
// 로그인 여부와 무관하게 브라우저 임의 ID + 30분 세션으로 집계한다.
// IP는 저장하지 않으며, 한 세션의 활동 수치는 묶어서 서버에 갱신한다.
const ANALYTICS_VISITOR_KEY = "rjsAnalyticsVisitorV1";
const ANALYTICS_SESSION_KEY = "rjsAnalyticsSessionV1";
const ANALYTICS_SESSION_WINDOW_MS = 30 * 60 * 1000;
const ANALYTICS_HEARTBEAT_MS = 15 * 60 * 1000;
const ANALYTICS_APP_VERSION = String(document.getElementById("publicVersion")?.textContent || "").replace(/^v/i, "").trim();
const SIGNUP_NUDGE_DISMISSED_KEY = "rjsSignupNudgeDismissedAtV1";
const SIGNUP_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const SIGNUP_NUDGE_WORK_OPEN_THRESHOLD = 3;
let analyticsSession = null;
let analyticsVisibleStartedAt = document.visibilityState === "visible" ? Date.now() : 0;
let analyticsSearchTimer = 0;
let analyticsLastSearch = "";
let analyticsFlushInFlight = false;
let analyticsFlushPending = false;

function createAnalyticsId() {
  if (crypto?.randomUUID) return crypto.randomUUID().toLowerCase();
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function getAnalyticsDeviceType() {
  const width = Math.min(
    Number(window.screen?.width || window.innerWidth || 0),
    Number(window.screen?.height || window.innerHeight || 0)
  );
  const ua = String(navigator.userAgent || "");
  if (/iPad|Tablet|SM-T|Tab/i.test(ua) || (width >= 600 && width < 1024)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua) || width < 600) return "mobile";
  return "desktop";
}

function getAnalyticsBrowserName() {
  const ua = String(navigator.userAgent || "");
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg|EdgiOS/i.test(ua)) return "edge";
  if (/FxiOS|Firefox/i.test(ua)) return "firefox";
  if (/CriOS|Chrome|Chromium/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua) && /AppleWebKit/i.test(ua)) return "safari";
  return "other";
}

function getAnalyticsSource() {
  const raw = String(document.referrer || "").trim();
  if (!raw) return { sourceType: "direct", referrerHost: "" };

  try {
    const ref = new URL(raw);
    const host = String(ref.hostname || "").toLowerCase();
    if (!host) return { sourceType: "direct", referrerHost: "" };
    if (ref.origin === window.location.origin) {
      return { sourceType: "internal", referrerHost: host };
    }
    if (/(google\.|bing\.|naver\.|daum\.|yahoo\.)/i.test(host)) {
      return { sourceType: "search", referrerHost: host };
    }
    if (/(twitter\.|x\.com|instagram\.|facebook\.|threads\.|tiktok\.|youtube\.|youtu\.be)/i.test(host)) {
      return { sourceType: "social", referrerHost: host };
    }
    return { sourceType: "external", referrerHost: host };
  } catch {
    return { sourceType: "direct", referrerHost: "" };
  }
}

function persistAnalyticsSession() {
  if (!analyticsSession) return;
  analyticsSession.lastSeenAt = Date.now();
  try {
    localStorage.setItem(ANALYTICS_SESSION_KEY, JSON.stringify(analyticsSession));
  } catch {}
}

function accrueAnalyticsVisibleTime(now = Date.now()) {
  if (!analyticsSession) return;
  if (analyticsVisibleStartedAt > 0) {
    const elapsed = Math.max(0, Math.min(30 * 60 * 1000, now - analyticsVisibleStartedAt));
    analyticsSession.activeSeconds = Math.min(
      12 * 60 * 60,
      Number(analyticsSession.activeSeconds || 0) + Math.round(elapsed / 1000)
    );
  }
  analyticsVisibleStartedAt = document.visibilityState === "visible" ? now : 0;
}

function initAnalyticsSession() {
  const now = Date.now();
  let visitorId = "";
  try {
    visitorId = String(localStorage.getItem(ANALYTICS_VISITOR_KEY) || "");
  } catch {}
  if (!/^[a-z0-9-]{20,80}$/.test(visitorId)) {
    visitorId = createAnalyticsId();
    try { localStorage.setItem(ANALYTICS_VISITOR_KEY, visitorId); } catch {}
  }

  let previous = null;
  try {
    previous = JSON.parse(localStorage.getItem(ANALYTICS_SESSION_KEY) || "null");
  } catch {}

  const reusable =
    previous &&
    previous.visitorId === visitorId &&
    /^[a-z0-9-]{20,80}$/.test(String(previous.sessionId || "")) &&
    now - Number(previous.lastSeenAt || 0) < ANALYTICS_SESSION_WINDOW_MS;

  if (reusable) {
    analyticsSession = previous;
    const previousVersion = String(analyticsSession.appVersion || "").trim();
    if (previousVersion !== ANALYTICS_APP_VERSION) {
      // 같은 30분 방문 세션이 배포를 가로질러도 성능값은 버전별로 섞지 않는다.
      analyticsSession.pageLoadMs = 0;
      analyticsSession.archiveLoadMs = 0;
      analyticsSession.readerLoadMsSum = 0;
      analyticsSession.readerLoadCount = 0;
      analyticsSession.readerPerf = createEmptyReaderPerf();
    } else {
      analyticsSession.readerPerf = ensureReaderPerfShape(analyticsSession.readerPerf);
    }
    analyticsSession.appVersion = ANALYTICS_APP_VERSION;
    analyticsSession.pageViews = Math.max(1, Number(analyticsSession.pageViews || 0) + 1);
  } else {
    const source = getAnalyticsSource();
    analyticsSession = {
      visitorId,
      sessionId: createAnalyticsId(),
      startedAt: now,
      lastSeenAt: now,
      pageViews: 1,
      workOpens: 0,
      searches: 0,
      activeSeconds: 0,
      deviceType: getAnalyticsDeviceType(),
      browserName: getAnalyticsBrowserName(),
      sourceType: source.sourceType,
      referrerHost: source.referrerHost,
      pageLoadMs: 0,
      archiveLoadMs: 0,
      readerLoadMsSum: 0,
      readerLoadCount: 0,
      readerPerf: createEmptyReaderPerf(),
      appVersion: ANALYTICS_APP_VERSION,
      signupNudgeShown: 0,
      signupNudgeLoginClicks: 0,
      signupNudgeSignupClicks: 0,
      signupNudgeLoginCompleted: 0,
      signupNudgeSignupCompleted: 0,
      signupNudgeClose: 0,
    };
  }

  analyticsVisibleStartedAt = document.visibilityState === "visible" ? now : 0;
  persistAnalyticsSession();

  window.setTimeout(() => flushAnalyticsSession(), 2200);
  window.setInterval(() => flushAnalyticsSession(), ANALYTICS_HEARTBEAT_MS);
}

function analyticsPayload() {
  if (!analyticsSession) return null;
  accrueAnalyticsVisibleTime();
  persistAnalyticsSession();
  return {
    visitorId: analyticsSession.visitorId,
    sessionId: analyticsSession.sessionId,
    startedAt: Number(analyticsSession.startedAt || Date.now()),
    pageViews: Number(analyticsSession.pageViews || 1),
    workOpens: Number(analyticsSession.workOpens || 0),
    searches: Number(analyticsSession.searches || 0),
    activeSeconds: Number(analyticsSession.activeSeconds || 0),
    deviceType: analyticsSession.deviceType || "other",
    browserName: analyticsSession.browserName || "other",
    sourceType: analyticsSession.sourceType || "direct",
    referrerHost: analyticsSession.referrerHost || "",
    pageLoadMs: Number(analyticsSession.pageLoadMs || 0),
    archiveLoadMs: Number(analyticsSession.archiveLoadMs || 0),
    readerLoadMsSum: Number(analyticsSession.readerLoadMsSum || 0),
    readerLoadCount: Number(analyticsSession.readerLoadCount || 0),
    readerPerf: ensureReaderPerfShape(analyticsSession.readerPerf),
    appVersion: ANALYTICS_APP_VERSION,
    signupNudgeShown: Number(analyticsSession.signupNudgeShown || 0),
    signupNudgeLoginClicks: Number(analyticsSession.signupNudgeLoginClicks || 0),
    signupNudgeSignupClicks: Number(analyticsSession.signupNudgeSignupClicks || 0),
    signupNudgeLoginCompleted: Number(analyticsSession.signupNudgeLoginCompleted || 0),
    signupNudgeSignupCompleted: Number(analyticsSession.signupNudgeSignupCompleted || 0),
    signupNudgeClose: Number(analyticsSession.signupNudgeClose || 0),
  };
}

async function flushAnalyticsSession(options = {}) {
  if (!analyticsSession) return;
  if (analyticsFlushInFlight) {
    if (options.afterCurrent) analyticsFlushPending = true;
    return;
  }
  const payload = analyticsPayload();
  if (!payload) return;

  if (options.beacon && navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/session", blob);
      return;
    } catch {}
  }

  analyticsFlushInFlight = true;
  try {
    const headers = { "content-type": "application/json" };
    const token = getAuthToken();
    if (token) headers.authorization = `Bearer ${token}`;
    await fetch("/api/analytics/session", {
      method: "POST",
      headers,
      credentials: "same-origin",
      cache: "no-store",
      keepalive: Boolean(options.keepalive),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("방문 분석 저장 실패", error);
  } finally {
    analyticsFlushInFlight = false;
    if (analyticsFlushPending) {
      analyticsFlushPending = false;
      window.setTimeout(() => flushAnalyticsSession(), 0);
    }
  }
}

function getSignupNudgeDismissedAt() {
  try { return Number(localStorage.getItem(SIGNUP_NUDGE_DISMISSED_KEY) || 0); } catch { return 0; }
}

function hideSignupNudge({ remember = false, trackClose = false } = {}) {
  if (trackClose && analyticsSession) {
    analyticsSession.signupNudgeClose = 1;
  }
  if (els.signupNudge) els.signupNudge.hidden = true;
  if (remember) {
    try { localStorage.setItem(SIGNUP_NUDGE_DISMISSED_KEY, String(Date.now())); } catch {}
  }
  if (trackClose) {
    persistAnalyticsSession();
    flushAnalyticsSession();
  }
}

function maybeShowSignupNudge() {
  if (!analyticsSession || state.user || !els.signupNudge) return;
  if (Number(analyticsSession.workOpens || 0) < SIGNUP_NUDGE_WORK_OPEN_THRESHOLD) return;
  if (Date.now() - getSignupNudgeDismissedAt() < SIGNUP_NUDGE_COOLDOWN_MS) return;
  if (!els.signupNudge.hidden) return;

  els.signupNudge.hidden = false;
  if (!Number(analyticsSession.signupNudgeShown || 0)) {
    analyticsSession.signupNudgeShown = 1;
    persistAnalyticsSession();
    flushAnalyticsSession();
  }
}

function recordSignupNudgeAction(kind) {
  if (!analyticsSession) return;
  if (kind === "login") analyticsSession.signupNudgeLoginClicks = 1;
  if (kind === "signup") analyticsSession.signupNudgeSignupClicks = 1;
  persistAnalyticsSession();
  flushAnalyticsSession();
}

function recordSignupNudgeCompletion(kind) {
  if (!analyticsSession) return;
  if (kind === "login" && Number(analyticsSession.signupNudgeLoginClicks || 0)) {
    analyticsSession.signupNudgeLoginCompleted = 1;
  }
  if (kind === "signup" && Number(analyticsSession.signupNudgeSignupClicks || 0)) {
    analyticsSession.signupNudgeSignupCompleted = 1;
  }
  hideSignupNudge();
  persistAnalyticsSession();
}

function recordAnalyticsWorkOpen(allowNudge = true) {
  if (!analyticsSession) return;
  analyticsSession.workOpens = Number(analyticsSession.workOpens || 0) + 1;
  persistAnalyticsSession();
  if (allowNudge) maybeShowSignupNudge();
}

function scheduleAnalyticsSearch(value) {
  window.clearTimeout(analyticsSearchTimer);
  const normalized = String(value || "").trim().toLocaleLowerCase("ko-KR");
  if (normalized.length < 2) return;
  analyticsSearchTimer = window.setTimeout(() => {
    if (!analyticsSession || normalized === analyticsLastSearch) return;
    analyticsLastSearch = normalized;
    analyticsSession.searches = Number(analyticsSession.searches || 0) + 1;
    persistAnalyticsSession();
  }, 900);
}

function recordAnalyticsArchiveLoad(ms) {
  if (!analyticsSession || analyticsSession.archiveLoadMs) return;
  analyticsSession.archiveLoadMs = Math.max(1, Math.round(Number(ms || 0)));
  persistAnalyticsSession();
}

function createEmptyReaderPerf() {
  const bucket = () => ({ sum: 0, count: 0 });
  return {
    total: bucket(),
    response: bucket(),
    download: bucket(),
    render: bucket(),
    layout: bucket(),
    cache: { hit: bucket(), miss: bucket(), unknown: bucket() },
    size: { small: bucket(), medium: bucket(), large: bucket() },
    mode: { scroll: bucket(), page: bucket() },
    missServer: {
      kvRead: bucket(),
      token: bucket(),
      verify: bucket(),
      driveRequest: bucket(),
      driveDownload: bucket(),
      decode: bucket(),
      kvWrite: bucket(),
      total: bucket(),
    },
    renderDetail: {
      domSetup: bucket(),
      textInsert: bucket(),
      settle: bucket(),
      overlay: bucket(),
      overlayFrameWait: bucket(),
      overlayTransition: bucket(),
      overlayRemove: bucket(),
      modeSetup: bucket(),
      paintWait: bucket(),
      offsetRestore: bucket(),
    },
    histogram: { under1: 0, oneTo2: 0, twoTo4: 0, fourTo8: 0, over8: 0 },
  };
}

function ensureReaderPerfShape(value) {
  const base = createEmptyReaderPerf();
  const source = value && typeof value === "object" ? value : {};
  for (const key of ["total", "response", "download", "render", "layout"]) {
    base[key].sum = Number(source?.[key]?.sum || 0);
    base[key].count = Number(source?.[key]?.count || 0);
  }
  for (const groupName of ["cache", "size", "mode", "missServer", "renderDetail"]) {
    for (const key of Object.keys(base[groupName])) {
      base[groupName][key].sum = Number(source?.[groupName]?.[key]?.sum || 0);
      base[groupName][key].count = Number(source?.[groupName]?.[key]?.count || 0);
    }
  }
  for (const key of Object.keys(base.histogram)) {
    base.histogram[key] = Number(source?.histogram?.[key] || 0);
  }
  return base;
}

function addReaderPerfBucket(bucket, ms) {
  if (!bucket) return;
  const value = Math.max(0, Math.round(Number(ms || 0)));
  bucket.sum = Number(bucket.sum || 0) + value;
  bucket.count = Number(bucket.count || 0) + 1;
}

function recordAnalyticsReaderLoad(ms, details = {}) {
  if (!analyticsSession) return;
  const value = Math.max(0, Math.round(Number(ms || 0)));
  if (!value) return;

  analyticsSession.readerLoadMsSum = Number(analyticsSession.readerLoadMsSum || 0) + value;
  analyticsSession.readerLoadCount = Number(analyticsSession.readerLoadCount || 0) + 1;
  analyticsSession.readerPerf = ensureReaderPerfShape(analyticsSession.readerPerf);

  const perf = analyticsSession.readerPerf;
  addReaderPerfBucket(perf.total, value);
  addReaderPerfBucket(perf.response, details.responseMs);
  addReaderPerfBucket(perf.download, details.downloadMs);
  addReaderPerfBucket(perf.render, details.renderMs);
  addReaderPerfBucket(perf.layout, details.layoutMs);

  const cached = String(details.cacheStatus || "unknown");
  addReaderPerfBucket(perf.cache[cached] || perf.cache.unknown, value);

  const bytes = Math.max(0, Number(details.bytes || 0));
  const sizeBucket = bytes >= 5 * 1024 * 1024
    ? "large"
    : bytes >= 1024 * 1024
      ? "medium"
      : "small";
  addReaderPerfBucket(perf.size[sizeBucket], value);

  const mode = details.mode === "page" ? "page" : "scroll";
  addReaderPerfBucket(perf.mode[mode], value);

  if (cached === "miss") {
    for (const key of Object.keys(perf.missServer)) {
      addReaderPerfBucket(perf.missServer[key], details?.missServer?.[key]);
    }
  }

  if (mode === "scroll") {
    for (const key of Object.keys(perf.renderDetail)) {
      addReaderPerfBucket(perf.renderDetail[key], details?.renderDetail?.[key]);
    }
  }

  if (value < 1000) perf.histogram.under1 += 1;
  else if (value < 2000) perf.histogram.oneTo2 += 1;
  else if (value < 4000) perf.histogram.twoTo4 += 1;
  else if (value < 8000) perf.histogram.fourTo8 += 1;
  else perf.histogram.over8 += 1;

  persistAnalyticsSession();

  // KV MISS 서버 내부 진단값은 드문 이벤트라 즉시 저장한다.
  // 기존 15분 heartbeat와 겹치면 현재 저장이 끝난 직후 한 번 더 flush한다.
  if (cached === "miss") {
    flushAnalyticsSession({ afterCurrent: true });
  }
}

function recordAnalyticsPageLoad() {
  if (!analyticsSession || analyticsSession.pageLoadMs) return;
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  const duration = Number(nav?.duration || performance.now() || 0);
  analyticsSession.pageLoadMs = Math.max(1, Math.round(duration));
  persistAnalyticsSession();
}

const READER_USER_AGENT = String(navigator.userAgent || "");
const IS_SAFARI_READER =
  /Safari/i.test(READER_USER_AGENT) &&
  /AppleWebKit/i.test(READER_USER_AGENT) &&
  !/(CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg|OPR)/i.test(
    READER_USER_AGENT
  );

document.documentElement.classList.toggle(
  "safari-reader",
  IS_SAFARI_READER
);
const READER_PAGE_SWIPE_PX = 48;

const UI_THEME_KEY = "rjsBookThemeV1";
const READER_SPACING_KEY = "rjsBookReaderSpacingV1";
const READER_FONT_SIZE_KEY = "rjsBookReaderFontSizeV1";
const READER_FONT_FAMILY_KEY = "rjsBookReaderFontFamilyV1";
const READER_SIDE_MARGIN_KEY = "rjsBookReaderSideMarginV1";
const READER_WAKE_LOCK_KEY = "rjsBookReaderWakeLockV1";
let readerWakeLockSentinel = null;
let readerWakeLockPending = false;
let readerWakeLockLastError = "";
const READER_FONT_FAMILIES = {
  default: '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
  paperlogy: 'Paperozi, Pretendard, "Noto Sans KR", sans-serif',
  ridibatang: 'Ridibatang, "Noto Serif KR", "Nanum Myeongjo", serif',
  chosunilbo: 'ChosunIlboMyungjo, "Noto Serif KR", "Nanum Myeongjo", serif',
  inkliquid: 'InkLiquid, cursive',
  kopubbatang: '"KoPub Batang", "Noto Serif KR", "Nanum Myeongjo", serif',
  nanumneo: '"NanumSquareNeo", Pretendard, "Noto Sans KR", sans-serif',
  bookkmyungjo: 'BookkMyungjo, "Noto Serif KR", "Nanum Myeongjo", serif',
  mapoflower: 'MapoFlowerIsland, "Noto Serif KR", "Nanum Myeongjo", serif',
  gowunbatang: '"Gowun Batang", "Noto Serif KR", "Nanum Myeongjo", serif',
  maruburi: '"Maru Buri", "Noto Serif KR", "Nanum Myeongjo", serif',
  galmuri: 'Galmuri11, Pretendard, "Noto Sans KR", sans-serif',
};

const KOPUB_FONT_STYLESHEET_ID = "kopubFontStylesheet";
const KOPUB_FONT_STYLESHEET_URL = "https://cdn.jsdelivr.net/npm/font-kopub@1.0/kopubbatang.min.css";
let kopubFontReadyPromise = null;

function ensureKopubFont() {
  if (document.documentElement.dataset.kopub === "ready") {
    return Promise.resolve(true);
  }
  if (kopubFontReadyPromise) return kopubFontReadyPromise;

  kopubFontReadyPromise = new Promise((resolve) => {
    let link = document.getElementById(KOPUB_FONT_STYLESHEET_ID);
    let settled = false;
    let timeoutId = 0;

    const settle = (ready) => {
      if (settled) return;
      settled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      resolve(ready);
    };

    const fail = () => {
      if (settled) return;
      if (link?.dataset.dynamicKopub === "1") link.remove();
      document.documentElement.removeAttribute("data-kopub");
      kopubFontReadyPromise = null;
      settle(false);
    };

    const finish = async () => {
      if (settled) return;
      try {
        if (link) link.dataset.loaded = "1";
        if (document.fonts?.load) {
          const faces = await document.fonts.load('400 48px "KoPub Batang"');
          if (Array.isArray(faces) && faces.length === 0) throw new Error("kopub_font_face_missing");
        }
        if (settled) return;
        document.documentElement.dataset.kopub = "ready";
        settle(true);
      } catch (_) {
        fail();
      }
    };

    timeoutId = window.setTimeout(fail, 4000);

    if (link?.dataset.loaded === "1" || link?.sheet) {
      void finish();
      return;
    }

    let shouldAppend = false;
    if (!link) {
      link = document.createElement("link");
      link.id = KOPUB_FONT_STYLESHEET_ID;
      link.rel = "stylesheet";
      link.href = KOPUB_FONT_STYLESHEET_URL;
      link.dataset.dynamicKopub = "1";
      shouldAppend = true;
    }

    link.addEventListener("load", () => { void finish(); }, { once: true });
    link.addEventListener("error", fail, { once: true });
    if (shouldAppend) document.head.appendChild(link);
  });

  return kopubFontReadyPromise;
}


const READER_LAZY_FONT_CONFIG = {
  default: {
    id: "readerFontPretendard",
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
    test: '400 32px "Pretendard Variable"',
  },
  nanumneo: {
    id: "readerFontNanumSquareNeo",
    href: "/reader-font-nanumsquareneo.css?v=980",
    test: '400 32px "NanumSquareNeo"',
  },
  bookkmyungjo: {
    id: "readerFontBookkMyungjo",
    href: "/reader-font-bookkmyungjo.css?v=978",
    test: '400 32px "BookkMyungjo"',
  },
  mapoflower: {
    id: "readerFontMapoFlowerIsland",
    href: "/reader-font-mapoflower.css?v=978",
    test: '400 32px "MapoFlowerIsland"',
  },
  gowunbatang: {
    id: "readerFontGowunBatang",
    href: "https://fonts.googleapis.com/css2?family=Gowun+Batang&display=swap",
    test: '400 32px "Gowun Batang"',
  },
  maruburi: {
    id: "readerFontMaruBuri",
    href: "https://cdn.jsdelivr.net/gh/fonts-archive/MaruBuri/MaruBuri.css",
    test: '400 32px "Maru Buri"',
  },
  galmuri: {
    id: "readerFontGalmuri",
    href: "https://cdn.jsdelivr.net/gh/fonts-archive/Galmuri11/subsets/Galmuri11-dynamic-subset.css",
    test: '400 32px "Galmuri11"',
  },
};
const readerLazyFontPromises = new Map();

function markReaderFontReady(fontKey) {
  const root = document.documentElement;
  const ready = new Set((root.dataset.readerFontReady || "").split(/\s+/).filter(Boolean));
  ready.add(fontKey);
  root.dataset.readerFontReady = Array.from(ready).join(" ");
}

function ensureReaderLazyFont(fontKey) {
  const config = READER_LAZY_FONT_CONFIG[fontKey];
  if (!config) return Promise.resolve(true);
  if (readerLazyFontPromises.has(fontKey)) return readerLazyFontPromises.get(fontKey);

  const promise = new Promise((resolve) => {
    let link = document.getElementById(config.id);
    let settled = false;
    let timeoutId = 0;

    const settle = (ready) => {
      if (settled) return;
      settled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (ready) markReaderFontReady(fontKey);
      resolve(ready);
    };
    const fail = () => {
      if (link?.dataset.dynamicReaderFont === "1") link.remove();
      readerLazyFontPromises.delete(fontKey);
      settle(false);
    };
    const finish = async () => {
      try {
        if (link) link.dataset.loaded = "1";
        if (document.fonts?.load) {
          const faces = await document.fonts.load(config.test);
          if (!faces || faces.length === 0) throw new Error("reader_font_face_missing");
        }
        settle(true);
      } catch (_) {
        fail();
      }
    };

    timeoutId = window.setTimeout(fail, 5000);
    if (link?.dataset.loaded === "1" || link?.sheet) {
      void finish();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.id = config.id;
      link.rel = "stylesheet";
      link.href = config.href;
      link.crossOrigin = "anonymous";
      link.dataset.dynamicReaderFont = "1";
      document.head.appendChild(link);
    }
    link.addEventListener("load", () => { void finish(); }, { once: true });
    link.addEventListener("error", fail, { once: true });
  });

  readerLazyFontPromises.set(fontKey, promise);
  return promise;
}

function isLazyReaderFont(fontKey) {
  return Object.prototype.hasOwnProperty.call(READER_LAZY_FONT_CONFIG, fontKey);
}

function isExtraReaderFont(fontKey) {
  return fontKey !== "default" && isLazyReaderFont(fontKey);
}

function preloadViewerFontChoices() {
  for (const fontKey of Object.keys(READER_LAZY_FONT_CONFIG)) {
    if (fontKey === "default") continue;
    void ensureReaderLazyFont(fontKey);
  }
}

function setViewerFontExtraExpanded(expanded, { preload = false } = {}) {
  if (!els.viewerFontExtraOptions || !els.viewerFontMoreButton) return;
  els.viewerFontExtraOptions.hidden = !expanded;
  els.viewerFontMoreButton.setAttribute("aria-expanded", expanded ? "true" : "false");
  const label = els.viewerFontMoreButton.querySelector("span");
  if (label) label.textContent = expanded ? "접기" : "더보기";
  if (expanded && preload) preloadViewerFontChoices();
}

function getViewerPreferenceStorage() {
  // 로그인 복원 전 첫 렌더에서도 저장된 로그인 사용자 설정을 그대로 사용한다.
  // 기존에는 state.user가 아직 null이라 sessionStorage를 먼저 읽은 뒤,
  // /api/auth/me 응답 후 localStorage로 다시 바뀌면서 테마가 순간 전환될 수 있었다.
  return state.user || getAuthToken() ? localStorage : sessionStorage;
}

function getSavedTheme() {
  return getViewerPreferenceStorage().getItem(UI_THEME_KEY) === "dark"
    ? "dark"
    : "light";
}

function getSavedReaderSpacing() {
  const value = getViewerPreferenceStorage().getItem(READER_SPACING_KEY);
  return ["compact", "normal", "wide"].includes(value)
    ? value
    : "normal";
}

function getSavedReaderFontSize() {
  const value = getViewerPreferenceStorage().getItem(READER_FONT_SIZE_KEY);
  return ["small", "normal", "large"].includes(value)
    ? value
    : "normal";
}

function getSavedReaderFontFamily() {
  const value = getViewerPreferenceStorage().getItem(READER_FONT_FAMILY_KEY);
  if (value === "pretendard") return "default";
  if (value === "gowundodum") return "default";
  if (value === "suit") return "nanumneo";
  return Object.prototype.hasOwnProperty.call(READER_FONT_FAMILIES, value)
    ? value
    : "ridibatang";
}

function getSavedReaderSideMargin() {
  const value = getViewerPreferenceStorage().getItem(READER_SIDE_MARGIN_KEY);
  return ["narrow", "normal", "wide"].includes(value) ? value : "normal";
}

function getSavedReaderWakeLock() {
  return getViewerPreferenceStorage().getItem(READER_WAKE_LOCK_KEY) === "on";
}

function isReaderWakeLockSupported() {
  return Boolean(navigator.wakeLock && typeof navigator.wakeLock.request === "function");
}

function shouldHoldReaderWakeLock() {
  return Boolean(
    isReaderWakeLockSupported() &&
    getSavedReaderWakeLock() &&
    document.visibilityState === "visible" &&
    state.activeReaderItem &&
    !els.readerOverlay?.hidden
  );
}

function updateReaderWakeLockUi() {
  const supported = isReaderWakeLockSupported();
  if (els.readerWakeLockRow) els.readerWakeLockRow.hidden = !supported;
  if (!supported) return;

  const enabled = getSavedReaderWakeLock();
  const active = Boolean(readerWakeLockSentinel && !readerWakeLockSentinel.released);

  if (els.readerWakeLockToggle) {
    els.readerWakeLockToggle.textContent = enabled ? "ON" : "OFF";
    els.readerWakeLockToggle.classList.toggle("active", enabled);
    els.readerWakeLockToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  }

  if (els.readerWakeLockHint) {
    if (!enabled) {
      els.readerWakeLockHint.textContent = "뷰어를 보는 동안 화면 자동 꺼짐을 막습니다. 배터리 사용량이 늘 수 있어요.";
    } else if (active) {
      els.readerWakeLockHint.textContent = "현재 뷰어를 보는 동안 화면 켜짐을 유지하고 있습니다.";
    } else if (readerWakeLockLastError) {
      els.readerWakeLockHint.textContent = "설정은 켜져 있지만 현재 기기에서 화면 유지 요청을 적용하지 못했습니다.";
    } else {
      els.readerWakeLockHint.textContent = "뷰어가 열리고 화면이 활성화되면 자동으로 적용됩니다.";
    }
  }
}

async function releaseReaderWakeLock() {
  const sentinel = readerWakeLockSentinel;
  readerWakeLockSentinel = null;

  if (sentinel && !sentinel.released) {
    try {
      await sentinel.release();
    } catch {}
  }

  updateReaderWakeLockUi();
}

async function requestReaderWakeLock() {
  if (!shouldHoldReaderWakeLock() || readerWakeLockSentinel || readerWakeLockPending) {
    updateReaderWakeLockUi();
    return;
  }

  readerWakeLockPending = true;
  readerWakeLockLastError = "";

  try {
    const sentinel = await navigator.wakeLock.request("screen");
    readerWakeLockSentinel = sentinel;

    sentinel.addEventListener("release", () => {
      if (readerWakeLockSentinel === sentinel) readerWakeLockSentinel = null;
      updateReaderWakeLockUi();
    }, { once: true });

    if (!shouldHoldReaderWakeLock()) {
      await releaseReaderWakeLock();
    }
  } catch (error) {
    readerWakeLockLastError = error?.name || "wake-lock-error";
  } finally {
    readerWakeLockPending = false;
    updateReaderWakeLockUi();
  }
}

async function syncReaderWakeLock() {
  updateReaderWakeLockUi();
  if (shouldHoldReaderWakeLock()) {
    await requestReaderWakeLock();
  } else {
    await releaseReaderWakeLock();
  }
}

function setViewerPreference(key, value) {
  getViewerPreferenceStorage().setItem(key, value);
}

function refreshReaderPaginationForPreferences() {
  if (
    state.readerDisplayMode !== "page" ||
    els.readerOverlay?.hidden ||
    !state.readerText
  ) return;

  window.requestAnimationFrame(() => {
    const start = state.readerPageStart;
    resizeReaderPageViewport();
    renderReaderPageAt(start, { navigated: false });
  });
}

function applyUserPreferences() {
  const theme = getSavedTheme();
  const spacing = getSavedReaderSpacing();
  const fontSize = getSavedReaderFontSize();
  const fontFamily = getSavedReaderFontFamily();
  const sideMargin = getSavedReaderSideMargin();
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("theme-dark");
    root.classList.remove("theme-light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("theme-dark");
    root.classList.add("theme-light");
    root.style.colorScheme = "light";
  }

  root.dataset.theme = theme;
  const themeColor = document.getElementById("themeColorMeta");
  if (themeColor) {
    themeColor.setAttribute(
      "content",
      theme === "dark" ? "#171614" : "#f6f3ee"
    );
  }
  root.dataset.readerSpacing = spacing;
  root.dataset.readerFontSize = fontSize;
  root.dataset.readerFont = fontFamily;
  root.dataset.readerSideMargin = sideMargin;
  root.style.setProperty("--reader-font-family", READER_FONT_FAMILIES[fontFamily] || READER_FONT_FAMILIES.default);
  if (fontFamily === "kopubbatang") {
    // KoPub is intentionally excluded from the render-blocking <head>.
    // Only users who actually selected it pay the external stylesheet/font cost.
    void ensureKopubFont();
  } else if (fontFamily === "default") {
    // "프리텐다드"는 기존 default 키를 유지해 저장값 호환성을 보존하며, 처음 필요할 때만 실제 웹폰트를 준비한다.
    void ensureReaderLazyFont("default");
  } else if (isExtraReaderFont(fontFamily)) {
    // Additional fonts are loaded when selected or when the user opens the font preview.
    void ensureReaderLazyFont(fontFamily);
    setViewerFontExtraExpanded(true);
  }

  if (els.darkModeToggle) {
    const enabled = theme === "dark";
    els.darkModeToggle.textContent = enabled ? "ON" : "OFF";
    els.darkModeToggle.classList.toggle("active", enabled);
    els.darkModeToggle.setAttribute(
      "aria-pressed",
      enabled ? "true" : "false"
    );
  }

  els.readerSpacingButtons?.forEach((button) => {
    const active = button.dataset.readerSpacing === spacing;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  els.readerFontSizeButtons?.forEach((button) => {
    const active = button.dataset.readerFontSize === fontSize;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  els.readerFontFamilyButtons?.forEach((button) => {
    const active = button.dataset.readerFontFamily === fontFamily;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  els.readerSideMarginButtons?.forEach((button) => {
    const active = button.dataset.readerSideMargin === sideMargin;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (els.viewerSettingsScopeText) {
    els.viewerSettingsScopeText.textContent = state.user
      ? "로그인 상태에서는 이 브라우저에 설정값이 유지됩니다."
      : "비회원 설정은 현재 브라우저 세션에서만 유지됩니다.";
  }

  void syncReaderWakeLock();

  state.readerDisplayMode = getPreferredReaderDisplayMode();
  syncReaderModeButtons();
  refreshReaderPaginationForPreferences();
}

const els = {
  status: document.getElementById("status"),
  contentGrid: document.getElementById("contentGrid"),
  contentListWrap: document.getElementById("contentListWrap"),
  contentListBody: document.getElementById("contentListBody"),
  emptyState: document.getElementById("emptyState"),
  resultCount: document.getElementById("resultCount"),
  recentPostypeGuideNote: document.getElementById("recentPostypeGuideNote"),
  quoteFeedButton: document.getElementById("quoteFeedButton"),
  quoteFeedPage: document.getElementById("quoteFeedPage"),
  quoteFeedBackButton: document.getElementById("quoteFeedBackButton"),
  quoteFeedGrid: document.getElementById("quoteFeedGrid"),
  quoteFeedSortLatest: document.getElementById("quoteFeedSortLatest"),
  quoteFeedSortLikes: document.getElementById("quoteFeedSortLikes"),
  quoteFeedMeta: document.getElementById("quoteFeedMeta"),
  quoteFeedStatus: document.getElementById("quoteFeedStatus"),
  quoteFeedMoreWrap: document.getElementById("quoteFeedMoreWrap"),
  quoteFeedMoreButton: document.getElementById("quoteFeedMoreButton"),
  quoteFeedMoreLabel: document.getElementById("quoteFeedMoreLabel"),
  quoteFeedMoreProgress: document.getElementById("quoteFeedMoreProgress"),
  quoteFeedModal: document.getElementById("quoteFeedModal"),
  quoteFeedModalPreview: document.getElementById("quoteFeedModalPreview"),
  quoteFeedModalText: document.getElementById("quoteFeedModalText"),
  quoteFeedModalTitle: document.getElementById("quoteFeedModalTitle"),
  quoteFeedModalAuthor: document.getElementById("quoteFeedModalAuthor"),
  quoteFeedModalDate: document.getElementById("quoteFeedModalDate"),
  myLibraryModal: document.getElementById("myLibraryModal"),
  myLibraryModalTitle: document.getElementById("myLibraryModalTitle"),
  myLibraryModalMeta: document.getElementById("myLibraryModalMeta"),
  myLibraryModalTabs: document.getElementById("myLibraryModalTabs"),
  myLibraryModalList: document.getElementById("myLibraryModalList"),
  quoteFeedOpenWorkButton: document.getElementById("quoteFeedOpenWorkButton"),
  loadMoreWrap: document.getElementById("loadMoreWrap"),
  loadMoreButton: document.getElementById("loadMoreButton"),
  loadMoreLabel: document.getElementById("loadMoreLabel"),
  loadMoreProgress: document.getElementById("loadMoreProgress"),
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  heroSearchBox: document.getElementById("heroSearchBox"),
  siteHeader: document.getElementById("siteHeader"),
  compactHeaderSearch: document.getElementById("compactHeaderSearch"),
  compactSearchInput: document.getElementById("compactSearchInput"),
  compactClearSearch: document.getElementById("compactClearSearch"),
  compactFilterButton: document.getElementById("compactFilterButton"),
  brandText: document.getElementById("brandText"),
  brandLink: document.getElementById("brandLink"),
  ogSiteName: document.getElementById("ogSiteName"),
  ogTitle: document.getElementById("ogTitle"),
  ogUrl: document.getElementById("ogUrl"),
  twitterTitle: document.getElementById("twitterTitle"),
  siteFavicon: document.getElementById("siteFavicon"),
  siteShortcutIcon: document.getElementById("siteShortcutIcon"),
  siteAppleTouchIcon: document.getElementById("siteAppleTouchIcon"),
  combinationFilters: document.getElementById("combinationFilters"),
  contentTypeFilters: document.getElementById("contentTypeFilters"),
  statusFilters: document.getElementById("statusFilters"),
  sourceFilters: document.getElementById("sourceFilters"),
  tabletFilterBar: document.getElementById("tabletFilterBar"),
  tabletCombinationSelect: document.getElementById("tabletCombinationSelect"),
  tabletContentTypeSelect: document.getElementById("tabletContentTypeSelect"),
  tabletStatusSelect: document.getElementById("tabletStatusSelect"),
  tabletSourceSelect: document.getElementById("tabletSourceSelect"),
  controlsGrid: document.getElementById("controlsGrid"),
  filterToggleButton: document.getElementById("filterToggleButton"),
  filterSummary: document.getElementById("filterSummary"),
  mobileFilterBackdrop: document.getElementById("mobileFilterBackdrop"),
  mobileFilterResetButton: document.getElementById("mobileFilterResetButton"),
  mobileFilterCloseButton: document.getElementById("mobileFilterCloseButton"),
  sortSelect: document.getElementById("sortSelect"),
  mobileSortSelect: document.getElementById("mobileSortSelect"),
  bookmarkOnlyButton: document.getElementById("bookmarkOnlyButton"),
  readingOnlyButton: document.getElementById("readingOnlyButton"),
  resumeShortcutButton: document.getElementById("resumeShortcutButton"),
  resumeShortcutText: document.getElementById("resumeShortcutText"),
  resetFiltersButton: document.getElementById("resetFiltersButton"),
  cardViewButton: document.getElementById("cardViewButton"),
  listViewButton: document.getElementById("listViewButton"),
  heroEyebrow: document.getElementById("heroEyebrow"),
  heroTitle: document.getElementById("heroTitle"),
  heroSection: document.getElementById("heroSection"),
  pageScrollTop: document.getElementById("pageScrollTop"),
  readerOverlay: document.getElementById("readerOverlay"),
  readerPanel: document.getElementById("readerPanel"),
  closeReader: document.getElementById("closeReader"),
  readerCombination: document.getElementById("readerCombination"),
  readerLength: document.getElementById("readerLength"),
  readerTitle: document.getElementById("readerTitle"),
  readerAuthor: document.getElementById("readerAuthor"),
  readerFileName: document.getElementById("readerFileName"),
  readerBody: document.getElementById("readerBody"),
  readerResume: document.getElementById("readerResume"),
  readerResumeText: document.getElementById("readerResumeText"),
  readerResumeButton: document.getElementById("readerResumeButton"),
  readerRestartButton: document.getElementById("readerRestartButton"),
  readerScrollModeButton: document.getElementById("readerScrollModeButton"),
  readerPageModeButton: document.getElementById("readerPageModeButton"),
  readerPageViewport: document.getElementById("readerPageViewport"),
  readerPageText: document.getElementById("readerPageText"),
  readerPagePrev: document.getElementById("readerPagePrev"),
  readerPageNext: document.getElementById("readerPageNext"),
  readerPageStatus: document.getElementById("readerPageStatus"),
  readerPageProgressFill: document.getElementById("readerPageProgressFill"),
  readerPageMeasure: document.getElementById("readerPageMeasure"),
  readerPositionStatus: document.getElementById("readerPositionStatus"),
  readerSeekFloat: document.getElementById("readerSeekFloat"),
  readerSeekRange: document.getElementById("readerSeekRange"),
  readerSeekPage: document.getElementById("readerSeekPage"),
  readerLoadingTitle: document.getElementById("readerLoadingTitle"),
  readerLoadingText: document.getElementById("readerLoadingText"),
  readerProgressBar: document.getElementById("readerProgressBar"),
  readerProgressLabel: document.getElementById("readerProgressLabel"),
  readerScrollTop: document.getElementById("readerScrollTop"),
  viewerSettingsButton: document.getElementById("viewerSettingsButton"),
  bookmarkLibraryButton: document.getElementById("bookmarkLibraryButton"),
  recentLibraryButton: document.getElementById("recentLibraryButton"),
  helpButton: document.getElementById("helpButton"),
  appInstallHelpPoint: document.getElementById("appInstallHelpPoint"),
  appInstallHelpSection: document.getElementById("appInstallHelpSection"),
  signupButton: document.getElementById("signupButton"),
  loginButton: document.getElementById("loginButton"),
  readerBookmarkButton: document.getElementById("readerBookmarkButton"),
  readerLikeButton: document.getElementById("readerLikeButton"),
  readerDownloadButton: document.getElementById("readerDownloadButton"),
  readerWorkShareButton: document.getElementById("readerWorkShareButton"),
  readerWorkShareMenu: document.getElementById("readerWorkShareMenu"),
  readerMoreButton: document.getElementById("readerMoreButton"),
  readerMoreMenu: document.getElementById("readerMoreMenu"),
  readerMoreDownloadButton: document.getElementById("readerMoreDownloadButton"),
  readerMoreLinkCopyButton: document.getElementById("readerMoreLinkCopyButton"),
  readerMoreSystemShareButton: document.getElementById("readerMoreSystemShareButton"),
  readerWorkLinkCopyButton: document.getElementById("readerWorkLinkCopyButton"),
  readerWorkSystemShareButton: document.getElementById("readerWorkSystemShareButton"),
  sharedWorkModal: document.getElementById("sharedWorkModal"),
  sharedWorkTitle: document.getElementById("sharedWorkTitle"),
  sharedWorkAuthor: document.getElementById("sharedWorkAuthor"),
  sharedWorkStatus: document.getElementById("sharedWorkStatus"),
  sharedWorkOpenButton: document.getElementById("sharedWorkOpenButton"),
  readerSearchOpenButton: document.getElementById("readerSearchOpenButton"),
  readerSearchModal: document.getElementById("readerSearchModal"),
  readerSearchInput: document.getElementById("readerSearchInput"),
  readerSearchButton: document.getElementById("readerSearchButton"),
  readerSearchResult: document.getElementById("readerSearchResult"),
  readerSearchResults: document.getElementById("readerSearchResults"),
  readerSearchRows: document.getElementById("readerSearchRows"),
  readerSearchPager: document.getElementById("readerSearchPager"),
  readerSearchPrevPage: document.getElementById("readerSearchPrevPage"),
  readerSearchNextPage: document.getElementById("readerSearchNextPage"),
  readerSearchPageStatus: document.getElementById("readerSearchPageStatus"),
  authModal: document.getElementById("authModal"),
  authModalTitle: document.getElementById("authModalTitle"),
  authModalDescription: document.getElementById("authModalDescription"),
  authForm: document.getElementById("authForm"),
  authUserId: document.getElementById("authUserId"),
  authPassword: document.getElementById("authPassword"),
  authRemember: document.getElementById("authRemember"),
  authSubmitButton: document.getElementById("authSubmitButton"),
  authMessage: document.getElementById("authMessage"),
  authGoSignupButton: document.getElementById("authGoSignupButton"),
  authForgotPasswordButton: document.getElementById("authForgotPasswordButton"),
  signupModal: document.getElementById("signupModal"),
  signupFormView: document.getElementById("signupFormView"),
  signupCompleteView: document.getElementById("signupCompleteView"),
  signupForm: document.getElementById("signupForm"),
  signupUserId: document.getElementById("signupUserId"),
  signupPassword: document.getElementById("signupPassword"),
  signupPasswordConfirm: document.getElementById("signupPasswordConfirm"),
  signupRecoveryConfirm: document.getElementById("signupRecoveryConfirm"),
  signupSubmitButton: document.getElementById("signupSubmitButton"),
  signupMessage: document.getElementById("signupMessage"),
  signupGoLoginButton: document.getElementById("signupGoLoginButton"),
  signupCompleteButton: document.getElementById("signupCompleteButton"),
  signupNudge: document.getElementById("signupNudge"),
  signupNudgeClose: document.getElementById("signupNudgeClose"),
  signupNudgeLogin: document.getElementById("signupNudgeLogin"),
  signupNudgeSignup: document.getElementById("signupNudgeSignup"),
  feedbackModal: document.getElementById("feedbackModal"),
  feedbackModalKicker: document.getElementById("feedbackModalKicker"),
  feedbackModalTitle: document.getElementById("feedbackModalTitle"),
  feedbackModalDescription: document.getElementById("feedbackModalDescription"),
  feedbackForm: document.getElementById("feedbackForm"),
  feedbackCategory: document.getElementById("feedbackCategory"),
  feedbackAccountFields: document.getElementById("feedbackAccountFields"),
  feedbackAccountUserId: document.getElementById("feedbackAccountUserId"),
  feedbackReplyContact: document.getElementById("feedbackReplyContact"),
  feedbackPrivacyHint: document.getElementById("feedbackPrivacyHint"),
  feedbackMessage: document.getElementById("feedbackMessage"),
  feedbackWebsite: document.getElementById("feedbackWebsite"),
  feedbackSubmitButton: document.getElementById("feedbackSubmitButton"),
  feedbackMessageState: document.getElementById("feedbackMessageState"),
  feedbackTurnstile: document.getElementById("feedbackTurnstile"),
  feedbackTurnstileHint: document.getElementById("feedbackTurnstileHint"),
  helpModal: document.getElementById("helpModal"),
  helpLoginButton: document.getElementById("helpLoginButton"),
  helpFeedbackButton: document.getElementById("helpFeedbackButton"),
  detailedHelpButton: document.getElementById("detailedHelpButton"),
  detailedHelpModal: document.getElementById("detailedHelpModal"),
  detailedHelpCloseButton: document.getElementById("detailedHelpCloseButton"),
  publicVersion: document.getElementById("publicVersion"),
  copyIssueInfoButton: document.getElementById("copyIssueInfoButton"),
  privacyButton: document.getElementById("privacyButton"),
  privacyModal: document.getElementById("privacyModal"),
  networkStatusBanner: document.getElementById("networkStatusBanner"),
  libraryModal: document.getElementById("libraryModal"),
  libraryModalTitle: document.getElementById("libraryModalTitle"),
  libraryModalDescription: document.getElementById("libraryModalDescription"),
  librarySearchInput: document.getElementById("librarySearchInput"),
  libraryClearButton: document.getElementById("libraryClearButton"),
  libraryModalMeta: document.getElementById("libraryModalMeta"),
  libraryModalList: document.getElementById("libraryModalList"),
  libraryMoreWrap: document.getElementById("libraryMoreWrap"),
  libraryMoreButton: document.getElementById("libraryMoreButton"),
  libraryMoreLabel: document.getElementById("libraryMoreLabel"),
  libraryMoreProgress: document.getElementById("libraryMoreProgress"),
  libraryViewAllButton: document.getElementById("libraryViewAllButton"),
  profilePage: document.getElementById("profilePage"),
  profileSummary: document.getElementById("profileSummary"),
  profileBookmarkCount: document.getElementById("profileBookmarkCount"),
  profileRecentCount: document.getElementById("profileRecentCount"),
  profileLikeCount: document.getElementById("profileLikeCount"),
  profileQuoteCount: document.getElementById("profileQuoteCount"),
  profileLibraryModeTabs: document.getElementById("profileLibraryModeTabs"),
  profileOfflineCount: document.getElementById("profileOfflineCount"),
  profileOfflineActions: document.getElementById("profileOfflineActions"),
  profileOfflineUsageBar: document.getElementById("profileOfflineUsageBar"),
  profileOfflineUsageFill: document.getElementById("profileOfflineUsageFill"),
  profileOfflineUsageText: document.getElementById("profileOfflineUsageText"),
  profileOfflineHelpButton: document.getElementById("profileOfflineHelpButton"),
  profileOfflineHelpToast: document.getElementById("profileOfflineHelpToast"),
  profileOfflineSelectButton: document.getElementById("profileOfflineSelectButton"),
  profileOfflineDeleteSelectedButton: document.getElementById("profileOfflineDeleteSelectedButton"),
  profileOfflineCancelButton: document.getElementById("profileOfflineCancelButton"),
  profileOfflineDeleteAllButton: document.getElementById("profileOfflineDeleteAllButton"),
  profileSearchInput: document.getElementById("profileSearchInput"),
  profileListMeta: document.getElementById("profileListMeta"),
  profileList: document.getElementById("profileList"),
  profileClearButton: document.getElementById("profileClearButton"),
  profileMoreWrap: document.getElementById("profileMoreWrap"),
  profileMoreButton: document.getElementById("profileMoreButton"),
  profileMoreProgress: document.getElementById("profileMoreProgress"),
  profileBackButton: document.getElementById("profileBackButton"),
  profileLogoutButton: document.getElementById("profileLogoutButton"),
  viewerSettingsModal: document.getElementById("viewerSettingsModal"),
  viewerFontMoreButton: document.getElementById("viewerFontMoreButton"),
  viewerFontExtraOptions: document.getElementById("viewerFontExtraOptions"),
  viewerSettingsScopeText: document.getElementById("viewerSettingsScopeText"),
  accountModal: document.getElementById("accountModal"),
  accountModalUser: document.getElementById("accountModalUser"),
  darkModeToggle: document.getElementById("darkModeToggle"),
  readerWakeLockRow: document.getElementById("readerWakeLockRow"),
  readerWakeLockToggle: document.getElementById("readerWakeLockToggle"),
  readerWakeLockHint: document.getElementById("readerWakeLockHint"),
  readerSideMarginButtons: Array.from(document.querySelectorAll("[data-reader-side-margin]")),
  readerSpacingButtons: Array.from(document.querySelectorAll("[data-reader-spacing]")),
  readerFontSizeButtons: Array.from(document.querySelectorAll("[data-reader-font-size]")),
  readerFontFamilyButtons: Array.from(document.querySelectorAll("[data-reader-font-family]")),
  logoutButton: document.getElementById("logoutButton"),
};


const AUTH_TOKEN_KEY = "rjsBookAuthTokenV1";
const AUTH_COOKIE_KEY = "rjsBookAuthRememberV1";
const AUTH_SERVER_COOKIE_KEY = "rjsBookServerSessionV1";
const AUTH_REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function getAuthCookieToken() {
  try {
    const prefix = `${AUTH_COOKIE_KEY}=`;
    const entry = String(document.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
  } catch {
    return "";
  }
}

function setAuthCookieToken(token) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    if (!token) {
      document.cookie = `${AUTH_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
      return;
    }
    document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; Max-Age=${AUTH_REMEMBER_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {}
}

function getCookieValue(name) {
  try {
    const prefix = `${name}=`;
    const entry = String(document.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
  } catch {
    return "";
  }
}

function clearServerAuthCookie() {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${AUTH_SERVER_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
  } catch {}
}

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
    || sessionStorage.getItem(AUTH_TOKEN_KEY)
    || getAuthCookieToken()
    || getCookieValue(AUTH_SERVER_COOKIE_KEY)
    || "";
}

function shouldProbeServerSession() {
  const ua = String(navigator.userAgent || "");
  const appleWebKit = /AppleWebKit/i.test(ua);
  const safari = /Safari/i.test(ua);
  const otherIosBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(ua);
  return appleWebKit && safari && !otherIosBrowser;
}

function setAuthToken(token, remember = true) {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  setAuthCookieToken("");

  if (!token) {
    clearServerAuthCookie();
    return;
  }

  if (remember) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setAuthCookieToken(token);
    return;
  }

  clearServerAuthCookie();
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

async function userApi(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    if (response.status === 401) {
      clearUserSession(false);
    }
    const error = new Error(data?.error || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

let modalScrollLocked = false;
let modalPageScrollY = 0;
let modalLastFocusedElement = null;

function getSimpleModals() {
  return Array.from(document.querySelectorAll(".simple-modal-overlay"));
}

function getOpenSimpleModal() {
  return getSimpleModals().find((modal) => !modal.hidden) || null;
}

function setBackgroundInert(inert) {
  const targets = [
    document.querySelector(".app-shell"),
    els.pageScrollTop,
    els.readerOverlay,
  ].filter(Boolean);

  targets.forEach((target) => {
    if ("inert" in target) {
      target.inert = Boolean(inert);
    }

    if (inert) {
      target.setAttribute("aria-hidden", "true");
    } else {
      target.removeAttribute("aria-hidden");
    }
  });
}

function lockPageForModal() {
  if (modalScrollLocked) return;

  modalScrollLocked = true;
  modalPageScrollY = window.scrollY || window.pageYOffset || 0;
  modalLastFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const scrollbarGap =
    Math.max(0, window.innerWidth - document.documentElement.clientWidth);

  document.documentElement.classList.add("simple-modal-open");
  document.body.classList.add("simple-modal-open");

  // Keep the document at its real scroll position. Using body position:fixed
  // caused some mobile browsers to restore to a different position on close.
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.overscrollBehavior = "none";

  if (scrollbarGap > 0) {
    document.body.style.paddingRight = `${scrollbarGap}px`;
  }

  setBackgroundInert(true);
}

function unlockPageForModal() {
  if (!modalScrollLocked || getOpenSimpleModal()) return;

  modalScrollLocked = false;

  document.documentElement.classList.remove("simple-modal-open");
  document.body.classList.remove("simple-modal-open");

  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.overscrollBehavior = "";
  document.body.style.paddingRight = "";

  setBackgroundInert(false);

  // No scrollTo here: the underlying document was never moved while locked.
  // Restore focus without allowing it to move the viewport.
  if (
    modalLastFocusedElement &&
    document.contains(modalLastFocusedElement)
  ) {
    window.setTimeout(() => {
      try {
        modalLastFocusedElement.focus({ preventScroll: true });
      } catch {
        // Avoid fallback focus() because it can scroll the page on mobile.
      }
    }, 0);
  }

  modalLastFocusedElement = null;
}

function focusModal(modal) {
  if (!modal) return;

  const preferred = modal.querySelector(
    '[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  );

  if (preferred instanceof HTMLElement) {
    window.setTimeout(() => {
      try {
        preferred.focus({ preventScroll: true });
      } catch {
        preferred.focus();
      }
    }, 0);
  }
}

function getHistoryStateWithoutSimpleModal() {
  const next = { ...(history.state || {}) };
  delete next.rjsSimpleModal;
  return next;
}

function closeModal(modal, { fromHistory = false } = {}) {
  if (!modal) return;

  modal.hidden = true;

  if (!fromHistory && history.state?.rjsSimpleModal) {
    history.replaceState(getHistoryStateWithoutSimpleModal(), "", location.href);
  }

  if (!getOpenSimpleModal()) {
    unlockPageForModal();
  }
}

function openModal(modal) {
  if (!modal) return;

  const alreadyOpen = getOpenSimpleModal();

  if (!alreadyOpen) {
    lockPageForModal();
  }

  getSimpleModals().forEach((candidate) => {
    candidate.hidden = candidate !== modal;
  });

  modal.hidden = false;

  const currentMarker = history.state?.rjsSimpleModal || "";
  if (!currentMarker) {
    history.pushState({ ...(history.state || {}), rjsSimpleModal: modal.id || "modal" }, "", location.href);
  } else if (currentMarker !== modal.id) {
    history.replaceState({ ...(history.state || {}), rjsSimpleModal: modal.id || "modal" }, "", location.href);
  }

  focusModal(modal);
}

window.addEventListener("popstate", (event) => {
  const openSimpleModal = getOpenSimpleModal();
  if (openSimpleModal && !event.state?.rjsSimpleModal) {
    closeModal(openSimpleModal, { fromHistory: true });
  }
});

function setAuthMessage(message = "", isError = false) {
  if (!els.authMessage) return;
  els.authMessage.hidden = !message;
  els.authMessage.textContent = message;
  els.authMessage.classList.toggle("error", isError);
}

function setAuthMode(mode) {
  state.authMode = "login";

  if (state.pendingAuthReason) {
    els.authModalDescription.textContent = state.pendingAuthReason;
  } else {
    els.authModalDescription.textContent =
      "로그인하면 다른 기기에서도 이어보기, 북마크, 최근 조회 기록을 불러올 수 있어요.";
  }

  setAuthMessage("");
}


function setSignupMessage(message = "", isError = false) {
  if (!els.signupMessage) return;
  els.signupMessage.hidden = !message;
  els.signupMessage.textContent = message;
  els.signupMessage.classList.toggle("error", isError);
}

function resetSignupModal() {
  els.signupForm?.reset();
  els.signupFormView.hidden = false;
  els.signupCompleteView.hidden = true;
  els.signupSubmitButton.disabled = true;
  setSignupMessage("");
}

function openSignupModal() {
  resetSignupModal();
  openModal(els.signupModal);
  window.setTimeout(() => els.signupUserId?.focus(), 30);
}

function updateSignupButtonState() {
  if (!els.signupSubmitButton) return;

  const password = els.signupPassword?.value || "";
  const passwordConfirm = els.signupPasswordConfirm?.value || "";
  const accepted = Boolean(els.signupRecoveryConfirm?.checked);

  els.signupSubmitButton.disabled =
    !accepted ||
    password.length < 6 ||
    passwordConfirm.length < 6 ||
    password !== passwordConfirm;
}

function openAuthModal(mode = "login", reason = "") {
  state.pendingAuthReason = reason;
  setAuthMode(mode);
  openModal(els.authModal);
  window.setTimeout(() => els.authUserId?.focus(), 30);
}

function clearUserSession(clearToken = true) {
  if (clearToken) setAuthToken("");
  state.user = null;
  state.userLibrary = new Map();
  state.userLikes = new Map();
  state.savedQuotes = [];
  state.savedQuoteCount = null;
  state.savedQuotesLoaded = false;
  state.savedQuotesLoading = false;
  state.savedQuotesError = false;
  state.readerNotes = [];
  state.myLibraryLoaded = false;
  state.myLibraryLoading = false;
  state.myLibraryError = false;
  state.profileUserCreatedAt = null;
  state.profileOpen = false;
  state.remoteProgressState = new Map();
  state.remoteProgressSyncedAt = new Map();
  state.progressSavePending = new Map();
  state.bookmarkPersistedValues = new Map();
  state.authRestoreRetryNeeded = false;
  state.authRestoreRetryCount = 0;
  if (state.authRestoreRetryTimer) {
    window.clearTimeout(state.authRestoreRetryTimer);
    state.authRestoreRetryTimer = 0;
  }
  state.localProgressSavedAt = new Map();
  state.lastExitProgressSignature = "";
  state.lastExitProgressAt = 0;
  state.visitRecordedUserId = "";
  state.bookmarkOnly = false;
  state.readingOnly = false;
  state.resumeShortcutItemId = "";
  applyUserPreferences();
  syncQuickFilterButtons();
  updateResumeShortcut();
  updateAccountUi();
  updateReaderBookmarkButton();
  updateReaderLikeButton();
  hideProfilePage();

  if (state.items.length) {
    render();
  }
}

function updateAccountUi() {
  const loggedIn = Boolean(state.user?.userId);
  if (loggedIn) hideSignupNudge();
  document.documentElement.classList.remove("auth-session-pending");

  if (els.loginButton) {
    if (loggedIn) {
      els.loginButton.innerHTML = `
        <span class="account-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3.25"></circle>
            <path d="M5.5 19c.8-3.5 3.1-5.25 6.5-5.25S17.7 15.5 18.5 19"></path>
          </svg>
        </span>
        <span class="account-id">${escapeHtml(state.user.userId)}</span>
      `;
      els.loginButton.setAttribute("aria-label", `${state.user.userId} 계정`);
    } else {
      els.loginButton.textContent = "로그인";
      els.loginButton.setAttribute("aria-label", "로그인");
    }

    els.loginButton.classList.toggle("logged-in", loggedIn);
  }

  if (els.signupButton) {
    els.signupButton.hidden = loggedIn;
  }
  if (els.helpLoginButton) {
    els.helpLoginButton.hidden = loggedIn;
  }
  if (els.helpModal) {
    els.helpModal.classList.toggle("is-logged-in", loggedIn);
  }
}

function normalizeLibraryRow(row) {
  const progressPercent = Number(row.progress_percent || 0);
  const rawReadAt = row.read_at == null ? null : Number(row.read_at);
  const legacyReadNeedsClear = Boolean(
    rawReadAt &&
    progressPercent < READER_LEGACY_READ_VALID_PERCENT
  );

  return {
    fileId: row.file_id,
    progressPercent,
    scrollTop: row.scroll_top == null ? null : Number(row.scroll_top),
    chunkIndex: row.chunk_index == null ? null : Number(row.chunk_index),
    chunkRatio: row.chunk_ratio == null ? null : Number(row.chunk_ratio),
    bookmarked: Boolean(row.bookmarked),
    viewedAt: row.viewed_at == null ? null : Number(row.viewed_at),
    readAt: legacyReadNeedsClear ? null : rawReadAt,
    legacyReadNeedsClear,
    downloadedAt:
      row.downloaded_at == null ? null : Number(row.downloaded_at),
    updatedAt: row.updated_at == null ? null : Number(row.updated_at),
  };
}


async function recordLoggedInVisit() {
  const userId = state.user?.userId;
  if (!userId || state.visitRecordedUserId === userId) return;

  try {
    await userApi("/api/user/visit", {
      method: "POST",
      body: "{}",
    });
    state.visitRecordedUserId = userId;
  } catch (error) {
    console.warn("방문 기록 저장 실패", error);
  }
}


function syncQuickFilterButtons() {
  if (els.bookmarkOnlyButton) {
    els.bookmarkOnlyButton.classList.toggle("active", state.bookmarkOnly);
    els.bookmarkOnlyButton.setAttribute(
      "aria-pressed",
      state.bookmarkOnly ? "true" : "false"
    );
  }

  if (els.readingOnlyButton) {
    els.readingOnlyButton.classList.toggle("active", state.readingOnly);
    els.readingOnlyButton.setAttribute(
      "aria-pressed",
      state.readingOnly ? "true" : "false"
    );
  }
}

function getLatestReadingItem() {
  if (!state.user) return null;

  let best = null;

  for (const [fileId, entry] of state.userLibrary.entries()) {
    const progress = Number(entry?.progressPercent || 0);
    if (
      progress <= 0 ||
      entry?.readAt
    ) continue;

    const item = state.items.find((candidate) => candidate.id === fileId);
    if (!item) continue;

    const activityAt = Math.max(
      Number(entry.viewedAt || 0),
      Number(entry.updatedAt || 0)
    );

    if (!best || activityAt > best.activityAt) {
      best = { item, entry, activityAt };
    }
  }

  return best;
}

function updateResumeShortcut() {
  if (!els.resumeShortcutButton || !els.resumeShortcutText) return;

  const latest = getLatestReadingItem();

  if (!latest) {
    state.resumeShortcutItemId = "";
    els.resumeShortcutButton.hidden = true;
    return;
  }

  state.resumeShortcutItemId = latest.item.id;

  const percent = Math.max(
    1,
    Math.min(99, Math.max(1, Math.floor(Number(latest.entry.progressPercent || 0))))
  );

  const title = latest.item.title || "제목 미상";
  els.resumeShortcutText.textContent =
    `이어보기 · ${title} ${percent}%`;
  els.resumeShortcutButton.title =
    `${title} ${percent}% 지점부터 이어보기`;
  els.resumeShortcutButton.hidden = false;
}

function requireLoginForPersonalFilter(message) {
  if (state.user) return true;
  openAuthModal("login", message);
  return false;
}

function applyUserLibraryRows(rows = []) {
  state.userLibrary = new Map(
    rows.map((row) => {
      const normalized = normalizeLibraryRow(row);
      return [normalized.fileId, normalized];
    })
  );
  state.bookmarkPersistedValues = new Map(
    [...state.userLibrary.entries()].map(([fileId, entry]) => [
      fileId,
      Boolean(entry?.bookmarked),
    ])
  );

  state.remoteProgressState = new Map(
    [...state.userLibrary.entries()].map(([fileId, entry]) => [
      fileId,
      {
        progressPercent: Number(entry.progressPercent || 0),
        scrollTop: entry.scrollTop,
        chunkIndex: entry.chunkIndex,
        chunkRatio: entry.chunkRatio,
        readAt: entry.readAt,
      },
    ])
  );
  state.remoteProgressSyncedAt = new Map();

  updateReaderBookmarkButton();
  updateReaderLikeButton();
  syncQuickFilterButtons();
  updateResumeShortcut();

  if (state.items.length) {
    render();
  }
}

async function loadUserLibrary() {
  if (!state.user) {
    state.userLibrary = new Map();
    return;
  }

  const data = await userApi("/api/user/library");
  applyUserLibraryRows(data.items || []);
}


function normalizeProfileLike(row) {
  return {
    workId: String(row?.work_id || ""),
    title: String(row?.title || ""),
    author: String(row?.author || ""),
    likedAt: row?.liked_at == null ? null : Number(row.liked_at),
  };
}

function normalizeSavedQuote(row) {
  const shared = Number(row?.is_shared ?? row?.shared ?? 0) === 1 || row?.shared === true;
  const rawStartOffset = row?.start_offset ?? row?.startOffset;
  const rawEndOffset = row?.end_offset ?? row?.endOffset;
  return {
    id: Number(row?.id || 0),
    title: String(row?.title || ""),
    author: String(row?.author || ""),
    quoteText: String(row?.quote_text ?? row?.quoteText ?? ""),
    workId: String(row?.work_id ?? row?.workId ?? ""),
    startOffset: rawStartOffset == null ? null : Number(rawStartOffset),
    endOffset: rawEndOffset == null ? null : Number(rawEndOffset),
    sourceText: String(row?.source_text ?? row?.sourceText ?? ""),
    createdAt: Number(row?.created_at ?? row?.createdAt ?? 0),
    shared,
    sharedAt: row?.shared_at == null && row?.sharedAt == null ? null : Number(row?.shared_at ?? row?.sharedAt),
    _persistedShared: shared,
    _shareSaving: false,
    _locationSaving: false,
  };
}

function applyUserProfileData(data = {}) {
  state.userLikes = new Map(
    (data.likes || []).map((row) => {
      const like = normalizeProfileLike(row);
      return [like.workId, like];
    })
  );
  if (Array.isArray(data.quotes)) {
    state.savedQuotes = data.quotes.map(normalizeSavedQuote);
    state.savedQuoteCount = state.savedQuotes.length;
    state.savedQuotesLoaded = true;
    state.savedQuotesLoading = false;
    state.savedQuotesError = false;
  } else if (data.user?.savedQuoteCount != null) {
    state.savedQuoteCount = Math.max(0, Number(data.user.savedQuoteCount) || 0);
  }
  state.profileUserCreatedAt = data.user?.createdAt == null
    ? null
    : Number(data.user.createdAt);

  updateReaderLikeButton();
  if (state.profileOpen) renderProfilePage();
  if (state.items.length) render();
}

async function loadUserProfileData() {
  if (!state.user) {
    state.userLikes = new Map();
    state.savedQuotes = [];
    state.readerNotes = [];
    state.myLibraryLoaded = false;
    state.myLibraryError = false;
    state.profileUserCreatedAt = null;
    return;
  }

  try {
    const data = await userApi("/api/user/profile");
    applyUserProfileData(data);
  } catch (error) {
    console.warn("개인화 데이터 불러오기 실패", error);
    state.userLikes = new Map();
    state.savedQuotes = [];
    state.savedQuotesLoaded = false;
  }
}

async function loadSavedQuotes() {
  if (!state.user || state.savedQuotesLoaded || state.savedQuotesLoading) return;

  state.savedQuotesLoading = true;
  state.savedQuotesError = false;
  if (state.profileOpen && state.profileTab === "quotes") renderProfilePage();

  try {
    const data = await userApi("/api/user/profile?section=quotes");
    state.savedQuotes = (data.quotes || []).map(normalizeSavedQuote);
    state.savedQuoteCount = state.savedQuotes.length;
    state.savedQuotesLoaded = true;
  } catch (error) {
    console.warn("저장문장 불러오기 실패", error);
    state.savedQuotesError = true;
  } finally {
    state.savedQuotesLoading = false;
    if (state.profileOpen) renderProfilePage();
  }
}

async function loadUserBootstrap() {
  if (!state.user) return;

  const data = await userApi("/api/user/bootstrap", {
    method: "POST",
    body: "{}",
  });

  if (data.user?.userId) {
    state.user = { ...state.user, ...data.user };
  }

  applyUserLibraryRows(data.items || []);
  applyUserProfileData(data);

  if (data.visitRecorded !== false) {
    state.visitRecordedUserId = state.user?.userId || "";
  }
}

function isItemLiked(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return Boolean(id && state.userLikes.has(id));
}

function formatProfileDate(timestamp) {
  if (!timestamp) return "";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

async function toggleItemLike(item) {
  if (!item?.id || item.source === "postype") return;
  if (!state.user) {
    openAuthModal("login", "좋아요를 저장하려면 로그인해 주세요.");
    return;
  }

  const liked = !isItemLiked(item);
  if (liked) {
    state.userLikes.set(item.id, {
      workId: item.id,
      title: item.title || "",
      author: item.author || "",
      likedAt: Date.now(),
    });
  } else {
    state.userLikes.delete(item.id);
  }
  updateReaderLikeButton();
  render();
  if (state.profileOpen) renderProfilePage();

  try {
    await userApi("/api/user/profile", {
      method: "POST",
      body: JSON.stringify({
        action: "like",
        workId: item.id,
        title: item.title || "",
        author: item.author || "",
        liked,
      }),
    });
  } catch (error) {
    if (liked) state.userLikes.delete(item.id);
    else state.userLikes.set(item.id, {
      workId: item.id,
      title: item.title || "",
      author: item.author || "",
      likedAt: Date.now(),
    });
    updateReaderLikeButton();
    render();
    if (state.profileOpen) renderProfilePage();
    window.alert("좋아요를 저장하지 못했습니다. 다시 시도해 주세요.");
  }
}

function updateReaderLikeButton() {
  if (!els.readerLikeButton) return;
  const eligible = Boolean(state.activeReaderItem && state.activeReaderItem.source !== "postype");
  els.readerLikeButton.hidden = !eligible;
  if (!eligible) {
    els.readerLikeButton.classList.remove("active");
    els.readerLikeButton.setAttribute("aria-pressed", "false");
    return;
  }
  const liked = Boolean(state.user && isItemLiked(state.activeReaderItem));
  els.readerLikeButton.classList.toggle("active", liked);
  els.readerLikeButton.setAttribute("aria-pressed", liked ? "true" : "false");
  els.readerLikeButton.title = liked ? "좋아요 취소" : "좋아요";
  const label = els.readerLikeButton.querySelector(".reader-like-label");
  if (label) label.textContent = liked ? "좋아요됨" : "좋아요";
}

function getProfileWorkEntry(item, entry, kind) {
  const progress = Number(entry?.progressPercent || 0);
  const meta = [item.author || "작성자 미상"];
  if (kind === "recent" && progress > 0 && !entry?.readAt) {
    meta.push(`${getReaderProgressDisplayPercent(progress)}%`);
  }
  return `
    <div class="profile-entry" data-profile-work-id="${escapeHtml(item.id)}">
      <div class="profile-entry-main">
        <span class="profile-entry-title">${escapeHtml(item.title || "제목 미상")}</span>
        <span class="profile-entry-meta">${escapeHtml(meta.join(" · "))}</span>
      </div>
      <div class="profile-entry-actions">
        <button type="button" data-profile-open="${escapeHtml(item.id)}">열기</button>
        ${kind === "bookmarks" ? `<button type="button" data-profile-bookmark-remove="${escapeHtml(item.id)}">해제</button>` : ""}
        ${kind === "recent" ? `<button type="button" data-profile-recent-remove="${escapeHtml(item.id)}">삭제</button>` : ""}
      </div>
    </div>`;
}


function normalizeReaderNote(row) {
  const rawStart = row?.start_offset ?? row?.startOffset;
  const rawEnd = row?.end_offset ?? row?.endOffset;
  return {
    id: Number(row?.id || 0), workId: String(row?.work_id ?? row?.workId ?? ""),
    title: String(row?.title || ""), author: String(row?.author || ""),
    noteText: String(row?.note_text ?? row?.noteText ?? ""), quoteText: String(row?.quote_text ?? row?.quoteText ?? ""),
    startOffset: rawStart == null ? null : Number(rawStart),
    endOffset: rawEnd == null ? null : Number(rawEnd),
    createdAt: Number(row?.created_at ?? row?.createdAt ?? 0), updatedAt: Number(row?.updated_at ?? row?.updatedAt ?? 0),
  };
}

async function loadMyLibrary(force = false) {
  if (!state.user || state.myLibraryLoading || (state.myLibraryLoaded && !force)) return;
  state.myLibraryLoading = true;
  state.myLibraryError = false;
  if (state.profileOpen) renderProfilePage();
  try {
    const data = await userApi("/api/user/profile?section=library");
    state.savedQuotes = (data.quotes || []).map(normalizeSavedQuote);
    state.savedQuoteCount = state.savedQuotes.length;
    state.savedQuotesLoaded = true;
    state.readerNotes = (data.notes || []).map(normalizeReaderNote);
    state.myLibraryLoaded = true;
  } catch (error) {
    // userApi already clears the session and closes the profile on HTTP 401.
    if (Number(error?.status) !== 401 && state.user) {
      state.myLibraryError = true;
      console.warn("내 서재 불러오기 실패", error);
    }
  } finally {
    state.myLibraryLoading = false;
    if (state.profileOpen) renderProfilePage();
  }
}

function getMyLibraryWorks() {
  const map = new Map();
  const touch = (workId,title,author) => {
    const key=String(workId||""); if(!key) return null;
    if(!map.has(key)) map.set(key,{workId:key,title:title||"제목 미상",author:author||"",quotes:[],notes:[]});
    return map.get(key);
  };
  state.savedQuotes.forEach(q=>{
    let workId=q.workId;
    if(!workId){ const item=state.items.find(candidate=>normalizeSearchText(candidate.title)===normalizeSearchText(q.title)&&normalizeSearchText(candidate.author)===normalizeSearchText(q.author)); workId=item?.id||""; if(workId) q.workId=String(workId); }
    const row=touch(workId,q.title,q.author); if(row) row.quotes.push(q);
  });
  state.readerNotes.forEach(n=>{ const row=touch(n.workId,n.title,n.author); if(row) row.notes.push(n); });
  return [...map.values()].sort((a,b)=>Math.max(...b.quotes.map(x=>x.createdAt),...b.notes.map(x=>x.createdAt),0)-Math.max(...a.quotes.map(x=>x.createdAt),...a.notes.map(x=>x.createdAt),0));
}

function openMyLibraryWork(workId) {
  const row=getMyLibraryWorks().find(x=>x.workId===String(workId)); if(!row || !els.myLibraryModal) return;
  state.myLibraryDetailWorkId=row.workId; state.myLibraryDetailTab="all";
  renderMyLibraryModal(); openModal(els.myLibraryModal);
}

function renderMyLibraryModal() {
  const row=getMyLibraryWorks().find(x=>x.workId===state.myLibraryDetailWorkId); if(!row) return;
  els.myLibraryModalTitle.textContent=row.title||"내 서재";
  els.myLibraryModalMeta.textContent=`문장 ${row.quotes.length} · 메모 ${row.notes.length}`;
  els.myLibraryModalTabs?.querySelectorAll("[data-library-detail-tab]").forEach(b=>b.classList.toggle("active",b.dataset.libraryDetailTab===state.myLibraryDetailTab));
  const all=[...row.quotes.map(x=>({kind:"quote",at:x.createdAt,data:x})),...row.notes.map(x=>({kind:"note",at:x.createdAt,data:x}))].sort((a,b)=>b.at-a.at);
  const visible=all.filter(x=>state.myLibraryDetailTab==="all" || (state.myLibraryDetailTab==="quotes"&&x.kind==="quote") || (state.myLibraryDetailTab==="notes"&&x.kind==="note"));
  els.myLibraryModalList.innerHTML=visible.length?visible.map(x=>{
    const d=x.data; const loc=Number.isFinite(d.startOffset)?"원문 위치 저장됨":"";
    return `<article class="my-library-detail-card"><div class="my-library-detail-kind"><span>${x.kind==="quote"?"문장":"메모"}</span><span>${loc}</span></div>${x.kind==="quote"?`<p class="my-library-detail-quote">${escapeHtml(d.quoteText)}</p>`:`${d.quoteText?`<p class="my-library-detail-quote">${escapeHtml(d.quoteText)}</p>`:""}<p class="my-library-detail-note">${escapeHtml(d.noteText)}</p>`}<div class="my-library-detail-actions">${Number.isFinite(d.startOffset)?`<button type="button" data-library-open-location="${x.kind}" data-library-entry-id="${d.id}">원문 보기</button>`:""}${x.kind==="quote"?`<label class="my-library-feed-toggle"><span>피드 공유</span><button class="my-library-feed-switch${d.shared?" active":""}" type="button" role="switch" aria-checked="${d.shared?"true":"false"}" aria-label="문장 피드 공유" data-library-quote-share="${d.id}"><span class="my-library-feed-switch-knob" aria-hidden="true"></span></button></label><button type="button" data-library-quote-copy="${d.id}">복사</button><button type="button" data-library-quote-delete="${d.id}">삭제</button>`:`<button type="button" data-library-note-edit="${d.id}">수정</button><button type="button" data-library-note-delete="${d.id}">삭제</button>`}</div></article>`;
  }).join(""):'<div class="profile-empty">아직 남긴 기록이 없습니다.</div>';
}

function formatOfflineStorageBytes(bytes) {
  const mb = Math.max(0, Number(bytes) || 0) / (1024 * 1024);
  if (mb === 0) return "0 MB";
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function updateOfflineStorageUsage() {
  const bytes = Math.max(0, Number(state.offlineBodyBytes) || 0);
  const maxBytes = Math.max(1, Number(state.offlineBodyMaxBytes) || (32 * 1024 * 1024));
  const percent = Math.max(0, Math.min(100, (bytes / maxBytes) * 100));
  if (els.profileOfflineUsageFill) els.profileOfflineUsageFill.style.width = `${percent}%`;
  if (els.profileOfflineUsageBar) els.profileOfflineUsageBar.setAttribute("aria-valuenow", String(Math.round(percent)));
  if (els.profileOfflineUsageText) els.profileOfflineUsageText.textContent = `${formatOfflineStorageBytes(bytes)} / ${formatOfflineStorageBytes(maxBytes)}`;
}

function renderProfilePage() {
  if (!els.profilePage || !state.user) return;
  const q = normalizeSearchText(state.profileSearch);
  const bookmarked = getLibraryVisibleEntries("bookmarks", "");
  const recent = getLibraryVisibleEntries("recent", "");
  const likes = [...state.userLikes.values()]
    .filter((like) => {
      const item = state.items.find((candidate) => candidate.id === like.workId);
      return !item || item.source !== "postype";
    })
    .sort((a,b) => Number(b.likedAt||0) - Number(a.likedAt||0));
  const quotes = [...state.savedQuotes]
    .sort((a,b) => Number(b.createdAt||0) - Number(a.createdAt||0));

  if (els.profileBookmarkCount) els.profileBookmarkCount.textContent = String(bookmarked.length);
  if (els.profileRecentCount) els.profileRecentCount.textContent = String(recent.length);
  if (els.profileLikeCount) els.profileLikeCount.textContent = String(likes.length);
  if (els.profileQuoteCount) {
    const quoteCount = state.myLibraryLoaded
      ? getMyLibraryWorks().length
      : Number.isFinite(state.savedQuoteCount)
        ? Math.max(0, Number(state.savedQuoteCount))
        : null;
    els.profileQuoteCount.textContent = quoteCount == null ? "—" : String(quoteCount);
  }
  if (els.profileSummary) {
    const joined = formatProfileDate(state.profileUserCreatedAt);
    const profileUserId = String(state.user?.userId || state.user?.id || "").trim();
    els.profileSummary.textContent = joined
      ? `${profileUserId ? `${profileUserId} · ` : ""}가입 ${joined}`
      : `${profileUserId ? `${profileUserId} · ` : ""}개인 보관함`;
  }

  document.querySelectorAll("[data-profile-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileTab === state.profileTab);
  });
  if (els.profileLibraryModeTabs) {
    els.profileLibraryModeTabs.hidden = state.profileTab !== "library";
    els.profileLibraryModeTabs.querySelectorAll("[data-profile-library-mode]").forEach((button) => {
      const active = button.dataset.profileLibraryMode === state.profileLibraryMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
  const offlineCount = getOfflineArchiveItems().length;
  if (els.profileOfflineCount) els.profileOfflineCount.textContent = String(offlineCount);
  const offlineViewActive = state.profileTab === "library" && state.profileLibraryMode === "offline";
  if (!offlineViewActive && state.offlineDeleteMode) {
    state.offlineDeleteMode = false;
    state.offlineDeleteSelection.clear();
  }
  if (els.profileOfflineActions) els.profileOfflineActions.hidden = !offlineViewActive;
  if (offlineViewActive) updateOfflineStorageUsage();
  if (!offlineViewActive && els.profileOfflineHelpToast) {
    els.profileOfflineHelpToast.hidden = true;
    els.profileOfflineHelpButton?.setAttribute("aria-expanded", "false");
  }
  if (els.profileOfflineSelectButton) els.profileOfflineSelectButton.hidden = !offlineViewActive || state.offlineDeleteMode || offlineCount === 0;
  if (els.profileOfflineDeleteSelectedButton) {
    const selectedCount = state.offlineDeleteSelection.size;
    els.profileOfflineDeleteSelectedButton.hidden = !offlineViewActive || !state.offlineDeleteMode;
    els.profileOfflineDeleteSelectedButton.disabled = selectedCount === 0;
    els.profileOfflineDeleteSelectedButton.textContent = selectedCount ? `선택 삭제 ${selectedCount}` : "선택 삭제";
  }
  if (els.profileOfflineCancelButton) els.profileOfflineCancelButton.hidden = !offlineViewActive || !state.offlineDeleteMode;
  if (els.profileOfflineDeleteAllButton) {
    els.profileOfflineDeleteAllButton.hidden = !offlineViewActive || state.offlineDeleteMode || offlineCount === 0;
    els.profileOfflineDeleteAllButton.disabled = offlineCount === 0;
  }

  let rows = [];
  let html = "";
  if (state.profileTab === "bookmarks") {
    rows = bookmarked.filter(({item}) => !q || normalizeSearchText(`${item?.title||""} ${item?.author||""}`).includes(q));
    html = rows.length
      ? rows.map(({item,entry}) => getProfileWorkEntry(item,entry,"bookmarks")).join("")
      : '<div class="profile-empty">저장된 북마크가 없습니다.</div>';
  } else if (state.profileTab === "recent") {
    rows = recent.filter(({item}) => !q || normalizeSearchText(`${item?.title||""} ${item?.author||""}`).includes(q));
    html = rows.length
      ? rows.map(({item,entry}) => getProfileWorkEntry(item,entry,"recent")).join("")
      : '<div class="profile-empty">최근 본 작품이 없습니다.</div>';
  } else if (state.profileTab === "likes") {
    rows = likes.filter((like) => !q || normalizeSearchText(`${like.title} ${like.author}`).includes(q));
    html = rows.length ? rows.map((like) => {
      const item = state.items.find((candidate) => candidate.id === like.workId);
      return `
        <div class="profile-entry">
          <div class="profile-entry-main">
            <span class="profile-entry-title">${escapeHtml(item?.title || like.title || "제목 미상")}</span>
            <span class="profile-entry-meta">${escapeHtml(item?.author || like.author || "작성자 미상")}</span>
          </div>
          <div class="profile-entry-actions">
            ${item ? `<button type="button" data-profile-open="${escapeHtml(item.id)}">열기</button>` : ""}
            <button type="button" data-profile-like-remove="${escapeHtml(like.workId)}">좋아요 취소</button>
          </div>
        </div>`;
    }).join("") : '<div class="profile-empty">좋아요한 작품이 없습니다.</div>';
  } else if (state.profileTab === "library") {
    if (state.profileLibraryMode === "offline") {
      const offlineWorks = getOfflineArchiveItems()
        .filter((item) => !q || normalizeSearchText(`${item.title || ""} ${item.author || ""}`).includes(q))
        .sort((a, b) => ARCHIVE_COLLATOR.compare(a.title || "", b.title || ""));
      rows = offlineWorks;
      html = offlineWorks.length ? offlineWorks.map((item) => {
        const selected = state.offlineDeleteSelection.has(String(item.id));
        return `
        <div class="profile-entry offline-profile-entry${state.offlineDeleteMode ? " is-selecting" : ""}${selected ? " is-selected" : ""}">
          <div class="profile-entry-main">
            ${state.offlineDeleteMode ? `<label class="offline-profile-check"><input type="checkbox" data-offline-select="${escapeHtml(item.id)}" ${selected ? "checked" : ""} /><span aria-hidden="true"></span></label>` : ""}
            <span class="offline-profile-copy">
              <span class="profile-entry-title">${escapeHtml(item.title || "제목 미상")}</span>
              <span class="profile-entry-meta">${escapeHtml(item.author || "작성자 미상")} · 이 브라우저에 본문 저장됨</span>
            </span>
          </div>
          <div class="profile-entry-actions">
            ${state.offlineDeleteMode ? "" : `<button type="button" data-profile-open="${escapeHtml(item.id)}">열기</button><button class="offline-entry-delete" type="button" data-offline-delete="${escapeHtml(item.id)}">삭제</button>`}
          </div>
        </div>`;
      }).join("") : '<div class="profile-empty">이 브라우저에 오프라인 저장된 작품이 없습니다.</div>';
    } else if (!state.myLibraryLoaded) {
      rows = [];
      html = state.myLibraryError
        ? '<div class="profile-empty">내 서재를 불러오지 못했습니다. 내 서재 탭을 다시 눌러주세요.</div>'
        : '<div class="profile-empty">내 서재를 불러오는 중입니다.</div>';
    } else {
      const works = getMyLibraryWorks().filter((row) => !q || normalizeSearchText(`${row.title} ${row.author}`).includes(q));
      rows = works;
      html = works.length ? works.map((row) => `
        <div class="profile-entry my-library-work" data-library-work="${escapeHtml(row.workId)}">
          <div class="profile-entry-main"><span class="profile-entry-title">${escapeHtml(row.title)}</span><span class="profile-entry-meta">${escapeHtml(row.author||"")}</span>
          <div class="my-library-counts"><span>문장 ${row.quotes.length}</span><span>메모 ${row.notes.length}</span></div></div>
          <div class="profile-entry-actions"><button type="button" data-library-work="${escapeHtml(row.workId)}">보기</button></div>
        </div>`).join("") : '<div class="profile-empty">내 서재에 저장된 작품이 없습니다.</div>';
    }
  } else {
    if (!state.savedQuotesLoaded) {
      rows = [];
      html = state.savedQuotesLoading
        ? '<div class="profile-empty">저장한 문장을 불러오는 중입니다.</div>'
        : state.savedQuotesError
          ? '<div class="profile-empty">저장한 문장을 불러오지 못했습니다. 탭을 다시 눌러주세요.</div>'
          : '<div class="profile-empty">저장한 문장을 불러오는 중입니다.</div>';
    } else {
      rows = quotes.filter((quote) => !q || normalizeSearchText(`${quote.title} ${quote.author} ${quote.quoteText}`).includes(q));
      html = rows.length ? rows.map((quote) => `
        <div class="profile-entry quote-entry">
          <div class="profile-entry-main">
            <span class="profile-entry-title">${escapeHtml(quote.title || "제목 미상")}</span>
            <span class="profile-entry-meta">${escapeHtml(quote.author || "작성자 미상")}</span>
            <p class="profile-entry-quote">${escapeHtml(quote.quoteText)}</p>
          </div>
          <div class="profile-entry-actions">
            ${getSavedQuoteMoveButton(quote)}
            <button type="button" class="profile-quote-share-toggle" data-profile-quote-share="${quote.id}" role="switch" aria-checked="${quote.shared ? "true" : "false"}" ${quote._shareSaving ? "disabled" : ""}>
              <span class="profile-quote-share-toggle-track" aria-hidden="true"><span></span></span>
              <span class="profile-quote-share-toggle-label">피드 공유</span>
            </button>
            <button type="button" data-profile-quote-copy="${quote.id}">복사</button>
            <button type="button" data-profile-quote-delete="${quote.id}">삭제</button>
          </div>
        </div>`).join("") : '<div class="profile-empty">저장한 문장이 없습니다.</div>';
    }
  }

  const pagedKinds = state.profileTab === "bookmarks" || state.profileTab === "recent";
  const total = rows.length;
  const shown = pagedKinds ? Math.min(total, state.profileVisibleLimit) : total;
  if (pagedKinds && total) {
    const visibleRows = rows.slice(0, shown);
    html = state.profileTab === "bookmarks"
      ? visibleRows.map(({item,entry}) => getProfileWorkEntry(item,entry,"bookmarks")).join("")
      : visibleRows.map(({item,entry}) => getProfileWorkEntry(item,entry,"recent")).join("");
  }

  els.profileList.innerHTML = html;
  if (els.profileListMeta) {
    els.profileListMeta.textContent = pagedKinds && total > shown ? `${shown} / ${total}개` : `${total}개`;
  }

  if (els.profileClearButton) {
    const clearable = state.profileTab === "bookmarks" || state.profileTab === "recent";
    els.profileClearButton.hidden = !clearable;
    els.profileClearButton.disabled = !clearable || total === 0;
    els.profileClearButton.textContent = "전체삭제";
  }
  if (els.profileMoreWrap) {
    const hasMore = pagedKinds && shown < total;
    els.profileMoreWrap.hidden = !hasMore;
    if (els.profileMoreProgress) els.profileMoreProgress.textContent = `${shown} / ${total}`;
    if (els.profileMoreButton) els.profileMoreButton.textContent = `${Math.min(15, total - shown)}개 더보기`;
  }
}


function normalizeQuoteFeedItem(row) {
  const rawStartOffset = row?.start_offset ?? row?.startOffset;
  const rawEndOffset = row?.end_offset ?? row?.endOffset;
  return {
    quoteId: Number(row?.quote_id ?? row?.quoteId ?? 0),
    workId: String(row?.work_id ?? row?.workId ?? ""),
    title: String(row?.title || ""),
    author: String(row?.author || ""),
    quoteText: String(row?.quote_text ?? row?.quoteText ?? ""),
    startOffset: rawStartOffset == null ? null : Number(rawStartOffset),
    endOffset: rawEndOffset == null ? null : Number(rawEndOffset),
    sharedAt: Number(row?.shared_at ?? row?.sharedAt ?? 0),
    likeCount: Math.max(0, Number(row?.like_count ?? row?.likeCount ?? 0)),
    liked: Number(row?.liked || 0) === 1 || row?.liked === true,
  };
}

function getQuoteFeedTheme(item) {
  const source = `${item?.quoteId || 0}:${item?.sharedAt || 0}:${item?.title || ""}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const themes = READER_SHARE_BACKGROUNDS || [];
  return themes[Math.abs(hash >>> 0) % Math.max(1, themes.length)] || {
    background: "linear-gradient(145deg,#fffdf9,#f6f3ee)",
    text: "#191816",
    meta: "#77716a",
  };
}

function getQuoteFeedCardSizes(text) {
  const length = Array.from(String(text || "")).length;
  if (length <= 80) return { desktop: 18, mobile: 13 };
  if (length <= 160) return { desktop: 15, mobile: 11.5 };
  if (length <= 280) return { desktop: 13, mobile: 10.5 };
  return { desktop: 11.5, mobile: 9.5 };
}

function formatQuoteFeedDate(value) {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  const kst = new Date(timestamp + (9 * 60 * 60 * 1000));
  if (Number.isNaN(kst.getTime())) return "";
  const year = String(kst.getUTCFullYear()).slice(-2);
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function findQuoteFeedWork(item) {
  if (!item) return null;
  if (item.workId) {
    const direct = state.items.find((candidate) => String(candidate.id) === String(item.workId));
    if (direct) return direct;
  }
  const title = normalizeSearchText(item.title);
  const author = normalizeSearchText(item.author);
  if (!title) return null;
  const matches = state.items.filter((candidate) =>
    normalizeSearchText(candidate.title) === title &&
    (!author || normalizeSearchText(candidate.author) === author)
  );
  // A stale/missing workId must never fall through to an arbitrary same-title work.
  return matches.length === 1 ? matches[0] : null;
}

function getQuoteFeedJump(item) {
  if (!item) return null;
  const quoteText = String(item.quoteText || "").trim();
  if (!quoteText) return null;
  return {
    _feedJump: true,
    workId: String(item.workId || ""),
    quoteText,
    sourceText: quoteText,
    startOffset: item.startOffset == null || !Number.isFinite(Number(item.startOffset))
      ? null
      : Number(item.startOffset),
    endOffset: item.endOffset == null || !Number.isFinite(Number(item.endOffset))
      ? null
      : Number(item.endOffset),
  };
}

function renderQuoteFeed() {
  if (!els.quoteFeedGrid) return;
  const items = state.quoteFeedItems;

  if (!items.length) {
    els.quoteFeedGrid.innerHTML = "";
    if (els.quoteFeedStatus) {
      els.quoteFeedStatus.hidden = false;
      els.quoteFeedStatus.textContent = state.quoteFeedLoading
        ? "공유된 문장을 불러오는 중입니다."
        : "아직 공유된 문장이 없습니다.";
    }
  } else {
    if (els.quoteFeedStatus) els.quoteFeedStatus.hidden = true;
    // CSS/SVG backgrounds may contain quotes (e.g. url("data:image/svg+xml,...")).
    // Set theme variables on DOM nodes after HTML parsing, as the detail view does.
    // Interpolating them into a quoted HTML style attribute truncates some feed cards.
    const cardThemes = items.map(getQuoteFeedTheme);
    els.quoteFeedGrid.innerHTML = items.map((item) => {
      const sizes = getQuoteFeedCardSizes(item.quoteText);
      const saving = state.quoteFeedLikeSaving.has(String(item.quoteId));
      return `
        <article class="quote-feed-card"
          style="--quote-size:${sizes.desktop}px;--quote-mobile-size:${sizes.mobile}px">
          <button type="button" class="quote-feed-card-open" data-quote-feed-id="${item.quoteId}" aria-label="문장 자세히 보기">
            <span class="quote-feed-card-inner">
              <span class="quote-feed-card-copy"><span class="quote-feed-card-text">${escapeHtml(item.quoteText)}</span></span>
              <span class="quote-feed-card-source">
                <strong>${escapeHtml(item.title || "제목 미상")}</strong>
                <span>${escapeHtml(item.author || "작성자 미상")}</span>
              </span>
            </span>
          </button>
          <button type="button" class="quote-feed-like-button${item.liked ? " is-liked" : ""}" data-quote-feed-like="${item.quoteId}" aria-pressed="${item.liked ? "true" : "false"}" aria-label="${item.liked ? "문장 좋아요 취소" : "문장 좋아요"}, ${item.likeCount}개" ${saving ? "disabled" : ""}>
            <span aria-hidden="true">${item.liked ? "♥" : "♡"}</span><b>${item.likeCount}</b>
          </button>
        </article>`;
    }).join("");
    els.quoteFeedGrid.querySelectorAll(".quote-feed-card").forEach((card, index) => {
      const theme = cardThemes[index];
      card.style.setProperty("--quote-bg", theme.background);
      card.style.setProperty("--quote-color", theme.text);
    });
  }

  if (els.quoteFeedStatus && state.quoteFeedError) {
    els.quoteFeedStatus.hidden = false;
    els.quoteFeedStatus.textContent = state.quoteFeedError;
  }

  if (els.quoteFeedSortLatest) {
    els.quoteFeedSortLatest.classList.toggle("is-active", state.quoteFeedSort === "latest");
    els.quoteFeedSortLatest.disabled = state.quoteFeedLoading;
  }
  if (els.quoteFeedSortLikes) {
    els.quoteFeedSortLikes.classList.toggle("is-active", state.quoteFeedSort === "likes");
    els.quoteFeedSortLikes.disabled = state.quoteFeedLoading;
  }
  if (els.quoteFeedMeta) {
    els.quoteFeedMeta.textContent = items.length ? `${items.length}개 표시 중` : "";
  }
  if (els.quoteFeedMoreWrap) {
    els.quoteFeedMoreWrap.hidden = !state.quoteFeedNextCursor;
  }
  if (els.quoteFeedMoreButton) {
    els.quoteFeedMoreButton.disabled = state.quoteFeedLoading;
  }
  if (els.quoteFeedMoreLabel) {
    els.quoteFeedMoreLabel.textContent = state.quoteFeedLoading ? "불러오는 중…" : "더보기 18개";
  }
  if (els.quoteFeedMoreProgress) {
    els.quoteFeedMoreProgress.textContent = items.length ? `${items.length.toLocaleString("ko-KR")}개 표시 중` : "";
  }
}

async function loadQuoteFeed({ append = false } = {}) {
  if (state.quoteFeedLoading) return;
  if (append && !state.quoteFeedNextCursor) return;
  state.quoteFeedLoading = true;
  state.quoteFeedError = "";
  renderQuoteFeed();
  try {
    const params = new URLSearchParams({ limit: "18", sort: state.quoteFeedSort });
    if (append && state.quoteFeedNextCursor) params.set("cursor", state.quoteFeedNextCursor);
    const headers = new Headers();
    const token = getAuthToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetch(`/api/quotes-feed?${params.toString()}`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error("문장 피드를 불러오지 못했습니다.");
    const data = await response.json();
    const incoming = (data.items || []).map(normalizeQuoteFeedItem);
    state.quoteFeedItems = append ? [...state.quoteFeedItems, ...incoming] : incoming;
    state.quoteFeedNextCursor = data.nextCursor || null;
    state.quoteFeedLoaded = true;
  } catch (error) {
    console.warn("문장 피드 불러오기 실패", error);
    if (!append) state.quoteFeedItems = [];
    state.quoteFeedError = "문장 피드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    state.quoteFeedLoading = false;
    renderQuoteFeed();
  }
}

async function setQuoteFeedLike(item, liked) {
  if (!item) return;
  if (!state.user) {
    openAuthModal("login", "문장에 좋아요를 누르려면 로그인해 주세요.");
    return;
  }
  const key = String(item.quoteId);
  if (state.quoteFeedLikeSaving.has(key)) return;
  state.quoteFeedLikeSaving.add(key);
  renderQuoteFeed();
  let changed = false;
  try {
    const data = await userApi("/api/quote-like", {
      method: "POST",
      body: JSON.stringify({ quoteId: item.quoteId, liked: Boolean(liked) }),
    });
    item.liked = data.liked === true;
    item.likeCount = Math.max(0, Number(data.likeCount || 0));
    changed = true;
    if (state.quoteFeedActiveItem?.quoteId === item.quoteId) {
      state.quoteFeedActiveItem.liked = item.liked;
      state.quoteFeedActiveItem.likeCount = item.likeCount;
    }
  } catch (error) {
    console.warn("문장 좋아요 반영 실패", error);
  } finally {
    state.quoteFeedLikeSaving.delete(key);
    if (changed && state.quoteFeedSort === "likes") {
      state.quoteFeedItems = [];
      state.quoteFeedNextCursor = null;
      state.quoteFeedLoaded = false;
      await loadQuoteFeed();
    } else {
      renderQuoteFeed();
    }
  }
}

function changeQuoteFeedSort(sort) {
  if (state.quoteFeedLoading) return;
  const next = sort === "likes" ? "likes" : "latest";
  if (state.quoteFeedSort === next && state.quoteFeedLoaded) return;
  state.quoteFeedSort = next;
  state.quoteFeedItems = [];
  state.quoteFeedNextCursor = null;
  state.quoteFeedLoaded = false;
  loadQuoteFeed();
}

function getHistoryStateWithoutQuoteFeed() {
  const next = { ...(history.state || {}) };
  delete next.rjsQuoteFeedPage;
  return next;
}

function showQuoteFeedPage() {
  if (!state.quoteFeedOpen && !state.profileOpen) {
    state.contentPageReturnScrollY = Math.max(0, window.scrollY || 0);
  }
  if (!state.quoteFeedOpen && !history.state?.rjsQuoteFeedPage) {
    history.pushState({ ...(history.state || {}), rjsQuoteFeedPage: true }, "", location.href);
  }
  if (state.profileOpen) hideProfilePage({ clearHistoryMarker: true });
  state.quoteFeedOpen = true;
  for (const el of [els.heroSection, document.querySelector(".controls"), document.querySelector(".content-section")]) {
    if (el) el.hidden = true;
  }
  if (els.profilePage) els.profilePage.hidden = true;
  if (els.quoteFeedPage) els.quoteFeedPage.hidden = false;
  if (!state.quoteFeedLoaded) loadQuoteFeed();
  else renderQuoteFeed();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideQuoteFeedPage({ fromHistory = false, clearHistoryMarker = false } = {}) {
  state.quoteFeedOpen = false;
  if (els.quoteFeedPage) els.quoteFeedPage.hidden = true;
  for (const el of [els.heroSection, document.querySelector(".controls"), document.querySelector(".content-section")]) {
    if (el) el.hidden = false;
  }
  if (clearHistoryMarker && !fromHistory && history.state?.rjsQuoteFeedPage) {
    history.replaceState(getHistoryStateWithoutQuoteFeed(), "", location.href);
  }
}

function openQuoteFeedDetail(item) {
  if (!item || !els.quoteFeedModal) return;
  state.quoteFeedActiveItem = item;
  const theme = getQuoteFeedTheme(item);
  if (els.quoteFeedModalPreview) {
    els.quoteFeedModalPreview.style.setProperty("--quote-bg", theme.background);
    els.quoteFeedModalPreview.style.setProperty("--quote-color", theme.text);
  }
  if (els.quoteFeedModalText) {
    els.quoteFeedModalText.textContent = item.quoteText;
    els.quoteFeedModalText.scrollTop = 0;
  }
  if (els.quoteFeedModalTitle) els.quoteFeedModalTitle.textContent = item.title || "제목 미상";
  if (els.quoteFeedModalAuthor) els.quoteFeedModalAuthor.textContent = item.author || "작성자 미상";
  if (els.quoteFeedModalDate) els.quoteFeedModalDate.textContent = formatQuoteFeedDate(item.sharedAt);
  if (els.quoteFeedOpenWorkButton) {
    els.quoteFeedOpenWorkButton.hidden = !findQuoteFeedWork(item);
  }
  openModal(els.quoteFeedModal);
  if (els.quoteFeedModalText) {
    requestAnimationFrame(() => {
      const textEl = els.quoteFeedModalText;
      textEl.scrollTop = 0;
      textEl.classList.remove("is-long", "is-measuring");
      textEl.style.removeProperty("--quote-detail-font-size");

      // 기본 글자 크기는 유지하고, 조금 넘치는 문장만 단계적으로 축소한다.
      // 최소 크기까지 줄여도 들어가지 않는 매우 긴 문장에만 내부 스크롤을 허용한다.
      textEl.classList.add("is-measuring");
      const defaultSize = Number.parseFloat(getComputedStyle(textEl).fontSize) || 16;
      const minimumSize = Math.max(12, defaultSize * 0.78);
      let fittedSize = defaultSize;
      textEl.style.setProperty("--quote-detail-font-size", `${fittedSize}px`);

      while (textEl.scrollHeight > textEl.clientHeight + 2 && fittedSize - 1 >= minimumSize) {
        fittedSize -= 1;
        textEl.style.setProperty("--quote-detail-font-size", `${fittedSize}px`);
      }

      const stillOverflows = textEl.scrollHeight > textEl.clientHeight + 2;
      textEl.classList.remove("is-measuring");
      if (stillOverflows) {
        textEl.classList.add("is-long");
      }
      textEl.scrollTop = 0;
    });
  }
}

async function setSavedQuoteShared(quote, shared, workId = "") {
  if (!quote?.id || !state.user) return null;
  const data = await userApi("/api/user/profile", {
    method: "POST",
    body: JSON.stringify({
      action: "quote_share",
      id: quote.id,
      shared: Boolean(shared),
      workId: workId || "",
    }),
  });
  quote.shared = data.shared === true;
  quote.sharedAt = data.sharedAt == null ? null : Number(data.sharedAt);
  state.quoteFeedLoaded = false;
  state.quoteFeedNextCursor = null;
  if (state.profileOpen) renderProfilePage();
  return quote;
}

const savedQuoteShareTimers = new Map();

function queueSavedQuoteShare(quote, workId = "") {
  if (!quote?.id || !state.user) return;
  const quoteId = Number(quote.id);
  const currentTimer = savedQuoteShareTimers.get(quoteId);
  if (currentTimer) window.clearTimeout(currentTimer);

  const timer = window.setTimeout(async () => {
    savedQuoteShareTimers.delete(quoteId);
    if (quote._shareSaving) return;

    const persisted = quote._persistedShared === true;
    const desired = quote.shared === true;
    if (desired === persisted) {
      if (state.profileOpen) renderProfilePage();
      return;
    }

    quote._shareSaving = true;
    if (state.profileOpen) renderProfilePage();
    try {
      await setSavedQuoteShared(quote, desired, workId);
      quote._persistedShared = quote.shared === true;
    } catch (error) {
      console.warn("문장 공개 상태 변경 실패", error);
      quote.shared = persisted;
      window.alert("문장 공개 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      // 응답 직후의 연속 재클릭도 잠깐 막아 깜빡임과 반복 요청을 줄인다.
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      quote._shareSaving = false;
      if (state.profileOpen) renderProfilePage();
    }
  }, 500);

  savedQuoteShareTimers.set(quoteId, timer);
}

function getHistoryStateWithoutProfile() {
  const next = { ...(history.state || {}) };
  delete next.rjsProfilePage;
  return next;
}

function showProfilePage(tab = "bookmarks") {
  if (!state.user) {
    openAuthModal("login", "내 정보를 보려면 로그인해 주세요.");
    return;
  }
  if (!state.profileOpen && !state.quoteFeedOpen) {
    state.contentPageReturnScrollY = Math.max(0, window.scrollY || 0);
  }
  if (state.quoteFeedOpen) {
    hideQuoteFeedPage({ clearHistoryMarker: true });
  }
  if (!state.profileOpen && !history.state?.rjsProfilePage) {
    history.pushState({ ...(history.state || {}), rjsProfilePage: true }, "", location.href);
  }
  state.profileOpen = true;
  state.profileTab = ["bookmarks","recent","likes","library"].includes(tab) ? tab : "bookmarks";
  state.profileSearch = "";
  state.profileVisibleLimit = 15;
  setMobileFiltersOpen(false);
  if (els.profileSearchInput) els.profileSearchInput.value = "";
  for (const el of [els.heroSection, document.querySelector(".controls"), document.querySelector(".content-section")]) {
    if (el) el.hidden = true;
  }
  els.profilePage.hidden = false;
  renderProfilePage();
  if (state.profileTab === "library" && !state.myLibraryLoaded) {
    loadMyLibrary();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideProfilePage({ fromHistory = false, clearHistoryMarker = false } = {}) {
  state.profileOpen = false;
  if (els.profilePage) els.profilePage.hidden = true;
  for (const el of [els.heroSection, document.querySelector(".controls"), document.querySelector(".content-section")]) {
    if (el) el.hidden = false;
  }
  if (clearHistoryMarker && !fromHistory && history.state?.rjsProfilePage) {
    history.replaceState(getHistoryStateWithoutProfile(), "", location.href);
  }
}

function restoreContentPageScroll() {
  const top = Math.max(0, Number(state.contentPageReturnScrollY || 0));
  window.requestAnimationFrame(() => {
    window.scrollTo({ top, behavior: "auto" });
  });
}

function getReaderShareSourceItem() {
  return state.readerShareSourceItem || state.activeReaderItem || {};
}

async function saveCurrentReaderQuote({ quoteText: rawQuoteText = null, sourceItem = null } = {}) {
  if (!state.user) {
    openAuthModal("login", "문장을 저장하려면 로그인해 주세요.");
    return false;
  }
  const quoteText = getReaderShareEditedText(
    rawQuoteText == null ? state.readerShareText : rawQuoteText
  ).trim();
  if (!quoteText) return false;
  const item = sourceItem || getReaderShareSourceItem();
  const location = item?.source === "postype" ? null : state.readerShareLocation;
  const data = await userApi("/api/user/profile", {
    method: "POST",
    body: JSON.stringify({
      action: "quote_save",
      title: item.title || "",
      author: item.author || "",
      quoteText,
      workId: location?.workId || "",
      startOffset: Number.isFinite(location?.startOffset) ? location.startOffset : null,
      endOffset: Number.isFinite(location?.endOffset) ? location.endOffset : null,
      sourceText: location?.sourceText || "",
    }),
  });
  const savedQuote = data.quote ? normalizeSavedQuote(data.quote) : null;
  if (savedQuote) {
    savedQuote._alreadySaved = data.created === false;
    if (data.created !== false) {
      if (state.savedQuotesLoaded) {
        state.savedQuotes.unshift(savedQuote);
        state.savedQuoteCount = state.savedQuotes.length;
      } else {
        state.savedQuoteCount = Math.max(0, Number(state.savedQuoteCount || 0)) + 1;
      }
    } else if (state.savedQuotesLoaded) {
      const existingIndex = state.savedQuotes.findIndex((quote) => Number(quote.id) === Number(savedQuote.id));
      if (existingIndex >= 0) state.savedQuotes[existingIndex] = savedQuote;
    }
  }
  if (state.profileOpen) renderProfilePage();
  return savedQuote;
}

async function restoreAuth() {
  if (state.authRestoreInFlight) return;

  const token = getAuthToken();
  const probeServerSession = !token && shouldProbeServerSession();
  if (!token && !probeServerSession) {
    state.authRestoreRetryNeeded = false;
    applyUserPreferences();
    updateAccountUi();
    return;
  }

  if (probeServerSession) {
    document.documentElement.classList.add("auth-session-pending");
  }

  state.authRestoreInFlight = true;
  try {
    // 로그인 첫 화면에 필요한 개인화 데이터를 한 번의 요청으로 복원한다.
    // Safari에서는 JS 저장소에 토큰이 보이지 않아도 서버가 발급한 HttpOnly
    // 세션 쿠키를 브라우저가 요청에 자동 첨부할 수 있으므로 bootstrap을 시도한다.
    const data = await userApi("/api/user/bootstrap", {
      method: "POST",
      body: "{}",
    });
    state.authRestoreRetryNeeded = false;
    state.authRestoreRetryCount = 0;
    if (state.authRestoreRetryTimer) {
      window.clearTimeout(state.authRestoreRetryTimer);
      state.authRestoreRetryTimer = 0;
    }
    state.user = data.user;
    applyUserPreferences();
    updateAccountUi();
    applyUserLibraryRows(data.items || []);
    applyUserProfileData(data);
    if (data.visitRecorded !== false) {
      state.visitRecordedUserId = state.user?.userId || "";
    }
    flushAnalyticsSession();
  } catch (error) {
    if (Number(error?.status || 0) === 401) {
      // 실제 인증 거절일 때만 장기 자동로그인 토큰/쿠키를 폐기한다.
      clearUserSession(Boolean(token));
      return;
    }

    // 네트워크 단절·5xx 같은 일시 오류는 정상 세션을 로그아웃시키지 않는다.
    // 공개 화면은 계속 사용할 수 있게 pending UI만 해제하고, 토큰은 다음 복원에 재사용한다.
    state.authRestoreRetryNeeded = true;
    applyUserPreferences();
    updateAccountUi();

    if (navigator.onLine && state.authRestoreRetryCount < 1 && !state.authRestoreRetryTimer) {
      state.authRestoreRetryCount += 1;
      state.authRestoreRetryTimer = window.setTimeout(() => {
        state.authRestoreRetryTimer = 0;
        if (state.authRestoreRetryNeeded) restoreAuth();
      }, 1500);
    }
  } finally {
    state.authRestoreInFlight = false;
  }
}

function getUserLibraryEntry(fileId) {
  return state.userLibrary.get(fileId) || null;
}

function updateUserLibraryEntry(fileId, patch) {
  const current = getUserLibraryEntry(fileId) || {
    fileId,
    progressPercent: 0,
    scrollTop: null,
    chunkIndex: null,
    chunkRatio: null,
    bookmarked: false,
    viewedAt: null,
    readAt: null,
    legacyReadNeedsClear: false,
    downloadedAt: null,
    updatedAt: null,
  };

  state.userLibrary.set(fileId, {
    ...current,
    ...patch,
    fileId,
  });
}

function updateReaderBookmarkButton() {
  if (!els.readerBookmarkButton) return;

  const item = state.activeReaderItem;
  const bookmarked = Boolean(
    state.user &&
    item &&
    getUserLibraryEntry(item.id)?.bookmarked
  );

  els.readerBookmarkButton.classList.toggle("active", bookmarked);
  els.readerBookmarkButton.setAttribute("aria-pressed", bookmarked ? "true" : "false");
  els.readerBookmarkButton.title = bookmarked ? "북마크 해제" : "북마크";

  const label = els.readerBookmarkButton.querySelector(".reader-bookmark-label");
  if (label) label.textContent = bookmarked ? "북마크됨" : "북마크";
}

function recordRecentView(item) {
  if (!state.user || !item) return;

  const viewedAt = Date.now();
  updateUserLibraryEntry(item.id, { viewedAt });

  // TXT는 /api/content 성공 뒤 서버 최근조회가 함께 저장된다.
  // POSTYPE는 외부 링크만 열기 때문에 여기서 별도 view 저장이 필요하다.
  if (item.source === "postype") {
    void userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify({ action: "view", fileId: item.id }),
    }).then((data) => {
      updateUserLibraryEntry(item.id, { viewedAt: Number(data?.viewedAt || viewedAt) });
    }).catch((error) => {
      console.warn("POSTYPE 최근조회 저장 실패", error);
    });
  }
}


function normalizeReaderProgressPercent(value) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  return Math.round(clamped * READER_PROGRESS_PRECISION) /
    READER_PROGRESS_PRECISION;
}

function getReaderProgressDisplayPercent(value) {
  const raw = Number(value || 0);
  if (raw <= 0) return 0;
  return Math.max(1, Math.min(99, Math.floor(raw)));
}

function isReaderAtActualEnd(item) {
  if (!item || !els.readerPanel) return false;

  if (
    state.readerDisplayMode === "page" &&
    state.readerText
  ) {
    return Boolean(
      state.readerPageHasNavigated &&
      state.readerPageEnd >= getReaderTextLength()
    );
  }

  const panel = els.readerPanel;
  const maxScroll = Math.max(
    0,
    panel.scrollHeight - panel.clientHeight
  );
  const scrollTop = Math.max(0, panel.scrollTop);

  // Do not mark a work as read merely by opening a one-screen document.
  if (scrollTop < READER_MIN_MEANINGFUL_SCROLL_PX) return false;

  const distanceToBottom = Math.max(0, maxScroll - scrollTop);
  if (distanceToBottom > READER_END_DISTANCE_PX) return false;

  // A long TXT is only complete when the real final virtual chunk is
  // already rendered. Reaching the bottom of an intermediate chunk is
  // not considered "read".
  if (isLargeReaderFile(item) && state.largeReaderChunks) {
    if (
      state.largeReaderRenderedCount <
      state.largeReaderChunks.length
    ) {
      return false;
    }
  }

  return true;
}

function buildProgressPayload(item, saved) {
  const entry = getUserLibraryEntry(item.id);

  return {
    action: "progress",
    fileId: item.id,
    percent: Number(saved.percent || 0),
    mode: saved.mode === "chunk" ? "chunk" : "scroll",
    scrollTop: saved.scrollTop ?? null,
    chunkIndex: saved.chunkIndex ?? null,
    chunkRatio: saved.chunkRatio ?? null,
    read: Boolean(saved.read),
    clearLegacyRead: Boolean(
      entry?.legacyReadNeedsClear &&
      !saved.read
    ),
  };
}

function shouldSyncProgressNow(fileId, saved) {
  const previous = state.remoteProgressState.get(fileId);
  const nextPercent = Number(saved?.percent || 0);

  if (nextPercent <= 0) return false;
  if (!previous) return true;

  const previousPercent = Number(previous.progressPercent || 0);
  if (previousPercent <= 0 && nextPercent > 0) return true;

  if (saved?.read && !previous.readAt) {
    return true;
  }

  if (getUserLibraryEntry(fileId)?.legacyReadNeedsClear) {
    return true;
  }

  const lastSyncedAt = Number(
    state.remoteProgressSyncedAt.get(fileId) || 0
  );

  return Date.now() - lastSyncedAt >= READER_REMOTE_SYNC_INTERVAL_MS;
}

function shouldPersistProgress(fileId, saved) {
  const previous = state.remoteProgressState.get(fileId);
  if (!previous) return Number(saved?.percent || 0) > 0;

  const nextPercent = Number(saved?.percent || 0);
  const previousPercent = Number(previous.progressPercent || 0);

  if (saved?.read && !previous.readAt) return true;

  if (getUserLibraryEntry(fileId)?.legacyReadNeedsClear) {
    return true;
  }

  if (Math.abs(nextPercent - previousPercent) >= 0.1) return true;

  if (saved?.mode === "chunk") {
    if (Number(saved.chunkIndex ?? -1) !== Number(previous.chunkIndex ?? -1)) {
      return true;
    }

    if (
      Math.abs(
        Number(saved.chunkRatio ?? 0) -
        Number(previous.chunkRatio ?? 0)
      ) >= 0.005
    ) {
      return true;
    }
  }

  if (saved?.mode === "scroll") {
    const nextScroll = Number(saved.scrollTop || 0);
    const previousScroll = Number(previous.scrollTop || 0);

    if (
      Math.abs(nextScroll - previousScroll) >=
      READER_MIN_MEANINGFUL_SCROLL_PX
    ) return true;
  }

  return false;
}

function getProgressPayloadSignature(payload) {
  if (!payload) return "";

  return [
    payload.fileId || "",
    payload.percent ?? "",
    payload.mode || "",
    payload.scrollTop ?? "",
    payload.chunkIndex ?? "",
    payload.chunkRatio ?? "",
    payload.read ? 1 : 0,
    payload.clearLegacyRead ? 1 : 0,
  ].join("|");
}

async function persistProgress(item, saved) {
  if (!state.user || !item || !saved) return false;
  if (!shouldPersistProgress(item.id, saved)) return false;

  const payload = buildProgressPayload(item, saved);
  const signature = getProgressPayloadSignature(payload);

  // Always keep the newest point locally before attempting the network write.
  // If the request fails or the browser/app is killed, the same device can
  // recover this position on the next open.
  writeLocalReaderProgress(item, saved, { force: true });
  const localSavedAtForRequest = Number(
    state.localProgressSavedAt.get(item.id) || 0
  );

  // A scroll timer, reader close, visibilitychange and pagehide can all fire
  // around the same moment. If the exact same position is already being sent,
  // do not create another Functions request / D1 write while the first one is
  // still in flight.
  if (state.progressSavePending.get(item.id) === signature) {
    return false;
  }

  const currentEntry = getUserLibraryEntry(item.id);
  const nextReadAt = payload.read
    ? (currentEntry?.readAt || Date.now())
    : (currentEntry?.readAt || null);

  updateUserLibraryEntry(item.id, {
    progressPercent: payload.percent,
    scrollTop: payload.scrollTop,
    chunkIndex: payload.chunkIndex,
    chunkRatio: payload.chunkRatio,
    readAt: nextReadAt,
    updatedAt: Date.now(),
  });

  state.progressSavePending.set(item.id, signature);

  try {
    await userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.remoteProgressSyncedAt.set(item.id, Date.now());
    const savedEntry = getUserLibraryEntry(item.id);
    updateUserLibraryEntry(item.id, {
      legacyReadNeedsClear: false,
    });

    state.remoteProgressState.set(item.id, {
      progressPercent: payload.percent,
      scrollTop: payload.scrollTop,
      chunkIndex: payload.chunkIndex,
      chunkRatio: payload.chunkRatio,
      readAt: savedEntry?.readAt || null,
    });
    clearLocalReaderProgressIfNotNewer(
      item.id,
      localSavedAtForRequest
    );
    updateResumeShortcut();

    // While the full-screen reader is open, the archive list is hidden behind
    // it. Re-rendering up to 40 cards/list rows after every periodic progress
    // sync wastes mobile CPU/battery and can compete with long-text rendering.
    // Keep state current, but defer the visible archive refresh until the
    // reader closes. Calls made outside the reader keep the existing behavior.
    if (state.items.length && els.readerOverlay?.hidden) render();
    return true;
  } catch (error) {
    console.warn("이어보기 저장 실패", error);
    return false;
  } finally {
    if (state.progressSavePending.get(item.id) === signature) {
      state.progressSavePending.delete(item.id);
    }
  }
}

function formatLibraryDate(timestamp) {
  if (!timestamp) return "";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function getLibraryVisibleEntries(kind = state.libraryKind, query = state.librarySearch) {
  const normalizedQuery = normalizeSearchText(query);

  return [...state.userLibrary.values()]
    .filter((entry) =>
      kind === "bookmarks" ? entry.bookmarked : Boolean(entry.viewedAt)
    )
    .sort((a, b) =>
      kind === "bookmarks"
        ? (b.updatedAt || 0) - (a.updatedAt || 0)
        : (b.viewedAt || 0) - (a.viewedAt || 0)
    )
    .map((entry) => {
      const item = state.items.find((candidate) => candidate.id === entry.fileId);
      return { entry, item };
    })
    .filter(({ item }) => {
      if (!item) return false;
      if (!normalizedQuery) return true;

      const haystack = normalizeSearchText(
        `${item.title || ""} ${item.author || ""} ${item.fileName || ""}`
      );
      return haystack.includes(normalizedQuery);
    });
}

function resetUserLibraryScroll() {
  const shell = document.querySelector(".library-modal-list-shell");
  if (shell) shell.scrollTop = 0;
}

function renderUserLibraryModal() {
  const kind = state.libraryKind;
  const allVisible = getLibraryVisibleEntries();
  const totalCount = allVisible.length;
  const shownCount = Math.min(totalCount, LIBRARY_PAGE_SIZE);
  const visible = allVisible.slice(0, shownCount);
  const remainingCount = Math.max(0, totalCount - shownCount);

  if (els.libraryClearButton) {
    els.libraryClearButton.textContent =
      kind === "bookmarks" ? "북마크 전체 해제" : "최근 조회 전체 삭제";
    els.libraryClearButton.disabled = !totalCount && !state.librarySearch;
  }

  if (els.libraryModalMeta) {
    if (!totalCount) {
      els.libraryModalMeta.textContent = state.librarySearch
        ? "검색 결과가 없습니다."
        : kind === "bookmarks"
          ? "저장된 북마크가 없습니다."
          : "최근 조회 기록이 없습니다.";
    } else {
      els.libraryModalMeta.textContent = totalCount > shownCount ? `최근 ${shownCount}개 · 전체 ${totalCount}개` : `총 ${totalCount}개`;
    }
  }

  if (els.libraryMoreWrap) {
    els.libraryMoreWrap.hidden = true;
  }

  if (els.libraryMoreLabel) {
    els.libraryMoreLabel.textContent = `더보기 ${Math.min(LIBRARY_PAGE_SIZE, remainingCount)}개`;
  }

  if (els.libraryMoreProgress) {
    els.libraryMoreProgress.textContent = `${shownCount} / ${totalCount}`;
  }

  if (!visible.length) {
    els.libraryModalList.innerHTML =
      `<div class="library-empty">${
        state.librarySearch
          ? "검색 결과가 없습니다."
          : kind === "bookmarks"
            ? "아직 북마크한 작품이 없습니다."
            : "아직 조회한 작품이 없습니다."
      }</div>`;
    return;
  }

  els.libraryModalList.innerHTML = visible.map(({ entry, item }) => `
    <div class="library-entry" data-library-file-id="${escapeHtml(item.id)}">
      <button class="library-entry-open" type="button" data-library-open="${escapeHtml(item.id)}">
        <span class="library-entry-main">
          <span class="library-entry-title">${escapeHtml(item.title || "제목 미상")}</span>
          <span class="library-entry-meta">${escapeHtml(item.author || "작성자 미상")} · ${escapeHtml(item.combination || "")} ${escapeHtml(item.lengthType || "")}</span>
        </span>
        <span class="library-entry-progress ${
          entry.readAt ? "is-read" : ""
        }">${
          entry.readAt
            ? "✓ 읽음"
            : entry.progressPercent > 0
              ? `${Math.round(entry.progressPercent)}%`
              : formatLibraryDate(entry.viewedAt)
        }</span>
      </button>

      <button
        class="library-entry-remove"
        type="button"
        data-library-remove="${escapeHtml(item.id)}"
        aria-label="${kind === "bookmarks" ? "북마크 해제" : "최근 조회에서 삭제"}"
        title="${kind === "bookmarks" ? "북마크 해제" : "최근 조회에서 삭제"}"
      >×</button>
    </div>
  `).join("");
}

function showUserLibrary(kind) {
  if (!state.user) {
    openAuthModal(
      "login",
      kind === "bookmarks"
        ? "북마크를 저장하고 다른 기기에서도 불러오려면 로그인해 주세요."
        : "최근 조회 작품을 저장하고 다른 기기에서도 불러오려면 로그인해 주세요."
    );
    return;
  }

  state.libraryKind = kind === "recent" ? "recent" : "bookmarks";
  state.librarySearch = "";
  state.libraryVisibleLimit = LIBRARY_PAGE_SIZE;

  els.libraryModalTitle.textContent =
    state.libraryKind === "bookmarks" ? "북마크" : "최근 조회";
  els.libraryModalDescription.textContent =
    state.libraryKind === "bookmarks"
      ? "최근 북마크 10개를 빠르게 보여줍니다. 전체 목록은 내 정보에서 확인할 수 있어요."
      : "최근 조회 작품 10개를 빠르게 보여줍니다. 전체 목록은 내 정보에서 확인할 수 있어요.";

  if (els.librarySearchInput) {
    els.librarySearchInput.value = "";
  }

  renderUserLibraryModal();
  openModal(els.libraryModal);
  resetUserLibraryScroll();
}


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showStatus(message, isError = false) {
  els.status.hidden = false;
  els.status.classList.toggle("error", isError);
  els.status.innerHTML = isError
    ? `<div class="inline-error-state"><p>${escapeHtml(message)}</p><button class="inline-retry-button" type="button" data-archive-retry>다시 시도</button></div>`
    : `<div class="spinner" aria-hidden="true"></div><p>${escapeHtml(message)}</p>`;
  els.contentGrid.hidden = true;
  els.contentListWrap.hidden = true;
  els.emptyState.hidden = true;
}

function hideStatus() {
  els.status.hidden = true;
}

function getVersionedFaviconUrl(rawUrl, updatedAt = "") {
  const value = String(rawUrl || "").trim();

  // Treat previous bundled defaults as "use the current bundled favicon".
  if (
    !value ||
    value === "/favicon.svg" ||
    value === "/favicon.ico" ||
    value === "/favicon-32.png" ||
    value.startsWith("data:image/svg+xml")
  ) {
    return "";
  }

  if (value.startsWith("data:image/")) return value;

  const version = updatedAt
    ? encodeURIComponent(String(updatedAt))
    : "";

  if (!version) return value;

  return `${value}${value.includes("?") ? "&" : "?"}v=${version}`;
}

function applySettings(settings = {}) {
  const faviconUrl = getVersionedFaviconUrl(
    settings.faviconUrl,
    settings.updatedAt
  );


  if (faviconUrl) {
    for (const link of [
      els.siteFavicon,
      els.siteShortcutIcon,
      els.siteAppleTouchIcon,
    ]) {
      if (link) link.setAttribute("href", faviconUrl);
    }
  } else {
    els.siteFavicon?.setAttribute("href", "/favicon-32.png?v=632");
    els.siteShortcutIcon?.setAttribute("href", "/favicon.ico?v=632");
    els.siteAppleTouchIcon?.setAttribute("href", "/apple-touch-icon.png?v=632");
  }

  if (els.heroEyebrow) {
    els.heroEyebrow.textContent = String(settings.eyebrow ?? "");
  }
  if (els.heroTitle) {
    els.heroTitle.textContent = String(settings.title ?? "");
  }

  els.heroSection?.classList.remove("hero-settings-pending");
  els.heroSection?.classList.add("hero-settings-ready");
}

async function loadArchive(force = false) {
  const analyticsLoadStartedAt = performance.now();
  showStatus("저장된 콘텐츠 목록을 불러오고 있어요.");
  els.resultCount.textContent = "불러오는 중…";

  try {
    const url = force ? `/api/archive?t=${Date.now()}` : "/api/archive";
    await offlineBodyReady;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) throw new Error(data?.error || "콘텐츠를 불러오지 못했습니다.");

    state.items = Array.isArray(data.items) ? data.items : [];
    applySettings(data.settings || {});
    buildCombinationFilters(data.combinations || []);
    if (state.sort === "bookmarks") {
      try {
        await loadBookmarkCounts();
      } catch (error) {
        console.warn("북마크 순위 로드 실패", error);
      }
    }
    hideStatus();
    updateResumeShortcut();
    render();
    showIncomingSharedWork();
    recordAnalyticsArchiveLoad(performance.now() - analyticsLoadStartedAt);
  } catch (error) {
    console.error(error);
    els.heroSection?.classList.remove("hero-settings-pending");
    els.heroSection?.classList.add("hero-settings-ready");
    els.resultCount.textContent = "연결 오류";
    showStatus(error?.message || "콘텐츠 목록을 불러오지 못했습니다.", true);
  }
}

function buildCombinationFilters(combinations) {
  const values = ["전체", ...new Set(combinations.filter(Boolean))];
  els.combinationFilters.innerHTML = values
    .map(
      (value) => `
        <button class="chip ${state.combination === value ? "active" : ""}"
          type="button" data-combination="${escapeHtml(value)}"
          aria-pressed="${state.combination === value ? "true" : "false"}">${escapeHtml(value)}</button>`
    )
    .join("");

  if (els.tabletCombinationSelect) {
    els.tabletCombinationSelect.innerHTML = values
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
      )
      .join("");
    els.tabletCombinationSelect.value = state.combination;
  }
}

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s_\-\[\]\(\)\{\}.,'"/\\|:;!?·~`]+/g, "");
}

function getSearchTokens(query = "") {
  const rawTokens = String(query)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .trim()
    .split(/\s+/)
    .map(normalizeSearchText)
    .filter(Boolean);

  const compact = normalizeSearchText(query);
  return [...new Set([compact, ...rawTokens].filter(Boolean))];
}

const ARCHIVE_COLLATOR = new Intl.Collator("ko", {
  sensitivity: "base",
  numeric: true,
});
const archiveSearchHaystackCache = new WeakMap();

function getArchiveItemSearchHaystack(item) {
  if (!item || typeof item !== "object") return "";
  if (archiveSearchHaystackCache.has(item)) {
    return archiveSearchHaystackCache.get(item);
  }

  const haystack = normalizeSearchText(
    `${item.title || ""} ${item.author || ""} ${item.fileName || ""} ` +
    `${item.combination || ""} ${item.subCp1 || ""} ${item.subCp2 || ""} ` +
    `${item.genre || ""} ${item.status || ""} ${item.searchAliases || ""}`
  );
  archiveSearchHaystackCache.set(item, haystack);
  return haystack;
}

function normalizeSortValue(value) {
  if (value === "latest") return "registered";
  return ["title", "author", "registered", "published", "bookmarks", "size"].includes(value)
    ? value
    : "title";
}

function syncFilterChipGroup(container, dataKey, activeValue) {
  container?.querySelectorAll(".chip").forEach((chip) => {
    const active = chip.dataset[dataKey] === activeValue;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function syncSourceFilterChips() {
  syncFilterChipGroup(els.sourceFilters, "source", state.source);
}

function applySourceForSort() {
  // Sorting and filtering are independent controls.
  // A saved sort value must never restore/change the source filter
  // after the user has reset filters or refreshed the page.
  syncSourceFilterChips();
}

function getBookmarkCount(itemOrId) {
  const fileId = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  if (!fileId) return 0;
  return Math.max(0, Number(state.bookmarkCounts.get(String(fileId)) || 0));
}

function applyBookmarkCountResponse(fileId, data) {
  if (!state.bookmarkCountsLoaded || !fileId || data?.bookmarkCount == null) return;
  const count = Math.max(0, Number(data.bookmarkCount || 0));
  if (count > 0) state.bookmarkCounts.set(String(fileId), count);
  else state.bookmarkCounts.delete(String(fileId));
  state.bookmarkCountsLoadedAt = Date.now();
  if (state.sort === "bookmarks") render();
}

async function loadBookmarkCounts(force = false) {
  const fresh =
    state.bookmarkCountsLoadedAt > 0 &&
    Date.now() - state.bookmarkCountsLoadedAt < BOOKMARK_COUNTS_CACHE_MS;
  if (!force && fresh) return state.bookmarkCounts;
  if (state.bookmarkCountsLoadingPromise) return state.bookmarkCountsLoadingPromise;

  state.bookmarkCountsLoadingPromise = (async () => {
    const response = await fetch("/api/bookmark-counts", {
      cache: force ? "no-store" : "default",
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      throw new Error(data?.error || "북마크 순위를 불러오지 못했습니다.");
    }

    const next = new Map();
    for (const row of Array.isArray(data?.counts) ? data.counts : []) {
      const fileId = String(row?.fileId || "").trim();
      const count = Math.max(0, Number(row?.count || 0));
      if (fileId && count > 0) next.set(fileId, count);
    }
    state.bookmarkCounts = next;
    state.bookmarkCountsLoaded = true;
    state.bookmarkCountsLoadedAt = Date.now();
    return state.bookmarkCounts;
  })().finally(() => {
    state.bookmarkCountsLoadingPromise = null;
  });

  return state.bookmarkCountsLoadingPromise;
}

function getRegisteredTimestamp(item) {
  return Date.parse(
    item?.createdTime ||
    item?.modifiedTime ||
    item?.updatedAt ||
    item?.createdAt ||
    ""
  ) || 0;
}

function getPublishedTimestamp(item) {
  const value =
    item?.latestPublishedDate ||
    item?.publishedDate ||
    item?.publishedAt ||
    item?.updatedAt ||
    item?.createdAt ||
    "";

  const text = String(value || "").trim();
  const dateOnlyMatch = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return Date.parse(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`
    ) || 0;
  }

  return Date.parse(text) || 0;
}

const RECENT_POSTYPE_BOOST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function disableInitialRecentPostypeBoost() {
  state.initialRecentPostypeBoost = false;
}

function hasNeutralArchiveFilters() {
  return (
    !String(state.search || "").trim() &&
    state.combination === "전체" &&
    state.contentType === "전체" &&
    state.statusFilter === "전체" &&
    state.source === "전체" &&
    !state.bookmarkOnly &&
    !state.readingOnly
  );
}

function isRecentPostypeItem(item, now = Date.now()) {
  if (item?.source !== "postype") return false;
  const publishedAt = getPublishedTimestamp(item);
  if (!publishedAt) return false;
  const age = now - publishedAt;
  return age >= 0 && age <= RECENT_POSTYPE_BOOST_WINDOW_MS;
}

function shouldUseInitialRecentPostypeBoost() {
  return (
    state.initialRecentPostypeBoost &&
    state.sort === "title" &&
    hasNeutralArchiveFilters()
  );
}

function isInitialRecentPostypeHighlighted(item) {
  return shouldUseInitialRecentPostypeBoost() && isRecentPostypeItem(item);
}

function getRecentPostypeNewBadgeHtml(item) {
  if (!isInitialRecentPostypeHighlighted(item)) return "";
  return `<span class="recent-postype-new-badge" aria-label="최근 7일 내 발행된 POSTYPE" title="최근 7일 내 발행">NEW</span>`;
}

function getRecentPostypeBoltHtml(item) {
  if (!isInitialRecentPostypeHighlighted(item)) return "";
  return `<span class="recent-postype-bolt" aria-label="최근 7일 내 발행된 POSTYPE" title="최근 7일 내 발행">
    <svg viewBox="0 0 12 14" aria-hidden="true"><path d="M7.1 0.9 2.3 7h3.1L4.8 13.1 9.7 6.4H6.6L7.1 0.9Z"></path></svg>
  </span>`;
}

function getItemLinkType(item) {
  if (!item || item.source !== "postype") return "";
  const explicit = String(item.linkType || "").trim();
  if (["post", "series", "manual"].includes(explicit)) return explicit;
  return /\/series\/\d+(?:[/?#]|$)/i.test(String(item.url || "")) ? "series" : "post";
}

function getItemContentType(item) {
  if (!item) return "";

  if (item.source !== "postype") {
    const explicit = String(item.contentType || "").trim();
    if (["단편", "연재물"].includes(explicit)) return explicit;

    const size = Number(item.size || 0);
    return size > 200 * 1024 ? "연재물" : "단편";
  }

  const publishType = String(item.publishType || "").trim();
  if (publishType === "다회차") return "연재물";
  if (publishType === "단일글") return "단편";
  return ["series", "manual"].includes(getItemLinkType(item)) ? "연재물" : "단편";
}

function getContentTypeDisplayLabel(value) {
  return value === "연재물" ? "연재" : value;
}

function getItemStatusLabel(item) {
  if (!item) return "";
  const value = String(item.status || "").trim();

  if (value === "연재") return "연재중";
  if (value === "완결") return "완결";

  return item.source === "postype" ? "" : "완결";
}

function formatArchiveDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!match) return text;
  return `${match[1]}.${String(match[2]).padStart(2, "0")}.${String(match[3]).padStart(2, "0")}`;
}

function formatCompactArchiveDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!match) return text;
  return `${String(match[1]).slice(2)}${String(match[2]).padStart(2, "0")}${String(match[3]).padStart(2, "0")}`;
}

function sortItems(items) {
  const collator = ARCHIVE_COLLATOR;

  const boostRecentPostype = shouldUseInitialRecentPostypeBoost();
  const now = Date.now();

  return [...items].sort((a, b) => {
    if (state.sort === "title") {
      if (boostRecentPostype) {
        const aRecent = isRecentPostypeItem(a, now);
        const bRecent = isRecentPostypeItem(b, now);
        if (aRecent !== bRecent) return aRecent ? -1 : 1;
        if (aRecent && bRecent) {
          const publishedCompare = getPublishedTimestamp(b) - getPublishedTimestamp(a);
          if (publishedCompare !== 0) return publishedCompare;
        }
      }

      const titleCompare = collator.compare(a.title || "", b.title || "");
      if (titleCompare !== 0) return titleCompare;
      return collator.compare(a.author || "", b.author || "");
    }

    if (state.sort === "author") {
      const authorCompare = collator.compare(a.author || "", b.author || "");
      if (authorCompare !== 0) return authorCompare;
      return collator.compare(a.title || "", b.title || "");
    }

    if (state.sort === "bookmarks") {
      const countCompare = getBookmarkCount(b) - getBookmarkCount(a);
      if (countCompare !== 0) return countCompare;
      const titleCompare = collator.compare(a.title || "", b.title || "");
      if (titleCompare !== 0) return titleCompare;
      return collator.compare(a.author || "", b.author || "");
    }

    if (state.sort === "published") {
      const aTime = getPublishedTimestamp(a);
      const bTime = getPublishedTimestamp(b);
      if (bTime !== aTime) return bTime - aTime;
      return collator.compare(a.title || "", b.title || "");
    }

    if (state.sort === "size") {
      const aSize = Number.isFinite(Number(a.size)) ? Math.max(0, Number(a.size)) : 0;
      const bSize = Number.isFinite(Number(b.size)) ? Math.max(0, Number(b.size)) : 0;
      if (bSize !== aSize) return bSize - aSize;
      return collator.compare(a.title || "", b.title || "");
    }

    const aTime = getRegisteredTimestamp(a);
    const bTime = getRegisteredTimestamp(b);
    if (bTime !== aTime) return bTime - aTime;

    return collator.compare(a.title || "", b.title || "");
  });
}

function setMobileFiltersOpen(open) {
  const next = Boolean(
    open &&
    window.matchMedia("(max-width: 640px)").matches
  );

  state.mobileFiltersOpen = next;
  els.controlsGrid?.classList.toggle("mobile-open", next);
  els.filterToggleButton?.setAttribute(
    "aria-expanded",
    next ? "true" : "false"
  );
  els.compactFilterButton?.setAttribute(
    "aria-expanded",
    next ? "true" : "false"
  );

  if (els.mobileFilterBackdrop) {
    els.mobileFilterBackdrop.hidden = !next;
    els.mobileFilterBackdrop.classList.toggle("open", next);
  }

  document.body.classList.toggle("mobile-filter-sheet-open", next);
}

function resetFilterState({ includeSearch = false } = {}) {
  disableInitialRecentPostypeBoost();

  if (includeSearch) {
    state.search = "";
    els.searchInput.value = "";
    if (els.compactSearchInput) els.compactSearchInput.value = "";
    els.clearSearch.classList.remove("visible");
    els.compactClearSearch?.classList.remove("visible");
  }

  state.combination = "전체";
  state.contentType = "전체";
  state.statusFilter = "전체";
  state.source = "전체";
  state.bookmarkOnly = false;
  state.readingOnly = false;
  state.sort = "title";
  localStorage.setItem("archiveSort", state.sort);
  if (els.sortSelect) els.sortSelect.value = state.sort;
  if (els.mobileSortSelect) els.mobileSortSelect.value = state.sort;

  syncFilterChipGroup(els.combinationFilters, "combination", "전체");
  syncFilterChipGroup(els.contentTypeFilters, "contentType", "전체");
  syncFilterChipGroup(els.statusFilters, "statusFilter", "전체");
  syncFilterChipGroup(els.sourceFilters, "source", "전체");

  syncQuickFilterButtons();
  render();
}

function updateFilterSummary() {
  if (!els.filterSummary) return;

  const parts = [];
  if (state.combination !== "전체") parts.push(state.combination);
  if (state.contentType !== "전체") parts.push(getContentTypeDisplayLabel(state.contentType));
  if (state.statusFilter !== "전체") parts.push(state.statusFilter);
  if (state.source !== "전체") {
    parts.push(state.source === "postype" ? "POSTYPE" : "TXT");
  }
  if (state.bookmarkOnly) parts.push("북마크");
  if (state.readingOnly) parts.push("읽는 중");

  if (window.matchMedia("(max-width: 640px)").matches) {
    const sortLabels = {
      title: "제목순",
      author: "작가순",
      registered: "최근등록일",
      published: "최근발행일",
      bookmarks: "북마크순",
      size: "분량순",
    };
    parts.push(sortLabels[state.sort] || "제목순");
    parts.push(state.view === "card" ? "카드형" : "리스트형");
  } else if (state.view === "card") {
    parts.push("카드형");
  }

  els.filterSummary.textContent = parts.length ? parts.join(" · ") : "전체";

  const hasActiveFilters = Boolean(
    state.combination !== "전체" ||
    state.contentType !== "전체" ||
    state.statusFilter !== "전체" ||
    state.source !== "전체" ||
    state.bookmarkOnly ||
    state.readingOnly
  );

  els.compactFilterButton?.classList.toggle("active", hasActiveFilters);
  els.compactFilterButton?.setAttribute(
    "aria-label",
    hasActiveFilters ? "필터 열기, 필터 적용됨" : "필터 열기"
  );
}

function getFilteredItems() {
  const tokens = getSearchTokens(state.search);

  const filtered = state.items.filter((item) => {
    const matchesCombination =
      state.combination === "전체" || item.combination === state.combination;
    const itemContentType = getItemContentType(item);
    const matchesContentType =
      state.contentType === "전체" ||
      itemContentType === state.contentType;
    const itemStatusLabel = getItemStatusLabel(item);
    const matchesStatus =
      state.statusFilter === "전체" ||
      itemStatusLabel === state.statusFilter;
    const itemSource = item.source || "drive";
    const matchesSource =
      state.source === "전체" || itemSource === state.source;

    const matchesSearch =
      tokens.length === 0 ||
      tokens.every((token) => getArchiveItemSearchHaystack(item).includes(token));

    const libraryEntry = state.user
      ? getUserLibraryEntry(item.id)
      : null;

    const matchesBookmark =
      !state.bookmarkOnly || Boolean(libraryEntry?.bookmarked);

    const progress = Number(libraryEntry?.progressPercent || 0);
    const matchesReading =
      !state.readingOnly ||
      (
        progress > 0 &&
        !libraryEntry?.readAt
      );

    return (
      matchesCombination &&
      matchesContentType &&
      matchesStatus &&
      matchesSource &&
      matchesSearch &&
      matchesBookmark &&
      matchesReading
    );
  });

  return sortItems(filtered);
}

function syncTabletFilterBar() {
  if (els.tabletCombinationSelect) {
    els.tabletCombinationSelect.value = state.combination;
  }
  if (els.tabletContentTypeSelect) {
    els.tabletContentTypeSelect.value = state.contentType;
  }
  if (els.tabletStatusSelect) {
    els.tabletStatusSelect.value = state.statusFilter;
  }
  if (els.tabletSourceSelect) {
    els.tabletSourceSelect.value = state.source;
  }

  els.tabletFilterBar?.querySelectorAll("[data-tablet-view]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.tabletView === state.view
    );
  });
}

function getContentPaginationSignature() {
  return JSON.stringify({
    combination: state.combination,
    contentType: state.contentType,
    statusFilter: state.statusFilter,
    source: state.source,
    search: state.search,
    sort: state.sort,
    bookmarkOnly: state.bookmarkOnly,
    readingOnly: state.readingOnly,
  });
}

function syncLoadMoreUi(totalCount, shownCount) {
  if (!els.loadMoreWrap || !els.loadMoreButton) return;

  const hasMore = shownCount < totalCount;
  els.loadMoreWrap.hidden = !hasMore;

  if (!hasMore) return;

  const remaining = totalCount - shownCount;
  const nextCount = Math.min(CONTENT_PAGE_SIZE, remaining);

  if (els.loadMoreLabel) {
    els.loadMoreLabel.textContent = `더보기 ${nextCount.toLocaleString("ko-KR")}개`;
  }
  if (els.loadMoreProgress) {
    els.loadMoreProgress.textContent =
      `${shownCount.toLocaleString("ko-KR")} / ${totalCount.toLocaleString("ko-KR")}`;
  }
}

function render() {
  syncTabletFilterBar();

  const items = getFilteredItems();
  const paginationSignature = getContentPaginationSignature();

  if (state.paginationSignature !== paginationSignature) {
    state.paginationSignature = paginationSignature;
    state.visibleItemLimit = CONTENT_PAGE_SIZE;
  }

  const visibleItems = items.slice(0, state.visibleItemLimit);
  updateFilterSummary();
  els.resultCount.textContent = `총 ${items.length.toLocaleString("ko-KR")}개`;
  if (els.recentPostypeGuideNote) {
    const hasHighlightedRecentPostype = shouldUseInitialRecentPostypeBoost() && items.some((item) => isRecentPostypeItem(item));
    els.recentPostypeGuideNote.hidden = !hasHighlightedRecentPostype;
  }

  if (!items.length) {
    els.contentGrid.hidden = true;
    els.contentListWrap.hidden = true;
    els.loadMoreWrap.hidden = true;
    els.emptyState.hidden = false;
    syncViewButtons();
    if (state.profileOpen) renderProfilePage();
    return;
  }

  els.emptyState.hidden = true;

  if (state.view === "list") {
    renderList(visibleItems);
    adjustMobileListTitleSizes();
    els.contentGrid.hidden = true;
    els.contentListWrap.hidden = false;
  } else {
    renderCards(visibleItems);
    els.contentGrid.hidden = false;
    els.contentListWrap.hidden = true;
  }

  syncLoadMoreUi(items.length, visibleItems.length);
  syncViewButtons();
  if (state.profileOpen) renderProfilePage();
}


function getItemReadingBadge(item) {
  if (!state.user || !item || item.source === "postype") return "";

  const entry = getUserLibraryEntry(item.id);
  if (!entry) return "";

  if (entry.readAt) {
    return `<span class="reading-state-badge read">✓ 읽음</span>`;
  }

  const rawPercent = Number(entry.progressPercent || 0);
  if (rawPercent > 0) {
    const percent = getReaderProgressDisplayPercent(rawPercent);
    return `<span class="reading-state-badge progress" style="--p:${percent}">${percent}%</span>`;
  }

  return "";
}


function getDownloadUrl(item) {
  if (!item?.id || item.source === "postype") return "";

  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.id)}`;
}

function getDownloadButtonHtml(item, className = "item-download-button") {
  const url = getDownloadUrl(item);
  if (!url) return "";

  const downloaded = Boolean(
    state.user && getUserLibraryEntry(item.id)?.downloadedAt
  );

  return `
    <a class="${className} ${downloaded ? "downloaded" : ""}"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
      data-download-id="${escapeHtml(item.id)}"
      aria-label="${escapeHtml(item.title || "TXT")} ${
        downloaded ? "다운로드함 · 다시 다운로드" : "다운로드"
      }"
      title="${downloaded ? "다운로드함 · 다시 다운로드" : "TXT 다운로드"}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5v11"></path>
        <path d="m7.75 10.5 4.25 4.25 4.25-4.25"></path>
        <path d="M5 19.5h14"></path>
      </svg>
      ${downloaded ? '<span class="downloaded-check" aria-hidden="true">✓</span>' : ""}
    </a>
  `;
}

function getSourceLabel(item) {
  return item?.source === "postype" ? "POSTYPE" : "TXT";
}

function getSourceBadgeHtml(item, className = "source-badge") {
  const source = item?.source === "postype" ? "postype" : "drive";
  const fullLabel = getSourceLabel(item);
  const shortLabel = source === "postype" ? "P" : "T";
  return `<span class="${className} ${source}"><span class="source-badge-full">${fullLabel}</span><span class="source-badge-short" aria-hidden="true">${shortLabel}</span></span>`;
}

function getPostypeMetaHtml(item) {
  if (item?.source !== "postype") return "";

  const parts = [
    item.genre,
    item.status,
    item.subCp1 ? `서브 ${item.subCp1}` : "",
    item.subCp2 ? `서브 ${item.subCp2}` : "",
  ].filter(Boolean);
  const baseHtml = parts.length ? `${escapeHtml(parts.join(" · "))}${item.latestPublishedDate ? " · " : ""}` : "";
  const latestHtml = item.latestPublishedDate
    ? `<span class="postype-latest-meta"><span>최근발행 ${escapeHtml(formatArchiveDate(item.latestPublishedDate))}</span>${getRecentPostypeBoltHtml(item)}</span>`
    : "";

  if (!baseHtml && !latestHtml) return "";
  return `<p class="card-source-meta">${baseHtml}${latestHtml}</p>`;
}

function getPostypeBookmarkButtonHtml(item, className = "postype-bookmark-button") {
  if (item?.source !== "postype") return "";

  const bookmarked = Boolean(
    state.user && getUserLibraryEntry(item.id)?.bookmarked
  );

  return `
    <button
      class="${className} ${bookmarked ? "active" : ""}"
      type="button"
      data-postype-bookmark="${escapeHtml(item.id)}"
      aria-label="${bookmarked ? "북마크 해제" : "북마크"}"
      title="${bookmarked ? "북마크 해제" : "북마크"}"
      aria-pressed="${bookmarked ? "true" : "false"}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7A1.75 1.75 0 0 1 17.25 4.75v15.1l-5.25-3.3-5.25 3.3V4.75Z"></path>
      </svg>
    </button>
  `;
}

function getPostypeQuoteButtonHtml(item, className = "item-quote-button") {
  if (item?.source !== "postype") return "";

  return `
    <button
      class="${className}"
      type="button"
      data-item-quote="${escapeHtml(item.id)}"
      aria-label="문장 입력해서 이미지 만들기"
      title="문장 입력해서 이미지 만들기">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.4 7.4c-2.2.9-3.9 3.1-3.9 5.8 0 1.8 1.1 3.3 2.9 3.3 1.6 0 2.8-1.1 2.8-2.6 0-1.4-1.1-2.4-2.4-2.4-.2 0-.5 0-.7.1.2-1.4 1.2-2.8 2.6-3.7"></path>
        <path d="M17.9 7.4c-2.2.9-3.9 3.1-3.9 5.8 0 1.8 1.1 3.3 2.9 3.3 1.6 0 2.8-1.1 2.8-2.6 0-1.4-1.1-2.4-2.4-2.4-.2 0-.5 0-.7.1.2-1.4 1.2-2.8 2.6-3.7"></path>
      </svg>
    </button>
  `;
}

function renderBookmarkStateChange(fileId) {
  render();
  if (!els.libraryModal?.hidden) renderUserLibraryModal();
  if (state.profileOpen) renderProfilePage();
  if (String(state.activeReaderItem?.id || "") === String(fileId || "")) {
    updateReaderBookmarkButton();
  }
}

async function persistBookmarkValue(fileId, label = "북마크") {
  const finalValue = Boolean(getUserLibraryEntry(fileId)?.bookmarked);
  const rollbackValue = state.bookmarkPersistedValues.has(fileId)
    ? Boolean(state.bookmarkPersistedValues.get(fileId))
    : false;

  try {
    const data = await userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify({
        action: "bookmark",
        fileId,
        bookmarked: finalValue,
      }),
    });
    state.bookmarkPersistedValues.set(fileId, finalValue);
    applyBookmarkCountResponse(fileId, data);
    return true;
  } catch (error) {
    // 요청 중 사용자가 다시 토글했다면 더 최신 UI 상태를 오래된 실패가 덮지 않는다.
    if (Boolean(getUserLibraryEntry(fileId)?.bookmarked) === finalValue) {
      updateUserLibraryEntry(fileId, { bookmarked: rollbackValue });
      renderBookmarkStateChange(fileId);
      window.alert(`${label}를 저장하지 못했습니다. 이전 상태로 되돌렸습니다.`);
    }
    console.warn(`${label} 저장 실패`, error);
    return false;
  }
}

function scheduleBookmarkSave(fileId, delay, label = "북마크") {
  const previousTimer = state.bookmarkSaveTimers.get(fileId);
  if (previousTimer) window.clearTimeout(previousTimer);

  const timer = window.setTimeout(async () => {
    state.bookmarkSaveTimers.delete(fileId);
    await persistBookmarkValue(fileId, label);
  }, delay);
  state.bookmarkSaveTimers.set(fileId, timer);
}

function flushPendingBookmarkSavesBeforePageExit() {
  if (!state.user || !state.bookmarkSaveTimers.size) return;

  const token = getAuthToken();
  for (const fileId of state.bookmarkSaveTimers.keys()) {
    const bookmarked = Boolean(getUserLibraryEntry(fileId)?.bookmarked);
    const headers = new Headers({ "content-type": "application/json" });
    if (token) headers.set("authorization", `Bearer ${token}`);

    // 타이머는 취소하지 않는다. bfcache에서 페이지가 돌아오면 정상 저장이 다시 실행되어
    // keepalive 성공 여부와 무관하게 persisted 상태를 확정할 수 있다.
    fetch("/api/user/item", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "bookmark", fileId, bookmarked }),
      cache: "no-store",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  }
}

async function togglePostypeBookmark(item) {
  if (!item || item.source !== "postype") return;

  if (!state.user) {
    openAuthModal(
      "login",
      "포스타입 작품을 북마크하려면 로그인해 주세요."
    );
    return;
  }

  const fileId = item.id;
  const nextValue = !getUserLibraryEntry(fileId)?.bookmarked;

  updateUserLibraryEntry(fileId, {
    bookmarked: nextValue,
    updatedAt: Date.now(),
  });

  render();
  if (!els.libraryModal?.hidden) renderUserLibraryModal();

  scheduleBookmarkSave(fileId, 300, "포스타입 북마크");
}


async function toggleListBookmark(item) {
  if (!item?.id) return;
  if (item.source === "postype") {
    await togglePostypeBookmark(item);
    return;
  }

  if (!state.user) {
    openAuthModal("login", "북마크를 저장하려면 로그인해 주세요.");
    return;
  }

  const fileId = item.id;
  const nextValue = !getUserLibraryEntry(fileId)?.bookmarked;
  updateUserLibraryEntry(fileId, {
    bookmarked: nextValue,
    updatedAt: Date.now(),
  });
  render();
  if (!els.libraryModal?.hidden) renderUserLibraryModal();

  scheduleBookmarkSave(fileId, 300, "북마크");
}

function getMobileListMoreHtml(item) {
  if (!item?.id || item.source === "postype") return "";
  const bookmarked = Boolean(state.user && getUserLibraryEntry(item.id)?.bookmarked);
  const downloadUrl = getDownloadUrl(item);
  return `
    <details class="list-mobile-more" data-list-more>
      <summary class="list-mobile-more-trigger" aria-label="더보기" title="더보기">
        <span aria-hidden="true">•••</span>
      </summary>
      <div class="list-mobile-more-menu" role="menu">
        <button type="button" role="menuitem" data-list-bookmark="${escapeHtml(item.id)}">${bookmarked ? "북마크 해제" : "북마크"}</button>
        ${downloadUrl ? `<a role="menuitem" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer" data-download-id="${escapeHtml(item.id)}">다운로드</a>` : ""}
        <button type="button" role="menuitem" data-list-share="${escapeHtml(item.id)}">공유하기</button>
      </div>
    </details>`;
}

function getMobilePostypeBookmarkHtml(item) {
  if (!item?.id || item.source !== "postype") return "";
  return getPostypeBookmarkButtonHtml(
    item,
    "postype-bookmark-button list-mobile-postype-bookmark"
  );
}

function getMobilePostypeQuoteHtml(item) {
  if (!item?.id || item.source !== "postype") return "";
  return getPostypeQuoteButtonHtml(
    item,
    "item-quote-button list-mobile-postype-quote"
  );
}

function getListTitleLengthClass(title) {
  const length = Array.from(String(title || "")).length;
  if (length >= 46) return " list-title-text-very-long";
  if (length >= 28) return " list-title-text-long";
  return "";
}


function getDriveBookmarkButtonHtml(item, className = "item-bookmark-button") {
  if (!item?.id || item.source === "postype") return "";
  const bookmarked = Boolean(state.user && getUserLibraryEntry(item.id)?.bookmarked);
  return `
    <button
      class="${className} ${bookmarked ? "active" : ""}"
      type="button"
      data-drive-bookmark="${escapeHtml(item.id)}"
      aria-label="${bookmarked ? "북마크 해제" : "북마크"}"
      title="${bookmarked ? "북마크 해제" : "북마크"}"
      aria-pressed="${bookmarked ? "true" : "false"}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7A1.75 1.75 0 0 1 17.25 4.75v15.1l-5.25-3.3-5.25 3.3V4.75Z"></path>
      </svg>
    </button>`;
}

function getCardStatusToneClass(item) {
  const label = getItemStatusLabel(item);
  if (label === "완결") return "status-complete";
  return "status-serial";
}

function getItemLikeButtonHtml(item, className = "item-like-button") {
  if (!item?.id || item.source === "postype") return "";
  const liked = Boolean(state.user && isItemLiked(item));
  return `
    <button
      class="${className} ${liked ? "active" : ""}"
      type="button"
      data-item-like="${escapeHtml(item.id)}"
      aria-label="${liked ? "좋아요 취소" : "좋아요"}"
      title="${liked ? "좋아요 취소" : "좋아요"}"
      aria-pressed="${liked ? "true" : "false"}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 1 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1Z"></path>
      </svg>
    </button>`;
}

function getOfflineCardBadgeHtml(item) {
  if (!hasOfflineBody(item)) return "";
  return `<span class="offline-card-badge" aria-label="오프라인 저장됨" title="이 브라우저에 본문이 저장되어 있습니다.">오프라인</span>`;
}

function getOfflineListBadgeHtml(item) {
  if (!hasOfflineBody(item)) return "";
  return `<span class="offline-list-badge" aria-label="오프라인 저장됨" title="이 브라우저에 본문이 저장되어 있습니다.">오프라인</span>`;
}

function renderCards(items) {
  els.contentGrid.innerHTML = items.map((item) => `
    <article class="content-card ${item.source === "postype" ? "postype-item" : "drive-item"} ${hasOfflineBody(item) ? "offline-body-saved" : ""}"
      tabindex="0" role="button"
      data-id="${escapeHtml(item.id)}"
      aria-label="${escapeHtml(item.title)} ${item.source === "postype" ? "포스타입에서 열기" : "본문 열기"}">
      <div class="card-topline">
        <div class="card-tags">
          ${getSourceBadgeHtml(item, "card-tag source-badge")}
          <span class="card-tag card-cp-tag">${escapeHtml(item.combination)}</span>
          <span class="card-tag card-publish-tag">${escapeHtml(getContentTypeDisplayLabel(getItemContentType(item)))}</span>
          <span class="card-tag card-status-tag ${getCardStatusToneClass(item)}">${escapeHtml(getItemStatusLabel(item))}</span>
        </div>
        ${getItemReadingBadge(item)}
      </div>
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <p class="card-author">${escapeHtml(item.author)}</p>
      ${getPostypeMetaHtml(item)}
      ${getOfflineCardBadgeHtml(item)}
      <div class="card-actions">
        ${item.source === "postype"
          ? `${getPostypeBookmarkButtonHtml(item, "postype-bookmark-button card-postype-bookmark")}${getPostypeQuoteButtonHtml(item, "item-quote-button card-quote-button")}${getRecentPostypeNewBadgeHtml(item)}`
          : `${getItemLikeButtonHtml(item, "item-like-button card-like-button")}${getDriveBookmarkButtonHtml(item, "item-bookmark-button card-bookmark-button")}${getDownloadButtonHtml(item, "item-download-button card-download-button")}`}
      </div>
    </article>
  `).join("");
}

function getListBookmarkIndicator(item) {
  if (!item) return "";

  if (item.source === "postype") {
    return getPostypeBookmarkButtonHtml(
      item,
      "postype-bookmark-button list-postype-bookmark"
    );
  }

  if (!state.user) return "";

  const bookmarked = Boolean(getUserLibraryEntry(item.id)?.bookmarked);
  if (!bookmarked) return "";

  return `
    <span class="list-bookmark-indicator" title="북마크됨" aria-label="북마크됨">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7A1.75 1.75 0 0 1 17.25 4.75v15.1l-5.25-3.3-5.25 3.3V4.75Z"></path>
      </svg>
    </span>
  `;
}

function renderList(items) {
  els.contentListBody.innerHTML = items.map((item) => `
    <tr tabindex="0" data-id="${escapeHtml(item.id)}"
      class="${item.source === "postype" ? "postype-item" : "drive-item"} ${hasOfflineBody(item) ? "offline-body-saved" : ""}">
      <td>${escapeHtml(item.combination)}</td>
      <td><span class="list-content-type-wrap"><span>${escapeHtml(getContentTypeDisplayLabel(getItemContentType(item)))}</span></span></td>
      <td class="list-title">
        <span class="list-title-row">
          <span class="list-title-main">
            <span class="list-title-heading">
              ${getSourceBadgeHtml(item, "list-source-badge")}
              <span class="list-title-text${getListTitleLengthClass(item.title)}">${escapeHtml(item.title)}</span>
            </span>
            ${getItemReadingBadge(item)}
            ${getOfflineListBadgeHtml(item)}
          </span>
          <span class="list-title-actions">
            ${getItemLikeButtonHtml(item, "item-like-button list-like-button")}
            ${getMobilePostypeBookmarkHtml(item)}
            ${getMobilePostypeQuoteHtml(item)}
            <span class="list-desktop-actions">
              ${getListBookmarkIndicator(item)}
              ${getRecentPostypeNewBadgeHtml(item)}
              ${getPostypeQuoteButtonHtml(item, "item-quote-button list-quote-button")}
              ${getDownloadButtonHtml(item, "item-download-button list-download-button")}
            </span>
            ${getMobileListMoreHtml(item)}
          </span>
        </span>
        ${
          item.source === "postype"
            ? `<span class="list-source-meta"><span class="list-source-meta-desktop">${escapeHtml(
                [
                  getItemStatusLabel(item),
                  item.genre,
                  item.subCp1,
                  item.subCp2,
                  item.latestPublishedDate ? `최근발행 ${formatArchiveDate(item.latestPublishedDate)}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              )}</span>${item.latestPublishedDate ? `<span class="list-source-meta-mobile"><span class="update-icon" aria-hidden="true">UP</span><span>${escapeHtml(formatCompactArchiveDate(item.latestPublishedDate))}</span>${getRecentPostypeBoltHtml(item)}</span>` : ""}</span>`
            : ""
        }
      </td>
      <td>${escapeHtml(item.author)}</td>
    </tr>
  `).join("");
}

function adjustMobileListTitleSizes() {
  if (!window.matchMedia?.("(max-width: 640px)")?.matches) return;

  window.requestAnimationFrame(() => {
    els.contentListBody?.querySelectorAll(".list-title-text").forEach((title) => {
      title.classList.remove("list-title-text-3plus", "list-title-text-4plus");
      const style = window.getComputedStyle(title);
      const lineHeight = Number.parseFloat(style.lineHeight) || (Number.parseFloat(style.fontSize) || 12) * 1.28;
      let lines = Math.max(1, Math.round(title.getBoundingClientRect().height / lineHeight));

      if (lines >= 3) {
        title.classList.add("list-title-text-3plus");
        const style3 = window.getComputedStyle(title);
        const lineHeight3 = Number.parseFloat(style3.lineHeight) || (Number.parseFloat(style3.fontSize) || 11) * 1.22;
        lines = Math.max(1, Math.round(title.getBoundingClientRect().height / lineHeight3));
      }
      if (lines >= 4) title.classList.add("list-title-text-4plus");
    });
  });
}

function syncViewButtons() {
  els.cardViewButton.classList.toggle("active", state.view === "card");
  els.listViewButton.classList.toggle("active", state.view === "list");
}

function setView(view) {
  state.view = view;
  localStorage.setItem("archiveViewV2", view);
  render();
}

const READER_PROGRESS_PREFIX = "archiveReaderProgress:v1:";

function getLocalReaderProgressKey(fileId) {
  const userId = String(state.user?.userId || "").trim();
  const safeFileId = String(fileId || "").trim();
  if (!userId || !safeFileId) return "";
  return `${READER_PROGRESS_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(safeFileId)}`;
}

function readLocalReaderProgress(fileId) {
  const key = getLocalReaderProgressKey(fileId);
  if (!key) return null;

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (!parsed || typeof parsed !== "object") return null;

    const percent = Number(parsed.percent || 0);
    const savedAt = Number(parsed.savedAt || 0);
    if (!Number.isFinite(percent) || !Number.isFinite(savedAt) || savedAt <= 0) {
      return null;
    }

    return {
      mode: parsed.mode === "chunk" ? "chunk" : "scroll",
      scrollTop: parsed.scrollTop == null ? null : Number(parsed.scrollTop),
      chunkIndex: parsed.chunkIndex == null ? null : Number(parsed.chunkIndex),
      chunkRatio: parsed.chunkRatio == null ? null : Number(parsed.chunkRatio),
      percent: normalizeReaderProgressPercent(percent),
      read: Boolean(parsed.read),
      savedAt,
    };
  } catch {
    return null;
  }
}

function writeLocalReaderProgress(item, saved, options = {}) {
  if (!state.user || !item || !saved) return false;

  const key = getLocalReaderProgressKey(item.id);
  if (!key) return false;

  const now = Date.now();
  const previousSavedAt = Number(state.localProgressSavedAt.get(item.id) || 0);
  if (
    !options.force &&
    previousSavedAt > 0 &&
    now - previousSavedAt < READER_LOCAL_SAVE_INTERVAL_MS
  ) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify({
      mode: saved.mode === "chunk" ? "chunk" : "scroll",
      scrollTop: saved.scrollTop ?? null,
      chunkIndex: saved.chunkIndex ?? null,
      chunkRatio: saved.chunkRatio ?? null,
      percent: normalizeReaderProgressPercent(saved.percent),
      read: Boolean(saved.read),
      savedAt: now,
    }));
    state.localProgressSavedAt.set(item.id, now);
    return true;
  } catch {
    return false;
  }
}

function clearLocalReaderProgress(fileId) {
  const key = getLocalReaderProgressKey(fileId);
  if (!key) return;

  try {
    localStorage.removeItem(key);
  } catch {}
  state.localProgressSavedAt.delete(fileId);
}

function clearLocalReaderProgressIfNotNewer(fileId, syncedSavedAt) {
  const current = readLocalReaderProgress(fileId);
  if (current && Number(current.savedAt || 0) > Number(syncedSavedAt || 0)) {
    return false;
  }

  clearLocalReaderProgress(fileId);
  return true;
}

function getRemoteReaderProgress(id) {
  const entry = getUserLibraryEntry(id);
  if (!entry) return null;

  const base = {
    percent: Number(entry.progressPercent || 0),
    read: Boolean(entry.readAt),
    savedAt: Number(entry.updatedAt || 0),
  };

  if (Number.isFinite(entry.chunkIndex)) {
    return {
      ...base,
      mode: "chunk",
      chunkIndex: entry.chunkIndex,
      chunkRatio: Number(entry.chunkRatio || 0),
    };
  }

  return {
    ...base,
    mode: "scroll",
    scrollTop: Number.isFinite(entry.scrollTop) ? entry.scrollTop : 0,
  };
}

function getReaderProgress(id) {
  if (!id || !state.user) return null;

  const remote = getRemoteReaderProgress(id);
  const local = readLocalReaderProgress(id);
  const latest =
    local && (!remote || Number(local.savedAt || 0) > Number(remote.savedAt || 0))
      ? local
      : remote;

  if (
    !latest ||
    latest.read ||
    Number(latest.percent || 0) <= 0
  ) {
    return null;
  }

  if (latest.mode === "chunk" && Number.isFinite(latest.chunkIndex)) {
    return {
      mode: "chunk",
      chunkIndex: latest.chunkIndex,
      chunkRatio: Number(latest.chunkRatio || 0),
      percent: latest.percent,
    };
  }

  return {
    mode: "scroll",
    scrollTop: Number(latest.scrollTop || 0),
    percent: latest.percent,
  };
}

function getResumeTarget(saved) {
  if (!saved || !els.readerPanel) return 0;

  const maxScroll = Math.max(
    0,
    els.readerPanel.scrollHeight - els.readerPanel.clientHeight
  );

  const percent = Number(saved.percent);

  if (Number.isFinite(percent) && percent > 0 && percent < 100) {
    return Math.max(
      0,
      Math.min(maxScroll, maxScroll * (percent / 100))
    );
  }

  return Math.max(
    0,
    Math.min(maxScroll, Number(saved.scrollTop) || 0)
  );
}

function temporarilySuspendProgressSave(duration = 700) {
  state.suspendReaderProgressSave = true;

  window.setTimeout(() => {
    state.suspendReaderProgressSave = false;
    saveReaderProgress();
  }, duration);
}

async function jumpReaderPanelTo(targetTop, options = {}) {
  if (!els.readerPanel) return false;

  state.suspendReaderProgressSave = true;

  let requestedTop = Math.max(0, Number(targetTop) || 0);
  let reached = false;

  for (let pass = 0; pass < 4; pass += 1) {
    const maxScroll = Math.max(
      0,
      els.readerPanel.scrollHeight - els.readerPanel.clientHeight
    );
    const target = Math.max(
      0,
      Math.min(maxScroll, requestedTop)
    );

    els.readerPanel.scrollTop = target;

    // Also call scrollTo with auto behavior. Some WebKit builds update
    // scrollTop only after the nested scroller is explicitly addressed.
    try {
      els.readerPanel.scrollTo({
        top: target,
        behavior: "auto",
      });
    } catch {}

    await nextFrame();
    await nextFrame();

    const actual = Math.max(0, els.readerPanel.scrollTop);
    const tolerance = Math.max(28, els.readerPanel.clientHeight * 0.03);

    if (Math.abs(actual - target) <= tolerance) {
      reached = true;
      break;
    }

    // Give late font/layout calculation a moment before retrying.
    await new Promise((resolve) =>
      setTimeout(resolve, pass === 0 ? 60 : 120)
    );
  }

  updateReaderScrollUi();

  // During the initial reader layout we intentionally move the scroll
  // container to 0. That is only a layout reset, not a user reading action.
  // Keep progress saving suspended so the previously saved resume point is
  // not overwritten with 0% before the user can press the resume button.
  if (options.releaseProgressSave === false) {
    return reached;
  }

  const releaseAfter = Number(options.releaseAfter || 520);
  window.setTimeout(() => {
    state.suspendReaderProgressSave = false;
    const saved = saveReaderProgress();
    const item = state.activeReaderItem;

    // Persist once after a verified jump. This also migrates legacy chunk
    // percentages to the corrected text-based coordinate immediately.
    if (
      saved &&
      state.user &&
      item &&
      shouldPersistProgress(item.id, saved)
    ) {
      persistProgress(item, saved);
    }
  }, releaseAfter);

  return reached;
}

function saveReaderProgress() {
  if (state.suspendReaderProgressSave || !state.user) return null;

  const item = state.activeReaderItem;
  if (!item || !els.readerPanel) return null;

  let saved = null;

  if (
    state.readerDisplayMode === "page" &&
    state.readerText
  ) {
    const length = Math.max(1, getReaderTextLength());
    const offset = clampReaderTextOffset(
      state.readerPageStart
    );
    let percent = normalizeReaderProgressPercent(
      (offset / length) * 100
    );

    if (
      state.readerPageHasNavigated &&
      offset > 0 &&
      percent <= 0
    ) {
      percent = 0.1;
    }

    if (isLargeReaderFile(item) && state.largeReaderChunks) {
      const position = readerOffsetToLargePosition(offset);

      saved = {
        mode: "chunk",
        chunkIndex: position?.index || 0,
        chunkRatio: position?.ratio || 0,
        percent,
      };
    } else {
      saved = {
        mode: "scroll",
        scrollTop: 0,
        percent,
      };
    }
  } else if (isLargeReaderFile(item) && state.largeReaderChunks) {
    const position = getLargeReaderPosition();
    if (!position) return null;

    saved = {
      mode: "chunk",
      chunkIndex: position.index,
      chunkRatio: position.ratio,
      percent: position.percent,
    };
  } else {
    const maxScroll = Math.max(
      0,
      els.readerPanel.scrollHeight - els.readerPanel.clientHeight
    );

    const scrollTop = Math.max(0, els.readerPanel.scrollTop);
    const textLength = Math.max(1, getReaderTextLength());
    const textOffset = currentScrollToReaderOffset();
    const rawPercent = textLength > 0
      ? (textOffset / textLength) * 100
      : 0;
    let percent = normalizeReaderProgressPercent(rawPercent);

    if (
      scrollTop >= READER_MIN_MEANINGFUL_SCROLL_PX &&
      percent <= 0
    ) {
      percent = 0.1;
    }

    if (scrollTop < READER_MIN_MEANINGFUL_SCROLL_PX) {
      percent = 0;
    }

    saved = {
      mode: "scroll",
      scrollTop,
      percent,
    };
  }

  saved.read = isReaderAtActualEnd(item);

  // Percentage is descriptive only. "Read" is determined by actual end
  // reach, not by a percentage threshold.
  if (saved.read) {
    saved.percent = 100;
  } else if (saved.percent >= 100) {
    saved.percent = 99.9;
  }

  const currentEntry = getUserLibraryEntry(item.id);

  updateUserLibraryEntry(item.id, {
    progressPercent: saved.percent,
    scrollTop: saved.mode === "scroll" ? saved.scrollTop : null,
    chunkIndex: saved.mode === "chunk" ? saved.chunkIndex : null,
    chunkRatio: saved.mode === "chunk" ? saved.chunkRatio : null,
    readAt: saved.read
      ? (currentEntry?.readAt || Date.now())
      : (currentEntry?.readAt || null),
    updatedAt: Date.now(),
  });

  // Keep a lightweight same-device recovery point more frequently than the
  // server sync. The helper is intentionally centralized so a future native
  // shell can replace Web Storage with a Capacitor/native preferences adapter.
  writeLocalReaderProgress(item, saved);

  return saved;
}

function setReaderLoadingProgress(percent, title, text) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

  if (els.readerProgressBar) {
    els.readerProgressBar.style.width = `${safePercent}%`;
  }

  if (els.readerProgressLabel) {
    els.readerProgressLabel.textContent = `${safePercent}%`;
  }

  if (title && els.readerLoadingTitle) {
    els.readerLoadingTitle.textContent = title;
  }

  if (text && els.readerLoadingText) {
    els.readerLoadingText.textContent = text;
  }
}


function isLargeReaderFile(item) {
  return Number(item?.size || 0) >= LARGE_FILE_LOADING_THRESHOLD_BYTES;
}

function isReaderPageModeEligible(item = state.activeReaderItem) {
  // TXT 리더는 단편/연재 구분 없이 사용자가 선택한 읽기 모드를 따른다.
  // 포스타입 원문은 별도 표시 구조를 사용하므로 기존처럼 스크롤 전용으로 유지한다.
  return Boolean(item && item.source !== "postype");
}

function resetReaderPageState() {
  state.readerPageStart = 0;
  state.readerEstimatedTotalPages = 1;
  state.readerPageEnd = 0;
  state.readerPageHasNavigated = false;
  state.readerPageTouchStartX = null;
  state.readerPageTouchStartY = null;
  window.clearTimeout(state.readerPageResizeTimer);
  state.readerPageResizeTimer = 0;
  window.clearTimeout(state.readerPageAnimationTimer);
  state.readerPageAnimationTimer = 0;
  els.readerPageViewport?.classList.remove(
    "page-turn-forward",
    "page-turn-back"
  );
}

function getReaderTextLength() {
  return Math.max(0, String(state.readerText || "").length);
}

// v9.23: visually indent every source line without changing readerText or DOM textContent.
// The pseudo element supplies the 1em indent, so saved/search offsets remain based on
// the original text exactly as before.
function renderReaderIndentedText(container, text) {
  if (!container) return;

  const value = String(text ?? "");

  // v9.31 Safari selection diagnostic:
  // v9.23 changed reader text from plain text nodes to one span per source line
  // plus a generated ::before indent. Safari can keep a valid DOM Selection
  // while its native selection highlight/handles fail to paint, so restore the
  // pre-v9.23 plain-text DOM only on Safari to isolate that rendering change.
  // Page measurement uses this same helper, so page text and measurement remain
  // structurally identical and source/search/resume offsets are untouched.
  if (IS_SAFARI_READER) {
    container.textContent = value;
    return;
  }

  container.textContent = "";

  const fragment = document.createDocumentFragment();
  const lines = value.split("\n");

  lines.forEach((line, index) => {
    const span = document.createElement("span");
    span.className = "reader-indent-line";
    span.appendChild(document.createTextNode(line));
    fragment.appendChild(span);

    if (index < lines.length - 1) {
      fragment.appendChild(document.createTextNode("\n"));
    }
  });

  container.appendChild(fragment);
}

function clampReaderTextOffset(offset) {
  return Math.max(
    0,
    Math.min(getReaderTextLength(), Math.floor(Number(offset) || 0))
  );
}

function readerOffsetToLargePosition(offset) {
  const chunks = state.largeReaderChunks;
  if (!Array.isArray(chunks) || !chunks.length) return null;

  let remaining = clampReaderTextOffset(offset);

  for (let index = 0; index < chunks.length; index += 1) {
    const length = String(chunks[index] || "").length;
    if (remaining <= length || index === chunks.length - 1) {
      return {
        index,
        ratio: length > 0
          ? Math.max(0, Math.min(1, remaining / length))
          : 0,
      };
    }
    remaining -= length;
  }

  return {
    index: chunks.length - 1,
    ratio: 1,
  };
}

function largePositionToReaderOffset(index, ratio = 0) {
  const chunks = state.largeReaderChunks;
  if (!Array.isArray(chunks) || !chunks.length) return 0;

  const safeIndex = Math.max(
    0,
    Math.min(chunks.length - 1, Number(index) || 0)
  );

  let offset = 0;
  for (let i = 0; i < safeIndex; i += 1) {
    offset += String(chunks[i] || "").length;
  }

  const chunk = String(chunks[safeIndex] || "");
  offset += chunk.length * Math.max(
    0,
    Math.min(1, Number(ratio) || 0)
  );

  return clampReaderTextOffset(offset);
}

function getLegacyLargeReaderOffset(saved) {
  if (
    !saved ||
    saved.mode !== "chunk" ||
    !state.readerText
  ) return null;

  const savedPercent = Number(saved.percent);
  const savedIndex = Number(saved.chunkIndex);
  const savedRatio = Math.max(
    0,
    Math.min(1, Number(saved.chunkRatio) || 0)
  );

  if (
    !Number.isFinite(savedPercent) ||
    !Number.isFinite(savedIndex)
  ) return null;

  // v7.36 and earlier calculated a long-file percentage from equal chunk
  // counts, then restored it as a percentage of total characters. Those two
  // coordinate systems diverge whenever the final chunk is shorter. Rebuild
  // both historic chunk layouts so old progress can be migrated even when it
  // was saved on Safari and resumed in another browser (or vice versa).
  const candidateSizes = Array.from(new Set([
    getLargeReaderChunkChars(),
    LARGE_READER_CHUNK_CHARS,
    SAFARI_LARGE_READER_CHUNK_CHARS,
  ]));

  let best = null;

  for (const chunkChars of candidateSizes) {
    const chunks = splitLargeReaderText(state.readerText, chunkChars);
    const index = Math.floor(savedIndex);

    if (index < 0 || index >= chunks.length) continue;

    const legacyPercent = normalizeReaderProgressPercent(
      ((index + savedRatio) / Math.max(1, chunks.length)) * 100
    );
    const error = Math.abs(savedPercent - legacyPercent);

    if (!best || error < best.error) {
      let offset = 0;
      for (let i = 0; i < index; i += 1) {
        offset += String(chunks[i] || "").length;
      }
      offset += String(chunks[index] || "").length * savedRatio;
      best = { error, offset: clampReaderTextOffset(offset) };
    }
  }

  // Saved percentages have 0.1% precision. Allow one rounding step plus a
  // small floating-point margin; otherwise treat percent as the v7.37 stable
  // text coordinate.
  return best && best.error <= 0.16 ? best.offset : null;
}

function savedProgressToReaderOffset(saved) {
  if (!saved) return 0;

  const legacyOffset = getLegacyLargeReaderOffset(saved);
  if (Number.isFinite(legacyOffset)) {
    return legacyOffset;
  }

  // Percent is the stable cross-version resume coordinate.
  // Chunk indexes are renderer-specific and can change when chunk size,
  // browser or layout strategy changes.
  const percent = Number(saved.percent);

  if (Number.isFinite(percent) && percent > 0) {
    return clampReaderTextOffset(
      getReaderTextLength() *
      (Math.max(0, Math.min(99.9, percent)) / 100)
    );
  }

  if (
    saved.mode === "chunk" &&
    Array.isArray(state.largeReaderChunks)
  ) {
    return largePositionToReaderOffset(
      saved.chunkIndex,
      saved.chunkRatio
    );
  }

  return 0;
}

function getReaderTextNodeCharOffsetAtY(textNode, targetY) {
  if (!textNode) return 0;

  const length = textNode.data?.length || 0;
  if (length <= 0) return 0;

  const range = document.createRange();
  let low = 0;
  let high = Math.max(0, length - 1);
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    try {
      range.setStart(textNode, mid);
      range.setEnd(textNode, Math.min(length, mid + 1));
      const rect = range.getBoundingClientRect();
      const y = rect.top;

      if (!Number.isFinite(y)) break;

      if (y <= targetY) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } catch {
      break;
    }
  }

  return Math.max(0, Math.min(length, best));
}

function getNormalReaderTextOffsetAtCurrentScroll() {
  if (!els.readerPanel || !els.readerContent) return null;

  const panelScrollTop = Math.max(0, els.readerPanel.scrollTop);
  if (panelScrollTop < READER_MIN_MEANINGFUL_SCROLL_PX) return 0;

  const panelRect = els.readerPanel.getBoundingClientRect();
  const targetY = panelRect.top + 92;
  const walker = document.createTreeWalker(
    els.readerContent,
    NodeFilter.SHOW_TEXT
  );

  let totalBefore = 0;
  let node = walker.nextNode();
  let lastOffset = 0;

  while (node) {
    const length = node.data?.length || 0;

    if (length > 0) {
      try {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();

        if (rect.bottom >= targetY) {
          const localOffset = getReaderTextNodeCharOffsetAtY(
            node,
            targetY
          );
          return clampReaderTextOffset(totalBefore + localOffset);
        }
      } catch {
        // Fall through to the legacy scroll-height ratio below.
        return null;
      }
    }

    totalBefore += length;
    lastOffset = totalBefore;
    node = walker.nextNode();
  }

  return clampReaderTextOffset(lastOffset);
}

function currentScrollToReaderOffset() {
  const item = state.activeReaderItem;
  if (!item || !els.readerPanel) return 0;

  if (isLargeReaderFile(item) && state.largeReaderChunks) {
    const position = getLargeReaderPosition();
    if (position) {
      return largePositionToReaderOffset(
        position.index,
        position.ratio
      );
    }
  }

  const exactOffset = getNormalReaderTextOffsetAtCurrentScroll();
  if (Number.isFinite(exactOffset)) {
    return clampReaderTextOffset(exactOffset);
  }

  // Browser Range failures are rare, but keep the old height-ratio logic as
  // a compatibility fallback rather than breaking progress saving.
  const maxScroll = Math.max(
    0,
    els.readerPanel.scrollHeight - els.readerPanel.clientHeight
  );
  if (maxScroll <= 0) return 0;

  const ratio = Math.max(
    0,
    Math.min(1, els.readerPanel.scrollTop / maxScroll)
  );
  return clampReaderTextOffset(getReaderTextLength() * ratio);
}

function resizeReaderPageViewport() {
  if (
    !els.readerPageViewport ||
    els.readerPageViewport.hidden ||
    !els.readerPanel
  ) return;

  const panelRect = els.readerPanel.getBoundingClientRect();
  const viewportRect = els.readerPageViewport.getBoundingClientRect();
  const available = Math.max(
    250,
    Math.floor(panelRect.bottom - viewportRect.top - 18)
  );

  els.readerPageViewport.style.height = `${available}px`;
}

function pageSegmentFits(start, end) {
  if (!els.readerPageMeasure) return true;

  const text = String(state.readerText || "").slice(start, end);
  renderReaderIndentedText(els.readerPageMeasure, text || " ");

  return (
    els.readerPageMeasure.scrollHeight <=
    els.readerPageMeasure.clientHeight + 1
  );
}

function findReaderPageEnd(start) {
  const textLength = getReaderTextLength();
  const safeStart = clampReaderTextOffset(start);

  if (safeStart >= textLength) return textLength;

  let low = Math.min(textLength, safeStart + 1);
  let high = Math.min(
    textLength,
    safeStart + READER_PAGE_PROBE_CHARS
  );

  if (pageSegmentFits(safeStart, high)) {
    return high;
  }

  let best = low;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (pageSegmentFits(safeStart, mid)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(safeStart + 1, best);
}

function findReaderPreviousPageStart(end) {
  const safeEnd = clampReaderTextOffset(end);
  if (safeEnd <= 0) return 0;

  let low = Math.max(0, safeEnd - READER_PAGE_PROBE_CHARS);
  let high = Math.max(0, safeEnd - 1);
  let best = high;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (pageSegmentFits(mid, safeEnd)) {
      best = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(0, best);
}

function getReaderEstimatedTotalPagesFromScroll() {
  if (!els.readerPanel || !els.readerContent) {
    return Math.max(1, Number(state.readerEstimatedTotalPages) || 1);
  }

  const viewportHeight = Math.max(1, els.readerPanel.clientHeight);
  const renderedHeight = Math.max(viewportHeight, els.readerContent.scrollHeight);
  let estimatedHeight = renderedHeight;

  if (
    Array.isArray(state.largeReaderChunks) &&
    state.largeReaderChunks.length > 0 &&
    state.largeReaderRenderedCount > 0
  ) {
    const renderedRatio = Math.max(
      1 / state.largeReaderChunks.length,
      Math.min(1, state.largeReaderRenderedCount / state.largeReaderChunks.length)
    );
    estimatedHeight = renderedHeight / renderedRatio;
  }

  return Math.max(1, Math.ceil(estimatedHeight / viewportHeight));
}

function updateReaderPositionStatus() {
  if (!els.readerPositionStatus || !state.activeReaderItem || !state.readerText) return;

  // The floating page chip belongs to scroll mode only. Page mode already
  // shows current/total page + percent inside its existing footer progress area.
  if (state.readerDisplayMode === "page") {
    els.readerPositionStatus.hidden = true;
    return;
  }

  els.readerPositionStatus.hidden = false;

  const length = Math.max(1, getReaderTextLength());
  let offset = 0;
  let totalPages = Math.max(1, Number(state.readerEstimatedTotalPages) || 1);

  if (state.readerDisplayMode === "page") {
    offset = clampReaderTextOffset(state.readerPageStart);

    if (totalPages <= 1) {
      const pageChars = Math.max(1, state.readerPageEnd - state.readerPageStart);
      totalPages = Math.max(1, Math.ceil(length / pageChars));
      state.readerEstimatedTotalPages = totalPages;
    }
  } else {
    offset = currentScrollToReaderOffset();
    totalPages = getReaderEstimatedTotalPagesFromScroll();
    state.readerEstimatedTotalPages = totalPages;
  }

  const progressRatio = Math.max(0, Math.min(1, offset / length));
  let currentPage = Math.max(
    1,
    Math.min(totalPages, Math.floor(progressRatio * Math.max(1, totalPages - 1)) + 1)
  );

  if (
    state.readerDisplayMode === "page" &&
    state.readerPageEnd >= length
  ) {
    currentPage = totalPages;
  }

  els.readerPositionStatus.textContent = `${currentPage} / ${totalPages}`;
  els.readerPositionStatus.setAttribute(
    "aria-label",
    `현재 읽기 위치 ${currentPage}페이지, 전체 ${totalPages}페이지`
  );
}

function getReaderCurrentOffset() {
  if (!state.readerText) return 0;
  return state.readerDisplayMode === "page"
    ? clampReaderTextOffset(state.readerPageStart)
    : clampReaderTextOffset(currentScrollToReaderOffset());
}

function getReaderPositionSnapshot(offsetOverride = null) {
  const length = Math.max(1, getReaderTextLength());
  const offset = offsetOverride == null ? getReaderCurrentOffset() : clampReaderTextOffset(offsetOverride);
  let totalPages = Math.max(1, Number(state.readerEstimatedTotalPages) || 1);
  if (state.readerDisplayMode === "scroll") {
    totalPages = getReaderEstimatedTotalPagesFromScroll();
    state.readerEstimatedTotalPages = totalPages;
  } else if (totalPages <= 1) {
    const pageChars = Math.max(1, state.readerPageEnd - state.readerPageStart);
    totalPages = Math.max(1, Math.ceil(length / pageChars));
    state.readerEstimatedTotalPages = totalPages;
  }
  const ratio = Math.max(0, Math.min(1, offset / length));
  let currentPage = Math.max(1, Math.min(totalPages, Math.floor(ratio * Math.max(1, totalPages - 1)) + 1));
  if (state.readerDisplayMode === "page" && offsetOverride == null && state.readerPageEnd >= length) currentPage = totalPages;
  return { length, offset, ratio, totalPages, currentPage, percent: Math.round(ratio * 100) };
}

function updateReaderSeekPreview() {
  if (!els.readerSeekRange || !state.readerText) return;
  const ratio = Math.max(0, Math.min(1, Number(els.readerSeekRange.value || 0) / 1000));
  const snapshot = getReaderPositionSnapshot(Math.round(getReaderTextLength() * ratio));
  if (els.readerSeekPage) {
    els.readerSeekPage.textContent = `${snapshot.currentPage.toLocaleString("ko-KR")} / ${snapshot.totalPages.toLocaleString("ko-KR")} · ${snapshot.percent}%`;
  }
}

function openReaderSeekFloat() {
  if (!state.readerText || !els.readerSeekFloat || !els.readerSeekRange) return;
  const snapshot = getReaderPositionSnapshot();
  els.readerSeekRange.value = String(Math.round(snapshot.ratio * 1000));
  updateReaderSeekPreview();
  els.readerSeekFloat.hidden = false;
}

function closeReaderSeekFloat() {
  if (els.readerSeekFloat) els.readerSeekFloat.hidden = true;
}

let readerSeekMoveTimer = 0;
async function moveReaderToSeekPosition({ persist = false } = {}) {
  if (!state.readerText || !els.readerSeekRange) return;
  const ratio = Math.max(0, Math.min(1, Number(els.readerSeekRange.value || 0) / 1000));
  const offset = clampReaderTextOffset(Math.round(getReaderTextLength() * ratio));

  if (state.readerDisplayMode === "page") {
    renderReaderPageAt(offset, { navigated: true });
  } else {
    await scrollReaderToTextOffset(offset, { viewportRatio: 0.18 });
  }

  if (persist) {
    const saved = saveReaderProgress();
    const item = state.activeReaderItem;
    if (saved && item && state.user && shouldSyncProgressNow(item.id, saved)) persistProgress(item, saved);
  }
}

function scheduleReaderSeekMove() {
  updateReaderSeekPreview();
  window.clearTimeout(readerSeekMoveTimer);
  readerSeekMoveTimer = window.setTimeout(() => {
    readerSeekMoveTimer = 0;
    moveReaderToSeekPosition();
  }, 45);
}

function updateReaderPageControls() {
  const length = getReaderTextLength();
  const start = clampReaderTextOffset(state.readerPageStart);
  const end = clampReaderTextOffset(state.readerPageEnd);
  const percent = length > 0
    ? Math.min(100, Math.max(0, (end / length) * 100))
    : 0;

  if (els.readerPagePrev) {
    els.readerPagePrev.disabled = start <= 0;
  }

  if (els.readerPageNext) {
    els.readerPageNext.disabled = end >= length;
    els.readerPageNext.textContent =
      end >= length ? "마지막" : "다음 ›";
  }

  if (els.readerPageProgressFill) {
    els.readerPageProgressFill.style.width =
      `${Math.max(0, Math.min(100, percent))}%`;
  }

  if (els.readerPageStatus) {
    const snapshot = getReaderPositionSnapshot();
    const percentLabel = end >= length ? 100 : getReaderProgressDisplayPercent(percent);
    els.readerPageStatus.textContent = `${snapshot.currentPage} / ${snapshot.totalPages} · ${percentLabel}%`;
  }

  updateReaderPositionStatus();
}

function renderReaderPageAt(start, options = {}) {
  if (
    !els.readerPageViewport ||
    !els.readerPageText ||
    !state.readerText
  ) return false;

  resizeReaderPageViewport();

  const safeStart = clampReaderTextOffset(start);
  const end = findReaderPageEnd(safeStart);

  state.readerPageStart = safeStart;
  state.readerPageEnd = end;

  renderReaderIndentedText(
    els.readerPageText,
    String(state.readerText).slice(safeStart, end)
  );

  updateReaderPageControls();

  if (options.navigated) {
    state.readerPageHasNavigated = true;
  }

  return true;
}

async function syncScrollReaderToOffset(offset, options = {}) {
  const item = state.activeReaderItem;
  if (!item || !els.readerPanel) return false;

  const safeOffset = clampReaderTextOffset(offset);
  return scrollReaderToTextOffset(safeOffset, {
    releaseAfter: 420,
    releaseProgressSave: options.releaseProgressSave,
  });
}

function getPreferredReaderDisplayMode() {
  return getViewerPreferenceStorage().getItem(READER_DISPLAY_MODE_KEY) === "page"
    ? "page"
    : "scroll";
}

function syncReaderModeButtons() {
  const effectiveMode = state.activeReaderItem
    ? state.readerDisplayMode
    : getPreferredReaderDisplayMode();
  const pageActive = effectiveMode === "page";

  els.readerScrollModeButton?.classList.toggle("active", !pageActive);
  els.readerPageModeButton?.classList.toggle("active", pageActive);

  els.readerScrollModeButton?.setAttribute(
    "aria-pressed",
    pageActive ? "false" : "true"
  );
  els.readerPageModeButton?.setAttribute(
    "aria-pressed",
    pageActive ? "true" : "false"
  );
}

async function setReaderDisplayMode(mode, options = {}) {
  const item = state.activeReaderItem;
  const requestedMode = mode === "page" ? "page" : "scroll";
  let nextMode = requestedMode;

  if (!item) {
    state.readerDisplayMode = requestedMode;

    if (options.persist !== false) {
      setViewerPreference(READER_DISPLAY_MODE_KEY, requestedMode);
    }

    syncReaderModeButtons();
    return;
  }

  if (
    nextMode === "page" &&
    (!isReaderPageModeEligible(item) || !state.readerText)
  ) {
    nextMode = "scroll";
  }

  const previousMode = state.readerDisplayMode;
  let positionOffset = Number(options.offset);

  if (!Number.isFinite(positionOffset)) {
    positionOffset =
      previousMode === "page"
        ? state.readerPageStart
        : currentScrollToReaderOffset();
  }

  state.readerDisplayMode = nextMode;

  if (options.persist !== false) {
    setViewerPreference(READER_DISPLAY_MODE_KEY, nextMode);
  }

  syncReaderModeButtons();

  if (!els.readerPanel) return;

  const perfBreakdown = options.perfBreakdown && typeof options.perfBreakdown === "object"
    ? options.perfBreakdown
    : null;
  const modeSetupStartedAt = perfBreakdown ? performance.now() : 0;

  const pageActive = nextMode === "page";
  els.readerPanel.classList.toggle(
    "reader-page-mode",
    pageActive
  );
  if (els.readerPositionStatus) {
    els.readerPositionStatus.hidden = pageActive;
  }

  const deferPageBodyHide = Boolean(
    pageActive &&
    options.initialLayout === true &&
    els.readerLoadingOverlay
  );

  if (els.readerBody && !deferPageBodyHide) {
    els.readerBody.hidden = pageActive;
    els.readerBody.style.display = pageActive ? "none" : "";
  }

  if (els.readerContent) {
    els.readerContent.hidden = pageActive;
    els.readerContent.style.display = pageActive ? "none" : "";
    // Initial page opens keep the scroll body visibility-hidden to prevent a
    // first-paint flash. Switching/starting in scroll mode must explicitly
    // restore visibility.
    if (!pageActive) {
      els.readerContent.style.visibility = "";
    }
  }

  if (els.readerPageViewport) {
    els.readerPageViewport.hidden = !pageActive;
    els.readerPageViewport.style.display = pageActive ? "grid" : "none";
  }

  if (perfBreakdown) {
    perfBreakdown.modeSetup = performance.now() - modeSetupStartedAt;
  }

  if (pageActive) {
    els.readerPanel.scrollTop = 0;
    setReaderCompactActive(false);
    els.readerScrollTop?.classList.remove("visible");

    // 본문 스크롤 화면이 한 프레임 노출되지 않도록, page viewport를
    // 활성화한 같은 렌더 사이클에서 첫 페이지를 먼저 만든다.
    resizeReaderPageViewport();
    renderReaderPageAt(positionOffset, {
      navigated: Boolean(options.navigated),
    });

    await nextFrame();
    resizeReaderPageViewport();
    renderReaderPageAt(positionOffset, {
      navigated: Boolean(options.navigated),
    });

    // 첫 진입에서는 로딩 커버를 유지한 상태로 페이지를 먼저 완성한다.
    // 스크롤 본문이 숨겨지고 페이지 뷰가 준비된 다음 같은 프레임에서
    // 커버를 제거해야 스크롤 화면이 순간적으로 비치지 않는다.
    if (deferPageBodyHide && els.readerBody) {
      els.readerBody.hidden = true;
      els.readerBody.style.display = "none";
    }

    if (els.readerLoadingOverlay) {
      els.readerLoadingOverlay.remove();
      els.readerLoadingOverlay = null;
    }
    return;
  }

  if (els.readerContent) {
    els.readerContent.hidden = false;
  }

  const paintWaitStartedAt = perfBreakdown ? performance.now() : 0;
  await nextFrame();
  if (perfBreakdown) {
    perfBreakdown.paintWait = performance.now() - paintWaitStartedAt;
  }

  if (previousMode === "page" || Number.isFinite(options.offset)) {
    const offsetRestoreStartedAt = perfBreakdown ? performance.now() : 0;
    if (options.initialLayout === true) {
      // openReader already keeps saving suspended while the initial content
      // layout is prepared. Do not schedule a delayed 0% save here.
      await syncScrollReaderToOffset(positionOffset, {
        releaseProgressSave: false,
      });
    } else {
      temporarilySuspendProgressSave(700);
      await syncScrollReaderToOffset(positionOffset);
    }
    if (perfBreakdown) {
      perfBreakdown.offsetRestore = performance.now() - offsetRestoreStartedAt;
    }
  }

  updateReaderPositionStatus();
}

function animateReaderPageTurn(direction) {
  if (!els.readerPageViewport) return;

  const className =
    direction < 0 ? "page-turn-back" : "page-turn-forward";

  window.clearTimeout(state.readerPageAnimationTimer);
  els.readerPageViewport.classList.remove(
    "page-turn-forward",
    "page-turn-back"
  );

  // Force a style flush so repeated taps replay the animation.
  void els.readerPageViewport.offsetWidth;
  els.readerPageViewport.classList.add(className);

  state.readerPageAnimationTimer = window.setTimeout(() => {
    els.readerPageViewport?.classList.remove(className);
    state.readerPageAnimationTimer = 0;
  }, 190);
}

async function turnReaderPage(direction) {
  if (
    state.readerDisplayMode !== "page" ||
    !state.readerText
  ) return;

  // Page mode should enter the same compact reading state for every content
  // type on the first real page navigation. Measure the page viewport only
  // after the compact header has reached its final layout. Keeping the old
  // expanded-header height for one turn made the first compact page end a few
  // pixels higher/lower than every page rendered after the next navigation.
  if (!readerCompactActive && els.readerPageViewport) {
    setReaderCompactActive(true);
    await nextFrame();
    await nextFrame();
    resizeReaderPageViewport();
  }

  if (direction > 0) {
    if (state.readerPageEnd >= getReaderTextLength()) return;

    renderReaderPageAt(state.readerPageEnd, {
      navigated: true,
    });
    animateReaderPageTurn(1);
  } else {
    if (state.readerPageStart <= 0) return;

    const previousStart = findReaderPreviousPageStart(
      state.readerPageStart
    );

    renderReaderPageAt(previousStart, {
      navigated: true,
    });
    animateReaderPageTurn(-1);
  }

  const saved = saveReaderProgress();
  const item = state.activeReaderItem;

  if (
    saved &&
    item &&
    state.user &&
    shouldSyncProgressNow(item.id, saved)
  ) {
    persistProgress(item, saved);
  }
}

function lockReaderScroll() {
  els.readerPanel?.classList.add("reader-loading-locked");
}

function unlockReaderScroll() {
  els.readerPanel?.classList.remove("reader-loading-locked");
}

function resetReaderSearchUi({ close = true } = {}) {
  state.readerSearchMatches = [];
  state.readerSearchPage = 0;
  state.readerSearchQuery = "";
  if (els.readerSearchInput) els.readerSearchInput.value = "";
  if (els.readerSearchResult) els.readerSearchResult.textContent = "검색어를 입력해 주세요.";
  if (els.readerSearchRows) els.readerSearchRows.replaceChildren();
  if (els.readerSearchResults) els.readerSearchResults.hidden = true;
  if (els.readerSearchPager) els.readerSearchPager.hidden = true;
  if (close && els.readerSearchModal && !els.readerSearchModal.hidden) {
    closeModal(els.readerSearchModal);
  }
}

const READER_SEARCH_PAGE_SIZE = 50;
const READER_SEARCH_CONTEXT_CHARS = 30;

function renderReaderSearchResults() {
  if (!els.readerSearchRows || !els.readerSearchResults) return;

  const matches = Array.isArray(state.readerSearchMatches) ? state.readerSearchMatches : [];
  const text = String(state.readerText || "");
  const query = String(state.readerSearchQuery || "");
  els.readerSearchRows.replaceChildren();

  if (!matches.length || !query) {
    els.readerSearchResults.hidden = true;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(matches.length / READER_SEARCH_PAGE_SIZE));
  state.readerSearchPage = Math.max(0, Math.min(totalPages - 1, Number(state.readerSearchPage) || 0));
  const from = state.readerSearchPage * READER_SEARCH_PAGE_SIZE;
  const pageMatches = matches.slice(from, from + READER_SEARCH_PAGE_SIZE);
  const textLength = Math.max(1, text.length);

  pageMatches.forEach((offset, localIndex) => {
    const beforeStart = Math.max(0, offset - READER_SEARCH_CONTEXT_CHARS);
    const afterEnd = Math.min(text.length, offset + query.length + READER_SEARCH_CONTEXT_CHARS);
    const before = text.slice(beforeStart, offset).replace(/\s+/g, " ");
    const hit = text.slice(offset, offset + query.length).replace(/\s+/g, " ");
    const after = text.slice(offset + query.length, afterEnd).replace(/\s+/g, " ");
    const percent = Math.max(0, Math.min(100, (offset / textLength) * 100));

    const button = document.createElement("button");
    button.type = "button";
    button.className = "reader-search-row";
    button.dataset.readerSearchOffset = String(offset);
    button.setAttribute("aria-label", `${from + localIndex + 1}번째 검색 결과, ${percent.toFixed(1)}% 위치로 이동`);

    const position = document.createElement("span");
    position.className = "reader-search-row-position";
    position.textContent = `${percent.toFixed(1)}%`;

    const context = document.createElement("span");
    context.className = "reader-search-row-context";
    const beforeNode = document.createTextNode(`${beforeStart > 0 ? "…" : ""}${before}`);
    const mark = document.createElement("mark");
    mark.textContent = hit;
    const afterNode = document.createTextNode(`${after}${afterEnd < text.length ? "…" : ""}`);
    context.append(beforeNode, mark, afterNode);

    button.append(position, context);
    els.readerSearchRows.append(button);
  });

  els.readerSearchResults.hidden = false;
  if (els.readerSearchPager) els.readerSearchPager.hidden = totalPages <= 1;
  if (els.readerSearchPageStatus) {
    els.readerSearchPageStatus.textContent = `${state.readerSearchPage + 1} / ${totalPages}`;
  }
  if (els.readerSearchPrevPage) els.readerSearchPrevPage.disabled = state.readerSearchPage <= 0;
  if (els.readerSearchNextPage) els.readerSearchNextPage.disabled = state.readerSearchPage >= totalPages - 1;
}

function runReaderSearchCount() {
  if (!els.readerSearchInput || !els.readerSearchResult) return;

  const query = String(els.readerSearchInput.value || "").trim();
  if (!query) {
    els.readerSearchResult.textContent = "검색어를 입력해 주세요.";
    state.readerSearchMatches = [];
    renderReaderSearchResults();
    return;
  }

  const text = String(state.readerText || "");
  if (!text) {
    els.readerSearchResult.textContent = "검색할 본문이 없습니다.";
    state.readerSearchMatches = [];
    renderReaderSearchResults();
    return;
  }

  const matches = [];
  let fromIndex = 0;
  while (fromIndex <= text.length - query.length) {
    const found = text.indexOf(query, fromIndex);
    if (found < 0) break;
    matches.push(found);
    fromIndex = found + Math.max(1, query.length);
  }

  state.readerSearchQuery = query;
  state.readerSearchMatches = matches;
  state.readerSearchPage = 0;
  els.readerSearchResult.textContent = matches.length > 0
    ? `총 ${matches.length.toLocaleString("ko-KR")}건 · 결과를 누르면 해당 위치로 이동합니다.`
    : "검색 결과가 없습니다.";
  renderReaderSearchResults();
}

async function moveReaderToSearchOffset(offset) {
  const safeOffset = clampReaderTextOffset(offset);
  closeModal(els.readerSearchModal);

  if (state.readerDisplayMode === "page") {
    // 검색 결과는 페이지 맨 위가 아니라 현재 페이지의 중앙 부근에 보이도록
    // 검색 지점부터 한 페이지에 들어가는 문자량을 기준으로 시작점을 앞당긴다.
    const forwardEnd = findReaderPageEnd(safeOffset);
    const forwardChars = Math.max(1, forwardEnd - safeOffset);
    const centeredStart = clampReaderTextOffset(
      safeOffset - Math.floor(forwardChars / 2)
    );
    renderReaderPageAt(centeredStart, { navigated: true });
    const saved = saveReaderProgress();
    const item = state.activeReaderItem;
    if (saved && item && state.user && shouldSyncProgressNow(item.id, saved)) {
      persistProgress(item, saved);
    }
    return;
  }

  await scrollReaderToTextOffset(safeOffset, { viewportRatio: 0.5 });
}

function showReaderLoading(item) {
  const isLarge = isLargeReaderFile(item);
  resetLargeReaderState();
  resetReaderPageState();
  state.readerText = "";
  resetReaderSearchUi();
  if (els.readerPositionStatus) {
    els.readerPositionStatus.hidden = true;
    els.readerPositionStatus.textContent = "1 / 1";
  }
  lockReaderScroll();

  els.readerBody.innerHTML = `
    <div id="readerRenderShell" class="reader-render-shell">
      <div id="readerContent" class="reader-content" aria-live="off"></div>

      <div id="readerLoadingOverlay" class="reader-loading-overlay reader-pending-overlay">
        <div class="reader-loading rich-loading reader-pending-loading" role="status" aria-live="polite">
          <div class="reader-pending-head">
            <span class="reader-pending-spinner" aria-hidden="true"></span>
            <strong class="reader-pending-label">PENDING</strong>
            <span id="readerProgressLabel" class="reader-progress-label">4%</span>
          </div>
          <div class="loading-copy">
            <strong id="readerLoadingTitle">본문을 불러오는 중…</strong>
            <span id="readerLoadingText">${
              isLarge
                ? "긴 파일입니다. 본문을 여러 단계로 나누어 준비합니다."
                : "파일을 준비하고 있습니다."
            }</span>
          </div>
          <div class="reader-progress" aria-hidden="true">
            <span id="readerProgressBar"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  els.readerRenderShell = document.getElementById("readerRenderShell");
  els.readerContent = document.getElementById("readerContent");

  // When the saved preference is page mode, the scroll DOM still needs to be
  // laid out for existing measurement/compatibility code, but it must never be
  // visually exposed before the first page is ready. visibility:hidden keeps
  // dimensions intact unlike display:none.
  const openingInPageMode =
    isReaderPageModeEligible(item) &&
    getPreferredReaderDisplayMode() === "page";
  if (els.readerContent) {
    els.readerContent.style.visibility = openingInPageMode ? "hidden" : "";
  }

  if (els.readerPageViewport) {
    els.readerPageViewport.hidden = true;
    els.readerPageViewport.style.display = "none";
  }
  els.readerLoadingOverlay = document.getElementById("readerLoadingOverlay");
  els.readerLoadingTitle = document.getElementById("readerLoadingTitle");
  els.readerLoadingText = document.getElementById("readerLoadingText");
  els.readerProgressBar = document.getElementById("readerProgressBar");
  els.readerProgressLabel = document.getElementById("readerProgressLabel");

  const pendingOverlay = els.readerLoadingOverlay;
  window.setTimeout(() => {
    if (pendingOverlay?.isConnected && pendingOverlay === els.readerLoadingOverlay) {
      pendingOverlay.classList.add("is-visible");
    }
  }, 180);

  setReaderLoadingProgress(4);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function dismissReaderLoadingOverlay(renderToken) {
  const overlay = els.readerLoadingOverlay;
  const detail = { frameWait: 0, transition: 0, remove: 0 };
  if (!overlay) return detail;

  // v8.86에서 제거한 고정 hold 대신 실제 남아 있는 대기만 분리 측정한다.
  const frameStartedAt = performance.now();
  await nextFrame();
  detail.frameWait = performance.now() - frameStartedAt;

  if (
    renderToken !== state.readerRenderToken ||
    overlay !== els.readerLoadingOverlay ||
    !overlay.isConnected
  ) {
    return detail;
  }

  const wasVisible = overlay.classList.contains("is-visible");
  overlay.classList.add("done");

  if (!wasVisible) {
    const removeStartedAt = performance.now();
    overlay.remove();
    if (overlay === els.readerLoadingOverlay) {
      els.readerLoadingOverlay = null;
    }
    detail.remove = performance.now() - removeStartedAt;
    return detail;
  }

  const transitionStartedAt = performance.now();
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      overlay.removeEventListener("transitionend", onTransitionEnd);
      resolve();
    };
    const onTransitionEnd = (event) => {
      if (event.target === overlay && event.propertyName === "opacity") {
        finish();
      }
    };

    overlay.addEventListener("transitionend", onTransitionEnd);
    window.setTimeout(finish, 220);
  });
  detail.transition = performance.now() - transitionStartedAt;

  const removeStartedAt = performance.now();
  if (overlay.isConnected) overlay.remove();
  if (overlay === els.readerLoadingOverlay) {
    els.readerLoadingOverlay = null;
  }
  detail.remove = performance.now() - removeStartedAt;
  return detail;
}

async function collectResponseText(response, renderToken) {
  const totalBytes =
    Number(response.headers.get("x-content-bytes")) ||
    Number(response.headers.get("content-length")) ||
    0;

  if (!response.body?.getReader) {
    const text = await response.text();

    if (renderToken !== state.readerRenderToken) return null;

    setReaderLoadingProgress(
      62,
      "본문을 받았습니다.",
      "이제 화면에 읽기 좋은 형태로 배치하고 있습니다."
    );

    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks = [];

  let received = 0;
  let lastPaintAt = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (renderToken !== state.readerRenderToken) {
      try { await reader.cancel(); } catch {}
      return null;
    }

    received += value.byteLength;
    chunks.push(decoder.decode(value, { stream: true }));

    const now = performance.now();

    if (now - lastPaintAt > 45) {
      const ratio = totalBytes > 0
        ? Math.min(1, received / totalBytes)
        : Math.min(.96, .18 + received / 2500000);

      setReaderLoadingProgress(
        10 + ratio * 52,
        "본문을 불러오는 중…",
        totalBytes > 0
          ? "파일을 순서대로 받고 있습니다."
          : "긴 파일을 순서대로 받고 있습니다."
      );

      lastPaintAt = now;
      await (document.hidden ? nextTask() : nextFrame());
    }
  }

  const tail = decoder.decode();
  if (tail) chunks.push(tail);

  if (renderToken !== state.readerRenderToken) return null;

  setReaderLoadingProgress(
    63,
    "본문 다운로드 완료",
    "화면이 멈추지 않도록 본문을 나누어 배치합니다."
  );

  await nextFrame();

  return chunks.join("");
}



const LARGE_READER_CHUNK_CHARS = 180000;
const SAFARI_LARGE_READER_CHUNK_CHARS = 70000;

function getLargeReaderChunkChars() {
  return IS_SAFARI_READER
    ? SAFARI_LARGE_READER_CHUNK_CHARS
    : LARGE_READER_CHUNK_CHARS;
}

function resetLargeReaderState() {
  state.largeReaderChunks = null;
  state.largeReaderRenderedCount = 0;
  state.largeReaderRendering = false;
}

function splitLargeReaderText(text, requestedChunkChars = getLargeReaderChunkChars()) {
  const chunks = [];
  let offset = 0;

  const chunkChars = Math.max(
    1,
    Number(requestedChunkChars) || getLargeReaderChunkChars()
  );

  while (offset < text.length) {
    let end = Math.min(text.length, offset + chunkChars);

    if (end < text.length) {
      const nextBreak = text.indexOf("\n", end);
      if (nextBreak >= 0 && nextBreak - end <= 2500) {
        end = nextBreak + 1;
      }
    }

    chunks.push(text.slice(offset, end));
    offset = end;
  }

  return chunks.length ? chunks : [""];
}

function appendLargeReaderChunk(index) {
  if (!els.readerContent || !state.largeReaderChunks) return;

  const text = state.largeReaderChunks[index];
  if (typeof text !== "string") return;

  const section = document.createElement("section");
  section.className = "reader-virtual-chunk";
  section.dataset.readerChunkIndex = String(index);
  renderReaderIndentedText(section, text);
  els.readerContent.appendChild(section);

  if (IS_SAFARI_READER) {
    // Safari occasionally delays painting very large text nodes inside a
    // nested overflow scroller. Reading offsetHeight forces the new chunk
    // into the current layout without changing visible scroll position.
    void section.offsetHeight;
  }
}

async function renderLargeReaderThrough(targetIndex, renderToken) {
  if (
    !state.largeReaderChunks ||
    renderToken !== state.readerRenderToken
  ) {
    return;
  }

  // If another render pass is already appending chunks, wait for it instead
  // of returning immediately. Resume used to race with background pre-render
  // and could fail because the requested chunk never existed in the DOM.
  if (state.largeReaderRendering) {
    const startedAt = performance.now();

    while (
      state.largeReaderRendering &&
      performance.now() - startedAt < 5000
    ) {
      if (renderToken !== state.readerRenderToken) return;
      await nextFrame();
    }
  }

  if (state.largeReaderRendering) return;

  const finalIndex = Math.min(
    state.largeReaderChunks.length - 1,
    Math.max(0, targetIndex)
  );

  if (state.largeReaderRenderedCount > finalIndex) return;

  state.largeReaderRendering = true;

  try {
    while (state.largeReaderRenderedCount <= finalIndex) {
      if (renderToken !== state.readerRenderToken) return;

      appendLargeReaderChunk(state.largeReaderRenderedCount);
      state.largeReaderRenderedCount += 1;

      await nextFrame();
    }
  } finally {
    state.largeReaderRendering = false;
  }
}

async function ensureLargeReaderChunkRendered(
  targetIndex,
  renderToken
) {
  if (!state.largeReaderChunks) return false;

  const safeTarget = Math.max(
    0,
    Math.min(
      state.largeReaderChunks.length - 1,
      Number(targetIndex) || 0
    )
  );

  const startedAt = performance.now();

  while (performance.now() - startedAt < 8000) {
    if (renderToken !== state.readerRenderToken) return false;

    if (state.largeReaderRenderedCount > safeTarget) {
      const targetChunk = els.readerContent?.querySelector(
        `.reader-virtual-chunk[data-reader-chunk-index="${safeTarget}"]`
      );
      if (targetChunk) return true;
    }

    await renderLargeReaderThrough(safeTarget, renderToken);

    if (state.largeReaderRenderedCount > safeTarget) {
      const targetChunk = els.readerContent?.querySelector(
        `.reader-virtual-chunk[data-reader-chunk-index="${safeTarget}"]`
      );
      if (targetChunk) return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 40));
    await nextFrame();
  }

  return false;
}

async function maybeRenderMoreLargeReader() {
  if (
    !state.largeReaderChunks ||
    state.largeReaderRendering ||
    !els.readerPanel ||
    state.largeReaderRenderedCount >= state.largeReaderChunks.length
  ) {
    return;
  }

  const distanceToBottom =
    els.readerPanel.scrollHeight -
    els.readerPanel.scrollTop -
    els.readerPanel.clientHeight;

  const renderAheadDistance = IS_SAFARI_READER ? 5200 : 1500;
  if (distanceToBottom > renderAheadDistance) return;

  const renderAheadChunks = IS_SAFARI_READER ? 2 : 1;
  const target = Math.min(
    state.largeReaderChunks.length - 1,
    state.largeReaderRenderedCount + renderAheadChunks
  );

  await renderLargeReaderThrough(target, state.readerRenderToken);
}

function getReaderChunkTextNodes(section) {
  if (!section) return [];
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

function getReaderChunkTextLength(section) {
  return getReaderChunkTextNodes(section).reduce(
    (total, node) => total + (node.data?.length || 0),
    0
  );
}

function getReaderChunkTextPosition(section, charOffset) {
  const nodes = getReaderChunkTextNodes(section);
  if (!nodes.length) return null;

  const totalLength = nodes.reduce(
    (total, node) => total + (node.data?.length || 0),
    0
  );
  let remaining = Math.max(
    0,
    Math.min(totalLength, Math.floor(Number(charOffset) || 0))
  );

  for (const node of nodes) {
    const length = node.data?.length || 0;
    if (remaining <= length) {
      return { node, offset: remaining, totalLength };
    }
    remaining -= length;
  }

  const node = nodes[nodes.length - 1];
  return { node, offset: node.data?.length || 0, totalLength };
}

function getReaderChunkTextY(section, charOffset) {
  const position = getReaderChunkTextPosition(section, charOffset);
  if (!position?.node) return null;

  const textNode = position.node;
  const length = textNode.data?.length || 0;
  const safeOffset = Math.max(0, Math.min(length, position.offset));
  const range = document.createRange();

  try {
    if (length <= 0) {
      const rect = section.getBoundingClientRect();
      return rect.top;
    }

    const start = Math.min(safeOffset, length - 1);
    const end = Math.min(length, start + 1);
    range.setStart(textNode, start);
    range.setEnd(textNode, end);

    const rect = range.getBoundingClientRect();
    return Number.isFinite(rect.top) ? rect.top : null;
  } catch {
    return null;
  } finally {
    range.detach?.();
  }
}


function getReaderResumeTopOffset(panel = els.readerPanel) {
  if (!panel) return 64;
  // 기존보다 약간 위쪽에 문맥이 보이도록 하되 기기별 높이 차이는 작게 흡수한다.
  return Math.min(76, Math.max(56, panel.clientHeight * 0.065));
}

async function scrollReaderTextNodeIntoView(textNode, charOffset, options = {}) {
  if (!els.readerPanel || !textNode) return false;

  const panel = els.readerPanel;
  const length = textNode.data?.length || 0;
  const safeOffset = Math.max(
    0,
    Math.min(length, Math.floor(Number(charOffset) || 0))
  );
  const range = document.createRange();
  const previousInlineScrollBehavior = panel.style.getPropertyValue("scroll-behavior");
  const previousInlineScrollBehaviorPriority = panel.style.getPropertyPriority("scroll-behavior");

  state.suspendReaderProgressSave = true;

  try {
    if (length <= 0) return false;

    const start = Math.min(safeOffset, length - 1);
    const end = Math.min(length, start + 1);
    range.setStart(textNode, start);
    range.setEnd(textNode, end);

    // Reader resume must be an immediate internal-panel move. A CSS
    // `scroll-behavior:smooth` rule can otherwise keep scrollTop near zero
    // for several frames and make the resume verification fail.
    panel.style.setProperty("scroll-behavior", "auto", "important");

    let reached = false;

    for (let pass = 0; pass < 6; pass += 1) {
      const panelRect = panel.getBoundingClientRect();
      const targetRect = range.getBoundingClientRect();
      const margin = getReaderResumeTopOffset(panel);
      const viewportRatio = Number(options.viewportRatio);
      const desiredViewportY = Number.isFinite(viewportRatio)
        ? panelRect.top + (panel.clientHeight * Math.max(0.12, Math.min(0.88, viewportRatio)))
        : panelRect.top + margin;
      const delta = targetRect.top - desiredViewportY;
      const tolerance = Math.max(18, panel.clientHeight * 0.018);

      // Verify using the actual text line position, not only scrollTop.
      if (Math.abs(delta) <= tolerance) {
        reached = true;
        break;
      }

      const maxScroll = Math.max(
        0,
        panel.scrollHeight - panel.clientHeight
      );
      const currentTop = Math.max(0, panel.scrollTop);
      const nextTop = Math.max(
        0,
        Math.min(maxScroll, currentTop + delta)
      );

      panel.scrollTop = nextTop;
      try {
        panel.scrollTo(0, nextTop);
      } catch {
        try {
          panel.scrollTo({ top: nextTop, left: 0, behavior: "auto" });
        } catch {}
      }

      await nextFrame();
      await nextFrame();

      // Some mobile browsers settle a very large nested scroll one task later.
      if (pass < 5) {
        await new Promise((resolve) =>
          setTimeout(resolve, pass === 0 ? 35 : 70)
        );
      }
    }

    if (!reached) {
      const panelRect = panel.getBoundingClientRect();
      const targetRect = range.getBoundingClientRect();
      const margin = getReaderResumeTopOffset(panel);
      const viewportRatio = Number(options.viewportRatio);
      const desiredViewportY = Number.isFinite(viewportRatio)
        ? panelRect.top + (panel.clientHeight * Math.max(0.12, Math.min(0.88, viewportRatio)))
        : panelRect.top + margin;
      const tolerance = Math.max(26, panel.clientHeight * 0.03);
      reached = Math.abs(targetRect.top - desiredViewportY) <= tolerance;
    }

    updateReaderScrollUi();
    return reached;
  } catch (error) {
    console.warn("이어보기 직접 위치 이동 실패", error);
    return false;
  } finally {
    range.detach?.();

    if (previousInlineScrollBehavior) {
      panel.style.setProperty(
        "scroll-behavior",
        previousInlineScrollBehavior,
        previousInlineScrollBehaviorPriority
      );
    } else {
      panel.style.removeProperty("scroll-behavior");
    }

    if (options.releaseProgressSave !== false) {
      const releaseAfter = Number(options.releaseAfter || 520);
      window.setTimeout(() => {
        state.suspendReaderProgressSave = false;
        const saved = saveReaderProgress();
        const item = state.activeReaderItem;
        if (saved && state.user && item && shouldPersistProgress(item.id, saved)) {
          persistProgress(item, saved);
        }
      }, releaseAfter);
    }
  }
}

async function scrollReaderToTextOffset(offset, options = {}) {
  if (!els.readerPanel || !els.readerContent) return false;

  const safeOffset = clampReaderTextOffset(offset);
  if (safeOffset <= 0) {
    return jumpReaderPanelTo(0, options);
  }

  const item = state.activeReaderItem;
  if (item && isLargeReaderFile(item) && Array.isArray(state.largeReaderChunks)) {
    const position = readerOffsetToLargePosition(safeOffset);
    if (!position) return false;

    const ready = await ensureLargeReaderChunkRendered(
      position.index,
      state.readerRenderToken
    );
    if (!ready) return false;

    const section = els.readerContent.querySelector(
      `.reader-virtual-chunk[data-reader-chunk-index="${position.index}"]`
    );
    const chunkLength = getReaderChunkTextLength(section);
    const charOffset = Math.round(
      chunkLength * Math.max(0, Math.min(1, Number(position.ratio) || 0))
    );
    const target = getReaderChunkTextPosition(section, charOffset);
    if (!target?.node) return false;

    return scrollReaderTextNodeIntoView(target.node, target.offset, options);
  }

  const walker = document.createTreeWalker(
    els.readerContent,
    NodeFilter.SHOW_TEXT
  );
  let remaining = safeOffset;
  let node = walker.nextNode();
  let lastTextNode = null;

  while (node) {
    lastTextNode = node;
    const length = node.data?.length || 0;
    if (remaining <= length) {
      return scrollReaderTextNodeIntoView(node, remaining, options);
    }
    remaining -= length;
    node = walker.nextNode();
  }

  if (lastTextNode) {
    return scrollReaderTextNodeIntoView(
      lastTextNode,
      lastTextNode.data?.length || 0,
      options
    );
  }

  return false;
}

function getReaderChunkCharOffsetAtY(section, targetY) {
  const length = getReaderChunkTextLength(section);
  if (!length) return 0;

  if (length <= 1) return 0;

  let low = 0;
  let high = length - 1;
  let best = 0;

  // Find the last character whose rendered line starts at or above targetY.
  // This converts the real scroller coordinate to a text coordinate instead
  // of assuming pixel-height ratio === character ratio.
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const y = getReaderChunkTextY(section, mid);

    if (!Number.isFinite(y)) break;

    if (y <= targetY) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(0, Math.min(length, best));
}

function getLargeReaderTargetScrollTop(section, chunkRatio = 0) {
  if (!section || !els.readerPanel) return 0;

  const panelRect = els.readerPanel.getBoundingClientRect();
  const length = getReaderChunkTextLength(section);
  const ratio = Math.max(0, Math.min(1, Number(chunkRatio) || 0));
  const charOffset = Math.round(length * ratio);
  const targetY = getReaderChunkTextY(section, charOffset);

  if (Number.isFinite(targetY)) {
    return Math.max(
      0,
      els.readerPanel.scrollTop +
      targetY - panelRect.top - getReaderResumeTopOffset(els.readerPanel)
    );
  }

  // Fallback for unusual browser Range failures. Importantly this still
  // converts from viewport coordinates into readerPanel scroll coordinates.
  const sectionRect = section.getBoundingClientRect();
  return Math.max(
    0,
    els.readerPanel.scrollTop +
      sectionRect.top - panelRect.top +
      sectionRect.height * ratio -
      getReaderResumeTopOffset(els.readerPanel)
  );
}

function getLargeReaderPosition() {
  if (!state.largeReaderChunks || !els.readerPanel || !els.readerContent) {
    return null;
  }

  const sections = Array.from(
    els.readerContent.querySelectorAll(".reader-virtual-chunk")
  );

  if (!sections.length) return null;

  const panelScrollTop = Math.max(0, els.readerPanel.scrollTop);

  if (panelScrollTop < READER_MIN_MEANINGFUL_SCROLL_PX) {
    return { index: 0, ratio: 0, percent: 0, textOffset: 0 };
  }

  const panelRect = els.readerPanel.getBoundingClientRect();
  const targetY = panelRect.top + 92;
  let current = sections[0];

  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    if (rect.top <= targetY) {
      current = section;
    } else {
      break;
    }
  }

  const index = Number(current.dataset.readerChunkIndex || 0);
  const chunkLength = getReaderChunkTextLength(current);
  const charOffset = getReaderChunkCharOffsetAtY(current, targetY);
  const ratio = chunkLength > 0
    ? Math.max(0, Math.min(1, charOffset / chunkLength))
    : 0;

  const textOffset = largePositionToReaderOffset(index, ratio);
  const textLength = Math.max(1, getReaderTextLength());
  let percent = normalizeReaderProgressPercent(
    (textOffset / textLength) * 100
  );

  if (percent <= 0) percent = 0.1;

  return { index, ratio, percent, textOffset };
}

async function waitForReaderScrollReady(renderToken, options = {}) {
  if (!els.readerPanel || !els.readerContent) return false;

  const maxWaitMs = Number(options.maxWaitMs || 9000);
  const stableForMs = Number(options.stableForMs || 700);
  const startedAt = performance.now();

  let lastScrollHeight = -1;
  let lastContentHeight = -1;
  let stableSince = 0;

  while (performance.now() - startedAt < maxWaitMs) {
    if (renderToken !== state.readerRenderToken) return false;

    // 강제로 레이아웃 값을 읽어 브라우저가 긴 본문의 높이를 계산하게 한다.
    const contentHeight = els.readerContent.getBoundingClientRect().height;
    const scrollHeight = els.readerPanel.scrollHeight;
    const clientHeight = els.readerPanel.clientHeight;

    const heightChanged =
      Math.abs(scrollHeight - lastScrollHeight) > 2 ||
      Math.abs(contentHeight - lastContentHeight) > 2;

    const hasOverflow = scrollHeight > clientHeight + 8;

    if (heightChanged) {
      lastScrollHeight = scrollHeight;
      lastContentHeight = contentHeight;
      stableSince = performance.now();
    } else if (!stableSince) {
      stableSince = performance.now();
    }

    const stableLongEnough =
      performance.now() - stableSince >= stableForMs;

    if (hasOverflow && stableLongEnough) {
      return true;
    }

    setReaderLoadingProgress(
      99,
      "스크롤 준비 중…",
      "긴 본문의 높이와 스크롤 영역을 계산하고 있습니다."
    );

    await new Promise((resolve) => setTimeout(resolve, 90));
    await nextFrame();
  }

  // 너무 오래 걸리는 기기에서도 영구 대기하지 않도록 최대 대기 후 진행.
  return (
    els.readerPanel.scrollHeight >
    els.readerPanel.clientHeight + 8
  );
}

async function renderLongText(text, renderToken) {
  if (!els.readerContent) {
    return { rendered: false, breakdown: {} };
  }

  const breakdown = {
    domSetup: 0,
    textInsert: 0,
    settle: 0,
    overlay: 0,
  };
  const result = (rendered) => ({ rendered, breakdown });

  const setupStartedAt = performance.now();
  els.readerContent.textContent = "";
  resetLargeReaderState();

  const item = state.activeReaderItem;
  const isLarge = isLargeReaderFile(item);

  if (isLarge) {
    state.largeReaderChunks = splitLargeReaderText(text);
  }
  breakdown.domSetup = performance.now() - setupStartedAt;

  if (isLarge) {
    setReaderLoadingProgress(
      76,
      "첫 화면을 준비하는 중…",
      "긴 파일은 처음부터 전부 그리지 않고 읽는 만큼만 화면에 표시합니다."
    );

    const initialLastIndex = Math.min(
      state.largeReaderChunks.length - 1,
      IS_SAFARI_READER ? 2 : 1
    );

    const insertStartedAt = performance.now();
    await renderLargeReaderThrough(initialLastIndex, renderToken);
    breakdown.textInsert = performance.now() - insertStartedAt;

    if (renderToken !== state.readerRenderToken) return result(false);

    setReaderLoadingProgress(
      94,
      "스크롤 준비 중…",
      "첫 읽기 화면의 스크롤 영역을 준비하고 있습니다."
    );

    const settleStartedAt = performance.now();
    await nextFrame();
    void els.readerPanel.scrollHeight;
    await nextFrame();

    unlockReaderScroll();

    // 잠금을 푼 상태에서 실제 scrollbar가 먼저 나타나도록 기다린다.
    await nextFrame();
    await nextFrame();
    breakdown.settle = performance.now() - settleStartedAt;

    if (renderToken !== state.readerRenderToken) return result(false);

    setReaderLoadingProgress(
      100,
      "준비 완료",
      "이제 바로 읽을 수 있습니다. 아래로 읽으면 다음 내용이 자동으로 이어집니다."
    );

    // v8.88: keep the loading cover in place until the initial reader mode
    // and resume position are fully laid out. Dismissing it before that work
    // made the cover fade and the initial layout run serially, while also
    // exposing layout movement underneath. openReader dismisses the cover
    // after setReaderDisplayMode() completes.
    return result(true);
  }

  const totalChars = Math.max(1, text.length);
  const chunkSize = 60000;
  let offset = 0;
  const insertStartedAt = performance.now();

  while (offset < text.length) {
    if (renderToken !== state.readerRenderToken) return result(false);

    const end = Math.min(text.length, offset + chunkSize);
    const segment = document.createElement("span");
    segment.className = "reader-text-segment";
    renderReaderIndentedText(segment, text.slice(offset, end));
    els.readerContent.appendChild(segment);

    offset = end;

    setReaderLoadingProgress(
      64 + (offset / totalChars) * 31,
      "본문을 화면에 배치하는 중…",
      "거의 다 준비됐습니다."
    );

    await nextFrame();
  }
  breakdown.textInsert = performance.now() - insertStartedAt;

  if (renderToken !== state.readerRenderToken) return result(false);

  const settleStartedAt = performance.now();
  unlockReaderScroll();
  await nextFrame();
  breakdown.settle = performance.now() - settleStartedAt;

  setReaderLoadingProgress(
    100,
    "준비 완료",
    "이제 바로 읽을 수 있습니다."
  );

  // v8.88: the scroll loading cover is dismissed after the initial
  // mode/position layout so the fade runs only once the heavy first layout
  // work has settled. Page mode keeps its existing same-frame removal path.
  return result(true);
}

async function streamTextIntoReader(response, renderToken, beforeRenderPromise = null) {
  const downloadStartedAt = performance.now();
  const text = await collectResponseText(response, renderToken);
  const downloadMs = performance.now() - downloadStartedAt;

  if (text === null || renderToken !== state.readerRenderToken) {
    return { rendered: false, downloadMs, renderMs: 0 };
  }

  if (beforeRenderPromise) {
    try {
      await beforeRenderPromise;
    } catch (_) {}
    if (renderToken !== state.readerRenderToken) {
      return { rendered: false, downloadMs, renderMs: 0 };
    }
  }

  state.readerText = text;
  const renderStartedAt = performance.now();
  const renderResult = await renderLongText(text, renderToken);
  const renderMs = performance.now() - renderStartedAt;
  return {
    rendered: Boolean(renderResult?.rendered),
    downloadMs,
    renderMs,
    renderBreakdown: renderResult?.breakdown || {},
  };
}

function showResumePrompt(item, { actionsReady = true } = {}) {
  if (!els.readerResume) return;

  const saved = getReaderProgress(item?.id);

  if (
    !saved ||
    Number(saved.percent || 0) <= 0
  ) {
    state.readerResumeSaved = null;
    els.readerResume.hidden = true;
    return;
  }

  // Freeze the resume point shown to the user. Initial layout scroll events
  // must never be able to invalidate the button target before it is clicked.
  state.readerResumeSaved = { ...saved };

  els.readerResume.hidden = false;
  els.readerResume.dataset.itemId = item.id;

  if (els.readerResumeButton) els.readerResumeButton.disabled = !actionsReady;
  if (els.readerRestartButton) els.readerRestartButton.disabled = !actionsReady;

  if (els.readerResumeText) {
    els.readerResumeText.textContent =
      `${getReaderProgressDisplayPercent(saved.percent)}% 지점까지 읽었습니다.`;
  }
}


async function recordTxtDownload(item) {
  if (!state.user || !item || item.source === "postype") return;

  const existing = getUserLibraryEntry(item.id);
  if (existing?.downloadedAt) return;

  const downloadedAt = Date.now();

  updateUserLibraryEntry(item.id, {
    downloadedAt,
    updatedAt: downloadedAt,
  });

  // Update the mark immediately. The server write happens only on first
  // download for this logged-in user/item pair.
  render();

  try {
    await userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify({
        action: "download",
        fileId: item.id,
      }),
    });
  } catch (error) {
    console.warn("다운로드 기록 저장 실패", error);

    updateUserLibraryEntry(item.id, {
      downloadedAt: null,
    });
    render();
  }
}

function triggerItemDownload(item) {
  if (!item) return;

  const url = getDownloadUrl(item);
  if (!url) return;

  recordTxtDownload(item);

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function normalizeQuoteLocationSearchText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseQuoteMatchOffset(matches, preferredOffset = null) {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  if (preferredOffset == null || !Number.isFinite(Number(preferredOffset))) return null;
  const target = Number(preferredOffset);
  return [...matches].sort((a, b) =>
    Math.abs(a.startOffset - target) - Math.abs(b.startOffset - target)
  )[0];
}

function findQuoteTextOffsetInReader(rawNeedle, preferredOffset = null) {
  const text = String(state.readerText || "");
  const needle = String(rawNeedle || "");
  if (!text || !needle.trim()) return null;

  const directCandidates = [...new Set([needle, needle.replace(/\r\n?/g, "\n")])];
  for (const candidate of directCandidates) {
    const matches = [];
    let from = 0;
    while (matches.length < 20) {
      const direct = text.indexOf(candidate, from);
      if (direct < 0) break;
      matches.push({
        startOffset: direct,
        endOffset: direct + candidate.length,
        sourceText: text.slice(direct, direct + candidate.length),
      });
      from = direct + Math.max(1, candidate.length);
    }
    const chosen = chooseQuoteMatchOffset(matches, preferredOffset);
    if (chosen) return chosen;
    if (matches.length > 1) return null;
  }

  const normalizedNeedle = normalizeQuoteLocationSearchText(needle);
  if (!normalizedNeedle) return null;

  let normalizedText = "";
  const indexMap = [];
  let inWhitespace = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const cleaned = /[\u200B\u200C\u200D\u2060\uFEFF]/.test(char) ? "" : char;
    if (!cleaned) continue;
    if (/\s|\u00a0|\u3000/.test(cleaned)) {
      if (!inWhitespace) {
        normalizedText += " ";
        indexMap.push(index);
        inWhitespace = true;
      }
      continue;
    }
    normalizedText += cleaned;
    indexMap.push(index);
    inWhitespace = false;
  }

  const normalizedMatches = [];
  let from = 0;
  while (normalizedMatches.length < 20) {
    const matchIndex = normalizedText.indexOf(normalizedNeedle, from);
    if (matchIndex < 0 || !indexMap.length) break;
    const startOffset = indexMap[matchIndex] ?? 0;
    const lastNormalizedIndex = Math.min(
      indexMap.length - 1,
      matchIndex + normalizedNeedle.length - 1
    );
    const endOffset = Math.min(text.length, (indexMap[lastNormalizedIndex] ?? startOffset) + 1);
    normalizedMatches.push({
      startOffset,
      endOffset,
      sourceText: text.slice(startOffset, endOffset).slice(0, 1200),
    });
    from = matchIndex + Math.max(1, normalizedNeedle.length);
  }

  return chooseQuoteMatchOffset(normalizedMatches, preferredOffset);
}

function isSavedQuoteOffsetStillValid(jump) {
  if (jump?.startOffset == null) return false;
  const startOffset = Number(jump.startOffset);
  if (!Number.isFinite(startOffset) || startOffset < 0 || startOffset > getReaderTextLength()) return false;
  const sourceText = String(jump?.sourceText || "");
  if (!sourceText) return true;
  const endOffset = Number.isFinite(Number(jump?.endOffset))
    ? Math.max(startOffset, Number(jump.endOffset))
    : startOffset + sourceText.length;
  const current = String(state.readerText || "").slice(startOffset, endOffset);
  return normalizeQuoteLocationSearchText(current) === normalizeQuoteLocationSearchText(sourceText);
}

async function persistSavedQuoteLocation(quote, item, location) {
  if (!state.user || !quote?.id || !item?.id || !location) return;
  if (quote._locationSaving) return;
  quote._locationSaving = true;
  try {
    await userApi("/api/user/profile", {
      method: "POST",
      body: JSON.stringify({
        action: "quote_location_update",
        id: quote.id,
        workId: item.id,
        startOffset: location.startOffset,
        endOffset: location.endOffset,
        sourceText: location.sourceText || "",
      }),
    });
    quote.workId = String(item.id || "");
    quote.startOffset = Number(location.startOffset);
    quote.endOffset = Number(location.endOffset);
    quote.sourceText = String(location.sourceText || "");
  } catch (error) {
    console.warn("저장문장 위치 보정 저장 실패", error);
  } finally {
    quote._locationSaving = false;
  }
}

async function resolveSavedQuoteJumpLocation(quote, item) {
  if (!quote || !item || !state.readerText) return null;

  if (
    String(quote.workId || "") === String(item.id || "") &&
    isSavedQuoteOffsetStillValid(quote)
  ) {
    const startOffset = clampReaderTextOffset(quote.startOffset);
    const endOffset = Number.isFinite(Number(quote.endOffset))
      ? clampReaderTextOffset(Math.max(startOffset, Number(quote.endOffset)))
      : startOffset;
    return {
      startOffset,
      endOffset,
      sourceText: String(quote.sourceText || ""),
      repaired: false,
    };
  }

  const candidates = [quote.sourceText, quote.quoteText]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const preferredOffset = quote?._feedJump ? null : quote.startOffset;
    const found = findQuoteTextOffsetInReader(candidate, preferredOffset);
    if (!found) continue;
    const location = { ...found, repaired: true };
    if (!quote?._feedJump) persistSavedQuoteLocation(quote, item, location);
    return location;
  }

  return null;
}

function findSavedQuoteWorkCandidates(quote) {
  if (!quote) return [];
  if (quote.workId) {
    const direct = state.items.find((item) => String(item.id) === String(quote.workId));
    if (direct) return [direct];
  }

  const title = normalizeSearchText(quote.title);
  const author = normalizeSearchText(quote.author);
  return state.items.filter((item) =>
    normalizeSearchText(item.title) === title &&
    normalizeSearchText(item.author) === author
  );
}

function getSavedQuoteMoveButton(quote) {
  const candidates = findSavedQuoteWorkCandidates(quote).filter((item) => item?.source !== "postype");
  if (!candidates.length) return "";
  return `<button type="button" data-profile-quote-open="${quote.id}" ${quote._locationSaving ? "disabled" : ""}>이동</button>`;
}

async function openSavedQuoteLocation(quote) {
  const candidates = findSavedQuoteWorkCandidates(quote).filter((item) => item?.source !== "postype");
  if (!candidates.length) {
    window.alert("이 저장 문장의 원본 TXT 작품을 찾을 수 없습니다.");
    return;
  }
  if (candidates.length > 1) {
    window.alert("같은 제목과 작성자의 작품이 여러 개라 원문 위치를 안전하게 특정할 수 없습니다.");
    return;
  }

  const item = candidates[0];
  recordAnalyticsWorkOpen();
  hideProfilePage({ clearHistoryMarker: true });
  await openReader(item, { quoteJump: quote });
}

async function openReader(item, options = {}) {
  if (!item) return;
  closeReaderWorkShareMenu();

  if (!state.readerHistoryActive) {
    history.pushState(
      {
        ...(history.state || {}),
        rjsReaderOpen: true,
      },
      "",
      window.location.href
    );
    state.readerHistoryActive = true;
  }

  state.activeReaderItem = item;
  state.readerResumeSaved = null;
  state.suspendReaderProgressSave = true;
  const renderToken = ++state.readerRenderToken;

  // Decide the initial reader mode before any body content is rendered.
  // Previously page mode was selected only after the scroll DOM had already
  // been painted, which allowed a brief scroll-view flash on first open.
  const initialPreferredMode =
    isReaderPageModeEligible(item) &&
    getPreferredReaderDisplayMode() === "page"
      ? "page"
      : "scroll";
  state.readerDisplayMode = initialPreferredMode;

  document.body.classList.add("reader-open");
  mainHeaderCompactActive = false;
  mainHeaderCompactEnterScrollY = null;
  els.siteHeader?.classList.remove("compact-mode");
  els.pageScrollTop?.classList.remove("visible");
  els.readerOverlay.hidden = false;
  void syncReaderWakeLock();

  if (els.readerPanel) {
    els.readerPanel.scrollTop = 0;
    els.readerPanel.classList.toggle(
      "reader-page-mode",
      initialPreferredMode === "page"
    );
  }
  syncReaderModeButtons();

  readerCompactActive = false;
  window.cancelAnimationFrame(readerCompactFrame);
  readerCompactFrame = 0;
  els.readerPanel?.classList.remove("reader-compact");
  els.readerScrollTop?.classList.remove("visible");
  if (els.readerResume) els.readerResume.hidden = true;

  const pageEligible = isReaderPageModeEligible(item);


  els.readerCombination.textContent = item.combination || "";
  els.readerLength.textContent = item.lengthType || "";
  els.readerTitle.textContent = item.title || "제목 미상";
  els.readerAuthor.textContent = item.author || "작성자 미상";
  els.readerFileName.textContent = `원본 파일명: ${item.fileName || ""}`;

  state.readerLoadingStartedAt = performance.now();
  updateReaderBookmarkButton();
  updateReaderLikeButton();
  recordRecentView(item);
  showReaderLoading(item);

  // Show the saved resume notice as soon as the reader opens, before the
  // body fetch/render can unlock scrolling. The saved point is frozen here
  // while progress writes are still suspended, so an early user scroll can
  // never replace the existing resume target before the notice appears.
  // Keep the actions disabled until the text/layout is actually ready.
  if (!options?.quoteJump) {
    showResumePrompt(item, { actionsReady: false });
  }

  let waitingProgress = 5;
  const waitTimer = window.setInterval(() => {
    waitingProgress = Math.min(38, waitingProgress + Math.max(1, (40 - waitingProgress) * .08));
    setReaderLoadingProgress(
      waitingProgress,
      "본문을 불러오는 중…",
      isLargeReaderFile(item)
        ? "파일이 길어 준비에 조금 더 시간이 걸릴 수 있습니다."
        : "파일을 준비하고 있습니다."
    );
  }, 280);

  try {
    const readerFontReadyPromise = getSavedReaderFontFamily() === "kopubbatang"
      ? ensureKopubFont()
      : null;

    const params = new URLSearchParams({
      id: item.id,
      modified: item.modifiedTime || "unknown",
      raw: "1",
    });

    const contentHeaders = new Headers();
    const contentAuthToken = getAuthToken();
    if (state.user && contentAuthToken) {
      contentHeaders.set("authorization", `Bearer ${contentAuthToken}`);
    }

    const contentFetchOptions = { headers: contentHeaders };
    if (state.user && contentAuthToken) {
      // Logged-in opens must reach the server so the folded-in recent-view write
      // cannot be skipped by the browser's private 5-minute content cache.
      contentFetchOptions.cache = "no-store";
    }

    const fetchStartedAt = performance.now();
    await offlineBodyReady;
    const response = await fetch(`/api/content?${params.toString()}`, contentFetchOptions);
    const responseMs = performance.now() - fetchStartedAt;
    const contentBytes = Math.max(
      0,
      Number(response.headers.get("x-content-bytes")) ||
      Number(response.headers.get("content-length")) ||
      Number(item?.size || 0) ||
      0
    );
    const cacheHeader = response.headers.get("x-content-cached");
    const cacheStatus = cacheHeader === "1" ? "hit" : cacheHeader === "0" ? "miss" : "unknown";
    const readServerTimingHeader = (name) => Math.max(0, Number(response.headers.get(name)) || 0);
    const missServer = cacheStatus === "miss" ? {
      kvRead: readServerTimingHeader("x-content-server-kv-read-ms"),
      token: readServerTimingHeader("x-content-server-token-ms"),
      verify: readServerTimingHeader("x-content-server-verify-ms"),
      driveRequest: readServerTimingHeader("x-content-server-drive-request-ms"),
      driveDownload: readServerTimingHeader("x-content-server-drive-download-ms"),
      decode: readServerTimingHeader("x-content-server-decode-ms"),
      kvWrite: readServerTimingHeader("x-content-server-kv-write-ms"),
      total: readServerTimingHeader("x-content-server-total-ms"),
    } : null;

    window.clearInterval(waitTimer);

    if (!response.ok) {
      let message = "본문을 불러오지 못했습니다.";
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          message = data?.error || message;
        } else {
          message = (await response.text()) || message;
        }
      } catch {}
      throw new Error(message);
    }

    setReaderLoadingProgress(
      42,
      "본문을 받았습니다.",
      "긴 본문은 화면이 멈추지 않도록 나누어 표시합니다."
    );

    await nextFrame();
    const streamStats = await streamTextIntoReader(
      response,
      renderToken,
      readerFontReadyPromise
    );

    if (!streamStats?.rendered || renderToken !== state.readerRenderToken) return;

    const preferredMode =
      isReaderPageModeEligible(item) &&
      getPreferredReaderDisplayMode() === "page"
        ? "page"
        : "scroll";

    let quoteJumpLocation = null;
    if (options?.quoteJump) {
      quoteJumpLocation = await resolveSavedQuoteJumpLocation(options.quoteJump, item);
    }

    const layoutDetail = {};
    const layoutStartedAt = performance.now();
    await setReaderDisplayMode(preferredMode, {
      persist: false,
      offset: quoteJumpLocation?.startOffset ?? 0,
      initialLayout: true,
      perfBreakdown: layoutDetail,
    });
    const layoutMs = performance.now() - layoutStartedAt;

    // v8.88 - scroll reader loading cover 2nd optimization.
    // Keep the cover visible while the initial mode and resume position are
    // calculated, then fade it after layout has settled. Previously the cover
    // fade completed first and the layout ran afterwards, making the two waits
    // fully serial. This preserves the existing position/continue-reading
    // logic while avoiding that serial wait.
    if (preferredMode === "scroll" && els.readerLoadingOverlay) {
      const overlayStartedAt = performance.now();
      const overlayDetail = await dismissReaderLoadingOverlay(renderToken);
      const overlayMs = performance.now() - overlayStartedAt;

      // Keep the existing analytics decomposition compatible: overlay cleanup
      // remains part of the rendering bucket even though it now runs after the
      // initial layout.
      streamStats.renderMs += overlayMs;
      streamStats.renderBreakdown = streamStats.renderBreakdown || {};
      streamStats.renderBreakdown.overlay = overlayMs;
      streamStats.renderBreakdown.overlayFrameWait = Number(overlayDetail?.frameWait || 0);
      streamStats.renderBreakdown.overlayTransition = Number(overlayDetail?.transition || 0);
      streamStats.renderBreakdown.overlayRemove = Number(overlayDetail?.remove || 0);
    }

    if (options?.quoteJump) {
      state.readerResumeSaved = null;
      if (els.readerResume) els.readerResume.hidden = true;
      if (!quoteJumpLocation) {
        window.setTimeout(() => {
          window.alert(options?.quoteJump?._feedJump
            ? "피드 문장의 원문 위치를 정확히 찾지 못해 작품 처음에서 열었습니다."
            : "저장한 문장의 원문 위치를 찾지 못했습니다. 원문이 수정되었거나 저장 문구가 편집된 경우일 수 있습니다.");
        }, 0);
      }
    } else {
      showResumePrompt(item, { actionsReady: true });
    }
    recordAnalyticsReaderLoad(performance.now() - state.readerLoadingStartedAt, {
      responseMs,
      downloadMs: streamStats.downloadMs,
      renderMs: streamStats.renderMs,
      layoutMs,
      cacheStatus,
      bytes: contentBytes,
      mode: preferredMode,
      missServer,
      renderDetail: {
        ...(streamStats.renderBreakdown || {}),
        ...layoutDetail,
      },
    });

    window.setTimeout(() => {
      // A scroll event can fire during the initial reader layout. If that
      // event scheduled a delayed save while progress saving was suspended,
      // it would run after this release and overwrite the real resume point
      // with the top-of-document 0% position. Drop every pending initial
      // layout save before enabling normal progress tracking.
      window.clearTimeout(readerProgressSaveTimer);
      readerProgressSaveTimer = 0;
      state.suspendReaderProgressSave = false;
    }, 250);
  } catch (error) {
    window.clearInterval(waitTimer);

    if (renderToken !== state.readerRenderToken) return;

    unlockReaderScroll();
    els.readerBody.innerHTML = `
      <div class="reader-error-state">
        <p class="reader-error">${escapeHtml(error?.message || "본문을 불러오지 못했습니다.")}</p>
        <button class="inline-retry-button" type="button" data-reader-retry>다시 시도</button>
      </div>`;
    els.readerLoadingOverlay = null;
    els.readerContent = null;
  }
}

function finalizeReaderClose() {
  void releaseReaderWakeLock();
  closeReaderShareUi();
  closeReaderSeekFloat();
  window.clearTimeout(readerSeekMoveTimer);
  readerSeekMoveTimer = 0;
  unlockReaderScroll();

  // If the reader was opened on a saved resume point and the user closes it
  // without choosing "resume" / "restart" or actually moving away from
  // the initial top position, preserve the existing saved progress. Closing
  // the modal itself must never turn the temporary 0-position layout into a
  // new reading position.
  const hasPendingResume = Boolean(
    state.readerResumeSaved &&
    els.readerResume &&
    !els.readerResume.hidden
  );
  const untouchedScrollResume =
    state.readerDisplayMode !== "page" &&
    Math.max(0, Number(els.readerPanel?.scrollTop || 0)) <
      READER_MIN_MEANINGFUL_SCROLL_PX;
  const untouchedPageResume =
    state.readerDisplayMode === "page" &&
    !state.readerPageHasNavigated &&
    Math.max(0, Number(state.readerPageStart || 0)) === 0;
  const preserveExistingResume =
    hasPendingResume &&
    (untouchedScrollResume || untouchedPageResume);

  window.clearTimeout(readerProgressSaveTimer);
  readerProgressSaveTimer = 0;
  state.suspendReaderProgressSave = preserveExistingResume;

  const closingItem = state.activeReaderItem;
  const savedProgress = preserveExistingResume
    ? null
    : saveReaderProgress();
  const refreshArchiveAfterClose = Boolean(
    closingItem && savedProgress && state.user
  );

  if (refreshArchiveAfterClose) {
    persistProgress(closingItem, savedProgress);
  }

  state.readerResumeSaved = null;
  state.suspendReaderProgressSave = false;

  state.readerRenderToken += 1;
  state.activeReaderItem = null;
  state.readerText = "";
  resetReaderPageState();
  resetLargeReaderState();
  els.readerPanel?.classList.remove("reader-page-mode");
  if (els.readerBody) {
    els.readerBody.hidden = false;
    els.readerBody.style.display = "";
  }
  if (els.readerContent) {
    els.readerContent.hidden = false;
    els.readerContent.style.display = "";
  }
  if (els.readerPageViewport) {
    els.readerPageViewport.hidden = true;
    els.readerPageViewport.style.display = "none";
  }
  els.readerOverlay.hidden = true;
  readerCompactActive = false;
  els.readerPanel?.classList.remove("reader-compact");
  els.readerScrollTop?.classList.remove("visible");
  document.body.classList.remove("reader-open");
  els.readerBody.textContent = "";
  state.readerDisplayMode = getPreferredReaderDisplayMode();
  syncReaderModeButtons();
  updatePageScrollTopButton();
  updateCompactHeader();

  // Periodic progress syncs intentionally skip archive DOM rendering while
  // the reader is open. Refresh once after close so reading badges/filters and
  // the resume shortcut reflect the latest in-memory progress.
  if (refreshArchiveAfterClose && state.items.length) {
    render();
  }

  state.readerHistoryActive = false;

  if (state.readerReturnToMyLibrary) {
    state.readerReturnToMyLibrary = false;
    window.setTimeout(() => {
      if (!state.profileOpen || !state.myLibraryDetailWorkId || !els.myLibraryModal) return;
      renderMyLibraryModal();
      openModal(els.myLibraryModal);
    }, 0);
  }
}

function closeReader(options = {}) {
  const fromHistory = Boolean(options.fromHistory);

  if (!fromHistory && state.readerHistoryActive) {
    history.back();
    return;
  }

  finalizeReaderClose();
}


window.addEventListener("popstate", (event) => {
  if (
    !els.readerOverlay?.hidden &&
    state.activeReaderItem &&
    !event.state?.rjsReaderOpen
  ) {
    state.readerHistoryActive = false;
    closeReader({ fromHistory: true });
  }
});

state.sort = normalizeSortValue(state.sort);
localStorage.setItem("archiveSort", state.sort);

if (els.sortSelect) {
  els.sortSelect.innerHTML = `
    <option value="title">제목순</option>
    <option value="author">작가순</option>
    <option value="registered">최근등록일</option>
    <option value="published">최근발행일</option>
    <option value="bookmarks">북마크순</option>
    <option value="size">분량순</option>
  `;
  els.sortSelect.value = state.sort;
}
if (els.mobileSortSelect) {
  els.mobileSortSelect.value = state.sort;
}

applySourceForSort();

// The initial screen still displays "제목순", so selecting the same native
// option would not fire a change event. Touching/clicking the sort control is
// treated as an explicit sorting action and releases the one-time boost.
els.sortSelect?.addEventListener("pointerdown", () => {
  if (!state.initialRecentPostypeBoost || state.sort !== "title") return;
  disableInitialRecentPostypeBoost();
  render();
});

async function applySortSelection(value, sourceSelect) {
  disableInitialRecentPostypeBoost();
  state.sort = normalizeSortValue(value);
  applySourceForSort();
  localStorage.setItem("archiveSort", state.sort);
  if (els.sortSelect) els.sortSelect.value = state.sort;
  if (els.mobileSortSelect) els.mobileSortSelect.value = state.sort;

  if (state.sort === "bookmarks") {
    if (sourceSelect) sourceSelect.disabled = true;
    try {
      await loadBookmarkCounts();
    } catch (error) {
      console.warn("북마크 순위 로드 실패", error);
      window.alert(error?.message || "북마크 순위를 불러오지 못했습니다.");
    } finally {
      if (sourceSelect) sourceSelect.disabled = false;
    }
  }

  render();
}

els.sortSelect?.addEventListener("change", async (event) => {
  await applySortSelection(event.target.value, event.target);
});

els.mobileSortSelect?.addEventListener("change", async (event) => {
  await applySortSelection(event.target.value, event.target);
});

els.filterToggleButton?.addEventListener("click", () => {
  setMobileFiltersOpen(!state.mobileFiltersOpen);
});

els.compactFilterButton?.addEventListener("click", () => {
  setMobileFiltersOpen(true);
});

els.mobileFilterCloseButton?.addEventListener("click", () => {
  setMobileFiltersOpen(false);
});

els.mobileFilterBackdrop?.addEventListener("click", () => {
  setMobileFiltersOpen(false);
});

els.mobileFilterResetButton?.addEventListener("click", () => {
  resetFilterState();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.mobileFiltersOpen) {
    setMobileFiltersOpen(false);
  }
});

window.addEventListener("resize", () => {
  if (
    state.mobileFiltersOpen &&
    !window.matchMedia("(max-width: 640px)").matches
  ) {
    setMobileFiltersOpen(false);
  }
  if (state.view === "list") adjustMobileListTitleSizes();
});

window.addEventListener("pageshow", () => {
  // Browser form restoration must not override the JS filter state.
  syncFilterChipGroup(els.combinationFilters, "combination", state.combination);
  syncFilterChipGroup(els.contentTypeFilters, "contentType", state.contentType);
  syncFilterChipGroup(els.statusFilters, "statusFilter", state.statusFilter);
  syncSourceFilterChips();

  if (els.tabletCombinationSelect) {
    els.tabletCombinationSelect.value = state.combination;
  }
  if (els.tabletContentTypeSelect) {
    els.tabletContentTypeSelect.value = state.contentType;
  }
  if (els.tabletStatusSelect) {
    els.tabletStatusSelect.value = state.statusFilter;
  }
  if (els.tabletSourceSelect) {
    els.tabletSourceSelect.value = state.source;
  }
});

els.status?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-archive-retry]")) return;
  loadArchive(true);
});

els.resetFiltersButton?.addEventListener("click", () => {
  resetFilterState({ includeSearch: true });
});

els.readerBody?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-reader-retry]")) return;
  const item = state.activeReaderItem;
  if (item) openReader(item);
});

els.readerScrollModeButton?.addEventListener("click", async () => {
  await setReaderDisplayMode("scroll");

  if (!state.activeReaderItem) return;

  const saved = saveReaderProgress();
  if (saved && state.user) {
    persistProgress(state.activeReaderItem, saved);
  }
});

els.readerPageModeButton?.addEventListener("click", async () => {
  await setReaderDisplayMode("page");

  if (!state.activeReaderItem) return;

  const saved = saveReaderProgress();
  if (saved && state.user) {
    persistProgress(state.activeReaderItem, saved);
  }
});


els.readerPageViewport?.addEventListener("click", async (event) => {
  if (state.readerDisplayMode !== "page") return;

  if (event.target.closest("#readerPagePrev")) {
    await turnReaderPage(-1);
    return;
  }

  if (event.target.closest("#readerPageNext")) {
    await turnReaderPage(1);
    return;
  }

  if (event.target.closest(".reader-page-footer")) {
    return;
  }

  if (
    Date.now() - Number(state.readerPageLastSwipeAt || 0) <
    450
  ) {
    return;
  }

  const selection = window.getSelection?.();
  if (selection && String(selection).trim()) {
    return;
  }

  const rect = els.readerPageViewport.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const previousZone = rect.width * 0.30;

  await turnReaderPage(x <= previousZone ? -1 : 1);
});

els.readerPageViewport?.addEventListener("touchstart", (event) => {
  if (state.readerDisplayMode !== "page") return;

  const touch = event.touches?.[0];
  if (!touch) return;

  state.readerPageTouchStartX = touch.clientX;
  state.readerPageTouchStartY = touch.clientY;
}, { passive: true });

els.readerPageViewport?.addEventListener("touchend", async (event) => {
  if (
    state.readerDisplayMode !== "page" ||
    state.readerPageTouchStartX == null ||
    state.readerPageTouchStartY == null
  ) return;

  const touch = event.changedTouches?.[0];
  if (!touch) return;

  const dx = touch.clientX - state.readerPageTouchStartX;
  const dy = touch.clientY - state.readerPageTouchStartY;

  state.readerPageTouchStartX = null;
  state.readerPageTouchStartY = null;

  if (
    Math.abs(dx) < READER_PAGE_SWIPE_PX ||
    Math.abs(dx) <= Math.abs(dy) * 1.2
  ) return;

  state.readerPageLastSwipeAt = Date.now();
  await turnReaderPage(dx < 0 ? 1 : -1);
}, { passive: true });

window.addEventListener("keydown", async (event) => {
  if (
    els.readerOverlay?.hidden ||
    state.readerDisplayMode !== "page"
  ) return;

  const target = event.target instanceof Element
    ? event.target
    : document.activeElement;
  const editingTarget = target instanceof Element && Boolean(
    target.closest(
      'input, textarea, select, button, a[href], [contenteditable="true"], [role="textbox"]'
    )
  );
  const auxiliaryUiOpen = Boolean(
    document.querySelector(
      '.simple-modal-overlay:not([hidden]), .reader-share-backdrop:not([hidden]), .reader-memo-backdrop'
    )
  );
  const selection = window.getSelection?.();

  // Keep native keyboard behavior while the user is typing, using a modal,
  // or adjusting a text selection. Page-turn shortcuts should only act on
  // the reader itself.
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    editingTarget ||
    auxiliaryUiOpen ||
    (selection && String(selection).trim())
  ) return;

  if (event.key === "ArrowRight" || event.key === "PageDown") {
    event.preventDefault();
    await turnReaderPage(1);
  } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
    event.preventDefault();
    await turnReaderPage(-1);
  }
});

window.addEventListener("resize", () => {
  if (
    state.readerDisplayMode !== "page" ||
    els.readerOverlay?.hidden
  ) return;

  window.clearTimeout(state.readerPageResizeTimer);
  state.readerPageResizeTimer = window.setTimeout(() => {
    const start = state.readerPageStart;
    resizeReaderPageViewport();
    renderReaderPageAt(start, { navigated: false });
  }, 160);
});



async function resumeScrollReaderFromSaved(saved, item) {
  if (!saved || !item || !els.readerPanel || !els.readerContent) {
    return false;
  }

  const panel = els.readerPanel;
  const content = els.readerContent;
  const previousPanelAnchor = panel.style.getPropertyValue("overflow-anchor");
  const previousPanelAnchorPriority = panel.style.getPropertyPriority("overflow-anchor");
  const previousContentAnchor = content.style.getPropertyValue("overflow-anchor");
  const previousContentAnchorPriority = content.style.getPropertyPriority("overflow-anchor");

  state.suspendReaderProgressSave = true;

  // Remove the resume banner before measuring the target. Hiding it after the
  // jump changes the reader layout and can make browsers re-anchor to the top.
  if (els.readerResume) els.readerResume.hidden = true;
  panel.style.setProperty("overflow-anchor", "none", "important");
  content.style.setProperty("overflow-anchor", "none", "important");
  setReaderCompactActive(true);

  await nextFrame();
  await nextFrame();

  let targetTop = 0;
  let ready = true;
  let directTextResumeResult = null;

  if (isLargeReaderFile(item) && Array.isArray(state.largeReaderChunks)) {
    let position = null;

    // For scroll-mode progress, prefer the exact chunk coordinate that was
    // recorded from this scroller. This avoids converting through page/text
    // coordinates introduced by page mode.
    if (
      saved.mode === "chunk" &&
      Number.isFinite(Number(saved.chunkIndex))
    ) {
      position = {
        index: Math.max(0, Math.min(
          state.largeReaderChunks.length - 1,
          Math.floor(Number(saved.chunkIndex) || 0)
        )),
        ratio: Math.max(0, Math.min(1, Number(saved.chunkRatio) || 0)),
      };
    }

    // Legacy/fallback entries may contain only a percentage.
    if (!position || (position.index === 0 && position.ratio === 0 && Number(saved.percent) > 0.2)) {
      const textLength = Math.max(1, getReaderTextLength());
      const percent = Math.max(0, Math.min(99.9, Number(saved.percent) || 0));
      position = readerOffsetToLargePosition(textLength * (percent / 100));
    }

    if (!position) {
      ready = false;
    } else {
      ready = await ensureLargeReaderChunkRendered(
        position.index,
        state.readerRenderToken
      );

      if (ready) {
        await nextFrame();
        await nextFrame();

        const section = content.querySelector(
          `.reader-virtual-chunk[data-reader-chunk-index="${position.index}"]`
        );

        if (section) {
          targetTop = getLargeReaderTargetScrollTop(section, position.ratio);
        } else {
          ready = false;
        }
      }
    }
  } else {
    const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const storedScrollTop = Number(saved.scrollTop);

    if (Number.isFinite(storedScrollTop) && storedScrollTop > 0) {
      // A progress record created in scroll mode already has the exact native
      // scroller coordinate. Keep using it so the verified v7.44+ scroll
      // resume path remains unchanged.
      targetTop = Math.max(0, Math.min(maxScroll, storedScrollTop));
    } else {
      // Page mode stores the shared text-based percentage but intentionally
      // has no scrollTop. Converting that percentage back through scroll
      // height drifts because text ratio and pixel-height ratio are not the
      // same coordinate system. Restore the actual text offset instead.
      const textOffset = savedProgressToReaderOffset(saved);

      if (textOffset > 0) {
        directTextResumeResult = await scrollReaderToTextOffset(
          textOffset,
          { releaseProgressSave: false }
        );
        ready = false;
      } else {
        targetTop = 0;
      }
    }
  }

  let reached = directTextResumeResult === true;

  if (ready) {
    const applyTarget = async () => {
      const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight);
      const target = Math.max(0, Math.min(maxScroll, targetTop));

      panel.scrollTop = target;
      try {
        panel.scrollTo({ top: target, left: 0, behavior: "auto" });
      } catch {
        try { panel.scrollTo(0, target); } catch {}
      }

      await nextFrame();
      await nextFrame();

      return {
        target,
        actual: Math.max(0, panel.scrollTop),
      };
    };

    let result = await applyTarget();

    // Re-check after layout/scroll anchoring has had time to run. If the
    // browser pulled the panel back toward zero, force the same native
    // scroller coordinate again.
    for (const delay of [120, 360]) {
      await new Promise((resolve) => setTimeout(resolve, delay));

      const tolerance = Math.max(36, panel.clientHeight * 0.04);
      const meaningfulTarget = result.target >= READER_MIN_MEANINGFUL_SCROLL_PX;
      const fellBackToTop = meaningfulTarget && panel.scrollTop < READER_MIN_MEANINGFUL_SCROLL_PX;
      const farFromTarget = Math.abs(panel.scrollTop - result.target) > tolerance;

      if (fellBackToTop || farFromTarget) {
        result = await applyTarget();
      }
    }

    const tolerance = Math.max(42, panel.clientHeight * 0.05);
    reached =
      result.target < READER_MIN_MEANINGFUL_SCROLL_PX
        ? result.actual < READER_MIN_MEANINGFUL_SCROLL_PX
        : Math.abs(panel.scrollTop - result.target) <= tolerance &&
          panel.scrollTop >= READER_MIN_MEANINGFUL_SCROLL_PX;
  }

  if (!reached && els.readerResume) {
    els.readerResume.hidden = false;
    if (els.readerResumeText) {
      els.readerResumeText.textContent =
        "위치 이동을 다시 시도해 주세요.";
    }
  }

  window.setTimeout(() => {
    if (previousPanelAnchor) {
      panel.style.setProperty(
        "overflow-anchor",
        previousPanelAnchor,
        previousPanelAnchorPriority
      );
    } else {
      panel.style.removeProperty("overflow-anchor");
    }

    if (previousContentAnchor) {
      content.style.setProperty(
        "overflow-anchor",
        previousContentAnchor,
        previousContentAnchorPriority
      );
    } else {
      content.style.removeProperty("overflow-anchor");
    }

    state.suspendReaderProgressSave = false;

    if (reached) {
      const progress = saveReaderProgress();
      if (
        progress &&
        state.user &&
        state.activeReaderItem &&
        shouldPersistProgress(state.activeReaderItem.id, progress)
      ) {
        persistProgress(state.activeReaderItem, progress);
      }
    }
  }, IS_SAFARI_READER ? 950 : 760);

  return reached;
}

els.readerResume?.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const item = state.activeReaderItem;
  if (!item || !els.readerPanel) return;

  event.preventDefault();
  event.stopPropagation();

  if (button.id === "readerResumeButton") {
    const saved = state.readerResumeSaved || getReaderProgress(item.id);
    if (!saved) {
      els.readerResume.hidden = true;
      return;
    }

    if (
      state.readerDisplayMode === "page" &&
      state.readerText
    ) {
      state.suspendReaderProgressSave = true;
      els.readerResume.hidden = true;
      setReaderCompactActive(true);
      await nextFrame();
      await nextFrame();
      resizeReaderPageViewport();

      const resumed = renderReaderPageAt(
        savedProgressToReaderOffset(saved),
        { navigated: false }
      );

      if (!resumed) {
        els.readerResume.hidden = false;
        els.readerResumeText.textContent =
          "위치 이동을 다시 시도해 주세요.";
      }

      window.setTimeout(() => {
        state.suspendReaderProgressSave = false;
      }, 350);
      return;
    }

    els.readerResumeButton.disabled = true;
    els.readerRestartButton.disabled = true;
    els.readerResumeText.textContent = "읽던 위치로 이동하고 있습니다…";

    await resumeScrollReaderFromSaved(saved, item);

    els.readerResumeButton.disabled = false;
    els.readerRestartButton.disabled = false;
    return;
  }

  if (button.id === "readerRestartButton") {
    state.readerResumeSaved = null;
    if (state.user) {
      updateUserLibraryEntry(item.id, {
        progressPercent: 0,
        scrollTop: 0,
        chunkIndex: null,
        chunkRatio: null,
        updatedAt: Date.now(),
      });
      clearLocalReaderProgress(item.id);

      persistProgress(item, {
        mode: "scroll",
        scrollTop: 0,
        percent: 0,
      });
    }

    temporarilySuspendProgressSave(500);
    els.readerResume.hidden = true;

    if (
      state.readerDisplayMode === "page" &&
      state.readerText
    ) {
      resetReaderPageState();
      setReaderCompactActive(true);
      await nextFrame();
      resizeReaderPageViewport();
      renderReaderPageAt(0, { navigated: false });
      return;
    }

    requestAnimationFrame(() => {
      els.readerPanel.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }
});




els.darkModeToggle?.addEventListener("click", () => {
  const nextTheme = getSavedTheme() === "dark" ? "light" : "dark";
  setViewerPreference(UI_THEME_KEY, nextTheme);
  applyUserPreferences();
});

els.readerWakeLockToggle?.addEventListener("click", () => {
  const nextEnabled = !getSavedReaderWakeLock();
  setViewerPreference(READER_WAKE_LOCK_KEY, nextEnabled ? "on" : "off");
  readerWakeLockLastError = "";
  void syncReaderWakeLock();
});

document.addEventListener("visibilitychange", () => {
  void syncReaderWakeLock();
});

els.readerSideMarginButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    const sideMargin = button.dataset.readerSideMargin;
    if (!["narrow", "normal", "wide"].includes(sideMargin)) return;
    setViewerPreference(READER_SIDE_MARGIN_KEY, sideMargin);
    applyUserPreferences();
  });
});

els.readerSpacingButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    const spacing = button.dataset.readerSpacing;
    if (!["compact", "normal", "wide"].includes(spacing)) return;
    setViewerPreference(READER_SPACING_KEY, spacing);
    applyUserPreferences();
  });
});

els.readerFontSizeButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    const fontSize = button.dataset.readerFontSize;
    if (!["small", "normal", "large"].includes(fontSize)) return;
    setViewerPreference(READER_FONT_SIZE_KEY, fontSize);
    applyUserPreferences();
  });
});

els.readerFontFamilyButtons?.forEach((button) => {
  button.addEventListener("click", async () => {
    const fontFamily = button.dataset.readerFontFamily;
    if (!Object.prototype.hasOwnProperty.call(READER_FONT_FAMILIES, fontFamily)) return;
    if (fontFamily === "kopubbatang") {
      const ready = await ensureKopubFont();
      if (!ready) return;
    } else if (isLazyReaderFont(fontFamily)) {
      const ready = await ensureReaderLazyFont(fontFamily);
      if (!ready) return;
    }
    setViewerPreference(READER_FONT_FAMILY_KEY, fontFamily);
    applyUserPreferences();
  });
});

els.viewerFontMoreButton?.addEventListener("click", () => {
  const expanded = els.viewerFontMoreButton.getAttribute("aria-expanded") === "true";
  setViewerFontExtraExpanded(!expanded, { preload: !expanded });
});

els.viewerSettingsButton?.addEventListener("click", () => {
  const selectedFont = getSavedReaderFontFamily();
  setViewerFontExtraExpanded(isExtraReaderFont(selectedFont));
  applyUserPreferences();
  openModal(els.viewerSettingsModal);
});

els.signupNudgeClose?.addEventListener("click", () => {
  hideSignupNudge({ remember: true, trackClose: true });
});

els.signupNudgeLogin?.addEventListener("click", () => {
  recordSignupNudgeAction("login");
  hideSignupNudge();
  openAuthModal("login", "로그인하면 읽던 위치와 보관함을 다른 기기에서도 이어서 사용할 수 있어요.");
});

els.signupNudgeSignup?.addEventListener("click", () => {
  recordSignupNudgeAction("signup");
  hideSignupNudge();
  openSignupModal();
});

els.loginButton?.addEventListener("click", () => {
  if (state.user) {
    const compactMobile = window.matchMedia("(max-width: 760px)").matches
      && els.siteHeader?.classList.contains("compact-mode");
    if (compactMobile) {
      els.logoutButton?.click();
      return;
    }
    showProfilePage("bookmarks");
    return;
  }

  openAuthModal("login");
});

els.signupButton?.addEventListener("click", () => {
  openSignupModal();
});


let feedbackTurnstileWidgetId = null;
let feedbackTurnstileToken = "";
let feedbackTurnstileSiteKey = "";
let feedbackTurnstileLoading = null;

function setFeedbackSubmitReady(ready) {
  if (!els.feedbackSubmitButton) return;
  els.feedbackSubmitButton.disabled = !ready;
}

function setFeedbackTurnstileHint(message, isError = false) {
  if (!els.feedbackTurnstileHint) return;
  els.feedbackTurnstileHint.textContent = message;
  els.feedbackTurnstileHint.classList.toggle("is-error", Boolean(isError));
}

async function loadTurnstileApi() {
  if (window.turnstile?.render) return window.turnstile;
  const existing = document.querySelector('script[data-rjs-turnstile="true"]');
  if (!existing) {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.rjsTurnstile = "true";
    document.head.appendChild(script);
  }
  const started = Date.now();
  while (!window.turnstile?.render) {
    if (Date.now() - started > 10000) throw new Error("자동 입력 방지 확인을 불러오지 못했습니다.");
    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }
  return window.turnstile;
}

function resetFeedbackTurnstile(message = "자동 입력 방지 확인을 다시 진행해 주세요.", isError = false) {
  feedbackTurnstileToken = "";
  setFeedbackSubmitReady(false);
  setFeedbackTurnstileHint(message, isError);
  if (feedbackTurnstileWidgetId !== null && window.turnstile?.reset) {
    window.turnstile.reset(feedbackTurnstileWidgetId);
  }
}

function removeFeedbackTurnstile() {
  feedbackTurnstileToken = "";
  setFeedbackSubmitReady(false);
  if (feedbackTurnstileWidgetId !== null && window.turnstile?.remove) {
    try { window.turnstile.remove(feedbackTurnstileWidgetId); } catch {}
  }
  feedbackTurnstileWidgetId = null;
  if (els.feedbackTurnstile) els.feedbackTurnstile.replaceChildren();
}

async function ensureFeedbackTurnstile() {
  if (!els.feedbackTurnstile) return;

  // 이미 렌더링된 위젯은 모달을 닫았다 다시 열어도 그대로 재사용한다.
  // 유효한 토큰까지 있으면 추가 reset/render/network 호출이 없다.
  if (feedbackTurnstileWidgetId !== null) {
    if (feedbackTurnstileToken) {
      setFeedbackSubmitReady(true);
      setFeedbackTurnstileHint("자동 입력 방지 확인이 완료됐어요.");
    } else {
      setFeedbackSubmitReady(false);
    }
    return;
  }
  if (feedbackTurnstileLoading) return feedbackTurnstileLoading;

  feedbackTurnstileLoading = (async () => {
    setFeedbackSubmitReady(false);
    setFeedbackTurnstileHint("자동 입력 방지 확인을 준비하는 중이에요.");
    if (!feedbackTurnstileSiteKey) {
      const configResponse = await fetch("/api/feedback", { cache: "no-store", credentials: "omit" });
      const config = await configResponse.json().catch(() => ({}));
      if (!configResponse.ok || !config?.siteKey) {
        throw new Error(config?.error || "자동 입력 방지 설정이 아직 완료되지 않았습니다.");
      }
      feedbackTurnstileSiteKey = String(config.siteKey);
    }
    const turnstile = await loadTurnstileApi();
    feedbackTurnstileWidgetId = turnstile.render(els.feedbackTurnstile, {
      sitekey: feedbackTurnstileSiteKey,
      theme: "auto",
      size: window.innerWidth < 360 ? "compact" : "flexible",
      language: "ko",
      action: "feedback",
      callback(token) {
        feedbackTurnstileToken = String(token || "");
        setFeedbackSubmitReady(Boolean(feedbackTurnstileToken));
        setFeedbackTurnstileHint("자동 입력 방지 확인이 완료됐어요.");
      },
      "expired-callback"() {
        resetFeedbackTurnstile("확인 시간이 지나 새 확인을 시작했어요.");
      },
      "error-callback"() {
        feedbackTurnstileToken = "";
        setFeedbackSubmitReady(false);
        setFeedbackTurnstileHint("자동 입력 방지 확인에 실패했어요. 잠시 후 다시 시도해 주세요.", true);
      },
    });
  })().catch((error) => {
    setFeedbackSubmitReady(false);
    setFeedbackTurnstileHint(error.message || "자동 입력 방지 확인을 불러오지 못했습니다.", true);
    if (els.feedbackMessageState) {
      els.feedbackMessageState.textContent = error.message || "자동 입력 방지 확인을 불러오지 못했습니다.";
      els.feedbackMessageState.classList.add("is-error");
      els.feedbackMessageState.hidden = false;
    }
  }).finally(() => {
    feedbackTurnstileLoading = null;
  });

  return feedbackTurnstileLoading;
}

function isAccountFeedbackCategory() {
  return String(els.feedbackCategory?.value || "") === "계정 문의";
}

function syncFeedbackCategoryUi({ clearHiddenAccountValues = false } = {}) {
  const isAccount = isAccountFeedbackCategory();
  if (els.feedbackAccountFields) els.feedbackAccountFields.hidden = !isAccount;
  if (els.feedbackAccountUserId) els.feedbackAccountUserId.required = isAccount;
  if (els.feedbackReplyContact) els.feedbackReplyContact.required = isAccount;

  if (!isAccount && clearHiddenAccountValues) {
    if (els.feedbackAccountUserId) els.feedbackAccountUserId.value = "";
    if (els.feedbackReplyContact) els.feedbackReplyContact.value = "";
  }

  if (els.feedbackModalKicker) els.feedbackModalKicker.textContent = isAccount ? "ACCOUNT HELP" : "ANONYMOUS FEEDBACK";
  if (els.feedbackModalTitle) els.feedbackModalTitle.textContent = isAccount ? "계정 문의 보내기" : "익명 의견 보내기";
  if (els.feedbackModalDescription) {
    els.feedbackModalDescription.textContent = isAccount
      ? "비밀번호를 잊은 경우 계정 아이디·답변 받을 연락수단과 함께 최근 읽은 작품이나 북마크한 작품 등 본인 확인에 도움이 되는 이용 기록을 내용에 적어 주세요. 관리자가 계정 기록과 대조한 뒤 수동으로 초기화합니다."
      : "문의·오류·기능 제안 등 자유롭게 남겨주세요. 일반 의견에는 로그인 정보나 사용자 ID를 저장하지 않습니다.";
  }
  if (els.feedbackPrivacyHint) {
    els.feedbackPrivacyHint.textContent = isAccount
      ? "계정 문의에는 입력한 계정 아이디·연락수단과 문의 내용이 저장됩니다. 연락수단만으로는 본인 확인하지 않으며 오류 진단정보는 저장하지 않습니다."
      : "일반 의견은 현재 페이지·사이트 버전과 오류 확인용 진단정보가 함께 저장될 수 있습니다.";
  }
  if (els.feedbackSubmitButton && els.feedbackSubmitButton.textContent !== "보내는 중…") {
    els.feedbackSubmitButton.textContent = isAccount ? "계정 문의 보내기" : "익명으로 보내기";
  }
}

function openFeedbackModal({ category = "", accountId = "" } = {}) {
  const previousCategory = String(els.feedbackCategory?.value || "");
  if (category && els.feedbackCategory) els.feedbackCategory.value = category;
  if (category && previousCategory && previousCategory !== category && els.feedbackMessage) {
    els.feedbackMessage.value = "";
  }
  if (category === "계정 문의" && els.feedbackAccountUserId) {
    els.feedbackAccountUserId.value = String(accountId || "").trim().toLowerCase().slice(0, 20);
  }
  syncFeedbackCategoryUi({ clearHiddenAccountValues: !isAccountFeedbackCategory() });
  if (els.feedbackMessageState) {
    els.feedbackMessageState.hidden = true;
    els.feedbackMessageState.classList.remove("is-error");
  }
  openModal(els.feedbackModal);
  ensureFeedbackTurnstile();
}

els.feedbackCategory?.addEventListener("change", () => {
  syncFeedbackCategoryUi({ clearHiddenAccountValues: true });
});

els.helpFeedbackButton?.addEventListener("click", () => {
  openFeedbackModal({ category: "문의" });
});

els.feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = String(els.feedbackMessage?.value || "").trim();
  const isAccountInquiry = isAccountFeedbackCategory();
  const accountUserId = String(els.feedbackAccountUserId?.value || "").trim().toLowerCase();
  const replyContact = String(els.feedbackReplyContact?.value || "").trim();
  if (message.length < 5) {
    els.feedbackMessageState.textContent = "내용을 5자 이상 입력해 주세요.";
    els.feedbackMessageState.classList.add("is-error");
    els.feedbackMessageState.hidden = false;
    return;
  }
  if (isAccountInquiry && !/^[a-z0-9_-]{3,20}$/.test(accountUserId)) {
    els.feedbackMessageState.textContent = "계정 아이디를 영문 소문자, 숫자, _ - 조합 3~20자로 입력해 주세요.";
    els.feedbackMessageState.classList.add("is-error");
    els.feedbackMessageState.hidden = false;
    return;
  }
  if (isAccountInquiry && (replyContact.length < 3 || replyContact.length > 200)) {
    els.feedbackMessageState.textContent = "답변 받을 연락수단을 3~200자로 입력해 주세요.";
    els.feedbackMessageState.classList.add("is-error");
    els.feedbackMessageState.hidden = false;
    return;
  }

  const lastSentAt = Number(localStorage.getItem("archiveFeedbackSentAt") || 0);
  if (Date.now() - lastSentAt < 30000) {
    els.feedbackMessageState.textContent = "잠시 후 다시 보내주세요.";
    els.feedbackMessageState.classList.add("is-error");
    els.feedbackMessageState.hidden = false;
    return;
  }

  if (!feedbackTurnstileToken) {
    els.feedbackMessageState.textContent = "자동 입력 방지 확인을 완료해 주세요.";
    els.feedbackMessageState.classList.add("is-error");
    els.feedbackMessageState.hidden = false;
    return;
  }

  els.feedbackSubmitButton.disabled = true;
  els.feedbackSubmitButton.textContent = "보내는 중…";
  els.feedbackMessageState.hidden = true;
  els.feedbackMessageState.classList.remove("is-error");

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category: els.feedbackCategory?.value || "기타",
        message,
        website: els.feedbackWebsite?.value || "",
        accountUserId: isAccountInquiry ? accountUserId : "",
        replyContact: isAccountInquiry ? replyContact : "",
        page: `${location.pathname}${location.search}`,
        version: String(els.publicVersion?.textContent || "").trim(),
        diagnostic: isAccountInquiry ? "" : getIssueReportText(),
        turnstileToken: feedbackTurnstileToken,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "의견을 보내지 못했습니다.");
    localStorage.setItem("archiveFeedbackSentAt", String(Date.now()));
    els.feedbackMessage.value = "";
    if (els.feedbackWebsite) els.feedbackWebsite.value = "";
    if (els.feedbackAccountUserId) els.feedbackAccountUserId.value = "";
    if (els.feedbackReplyContact) els.feedbackReplyContact.value = "";
    els.feedbackMessageState.textContent = isAccountInquiry
      ? "계정 문의를 보냈어요. 관리자가 확인 후 남겨주신 연락수단으로 답변합니다."
      : "의견을 보냈어요. 고맙습니다.";
    els.feedbackMessageState.hidden = false;
    window.setTimeout(() => closeModal(els.feedbackModal), 900);
    // Siteverify 토큰은 1회용이므로 성공 후 위젯을 제거한다.
    // 닫힌 모달 뒤에서 새 챌린지를 미리 호출하지 않고, 다음 의견창 오픈 때 새로 렌더링한다.
    removeFeedbackTurnstile();
  } catch (error) {
    els.feedbackMessageState.textContent = error.message || "의견을 보내지 못했습니다.";
    els.feedbackMessageState.classList.add("is-error");
    els.feedbackMessageState.hidden = false;
    // 서버 검증을 시도한 토큰은 재사용하지 않는다. 실패 시 현재 창에서 새 확인으로 초기화한다.
    resetFeedbackTurnstile("자동 입력 방지 확인을 다시 진행해 주세요.", true);
  } finally {
    els.feedbackSubmitButton.disabled = true;
    els.feedbackSubmitButton.textContent = isAccountInquiry ? "계정 문의 보내기" : "익명으로 보내기";
  }
});

els.helpButton?.addEventListener("click", () => {
  openModal(els.helpModal);
});

els.copyIssueInfoButton?.addEventListener("click", () => {
  copyIssueReportInfo(els.copyIssueInfoButton);
});

els.privacyButton?.addEventListener("click", () => {
  openModal(els.privacyModal);
});

els.helpLoginButton?.addEventListener("click", () => {
  openAuthModal("login");
});

els.detailedHelpButton?.addEventListener("click", () => {
  openModal(els.detailedHelpModal);
});

els.detailedHelpCloseButton?.addEventListener("click", () => {
  closeModal(els.detailedHelpModal);
});

els.bookmarkLibraryButton?.addEventListener("click", () => {
  showUserLibrary("bookmarks");
});

els.recentLibraryButton?.addEventListener("click", () => {
  showUserLibrary("recent");
});



els.authForgotPasswordButton?.addEventListener("click", () => {
  openFeedbackModal({
    category: "계정 문의",
    accountId: els.authUserId?.value || "",
  });
});

els.authGoSignupButton?.addEventListener("click", () => {
  openSignupModal();
});

els.signupGoLoginButton?.addEventListener("click", () => {
  openAuthModal("login");
});

for (const input of [
  els.signupPassword,
  els.signupPasswordConfirm,
  els.signupRecoveryConfirm,
]) {
  input?.addEventListener("input", updateSignupButtonState);
  input?.addEventListener("change", updateSignupButtonState);
}

els.signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userId = els.signupUserId.value.trim().toLowerCase();
  const password = els.signupPassword.value;
  const passwordConfirm = els.signupPasswordConfirm.value;

  if (password !== passwordConfirm) {
    setSignupMessage("비밀번호가 서로 일치하지 않습니다.", true);
    return;
  }

  if (!els.signupRecoveryConfirm.checked) {
    setSignupMessage(
      "자동 비밀번호 찾기 없이 관리자 수동 초기화 방식이라는 안내를 확인해 주세요.",
      true
    );
    return;
  }

  els.signupSubmitButton.disabled = true;
  setSignupMessage("");

  try {
    const data = await userApi("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ userId, password }),
    });

    setAuthToken(data.token);
    state.user = data.user;
    applyUserPreferences();
    updateAccountUi();
    await loadUserBootstrap();
    recordSignupNudgeCompletion("signup");
    flushAnalyticsSession();

    els.signupFormView.hidden = true;
    els.signupCompleteView.hidden = false;
  } catch (error) {
    setSignupMessage(error.message, true);
    updateSignupButtonState();
  }
});

els.signupCompleteButton?.addEventListener("click", () => {
  closeModal(els.signupModal);
});

els.authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userId = els.authUserId.value.trim().toLowerCase();
  const password = els.authPassword.value;
  const endpoint = "/api/auth/login";

  els.authSubmitButton.disabled = true;
  setAuthMessage("");

  try {
    const data = await userApi(endpoint, {
      method: "POST",
      body: JSON.stringify({
        userId,
        password,
        remember: els.authRemember?.checked !== false,
      }),
    });

    setAuthToken(data.token, els.authRemember?.checked !== false);
    state.user = data.user;
    applyUserPreferences();
    updateAccountUi();
    await loadUserBootstrap();
    recordSignupNudgeCompletion("login");
    flushAnalyticsSession();

    els.authPassword.value = "";
    state.pendingAuthReason = "";
    closeModal(els.authModal);
  } catch (error) {
    setAuthMessage(error.message, true);
  } finally {
    els.authSubmitButton.disabled = false;
  }
});

els.logoutButton?.addEventListener("click", async () => {
  try {
    if (state.activeReaderItem) {
      const saved = saveReaderProgress();
      if (saved) await persistProgress(state.activeReaderItem, saved);
    }

    await userApi("/api/auth/logout", {
      method: "POST",
      body: "{}",
    });
  } catch {}

  clearUserSession(true);
  closeModal(els.accountModal);
});


els.readerDownloadButton?.addEventListener("click", () => {
  triggerItemDownload(state.activeReaderItem);
});

els.readerBookmarkButton?.addEventListener("click", () => {
  const item = state.activeReaderItem;
  if (!item) return;

  if (!state.user) {
    openAuthModal(
      "login",
      "북마크를 저장하려면 로그인해 주세요."
    );
    return;
  }

  const fileId = item.id;
  const nextValue = !getUserLibraryEntry(fileId)?.bookmarked;

  updateUserLibraryEntry(fileId, {
    bookmarked: nextValue,
    updatedAt: Date.now(),
  });
  updateReaderBookmarkButton();

  scheduleBookmarkSave(fileId, 650, "북마크");
});


els.readerLikeButton?.addEventListener("click", () => {
  if (state.activeReaderItem) toggleItemLike(state.activeReaderItem);
});

els.libraryViewAllButton?.addEventListener("click", () => {
  const tab = state.libraryKind === "recent" ? "recent" : "bookmarks";
  closeModal(els.libraryModal);
  showProfilePage(tab);
});

window.addEventListener("popstate", (event) => {
  if (state.profileOpen && !event.state?.rjsProfilePage) {
    hideProfilePage({ fromHistory: true });
    restoreContentPageScroll();
  }
});

document.addEventListener("toggle", (event) => {
  const details = event.target?.closest?.("details[data-list-more]");
  if (!details) return;
  const row = details.closest("tr");
  row?.classList.toggle("list-more-open", details.open);
  if (!details.open) return;
  document.querySelectorAll("details[data-list-more][open]").forEach((other) => {
    if (other !== details) other.open = false;
  });
}, true);

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("details[data-list-more] > summary");
  if (trigger) {
    const current = trigger.closest("details[data-list-more]");
    document.querySelectorAll("details[data-list-more][open]").forEach((details) => {
      if (details !== current) details.open = false;
    });
    window.requestAnimationFrame(() => {
      document.querySelectorAll("tr.list-more-open").forEach((row) => row.classList.remove("list-more-open"));
      if (current?.open) current.closest("tr")?.classList.add("list-more-open");
    });
    return;
  }
  if (event.target.closest("details[data-list-more]")) return;
  document.querySelectorAll("details[data-list-more][open]").forEach((details) => {
    details.open = false;
  });
});

els.quoteFeedButton?.addEventListener("click", () => {
  showQuoteFeedPage();
});

els.quoteFeedBackButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  hideQuoteFeedPage({ clearHistoryMarker: true });
  restoreContentPageScroll();
});

els.quoteFeedMoreButton?.addEventListener("click", () => {
  loadQuoteFeed({ append: true });
});

els.quoteFeedSortLatest?.addEventListener("click", () => changeQuoteFeedSort("latest"));
els.quoteFeedSortLikes?.addEventListener("click", () => changeQuoteFeedSort("likes"));

els.quoteFeedGrid?.addEventListener("click", (event) => {
  const likeButton = event.target.closest("[data-quote-feed-like]");
  if (likeButton) {
    const item = state.quoteFeedItems.find((entry) => String(entry.quoteId) === String(likeButton.dataset.quoteFeedLike));
    if (item) setQuoteFeedLike(item, !item.liked);
    return;
  }
  const card = event.target.closest("[data-quote-feed-id]");
  if (!card) return;
  const item = state.quoteFeedItems.find((entry) => String(entry.quoteId) === String(card.dataset.quoteFeedId));
  if (item) openQuoteFeedDetail(item);
});

els.quoteFeedOpenWorkButton?.addEventListener("click", () => {
  const feedItem = state.quoteFeedActiveItem;
  const item = findQuoteFeedWork(feedItem);
  if (!item) return;
  closeModal(els.quoteFeedModal);
  hideQuoteFeedPage({ clearHistoryMarker: true });
  if (item.source === "postype") {
    openContentItem(item);
    return;
  }
  recordAnalyticsWorkOpen(true);
  openReader(item, { quoteJump: getQuoteFeedJump(feedItem) });
});

window.addEventListener("popstate", (event) => {
  if (state.quoteFeedOpen && !event.state?.rjsQuoteFeedPage) {
    hideQuoteFeedPage({ fromHistory: true });
    restoreContentPageScroll();
  }
});

els.profileBackButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  hideProfilePage({ clearHistoryMarker: true });
  restoreContentPageScroll();
});

els.profileLogoutButton?.addEventListener("click", () => {
  els.logoutButton?.click();
});

document.querySelectorAll("[data-profile-tab], [data-profile-tab-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    state.profileTab = button.dataset.profileTab || button.dataset.profileTabJump || "bookmarks";
    state.profileSearch = "";
    state.profileVisibleLimit = 15;
    if (els.profileSearchInput) els.profileSearchInput.value = "";
    renderProfilePage();
    if (state.profileTab === "library" && state.profileLibraryMode === "records" && !state.myLibraryLoaded) {
      loadMyLibrary();
    }
  });
});

els.profileLibraryModeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-library-mode]");
  if (!button) return;
  state.profileLibraryMode = button.dataset.profileLibraryMode === "offline" ? "offline" : "records";
  state.offlineDeleteMode = false;
  state.offlineDeleteSelection.clear();
  state.profileSearch = "";
  if (els.profileSearchInput) els.profileSearchInput.value = "";
  renderProfilePage();
  if (state.profileLibraryMode === "records" && !state.myLibraryLoaded) loadMyLibrary();
  if (state.profileLibraryMode === "offline") requestOfflineBodyIds();
});

let offlineHelpToastTimer = 0;
function hideOfflineHelpToast() {
  window.clearTimeout(offlineHelpToastTimer);
  if (els.profileOfflineHelpToast) els.profileOfflineHelpToast.hidden = true;
  els.profileOfflineHelpButton?.setAttribute("aria-expanded", "false");
}

els.profileOfflineHelpButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!els.profileOfflineHelpToast) return;
  const willShow = els.profileOfflineHelpToast.hidden;
  hideOfflineHelpToast();
  if (!willShow) return;
  els.profileOfflineHelpToast.hidden = false;
  els.profileOfflineHelpButton.setAttribute("aria-expanded", "true");
  offlineHelpToastTimer = window.setTimeout(hideOfflineHelpToast, 7000);
});

document.addEventListener("click", (event) => {
  if (els.profileOfflineHelpToast?.hidden) return;
  if (event.target.closest("#profileOfflineHelpToast, #profileOfflineHelpButton")) return;
  hideOfflineHelpToast();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.profileOfflineHelpToast && !els.profileOfflineHelpToast.hidden) hideOfflineHelpToast();
});

els.profileOfflineSelectButton?.addEventListener("click", () => {
  state.offlineDeleteMode = true;
  state.offlineDeleteSelection.clear();
  renderProfilePage();
});

els.profileOfflineCancelButton?.addEventListener("click", () => {
  state.offlineDeleteMode = false;
  state.offlineDeleteSelection.clear();
  renderProfilePage();
});

els.profileOfflineDeleteSelectedButton?.addEventListener("click", async () => {
  const ids = [...state.offlineDeleteSelection].filter((id) => state.offlineBodyIds.has(id));
  if (!ids.length) return;
  if (!window.confirm(`선택한 오프라인 저장 ${ids.length}개를 이 기기에서 삭제할까요?\n작품과 계정 기록은 삭제되지 않습니다.`)) return;
  els.profileOfflineDeleteSelectedButton.disabled = true;
  try {
    await deleteOfflineBodies(ids);
    state.offlineDeleteSelection.clear();
    state.offlineDeleteMode = false;
  } catch (error) {
    console.warn(error);
    window.alert(error.message || "선택한 오프라인 저장을 삭제하지 못했습니다.");
    renderProfilePage();
  }
});

els.profileOfflineDeleteAllButton?.addEventListener("click", async () => {
  const count = state.offlineBodyIds.size;
  if (!count) return;
  if (!window.confirm(`이 기기에 저장된 오프라인 본문 ${count}개를 모두 삭제할까요?\n작품, 북마크, 이어보기, 메모 등 계정 기록은 삭제되지 않습니다.`)) return;
  els.profileOfflineDeleteAllButton.disabled = true;
  try {
    await deleteOfflineBodies([], { all: true });
    state.offlineDeleteSelection.clear();
    state.offlineDeleteMode = false;
  } catch (error) {
    console.warn(error);
    window.alert(error.message || "오프라인 저장을 모두 삭제하지 못했습니다.");
    renderProfilePage();
  }
});

els.profileSearchInput?.addEventListener("input", (event) => {
  state.profileSearch = event.target.value || "";
  state.profileVisibleLimit = 15;
  renderProfilePage();
});

els.profileList?.addEventListener("click", async (event) => {
  const offlineDelete = event.target.closest("[data-offline-delete]");
  if (offlineDelete) {
    const id = String(offlineDelete.dataset.offlineDelete || "");
    const item = state.items.find((candidate) => String(candidate.id) === id);
    if (!id || !window.confirm(`이 기기에 저장된 ${item?.title ? `「${item.title}」의 ` : ""}오프라인 본문만 삭제할까요?\n작품, 북마크, 이어보기, 메모 등 계정 기록은 삭제되지 않습니다.`)) return;
    offlineDelete.disabled = true;
    try {
      await deleteOfflineBodies([id]);
      state.offlineDeleteSelection.delete(id);
    } catch (error) {
      console.warn(error);
      window.alert(error.message || "오프라인 저장을 삭제하지 못했습니다.");
      if (offlineDelete.isConnected) offlineDelete.disabled = false;
    }
    return;
  }
  const offlineSelect = event.target.closest("[data-offline-select]");
  if (offlineSelect) {
    const id = String(offlineSelect.dataset.offlineSelect || "");
    if (offlineSelect.checked) state.offlineDeleteSelection.add(id);
    else state.offlineDeleteSelection.delete(id);
    renderProfilePage();
    return;
  }
  const libraryWork = event.target.closest("[data-library-work]");
  if (libraryWork) { openMyLibraryWork(libraryWork.dataset.libraryWork); return; }
  const open = event.target.closest("[data-profile-open]");
  if (open) {
    const item = state.items.find((candidate) => candidate.id === open.dataset.profileOpen);
    if (item) {
      // Keep the current My Info page as the reader return context.
      // The reader overlay covers the page temporarily, so closing it naturally
      // reveals the same tab/search/list/scroll state without rebuilding the page.
      openContentItem(item);
    }
    return;
  }
  const bm = event.target.closest("[data-profile-bookmark-remove]");
  if (bm) {
    const item = state.items.find((candidate) => candidate.id === bm.dataset.profileBookmarkRemove);
    if (item) {
      updateUserLibraryEntry(item.id, { bookmarked: false, updatedAt: Date.now() });
      const data = await userApi("/api/user/item", { method:"POST", body:JSON.stringify({ action:"bookmark", fileId:item.id, bookmarked:false }) });
      applyBookmarkCountResponse(item.id, data);
      renderProfilePage(); render();
    }
    return;
  }
  const recent = event.target.closest("[data-profile-recent-remove]");
  if (recent) {
    const id = recent.dataset.profileRecentRemove;
    updateUserLibraryEntry(id, { viewedAt: null, updatedAt: Date.now() });
    await userApi("/api/user/item", { method:"POST", body:JSON.stringify({ action:"remove_recent", fileId:id }) });
    renderProfilePage();
    return;
  }
  const like = event.target.closest("[data-profile-like-remove]");
  if (like) {
    const item = state.items.find((candidate) => candidate.id === like.dataset.profileLikeRemove) || { id: like.dataset.profileLikeRemove, title:"", author:"" };
    if (isItemLiked(item)) await toggleItemLike(item);
    return;
  }
  const quoteOpen = event.target.closest("[data-profile-quote-open]");
  if (quoteOpen) {
    const quote = state.savedQuotes.find((entry) => String(entry.id) === String(quoteOpen.dataset.profileQuoteOpen));
    if (!quote || quote._locationSaving) return;
    quoteOpen.disabled = true;
    const originalText = quoteOpen.textContent;
    quoteOpen.textContent = "이동 중…";
    try {
      await openSavedQuoteLocation(quote);
    } finally {
      if (quoteOpen.isConnected) {
        quoteOpen.disabled = false;
        quoteOpen.textContent = originalText;
      }
    }
    return;
  }
  const quoteShare = event.target.closest("[data-profile-quote-share]");
  if (quoteShare) {
    const quote = state.savedQuotes.find((entry) => String(entry.id) === String(quoteShare.dataset.profileQuoteShare));
    if (!quote || quote._shareSaving) return;

    quote.shared = !quote.shared;
    renderProfilePage();

    const matchedWork = state.items.find((candidate) => String(candidate.id) === String(quote.workId || "")) || state.items.find((candidate) =>
      normalizeSearchText(candidate.title) === normalizeSearchText(quote.title) &&
      normalizeSearchText(candidate.author) === normalizeSearchText(quote.author)
    );

    try {
      queueSavedQuoteShare(quote, matchedWork?.id || "");
    } catch (error) {
      console.warn("문장 공개 상태 변경 실패", error);
      quote.shared = quote._persistedShared === true;
      renderProfilePage();
      window.alert("문장 공개 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    }
    return;
  }
  const copy = event.target.closest("[data-profile-quote-copy]");
  if (copy) {
    const quote = state.savedQuotes.find((entry) => String(entry.id) === String(copy.dataset.profileQuoteCopy));
    if (quote) {
      try { await navigator.clipboard.writeText(quote.quoteText); copy.textContent = "복사됨"; setTimeout(()=>copy.textContent="복사",900); } catch { window.alert("문장을 복사하지 못했습니다."); }
    }
    return;
  }
  const del = event.target.closest("[data-profile-quote-delete]");
  if (del) {
    const id = Number(del.dataset.profileQuoteDelete || 0);
    if (!id || !window.confirm("저장한 문장을 삭제할까요?")) return;
    await userApi("/api/user/profile", { method:"POST", body:JSON.stringify({ action:"quote_delete", id }) });
    state.savedQuotes = state.savedQuotes.filter((entry) => entry.id !== id);
    if (state.savedQuotesLoaded) state.savedQuoteCount = state.savedQuotes.length;
    else if (Number.isFinite(state.savedQuoteCount)) state.savedQuoteCount = Math.max(0, state.savedQuoteCount - 1);
    renderProfilePage();
  }
});



els.myLibraryModalTabs?.addEventListener("click", (event) => {
  const b=event.target.closest("[data-library-detail-tab]"); if(!b) return;
  state.myLibraryDetailTab=b.dataset.libraryDetailTab||"all"; renderMyLibraryModal();
});
els.myLibraryModalList?.addEventListener("click", async (event) => {
  const quoteCopy=event.target.closest("[data-library-quote-copy]");
  if(quoteCopy){ const q=state.savedQuotes.find(x=>x.id===Number(quoteCopy.dataset.libraryQuoteCopy)); if(q){ try{await navigator.clipboard.writeText(q.quoteText); quoteCopy.textContent="복사됨"; setTimeout(()=>{if(quoteCopy.isConnected)quoteCopy.textContent="복사"},800);}catch{alert("문장을 복사하지 못했습니다.");} } return; }
  const quoteDelete=event.target.closest("[data-library-quote-delete]");
  if(quoteDelete){ const id=Number(quoteDelete.dataset.libraryQuoteDelete||0); if(id&&confirm("저장한 문장을 삭제할까요?")){ await userApi("/api/user/profile",{method:"POST",body:JSON.stringify({action:"quote_delete",id})}); state.savedQuotes=state.savedQuotes.filter(q=>q.id!==id); state.savedQuoteCount=state.savedQuotes.length; renderMyLibraryModal(); renderProfilePage(); } return; }
  const quoteShare=event.target.closest("[data-library-quote-share]");
  if(quoteShare){ const q=state.savedQuotes.find(x=>x.id===Number(quoteShare.dataset.libraryQuoteShare||0)); if(q&&!q._shareSaving){ q.shared=!q.shared; renderMyLibraryModal(); const item=state.items.find(x=>String(x.id)===String(q.workId)); try{ queueSavedQuoteShare(q,item?.id||q.workId||""); }catch(error){q.shared=!q.shared; renderMyLibraryModal(); alert(error.message||"공개 상태를 변경하지 못했습니다.");} } return; }
  const edit=event.target.closest("[data-library-note-edit]");
  if(edit){
    const id=Number(edit.dataset.libraryNoteEdit||0);
    const note=state.readerNotes.find(n=>n.id===id);
    if(!note) return;
    const bd=document.createElement("div");
    bd.className="reader-memo-backdrop";
    bd.innerHTML=`<section class="reader-memo-dialog" role="dialog" aria-modal="true"><h3>메모 수정</h3>${note.quoteText?`<p class="reader-memo-quote">${escapeHtml(note.quoteText)}</p>`:""}<textarea class="reader-memo-input" maxlength="4000" placeholder="메모를 입력하세요.">${escapeHtml(note.noteText)}</textarea><div class="reader-memo-actions"><button type="button" data-note-edit-cancel>취소</button><button type="button" class="primary" data-note-edit-save>저장</button></div></section>`;
    document.body.appendChild(bd);
    const input=bd.querySelector(".reader-memo-input");
    const close=()=>bd.remove();
    bd.addEventListener("click",e=>{if(e.target===bd)close();});
    bd.querySelector("[data-note-edit-cancel]")?.addEventListener("click",close);
    bd.querySelector("[data-note-edit-save]")?.addEventListener("click",async()=>{
      const noteText=String(input?.value||"").trim(); if(!noteText){input?.focus();return;}
      const btn=bd.querySelector("[data-note-edit-save]"); btn.disabled=true;
      try{
        const data=await userApi("/api/user/profile",{method:"POST",body:JSON.stringify({action:"note_update",id,noteText})});
        Object.assign(note,normalizeReaderNote(data.note));
        close(); renderMyLibraryModal(); renderProfilePage();
      }catch(error){alert(error.message||"메모를 수정하지 못했습니다.");btn.disabled=false;}
    });
    requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(input.value.length,input.value.length);});
    return;
  }
  const del=event.target.closest("[data-library-note-delete]");
  if(del){ const id=Number(del.dataset.libraryNoteDelete||0); if(id && confirm("메모를 삭제할까요?")){ await userApi("/api/user/profile",{method:"POST",body:JSON.stringify({action:"note_delete",id})}); state.readerNotes=state.readerNotes.filter(n=>n.id!==id); renderMyLibraryModal(); renderProfilePage(); } return; }
  const open=event.target.closest("[data-library-open-location]"); if(!open) return;
  const kind=open.dataset.libraryOpenLocation, id=Number(open.dataset.libraryEntryId||0);
  const entry=kind==="quote"?state.savedQuotes.find(x=>x.id===id):state.readerNotes.find(x=>x.id===id); if(!entry) return;
  const item=state.items.find(x=>String(x.id)===String(entry.workId)); if(!item) return;
  // Keep My Library as the return context. The reader temporarily covers it,
  // and closing the reader restores the same work-detail modal instead of
  // dropping the user back to the library work list.
  state.readerReturnToMyLibrary = Boolean(state.profileOpen && state.myLibraryDetailWorkId);
  closeModal(els.myLibraryModal);
  const offset=Number(entry.startOffset);
  await openReader(item);
  // Source jumps are temporary navigation to a saved sentence/note.
  // Scroll mode: place the target line at the vertical center of the viewport.
  // Page mode: the scroll body is hidden, so render the page itself around the
  // saved text offset instead of trying to scroll the hidden scroll-mode DOM.
  if(Number.isFinite(offset)) {
    window.requestAnimationFrame(async () => {
      const safeOffset = clampReaderTextOffset(offset);
      if (state.readerDisplayMode === "page") {
        const forwardEnd = findReaderPageEnd(safeOffset);
        const forwardChars = Math.max(1, forwardEnd - safeOffset);
        const centeredStart = clampReaderTextOffset(
          safeOffset - Math.floor(forwardChars / 2)
        );
        renderReaderPageAt(centeredStart, { navigated: true });
        return;
      }
      await scrollReaderToTextOffset(safeOffset, { viewportRatio: 0.5 });
    });
  }
});

els.profileMoreButton?.addEventListener("click", () => {
  state.profileVisibleLimit += 15;
  renderProfilePage();
});

els.profileClearButton?.addEventListener("click", async () => {
  if (!state.user) return;
  const kind = state.profileTab;
  if (kind !== "bookmarks" && kind !== "recent") return;
  const message = kind === "bookmarks"
    ? "저장된 북마크를 모두 삭제할까요?"
    : "최근 본 작품 기록을 모두 삭제할까요?";
  if (!window.confirm(message)) return;

  els.profileClearButton.disabled = true;
  try {
    await userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify({ action: kind === "bookmarks" ? "clear_bookmarks" : "clear_recent" }),
    });
    for (const [fileId, entry] of state.userLibrary.entries()) {
      state.userLibrary.set(fileId, kind === "bookmarks"
        ? { ...entry, bookmarked: false }
        : { ...entry, viewedAt: null });
    }
    if (kind === "bookmarks" && state.bookmarkCountsLoaded) {
      try { await loadBookmarkCounts(true); } catch (error) { console.warn("북마크 순위 새로고침 실패", error); }
    }
    state.profileVisibleLimit = 15;
    renderProfilePage();
    render();
    updateReaderBookmarkButton();
  } catch (error) {
    console.warn(error);
    window.alert(error.message || "기록을 삭제하지 못했습니다.");
  } finally {
    els.profileClearButton.disabled = false;
  }
});

els.librarySearchInput?.addEventListener("input", (event) => {
  state.librarySearch = event.target.value || "";
  state.libraryVisibleLimit = LIBRARY_PAGE_SIZE;
  renderUserLibraryModal();
  resetUserLibraryScroll();
});

els.libraryMoreButton?.addEventListener("click", () => {
  state.libraryVisibleLimit += LIBRARY_PAGE_SIZE;
  renderUserLibraryModal();
});

els.libraryClearButton?.addEventListener("click", async () => {
  if (!state.user) return;

  const kind = state.libraryKind;
  const message =
    kind === "bookmarks"
      ? "저장된 북마크를 모두 해제할까요?"
      : "최근 조회 기록을 모두 삭제할까요?";

  if (!window.confirm(message)) return;

  els.libraryClearButton.disabled = true;

  try {
    await userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify({
        action: kind === "bookmarks" ? "clear_bookmarks" : "clear_recent",
      }),
    });

    for (const [fileId, entry] of state.userLibrary.entries()) {
      if (kind === "bookmarks") {
        state.userLibrary.set(fileId, { ...entry, bookmarked: false });
      } else {
        state.userLibrary.set(fileId, { ...entry, viewedAt: null });
      }
    }

    if (kind === "bookmarks" && state.bookmarkCountsLoaded) {
      try { await loadBookmarkCounts(true); } catch (error) { console.warn("북마크 순위 새로고침 실패", error); }
    }
    state.librarySearch = "";
    if (els.librarySearchInput) els.librarySearchInput.value = "";
    state.libraryVisibleLimit = LIBRARY_PAGE_SIZE;
    renderUserLibraryModal();
    resetUserLibraryScroll();
    render();
    updateReaderBookmarkButton();
  } catch (error) {
    console.warn(error);
    window.alert(error.message || "기록을 삭제하지 못했습니다.");
  } finally {
    els.libraryClearButton.disabled = false;
  }
});

els.libraryModalList?.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-library-remove]");

  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();

    const fileId = removeButton.dataset.libraryRemove;
    const kind = state.libraryKind;

    try {
      const data = await userApi("/api/user/item", {
        method: "POST",
        body: JSON.stringify({
          action: kind === "bookmarks" ? "bookmark" : "remove_recent",
          fileId,
          bookmarked: false,
        }),
      });
      if (kind === "bookmarks") applyBookmarkCountResponse(fileId, data);

      const current = getUserLibraryEntry(fileId);
      if (current) {
        updateUserLibraryEntry(
          fileId,
          kind === "bookmarks"
            ? { bookmarked: false, updatedAt: Date.now() }
            : { viewedAt: null, updatedAt: Date.now() }
        );
      }

      state.libraryVisibleLimit = Math.max(LIBRARY_PAGE_SIZE, Math.min(state.libraryVisibleLimit, getLibraryVisibleEntries().length || LIBRARY_PAGE_SIZE));
      renderUserLibraryModal();
      render();
      updateReaderBookmarkButton();
    } catch (error) {
      console.warn(error);
    }

    return;
  }

  const openButton = event.target.closest("[data-library-open]");
  if (!openButton) return;

  const item = state.items.find(
    (candidate) => candidate.id === openButton.dataset.libraryOpen
  );
  if (!item) return;

  closeModal(els.libraryModal);
  openContentItem(item);
});

function dismissSimpleModal(modal) {
  if (!modal) return;

  // 작품 내 검색은 뷰어 위에 겹쳐 뜨는 보조 모달이다.
  // history.back()을 사용하면 같은 popstate에서 뷰어까지 닫힐 수 있으므로
  // 검색 모달만 직접 닫고 현재 뷰어 history는 유지한다.
  if (modal === els.readerSearchModal) {
    closeModal(modal);
    return;
  }

  if (history.state?.rjsSimpleModal) {
    history.back();
    return;
  }
  closeModal(modal);
}

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    dismissSimpleModal(document.getElementById(button.dataset.closeModal));
  });
});

document.addEventListener("click", (event) => {
  const overlay = event.target instanceof Element ? event.target.closest(".simple-modal-overlay") : null;
  if (!overlay || overlay.hidden || event.target !== overlay) return;

  // Close only after the complete click gesture has resolved. Closing on
  // pointerdown can expose the content underneath before the browser emits
  // the follow-up click, causing the tap to activate a background card.
  event.preventDefault();
  event.stopPropagation();
  dismissSimpleModal(overlay);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;

  const modalOverlay = getOpenSimpleModal();
  if (!modalOverlay) return;

  const dialog = modalOverlay.querySelector(".simple-modal");
  if (!dialog) return;

  const focusable = Array.from(
    dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden) return false;
    if (element.closest("[hidden]")) return false;
    return element.getClientRects().length > 0;
  });

  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  } else if (!dialog.contains(active)) {
    event.preventDefault();
    first.focus();
  }
});


function setSearchValue(value, source = "main", { renderResults = true } = {}) {
  disableInitialRecentPostypeBoost();
  state.search = String(value || "");

  if (source !== "main" && els.searchInput) {
    els.searchInput.value = state.search;
  }

  if (source !== "compact" && els.compactSearchInput) {
    els.compactSearchInput.value = state.search;
  }

  els.clearSearch?.classList.toggle("visible", Boolean(state.search));
  els.compactClearSearch?.classList.toggle("visible", Boolean(state.search));
  if (renderResults) render();
}

let archiveSearchRenderTimer = 0;
let mainSearchComposing = false;
let compactSearchComposing = false;
const ARCHIVE_SEARCH_RENDER_DELAY_MS = 90;

function cancelArchiveSearchRender() {
  if (!archiveSearchRenderTimer) return;
  window.clearTimeout(archiveSearchRenderTimer);
  archiveSearchRenderTimer = 0;
}

function scheduleArchiveSearchRender(delay = ARCHIVE_SEARCH_RENDER_DELAY_MS) {
  cancelArchiveSearchRender();
  archiveSearchRenderTimer = window.setTimeout(() => {
    archiveSearchRenderTimer = 0;
    render();
  }, Math.max(0, Number(delay) || 0));
}

let mainHeaderCompactActive = false;
let mainHeaderCompactEnterScrollY = null;
const MAIN_HEADER_COMPACT_RELEASE_GAP = 64;


function updateCompactHeader() {
  if (!els.siteHeader || !els.heroSearchBox) return;

  if (document.body.classList.contains("reader-open")) {
    mainHeaderCompactActive = false;
    mainHeaderCompactEnterScrollY = null;
    els.siteHeader.classList.remove("compact-mode");
    return;
  }

  // Compact mode changes the header height/layout. If the decision keeps using
  // getBoundingClientRect() after that change, the layout movement itself can
  // immediately satisfy the opposite condition and cause a flicker loop.
  // Calculate the entry point only while the normal header is active, then keep
  // that scroll position fixed until the user actually scrolls far enough up.
  if (!mainHeaderCompactActive) {
    const searchRect = els.heroSearchBox.getBoundingClientRect();
    const enterThreshold = Math.max(54, Math.min(88, Math.round((els.siteHeader.offsetHeight || 64) + 6)));

    if (searchRect.top <= enterThreshold) {
      mainHeaderCompactEnterScrollY = Math.max(0, window.scrollY);
      mainHeaderCompactActive = true;
      els.siteHeader.classList.add("compact-mode");
    }
    return;
  }

  // Filtering can shorten the document enough for the browser to clamp
  // scrollY while the compact search field is still being edited. Keep the
  // compact header stable until typing finishes so the input does not vanish
  // and interrupt IME / keyboard entry mid-search.
  if (document.activeElement === els.compactSearchInput) {
    els.siteHeader.classList.add("compact-mode");
    return;
  }

  const enterScrollY = Number.isFinite(mainHeaderCompactEnterScrollY)
    ? mainHeaderCompactEnterScrollY
    : window.scrollY;
  const releaseScrollY = Math.max(0, enterScrollY - MAIN_HEADER_COMPACT_RELEASE_GAP);

  if (window.scrollY <= releaseScrollY) {
    mainHeaderCompactActive = false;
    mainHeaderCompactEnterScrollY = null;
    els.siteHeader.classList.remove("compact-mode");
  }
}

els.searchInput.addEventListener("compositionstart", () => {
  mainSearchComposing = true;
  cancelArchiveSearchRender();
});

els.searchInput.addEventListener("compositionend", (event) => {
  mainSearchComposing = false;
  setSearchValue(event.target.value, "main", { renderResults: false });
  scheduleArchiveSearchRender(0);
});

els.searchInput.addEventListener("input", (event) => {
  setSearchValue(event.target.value, "main", { renderResults: false });
  scheduleAnalyticsSearch(event.target.value);

  if (!mainSearchComposing && !event.isComposing) {
    scheduleArchiveSearchRender();
  }
});

els.compactSearchInput?.addEventListener("compositionstart", () => {
  compactSearchComposing = true;
  cancelArchiveSearchRender();
});

els.compactSearchInput?.addEventListener("compositionend", (event) => {
  compactSearchComposing = false;
  setSearchValue(event.target.value, "compact", { renderResults: false });
  scheduleArchiveSearchRender(0);
});

els.compactSearchInput?.addEventListener("input", (event) => {
  setSearchValue(event.target.value, "compact", { renderResults: false });
  scheduleAnalyticsSearch(event.target.value);

  // A full archive render on every IME composition update can make Korean
  // input feel as if it is stopping between syllables. Coalesce ordinary
  // keystrokes briefly and render once after composition is committed.
  if (!compactSearchComposing && !event.isComposing) {
    scheduleArchiveSearchRender();
  }
});

els.clearSearch.addEventListener("click", () => {
  cancelArchiveSearchRender();
  setSearchValue("", "main");
  els.searchInput.focus();
});

els.compactClearSearch?.addEventListener("click", () => {
  cancelArchiveSearchRender();
  setSearchValue("", "compact");
  els.compactSearchInput?.focus();
});

els.tabletCombinationSelect?.addEventListener("change", (event) => {
  disableInitialRecentPostypeBoost();
  state.combination = event.target.value;
  syncFilterChipGroup(els.combinationFilters, "combination", state.combination);
  render();
});

els.tabletContentTypeSelect?.addEventListener("change", (event) => {
  disableInitialRecentPostypeBoost();
  state.contentType = event.target.value;
  syncFilterChipGroup(els.contentTypeFilters, "contentType", state.contentType);
  render();
});

els.tabletStatusSelect?.addEventListener("change", (event) => {
  disableInitialRecentPostypeBoost();
  state.statusFilter = event.target.value;
  syncFilterChipGroup(els.statusFilters, "statusFilter", state.statusFilter);
  render();
});

els.tabletSourceSelect?.addEventListener("change", (event) => {
  disableInitialRecentPostypeBoost();
  state.source = event.target.value;
  syncSourceFilterChips();
  render();
});

els.tabletFilterBar?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tablet-view]");
  if (!button) return;
  setView(button.dataset.tabletView);
});

els.combinationFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-combination]");
  if (!button) return;

  disableInitialRecentPostypeBoost();
  state.combination = button.dataset.combination;
  syncFilterChipGroup(els.combinationFilters, "combination", state.combination);
  render();
});

els.contentTypeFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-content-type]");
  if (!button) return;

  disableInitialRecentPostypeBoost();
  state.contentType = button.dataset.contentType;
  syncFilterChipGroup(els.contentTypeFilters, "contentType", state.contentType);

  render();
});

els.statusFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status-filter]");
  if (!button) return;

  disableInitialRecentPostypeBoost();
  state.statusFilter = button.dataset.statusFilter;
  syncFilterChipGroup(els.statusFilters, "statusFilter", state.statusFilter);

  render();
});

els.sourceFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-source]");
  if (!button) return;

  disableInitialRecentPostypeBoost();
  state.source = button.dataset.source;
  syncFilterChipGroup(els.sourceFilters, "source", state.source);
  render();
});

function findItemFromEvent(event) {
  const target = event.target.closest("[data-id]");
  if (!target) return null;
  return state.items.find((entry) => entry.id === target.dataset.id);
}

function openPostypeQuoteComposer(item) {
  if (!item || item.source !== "postype") return;
  openReaderShareSheet({ allowEmpty: true, presetText: "", sourceItem: item });
}

function openContentItem(item) {
  if (!item) return;

  recordAnalyticsWorkOpen(item.source !== "postype");

  if (item.source === "postype") {
    if (!item.url) return;
    recordRecentView(item);
    window.open(item.url, "_blank", "noopener,noreferrer");
    return;
  }

  openReader(item);
}

function handleContentOpenClick(event) {
  const likeButton = event.target.closest("[data-item-like]");
  if (likeButton) {
    event.preventDefault();
    event.stopPropagation();
    const item = state.items.find((entry) => entry.id === likeButton.dataset.itemLike);
    toggleItemLike(item);
    return;
  }

  const listBookmarkButton = event.target.closest("[data-list-bookmark]");
  if (listBookmarkButton) {
    event.preventDefault();
    event.stopPropagation();
    const item = state.items.find((entry) => entry.id === listBookmarkButton.dataset.listBookmark);
    const details = listBookmarkButton.closest("details[data-list-more]");
    if (details) details.open = false;
    toggleListBookmark(item);
    return;
  }

  const driveBookmarkButton = event.target.closest("[data-drive-bookmark]");
  if (driveBookmarkButton) {
    event.preventDefault();
    event.stopPropagation();
    const item = state.items.find((entry) => entry.id === driveBookmarkButton.dataset.driveBookmark);
    toggleListBookmark(item);
    return;
  }

  const postypeBookmarkButton = event.target.closest("[data-postype-bookmark]");
  if (postypeBookmarkButton) {
    event.preventDefault();
    event.stopPropagation();

    const item = state.items.find(
      (entry) => entry.id === postypeBookmarkButton.dataset.postypeBookmark
    );
    togglePostypeBookmark(item);
    return;
  }

  const quoteButton = event.target.closest("[data-item-quote]");
  if (quoteButton) {
    event.preventDefault();
    event.stopPropagation();
    const item = state.items.find((entry) => entry.id === quoteButton.dataset.itemQuote);
    openPostypeQuoteComposer(item);
    return;
  }

  const listShareButton = event.target.closest("[data-list-share]");
  if (listShareButton) {
    event.preventDefault();
    event.stopPropagation();
    const details = listShareButton.closest("details[data-list-more]");
    if (details) details.open = false;
    const item = state.items.find((entry) => entry.id === listShareButton.dataset.listShare);
    if (item) void shareWorkLink(item);
    return;
  }

  const downloadButton = event.target.closest("[data-download-id]");
  if (downloadButton) {
    event.stopPropagation();
    const details = downloadButton.closest("details[data-list-more]");
    if (details) details.open = false;

    const item = state.items.find(
      (entry) => entry.id === downloadButton.dataset.downloadId
    );
    recordTxtDownload(item);
    return;
  }

  if (event.target.closest("details[data-list-more]")) {
    event.stopPropagation();
    return;
  }

  openContentItem(findItemFromEvent(event));
}

function closeOtherListMoreMenus(openDetails) {
  els.contentListBody?.querySelectorAll('details[data-list-more][open]').forEach((details) => {
    if (details !== openDetails) details.open = false;
  });
}

els.contentListBody?.addEventListener("toggle", (event) => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.matches('details[data-list-more]')) return;
  if (details.open) closeOtherListMoreMenus(details);
  const row = details.closest('tr');
  if (row) row.classList.toggle('list-more-open', details.open);
}, true);

document.addEventListener("click", (event) => {
  if (event.target.closest('details[data-list-more]')) return;
  closeOtherListMoreMenus(null);
});

els.contentGrid.addEventListener("click", handleContentOpenClick);
els.contentListBody.addEventListener("click", handleContentOpenClick);

els.loadMoreButton?.addEventListener("click", () => {
  state.visibleItemLimit += CONTENT_PAGE_SIZE;
  render();
});

for (const container of [els.contentGrid, els.contentListBody]) {
  container.addEventListener("keydown", (event) => {
    if (
      event.target.closest("[data-download-id]") ||
      event.target.closest("[data-list-share]") ||
      event.target.closest("[data-postype-bookmark]") ||
      event.target.closest("[data-drive-bookmark]") ||
      event.target.closest("[data-item-like]") ||
      event.target.closest("[data-item-quote]")
    ) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = findItemFromEvent(event);
    if (!item) return;
    event.preventDefault();
    openContentItem(item);
  });
}


els.bookmarkOnlyButton?.addEventListener("click", () => {
  if (
    !requireLoginForPersonalFilter(
      "북마크한 작품만 모아보려면 로그인해 주세요."
    )
  ) return;

  disableInitialRecentPostypeBoost();
  state.bookmarkOnly = !state.bookmarkOnly;
  syncQuickFilterButtons();
  render();
});

els.readingOnlyButton?.addEventListener("click", () => {
  if (
    !requireLoginForPersonalFilter(
      "읽는 중인 작품을 모아보려면 로그인해 주세요."
    )
  ) return;

  disableInitialRecentPostypeBoost();
  state.readingOnly = !state.readingOnly;
  syncQuickFilterButtons();
  render();
});

els.resumeShortcutButton?.addEventListener("click", () => {
  if (!state.user) {
    openAuthModal(
      "login",
      "최근 읽던 작품을 이어보려면 로그인해 주세요."
    );
    return;
  }

  const item = state.items.find(
    (candidate) => candidate.id === state.resumeShortcutItemId
  );

  if (item) openReader(item);
});

els.cardViewButton.addEventListener("click", () => setView("card"));
els.listViewButton.addEventListener("click", () => setView("list"));
els.closeReader.addEventListener("click", closeReader);
els.readerWorkShareButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const menu = els.readerWorkShareMenu;
  if (!menu || !state.activeReaderItem) return;
  const willOpen = menu.hidden;
  closeReaderWorkShareMenu();
  menu.hidden = !willOpen;
  els.readerWorkShareButton.setAttribute("aria-expanded", String(willOpen));
});
els.readerMoreButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const menu = els.readerMoreMenu;
  if (!menu || !state.activeReaderItem) return;
  const willOpen = menu.hidden;
  closeReaderWorkShareMenu();
  menu.hidden = !willOpen;
  els.readerMoreButton.setAttribute("aria-expanded", String(willOpen));
});
els.readerMoreDownloadButton?.addEventListener("click", () => {
  closeReaderWorkShareMenu();
  els.readerDownloadButton?.click(); // Existing download handler and analytics.
});
els.readerMoreLinkCopyButton?.addEventListener("click", async () => {
  const item = state.activeReaderItem;
  closeReaderWorkShareMenu();
  if (item) await copyWorkShareLink(item, els.readerMoreLinkCopyButton);
});
els.readerMoreSystemShareButton?.addEventListener("click", () => {
  const item = state.activeReaderItem;
  closeReaderWorkShareMenu();
  if (item) void shareWorkLink(item);
});
els.readerWorkLinkCopyButton?.addEventListener("click", async () => {
  const item = state.activeReaderItem;
  closeReaderWorkShareMenu();
  if (item) await copyWorkShareLink(item, els.readerWorkLinkCopyButton);
});
els.readerWorkSystemShareButton?.addEventListener("click", () => {
  const item = state.activeReaderItem;
  closeReaderWorkShareMenu();
  if (item) void shareWorkLink(item);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest?.("#readerWorkShareButton, #readerWorkShareMenu, #readerMoreButton, #readerMoreMenu")) closeReaderWorkShareMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeReaderWorkShareMenu();
});
els.sharedWorkOpenButton?.addEventListener("click", () => {
  const item = incomingSharedWorkItem;
  if (!item) return;
  closeModal(els.sharedWorkModal);
  openContentItem(item);
});
els.readerOverlay?.addEventListener("click", (event) => {
  const positionTrigger = event.target.closest?.("#readerPositionStatus, .reader-page-progress");
  if (positionTrigger) {
    event.preventDefault();
    event.stopPropagation();
    if (els.readerSeekFloat?.hidden) openReaderSeekFloat();
    else closeReaderSeekFloat();
    return;
  }
  if (event.target.closest?.("#readerSeekFloat")) return;
  if (els.readerSeekFloat && !els.readerSeekFloat.hidden && event.target.closest?.("#readerPanel")) {
    closeReaderSeekFloat();
  }
});
els.readerPositionStatus?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openReaderSeekFloat();
});
els.readerPageViewport?.addEventListener("keydown", (event) => {
  if (!event.target.closest?.(".reader-page-progress")) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openReaderSeekFloat();
});
els.readerSeekRange?.addEventListener("input", scheduleReaderSeekMove);
els.readerSeekRange?.addEventListener("change", () => moveReaderToSeekPosition({ persist: true }));
function openReaderSearchModalFromKeyboard() {
  if (!state.readerText || els.readerOverlay?.hidden || !els.readerSearchModal) return false;

  const openSimpleModal = getOpenSimpleModal();
  const auxiliaryUiOpen = Boolean(
    (openSimpleModal && openSimpleModal !== els.readerSearchModal) ||
    document.querySelector('.reader-share-backdrop:not([hidden]), .reader-memo-backdrop')
  );
  if (auxiliaryUiOpen) return false;

  openModal(els.readerSearchModal);
  window.setTimeout(() => {
    if (!(els.readerSearchInput instanceof HTMLInputElement)) return;
    els.readerSearchInput.focus({ preventScroll: true });
    els.readerSearchInput.select();
  }, 0);
  return true;
}

els.readerSearchOpenButton?.addEventListener("click", () => {
  if (!state.readerText) return;
  openModal(els.readerSearchModal);
});

window.addEventListener("keydown", (event) => {
  const isFindShortcut =
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    String(event.key || "").toLowerCase() === "f";

  if (!isFindShortcut || els.readerOverlay?.hidden || event.defaultPrevented) return;
  if (!openReaderSearchModalFromKeyboard()) return;

  event.preventDefault();
});

els.readerSearchButton?.addEventListener("click", runReaderSearchCount);
els.readerSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  runReaderSearchCount();
});
els.readerSearchRows?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-reader-search-offset]");
  if (!row) return;
  const offset = Number(row.dataset.readerSearchOffset);
  if (!Number.isFinite(offset)) return;
  moveReaderToSearchOffset(offset);
});
els.readerSearchPrevPage?.addEventListener("click", () => {
  if ((state.readerSearchPage || 0) <= 0) return;
  state.readerSearchPage -= 1;
  renderReaderSearchResults();
});
els.readerSearchNextPage?.addEventListener("click", () => {
  const total = Array.isArray(state.readerSearchMatches) ? state.readerSearchMatches.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / READER_SEARCH_PAGE_SIZE));
  if ((state.readerSearchPage || 0) >= totalPages - 1) return;
  state.readerSearchPage += 1;
  renderReaderSearchResults();
});

els.readerOverlay.addEventListener("click", (event) => {
  if (event.target === els.readerOverlay) closeReader();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const openSimpleModal = getOpenSimpleModal();

  if (openSimpleModal) {
    dismissSimpleModal(openSimpleModal);
    return;
  }

  if (!els.readerOverlay.hidden) closeReader();
});



function flushReaderProgressBeforePageExit() {
  const item = state.activeReaderItem;
  if (!state.user || !item || state.suspendReaderProgressSave) return;

  const saved = saveReaderProgress();
  if (!saved) return;

  // pagehide/visibilitychange may be the last JavaScript we get to run.
  // Persist the newest point locally even if the keepalive request cannot finish.
  writeLocalReaderProgress(item, saved, { force: true });

  if (!shouldPersistProgress(item.id, saved)) return;

  const token = getAuthToken();
  if (!token) return;

  const payload = buildProgressPayload(item, saved);
  const signature = getProgressPayloadSignature(payload);

  // If the normal progress save is already sending this exact position, an
  // exit event must not duplicate it. This is the common overlap between the
  // 1-minute save, reader close and mobile background/pagehide events.
  if (state.progressSavePending.get(item.id) === signature) {
    return;
  }

  const now = Date.now();
  if (
    signature === state.lastExitProgressSignature &&
    now - state.lastExitProgressAt < 1500
  ) {
    return;
  }

  state.lastExitProgressSignature = signature;
  state.lastExitProgressAt = now;

  fetch("/api/user/item", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {});
}

window.addEventListener("pagehide", (event) => {
  flushReaderProgressBeforePageExit();
  // bfcache로 잠시 보관되는 페이지는 타이머가 복귀 후 계속 실행되므로 중복 요청을 만들지 않는다.
  if (!event.persisted) flushPendingBookmarkSavesBeforePageExit();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushReaderProgressBeforePageExit();
  }
});

let readerProgressSaveTimer = 0;
let readerPositionStatusTimer = 0;
let readerCompactActive = false;
let readerCompactFrame = 0;

function setReaderCompactActive(active) {
  if (!els.readerPanel) return;

  const next = Boolean(active);
  if (next === readerCompactActive) return;

  readerCompactActive = next;

  window.cancelAnimationFrame(readerCompactFrame);
  readerCompactFrame = window.requestAnimationFrame(() => {
    els.readerPanel?.classList.toggle(
      "reader-compact",
      readerCompactActive
    );
  });
}

function syncReaderCompactMode(scrollTop) {
  if (!els.readerPanel) return;

  // Compacting the sticky header changes its own height, which can change
  // scrollTop again in the same frame. Use a wide hysteresis and apply the
  // class only once per animation frame so the two modes cannot bounce.
  const shouldCompact =
    readerCompactActive
      ? scrollTop > 6
      : scrollTop >= 180;

  if (shouldCompact === readerCompactActive) return;
  setReaderCompactActive(shouldCompact);
}

function updateReaderScrollUi() {
  if (!els.readerPanel) return;
  if (state.readerDisplayMode === "page") return;

  const scrollTop = els.readerPanel.scrollTop;

  window.clearTimeout(readerProgressSaveTimer);
  readerProgressSaveTimer = 0;

  // Initial layout and programmatic resume moves intentionally suspend
  // progress saving. Do not even enqueue a delayed save while suspended:
  // otherwise the callback may fire after suspension is released and write
  // the temporary 0% layout position over the real saved progress.
  if (!state.suspendReaderProgressSave) {
    readerProgressSaveTimer = window.setTimeout(() => {
      const saved = saveReaderProgress();
      const item = state.activeReaderItem;

      if (
        saved &&
        state.user &&
        item &&
        shouldSyncProgressNow(item.id, saved)
      ) {
        persistProgress(item, saved);
      }
    }, 260);
  }

  syncReaderCompactMode(scrollTop);

  window.clearTimeout(readerPositionStatusTimer);
  readerPositionStatusTimer = window.setTimeout(() => {
    readerPositionStatusTimer = 0;
    updateReaderPositionStatus();
  }, 160);

  els.readerScrollTop?.classList.toggle(
    "visible",
    scrollTop > 180
  );

  maybeRenderMoreLargeReader();
}

els.readerPanel?.addEventListener("scroll", updateReaderScrollUi, {
  passive: true,
});

if (IS_SAFARI_READER) {
  els.readerPanel?.addEventListener("touchend", () => {
    window.requestAnimationFrame(() => {
      maybeRenderMoreLargeReader();
    });
  }, {
    passive: true,
  });

  window.visualViewport?.addEventListener("resize", () => {
    if (
      els.readerOverlay?.hidden ||
      state.readerDisplayMode === "page"
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      maybeRenderMoreLargeReader();
    });
  }, {
    passive: true,
  });
}


els.readerScrollTop?.addEventListener("click", () => {
  els.readerPanel?.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});

// v10.07: isolated original Canvas effects from the supplied eight-preset lab.
// v10.08: curated presets from quote-new-design-gallery (1).html
const READER_SHARE_CURATED_SET1 = (() => {
/* ============ 공용: 장면(scene) → SVG data-URI(CSS) / Canvas 동시 렌더 ============ */
const W=380, TAU=Math.PI*2;
const SAMPLE={text:"어떤 계절은 지나간 뒤에야 비로소 아름다웠다는 걸 알게 된다. 우리는 그때의 마음을 오래도록 기억한다.",title:"어느 계절의 기록",author:"예시 작가",brand:"셩냥책"};
const RATIOS={"1:1":{k:1,top:.13,bot:.15},"4:5":{k:1.25,top:.12,bot:.13},"2:3":{k:1.5,top:.115,bot:.115}};
const FONTS={sans:'"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif',serif:'"Noto Serif KR","Nanum Myeongjo","AppleMyungjo","Batang",serif'};
const CAT="M8.3 11.6 6.7 6.8l5.1 2.7A11.7 11.7 0 0 1 16 8.7c1.5 0 2.9.3 4.2.8l5.1-2.7-1.6 4.8a9.2 9.2 0 0 1 2 5.7c0 5.2-4.3 9-9.7 9s-9.7-3.8-9.7-9c0-2.2.7-4.1 2-5.7Z";
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const lerp=(a,b,t)=>a+(b-a)*t, f2=n=>+n.toFixed(2);
const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,t)=>{const A=hex2(a),B=hex2(b);return '#'+A.map((v,i)=>Math.round(lerp(v,B[i],t)).toString(16).padStart(2,'0')).join('')};
const newScene=()=>({defs:[],shapes:[]});
const add=(sc,s)=>(sc.shapes.push(s),s);

function parseRGBA(c){const m=/rgba?\(([^)]+)\)/.exec(c);if(!m)return{c,a:1};const p=m[1].split(',').map(s=>s.trim());return{c:`rgb(${p[0]},${p[1]},${p[2]})`,a:p[3]==null?1:+p[3]}}
function stopsSVG(st){return st.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}
function toSVG(sc,H){
  let defs='',body='';
  sc.defs.forEach(d=>{
    if(d.k==='lin')defs+=`<linearGradient id="${d.id}" gradientUnits="userSpaceOnUse" x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}">${stopsSVG(d.st)}</linearGradient>`;
    else if(d.k==='rad')defs+=`<radialGradient id="${d.id}" gradientUnits="userSpaceOnUse" cx="${d.cx}" cy="${d.cy}" r="${d.r}" fx="${d.fx??d.cx}" fy="${d.fy??d.cy}">${stopsSVG(d.st)}</radialGradient>`;
    else if(d.k==='clip')defs+=`<clipPath id="${d.id}">${shapeTag(d.shape,'')}</clipPath>`;
  });
  sc.shapes.forEach((s,i)=>{
    if(s.sh){const q=parseRGBA(s.sh[0]);defs+=`<filter id="f${i}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="${s.sh[2]}" dy="${s.sh[3]}" stdDeviation="${s.sh[1]/2}" flood-color="${q.c}" flood-opacity="${q.a}"/></filter>`}
    body+=shapeTag(s,attrs(s,i));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${f2(H)}" preserveAspectRatio="none"><defs>${defs}</defs>${body}</svg>`;
}
function attrs(s,i){
  let a=` fill="${s.fill||'none'}"`;
  if(s.stroke){a+=` stroke="${s.stroke}" stroke-width="${s.sw||1}"`;if(s.dash)a+=` stroke-dasharray="${s.dash}"`;if(s.cap)a+=` stroke-linecap="${s.cap}"`}
  if(s.op!=null)a+=` opacity="${s.op}"`;
  if(s.fr==='evenodd')a+=` fill-rule="evenodd"`;
  if(s.clip)a+=` clip-path="url(#${s.clip})"`;
  if(s.sh)a+=` filter="url(#f${i})"`;
  return a;
}
function shapeTag(s,a){
  switch(s.t){
    case'circle':return `<circle cx="${f2(s.x)}" cy="${f2(s.y)}" r="${f2(s.r)}"${a}/>`;
    case'ellipse':return `<ellipse cx="${f2(s.x)}" cy="${f2(s.y)}" rx="${f2(s.rx)}" ry="${f2(s.ry)}"${s.rot?` transform="rotate(${s.rot} ${f2(s.x)} ${f2(s.y)})"`:''}${a}/>`;
    case'rect':return `<rect x="${f2(s.x)}" y="${f2(s.y)}" width="${f2(s.w)}" height="${f2(s.h)}"${s.rx?` rx="${s.rx}"`:''}${a}/>`;
    case'line':return `<line x1="${f2(s.x1)}" y1="${f2(s.y1)}" x2="${f2(s.x2)}" y2="${f2(s.y2)}"${a}/>`;
    default:return `<path d="${s.d}"${a}/>`;
  }
}
function pathOf(s){
  if(s.t==='path')return new Path2D(s.d);
  const p=new Path2D();
  if(s.t==='circle')p.arc(s.x,s.y,s.r,0,TAU);
  else if(s.t==='ellipse')p.ellipse(s.x,s.y,s.rx,s.ry,(s.rot||0)*Math.PI/180,0,TAU);
  else if(s.t==='rect'){if(s.rx&&p.roundRect)p.roundRect(s.x,s.y,s.w,s.h,s.rx);else p.rect(s.x,s.y,s.w,s.h)}
  else if(s.t==='line'){p.moveTo(s.x1,s.y1);p.lineTo(s.x2,s.y2)}
  return p;
}
function paintScene(ctx,sc,w){
  const k=w/W;ctx.save();ctx.scale(k,k);
  const grads={},clips={};
  sc.defs.forEach(d=>{
    if(d.k==='clip'){clips[d.id]=pathOf(d.shape);return}
    const g=d.k==='lin'?ctx.createLinearGradient(d.x1,d.y1,d.x2,d.y2):ctx.createRadialGradient(d.fx??d.cx,d.fy??d.cy,0,d.cx,d.cy,d.r);
    d.st.forEach(([o,c])=>g.addColorStop(o,c));grads[d.id]=g;
  });
  const paint=v=>v&&v.startsWith('url(#')?grads[v.slice(5,-1)]:v;
  sc.shapes.forEach(s=>{
    ctx.save();
    if(s.clip)ctx.clip(clips[s.clip]);
    if(s.op!=null)ctx.globalAlpha=s.op;
    if(s.sh){ctx.shadowColor=s.sh[0];ctx.shadowBlur=s.sh[1]*k;ctx.shadowOffsetX=s.sh[2]*k;ctx.shadowOffsetY=s.sh[3]*k}
    const p=pathOf(s);
    if(s.fill&&s.fill!=='none'){ctx.fillStyle=paint(s.fill);ctx.fill(p,s.fr||'nonzero')}
    if(s.stroke){ctx.strokeStyle=paint(s.stroke);ctx.lineWidth=s.sw||1;ctx.lineCap=s.cap||'butt';ctx.setLineDash(s.dash?s.dash.split(' ').map(Number):[]);ctx.stroke(p)}
    ctx.restore();
  });
  ctx.restore();
}

/* ============ 10종 장면 정의 (좌표계: 가로 380, 세로 H) ============ */
const CHROME=[[0,'#ffffff'],[.1,'#e8efff'],[.3,'#7889ab'],[.48,'#131a29'],[.57,'#8498bf'],[.73,'#f3f7ff'],[.87,'#53668e'],[1,'#080b14']];
function chromeSphere(sc,id,x,y,r){
  sc.defs.push({id,k:'rad',cx:x,cy:y,r,fx:x-r*.32,fy:y-r*.4,st:CHROME});
  add(sc,{t:'circle',x,y,r,fill:`url(#${id})`});
  sc.defs.push({id:id+'i',k:'lin',x1:x-r,y1:y-r,x2:x+r,y2:y+r,st:[[0,'rgba(90,220,255,.24)'],[.5,'rgba(120,120,255,0)'],[1,'rgba(255,110,210,.26)']]});
  add(sc,{t:'circle',x,y,r,fill:`url(#${id}i)`});
  add(sc,{t:'circle',x,y,r:r-.3,stroke:'rgba(190,212,255,.55)',sw:.7});
}
function sceneChrome(H){const sc=newScene();
  [['g1',352,12,160,'rgba(110,150,255,'],['g2',14,H-8,180,'rgba(170,110,255,']].forEach(([id,x,y,r,c])=>{
    sc.defs.push({id,k:'rad',cx:x,cy:y,r,st:[[0,c+'.34)'],[1,c+'0)']]});add(sc,{t:'circle',x,y,r,fill:`url(#${id})`})});
  add(sc,{t:'circle',x:352,y:12,r:100,stroke:'rgba(190,210,255,.2)',sw:.6});
  add(sc,{t:'circle',x:14,y:H-8,r:114,stroke:'rgba(190,210,255,.2)',sw:.6});
  chromeSphere(sc,'cA',352,12,58);chromeSphere(sc,'cB',14,H-8,72);
  chromeSphere(sc,'cC',316,H-74,15);chromeSphere(sc,'cD',66,96,8);chromeSphere(sc,'cE',336,H-28,6);
  return sc}

function sceneMoire(H){const sc=newScene();const ink='#0b0b14',blue='#2230ff';
  const rings=(x,y,R,col)=>{for(let r=3;r<=R;r+=4.2)add(sc,{t:'circle',x,y,r,stroke:col,sw:1.15})};
  rings(350,20,108,ink);rings(372,36,108,blue);rings(26,H-30,82,ink);rings(6,H-50,82,blue);
  const R=Math.max(250,H*.55);
  sc.defs.push({id:'vl',k:'rad',cx:190,cy:H/2,r:R,st:[[0,'rgba(245,243,236,1)'],[.58,'rgba(245,243,236,.97)'],[1,'rgba(245,243,236,0)']]});
  add(sc,{t:'circle',x:190,y:H/2,r:R,fill:'url(#vl)'});
  add(sc,{t:'circle',x:96,y:H-86,r:4.5,fill:blue});
  return sc}

function bayer(n){let m=[[0]];while(m.length<n){const s=m.length,o=Array.from({length:s*2},()=>Array(s*2));for(let y=0;y<s;y++)for(let x=0;x<s;x++){const v=m[y][x]*4;o[y][x]=v;o[y][x+s]=v+2;o[y+s][x]=v+3;o[y+s][x+s]=v+1}m=o}return m}
const B8=bayer(8);
function sceneDither(H){const sc=newScene();const c=4,cols=95,rows=Math.ceil(H/c);
  const field=(x,y)=>Math.max(0,1-Math.hypot(x-380,y)/215,(1-Math.hypot(x,y-H)/150)*.92);
  let dL='',dV='';
  for(let ry=0;ry<rows;ry++){const fv=[],fl=[];
    for(let cx=0;cx<cols;cx++){const v=field(cx*c+c/2,ry*c+c/2),t=(B8[ry%8][cx%8]+.5)/64;const on=v>t;fv.push(on);fl.push(!on&&Math.min(1,v*1.9)>t)}
    const runs=(a,col)=>{let s=-1,out='';for(let i=0;i<=cols;i++){if(i<cols&&a[i]){if(s<0)s=i}else if(s>=0){out+=`M${s*c} ${ry*c}h${(i-s)*c}v${c}h${-(i-s)*c}z`;s=-1}}return out};
    dV+=runs(fv);dL+=runs(fl);}
  add(sc,{t:'path',d:dL,fill:'#cbc1ff'});add(sc,{t:'path',d:dV,fill:'#5a3cf0'});
  return sc}

function sceneStrata(H){const sc=newScene();
  const wave=(top,y0,amp,fr,ph)=>{let d=top?'M-2 -4L382 -4':`M-2 ${H+4}L382 ${H+4}`;for(let x=382;x>=-2;x-=8)d+=`L${x} ${f2(y0+amp*Math.sin(x*fr+ph))}`;return d+'Z'};
  const sh=(dy)=>['rgba(70,45,30,.32)',4.5,0,dy];
  add(sc,{t:'path',d:wave(1,40,5,.021,.4),fill:'#ffc48c',sh:sh(3)});
  add(sc,{t:'circle',x:312,y:27,r:30,fill:'#ffd24d',sh:sh(3)});
  add(sc,{t:'path',d:wave(1,31,5,.027,2.1),fill:'#a8dcc0',sh:sh(3)});
  add(sc,{t:'path',d:wave(1,21,4,.033,4),fill:'#f59f9a',sh:sh(3)});
  add(sc,{t:'path',d:wave(0,H-52,5,.024,1.1),fill:'#8fd0bc',sh:sh(-3)});
  add(sc,{t:'path',d:wave(0,H-38,4.5,.03,3.3),fill:'#ffd9a8',sh:sh(-3)});
  add(sc,{t:'path',d:wave(0,H-24,4,.036,5.2),fill:'#f7b3ac',sh:sh(-3)});
  add(sc,{t:'circle',x:36,y:H-70,r:9,fill:'#3d9e8c',sh:sh(2)});
  return sc}

function quoteParts(sc,x,y,r,flip,col,op){
  const T=(px,py)=>flip?[2*x-px,2*y-py]:[px,py];
  const a=T(x+.92*r,y+.38*r),b=T(x+.9*r,y+1.9*r),c=T(x+.2*r,y+2.8*r),d=T(x-1.1*r,y+3.1*r),e=T(x-.2*r,y+2*r),g=T(x-.45*r,y+1.1*r),h=T(x-.92*r,y+.42*r);
  add(sc,{t:'circle',x,y,r,stroke:col,sw:1.2,op});
  add(sc,{t:'path',d:`M${f2(a[0])} ${f2(a[1])}C${f2(b[0])} ${f2(b[1])} ${f2(c[0])} ${f2(c[1])} ${f2(d[0])} ${f2(d[1])}C${f2(e[0])} ${f2(e[1])} ${f2(g[0])} ${f2(g[1])} ${f2(h[0])} ${f2(h[1])}`,stroke:col,sw:1.2,op,cap:'round'});
}
function sceneEditorial(H){const sc=newScene();const ink='#14161a',or='#ff5a1f';
  [13,367].forEach(x=>add(sc,{t:'line',x1:x,y1:0,x2:x,y2:H,stroke:ink,sw:.6,op:.22}));
  for(let y=9.5;y<H;y+=19){add(sc,{t:'line',x1:13,y1:y,x2:19,y2:y,stroke:ink,sw:.6,op:.34});add(sc,{t:'line',x1:361,y1:y,x2:367,y2:y,stroke:ink,sw:.6,op:.34})}
  quoteParts(sc,300,H*.19,16,false,or,.95);quoteParts(sc,342,H*.19,16,false,or,.95);
  quoteParts(sc,38,H*.81,16,true,or,.95);quoteParts(sc,80,H*.81,16,true,or,.95);
  const ty=H*.092,by=H*.905;
  add(sc,{t:'line',x1:26.6,y1:ty,x2:353.4,y2:ty,stroke:ink,sw:.6,op:.4});
  add(sc,{t:'line',x1:26.6,y1:by,x2:353.4,y2:by,stroke:ink,sw:.6,op:.4});
  add(sc,{t:'rect',x:26.6,y:ty-1.6,w:24,h:3.2,fill:or});
  add(sc,{t:'circle',x:13,y:H*.5,r:3.2,fill:or});add(sc,{t:'circle',x:13,y:H*.5,r:6.4,stroke:or,sw:.7});
  [0,1,2].forEach(i=>add(sc,{t:'rect',x:318+i*12,y:ty-12.5,w:6,h:6,fill:i===0?or:'none',stroke:ink,sw:.6}));
  return sc}

function sceneVelvet(H){const sc=newScene();
  sc.defs.push({id:'cone',k:'lin',x1:0,y1:0,x2:0,y2:H,st:[[0,'rgba(255,206,120,.30)'],[1,'rgba(255,206,120,.05)']]});
  add(sc,{t:'path',d:`M181 -2L199 -2L392 ${H}L-12 ${H}Z`,fill:'url(#cone)'});
  add(sc,{t:'ellipse',x:190,y:H-30,rx:135,ry:13,fill:'rgba(255,206,120,.2)'});
  const L=`M0 -2L118 -2C118 ${f2(H*.3)} 74 ${f2(H*.62)} 36 ${H+2}L0 ${H+2}Z`,Rr=`M380 -2L262 -2C262 ${f2(H*.3)} 306 ${f2(H*.62)} 344 ${H+2}L380 ${H+2}Z`;
  sc.defs.push({id:'clL',k:'clip',shape:{t:'path',d:L}},{id:'clR',k:'clip',shape:{t:'path',d:Rr}});
  for(let i=0;i<12;i++){const w=10.5,p=.38+.2*Math.sin(i*1.7);
    [[i*w,'clL'],[380-(i+1)*w,'clR']].forEach(([x,cl],j)=>{const id=`fd${i}${j}`;
      sc.defs.push({id,k:'lin',x1:x,y1:0,x2:x+w+.6,y2:0,st:[[0,'#0f0630'],[p*.7,'#3d2290'],[p,'#7a55e0'],[Math.min(.95,p+.14),'#4a2aa6'],[1,'#120838']]});
      add(sc,{t:'rect',x,y:-2,w:w+.6,h:H+4,fill:`url(#${id})`,clip:cl})})}
  sc.defs.push({id:'vsh',k:'lin',x1:0,y1:0,x2:0,y2:H,st:[[0,'rgba(5,2,25,.6)'],[.35,'rgba(5,2,25,0)'],[.8,'rgba(5,2,25,0)'],[1,'rgba(5,2,25,.55)']]});
  add(sc,{t:'rect',x:0,y:-2,w:380,h:H+4,fill:'url(#vsh)',clip:'clL'});add(sc,{t:'rect',x:0,y:-2,w:380,h:H+4,fill:'url(#vsh)',clip:'clR'});
  add(sc,{t:'path',d:`M118 -2C118 ${f2(H*.3)} 74 ${f2(H*.62)} 36 ${H+2}`,stroke:'#f3c46a',sw:1.5,op:.75});
  add(sc,{t:'path',d:`M262 -2C262 ${f2(H*.3)} 306 ${f2(H*.62)} 344 ${H+2}`,stroke:'#f3c46a',sw:1.5,op:.75});
  const y0=13;let sc1='',open=`M380 ${y0}`;
  for(let i=0;i<8;i++){const xa=380-47.5*i;const seg=`Q${f2(xa-23.75)} ${y0+24} ${f2(xa-47.5)} ${y0}`;sc1+=seg;open+=seg}
  sc.defs.push({id:'pel',k:'lin',x1:0,y1:0,x2:0,y2:y0+14,st:[[0,'#1d0d58'],[1,'#5a37b8']]});
  add(sc,{t:'path',d:`M-2 -4H382V${y0}${sc1}L-2 ${y0}Z`,fill:'url(#pel)',sh:['rgba(0,0,0,.45)',6,0,3]});
  add(sc,{t:'path',d:open,stroke:'#f3c46a',sw:1.5,dash:'1.4 2.6',cap:'round',op:.95});
  add(sc,{t:'rect',x:0,y:H-18,w:380,h:18,fill:'#0c0528'});add(sc,{t:'line',x1:0,y1:H-18,x2:380,y2:H-18,stroke:'#f3c46a',sw:.8,op:.4});
  return sc}

function fern(sc,x0,y0,ang,len,curv,seed,col,op){const r=rng(seed),n=34,step=len/n;let x=x0,y=y0,a=ang,stem=`M${f2(x)} ${f2(y)}`;const pts=[];
  for(let i=0;i<=n;i++){pts.push([x,y,a]);x+=Math.cos(a)*step;y+=Math.sin(a)*step;a+=curv/n;stem+=`L${f2(x)} ${f2(y)}`}
  add(sc,{t:'path',d:stem,stroke:col,sw:1.2,op});
  pts.forEach(([px,py,pa],i)=>{if(i<3)return;const t=i/n,sz=lerp(16,3,t)*(.9+r()*.2);
    [-1,1].forEach(s=>{const ang2=pa+s*1.0,cx=px+Math.cos(ang2)*sz*.95,cy=py+Math.sin(ang2)*sz*.95;
      add(sc,{t:'ellipse',x:cx,y:cy,rx:sz,ry:sz*.27,rot:f2(ang2*180/Math.PI),fill:col,op})})});
}
function sceneCyano(H){const sc=newScene();const r=rng(777);
  sc.defs.push({id:'vg',k:'rad',cx:190,cy:H/2,r:Math.max(H,380)*.78,st:[[.45,'rgba(2,20,50,0)'],[1,'rgba(2,20,50,.4)']]});
  add(sc,{t:'rect',x:0,y:0,w:380,h:H,fill:'url(#vg)'});
  fern(sc,-6,H+6,-1.08,165,.55,11,'#9cc9f3',.62);
  fern(sc,386,-8,2.05,150,-.45,23,'#9cc9f3',.62);
  fern(sc,392,H-34,3.5,92,.5,37,'#9cc9f3',.5);
  for(let i=0;i<80;i++)add(sc,{t:'circle',x:f2(10+r()*360),y:f2(10+r()*(H-20)),r:f2(.4+r()*.9),fill:'#cde4fb',op:.42});
  const pts=[],j=()=>(r()-.5)*3.4,m=7;
  for(let x=m;x<380-m;x+=13)pts.push([x+j(),m+j()]);
  for(let y=m;y<H-m;y+=13)pts.push([380-m+j(),y+j()]);
  for(let x=380-m;x>m;x-=13)pts.push([x+j(),H-m+j()]);
  for(let y=H-m;y>m;y-=13)pts.push([m+j(),y+j()]);
  add(sc,{t:'path',d:`M0 0H380V${H}H0ZM${pts.map(p=>f2(p[0])+' '+f2(p[1])).join('L')}Z`,fill:'#f1f6fa',fr:'evenodd'});
  return sc}

const ORB={cream:['#ffffff','#ffe6bf','#e9a96a'],pink:['#ffd6ea','#ff7fb8','#d63a85'],cobalt:['#a3b5ff','#2b4dff','#1022a8'],yellow:['#fff4b5','#ffd02e','#e29a08'],mint:['#e0fff4','#5df0c0','#0fa57f']};
function orb(sc,id,x,y,r,c){const o=ORB[c];
  sc.defs.push({id,k:'rad',cx:x,cy:y,r,fx:x-r*.3,fy:y-r*.38,st:[[0,o[0]],[.36,o[1]],[1,o[2]]]},
    {id:id+'b',k:'rad',cx:x+r*.42,cy:y+r*.52,r:r*.78,st:[[0,'rgba(255,255,255,.3)'],[1,'rgba(255,255,255,0)']]},
    {id:id+'c',k:'clip',shape:{t:'circle',x,y,r}});
  add(sc,{t:'circle',x,y,r,fill:`url(#${id})`,sh:['rgba(95,5,0,.42)',9,4,9]});
  add(sc,{t:'circle',x:x+r*.42,y:y+r*.52,r:r*.78,fill:`url(#${id}b)`,clip:id+'c'});
  add(sc,{t:'ellipse',x:x-r*.36,y:y-r*.5,rx:r*.34,ry:r*.17,rot:-32,fill:'rgba(255,255,255,.88)'});
  add(sc,{t:'circle',x:x-r*.05,y:y-r*.68,r:r*.06,fill:'rgba(255,255,255,.8)'});
}
function sceneJelly(H){const sc=newScene();
  orb(sc,'o1',34,H-38,44,'cream');orb(sc,'o2',106,H-22,13,'mint');
  orb(sc,'o3',342,H-34,28,'pink');orb(sc,'o4',316,H-84,14,'cobalt');
  orb(sc,'o5',338,48,32,'yellow');orb(sc,'o6',286,24,14,'cobalt');orb(sc,'o7',24,H-112,10,'pink');
  return sc}

function sceneSatin(H){const sc=newScene();const dark='#05382f',mid='#0c7a66',light='#27b394';
  const cv=(j,x)=>j*5.4-140+.42*x+(7+5*Math.sin(j*.045))*Math.sin(x/58+j*.035);
  const U=j=>.5+.5*(.7*Math.sin(j*.26+.8)+.3*Math.sin(j*.61+2));
  const j0=-12,j1=Math.ceil((H+170)/5.4)+8,st=.5;
  for(let j=j0;j<j1;j+=st){const u=U(j);const col=u<.6?mix(dark,mid,u/.6):mix(mid,light,(u-.6)/.4);
    let d=`M-4 ${f2(cv(j,-4))}`;for(let x=8;x<=384;x+=16)d+=`L${x} ${f2(cv(j,x))}`;
    for(let x=384;x>=-4;x-=16)d+=`L${x} ${f2(cv(j+st+.2,x))}`;add(sc,{t:'path',d:d+'Z',fill:col})}
  for(let j=j0+1;j<j1-1;j+=st){const u=U(j);if(u>.9&&u>=U(j-st)&&u>=U(j+st)){let d=`M-4 ${f2(cv(j+.5,-4))}`;for(let x=8;x<=384;x+=16)d+=`L${x} ${f2(cv(j+.5,x))}`;add(sc,{t:'path',d,stroke:'rgba(190,255,235,.5)',sw:.8})}}
  return sc}

function sceneTicket(H){const sc=newScene();const bg='#dc1472',r=rng(41);
  add(sc,{t:'rect',x:12,y:12,w:356,h:H-24,rx:10,fill:'#fff3e0',sh:['rgba(90,0,40,.38)',6,0,3]});
  [[12,12],[368,12],[12,H-12],[368,H-12]].forEach(([x,y])=>add(sc,{t:'circle',x,y,r:8,fill:bg}));
  [12,368].forEach(x=>add(sc,{t:'circle',x,y:H-54,r:9,fill:bg}));
  add(sc,{t:'line',x1:24,y1:H-54,x2:356,y2:H-54,stroke:'#dc1472',sw:1,dash:'2.6 3.2',op:.75});
  let x=32;while(x<84){const w=[.9,1.6,2.6][Math.floor(r()*3)];add(sc,{t:'rect',x:f2(x),y:H-46,w,h:20,fill:'#3b0a25',op:.9});x+=w+[1,1.8,2.8][Math.floor(r()*3)]}
  add(sc,{t:'circle',x:326,y:H-34,r:13,stroke:'#dc1472',sw:1.4,op:.85});add(sc,{t:'circle',x:326,y:H-34,r:9,stroke:'#dc1472',sw:.7,op:.85});
  add(sc,{t:'circle',x:326,y:H-34,r:2.2,fill:'#dc1472',op:.85});
  return sc}

function wedge(cx,cy,ri,ro,a0,a1){const q=(r,a)=>`${f2(cx+Math.cos(a)*r)} ${f2(cy+Math.sin(a)*r)}`;return `M${q(ri,a0)}L${q(ro,a0)}A${ro} ${ro} 0 0 1 ${q(ro,a1)}L${q(ri,a1)}A${ri} ${ri} 0 0 0 ${q(ri,a0)}Z`}
function citrus(sc,x,y,r,n,rot,rind,pith,flesh,light){
  add(sc,{t:'circle',x,y,r,fill:rind,sh:['rgba(150,70,30,.28)',8,2,5]});
  add(sc,{t:'circle',x,y,r:r-3.2,fill:pith});
  for(let i=0;i<n;i++){const a0=rot+i*TAU/n+.05,a1=rot+(i+1)*TAU/n-.05;
    add(sc,{t:'path',d:wedge(x,y,r*.1,r-6.5,a0,a1),fill:flesh});
    add(sc,{t:'path',d:wedge(x,y,r*.2,(r-6.5)*.8,a0+.05,a1-.05),fill:light,op:.45})}
  add(sc,{t:'circle',x,y,r:r*.07,fill:pith});
}
function sceneCitrus(H){const sc=newScene();
  const leaf=(x,y,rot)=>add(sc,{t:'ellipse',x,y,rx:15,ry:6.5,rot,fill:'#7fbf5a',sh:['rgba(60,100,30,.25)',4,1,2]});
  leaf(282,12,25);leaf(300,86,-35);leaf(70,H-104,-20);leaf(118,H-18,35);
  citrus(sc,338,40,46,9,.2,'#ff9a1f','#fff3d6','#ffb347','#ffe2a8');
  citrus(sc,38,H-42,40,8,.5,'#78b83c','#f4ffd9','#c5e86a','#effcb8');
  citrus(sc,338,H-32,28,10,.1,'#f2706a','#ffe9e3','#ff9a8f','#ffd0c7');
  citrus(sc,96,34,0.001+13,6,0,'#ffd23f','#fff9d8','#ffe36e','#fff3a8');
  [[300,H-96,3],[52,H-130,2.4],[262,22,2],[24,92,2.6]].forEach(([x,y,r])=>add(sc,{t:'circle',x,y,r,fill:'#fff',op:.9}));
  return sc}

function sceneRose(H){const sc=newScene();const cols=['#ff7a8a','#ffb347','#5ccfc0','#8e7cf0','#f7d44a','#6fc3ff'];
  [['gl1',380,0,200,'rgba(255,140,160,'],['gl2',0,H,190,'rgba(120,150,255,']].forEach(([id,x,y,r,c])=>{
    sc.defs.push({id,k:'rad',cx:x,cy:y,r,st:[[0,c+'.3)'],[1,c+'0)']]});add(sc,{t:'circle',x,y,r,fill:`url(#${id})`})});
  const rose=(cx,cy,k)=>{const R=[0,26,54,86,120].map(v=>v*k),ns=[8,12,16,20];
    for(let a=0;a<4;a++){const n=ns[a];for(let i=0;i<n;i++){
      add(sc,{t:'path',d:wedge(cx,cy,R[a]||.01,R[a+1],i*TAU/n,(i+1)*TAU/n),fill:cols[(i+a*2)%6],op:.92,stroke:'#2c1c40',sw:1.8})}}
    add(sc,{t:'circle',x:cx,y:cy,r:R[1],fill:'#ffd36b',stroke:'#2c1c40',sw:1.8});
    add(sc,{t:'circle',x:cx,y:cy,r:R[1]*.45,fill:'#fff3c9',stroke:'#2c1c40',sw:1.4});
    add(sc,{t:'circle',x:cx,y:cy,r:R[4]+3,stroke:'#2c1c40',sw:3})};
  rose(380,0,1);rose(0,H,.85);
  const Rv=Math.max(200,H*.44);
  sc.defs.push({id:'vl',k:'rad',cx:190,cy:H/2,r:Rv,st:[[0,'rgba(253,243,231,1)'],[.6,'rgba(253,243,231,.94)'],[1,'rgba(253,243,231,0)']]});
  add(sc,{t:'circle',x:190,y:H/2,r:Rv,fill:'url(#vl)'});
  return sc}

function sceneRibbon(H){const sc=newScene();
  const mk=(pts,dx,dy,fl)=>{const P=pts.map(([x,y])=>fl?[380-x+dx,H-y+dy]:[x+dx,y+dy]).map(([x,y])=>f2(x)+' '+f2(y));let d='M'+P[0];for(let i=1;i+2<P.length;i+=3)d+=`C${P[i]} ${P[i+1]} ${P[i+2]}`;return d};
  const ribbon=(pts,w,c0,c1,c2,fl)=>{
    add(sc,{t:'path',d:mk(pts,0,0,fl),stroke:c0,sw:w,cap:'round',sh:['rgba(120,20,60,.3)',7,1.5,4]});
    add(sc,{t:'path',d:mk(pts,0,0,fl),stroke:c1,sw:w-3.6,cap:'round'});
    add(sc,{t:'path',d:mk(pts,-1.4,-1.8,fl),stroke:c2,sw:w*.28,cap:'round',op:.8});
    add(sc,{t:'path',d:mk(pts,-2.6,-3,fl),stroke:'#ffffff',sw:1.2,cap:'round',op:.65})};
  const A=[[392,22],[346,4],[322,56],[282,42],[246,30],[232,-2],[200,-14]],B=[[394,84],[350,70],[344,122],[300,108],[262,97],[250,70],[228,64]],C=[[394,150],[360,140],[362,176],[336,172]];
  ribbon(A,15,'#c2185b','#ff4f87','#ff9fbd',false);
  ribbon(B,11,'#7e57c2','#b49cff','#dccfff',false);
  ribbon(C,8,'#e8883a','#ffb36b','#ffd9ad',false);
  ribbon(A,15,'#c2185b','#ff4f87','#ff9fbd',true);
  ribbon(B,11,'#7e57c2','#b49cff','#dccfff',true);
  ribbon(C,8,'#e8883a','#ffb36b','#ffd9ad',true);
  [[316,H-70,3.2],[64,70,3.2],[274,76,2.2],[106,H-88,2.2]].forEach(([x,y,r])=>add(sc,{t:'circle',x,y,r,fill:'#fff',stroke:'#e9c6d4',sw:.6,sh:['rgba(120,20,60,.25)',3,0,1.5]}));
  return sc}

/* ============ 프리셋 메타 ============ */
const PRESETS=[
{name:'모아레 울트라',key:'moire-ultra',concept:'어긋난 동심원 선이 만드는 간섭무늬 — 스위스 포스터식 옵아트',hex:['#F9F7F1','#0B0B14','#2230FF'],base:['#f9f7f1','#efece2'],text:'#0b0b14',meta:'#5b5f78',fx:{halo:['rgba(246,244,237,.95)',9]},scene:sceneMoire,
 near:['ripple-pool','overprint'],diff:'부드러운 물결/CMY 잉크 번짐이 아닌 1.15px 선의 간섭. 흑+울트라블루 2색, 중앙은 종이색 베일로 비움.',feas:'원 stroke ~110개 + 방사형 베일 1개'},
{name:'디더 바이올렛',key:'dither-violet',concept:'8×8 베이어 디더링 비트맵이 모서리에서 번지는 1-bit 감성',hex:['#F5F3FF','#CBC1FF','#5A3CF0','#231662'],base:['#f5f3ff','#e9e5ff'],text:'#231662',meta:'#7569c4',fx:null,scene:sceneDither,
 near:['soft-polka','lime-hud'],diff:'원형 도트/형광 UI가 아닌 사각 픽셀의 규칙적 디더 확산. 연보라 위 2톤 바이올렛.',feas:'run-length 사각형 path 2개(셀 4유닛), 픽셀 단위 연산 없음'},
{name:'시트러스 슬라이스',key:'citrus-slice',concept:'오렌지·라임·자몽 단면이 모서리에 걸린 상큼한 과일 포스터',hex:['#FFF6EA','#FF9A1F','#78B83C','#F2706A','#FFD23F','#5C2A14'],base:['#fff6ea','#ffe9d6'],text:'#5c2a14',meta:'#b0705a',fx:null,scene:sceneCitrus,
 near:['butter-sticker','petal-flow'],diff:'납작한 외곽선 스티커/꽃잎이 아닌 과육 결·껍질·속껍질이 있는 단면 일러스트. 다색 과일 + 잎.',feas:'원/부채꼴 path/타원 + shadowBlur'},
{name:'스테인드 로즈',key:'stained-rose',concept:'보석빛 유리 장미창이 두 모서리에서 퍼지는 스테인드글라스',hex:['#FDF3E7','#FF7A8A','#FFB347','#5CCFC0','#8E7CF0','#2C1C40'],base:['#fdf3e7','#f9e8ee'],text:'#2f1d45',meta:'#7a6592',fx:null,scene:sceneRose,
 near:['prism-foil','frost-window'],diff:'홀로그램 호일/서리유리가 아닌 납선(검정 윤곽)으로 나뉜 보석색 부채꼴 유리와 번지는 빛. 중앙은 크림 베일.',feas:'부채꼴 path ~100개 + 방사형 글로우'},
{name:'리본 타래',key:'ribbon-flow',concept:'래즈베리·라일락·피치 새틴 리본이 모서리를 감아 흐르는 선물 포장',hex:['#FFF6F3','#FF4F87','#B49CFF','#FFB36B','#5A1633'],base:['#fff6f3','#ffe9ee'],text:'#5a1633',meta:'#b0708a',fx:null,scene:sceneRibbon,
 near:['petal-flow','paper-tape'],diff:'꽃잎 흐름/마스킹 테이프가 아닌 입체 튜브형 새틴 리본(음영+하이라이트+그림자)과 진주 장식.',feas:'곡선 stroke 4겹 x 6줄기'},
];
const NEW_COUNT=PRESETS.length;

/* ============ 렌더링 ============ */
  const SELECTED_KEYS = new Set(["moire-ultra", "dither-violet", "citrus-slice", "stained-rose"]);
  const selectedSourcePresets = PRESETS.filter((preset) => SELECTED_KEYS.has(preset.key));
  const presets = selectedSourcePresets.map((preset) => ({
    name: preset.name,
    key: preset.key,
    defaultVisible: false,
    background: `url("data:image/svg+xml,${encodeURIComponent(toSVG(preset.scene(W), W))}") 0 0/100% 100% no-repeat, linear-gradient(135deg, ${preset.base[0]} 0%, ${preset.base[1]} 100%)`,
    text: preset.text,
    meta: preset.meta,
    accent: preset.hex?.[1] || preset.text,
    effect: preset.key,
    textFx: preset.fx || null,
  }));
  const effects = Object.fromEntries(selectedSourcePresets.map((preset) => [preset.key, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, preset.base[0]);
    gradient.addColorStop(1, preset.base[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0,0,0,.02)';
    ctx.fillRect(0, 0, width, height);
    paintScene(ctx, preset.scene(W * (height / Math.max(width, 1))), width);
  }]));
  return { presets, effects };
})();

// v10.08: curated presets from quote-new-design-gallery-1.html
const READER_SHARE_CURATED_SET2 = (() => {
'use strict';
const sample='어떤 계절은 지나간 뒤에야 비로소 아름다웠다는 걸 알게 된다. 우리는 그때의 마음을 오래도록 기억한다.';
const lines=['어떤 계절은 지나간 뒤에야','비로소 아름다웠다는 걸','알게 된다. 우리는 그때의','마음을 오래도록 기억한다.'];
const families={sans:'"Apple SD Gothic Neo", "Malgun Gothic", "NanumGothic", sans-serif',serif:'"Batang", "Noto Serif KR", "NanumMyeongjo", "NanumGothic", serif'};
const presets=[
['크롬 리본','chrome-ribbon','#FFD4E5','#2B1B27',['#FFD4E5','#A6AAB6','#292936'],'거울처럼 접힌 은빛 리본과 넓은 핑크 여백.','prism-foil · opal-shimmer','스펙트럼·반짝임 대신 불투명한 은색 띠의 반사와 꼬임, 비대칭 상하 조형.','serif'],
['레드 에디션','red-edition','#F03222','#FFF5DF',['#F03222','#FFF5DF','#35120E'],'큰 활자와 과감한 여백으로 구성한 문화 포스터.','overprint · butter-sticker','원형 잉크 겹침·스티커를 배제하고 확대 활자, 단일 잉크 면, 비대칭 편집 구조.','sans'],
['옵틱 플리츠','optic-pleats','#F0EBFF','#342459',['#F0EBFF','#5928A8','#BB91EC'],'보랏빛 접선이 만드는 선명한 옵아트 주름.','wind-contours · graphite-grain','흐린 등고선·전면 잔결 대신 가장자리에서만 꺾이는 고대비 사선 묶음.','sans'],
['인디고 스티치','indigo-stitch','#183D59','#F5EEE0',['#183D59','#F5EEE0','#DE765A'],'남색 직물 위 손바느질과 붉은 실 매듭.','gingham · paper-tape','체크·종이 테이프 대신 굵은 실의 땀, 솔기, 자수형 곡선. 격자 패턴 없음.','serif'],
['칠리 쿠션','chili-cushion','#FFE6C9','#621F19',['#FFE6C9','#ED492C','#A82016'],'공중에 놓인 실리콘 매듭과 매끈한 반사광.','butter-sticker · terracotta-arch','검은 스티커 윤곽·건축 아치 대신 분리된 두 매듭의 연속 볼륨과 반사광. 프레임을 만들지 않음.','sans'],
['월넛 인레이','walnut-inlay','#E8DCCA','#382315',['#E8DCCA','#704122','#BC8651'],'나무의 성장결과 정밀한 상감 면이 만나는 오브제.','kraft · burgundy-leather','종이 섬유·가죽 금테 대신 좌측 목재 판의 유기적 세로결과 목재 상감 조각.','serif'],
['모빌 밸런스','mobile-balance','#F4F2DC','#31432B',['#F4F2DC','#516632','#E88C42','#9377B9'],'얇은 와이어에 균형을 잡은 조각과 공중의 여백.','terrazzo-pop · star-chart','흩뿌린 칩·별 좌표 대신 연결된 지지대, 의도된 균형과 소수의 큰 조각.','serif'],
['아크릴 스텝','acrylic-step','#D9F9EE','#174E55',['#D9F9EE','#33B8CD','#A7E7F1','#EF93C0'],'차가운 투명판의 절삭 단면과 계단식 적층.','frost-window · glasshouse','서리·식물·유리 창살 대신 직각 절삭 단면과 청록/분홍 판의 층간 깊이.','sans'],
['블라인드 프레스','blind-press','#272927','#F0EFE5',['#272927','#141614','#464A45'],'숯빛 고무판에 눌린 거대한 무채색 활자.','dark · burgundy-leather','평면 어둠·금박 테두리 대신 가장자리 거대 활자의 음각, 무채색 면과 측광.','sans'],
['피치 다이컷','peach-diecut','#FFE1B9','#553321',['#FFE1B9','#F89673','#743A30','#BDE7D0'],'정교하게 잘린 큰 구멍 너머로 드러나는 색의 층.','vellum · crumple','접힘·구겨진 면 대신 실제 타공 실루엣, 절단 두께와 두 색의 하부 레이어.','serif']
].map(([name,key,bg,text,palette,concept,near,difference,font])=>({name,key,bg,text,palette,concept,near,difference,font,defaultVisible:false}));
let ratio=1,selectedFont=null,active=0;
// One scene / two backends: inline SVG for CSS background, native Canvas 2D paths for PNG.
// Geometry uses a 1000-unit width; h follows the selected aspect ratio. No raster assets.
function scene(index,H){let shapes=[],grads={};
const rect=(x,y,w,h,fill,r=0)=>shapes.push({t:'r',x,y,w,h,fill,r});
const path=(d,fill='none',stroke=null,sw=1)=>shapes.push({t:'p',d,fill,stroke,sw});
const ellipse=(x,y,rx,ry,fill,stroke=null,sw=1)=>shapes.push({t:'e',x,y,rx,ry,fill,stroke,sw});
const txt=(s,x,y,size,fill,weight=400,family='sans-serif',stroke=null)=>shapes.push({t:'t',s,x,y,size,fill,weight,family,stroke});
const gradient=(id,x1,y1,x2,y2,stops)=>{grads[id]={x1,y1,x2,y2,stops};return '@'+id};
rect(0,0,1000,H,presets[index].bg);
if(index===0){
let silver=gradient('silver',0,0,0,250,[[0,'#3C3B45'],[.13,'#DBDDE3'],[.28,'#F8F8FC'],[.43,'#737584'],[.52,'#22222D'],[.65,'#C3C5D0'],[.8,'#F3F4F9'],[1,'#555363']]);
path('M-70 150 C180 -70 360 5 530 115 S850 250 1080 20 L1080 110 C850 325 690 275 510 190 S180 10 -70 255 Z',silver);
path('M-70 153 C180 -68 360 8 530 118 S850 253 1080 23','none','#FFFFFF',2);
let z=H-205;
path(`M570 ${H+50} C450 ${z+65} 690 ${z-40} 960 ${z+85} L1080 ${z+165} L1050 ${H+75} C780 ${z+48} 525 ${z+60} 655 ${H+80} Z`,gradient('silver2',580,z,850,H+50,[[0,'#2D293A'],[.19,'#F6F7FD'],[.33,'#9EA2B3'],[.49,'#FCFBFF'],[.6,'#5A5B6B'],[.83,'#D9DAE3'],[1,'#484756']]));
txt('SENTENCE / OBJECT',80,H-70,15,'#633F52',500);
}else if(index===1){
txt('Aa',-42,222,285,'#FFF5DF',800);rect(690,46,248,5,'#FFF5DF');txt('THE READING',692,83,21,'#FFF5DF',700);txt('EDITION',692,110,21,'#FFF5DF',700);txt('01',844,198,88,'#FFF5DF',300);
rect(65,268,870,2,'#FFF5DF');rect(66,H-213,66,8,'#FFF5DF');
txt('M E M O R Y',65,H-125,110,'#FFF5DF',800);txt('WORDS TO KEEP',69,H-70,18,'#FFF5DF',600);
}else if(index===2){
for(let i=0;i<54;i++){let x=-200+i*25;path(`M${x} 0 L${x+270} 166 L${x+180} 280`,'none',i%2?'#5928A8':'#BC93ED',8);}
for(let i=0;i<45;i++){let x=220+i*25;path(`M${x} ${H+40} L${x-265} ${H-130} L${x-178} ${H-260}`,'none',i%2?'#5928A8':'#BC93ED',8);}
rect(150,290,700,H-575,'#F0EBFF');txt('OPTICAL / SOFT',70,H-46,15,'#5928A8',500);
}else if(index===3){
for(let y=0;y<H;y+=5)path(`M0 ${y} L1000 ${y+1}`,'none',y%10?'#1A405C':'#163951',.8);
rect(45,0,5,H,'#102E44');rect(51,0,3,H,'#3D5B71');
for(let y=25;y<H;y+=24){path(`M73 ${y} L87 ${y+12}`,'none','#EADFCC',3);path(`M913 ${y} L928 ${y+12}`,'none','#EADFCC',3);}
for(let x=70;x<930;x+=25){path(`M${x} 60 L${x+14} 62`,'none','#EADFCC',3);path(`M${x} ${H-60} L${x+14} ${H-58}`,'none','#EADFCC',3);}
for(let i=0;i<65;i++){let t=i/64,x=115+170*t,y=105+65*Math.sin(t*Math.PI);path(`M${x} ${y} L${x+4} ${y+10}`,'none','#EADFCC',3);}
for(let i=0;i<70;i++){let t=i/69,x=680+165*t,y=H-150+44*Math.sin(t*6);path(`M${x} ${y} L${x+3} ${y+10}`,'none','#DE765A',4);}
path(`M811 ${H-149} C846 ${H-200} 890 ${H-131} 828 ${H-139} C802 ${H-90} 759 ${H-157} 822 ${H-149}`,'none','#DE765A',5);
}else if(index===4){
let body=gradient('silicone',0,0,370,235,[[0,'#8E2117'],[.22,'#EC462B'],[.42,'#FF9470'],[.5,'#FFB69A'],[.61,'#F35334'],[.8,'#D63321'],[1,'#A02219']]);
path('M-65 220 C86 259 227 150 164 65 C131 20 26 60 66 109 C128 183 267 203 388 62','none','#D1A080',109);
path('M-65 208 C86 247 227 138 164 53 C131 8 26 48 66 97 C128 171 267 191 388 50','none',body,100);
path('M-65 177 C86 216 204 128 143 50','none','#FFD1AE',4);
let lower=gradient('lower',650,H-250,1000,H,[[0,'#B3281B'],[.29,'#F46A45'],[.48,'#FFB694'],[.59,'#F86440'],[.8,'#CC321F'],[1,'#9A2118']]);
path(`M705 ${H+37} C650 ${H-133} 844 ${H-233} 927 ${H-154} C1064 ${H-13} 850 ${H+35} 796 ${H-29}`,'none','#D1A080',104);
path(`M705 ${H+25} C650 ${H-145} 844 ${H-245} 927 ${H-166} C1064 ${H-25} 850 ${H+23} 796 ${H-41}`,'none',lower,96);
path(`M689 ${H+22} C641 ${H-155} 835 ${H-258} 927 ${H-180}`,'none','#FFD0AD',4);
}else if(index===5){
rect(0,0,146,H,'#704122');rect(146,0,12,H,'#311D10');rect(158,0,7,H,'#BC8651');
for(let i=0;i<34;i++){let x=i*5;path(`M${x} -20 C${x-55} ${H*.22} ${x+52} ${H*.5} ${x-7} ${H*.7} S${x+18} ${H*.95} ${x-5} ${H+25}`,'none',i%3?'#9E6339':'#4F2D19',i%3?1.3:2.1);}
path(`M650 ${H} L1000 ${H-228} L1000 ${H} Z`,'#704122');path(`M675 ${H} L1000 ${H-211}`,'none','#BB8A58',3);
for(let i=0;i<20;i++)path(`M${720+i*20} ${H+10} Q${900+i*5} ${H-60} 1020 ${H-150+i*7}`,'none',i%2?'#9F6B44':'#542E18',1.4);
rect(240,74,64,7,'#704122');rect(314,74,20,7,'#BC8651');
}else if(index===6){
path('M520 -20 L520 70 M220 72 L830 72 M252 72 L252 142 M790 72 L790 153','none','#31432B',3);
ellipse(252,168,66,37,'#E88C42');path('M721 152 L871 152 L822 223 L748 223 Z','#516632');path('M520 71 L520 105 M360 108 L667 108 M376 109 L376 130 M650 109 L650 167','none','#31432B',2);
path('M352 131 L400 131 L410 192 L365 213 L337 181 Z','#9377B9');ellipse(651,185,22,22,'#31432B');
path(`M68 ${H} L68 ${H-170} M66 ${H-169} L280 ${H-208} M101 ${H-177} L101 ${H-118} M259 ${H-204} L259 ${H-171}`,'none','#31432B',2);
ellipse(102,H-98,28,18,'#516632');path(`M222 ${H-172} L300 ${H-172} L300 ${H-104} L222 ${H-104} Z`,'#E88C42');
}else if(index===7){
path('M0 0 L1000 0 L1000 180 L800 180 L800 150 L560 150 L560 95 L290 95 L290 48 L0 48 Z','#A7E7F1');
path('M0 48 L290 48 L290 95 L560 95 L560 150 L800 150 L800 180 L1000 180','none','#278AA2',10);
path('M0 41 L299 41 L299 87 L569 87 L569 142 L809 142 L809 172 L1000 172','none','#FFFFFF',3);
path('M780 0 L780 60 L875 60 L875 118 L1000 118 L1000 0 Z','#EF93C0');path('M780 60 L875 60 L875 118 L1000 118','none','#B85A8A',7);
for(let i=0;i<4;i++){let y=H-220+i*52,x=720-i*110;path(`M${x} ${H} L${x} ${y} L1000 ${y} L1000 ${H} Z`,i%2?'#89DCE7':'#54C6D7');path(`M${x} ${H} L${x} ${y} L1000 ${y}`,'none','#217E95',8);path(`M${x+7} ${H} L${x+7} ${y+7} L1000 ${y+7}`,'none','#D0FCFF',3);}
}else if(index===8){
txt('a',-80,295,440,'#141614',800,'serif');txt('a',-85,290,440,'#444943',800,'serif');txt('a',-82,293,440,'#222521',800,'serif');
txt('&',695,H+26,380,'#141614',600,'serif');txt('&',690,H+21,380,'#464A45',600,'serif');txt('&',693,H+24,380,'#222521',600,'serif');
path('M355 109 L902 109','none','#151714',3);path('M355 106 L902 106','none','#3D413C',2);txt('THE QUIET IMPRESSION',355,88,15,'#A2AAA0',400);
}else if(index===9){
rect(0,0,1000,196,'#743A30');rect(0,0,420,196,'#BDE7D0');
path('M0 0 L1000 0 L1000 94 Q900 40 810 114 Q720 40 630 114 Q540 40 450 114 Q360 40 270 114 Q180 40 90 114 Q35 80 0 94 Z','#B95D42');
path('M0 0 L1000 0 L1000 79 Q900 25 810 99 Q720 25 630 99 Q540 25 450 99 Q360 25 270 99 Q180 25 90 99 Q35 65 0 79 Z','#F89673');
rect(0,196,1000,11,'#C78964');rect(0,193,1000,3,'#FFF4DD');
ellipse(955,H-92,154,162,'#BE896A');ellipse(943,H-100,154,162,'#743A30');ellipse(945,H-121,127,136,'#F89673');ellipse(950,H-125,111,118,'#BDE7D0');
path(`M0 ${H-140} L130 ${H-140} L130 ${H-102} L200 ${H-102} L200 ${H} L0 ${H} Z`,'#C78964');path(`M0 ${H-150} L120 ${H-150} L120 ${H-112} L190 ${H-112} L190 ${H} L0 ${H} Z`,'#F89673');
}
return {shapes,grads,H};}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function svgScene(sc){const paint=x=>x?.startsWith('@')?'url(#'+x.slice(1)+')':x||'none';let defs=Object.entries(sc.grads).map(([id,g])=>`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${g.stops.map(([v,c])=>`<stop offset="${v}" stop-color="${c}"/>`).join('')}</linearGradient>`).join('');let body=sc.shapes.map(o=>{let style=`fill="${paint(o.fill)}" stroke="${paint(o.stroke)}" stroke-width="${o.sw||1}" stroke-linejoin="round" stroke-linecap="round"`;if(o.t==='r')return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.r}" ${style}/>`;if(o.t==='e')return `<ellipse cx="${o.x}" cy="${o.y}" rx="${o.rx}" ry="${o.ry}" ${style}/>`;if(o.t==='p')return `<path d="${o.d}" ${style}/>`;return `<text x="${o.x}" y="${o.y}" text-anchor="${o.align==='center'?'middle':'start'}" font-family="${esc(o.family)}" font-size="${o.size}" font-weight="${o.weight}" ${style}>${esc(o.s)}</text>`;}).join('');return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${sc.H}" viewBox="0 0 1000 ${sc.H}"><defs>${defs}</defs>${body}</svg>`;}
function drawScene(c,sc){let colors={};for(const [id,g]of Object.entries(sc.grads)){let v=c.createLinearGradient(g.x1,g.y1,g.x2,g.y2);g.stops.forEach(([n,col])=>v.addColorStop(n,col));colors['@'+id]=v;}c.lineJoin='round';c.lineCap='round';for(const o of sc.shapes){c.fillStyle=colors[o.fill]||o.fill||'transparent';c.strokeStyle=colors[o.stroke]||o.stroke||'transparent';c.lineWidth=o.sw||1;let p;if(o.t==='p')p=new Path2D(o.d);if(o.t==='e'){p=new Path2D();p.ellipse(o.x,o.y,o.rx,o.ry,0,0,Math.PI*2);}if(o.t==='r'){p=new Path2D();p.roundRect(o.x,o.y,o.w,o.h,o.r);}if(o.t==='t'){c.font=`${o.weight} ${o.size}px ${o.family}`;c.textAlign=o.align||'left';c.fillText(o.s,o.x,o.y);c.textAlign='left';continue;}if(o.fill&&o.fill!=='none')c.fill(p);if(o.stroke)c.stroke(p);}}
function fontFor(p){return families[selectedFont||p.font];}
function quoteShapes(i,H){const p=presets[i],f=fontFor(p),y=H*.48-3*35*1.9/2;const t=(s,x,y,size,weight=400)=>({t:'t',s,x,y,size,weight,fill:p.text,family:f,align:'center'});return [...lines.map((s,j)=>t(s,500,y+j*35*1.9,35,i===1?500:400)),t('어느 계절의 기록',500,y+4*35*1.9+12,20),t('예시 작가',500,y+4*35*1.9+44,17),t('셩냥책',500,H*.92,16)];}
function fullScene(i,H){let sc=scene(i,H);sc.shapes.push(...quoteShapes(i,H));return sc;}
function renderCanvas(canvas,i,width=800){const H=1000*ratio;canvas.width=width;canvas.height=Math.round(width*ratio);let c=canvas.getContext('2d');c.save();c.scale(width/1000,width/1000);drawScene(c,fullScene(i,H));c.restore();canvas.style.aspectRatio=`1 / ${ratio}`;}
  const SELECTED_KEYS = new Set(["red-edition", "optic-pleats", "acrylic-step", "blind-press"]);
  function withAlpha(hex, alpha) {
    const clean = String(hex || '').trim();
    const match = clean.match(/^#([0-9a-fA-F]{6})$/);
    if (!match) return clean || `rgba(0,0,0,${alpha})`;
    const raw = match[1];
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const selectedEntries = presets
    .map((preset, sourceIndex) => ({ preset, sourceIndex }))
    .filter((entry) => SELECTED_KEYS.has(entry.preset.key));
  const presetsOut = selectedEntries.map(({ preset, sourceIndex }) => ({
    name: preset.name,
    key: preset.key,
    defaultVisible: false,
    background: `url("data:image/svg+xml,${encodeURIComponent(svgScene(scene(sourceIndex, 1000)))}") 0 0/100% 100% no-repeat`,
    text: preset.text,
    meta: withAlpha(preset.text, 0.58),
    accent: preset.palette?.[1] || preset.text,
    effect: preset.key,
  }));
  const effects = Object.fromEntries(selectedEntries.map(({ preset, sourceIndex }) => [preset.key, (ctx, width, height) => {
    const H = 1000 * (height / Math.max(width, 1));
    ctx.save();
    ctx.scale(width / 1000, width / 1000);
    drawScene(ctx, scene(sourceIndex, H));
    ctx.restore();
  }]));
  return { presets: presetsOut, effects };
})();

const READER_SHARE_NEW8 = (() => {
  "use strict";
  const TAU = Math.PI * 2;

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rr(c,x,y,w,h,r){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h)}
function inZone(x,y,w,h,m){m=m||0;return x>.07*w-m&&x<.93*w+m&&y>.13*h-m&&y<.85*h+m}
function star(c,cx,cy,r1,r2,n,rot){c.beginPath();for(let i=0;i<n*2;i++){const a=rot+i*Math.PI/n,r=i%2?r2:r1,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath()}
function arch(c,x0,y0,x1,y1,R){c.beginPath();c.moveTo(x0,y1);c.lineTo(x0,y0+R);c.arc(x0+R,y0+R,R,Math.PI,1.5*Math.PI);c.lineTo(x1-R,y0);c.arc(x1-R,y0+R,R,1.5*Math.PI,0);c.lineTo(x1,y1);c.closePath()}

function drawAzulejo(c,w,h){
  const u=w/1200,T=60*u,B='#1F4FD8',tile='#FBF7EA';
  let g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.8);
  g.addColorStop(0,'rgba(120,90,50,0)');g.addColorStop(1,'rgba(120,90,50,.12)');c.fillStyle=g;c.fillRect(0,0,w,h);
  const rows=Math.ceil(h/T);
  const strip=x=>{for(let i=0;i<rows;i++){
    const y=i*T,cx=x+T/2,cy=y+T/2;
    c.fillStyle=tile;c.fillRect(x,y,T,T);
    c.strokeStyle='rgba(31,79,216,.5)';c.lineWidth=1.3*u;c.strokeRect(x+.7*u,y+.7*u,T-1.4*u,T-1.4*u);
    c.fillStyle=B;
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;c.beginPath();c.ellipse(cx+Math.cos(a)*T*.2,cy+Math.sin(a)*T*.2,T*.15,T*.075,a,0,TAU);c.fill()}
    c.beginPath();c.arc(cx,cy,T*.075,0,TAU);c.fillStyle=tile;c.fill();c.lineWidth=2*u;c.strokeStyle=B;c.stroke();
    c.fillStyle=B;
    [[x,y,0],[x+T,y,Math.PI/2],[x+T,y+T,Math.PI],[x,y+T,Math.PI*1.5]].forEach(([px,py,a])=>{c.beginPath();c.moveTo(px,py);c.arc(px,py,T*.19,a,a+Math.PI/2);c.closePath();c.fill()});
  }
  const gg=c.createLinearGradient(x,0,x+T,0);gg.addColorStop(0,'rgba(255,255,255,.28)');gg.addColorStop(.5,'rgba(255,255,255,0)');gg.addColorStop(1,'rgba(0,0,0,.08)');c.fillStyle=gg;c.fillRect(x,0,T,h)};
  strip(0);strip(w-T);
  c.strokeStyle=B;
  [[T+10*u,3.2*u],[T+18*u,1.2*u]].forEach(([d,lw])=>{c.lineWidth=lw;c.beginPath();c.moveTo(d,0);c.lineTo(d,h);c.moveTo(w-d,0);c.lineTo(w-d,h);c.stroke()});
  [[26*u,2.6*u],[34*u,1*u]].forEach(([d,lw])=>{c.lineWidth=lw;c.beginPath();c.moveTo(T+10*u,d);c.lineTo(w-T-10*u,d);c.moveTo(T+10*u,h-d);c.lineTo(w-T-10*u,h-d);c.stroke()});
}
function drawEmerald(c,w,h){
  const u=w/1200,R=mulberry32(7731),pts=[];
  for(let i=0;i<16;i++){const x=R()*w,y=R()*h,rad=(.18+R()*.34)*w,l=R()<.55;
    const g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,l?'rgba(80,190,150,.2)':'rgba(0,20,16,.3)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h)}
  const quiet=(x,y)=>inZone(x,y,w,h)||(y>h-150*u&&x>.2*w&&x<.8*w);
  function vein(x,y,ang,len,wid,d){let px=x,py=y,a=ang;const segs=[];
    for(let i=0;i<len;i++){
      a+=(R()-.5)*.55;const st=(10+R()*8)*u,nx=px+Math.cos(a)*st,ny=py+Math.sin(a)*st,t=i/len,lw=Math.max(.5*u,wid*(1-t*.85));
      segs.push([px,py,nx,ny,lw,(quiet((px+nx)/2,(py+ny)/2)?.2:.92)*(1-t*.45)]);
      if(R()<.1)pts.push([nx,ny]);
      if(d<2&&R()<.07)vein(nx,ny,a+(R()<.5?-1:1)*(.5+R()*.6),Math.floor(len*.5),lw*.75,d+1);
      px=nx;py=ny;if(px<-40||px>w+40||py<-40||py>h+40)break}
    c.lineCap='round';c.lineJoin='round';
    for(let i=0;i<segs.length;i+=3){const g=segs.slice(i,i+3),m=g[Math.floor(g.length/2)];
      c.strokeStyle='rgba(240,205,125,'+m[5]+')';c.lineWidth=g[0][4];c.beginPath();c.moveTo(g[0][0],g[0][1]);g.forEach(q=>c.lineTo(q[2],q[3]));c.stroke()}}
  [[0,.18*h,.2],[.12*w,0,1.3],[w,.46*h,Math.PI-.15],[.8*w,h,-1.8],[0,.78*h,-.35],[.55*w,0,1.9],[w,.1*h,2.6],[.3*w,h,-1.2]]
    .forEach(([x,y,a],i)=>vein(x,y,a,46+Math.floor(R()*28),(3.4-i*.12)*u,0));
  for(let i=0;i<80&&pts.length;i++){const p=pts[Math.floor(R()*pts.length)];
    c.fillStyle='rgba(255,226,150,'+(.35+R()*.45)+')';c.beginPath();c.arc(p[0]+(R()-.5)*26*u,p[1]+(R()-.5)*26*u,(.7+R()*1.5)*u,0,TAU);c.fill()}
  const g=c.createLinearGradient(0,h*.15,w,h*.85);g.addColorStop(.35,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.07)');g.addColorStop(.65,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
}
function drawButter(c,w,h){
  const u=w/1200,ink='#111',m=30*u,so=14*u,rad=40*u;
  c.fillStyle=ink;rr(c,m+so,m+so,w-2*m,h-2*m,rad);c.fill();
  c.fillStyle='#FFF4B8';rr(c,m,m,w-2*m,h-2*m,rad);c.fill();c.lineWidth=7*u;c.strokeStyle=ink;c.stroke();
  c.save();c.setLineDash([2*u,11*u]);c.lineCap='round';c.lineWidth=3*u;rr(c,m+18*u,m+18*u,w-2*m-36*u,h-2*m-36*u,rad-12*u);c.stroke();c.restore();
  c.lineJoin='round';c.lineCap='round';
  const sx=w-96*u,sy=96*u;
  c.fillStyle=ink;star(c,sx+6*u,sy+7*u,66*u,50*u,14,.2);c.fill();
  c.fillStyle='#FF5A36';star(c,sx,sy,66*u,50*u,14,.2);c.fill();c.lineWidth=5*u;c.strokeStyle=ink;c.stroke();
  c.fillStyle='rgba(255,255,255,.75)';c.beginPath();c.arc(sx-18*u,sy-20*u,6*u,0,TAU);c.fill();
  const bx=112*u,by=h-118*u;
  c.fillStyle=ink;c.beginPath();c.arc(bx+6*u,by+7*u,52*u,0,TAU);c.fill();
  c.fillStyle='#2F5BFF';c.beginPath();c.arc(bx,by,52*u,0,TAU);c.fill();c.lineWidth=5*u;c.strokeStyle=ink;c.stroke();
  c.strokeStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(bx,by,36*u,Math.PI*1.1,Math.PI*1.45);c.stroke();
  const wave=(x0,x1,y,amp,wl)=>{c.beginPath();for(let x=x0;x<=x1;x+=2*u){const yy=y+Math.sin((x-x0)/wl*TAU)*amp;x===x0?c.moveTo(x,yy):c.lineTo(x,yy)}};
  c.strokeStyle=ink;c.lineWidth=24*u;wave(w-294*u,w-80*u,h-89*u,14*u,48*u);c.stroke();
  wave(w-300*u,w-86*u,h-96*u,14*u,48*u);c.stroke();
  c.strokeStyle='#FF7AA8';c.lineWidth=11*u;c.stroke();
  c.strokeStyle=ink;c.lineWidth=5*u;
  [[.26,.075],[.945,.5],[.05,.62]].forEach(([fx,fy])=>{const x=fx*w,y=fy*h;c.beginPath();c.moveTo(x-9*u,y);c.lineTo(x+9*u,y);c.moveTo(x,y-9*u);c.lineTo(x,y+9*u);c.stroke()});
}
function drawBurgundy(c,w,h){
  const u=w/1200,R=mulberry32(4409);
  let g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.75);
  g.addColorStop(0,'rgba(130,34,60,.35)');g.addColorStop(1,'rgba(10,0,4,.55)');c.fillStyle=g;c.fillRect(0,0,w,h);
  for(let i=0;i<1000;i++){const x=R()*w,y=R()*h,r=(.6+R()*1.5)*u;c.fillStyle=R()<.6?'rgba(0,0,0,.2)':'rgba(255,170,190,.06)';c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
  const fg=c.createLinearGradient(0,0,w,h);fg.addColorStop(0,'#F6E3A8');fg.addColorStop(.35,'#C79A45');fg.addColorStop(.6,'#F3D98F');fg.addColorStop(1,'#A87A32');
  const frames=(col,ox,oy)=>{c.strokeStyle=col;
    c.lineWidth=3.2*u;c.strokeRect(34*u+ox,34*u+oy,w-68*u,h-68*u);
    c.lineWidth=1.2*u;c.strokeRect(46*u+ox,46*u+oy,w-92*u,h-92*u);
    [[34*u,34*u,0],[w-34*u,34*u,1],[w-34*u,h-34*u,2],[34*u,h-34*u,3]].forEach(([cx,cy,q])=>{
      const a0=q*Math.PI/2;cx+=ox;cy+=oy;c.lineWidth=1.5*u;
      [20,32,44].forEach(r=>{c.beginPath();c.arc(cx,cy,r*u,a0,a0+Math.PI/2);c.stroke()});
      c.beginPath();for(let k=0;k<5;k++){const a=a0+k*Math.PI/8;c.moveTo(cx+Math.cos(a)*8*u,cy+Math.sin(a)*8*u);c.lineTo(cx+Math.cos(a)*44*u,cy+Math.sin(a)*44*u)}c.stroke()})};
  frames('rgba(0,0,0,.5)',1.6*u,1.8*u);frames(fg,0,0);
}
function drawTerracotta(c,w,h){
  const u=w/1200,R=mulberry32(5521);
  for(let i=0;i<560;i++){const x=R()*w,y=R()*h;c.fillStyle=R()<.55?'rgba(90,28,10,.12)':'rgba(255,205,165,.1)';c.beginPath();c.arc(x,y,(.7+R()*1.8)*u,0,TAU);c.fill()}
  const x0=70*u,x1=w-70*u,y0=.115*h,y1=h-34*u,Rd=.25*w;
  [[34,'rgba(240,170,130,.55)'],[22,'rgba(246,200,160,.7)'],[10,'rgba(250,226,196,.85)']].forEach(([o,col])=>{o*=u;c.strokeStyle=col;c.lineWidth=4*u;arch(c,x0-o,y0-o,x1+o,y1,Rd+o);c.stroke()});
  c.fillStyle='#F7E3C8';arch(c,x0,y0,x1,y1,Rd);c.fill();
  c.save();arch(c,x0,y0,x1,y1,Rd);c.clip();
  for(let i=0;i<140;i++){c.fillStyle='rgba(120,70,40,.06)';c.beginPath();c.arc(x0+R()*(x1-x0),y0+R()*(y1-y0),(.7+R()*1.4)*u,0,TAU);c.fill()}
  [[.22,'#F3C79B'],[.155,'#EBA06E'],[.09,'#D9783F']].forEach(([r,col])=>{c.fillStyle=col;c.beginPath();c.arc(w/2,y1,r*w,Math.PI,TAU);c.closePath();c.fill()});
  c.restore();
  c.strokeStyle='#8E3B22';c.lineWidth=4*u;arch(c,x0,y0,x1,y1,Rd);c.stroke();
}
function drawHud(c,w,h){
  const u=w/1200,L='rgba(200,255,61,',mono='ui-monospace,Menlo,Consolas,monospace';
  const g=c.createRadialGradient(w,0,0,w,0,w*.6);g.addColorStop(0,L+'.1)');g.addColorStop(1,L+'0)');c.fillStyle=g;c.fillRect(0,0,w,h);
  const st=96*u;
  for(let y=st;y<h;y+=st)for(let x=st;x<w;x+=st){c.strokeStyle=L+(inZone(x,y,w,h)?'.12':'.3')+')';c.lineWidth=1.2*u;c.beginPath();c.moveTo(x-6*u,y);c.lineTo(x+6*u,y);c.moveTo(x,y-6*u);c.lineTo(x,y+6*u);c.stroke()}
  c.strokeStyle='#C8FF3D';c.lineWidth=3*u;c.lineCap='square';
  [[30,30,1,1],[w/u-30,30,-1,1],[w/u-30,h/u-30,-1,-1],[30,h/u-30,1,-1]].forEach(([x,y,dx,dy])=>{c.beginPath();c.moveTo((x+dx*76)*u,y*u);c.lineTo(x*u,y*u);c.lineTo(x*u,(y+dy*76)*u);c.stroke()});
  c.lineWidth=1.2*u;c.fillStyle=L+'.6)';c.font=(12*u)+'px '+mono;c.textAlign='left';c.textBaseline='middle';
  for(let y=170*u,i=0;y<h-170*u;y+=24*u,i++){const long=i%5===0;c.strokeStyle=L+(long?'.8':'.45')+')';c.beginPath();c.moveTo(30*u,y);c.lineTo((30+(long?22:10))*u,y);c.stroke();if(long)c.fillText(String(Math.round(y/u)).padStart(3,'0'),58*u,y)}
  c.fillStyle=L+'.85)';c.font='500 '+(15*u)+'px '+mono;c.textAlign='right';c.fillText('N 37.5665°  E 126.9780°',w-84*u,82*u);
  c.fillStyle=L+'.55)';c.font=(13*u)+'px '+mono;c.fillText('FRAME 01 / 12',w-84*u,104*u);
  c.textAlign='left';c.fillStyle='#C8FF3D';c.beginPath();c.arc(84*u,h-44*u,5*u,0,TAU);c.fill();c.fillStyle=L+'.8)';c.font='500 '+(14*u)+'px '+mono;c.fillText('REC 00:42:17',98*u,h-44*u);
  c.save();c.setLineDash([6*u,8*u]);c.lineWidth=1.4*u;[60,120].forEach(r=>{c.strokeStyle=L+(r===60?'.5':'.3')+')';c.beginPath();c.arc(w+10*u,h-210*u,r*u,0,TAU);c.stroke()});c.restore();
  c.fillStyle='#C8FF3D';c.beginPath();c.arc(w-4*u,h-210*u,4*u,0,TAU);c.fill();
}
function drawOverprint(c,w,h){
  const u=w/1200,R=mulberry32(6102);
  for(let i=0;i<160;i++){c.fillStyle='rgba(60,50,30,.05)';c.beginPath();c.arc(R()*w,R()*h,(.6+R()*1.4)*u,0,TAU);c.fill()}
  c.globalCompositeOperation='multiply';
  const circ=(x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()};
  circ(w-120*u,30*u,160*u,'rgba(255,210,31,.95)');circ(w-250*u,-10*u,140*u,'rgba(255,46,136,.92)');circ(w-30*u,120*u,130*u,'rgba(17,168,224,.9)');
  circ(110*u,h-20*u,140*u,'rgba(255,210,31,.95)');circ(230*u,h+10*u,120*u,'rgba(17,168,224,.9)');circ(30*u,h-130*u,110*u,'rgba(255,46,136,.92)');
  c.globalCompositeOperation='source-over';
  c.strokeStyle='rgba(255,46,136,.85)';c.lineWidth=2*u;c.beginPath();c.arc(w-250*u+6*u,-10*u+4*u,140*u,0,TAU);c.stroke();
  const ink='rgba(20,20,20,.85)';c.strokeStyle=ink;c.lineWidth=1.2*u;
  [[14,14,1,1],[w/u-14,14,-1,1],[w/u-14,h/u-14,-1,-1],[14,h/u-14,1,-1]].forEach(([x,y,dx,dy])=>{c.beginPath();c.moveTo(x*u,(y+dy*26)*u);c.lineTo(x*u,y*u);c.lineTo((x+dx*26)*u,y*u);c.stroke()});
  [[18*u,h/2],[w-18*u,h/2]].forEach(([x,y])=>{c.beginPath();c.arc(x,y,9*u,0,TAU);c.moveTo(x-14*u,y);c.lineTo(x+14*u,y);c.moveTo(x,y-14*u);c.lineTo(x,y+14*u);c.stroke()});
  const cols=['#00AEEF','#EC008C','#FFF200','#111','#6A6A6A','#B3B3B3','#E8E8E8'];
  cols.forEach((col,i)=>{c.fillStyle=col;c.fillRect(w/2-cols.length*11*u+i*22*u,h-19*u,22*u,9*u)});
}
function drawTerrazzo(c,w,h){
  const u=w/1200,R=mulberry32(9013),pal=['#1F4FD8','#FF5A1F','#FF9DBA','#1E8A5A','#141414','#FFC933','#FFFDF6'],chips=[];
  let t=0;
  while(chips.length<150&&t<6000){t++;
    const x=R()*w,y=R()*h,big=R()<.14,s=(big?26+R()*26:7+R()*13)*u;
    if(x<300*u&&y<130*u)continue;if(y>h-200*u&&x>.16*w&&x<.84*w)continue;if(inZone(x,y,w,h,s))continue;
    if(chips.some(p=>Math.hypot(p.x-x,p.y-y)<(p.s+s)*.85))continue;
    chips.push({x,y,s,c:pal[Math.floor(R()*pal.length)],a:1})}
  let k=0;while(k<18){const x=(.1+R()*.8)*w,y=(.16+R()*.66)*h;k++;chips.push({x,y,s:(4+R()*4)*u,c:pal[Math.floor(R()*6)],a:.45})}
  chips.forEach(p=>{const n=5+Math.floor(R()*3),rot=R()*TAU;c.globalAlpha=p.a;c.fillStyle=p.c;c.beginPath();
    for(let i=0;i<n;i++){const a=rot+i*TAU/n,r=p.s*(.6+R()*.55);i?c.lineTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r):c.moveTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r)}
    c.closePath();c.fill()});
  c.globalAlpha=1;
  for(let i=0;i<220;i++){const x=R()*w,y=R()*h;if(inZone(x,y,w,h)||(y>h-200*u&&x>.16*w&&x<.84*w))continue;c.fillStyle='rgba(40,30,20,.45)';c.beginPath();c.arc(x,y,(.8+R()*1.2)*u,0,TAU);c.fill()}
  const g=c.createLinearGradient(0,h*.1,w,h*.9);g.addColorStop(.4,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.2)');g.addColorStop(.6,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
}

  const presets = [
  {
    name: "코발트 타일", key: "azulejo", defaultVisible: false,
    background: "linear-gradient(90deg,rgba(31,79,216,.95) 0 5%,rgba(255,255,255,0) 5% 95%,rgba(31,79,216,.95) 95%),linear-gradient(135deg,#F6F1E4,#EDE6D3)",
    text: "#14307A", meta: "rgba(20,48,122,.74)", accent: "rgba(31,79,216,.45)",
    effect: "azulejo"
  },
  {
    name: "에메랄드 베인", key: "emerald-vein", defaultVisible: false,
    background: "linear-gradient(118deg,transparent 41%,rgba(240,205,125,.85) 41.3% 41.8%,transparent 42.2%),linear-gradient(62deg,transparent 63%,rgba(240,205,125,.6) 63.3% 63.7%,transparent 64%),linear-gradient(135deg,#0C6B55,#063A30)",
    text: "#F4EBD0", meta: "rgba(244,235,208,.78)", accent: "rgba(240,205,125,.5)",
    effect: "emerald-vein",
    textFx: {"shadow": ["rgba(0,0,0,.4)", 8, 0, 2]}
  },
  {
    name: "버터 스티커", key: "butter-sticker", defaultVisible: false,
    background: "radial-gradient(circle at 88% 12%,rgba(255,90,54,.95) 0 9%,transparent 9.5%),radial-gradient(circle at 12% 88%,rgba(47,91,255,.95) 0 8%,transparent 8.5%),linear-gradient(135deg,#FFD93B,#FFE45C)",
    text: "#111111", meta: "rgba(17,17,17,.72)", accent: "rgba(17,17,17,.45)",
    effect: "butter-sticker"
  },
  {
    name: "버건디 레더", key: "burgundy-leather", defaultVisible: false,
    background: "linear-gradient(90deg,transparent 7%,rgba(232,196,120,.9) 7% 7.8%,transparent 7.8% 92.2%,rgba(232,196,120,.9) 92.2% 93%,transparent 93%),linear-gradient(transparent 7%,rgba(232,196,120,.9) 7% 7.8%,transparent 7.8% 92.2%,rgba(232,196,120,.9) 92.2% 93%,transparent 93%),radial-gradient(circle,rgba(150,40,70,.35),rgba(10,0,4,.5)),linear-gradient(135deg,#5E1226,#3E0A19)",
    text: "#F3D98F", meta: "rgba(243,217,143,.78)", accent: "rgba(232,201,135,.5)",
    effect: "burgundy-leather",
    textFx: {"foil": ["#F6E3A8", "#D9B15C", "#F3D98F"], "emboss": true}
  },
  {
    name: "테라코타 아치", key: "terracotta-arch", defaultVisible: false,
    background: "radial-gradient(ellipse at 50% 100%,rgba(240,178,122,1) 0 14%,rgba(235,160,110,1) 14% 22%,transparent 22.5%),linear-gradient(rgba(247,227,200,1),rgba(247,227,200,1)) 7% 11%/86% 82% no-repeat,linear-gradient(135deg,#C45A36,#A64427)",
    text: "#4A2418", meta: "#2A1109", accent: "rgba(217,120,63,.5)",
    effect: "terracotta-arch"
  },
  {
    name: "라임 HUD", key: "lime-hud", defaultVisible: false,
    background: "linear-gradient(rgba(200,255,61,.1) 1px,transparent 1px) 0 0/16px 16px,linear-gradient(90deg,rgba(200,255,61,.1) 1px,transparent 1px) 0 0/16px 16px,linear-gradient(135deg,#0A0D08,#12170C)",
    text: "#E8FFB8", meta: "rgba(232,255,184,.74)", accent: "rgba(200,255,61,.5)",
    effect: "lime-hud",
    textFx: {"shadow": ["rgba(200,255,61,.35)", 14, 0, 0]}
  },
  {
    name: "오버프린트", key: "overprint", defaultVisible: false,
    background: "radial-gradient(circle at 92% 6%,rgba(255,46,136,.85) 0 14%,transparent 14.5%),radial-gradient(circle at 78% 2%,rgba(255,210,31,.85) 0 14%,transparent 14.5%),radial-gradient(circle at 10% 96%,rgba(17,168,224,.85) 0 14%,transparent 14.5%),linear-gradient(135deg,#F4EFE4,#EAE4D6)",
    text: "#1B1A18", meta: "rgba(27,26,24,.74)", accent: "rgba(255,46,136,.45)",
    effect: "overprint"
  },
  {
    name: "테라조 팝", key: "terrazzo-pop", defaultVisible: false,
    background: "radial-gradient(circle at 8% 14%,rgba(31,79,216,.95) 0 4%,transparent 4.5%),radial-gradient(circle at 90% 18%,rgba(255,90,31,.95) 0 3.5%,transparent 4%),radial-gradient(circle at 14% 92%,rgba(255,201,51,.95) 0 4%,transparent 4.5%),radial-gradient(circle at 86% 88%,rgba(30,138,90,.95) 0 3.5%,transparent 4%),linear-gradient(135deg,#F3ECE0,#EBE2D3)",
    text: "#1D1B19", meta: "rgba(29,27,25,.78)", accent: "rgba(255,90,31,.45)",
    effect: "terrazzo-pop",
    textFx: {"halo": ["rgba(243,236,224,.95)", 8]}
  }
  ];

  const effects = {
    "azulejo": drawAzulejo,
    "emerald-vein": drawEmerald,
    "butter-sticker": drawButter,
    "burgundy-leather": drawBurgundy,
    "terracotta-arch": drawTerracotta,
    "lime-hud": drawHud,
    "overprint": drawOverprint,
    "terrazzo-pop": drawTerrazzo
  };

  return { presets, effects };
})();


// v10.10: Gemini 신규 4종. 썸네일 CSS와 최종 Canvas를 최대한 맞추기 위해
// 전용 렌더러를 추가하되, 기존 글꼴 선택/저장/복사/관리자 갤러리 경로는 유지한다.
const READER_SHARE_GEMINI4 = (() => {
  const presets = [
    {
      name: "네온 프리즘 회절",
      key: "neon-prism-diffraction",
      defaultVisible: false,
      background: "radial-gradient(circle at 50% 50%, rgba(255,0,128,.24) 0 16%, rgba(0,230,255,.22) 22%, rgba(0,255,128,.18) 36%, rgba(255,230,0,.22) 52%, rgba(180,0,255,.18) 68%, rgba(5,5,10,0) 84%), repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 20px), linear-gradient(135deg, #05050a 0%, #090914 100%)",
      text: "#ffffff",
      meta: "rgba(205, 235, 255, .78)",
      accent: "#00f0ff",
      customLayout: "neon-prism-diffraction",
    },
    {
      name: "와비사비 한지",
      key: "wabi-sabi-washi",
      defaultVisible: false,
      background: "radial-gradient(circle at 70% 30%, rgba(45,40,35,.14) 0 8%, rgba(45,40,35,.06) 16%, rgba(45,40,35,0) 34%), radial-gradient(circle at 0 0, rgba(44,42,41,.10) 0 .7px, transparent .9px), radial-gradient(circle at 14px 14px, rgba(44,42,41,.06) 0 .7px, transparent .9px), linear-gradient(145deg, #f4efe6 0%, #eee7da 100%)",
      text: "#22201f",
      meta: "#6a635d",
      accent: "#a33223",
      customLayout: "wabi-sabi-washi",
    },
    {
      name: "바우하우스 구상",
      key: "bauhaus-constructivism",
      defaultVisible: false,
      background: "linear-gradient(#111111,#111111) 0 0/100% 10% no-repeat, linear-gradient(#111111,#111111) 0 100%/100% 10% no-repeat, linear-gradient(#111111,#111111) 0 0/10% 100% no-repeat, linear-gradient(#111111,#111111) 100% 0/10% 100% no-repeat, linear-gradient(#d9381e,#d9381e) 84% 10%/18% 18% no-repeat, radial-gradient(circle at 10% 90%, #f2b705 0 17%, transparent 18%), linear-gradient(#1040a3,#1040a3) 10% 48%/4% 24% no-repeat, linear-gradient(135deg, #f0f0eb 0%, #f0f0eb 100%)",
      text: "#111111",
      meta: "#555555",
      accent: "#d9381e",
      customLayout: "bauhaus-constructivism",
    },
    {
      name: "사이버펑크 홀로그램",
      key: "cyberpunk-hologram",
      defaultVisible: false,
      background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0 2px, rgba(0,0,0,.35) 2px 4px), linear-gradient(135deg, rgba(0,240,255,.22) 0%, rgba(255,0,128,.20) 50%, rgba(0,255,170,.18) 100%), linear-gradient(135deg, #07060c 0%, #100d18 100%)",
      text: "#ffffff",
      meta: "rgba(160, 245, 255, .82)",
      accent: "#00f0ff",
      customLayout: "cyberpunk-hologram",
    },
  ];

  function rrPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function fillRoundRect(ctx, x, y, width, height, radius, fillStyle) {
    ctx.save(); rrPath(ctx, x, y, width, height, radius); ctx.fillStyle = fillStyle; ctx.fill(); ctx.restore();
  }
  function strokeRoundRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth) {
    ctx.save(); rrPath(ctx, x, y, width, height, radius); ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth; ctx.stroke(); ctx.restore();
  }
  function makeLines(ctx, text, maxWidth, lineHeight, maxHeight, autoWrap) {
    let lines = fitShareLinesToWidth(ctx, text, maxWidth, autoWrap);
    const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      const last = lines.length - 1;
      lines[last] = `${String(lines[last] || '').replace(/[.…\s]+$/u, '')}…`;
    }
    return lines;
  }
  function drawLines(ctx, lines, x, y, lineHeight, align) {
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
    for (const line of lines) { ctx.fillText(line, x, y); y += lineHeight; }
  }

  function renderNeon(ctx, width, height, model) {
    const quote = String(model.text || '');
    const title = String(model.item?.title || '제목 정보 없음');
    const author = String(model.item?.author || '');
    const brand = String(model.brand || '셩냥책');
    const quoteFont = model.font?.css || 'Pretendard, sans-serif';
    const quoteWeight = model.fontWeight || model.font?.weight || 500;
    ctx.fillStyle = '#05050b'; ctx.fillRect(0, 0, width, height);
    if (typeof ctx.createConicGradient === 'function') {
      const prismGrad = ctx.createConicGradient(Math.PI / 4, width / 2, height / 2);
      prismGrad.addColorStop(0, 'rgba(255, 0, 128, 0.35)'); prismGrad.addColorStop(0.2, 'rgba(0, 230, 255, 0.35)'); prismGrad.addColorStop(0.4, 'rgba(0, 255, 128, 0.25)'); prismGrad.addColorStop(0.6, 'rgba(255, 230, 0, 0.35)'); prismGrad.addColorStop(0.8, 'rgba(180, 0, 255, 0.35)'); prismGrad.addColorStop(1, 'rgba(255, 0, 128, 0.35)');
      ctx.save(); ctx.fillStyle = prismGrad; ctx.filter = 'blur(90px)'; ctx.beginPath(); ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.58, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
    const gridSize = Math.max(20, Math.round(width * 0.033));
    for (let x = 0; x <= width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const margin = width * 0.08, panelX = margin, panelY = margin, panelW = width - margin * 2, panelH = height - margin * 2;
    ctx.save(); ctx.shadowColor = 'rgba(0, 229, 255, 0.28)'; ctx.shadowBlur = 40; fillRoundRect(ctx, panelX, panelY, panelW, panelH, 32, 'rgba(15, 15, 26, 0.72)'); ctx.restore();
    const borderGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    borderGrad.addColorStop(0, 'rgba(255,255,255,.35)'); borderGrad.addColorStop(.5, 'rgba(0,240,255,.2)'); borderGrad.addColorStop(1, 'rgba(255,0,128,.35)');
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 32, borderGrad, 2.5);
    const scale = width / 1200;
    // Light-diffraction emblem: three spectral strokes in place of a preset label.
    ctx.save();
    const markX = panelX + 40 * scale;
    const markY = panelY + 43 * scale;
    for (const [i, color] of ['#00f0ff', '#ff398f', '#ffe68a'].entries()) {
      const x = markX + i * 21 * scale;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, markY + (i % 2 ? -6 : 4) * scale);
      ctx.lineTo(x + 14 * scale, markY + (i % 2 ? -14 : -4) * scale); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = `700 ${24 * scale}px Pretendard, sans-serif`; ctx.textAlign = 'right'; ctx.fillText(brand, panelX + panelW - 40 * scale, panelY + 36 * scale);
    const quoteBoxX = panelX + 52 * scale, quoteBoxY = panelY + panelH * 0.27, quoteBoxW = panelW - 104 * scale, quoteBoxH = panelH * 0.43;
    const fontSize = (model.sizePx * (width / 380)) * 1.08, lineHeight = fontSize * 1.42;
    ctx.font = `${quoteWeight} ${fontSize}px ${quoteFont}`;
    const lines = makeLines(ctx, quote, quoteBoxW, lineHeight, quoteBoxH, model.autoWrap);
    const totalHeight = lines.length * lineHeight; let y = quoteBoxY + Math.max(0, (quoteBoxH - totalHeight) / 2);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.shadowColor = 'rgba(0,240,255,.6)'; ctx.shadowBlur = 12 * scale; drawLines(ctx, lines, quoteBoxX, y, lineHeight, 'left'); ctx.shadowBlur = 0;
    const footerY = panelY + panelH - 86 * scale;
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.2 * scale; ctx.beginPath(); ctx.moveTo(panelX + 40 * scale, footerY - 26 * scale); ctx.lineTo(panelX + panelW - 40 * scale, footerY - 26 * scale); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `700 ${28 * scale}px ${quoteFont}`; ctx.textAlign = 'left'; ctx.fillText(title, panelX + 40 * scale, footerY);
    ctx.fillStyle = 'rgba(200,230,255,.72)'; ctx.font = `500 ${22 * scale}px ${quoteFont}`; ctx.fillText(author || '작자 미상', panelX + 40 * scale, footerY + 36 * scale);
  }

  function renderWabi(ctx, width, height, model) {
    const quote = String(model.text || ''), title = String(model.item?.title || '제목 정보 없음'), author = String(model.item?.author || ''), brand = String(model.brand || '셩냥책');
    const quoteFont = model.font?.css || 'serif', quoteWeight = model.fontWeight || model.font?.weight || 400, scale = width / 1200, rand = quoteTestRng(8261 + Math.round(height));
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = 'rgba(60, 50, 40, 0.016)';
    for (let i = 0; i < 2800; i++) { const rx = rand() * width, ry = rand() * height, rw = (rand() * 3.4 + 1) * scale, rh = (rand() * 3.4 + 1) * scale; ctx.fillRect(rx, ry, rw, rh); }
    ctx.strokeStyle = 'rgba(80, 60, 45, 0.055)'; ctx.lineWidth = 1 * scale;
    for (let i = 0; i < 110; i++) { const sx = rand() * width, sy = rand() * height; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + (rand() * 30 - 15) * scale, sy + (rand() * 30 - 15) * scale, sx + (rand() * 50 - 25) * scale, sy + (rand() * 50 - 25) * scale); ctx.stroke(); }
    const washGrad = ctx.createRadialGradient(width * 0.72, height * 0.28, 20 * scale, width * 0.72, height * 0.28, Math.min(width, height) * 0.42);
    washGrad.addColorStop(0, 'rgba(35, 30, 25, 0.12)'); washGrad.addColorStop(.5, 'rgba(45, 40, 35, 0.05)'); washGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = washGrad; ctx.beginPath(); ctx.arc(width * 0.72, height * 0.28, Math.min(width, height) * 0.42, 0, Math.PI * 2); ctx.fill();
    const pad = width * 0.1;
    ctx.fillStyle = '#2c2a29'; ctx.font = `700 ${24 * scale}px ${quoteFont}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(brand, pad, pad + 6 * scale);
    const stampX = width - pad - 62 * scale, stampY = pad;
    ctx.strokeStyle = '#a33223'; ctx.lineWidth = 3 * scale; ctx.strokeRect(stampX, stampY, 60 * scale, 60 * scale); ctx.fillStyle = '#a33223'; ctx.font = `700 ${20 * scale}px ${quoteFont}`; ctx.fillText('餘白', stampX + 10 * scale, stampY + 16 * scale);
    const quoteBoxX = pad, quoteBoxY = height * 0.3, quoteBoxW = width - pad * 2, quoteBoxH = height * 0.42;
    const fontSize = (model.sizePx * (width / 380)) * 1.02, lineHeight = fontSize * 1.7;
    ctx.font = `${quoteWeight} ${fontSize}px ${quoteFont}`;
    const lines = makeLines(ctx, quote, quoteBoxW, lineHeight, quoteBoxH, model.autoWrap);
    const totalHeight = lines.length * lineHeight; let y = quoteBoxY + Math.max(0, (quoteBoxH - totalHeight) / 2);
    ctx.fillStyle = '#22201f'; drawLines(ctx, lines, quoteBoxX, y, lineHeight, 'left');
    ctx.strokeStyle = 'rgba(60,50,40,.2)'; ctx.lineWidth = 1.5 * scale; ctx.beginPath(); ctx.moveTo(pad, height - pad - 90 * scale); ctx.lineTo(width - pad, height - pad - 90 * scale); ctx.stroke();
    ctx.fillStyle = '#1a1817'; ctx.font = `700 ${30 * scale}px ${quoteFont}`; ctx.fillText(title, pad, height - pad - 54 * scale); ctx.fillStyle = '#59534e'; ctx.font = `500 ${24 * scale}px ${quoteFont}`; ctx.fillText(author || '작자 미상', pad, height - pad - 16 * scale);
  }

  function renderBauhaus(ctx, width, height, model) {
    const quote = String(model.text || ''), title = String(model.item?.title || '제목 정보 없음'), author = String(model.item?.author || ''), brand = String(model.brand || '셩냥책');
    const quoteFont = model.font?.css || 'Pretendard, sans-serif', quoteWeight = Math.max(700, Number(model.fontWeight || model.font?.weight || 700)), scale = width / 1200, mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = '#f0f0eb'; ctx.fillRect(0, 0, width, height); const frame = 24 * scale; ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, width, frame); ctx.fillRect(0, height - frame, width, frame); ctx.fillRect(0, 0, frame, height); ctx.fillRect(width - frame, 0, frame, height);
    ctx.fillStyle = '#d9381e'; ctx.fillRect(width * 0.72, frame, width * 0.28 - frame, height * 0.22); ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.moveTo(frame, height - frame); ctx.arc(frame, height - frame, 180 * scale, -Math.PI / 2, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1040a3'; ctx.fillRect(frame, height * 0.42, 28 * scale, height * 0.22);
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 4 * scale; const headerY = height * 0.16; ctx.beginPath(); ctx.moveTo(frame, headerY); ctx.lineTo(width - frame, headerY); ctx.stroke();
    // Small constructivist emblem, not a design-name label.
    const markX = frame + 30 * scale, markY = headerY - 62 * scale;
    ctx.fillStyle = '#d9381e'; ctx.fillRect(markX, markY, 25 * scale, 25 * scale);
    ctx.fillStyle = '#1040a3'; ctx.fillRect(markX + 34 * scale, markY + 1 * scale, 10 * scale, 24 * scale);
    ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.arc(markX + 62 * scale, markY + 12.5 * scale, 12.5 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111111'; ctx.font = `800 ${24 * scale}px ${mono}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(brand, width - frame - 40 * scale, headerY - 52 * scale);
    const blockX = frame + 50 * scale, blockY = height * 0.28, blockW = width - frame * 2 - 100 * scale, blockH = height * 0.45; ctx.fillStyle = '#ffffff'; ctx.fillRect(blockX, blockY, blockW, blockH); ctx.lineWidth = 3 * scale; ctx.strokeStyle = '#111111'; ctx.strokeRect(blockX, blockY, blockW, blockH); ctx.fillStyle = '#d9381e'; ctx.fillRect(blockX, blockY, 18 * scale, blockH);
    const fontSize = (model.sizePx * (width / 380)) * 1.06, lineHeight = fontSize * 1.38; ctx.fillStyle = '#111111'; ctx.font = `${quoteWeight} ${fontSize}px ${quoteFont}`; const lines = makeLines(ctx, quote, blockW - 80 * scale, lineHeight, blockH - 80 * scale, model.autoWrap); drawLines(ctx, lines, blockX + 50 * scale, blockY + 56 * scale, lineHeight, 'left');
    const footerY = height - frame - 110 * scale; ctx.beginPath(); ctx.moveTo(frame, footerY); ctx.lineTo(width - frame, footerY); ctx.stroke();
    ctx.fillStyle = '#111111'; ctx.font = `900 ${32 * scale}px ${quoteFont}`; ctx.textAlign = 'left'; ctx.fillText(title, frame + 40 * scale, footerY + 18 * scale); ctx.fillStyle = '#555555'; ctx.font = `700 ${24 * scale}px ${quoteFont}`; ctx.fillText(author || '작자 미상', frame + 40 * scale, footerY + 56 * scale); ctx.fillStyle = '#111111';
    const badgeX = width - frame - 140 * scale, badgeY = footerY + 4 * scale;
    ctx.fillRect(badgeX, badgeY, 100 * scale, 45 * scale);
    ctx.fillStyle = '#d9381e'; ctx.fillRect(badgeX + 13 * scale, badgeY + 11 * scale, 20 * scale, 22 * scale);
    ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.arc(badgeX + 53 * scale, badgeY + 22 * scale, 11 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1040a3'; ctx.fillRect(badgeX + 76 * scale, badgeY + 11 * scale, 9 * scale, 22 * scale);
  }

  function renderCyber(ctx, width, height, model) {
    const quote = String(model.text || ''), title = String(model.item?.title || '제목 정보 없음'), author = String(model.item?.author || ''), brand = String(model.brand || '셩냥책');
    const quoteFont = model.font?.css || 'Pretendard, sans-serif', quoteWeight = Math.max(500, Number(model.fontWeight || model.font?.weight || 500)), scale = width / 1200;
    ctx.fillStyle = '#07060c'; ctx.fillRect(0, 0, width, height); const holoGrad = ctx.createLinearGradient(0, 0, width, height); holoGrad.addColorStop(0, 'rgba(0, 240, 255, 0.22)'); holoGrad.addColorStop(.5, 'rgba(255, 0, 128, 0.20)'); holoGrad.addColorStop(1, 'rgba(0, 255, 170, 0.18)'); ctx.fillStyle = holoGrad; ctx.fillRect(0, 0, width, height); ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; for (let y = 0; y < height; y += 6 * scale) ctx.fillRect(0, y, width, 3 * scale);
    const pad = width * 0.08, panelW = width - pad * 2, panelH = height - pad * 2; ctx.save(); ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 30 * scale; fillRoundRect(ctx, pad, pad, panelW, panelH, 20 * scale, 'rgba(10, 10, 18, 0.82)'); ctx.restore(); strokeRoundRect(ctx, pad, pad, panelW, panelH, 20 * scale, 'rgba(0,240,255,.6)', 2 * scale);
    // Cyan/magenta holo scanner motif instead of a fictional version/system ID.
    const holoX = pad + 40 * scale, holoY = pad + 49 * scale;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineWidth = 3 * scale;
    for (const [i, length, color] of [[0, 36, '#00f0ff'], [1, 23, '#ff007f'], [2, 42, '#75ffe1']]) {
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(holoX, holoY + i * 9 * scale);
      ctx.lineTo(holoX + length * scale, holoY + i * 9 * scale); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,240,255,.72)'; ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.arc(holoX + 64 * scale, holoY + 9 * scale, 9 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff007f'; ctx.fillRect(holoX + 62 * scale, holoY + 7 * scale, 4 * scale, 4 * scale);
    ctx.restore();
    ctx.fillStyle = '#ff007f'; ctx.font = `800 ${26 * scale}px Pretendard, sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(brand, pad + panelW - 40 * scale, pad + 34 * scale);
    const quoteX = pad + 50 * scale, quoteY = pad + panelH * 0.28, maxW = panelW - 100 * scale; const fontSize = (model.sizePx * (width / 380)) * 1.05, lineHeight = fontSize * 1.45; ctx.font = `${quoteWeight} ${fontSize}px ${quoteFont}`; const lines = makeLines(ctx, quote, maxW, lineHeight, panelH * 0.42, model.autoWrap); const totalHeight = lines.length * lineHeight; let y = quoteY + Math.max(0, (panelH * 0.42 - totalHeight) / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (const line of lines) { ctx.fillStyle = 'rgba(0,240,255,.8)'; ctx.fillText(line, quoteX - 3 * scale, y); ctx.fillStyle = 'rgba(255,0,128,.8)'; ctx.fillText(line, quoteX + 3 * scale, y); ctx.fillStyle = '#ffffff'; ctx.fillText(line, quoteX, y); y += lineHeight; }
    const footerY = pad + panelH - 88 * scale; ctx.strokeStyle = 'rgba(0,240,255,.3)'; ctx.lineWidth = 1.2 * scale; ctx.beginPath(); ctx.moveTo(pad + 40 * scale, footerY - 26 * scale); ctx.lineTo(pad + panelW - 40 * scale, footerY - 26 * scale); ctx.stroke();
    ctx.fillStyle = '#00f0ff'; ctx.font = `700 ${28 * scale}px ${quoteFont}`; ctx.textAlign = 'left'; ctx.fillText(title, pad + 40 * scale, footerY); ctx.fillStyle = '#ff77c2'; ctx.font = `500 ${22 * scale}px ${quoteFont}`; ctx.fillText(author || '작자 미상', pad + 40 * scale, footerY + 36 * scale);
    const badgeX = pad + panelW - 140 * scale, badgeY = footerY - 8 * scale;
    fillRoundRect(ctx, badgeX, badgeY, 100 * scale, 36 * scale, 6 * scale, 'rgba(0,240,255,.1)');
    strokeRoundRect(ctx, badgeX, badgeY, 100 * scale, 36 * scale, 6 * scale, 'rgba(0,240,255,.65)', 1 * scale);
    // Static RGB spectral bars: decorative only, no numeric version or status.
    for (const [i, color, h] of [[0, '#00f0ff', 11], [1, '#ff007f', 21], [2, '#75ffe1', 15], [3, '#ad8bff', 23]]) {
      ctx.fillStyle = color;
      ctx.fillRect(badgeX + (17 + i * 17) * scale, badgeY + (36 - h) / 2 * scale, 7 * scale, h * scale);
    }
  }

  const renderers = {
    'neon-prism-diffraction': renderNeon,
    'wabi-sabi-washi': renderWabi,
    'bauhaus-constructivism': renderBauhaus,
    'cyberpunk-hologram': renderCyber,
  };
  return { presets, renderers };
})();


// v10.14: Gemini 신규 프리셋 66~68 선별 반영.
// CSS Live Preview의 인상을 최대한 유지하면서,
// Sub-caption은 사이트명(셩냥책), Author/Source는 `작가 『제목』` 형식으로 통일한다.
const READER_SHARE_GEMINI_SELECT3 = (() => {
  const presets = [
    {
      name: "홀로그래픽 베이퍼웨이브",
      key: "holographic-vaporwave",
      defaultVisible: false,
      background: "radial-gradient(circle at 20% 20%, rgba(255, 0, 128, 0.25) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(0, 240, 255, 0.25) 0%, transparent 40%), linear-gradient(0deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(135deg, #0d0221 0%, #190a38 40%, #031b33 80%, #20002c 100%)",
      text: "#ffffff",
      meta: "#80f0ff",
      accent: "#ff77bc",
      customLayout: "holographic-vaporwave",
    },
    {
      name: "보태니컬 프레스",
      key: "botanical-press",
      defaultVisible: false,
      background: "radial-gradient(#e2dbcd 1px, transparent 0), radial-gradient(#e2dbcd 1px, #f5f2eb 0), linear-gradient(180deg, #f5f2eb 0%, #f5f2eb 100%)",
      text: "#1c2822",
      meta: "#5c4033",
      accent: "#2c3e35",
      customLayout: "botanical-press",
    },
    {
      name: "네온 매트릭스",
      key: "neon-matrix-terminal",
      defaultVisible: false,
      background: "linear-gradient(rgba(0, 255, 136, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 136, 0.04) 1px, transparent 1px), linear-gradient(180deg, #05080a 0%, #05080a 100%)",
      text: "#00ff88",
      meta: "rgba(0,255,136,.88)",
      accent: "#00ff88",
      customLayout: "neon-matrix-terminal",
    },
  ];

  function rrPath2(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function fillRoundRect2(ctx, x, y, width, height, radius, fillStyle) {
    ctx.save(); rrPath2(ctx, x, y, width, height, radius); ctx.fillStyle = fillStyle; ctx.fill(); ctx.restore();
  }
  function makeLines2(ctx, text, maxWidth, lineHeight, maxHeight, autoWrap) {
    let lines = fitShareLinesToWidth(ctx, text, maxWidth, autoWrap);
    const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      const last = lines.length - 1;
      lines[last] = `${String(lines[last] || '').replace(/[.…\s]+$/u, '')}…`;
    }
    return lines;
  }
  function drawLines2(ctx, lines, x, y, lineHeight, align) {
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
    for (const line of lines) { ctx.fillText(line, x, y); y += lineHeight; }
  }
  function metaLine(model) {
    const author = String(model.item?.author || '').trim() || '작자 미상';
    const title = String(model.item?.title || '').trim() || '제목 정보 없음';
    return `${author} 『${title}』`;
  }
  function siteName(model) {
    return String(model.brand || '셩냥책');
  }

  function renderVapor(ctx, width, height, model) {
    const quote = String(model.text || '');
    const brand = siteName(model);
    const meta = metaLine(model);
    const quoteFont = model.font?.css || 'Pretendard, sans-serif';
    const quoteWeight = Math.max(700, Number(model.fontWeight || model.font?.weight || 700));
    const orbitron = 'Orbitron, Pretendard, sans-serif';
    const scale = width / 1200;

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#0d0221'); bg.addColorStop(0.4, '#190a38'); bg.addColorStop(0.8, '#031b33'); bg.addColorStop(1, '#20002c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    const rg1 = ctx.createRadialGradient(width * 0.2, height * 0.2, 0, width * 0.2, height * 0.2, width * 0.42);
    rg1.addColorStop(0, 'rgba(255, 0, 128, 0.28)'); rg1.addColorStop(1, 'rgba(255, 0, 128, 0)');
    ctx.fillStyle = rg1; ctx.fillRect(0, 0, width, height);
    const rg2 = ctx.createRadialGradient(width * 0.82, height * 0.82, 0, width * 0.82, height * 0.82, width * 0.42);
    rg2.addColorStop(0, 'rgba(0, 240, 255, 0.28)'); rg2.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = rg2; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    const step = Math.max(22, Math.round(width * 0.04));
    for (let x = 0; x <= width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

    const padX = width * 0.08, padY = height * 0.08;
    const innerW = width - padX * 2, innerH = height - padY * 2;
    fillRoundRect2(ctx, padX, padY, innerW, innerH, 28 * scale, 'rgba(8, 10, 24, 0.16)');

    ctx.strokeStyle = 'rgba(0,240,255,.28)'; ctx.lineWidth = 1.3 * scale;
    ctx.beginPath(); ctx.moveTo(padX + 36 * scale, padY + 68 * scale); ctx.lineTo(padX + innerW - 36 * scale, padY + 68 * scale); ctx.stroke();
    ctx.font = `700 ${22 * scale}px ${orbitron}`; ctx.fillStyle = '#80f0ff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(brand.toUpperCase(), padX + 36 * scale, padY + 36 * scale);
    ctx.fillStyle = '#ff77bc';
    ctx.beginPath(); ctx.arc(padX + innerW - 56 * scale, padY + 45 * scale, 7 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#80f0ff';
    ctx.beginPath(); ctx.arc(padX + innerW - 35 * scale, padY + 45 * scale, 7 * scale, 0, Math.PI * 2); ctx.fill();

    const quoteMaxW = innerW - 72 * scale;
    const quoteBoxH = innerH * 0.45;
    const fontSize = (model.sizePx * (width / 380)) * 1.04;
    const lineHeight = fontSize * 1.56;
    ctx.font = `${quoteWeight} ${fontSize}px ${quoteFont}`;
    const lines = makeLines2(ctx, quote, quoteMaxW, lineHeight, quoteBoxH, model.autoWrap);
    let y = padY + innerH * 0.3 + Math.max(0, (quoteBoxH - lines.length * lineHeight) / 2);
    const x = model.textAlign === 'left' ? padX + 36 * scale : model.textAlign === 'right' ? padX + innerW - 36 * scale : width / 2;
    // CSS Live Preview uses a vertically clipped white→cyan→pink text gradient.
    // Create ONE gradient across the full quote block so later lines become pink,
    // rather than filling every glyph white like the original Canvas implementation.
    const textGradient = ctx.createLinearGradient(0, y, 0, y + Math.max(lineHeight, lines.length * lineHeight));
    textGradient.addColorStop(0, '#eefbff');
    textGradient.addColorStop(0.22, '#a3efff');
    textGradient.addColorStop(0.53, '#46d7f1');
    textGradient.addColorStop(0.63, '#63c9eb');
    textGradient.addColorStop(0.77, '#f99bd1');
    textGradient.addColorStop(1, '#ff77bc');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const line of lines) {
      // Keep the layered turquoise / magenta glow from the CSS preview.
      ctx.fillStyle = textGradient;
      ctx.shadowColor = 'rgba(0,240,255,.8)';
      ctx.shadowBlur = 14 * scale;
      ctx.fillText(line, x, y);
      ctx.shadowColor = 'rgba(255,0,128,.42)';
      ctx.shadowBlur = 24 * scale;
      ctx.fillText(line, x, y);
      ctx.shadowBlur = 0;
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    ctx.restore();

    const footerY = padY + innerH - 64 * scale;
    ctx.strokeStyle = 'rgba(255,119,188,.24)'; ctx.beginPath(); ctx.moveTo(padX + 36 * scale, footerY - 18 * scale); ctx.lineTo(padX + innerW - 36 * scale, footerY - 18 * scale); ctx.stroke();
    ctx.font = `500 ${22 * scale}px ${orbitron}`; ctx.fillStyle = '#80f0ff'; ctx.textAlign = 'left';
    ctx.fillText(meta, padX + 36 * scale, footerY);
  }

  function renderBotanical(ctx, width, height, model) {
    const quote = String(model.text || '');
    const brand = siteName(model);
    const meta = metaLine(model);
    const quoteFont = model.font?.css || 'Gowun Batang, serif';
    const quoteWeight = Math.max(700, Number(model.fontWeight || model.font?.weight || 700));
    const cinzel = 'Cinzel, Gowun Batang, serif';
    const playfair = 'Playfair Display, Gowun Batang, serif';
    const scale = width / 1200;

    ctx.fillStyle = '#f5f2eb'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e2dbcd';
    const dotStep = Math.max(24 * scale, 12);
    for (let i = 0; i <= width; i += dotStep) {
      for (let j = 0; j <= height; j += dotStep) {
        ctx.beginPath(); ctx.arc(i, j, 1.2 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(i + dotStep / 2, j + dotStep / 2, 1.2 * scale, 0, Math.PI * 2); ctx.fill();
      }
    }

    const pad = width * 0.11;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `600 ${20 * scale}px ${cinzel}`; ctx.fillStyle = 'rgba(44,62,53,.78)';
    ctx.fillText(brand.toUpperCase(), width / 2, pad);
    ctx.strokeStyle = 'rgba(44,62,53,.3)'; ctx.lineWidth = 1.2 * scale; ctx.beginPath(); ctx.moveTo(width / 2 - 42 * scale, pad + 34 * scale); ctx.lineTo(width / 2 + 42 * scale, pad + 34 * scale); ctx.stroke();

    const fontSize = (model.sizePx * (width / 380)) * 1.03;
    const lineHeight = fontSize * 1.62;
    ctx.font = `italic ${quoteWeight} ${fontSize}px ${quoteFont}`;
    const lines = makeLines2(ctx, quote, width - pad * 2, lineHeight, height * 0.42, model.autoWrap);
    let y = height * 0.36 + Math.max(0, (height * 0.42 - lines.length * lineHeight) / 2);
    ctx.fillStyle = '#1c2822';
    drawLines2(ctx, lines, model.textAlign === 'left' ? pad : model.textAlign === 'right' ? width - pad : width / 2, y, lineHeight, model.textAlign || 'center');

    ctx.strokeStyle = 'rgba(44,62,53,.3)'; ctx.beginPath(); ctx.moveTo(width / 2 - 42 * scale, height - pad - 38 * scale); ctx.lineTo(width / 2 + 42 * scale, height - pad - 38 * scale); ctx.stroke();
    ctx.font = `italic 600 ${21 * scale}px ${playfair}`; ctx.fillStyle = '#5c4033'; ctx.textAlign = 'center';
    ctx.fillText(meta, width / 2, height - pad - 18 * scale);
  }

  function renderMatrix(ctx, width, height, model) {
    const quote = String(model.text || '');
    const brand = siteName(model);
    const meta = metaLine(model);
    const quoteFont = model.font?.css || 'Fira Code, Pretendard, monospace';
    const quoteWeight = Math.max(700, Number(model.fontWeight || model.font?.weight || 700));
    const mono = 'Fira Code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    const scale = width / 1200;

    ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(0,255,136,.05)'; ctx.lineWidth = 1 * scale;
    const step = Math.max(16 * scale, 10);
    for (let i = 0; i <= width; i += step) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke(); }
    for (let j = 0; j <= height; j += step) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke(); }

    const pad = width * 0.065;
    const bLen = 20 * scale;
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.moveTo(pad, pad + bLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + bLen, pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - pad - bLen, pad); ctx.lineTo(width - pad, pad); ctx.lineTo(width - pad, pad + bLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, height - pad - bLen); ctx.lineTo(pad, height - pad); ctx.lineTo(pad + bLen, height - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - pad - bLen, height - pad); ctx.lineTo(width - pad, height - pad); ctx.lineTo(width - pad, height - pad - bLen); ctx.stroke();

    ctx.font = `500 ${20 * scale}px ${mono}`; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,255,136,.82)'; ctx.textAlign = 'left'; ctx.fillText(`> ${brand}`, pad + 12 * scale, pad + 10 * scale);
    ctx.textAlign = 'right';
    ctx.fillText('ONLINE', width - pad - 14 * scale, pad + 10 * scale);
    ctx.beginPath(); ctx.fillStyle = '#00ff88'; ctx.arc(width - pad - 118 * scale, pad + 20 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();

    const fontSize = (model.sizePx * (width / 380)) * 1.02;
    const lineHeight = fontSize * 1.54;
    ctx.font = `${quoteWeight} ${fontSize}px ${quoteFont}`;
    const lines = makeLines2(ctx, quote, width - pad * 2 - 30 * scale, lineHeight, height * 0.44, model.autoWrap);
    let y = height * 0.34 + Math.max(0, (height * 0.44 - lines.length * lineHeight) / 2);
    // The editor's real model has no textAlign field. Previously x defaulted to
    // center while Canvas defaulted to LEFT, pushing every line off the right edge.
    // Match the common quote renderer: center-align inside the measured safe width.
    const x = width / 2;
    ctx.textAlign = 'center';
    for (const line of lines) {
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#00ff88'; ctx.shadowColor = 'rgba(0,255,136,.65)'; ctx.shadowBlur = 14 * scale; ctx.fillText(line, x, y);
      y += lineHeight;
    }
    ctx.shadowBlur = 0;

    const footerY = height - pad - 40 * scale;
    ctx.strokeStyle = 'rgba(0,255,136,.24)'; ctx.beginPath(); ctx.moveTo(pad + 6 * scale, footerY - 18 * scale); ctx.lineTo(width - pad - 6 * scale, footerY - 18 * scale); ctx.stroke();
    ctx.font = `500 ${18 * scale}px ${mono}`; ctx.fillStyle = 'rgba(0,255,136,.9)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`<${meta}>`, pad + 6 * scale, footerY, width - pad * 2 - 165 * scale);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(0,255,136,.55)'; ctx.fillText('[SECURED]', width - pad - 6 * scale, footerY);
  }

  const renderers = {
    'holographic-vaporwave': renderVapor,
    'botanical-press': renderBotanical,
    'neon-matrix-terminal': renderMatrix,
  };
  return { presets, renderers };
})();

const READER_SHARE_BACKGROUNDS = [
  {
    name: "베이지",
    key: "beige",
    background: "linear-gradient(145deg, #fffdf9 0%, #f6f3ee 100%)",
    text: "#191816",
    meta: "#77716a",
    accent: "#191816",
  },
  {
    name: "다크",
    key: "dark",
    background: "linear-gradient(145deg, #211f1c 0%, #171614 100%)",
    text: "#f2ede6",
    meta: "#aaa39a",
    accent: "#eee8df",
  },
  {
    name: "그레이",
    key: "gray",
    background: "linear-gradient(145deg, #ebe6df 0%, #ddd7ce 100%)",
    text: "#2a2724",
    meta: "#77716a",
    accent: "#39352f",
  },
  {
    name: "모카",
    key: "mocha",
    background: "linear-gradient(145deg, #38342f 0%, #2a2724 100%)",
    text: "#eee8df",
    meta: "#aaa39a",
    accent: "#f3eee7",
  },
  {
    name: "샌드",
    key: "sand",
    background: "linear-gradient(145deg, #f3eee7 0%, #aaa39a 100%)",
    text: "#191816",
    meta: "#4d4841",
    accent: "#2a2724",
  },
  {
    name: "로지",
    key: "rosy-blush",
    background: "radial-gradient(circle at 18% 18%, rgba(255,255,255,.82) 0 18%, rgba(255,255,255,0) 38%), radial-gradient(circle at 82% 78%, rgba(218,137,149,.12) 0 18%, rgba(218,137,149,0) 42%), linear-gradient(138deg, #fff9fa 0%, #f7e7e9 48%, #f0dadd 100%)",
    text: "#b45b63",
    meta: "#c58a92",
    accent: "#b45b63",
    effect: "rosy-blush",
  },
  {
    name: "스카이",
    key: "sky-sparkle",
    background: "radial-gradient(circle at 20% 24%, rgba(255,255,255,.96) 0 1.2%, rgba(255,255,255,0) 2.8%), radial-gradient(circle at 74% 18%, rgba(255,255,255,.92) 0 1%, rgba(255,255,255,0) 2.5%), radial-gradient(circle at 84% 72%, rgba(255,255,255,.80) 0 1.1%, rgba(255,255,255,0) 2.6%), linear-gradient(155deg, #f4f9ff 0%, #e5f1ff 52%, #d8e8fb 100%)",
    text: "#4b78c2",
    meta: "#86a5d9",
    accent: "#4b78c2",
    effect: "sky-sparkle",
  },
  {
    name: "라벤더",
    key: "lavender-mist",
    background: "radial-gradient(ellipse at 14% 24%, rgba(240,213,235,.72) 0 16%, rgba(240,213,235,0) 45%), radial-gradient(ellipse at 84% 72%, rgba(205,224,251,.72) 0 18%, rgba(205,224,251,0) 48%), linear-gradient(145deg, #fbf8ff 0%, #eee8ff 54%, #e5dcf8 100%)",
    text: "#7652b8",
    meta: "#a28ecf",
    accent: "#7652b8",
    effect: "lavender-mist",
  },
  {
    name: "로즈쿼츠",
    key: "rose-quartz-glow",
    background: "radial-gradient(circle at 18% 18%, rgba(255,255,255,.96) 0 14%, rgba(255,255,255,0) 34%), radial-gradient(circle at 80% 78%, rgba(255,255,255,.72) 0 7%, rgba(255,255,255,0) 20%), linear-gradient(148deg, #fffdfd 0%, #fdf4f6 34%, #f4e0e4 62%, #ece8ee 100%)",
    text: "#b77b88",
    meta: "#c4a2ab",
    accent: "#b77b88",
    effect: "rose-quartz-glow",
  },
  {
    name: "세레니티",
    key: "serenity-breeze",
    background: "linear-gradient(150deg, #fbfdff 0%, #eef5ff 48%, #deebfb 100%)",
    text: "#5378bf",
    meta: "#87a1cf",
    accent: "#5378bf",
    effect: "serenity-breeze",
  },
  {
    name: "오팔",
    key: "opal-shimmer",
    background: "linear-gradient(150deg, #fffcfb 0%, #f5f8f7 28%, #eef0ff 58%, #f9f0f7 100%)",
    text: "#6e64a3",
    meta: "#9c93c0",
    accent: "#6e64a3",
    effect: "opal-shimmer",
  },
  {
    name: "미스트",
    key: "mist-layers",
    background: "radial-gradient(ellipse at 18% 24%, rgba(255,255,255,.76) 0 12%, rgba(255,255,255,0) 42%), radial-gradient(ellipse at 82% 70%, rgba(184,203,221,.30) 0 14%, rgba(184,203,221,0) 46%), radial-gradient(ellipse at 54% 44%, rgba(218,226,236,.30) 0 16%, rgba(218,226,236,0) 50%), linear-gradient(145deg, #f6f8fb 0%, #e8edf3 48%, #dce4ec 100%)",
    text: "#425468",
    meta: "#7a8999",
    accent: "#60788f",
    effect: "mist-layers",
  },
  {
    name: "청자유약",
    key: "celadon-glaze",
    background: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22%3E%3Cpath d=%22M8 16 32 34 25 58 48 78M94 8 78 31 89 52 70 76 82 108M52 0 61 24 54 45 68 66 60 94%22 fill=%22none%22 stroke=%236f9188 stroke-opacity=%22.18%22 stroke-width=%22.7%22/%3E%3C/svg%3E'), linear-gradient(145deg, #eef6f0 0%, #d7e8df 52%, #c4d9d0 100%)",
    text: "#31564d",
    meta: "#6f9188",
    accent: "#46786c",
    effect: "celadon-glaze",
  },
  {
    name: "잉크잔향",
    key: "ink-echo",
    background: "radial-gradient(ellipse at 18% 20%, rgba(34,53,78,.18) 0 5%, rgba(34,53,78,0) 24%), radial-gradient(ellipse at 82% 76%, rgba(72,90,111,.13) 0 7%, rgba(72,90,111,0) 30%), linear-gradient(145deg, #faf8f1 0%, #f0eee7 55%, #e6e5df 100%)",
    text: "#243248",
    meta: "#727b87",
    accent: "#314a6a",
    effect: "ink-echo",
  },
  {
    name: "오로라결",
    key: "aurora-weave",
    background: "radial-gradient(ellipse at 18% 24%, rgba(70,238,200,.24) 0 10%, rgba(70,238,200,0) 40%), radial-gradient(ellipse at 78% 34%, rgba(157,101,255,.24) 0 12%, rgba(157,101,255,0) 44%), linear-gradient(155deg, #101a2a 0%, #17253a 48%, #111827 100%)",
    text: "#f2f8ff",
    meta: "#a8bdd1",
    accent: "#8fe7d0",
    effect: "aurora-weave",
  },
  {
    name: "석양층운",
    key: "sunset-layers",
    background: "radial-gradient(ellipse at 18% 78%, rgba(255,193,145,.34) 0 16%, rgba(255,193,145,0) 46%), radial-gradient(ellipse at 84% 24%, rgba(183,151,222,.22) 0 16%, rgba(183,151,222,0) 46%), linear-gradient(155deg, #fff4e8 0%, #f4d8c4 45%, #d7c9dc 100%)",
    text: "#704f55",
    meta: "#9b7d83",
    accent: "#b46e67",
    effect: "sunset-layers",
  },
  {
    name: "유성궤적",
    key: "meteor-trails",
    background: "radial-gradient(circle at 18% 22%, rgba(255,255,255,.62) 0 1px, rgba(255,255,255,0) 2px), radial-gradient(circle at 78% 30%, rgba(255,255,255,.48) 0 1px, rgba(255,255,255,0) 2px), linear-gradient(150deg, #11162b 0%, #232a49 52%, #15182a 100%)",
    text: "#f5f4ff",
    meta: "#a9acd0",
    accent: "#d5d7ff",
    effect: "meteor-trails",
  },
  {
    name: "바람결",
    key: "wind-contours",
    background: "repeating-radial-gradient(ellipse at 8% 18%, rgba(92,134,164,.10) 0 1px, rgba(92,134,164,0) 2px 18px), linear-gradient(145deg, #fbfcfa 0%, #edf4f3 48%, #e3edf0 100%)",
    text: "#405968",
    meta: "#7a909a",
    accent: "#527c8e",
    effect: "wind-contours",
  },
  {
    name: "유리온실",
    key: "glasshouse",
    background: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 140 140%22%3E%3Cg fill=%22none%22 stroke=%234f806b stroke-opacity=%22.12%22 stroke-width=%221%22%3E%3Cpath d=%22M12 134C38 104 40 65 24 24M24 66c20-10 29-25 33-45M24 82C43 76 57 80 70 96M118 138c-14-34-10-72 12-110M119 72c-20-8-31-22-38-39%22/%3E%3C/g%3E%3C/svg%3E'), linear-gradient(145deg, #f5fbf7 0%, #deeee5 50%, #d0e4d9 100%)",
    text: "#355c4c",
    meta: "#739486",
    accent: "#4f806b",
    effect: "glasshouse",
  },
  {
    name: "흑연결",
    key: "graphite-grain",
    background: "repeating-linear-gradient(8deg, rgba(44,48,53,.055) 0 1px, rgba(44,48,53,0) 1px 5px), repeating-linear-gradient(98deg, rgba(44,48,53,.028) 0 1px, rgba(44,48,53,0) 1px 8px), linear-gradient(145deg, #f2f2ef 0%, #dfdfdc 100%)",
    text: "#303238",
    meta: "#6e7178",
    accent: "#444850",
    effect: "graphite-grain",
  },
  {
    name: "페탈",
    key: "petal-flow",
    background: "radial-gradient(ellipse at 12% 18%, rgba(255,255,255,.86) 0 10%, rgba(255,255,255,0) 34%), radial-gradient(ellipse at 84% 76%, rgba(238,173,185,.18) 0 14%, rgba(238,173,185,0) 40%), linear-gradient(145deg, #fffafb 0%, #faeef1 50%, #f3e2e7 100%)",
    text: "#8f5964",
    meta: "#b38a92",
    accent: "#d48a9a",
    effect: "petal-flow",
  },
  {
    name: "글로우",
    key: "soft-glow",
    background: "radial-gradient(circle at 18% 26%, rgba(218,255,178,.17) 0 3%, rgba(218,255,178,0) 18%), radial-gradient(circle at 78% 20%, rgba(255,232,132,.16) 0 2%, rgba(255,232,132,0) 16%), radial-gradient(circle at 82% 76%, rgba(190,255,198,.12) 0 3%, rgba(190,255,198,0) 18%), linear-gradient(150deg, #101a19 0%, #172822 52%, #0e1716 100%)",
    text: "#eef7ef",
    meta: "#9eb7a8",
    accent: "#dceca0",
    effect: "soft-glow",
  },
  {
    name: "테이프",
    key: "paper-tape",
    background: "linear-gradient(11deg, transparent 0 80%, rgba(214,191,150,.12) 80% 84%, transparent 84%), repeating-linear-gradient(0deg, rgba(104,88,69,.028) 0 1px, transparent 1px 6px), linear-gradient(145deg, #fbf7ef 0%, #f2eadc 100%)",
    text: "#4d4338",
    meta: "#8c7e6f",
    accent: "#b98e68",
    effect: "paper-tape",
  },
  {
    name: "새벽안개",
    key: "dawn-fog",
    background: "radial-gradient(ellipse at 20% 72%, rgba(255,255,255,.52) 0 20%, rgba(255,255,255,0) 52%), radial-gradient(ellipse at 78% 24%, rgba(203,221,232,.38) 0 18%, rgba(203,221,232,0) 50%), linear-gradient(145deg, #f4f7f8 0%, #e3ebef 48%, #cfdde4 100%)",
    text: "#425968",
    meta: "#7f939f",
    accent: "#5f7f91",
    effect: "dawn-fog",
  },
  {
    name: "골드",
    key: "hanji-gilt",
    defaultVisible: false,
    background: "radial-gradient(circle at 90% 8%, rgba(214,174,92,.55) 0 5%, rgba(214,174,92,0) 26%), radial-gradient(circle at 6% 94%, rgba(214,174,92,.40) 0 4%, rgba(214,174,92,0) 22%), linear-gradient(150deg, #fbf5e8 0%, #efe3c8 100%)",
    text: "#33261a",
    meta: "#8a7556",
    accent: "#b8923f",
    effect: "hanji-gilt",
  },
  {
    name: "북샵",
    key: "midnight-bookshop",
    defaultVisible: false,
    background: "radial-gradient(circle at 84% 12%, rgba(255,190,104,.55) 0 6%, rgba(255,158,72,0) 48%), linear-gradient(150deg, #16233f 0%, #0a1020 100%)",
    text: "#f6ead6",
    meta: "#a9b4cc",
    accent: "#ffbe68",
    effect: "midnight-bookshop",
  },
  {
    name: "워터컬러",
    key: "watercolor-bleed",
    defaultVisible: false,
    background: "radial-gradient(circle at 8% 6%, rgba(72,160,160,.38) 0 14%, rgba(72,160,160,0) 34%), radial-gradient(circle at 96% 96%, rgba(232,184,84,.42) 0 14%, rgba(232,184,84,0) 36%), linear-gradient(150deg, #fffdf8 0%, #f6f1e6 100%)",
    text: "#2c2a28",
    meta: "#7d776c",
    accent: "#48a0a0",
    effect: "watercolor-bleed",
  },
  {
    name: "문라이트",
    key: "moon-ridge",
    defaultVisible: false,
    background: "radial-gradient(circle at 76% 20%, rgba(255,244,214,.62) 0 5%, rgba(255,244,214,0) 30%), linear-gradient(180deg, #101a3a 0%, #070b1c 100%)",
    text: "#eef0fb",
    meta: "#9fabd0",
    accent: "#f0dfb4",
    effect: "moon-ridge",
  },
  {
    name: "프리즘",
    key: "prism-foil",
    defaultVisible: false,
    background: "linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,170,200,.34) 40%, rgba(255,247,170,.30) 50%, rgba(150,214,244,.36) 62%, rgba(184,170,250,.34) 70%, rgba(255,255,255,0) 80%), linear-gradient(150deg, #fdfdff 0%, #f1f2fb 100%)",
    text: "#25284a",
    meta: "#7b7fa6",
    accent: "#8f86e8",
    effect: "prism-foil",
  },
  {
    name: "서리유리",
    key: "frost-window",
    defaultVisible: false,
    background: "radial-gradient(circle at 4% 96%, rgba(255,255,255,.85) 0 8%, rgba(255,255,255,0) 40%), linear-gradient(150deg, #eef6fb 0%, #d3e4f0 100%)",
    text: "#1f3347",
    meta: "#6f8aa0",
    accent: "#7fb4d6",
    effect: "frost-window",
  },
  {
    name: "해변물결",
    key: "tide-lines",
    defaultVisible: false,
    background: "radial-gradient(circle at 50% 64%, rgba(255,214,170,.6) 0 8%, rgba(255,214,170,0) 46%), linear-gradient(180deg, #fde7d4 0%, #cfe8ee 100%)",
    text: "#3b2f33",
    meta: "#4f6068",
    accent: "#f0a982",
    effect: "tide-lines",
  },
  {
    name: "새벽숲",
    key: "forest-haze",
    defaultVisible: false,
    background: "radial-gradient(circle at 28% 8%, rgba(214,255,206,.45) 0 6%, rgba(214,255,206,0) 40%), linear-gradient(180deg, #1f3f37 0%, #0b1a18 100%)",
    text: "#eaf5e6",
    meta: "#9db8ac",
    accent: "#d6ffce",
    effect: "forest-haze",
  },
  {
    name: "필름누광",
    key: "film-leak",
    defaultVisible: false,
    background: "linear-gradient(90deg, rgba(255,96,40,.75) 0 4%, rgba(255,96,40,0) 34%), linear-gradient(150deg, #2d2220 0%, #130f0e 100%)",
    text: "#f7e9d8",
    meta: "#b79f8c",
    accent: "#ff6028",
    effect: "film-leak",
  },
  {
    name: "별자리지도",
    key: "star-chart",
    defaultVisible: false,
    background: "radial-gradient(circle at 80% 24%, rgba(255,226,160,.30) 0 4%, rgba(255,226,160,0) 30%), linear-gradient(150deg, #10303a 0%, #07161c 100%)",
    text: "#e6f4f2",
    meta: "#8fb3b4",
    accent: "#ffe2a0",
    effect: "star-chart",
  },
  {
    name: "폴카",
    key: "soft-polka",
    defaultVisible: false,
    background: "radial-gradient(circle, rgba(150,205,235,.35) 0 5px, transparent 9px) 0 0/34px 34px, linear-gradient(135deg, #f2f9fd 0%, #e3f1fa 100%)",
    text: "#36556e",
    meta: "#6f8ca4",
    accent: "#4f89b3",
    effect: "soft-polka",
  },
  {
    name: "레이스",
    key: "lace-grid",
    defaultVisible: false,
    background: "linear-gradient(rgba(240,150,170,.22) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, rgba(240,150,170,.22) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(160deg, #fff1f4 0%, #ffe3ea 100%)",
    text: "#7a3b4e",
    meta: "#b06c7e",
    accent: "#f08faa",
    effect: "lace-grid",
  },
  {
    name: "레트로",
    key: "retro-window",
    defaultVisible: false,
    background: "linear-gradient(90deg, rgba(10,42,140,.9), rgba(45,111,208,.9)) 0 0/100% 7% no-repeat, linear-gradient(145deg, #c9cdd3 0%, #bdc2ca 100%)",
    text: "#23262e",
    meta: "#4a5f8e",
    accent: "#0a2a8c",
    effect: "retro-window",
  },
  {
    name: "마커",
    key: "marker-plaid",
    defaultVisible: false,
    background: "repeating-linear-gradient(90deg, rgba(130,200,245,.5) 0 5px, transparent 5px 62px), repeating-linear-gradient(0deg, rgba(130,200,245,.5) 0 5px, transparent 5px 74px), repeating-linear-gradient(90deg, rgba(255,236,140,.55) 0 7px, transparent 7px 118px) 30px 0, linear-gradient(135deg, #ffffff 0%, #f5faff 100%)",
    text: "#2e4b66",
    meta: "#6c87a1",
    accent: "#5ab3e8",
    effect: "marker-plaid",
  },
  {
    name: "그래프",
    key: "graph-paper",
    defaultVisible: false,
    background: "linear-gradient(rgba(130,138,150,.28) 1px, transparent 1px) 0 0/22px 22px, linear-gradient(90deg, rgba(130,138,150,.28) 1px, transparent 1px) 0 0/22px 22px, linear-gradient(135deg, #ffffff 0%, #f4f5f7 100%)",
    text: "#2f3440",
    meta: "#7c838f",
    accent: "#9aa2ad",
    effect: "graph-paper",
  },
  {
    name: "클라우드",
    key: "cumulus",
    defaultVisible: false,
    background: "radial-gradient(ellipse at 24% 100%, rgba(255,255,255,.95) 0 14%, transparent 30%), radial-gradient(ellipse at 84% 96%, rgba(255,255,255,.9) 0 12%, transparent 26%), linear-gradient(180deg, #8ec6f5 0%, #d7ecfb 100%)",
    text: "#1b3f6e",
    meta: "#5f7fa9",
    accent: "#7cb6f0",
    effect: "cumulus",
  },
  {
    name: "리플",
    key: "ripple-pool",
    defaultVisible: false,
    background: "radial-gradient(circle at 82% 88%, transparent 0 6%, rgba(255,255,255,.4) 7% 8%, transparent 9% 14%, rgba(255,255,255,.3) 15% 16%, transparent 17%), radial-gradient(circle at 14% 10%, rgba(255,190,150,.4), transparent 24%), linear-gradient(150deg, #bfe8e4 0%, #e9f5ee 100%)",
    text: "#2d5a5e",
    meta: "#6f9597",
    accent: "#67b9bb",
    effect: "ripple-pool",
  },
  {
    name: "크래프트",
    key: "kraft",
    defaultVisible: false,
    background: "radial-gradient(rgba(90,60,30,.12) 1px, transparent 1.5px) 0 0/9px 9px, linear-gradient(135deg, #cba77c 0%, #b8946a 100%)",
    text: "#2b1d10",
    meta: "#6d5138",
    accent: "#8c5f36",
    effect: "kraft",
  },
  {
    name: "벨럼",
    key: "vellum",
    defaultVisible: false,
    background: "linear-gradient(115deg, transparent 48%, rgba(120,130,140,.18) 49% 50%, transparent 51%), linear-gradient(135deg, #f4f2ef 0%, #e5e8ea 100%)",
    text: "#2f3338",
    meta: "#6f767d",
    accent: "#939aa3",
    effect: "vellum",
  },
  {
    name: "크럼플",
    key: "crumple",
    defaultVisible: false,
    background: "linear-gradient(120deg, rgba(0,0,0,.05) 0 18%, transparent 18% 40%, rgba(255,255,255,.5) 40% 58%, transparent 58% 78%, rgba(0,0,0,.04) 78%), linear-gradient(135deg, #f7f6f3 0%, #eceae5 100%)",
    text: "#2b2a27",
    meta: "#726f69",
    accent: "#8d887e",
    effect: "crumple",
  },
  {
    name: "깅엄",
    key: "gingham",
    defaultVisible: false,
    background: "repeating-linear-gradient(90deg, rgba(233,180,189,.55) 0 18px, rgba(248,223,228,.55) 18px 36px), repeating-linear-gradient(0deg, rgba(233,180,189,.45) 0 18px, rgba(248,223,228,.45) 18px 36px), linear-gradient(135deg, #faefef 0%, #f5e5e5 100%)",
    text: "#7b4e58",
    meta: "#b48890",
    accent: "#e4aeb9",
    effect: "gingham",
  },
  // The lab's CSS thumbnails and original Canvas effects share one definition.
  ...READER_SHARE_NEW8.presets,
  ...READER_SHARE_CURATED_SET1.presets,
  ...READER_SHARE_CURATED_SET2.presets,
  ...READER_SHARE_GEMINI4.presets,
  ...READER_SHARE_GEMINI_SELECT3.presets,
];

const READER_SHARE_FONTS = [
  { key: "ridibatang", label: "리디바탕", css: READER_FONT_FAMILIES.ridibatang, weight: 400 },
  { key: "paperlogy", label: "페이퍼로지", css: READER_FONT_FAMILIES.paperlogy, weight: 500 },
  { key: "chosunilbo", label: "조선일보명조", css: READER_FONT_FAMILIES.chosunilbo, weight: 400 },
  { key: "inkliquid", label: "잉크립퀴드", css: READER_FONT_FAMILIES.inkliquid, weight: 400 },
  { key: "kopubbatang", label: "KoPub 바탕", css: READER_FONT_FAMILIES.kopubbatang, weight: 400 },
  { key: "default", label: "프리텐다드", css: READER_FONT_FAMILIES.default, weight: 400 },
  { key: "nanumneo", label: "나눔네오", css: READER_FONT_FAMILIES.nanumneo, weight: 400 },
  { key: "bookkmyungjo", label: "부크크명조", css: READER_FONT_FAMILIES.bookkmyungjo, weight: 400 },
  { key: "mapoflower", label: "마포꽃섬", css: READER_FONT_FAMILIES.mapoflower, weight: 400 },
  { key: "gowunbatang", label: "고운바탕", css: READER_FONT_FAMILIES.gowunbatang, weight: 400 },
  { key: "maruburi", label: "마루 부리", css: READER_FONT_FAMILIES.maruburi, weight: 400 },
  { key: "galmuri", label: "갈무리", css: READER_FONT_FAMILIES.galmuri, weight: 400 },
];

function ensureReaderShareFont(fontKey) {
  if (fontKey === "kopubbatang") return ensureKopubFont();
  if (isLazyReaderFont(fontKey)) return ensureReaderLazyFont(fontKey);
  return Promise.resolve(true);
}

const READER_SHARE_SIZES = {
  xxs: { button: "1", label: "더아주작게", px: 12 },
  xs: { button: "2", label: "아주작게", px: 14.5 },
  sm: { button: "3", label: "작게", px: 17 },
  md: { button: "4", label: "보통", px: 20.5 },
  lg: { button: "5", label: "크게", px: 25 },
};

const READER_SHARE_WEIGHTS = {
  light: { label: "얇게", weight: 300 },
  regular: { label: "보통", weight: 500 },
  bold: { label: "굵게", weight: 700 },
};

const READER_SHARE_LIGHT_WEIGHT_FONTS = new Set(["paperlogy", "kopubbatang"]);

function readerShareFontSupportsLight(fontKey = state.readerShareFont) {
  return READER_SHARE_LIGHT_WEIGHT_FONTS.has(String(fontKey || ""));
}

function normalizeReaderShareWeightForFont() {
  if (state.readerShareWeight === "light" && !readerShareFontSupportsLight()) {
    state.readerShareWeight = "regular";
  }
}

let readerShareUi = null;
let readerShareSelectionTimer = 0;

function ensureReaderShareState() {
  if (!Number.isInteger(state.readerShareBackground)) state.readerShareBackground = 0;
  if (!["1:1", "4:5", "2:3"].includes(state.readerShareRatio)) state.readerShareRatio = "1:1";
  if (!state.readerShareFont) state.readerShareFont = "paperlogy";
  if (state.readerShareFont === "suit") state.readerShareFont = "nanumneo";
  if (!READER_SHARE_SIZES[state.readerShareSize]) state.readerShareSize = "xs";
  if (state.readerShareWeight === "semibold") state.readerShareWeight = "regular";
  if (!["light", "regular", "bold"].includes(state.readerShareWeight)) state.readerShareWeight = "regular";
  normalizeReaderShareWeightForFont();
  if (typeof state.readerShareAutoWrap !== "boolean") state.readerShareAutoWrap = true;
}

function getReaderShareBrandName() {
  return String(
    document.getElementById("brandText")?.textContent ||
    document.title ||
    "셩냥책"
  ).trim() || "셩냥책";
}

let readerSharePresetVisibility = null;
let readerSharePresetVisibilityPromise = null;
const READER_SHARE_PRESET_VISIBILITY_CACHE_KEY = "rjsQuotePresetVisibilityV1";
let readerShareAdminPreviewKey = "";
const READER_SHARE_ADMIN_EMBED_MODE = new URLSearchParams(window.location.search).get("quote-embed") === "1";
const READER_SHARE_ADMIN_GALLERY_MODE = READER_SHARE_ADMIN_EMBED_MODE && new URLSearchParams(window.location.search).get("quote-gallery") === "1";
let readerShareAdminOutputTimer = 0;
let readerShareAdminOutputGeneration = 0;

function getReaderShareBackgroundKey(background) {
  return String(background?.key || background?.effect || background?.name || "");
}

function getReaderShareDefaultVisibility(background) {
  return background?.defaultVisible !== false;
}

async function loadReaderSharePresetVisibility({ admin = false, force = false } = {}) {
  if (!admin && readerSharePresetVisibility && !force) return readerSharePresetVisibility;
  if (!admin && readerSharePresetVisibilityPromise && !force) return readerSharePresetVisibilityPromise;
  const endpoint = admin ? "/api/admin/quote-image-presets" : "/api/quote-image-presets";
  const task = (async () => {
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: admin ? "no-store" : "default" });
      if (!response.ok) throw new Error(`preset_visibility_${response.status}`);
      const data = await response.json();
      const map = new Map();
      for (const preset of Array.isArray(data?.presets) ? data.presets : []) {
        if (preset && typeof preset.key === "string" && typeof preset.visible === "boolean") map.set(preset.key, preset.visible);
      }
      if (!admin) {
        readerSharePresetVisibility = map;
        try {
          sessionStorage.setItem(READER_SHARE_PRESET_VISIBILITY_CACHE_KEY, JSON.stringify([...map.entries()]));
        } catch (_) {}
      }
      return map;
    } catch (error) {
      if (admin) throw error;
      console.warn("문장 이미지 프리셋 노출 설정 로드 실패, 최근 설정 또는 기본값 사용", error);
      let fallback = null;
      try {
        const cached = JSON.parse(sessionStorage.getItem(READER_SHARE_PRESET_VISIBILITY_CACHE_KEY) || "null");
        if (Array.isArray(cached)) fallback = new Map(cached.filter((entry) => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "boolean"));
      } catch (_) {}
      if (!fallback || !fallback.size) {
        fallback = new Map(READER_SHARE_BACKGROUNDS.map((background) => [getReaderShareBackgroundKey(background), getReaderShareDefaultVisibility(background)]));
      }
      readerSharePresetVisibility = fallback;
      return fallback;
    } finally {
      if (!admin) readerSharePresetVisibilityPromise = null;
    }
  })();
  if (!admin) readerSharePresetVisibilityPromise = task;
  return task;
}

function getVisibleReaderShareBackgroundEntries() {
  const map = readerSharePresetVisibility;
  return READER_SHARE_BACKGROUNDS.map((background, index) => ({ background, index }))
    .filter(({ background }) => {
      if (readerShareAdminPreviewKey) return true;
      const key = getReaderShareBackgroundKey(background);
      return map?.has(key) ? map.get(key) === true : getReaderShareDefaultVisibility(background);
    });
}

// v10.09: SVG data URLs contain quotes. Assign styles via DOM instead of HTML
// interpolation, which used to terminate the inline style attribute early.
// Defer only expensive vector backgrounds until near the horizontal viewport.
let readerShareThumbObserver = null;
function renderReaderShareBackgroundThumbs(thumbs) {
  if (!thumbs) return;
  readerShareThumbObserver?.disconnect();
  readerShareThumbObserver = null;

  const fragment = document.createDocumentFragment();
  const delayed = [];
  for (const { background, index } of getVisibleReaderShareBackgroundEntries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reader-share-thumb";
    button.dataset.shareBackground = String(index);
    button.dataset.themeName = String(background.name || "");
    button.setAttribute("aria-label", `${background.name} 테마`);
    button.style.setProperty("--thumb-label", String(background.text || "#fff"));
    const cssBackground = String(background.background || "");
    if (cssBackground.includes("data:image/svg+xml") && typeof IntersectionObserver === "function") {
      // Keep the correct base color until the nearby SVG thumbnail is painted.
      button.style.backgroundColor = "#f4f1eb";
      delayed.push([button, cssBackground]);
    } else {
      button.style.background = cssBackground;
    }
    fragment.appendChild(button);
  }
  thumbs.replaceChildren(fragment);
  if (!delayed.length) return;

  const backgrounds = new Map(delayed);
  readerShareThumbObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const cssBackground = backgrounds.get(entry.target);
      if (cssBackground) entry.target.style.background = cssBackground;
      backgrounds.delete(entry.target);
      observer.unobserve(entry.target);
    }
    if (!backgrounds.size) observer.disconnect();
  }, { root: thumbs, rootMargin: "0px 320px 0px 320px" });
  for (const [button] of delayed) readerShareThumbObserver.observe(button);
}

function ensureReaderShareUi() {
  if (readerShareUi) return readerShareUi;
  ensureReaderShareState();

  const style = document.createElement("style");
  style.id = "readerShareStyle";
  style.textContent = `
    @font-face { font-family: 'Paperozi'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-3Light.woff2') format('woff2'); font-weight: 300; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Paperozi'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-5Medium.woff2') format('woff2'); font-weight: 500; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Paperozi'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-7Bold.woff2') format('woff2'); font-weight: 700; font-style: normal; font-display: swap; }
    @font-face { font-family: 'ChosunIlboMyungjo'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/Chosunilbo_myungjo.woff') format('woff'); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Ridibatang'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff') format('woff'); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: 'InkLiquid'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/InkLipquid.woff') format('woff'); font-weight: 400; font-style: normal; font-display: swap; }
    .reader-share-float {
      position: fixed; z-index: 1300; width: 38px; height: 38px; border: 0;
      border-radius: 999px; display: grid; place-items: center; cursor: pointer;
      background: rgba(37, 31, 27, .96); color: #f6efe5; border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 8px 24px rgba(31, 20, 37, .24);
      transform: translate(-50%, 0); transition: opacity .15s ease, transform .15s ease;
    }
    .reader-share-float[hidden] { display: none !important; }
    .reader-share-float svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    html.theme-dark .reader-share-float { background:#fff; color:#191816; border-color:rgba(0,0,0,.08); box-shadow:0 8px 24px rgba(0,0,0,.38); }
    .reader-share-backdrop { position: fixed; inset: 0; z-index: 1390; background: rgba(20,14,24,.46); backdrop-filter: blur(4px); }
    .reader-share-backdrop[hidden] { display: none !important; }
    .reader-share-sheet {
      position: absolute; left: 50%; bottom: 0; width: min(calc(100% - 12px), 560px); max-height: 92dvh;
      overflow: hidden; transform: translateX(-50%); border-radius: 24px 24px 0 0;
      background: var(--surface, #fff); color: var(--text, #2c2630);
      box-shadow: 0 -16px 48px rgba(27,18,31,.22); box-sizing: border-box;
    }
    .reader-share-sheet-scroll {
      max-height: 92dvh; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
      padding: 10px 14px calc(24px + env(safe-area-inset-bottom, 0px));
      scrollbar-gutter: stable;
      box-sizing: border-box;
    }
    .reader-share-handle { width: 40px; height: 4px; border-radius: 999px; background: rgba(93,78,101,.24); margin: 2px auto 8px; }
    .reader-share-head { position:sticky; top:-10px; z-index:6; display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 -14px 8px; padding:10px 14px 8px; background:var(--surface,#fff); border-bottom:1px solid rgba(91,75,99,.08); }
    .reader-share-head strong { font-size: 16px; }
    .reader-share-close { border:0; background:transparent; color:inherit; width:34px; height:34px; border-radius:50%; font-size:24px; cursor:pointer; }
    .reader-share-section { border-top:1px solid rgba(91,75,99,.11); padding:11px 0; }
    .reader-share-section:first-of-type { border-top:0; padding-top:5px; }
    .reader-share-row { display:grid; grid-template-columns:72px minmax(0,1fr); align-items:center; gap:10px; }
    .reader-share-label { font-size:12px; font-weight:750; color:var(--muted, #756d79); white-space:nowrap; }
    .reader-share-preview-wrap { display:flex; justify-content:center; padding:2px 0 10px; }
    .reader-share-card { position:relative; width:min(82vw, 380px); aspect-ratio:1/1; border-radius:18px; overflow:hidden; background:#eee center/cover no-repeat; box-shadow:0 12px 28px rgba(29,20,33,.17); transition:aspect-ratio .16s ease,width .16s ease,opacity .16s ease; }
    .reader-share-card.is-render-loading { opacity:.92; background:var(--surface,#f3f4f6) !important; }
    .reader-share-card.is-render-loading > :not(.reader-share-card-render):not(.reader-share-render-loading) { visibility:hidden; }
    .reader-share-card-render { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; z-index:3; background:transparent; }
    .reader-share-card-render[hidden] { display:none !important; }
    .reader-share-render-loading { position:absolute; inset:0; z-index:5; display:grid; place-items:center; pointer-events:none; }
    .reader-share-render-loading[hidden] { display:none !important; }
    .reader-share-render-loading .spinner { width:64px; height:6px; }
    .reader-share-card[data-ratio="2:3"] { aspect-ratio:2/3; width:min(68vw, 300px); }
    .reader-share-card[data-ratio="4:5"] { aspect-ratio:4/5; width:min(72vw, 340px); }
    .reader-share-card::before { content:""; position:absolute; inset:0; background:rgba(0,0,0,.02); pointer-events:none; }
    .reader-share-card-brand { position:absolute; z-index:1; left:7%; top:5.55%; display:flex; align-items:center; gap:5px; font-size:10px; font-weight:800; line-height:1; letter-spacing:.02em; opacity:.6; }
    .reader-share-card-brand svg { width:15px; height:15px; flex:0 0 15px; transform:translateY(-.5px); }
    .reader-share-brand-text { display:inline-block; transform:translateY(.5px); }
    .reader-share-card-quote { position:absolute; z-index:1; left:7%; right:7%; top:13%; bottom:15%; display:flex; flex-direction:column; justify-content:flex-start; text-align:center; overflow:hidden; line-height:1.56; font-weight:650; letter-spacing:-.02em; word-break:keep-all; -webkit-text-size-adjust:100%; text-size-adjust:100%; transition:font-size .14s ease, font-weight .14s ease; }
    .reader-share-card-quote-text { display:block; width:100%; flex:0 0 auto; margin-block:auto; }
    .reader-share-card[data-ratio="2:3"] .reader-share-card-quote { top:11.5%; bottom:11.5%; }
    .reader-share-card[data-ratio="4:5"] .reader-share-card-quote { top:12%; bottom:13%; }
    .reader-share-card-meta { position:absolute; z-index:1; left:8%; right:8%; bottom:5.8%; text-align:center; font-size:10px; line-height:1.4; opacity:.86; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .reader-share-card[data-ratio="2:3"] .reader-share-card-meta { bottom:4.9%; }
    .reader-share-thumbs { display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; padding:1px 1px 3px; scrollbar-width:none; -webkit-overflow-scrolling:touch; overscroll-behavior-inline:contain; touch-action:pan-x; }
    .reader-share-thumbs::-webkit-scrollbar { display:none; }
    .reader-share-thumb { position:relative; flex:0 0 58px; width:58px; height:52px; padding:0; border:2px solid transparent; border-radius:11px; overflow:hidden; cursor:pointer; box-shadow:inset 0 0 0 1px rgba(70,55,75,.08); }
    .reader-share-thumb.active { border-color:#5a4e45; box-shadow:0 0 0 2px rgba(90,78,69,.14), inset 0 0 0 1px rgba(255,255,255,.22); }
    .reader-share-thumb::after { content:attr(data-theme-name); position:absolute; left:5px; right:5px; bottom:4px; font-size:8px; font-weight:800; line-height:1; text-align:center; color:var(--thumb-label,#fff); text-shadow:0 1px 3px rgba(0,0,0,.2); }
    .reader-share-input { width:100%; min-height:70px; max-height:120px; resize:vertical; box-sizing:border-box; border:1px solid rgba(90,74,98,.16); border-radius:12px; background:rgba(255,255,255,.66); color:inherit; padding:10px 11px; font:inherit; font-size:13px; line-height:1.5; outline:none; }
    .reader-share-input:focus { border-color:rgba(90,78,69,.45); box-shadow:0 0 0 3px rgba(90,78,69,.08); }
    .reader-share-actions { display:grid; grid-template-columns:repeat(var(--share-action-count, 4),minmax(0,1fr)); gap:8px; }
    .reader-share-action[data-share-system][hidden], .reader-share-action[data-share-work-link][hidden] { display:none !important; }
    .reader-share-action { min-height:42px; border-radius:12px; border:1px solid rgba(91,75,99,.18); font-size:13px; font-weight:800; cursor:pointer; }
    .reader-share-action.primary { background:#191816; color:#fff; border-color:#191816; }
    .reader-share-action.secondary { background:rgba(255,255,255,.64); color:inherit; }
    .reader-share-action:disabled { opacity:.56; cursor:wait; }
    .reader-share-options { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
    .reader-share-fonts { display:grid; grid-template-rows:repeat(2,max-content); grid-auto-flow:column; grid-auto-columns:max-content; gap:7px; overflow-x:auto; overflow-y:hidden; max-width:100%; padding:1px 1px 4px; overscroll-behavior-inline:contain; scroll-snap-type:x proximity; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
    .reader-share-fonts::-webkit-scrollbar { display:none; }
    .reader-share-fonts .reader-share-chip { white-space:nowrap; scroll-snap-align:start; }
    .reader-share-chip { border:1px solid rgba(91,75,99,.17); background:rgba(255,255,255,.56); color:inherit; border-radius:10px; min-height:34px; padding:7px 10px; font-size:12px; font-weight:700; cursor:pointer; }
    .reader-share-chip.active { border-color:#5a4e45; color:#3f372f; background:rgba(90,78,69,.1); box-shadow:0 0 0 1px rgba(90,78,69,.06); }
    .reader-share-chip:disabled { opacity:.38; cursor:not-allowed; box-shadow:none; }
    .reader-share-color { display:inline-flex; align-items:center; gap:6px; }
    .reader-share-color-dot { width:16px; height:16px; border-radius:50%; border:1px solid rgba(0,0,0,.18); box-shadow:0 0 0 2px rgba(255,255,255,.45); }
    .reader-share-color-dot.white { background:#fff; }
    .reader-share-color-dot.black { background:#111; }
    .reader-share-switch { margin-left:auto; position:relative; width:44px; height:26px; border:0; border-radius:999px; background:rgba(91,75,99,.2); cursor:pointer; transition:.16s ease; padding:0; }
    .reader-share-switch::after { content:""; position:absolute; width:20px; height:20px; left:3px; top:3px; border-radius:50%; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.18); transition:.16s ease; }
    .reader-share-switch.active { background:#5a4e45; }
    .reader-share-switch.active::after { transform:translateX(18px); }
    .reader-share-wrap-control { display:flex; align-items:center; justify-content:space-between; gap:10px; min-width:0; }
    .reader-share-wrap-note { color:var(--muted,#756d79); font-size:11px; line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    @media (max-width: 719px) {
      .reader-header .reader-filename { margin-bottom:14px !important; padding-bottom:2px !important; }
      .reader-resume { margin-top:10px !important; position:relative !important; clear:both !important; z-index:1; }
      .reader-share-actions { grid-template-columns:repeat(2,minmax(0,1fr)); }
      /* Expand only a lone final share button; keep even-count action grids compact. */
      .reader-share-actions[data-share-system-wide="true"] .reader-share-action[data-share-system] { grid-column:1 / -1; }
      .reader-share-action { padding-left:6px; padding-right:6px; font-size:12px; }
    }
    @media (min-width: 720px) {
      .reader-share-actions { grid-template-columns:repeat(var(--share-action-count, 4),minmax(0,1fr)); }
      .reader-share-sheet { bottom:50%; transform:translate(-50%,50%); border-radius:24px; max-height:min(88vh,860px); width:min(calc(100% - 24px), 560px); }
      .reader-share-sheet-scroll { max-height:min(88vh,860px); padding:12px 18px 20px; }
      .reader-share-head { top:-12px; margin-left:-18px; margin-right:-18px; padding-left:18px; padding-right:18px; }
      .reader-share-card { width:min(48vw,360px); }
      .reader-share-card[data-ratio="2:3"] { width:min(30vw,250px); }
      .reader-share-card[data-ratio="4:5"] { width:min(40vw,320px); }
    }
    html.quote-admin-embed, html.quote-admin-embed body { min-height:100%; height:100%; background:var(--bg,#f4f7fb); overflow:hidden; }
    html.quote-admin-embed body > :not(.reader-share-backdrop):not(.reader-selection-actions) { display:none !important; }
    html.quote-admin-embed .reader-selection-actions { display:none !important; }
    html.quote-admin-embed .reader-share-backdrop { position:fixed; inset:0; z-index:1; background:transparent; display:block !important; }
    html.quote-admin-embed .reader-share-sheet { bottom:50%; width:min(calc(100% - 16px),560px); max-height:calc(100dvh - 12px); transform:translate(-50%,50%); border-radius:20px; box-shadow:0 10px 34px rgba(15,23,42,.12); }
    html.quote-admin-embed .reader-share-sheet-scroll { max-height:calc(100dvh - 12px); }
    html.quote-admin-embed .reader-share-close { display:none; }
  `;
  document.head.appendChild(style);

  const floatButton = document.createElement("button");
  floatButton.type = "button";
  floatButton.className = "reader-share-float reader-selection-action";
  floatButton.hidden = true;
  floatButton.setAttribute("aria-label", "선택한 문구 공유 카드 만들기");
  floatButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5"></circle>
      <circle cx="6" cy="12" r="2.5"></circle>
      <circle cx="18" cy="19" r="2.5"></circle>
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"></path>
    </svg>`;
  const selectionActions = document.createElement("div");
  selectionActions.className = "reader-selection-actions";
  selectionActions.hidden = true;
  selectionActions.appendChild(floatButton);
  const memoButton = document.createElement("button");
  memoButton.type = "button"; memoButton.className = "reader-selection-action"; memoButton.setAttribute("aria-label", "선택한 문장에 메모");
  memoButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>`;
  selectionActions.appendChild(memoButton);
  document.body.appendChild(selectionActions);

  const backdrop = document.createElement("div");
  backdrop.className = "reader-share-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="reader-share-sheet" role="dialog" aria-modal="true" aria-label="문구 공유 카드 편집">
      <div class="reader-share-sheet-scroll">
        <div class="reader-share-handle" aria-hidden="true"></div>
        <div class="reader-share-head">
          <strong>문장 이미지 만들기</strong>
          <button type="button" class="reader-share-close" aria-label="닫기">×</button>
        </div>

        <div class="reader-share-preview-wrap">
          <div class="reader-share-card" data-ratio="1:1">
            <img class="reader-share-card-render" alt="문장 이미지 미리보기" hidden />
            <div class="reader-share-render-loading" aria-label="문장 이미지 생성 중"><span class="spinner" aria-hidden="true"></span></div>
            <div class="reader-share-card-brand">
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M8.3 11.6 6.7 6.8l5.1 2.7A11.7 11.7 0 0 1 16 8.7c1.5 0 2.9.3 4.2.8l5.1-2.7-1.6 4.8a9.2 9.2 0 0 1 2 5.7c0 5.2-4.3 9-9.7 9s-9.7-3.8-9.7-9c0-2.2.7-4.1 2-5.7Z" fill="currentColor"></path>
              </svg>
              <span class="reader-share-brand-text"></span>
            </div>
            <div class="reader-share-card-quote"><span class="reader-share-card-quote-text"></span></div>
            <div class="reader-share-card-meta"></div>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-row">
            <span class="reader-share-label">배경</span>
            <div class="reader-share-thumbs"></div>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-row">
            <span class="reader-share-label">비율</span>
            <div class="reader-share-options">
              <button type="button" class="reader-share-chip" data-share-ratio="1:1">1:1 정방형</button>
              <button type="button" class="reader-share-chip" data-share-ratio="4:5">4:5 세로형</button>
              <button type="button" class="reader-share-chip" data-share-ratio="2:3">2:3 표지형</button>
            </div>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-row">
            <span class="reader-share-label">글꼴</span>
            <div class="reader-share-options reader-share-fonts"></div>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-row">
            <span class="reader-share-label">글자 굵기</span>
            <div class="reader-share-options reader-share-weights"></div>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-row">
            <span class="reader-share-label">글자 크기</span>
            <div class="reader-share-options reader-share-sizes"></div>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-row">
            <span class="reader-share-label">줄 바꿈</span>
            <div class="reader-share-wrap-control">
              <span class="reader-share-wrap-note">문장을 카드 폭에 맞춰 자동 줄바꿈</span>
              <button type="button" class="reader-share-switch" data-share-wrap aria-label="자동 줄 바꿈"></button>
            </div>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-row" style="align-items:start;">
            <span class="reader-share-label" style="padding-top:9px;">문구</span>
            <textarea class="reader-share-input" maxlength="4000" aria-label="문장 편집" placeholder="문장을 직접 입력하거나 수정해 보세요."></textarea>
          </div>
        </div>

        <div class="reader-share-section">
          <div class="reader-share-actions">
            <button type="button" class="reader-share-action secondary" data-share-quote>문장 저장</button>
            <button type="button" class="reader-share-action secondary" data-share-save>이미지 저장</button>
            <button type="button" class="reader-share-action secondary" data-share-clipboard>클립보드 복사</button>
            <button type="button" class="reader-share-action secondary" data-share-work-link>작품 링크 복사</button>
            <button type="button" class="reader-share-action primary" data-share-system>공유하기</button>
          </div>
          <div class="reader-share-saved-panel" data-share-saved-panel hidden>
            <div class="reader-share-saved-head"><span class="reader-share-saved-check">✓</span><span>문장을 저장했어요</span></div>
            <div class="reader-share-public-row">
              <div class="reader-share-public-copy">
                <strong>문장 피드에 공유</strong>
                <small>공개한 문장은 내 정보에서 언제든 다시 비공개로 바꿀 수 있어요.</small>
              </div>
              <button type="button" class="reader-share-public-toggle" data-share-public-toggle aria-pressed="false" aria-label="문장 피드에 공유"></button>
            </div>
          </div>
        </div>
      </div>
    </section>`;
  document.body.appendChild(backdrop);

  const sheet = backdrop.querySelector(".reader-share-sheet");
  const thumbs = backdrop.querySelector(".reader-share-thumbs");
  const input = backdrop.querySelector(".reader-share-input");
  const card = backdrop.querySelector(".reader-share-card");
  const renderImage = backdrop.querySelector(".reader-share-card-render");
  const renderLoading = backdrop.querySelector(".reader-share-render-loading");
  const quote = backdrop.querySelector(".reader-share-card-quote");
  const quoteText = backdrop.querySelector(".reader-share-card-quote-text");
  const meta = backdrop.querySelector(".reader-share-card-meta");
  const brand = backdrop.querySelector(".reader-share-brand-text");
  const fonts = backdrop.querySelector(".reader-share-fonts");
  const weights = backdrop.querySelector(".reader-share-weights");
  const sizes = backdrop.querySelector(".reader-share-sizes");
  const actions = backdrop.querySelector(".reader-share-actions");
  const wrap = backdrop.querySelector("[data-share-wrap]");
  const quoteSaveButton = backdrop.querySelector("[data-share-quote]");
  const saveButton = backdrop.querySelector("[data-share-save]");
  const clipboardButton = backdrop.querySelector("[data-share-clipboard]");
  const workLinkButton = backdrop.querySelector("[data-share-work-link]");
  const shareButton = backdrop.querySelector("[data-share-system]");
  const savedPanel = backdrop.querySelector("[data-share-saved-panel]");
  const publicToggle = backdrop.querySelector("[data-share-public-toggle]");
  let lastSavedQuote = null;

  renderReaderShareBackgroundThumbs(thumbs);

  fonts.innerHTML = READER_SHARE_FONTS.map((font) => `
    <button type="button" class="reader-share-chip" data-share-font="${font.key}">${font.label}</button>`).join("");

  weights.innerHTML = Object.entries(READER_SHARE_WEIGHTS).map(([key, value]) => `
    <button type="button" class="reader-share-chip" data-share-weight="${key}">${value.label}</button>`).join("");

  sizes.innerHTML = Object.entries(READER_SHARE_SIZES).map(([key, size]) => `
    <button type="button" class="reader-share-chip" data-share-size="${key}" aria-label="${size.label}" title="${size.label}">${size.button}</button>`).join("");

  const close = ({ fromHistory = false } = {}) => {
    backdrop.hidden = true;
    window.clearTimeout(readerSharePrepareTimer);
    window.clearTimeout(readerSharePreviewTimer);
    window.clearTimeout(readerShareAdminOutputTimer);
    readerSharePreviewGeneration += 1;
    revokeReaderSharePreviewUrl();
    readerSharePreviewKey = "";
    readerSharePreparedBlob = null;
    readerSharePreparedBlobKey = "";
    if (renderImage) {
      renderImage.hidden = true;
      renderImage.removeAttribute("src");
    }
    if (renderLoading) renderLoading.hidden = true;
    card?.classList.remove("is-render-loading");
    lastSavedQuote = null;
    state.readerShareText = "";
    state.readerShareSourceItem = null;
    state.readerShareLocation = null;
    if (savedPanel) savedPanel.hidden = true;
    if (publicToggle) {
      publicToggle.disabled = false;
      publicToggle.setAttribute("aria-pressed", "false");
    }
    resetReaderShareEditorOptions();
    if (!fromHistory && history.state?.rjsReaderShare) {
      history.replaceState(getHistoryStateWithoutReaderShare(), "", location.href);
    }
  };
  backdrop.querySelector(".reader-share-close")?.addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) close();
  });

  let suppressThumbClick = false;
  let thumbDragPointerId = null;
  let thumbDragStartX = 0;
  let thumbDragStartScrollLeft = 0;
  let thumbDragMoved = false;

  thumbs.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    thumbDragPointerId = event.pointerId;
    thumbDragStartX = event.clientX;
    thumbDragStartScrollLeft = thumbs.scrollLeft;
    thumbDragMoved = false;
  });

  thumbs.addEventListener("pointermove", (event) => {
    if (thumbDragPointerId !== event.pointerId) return;
    const deltaX = event.clientX - thumbDragStartX;
    if (Math.abs(deltaX) > 3 && !thumbDragMoved) {
      thumbDragMoved = true;
      // PC에서는 .is-dragging 상태가 썸네일 버튼의 pointer-events를 끈다.
      // pointerdown 즉시 적용하면 단순 클릭도 버튼을 잃으므로, 실제 드래그가
      // 시작된 뒤에만 드래그 상태와 pointer capture를 함께 활성화한다.
      thumbs.classList.add("is-dragging");
      thumbs.setPointerCapture?.(event.pointerId);
    }
    if (!thumbDragMoved) return;
    event.preventDefault();
    thumbs.scrollLeft = thumbDragStartScrollLeft - deltaX;
  });

  const finishThumbDrag = (event) => {
    if (thumbDragPointerId !== event.pointerId) return;
    suppressThumbClick = thumbDragMoved;
    thumbDragPointerId = null;
    thumbs.classList.remove("is-dragging");
    try { thumbs.releasePointerCapture?.(event.pointerId); } catch {}
    if (suppressThumbClick) {
      window.setTimeout(() => { suppressThumbClick = false; }, 0);
    }
  };
  thumbs.addEventListener("pointerup", finishThumbDrag);
  thumbs.addEventListener("pointercancel", finishThumbDrag);

  thumbs.addEventListener("click", (event) => {
    if (suppressThumbClick) {
      event.preventDefault();
      return;
    }
    const button = event.target.closest("[data-share-background]");
    if (!button) return;
    state.readerShareBackground = Math.max(0, Math.min(
      READER_SHARE_BACKGROUNDS.length - 1,
      Number(button.dataset.shareBackground || 0)
    ));
    updateReaderSharePreview();
  });

  backdrop.addEventListener("click", (event) => {
    const ratioButton = event.target.closest("[data-share-ratio]");
    if (ratioButton) {
      const ratio = ratioButton.dataset.shareRatio || "1:1";
      state.readerShareRatio = ["1:1", "4:5", "2:3"].includes(ratio) ? ratio : "1:1";
      updateReaderSharePreview();
      return;
    }
    const fontButton = event.target.closest("[data-share-font]");
    if (fontButton) {
      state.readerShareFont = fontButton.dataset.shareFont || "paperlogy";
      normalizeReaderShareWeightForFont();
      updateReaderSharePreview();
      const selectedFont = state.readerShareFont;
      void ensureReaderShareFont(selectedFont).then((ready) => {
        if (ready && state.readerShareFont === selectedFont) updateReaderSharePreview();
      });
      return;
    }
    const weightButton = event.target.closest("[data-share-weight]");
    if (weightButton) {
      if (weightButton.disabled) return;
      state.readerShareWeight = weightButton.dataset.shareWeight || "regular";
      normalizeReaderShareWeightForFont();
      updateReaderSharePreview();
      return;
    }
    const sizeButton = event.target.closest("[data-share-size]");
    if (sizeButton) {
      state.readerShareSize = sizeButton.dataset.shareSize || "xs";
      updateReaderSharePreview();
      return;
    }
    const wrapButton = event.target.closest("[data-share-wrap]");
    if (wrapButton) {
      state.readerShareAutoWrap = !state.readerShareAutoWrap;
      updateReaderSharePreview();
    }
  });

  const normalizePostypeReaderShareValue = (rawValue) => {
    const normalizedLineBreaks = String(rawValue || "")
      .replace(/\r\n?|\u0085|\u2028|\u2029/g, "\n")
      .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "");

    const hadTrailingLineBreak = normalizedLineBreaks.endsWith("\n");
    const lines = normalizedLineBreaks.split("\n");
    const kept = [];

    for (const line of lines) {
      const visible = line.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ").trim();
      if (!visible) continue;
      kept.push(line.replace(/[\u00A0\u3000]/g, " ").trim());
    }

    let result = kept.join("\n");
    // 사용자가 한 번 Enter를 친 직후에는 다음 줄 입력을 계속할 수 있도록
    // 마지막 줄바꿈 하나만 유지한다. 여러 번 Enter를 쳐도 빈 줄은 생기지 않는다.
    if (hadTrailingLineBreak && result) result += "\n";
    return result;
  };

  const normalizePostypeReaderShareInput = () => {
    if (getReaderShareSourceItem()?.source !== "postype") return;
    const raw = String(input.value || "");
    const selectionStart = Number.isInteger(input.selectionStart) ? input.selectionStart : raw.length;
    const prefix = raw.slice(0, selectionStart);
    const normalized = normalizePostypeReaderShareValue(raw);
    if (normalized === raw) return;

    const normalizedPrefix = normalizePostypeReaderShareValue(prefix);
    input.value = normalized;
    const nextCursor = Math.min(normalized.length, normalizedPrefix.length);
    try { input.setSelectionRange(nextCursor, nextCursor); } catch (_) {}
  };

  input.addEventListener("paste", () => {
    // 브라우저별 clipboardData/paste 이벤트 차이를 신뢰하지 않는다.
    // 실제 붙여넣기가 끝난 최종 textarea 값을 input 이벤트에서 정리한다.
    window.setTimeout(() => {
      normalizePostypeReaderShareInput();
      state.readerShareText = String(input.value || "");
      updateReaderSharePreview();
    }, 0);
  });

  input.addEventListener("input", (event) => {
    if (event.isComposing) return;
    normalizePostypeReaderShareInput();
    state.readerShareText = String(input.value || "");
    updateReaderSharePreview();
  });

  input.addEventListener("compositionend", () => {
    normalizePostypeReaderShareInput();
    state.readerShareText = String(input.value || "");
    updateReaderSharePreview();
  });

  quoteSaveButton?.addEventListener("click", async () => {
    if (!state.user) {
      closeReaderShareUi();
      openAuthModal("login", "문장을 저장하려면 로그인해 주세요.");
      return;
    }
    quoteSaveButton.disabled = true;
    const original = quoteSaveButton.textContent;
    quoteSaveButton.textContent = "저장 중…";
    try {
      // POSTYPE 직접 입력은 selection 상태가 아니라 현재 textarea 값을 최종 기준으로 사용한다.
      // paste/IME/모바일 입력 타이밍과 무관하게 저장 버튼을 누른 순간의 값을 확정한다.
      const sourceItem = getReaderShareSourceItem();
      if (sourceItem?.source === "postype") normalizePostypeReaderShareInput();
      const currentText = String(input?.value || "");
      state.readerShareText = currentText;
      const savedQuote = await saveCurrentReaderQuote({
        quoteText: currentText,
        sourceItem,
      });
      if (savedQuote) {
        lastSavedQuote = savedQuote;
        quoteSaveButton.textContent = savedQuote._alreadySaved ? "이미 저장됨" : "저장 완료";
        quoteSaveButton.classList.add("saved");
        if (savedPanel) {
          savedPanel.hidden = false;
          const savedHeadText = savedPanel.querySelector(".reader-share-saved-head span:last-child");
          if (savedHeadText) {
            savedHeadText.textContent = savedQuote._alreadySaved ? "이미 저장된 문장이에요" : "문장을 저장했어요";
          }
          const sheetScroll = backdrop.querySelector(".reader-share-sheet-scroll");
          window.requestAnimationFrame(() => {
            const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
            if (sheetScroll && savedPanel) {
              const scrollerRect = sheetScroll.getBoundingClientRect();
              const panelRect = savedPanel.getBoundingClientRect();
              const targetTop = sheetScroll.scrollTop + Math.max(0, panelRect.bottom - scrollerRect.bottom + 16);
              sheetScroll.scrollTo({ top: targetTop, behavior });
            } else {
              savedPanel?.scrollIntoView({ behavior, block: "nearest" });
            }
          });
        }
        if (publicToggle) {
          const isShared = savedQuote.shared === true;
          publicToggle.disabled = false;
          publicToggle.setAttribute("aria-pressed", isShared ? "true" : "false");
          const copy = savedPanel?.querySelector(".reader-share-public-copy small");
          if (copy) {
            copy.textContent = isShared
              ? "문장 피드에 공개됐어요. 내 정보에서 언제든 비공개로 바꿀 수 있어요."
              : "공개한 문장은 내 정보에서 언제든 다시 비공개로 바꿀 수 있어요.";
          }
        }
        window.setTimeout(() => {
          quoteSaveButton.textContent = original;
          quoteSaveButton.classList.remove("saved");
        }, 1200);
      } else {
        quoteSaveButton.textContent = original;
        if (!String(input?.value || "").trim()) {
          window.alert("저장할 문장을 입력해 주세요.");
          input?.focus();
        }
      }
    } catch (error) {
      console.error("quote save failed", error);
      window.alert("문장을 저장하지 못했습니다. 다시 시도해 주세요.");
      quoteSaveButton.textContent = original;
    } finally {
      quoteSaveButton.disabled = false;
    }
  });
  publicToggle?.addEventListener("click", async () => {
    if (!lastSavedQuote || publicToggle.disabled) return;
    const nextShared = publicToggle.getAttribute("aria-pressed") !== "true";
    publicToggle.disabled = true;
    try {
      await setSavedQuoteShared(lastSavedQuote, nextShared, getReaderShareSourceItem().id || "");
      publicToggle.setAttribute("aria-pressed", nextShared ? "true" : "false");
      const copy = savedPanel?.querySelector(".reader-share-public-copy small");
      if (copy) {
        copy.textContent = nextShared
          ? "문장 피드에 공개됐어요. 내 정보에서 언제든 비공개로 바꿀 수 있어요."
          : "공개한 문장은 내 정보에서 언제든 다시 비공개로 바꿀 수 있어요.";
      }
    } catch (error) {
      console.warn("문장 피드 공유 실패", error);
      window.alert("문장 피드 공유 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      publicToggle.disabled = false;
    }
  });
  saveButton?.addEventListener("click", async () => {
    await handleReaderShareExport("save");
  });
  clipboardButton?.addEventListener("click", () => {
    // Clipboard API는 모바일에서 transient user activation에 민감하므로
    // 일반 export async 흐름을 거치지 않고 실제 탭 핸들러에서 즉시 write()를 시작한다.
    try {
      const writePromise = copyReaderShareImageToClipboard();
      clipboardButton.textContent = "복사 중...";
      writePromise.then(() => {
        clipboardButton.textContent = "복사 완료";
        window.setTimeout(updateReaderShareActionLabel, 1200);
      }).catch((error) => {
        console.error("reader share clipboard failed", error);
        const message = String(error?.message || "");
        if (message.includes("clipboard_image_preparing")) {
          window.alert("클립보드용 이미지를 준비 중입니다. 잠시 후 다시 눌러 주세요.");
        } else if (message.includes("clipboard_image_unsupported")) {
          window.alert("이 브라우저에서는 이미지 클립보드 복사를 지원하지 않습니다.");
        } else {
          const reason = String(error?.name || "").trim();
          window.alert(`이미지 클립보드 복사에 실패했습니다${reason ? ` (${reason})` : ""}. 다시 시도해 주세요.`);
        }
        updateReaderShareActionLabel();
      });
    } catch (error) {
      console.error("reader share clipboard failed", error);
      const message = String(error?.message || "");
      if (message.includes("clipboard_image_preparing")) {
        window.alert("클립보드용 이미지를 준비 중입니다. 잠시 후 다시 눌러 주세요.");
      } else if (message.includes("clipboard_image_unsupported")) {
        window.alert("이 브라우저에서는 이미지 클립보드 복사를 지원하지 않습니다.");
      } else {
        const reason = String(error?.name || "").trim();
        window.alert(`이미지 클립보드 복사에 실패했습니다${reason ? ` (${reason})` : ""}. 다시 시도해 주세요.`);
      }
      updateReaderShareActionLabel();
    }
  });
  workLinkButton?.addEventListener("click", async () => {
    await copyWorkShareLink(getReaderShareSourceItem(), workLinkButton);
  });
  shareButton?.addEventListener("click", async () => {
    await handleReaderShareExport("share");
  });

  floatButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  floatButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const selected = getReaderTextSelection({ includeLocation: true });
    if (selected?.text) state.readerShareText = selected.text;
    state.readerShareLocation = selected?.location || null;
    openReaderShareSheet();
  });


  memoButton.addEventListener("click", () => {
    if (!state.user) { openAuthModal("login", "메모를 저장하려면 로그인해 주세요."); return; }
    const selected=getReaderTextSelection({ includeLocation: true });
    const text=selected?.text || state.readerShareText; const location=selected?.location || state.readerShareLocation;
    if(!text || !location) return;
    selectionActions.hidden=true;
    const bd=document.createElement("div"); bd.className="reader-memo-backdrop";
    bd.innerHTML=`<section class="reader-memo-dialog" role="dialog" aria-modal="true"><h3>메모 남기기</h3><p class="reader-memo-quote">${escapeHtml(text)}</p><textarea class="reader-memo-input" maxlength="4000" placeholder="이 문장에 남길 메모를 입력하세요."></textarea><div class="reader-memo-actions"><button type="button" data-memo-cancel>취소</button><button type="button" class="primary" data-memo-save>저장</button></div></section>`;
    document.body.appendChild(bd); const input=bd.querySelector("textarea"); setTimeout(()=>input?.focus(),0);
    const closeMemo=()=>bd.remove(); bd.querySelector("[data-memo-cancel]")?.addEventListener("click",closeMemo); bd.addEventListener("pointerdown",e=>{if(e.target===bd)closeMemo();});
    bd.querySelector("[data-memo-save]")?.addEventListener("click",async()=>{ const noteText=String(input?.value||"").trim(); if(!noteText)return input?.focus(); const item=state.activeReaderItem; const btn=bd.querySelector("[data-memo-save]"); btn.disabled=true; try{ const data=await userApi("/api/user/profile",{method:"POST",body:JSON.stringify({action:"note_save",workId:item.id,title:item.title,author:item.author,noteText,quoteText:text,startOffset:location.startOffset,endOffset:location.endOffset})}); state.readerNotes.unshift(normalizeReaderNote(data.note)); closeMemo(); }catch(error){alert(error.message||"메모를 저장하지 못했습니다."); btn.disabled=false;} });
  });

readerShareUi = { style, floatButton, memoButton, selectionActions, backdrop, sheet, thumbs, input, card, renderImage, renderLoading, quote, quoteText, meta, brand, fonts, weights, sizes, actions, wrap, quoteSaveButton, saveButton, clipboardButton, workLinkButton, shareButton, savedPanel, publicToggle, close };
  return readerShareUi;
}

function parseShareGradientColors(backgroundValue) {
  const matches = String(backgroundValue || "").match(/#(?:[0-9a-fA-F]{3}){1,2}/g) || [];
  return {
    start: matches[0] || "#f6f3ee",
    end: matches[1] || matches[0] || "#fffdf9",
  };
}

function quoteTestRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 부드럽게 일그러진 원 (수채 번짐용). 경로만 만들고 fill/stroke는 호출 측에서 한다.
function quoteTestBlobPath(ctx, cx, cy, radius, rand, points) {
  const n = points || 14;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const k = 0.8 + rand() * 0.4;
    pts.push([
      cx + Math.cos(angle) * radius * k,
      cy + Math.sin(angle) * radius * k * (0.9 + rand() * 0.2),
    ]);
  }
  ctx.beginPath();
  const last = pts[n - 1];
  ctx.moveTo((last[0] + pts[0][0]) / 2, (last[1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  }
  ctx.closePath();
}

function quoteTestFourPointStar(ctx, cx, cy, s, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.quadraticCurveTo(cx, cy, cx + s, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + s);
  ctx.quadraticCurveTo(cx, cy, cx - s, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - s);
  ctx.fill();
}

function quoteTestIsProtectedArea(x, y, w, h, pad = 0) {
  return x >= w * 0.07 - pad && x <= w * 0.93 + pad && y >= h * 0.13 - pad && y <= h * 0.85 + pad;
}

function quoteTestProtectedAlpha(x, y, w, h, alpha, innerScale = 0.5) {
  return quoteTestIsProtectedArea(x, y, w, h) ? alpha * innerScale : alpha;
}

function quoteTestRoundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ---------- 1. 금박한지 ---------- */
// 한지 섬유 질감 + 모서리에 흩뿌린 금박 조각 + 가는 이중 금테
function drawQuoteHanjiGilt(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(9701);

  // 종이 얼룩(빛 번짐)
  [[0.2, 0.25, 0.5], [0.78, 0.62, 0.55], [0.45, 0.92, 0.45], [0.9, 0.1, 0.35]].forEach(([x, y, k]) => {
    const g = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, w * k);
    g.addColorStop(0, "rgba(190,150,86,.09)");
    g.addColorStop(1, "rgba(190,150,86,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // 한지 섬유: 어두운 실 + 밝은 실
  ctx.lineCap = "round";
  for (let i = 0; i < 380; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = (14 + r() * 58) * u;
    const a = r() * Math.PI;
    const bend = (r() - 0.5) * 18 * u;
    const light = r() < 0.38;
    ctx.strokeStyle = light
      ? "rgba(255,255,255," + (0.22 + r() * 0.3).toFixed(3) + ")"
      : "rgba(132,98,52," + (0.035 + r() * 0.07).toFixed(3) + ")";
    ctx.lineWidth = (light ? 1.4 : 0.8 + r() * 0.9) * u;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + (Math.cos(a) * len) / 2 + bend,
      y + (Math.sin(a) * len) / 2 - bend,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len
    );
    ctx.stroke();
  }

  // 금박 조각: 오른쪽 위 / 왼쪽 아래 모서리에만 모아서 본문 가독성을 지킨다
  const tones = ["rgba(226,190,106,.80)", "rgba(204,162,76,.72)", "rgba(240,214,142,.76)", "rgba(184,141,58,.64)"];
  const flake = (cx, cy, s, tone) => {
    const n = 5 + Math.floor(r() * 3);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.5;
      const rr = s * (0.55 + r() * 0.6);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.8;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,244,205,.55)";
    ctx.lineWidth = Math.max(1, 0.9 * u);
    ctx.stroke();
  };
  const cluster = (ax, ay, dx, dy, spreadX, spreadY, count) => {
    for (let i = 0; i < count; i++) {
      const d = Math.pow(r(), 1.8);
      const cx = w * (ax + dx * d * spreadX * (0.4 + r() * 0.8));
      const cy = h * (ay + dy * d * spreadY * (0.4 + r() * 0.8));
      const s = (5 + (1 - d) * 20 * r()) * u;
      flake(cx, cy, s, tones[Math.floor(r() * tones.length)]);
    }
  };
  cluster(0.955, 0.045, -1, 1, 0.34, 0.2, 34);
  cluster(0.045, 0.955, 1, -1, 0.2, 0.15, 20);

  // 이중 금테
  const m1 = w * 0.032;
  const m2 = w * 0.043;
  ctx.strokeStyle = "rgba(170,128,56,.58)";
  ctx.lineWidth = 1.8 * u;
  ctx.strokeRect(m1, m1, w - m1 * 2, h - m1 * 2);
  ctx.strokeStyle = "rgba(170,128,56,.26)";
  ctx.lineWidth = 1 * u;
  ctx.strokeRect(m2, m2, w - m2 * 2, h - m2 * 2);
}

/* ---------- 2. 심야서점 ---------- */
// 늦은 밤 스탠드 불빛, 대각선 빛줄기, 보케, 먼지 알갱이
function drawQuoteMidnightBookshop(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(4421);

  let g = ctx.createRadialGradient(w * 0.84, h * 0.12, 0, w * 0.84, h * 0.12, w * 0.85);
  g.addColorStop(0, "rgba(255,190,104,.42)");
  g.addColorStop(0.28, "rgba(255,158,72,.16)");
  g.addColorStop(1, "rgba(255,158,72,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  g = ctx.createRadialGradient(w * 0.1, h * 0.95, 0, w * 0.1, h * 0.95, w * 0.6);
  g.addColorStop(0, "rgba(86,128,214,.20)");
  g.addColorStop(1, "rgba(86,128,214,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 빛줄기: 폭이 다른 반투명 폴리곤을 겹쳐 가장자리를 부드럽게 만든다 (ctx.filter/blur 미사용 → Safari 안전)
  {
    const x0 = w * 0.88, y0 = h * 0.13, x1 = w * 0.08, y1 = h * 0.95;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const nx = dy / len, ny = -dx / len; // 진행 방향에 수직인 단위벡터
    const beam = ctx.createLinearGradient(x0, y0, x1, y1);
    beam.addColorStop(0, "rgba(255,214,150,.05)");
    beam.addColorStop(1, "rgba(255,214,150,0)");
    for (let i = 0; i < 6; i++) {
      const k = 1 - i * 0.16;
      const top = w * 0.085 * k;
      const bottom = w * 0.14 * k;
      ctx.beginPath();
      ctx.moveTo(x0 + nx * top, y0 + ny * top);
      ctx.lineTo(x0 - nx * top, y0 - ny * top);
      ctx.lineTo(x1 - nx * bottom, y1 - ny * bottom);
      ctx.lineTo(x1 + nx * bottom, y1 + ny * bottom);
      ctx.closePath();
      ctx.fillStyle = beam;
      ctx.fill();
    }
  }

  // 보케 + 먼지: 빛이 더해지는 합성
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 24; i++) {
    const x = w * (0.35 + r() * 0.65);
    const y = h * (r() * 0.55);
    const rad = (12 + r() * r() * 70) * u;
    ctx.fillStyle = "rgba(255,214,150," + (0.04 + r() * 0.06).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,226,172," + (0.06 + r() * 0.07).toFixed(3) + ")";
    ctx.lineWidth = 1.6 * u;
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const rad = (0.8 + r() * 1.8) * u;
    ctx.fillStyle = "rgba(255,230,190," + (0.15 + r() * 0.4).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // 비네트
  g = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, "rgba(2,5,14,0)");
  g.addColorStop(1, "rgba(2,5,14,.42)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/* ---------- 3. 수채번짐 ---------- */
// 흰 종이 위에 번진 물감. multiply 합성 + 가장자리에 고인 안료
function drawQuoteWatercolorBleed(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(7313);

  // 종이 결
  for (let i = 0; i < 520; i++) {
    ctx.fillStyle = "rgba(120,100,70," + (0.025 + r() * 0.035).toFixed(3) + ")";
    ctx.fillRect(r() * w, r() * h, (1 + r() * 1.6) * u, (1 + r() * 1.6) * u);
  }

  ctx.globalCompositeOperation = "multiply";
  const wash = (cx, cy, rad, rgb, alpha) => {
    // 큰 번짐 → 안쪽 겹 → 가장자리 안료
    quoteTestBlobPath(ctx, w * cx, h * cy, w * rad, r, 14);
    ctx.fillStyle = "rgba(" + rgb + "," + alpha + ")";
    ctx.fill();
    ctx.strokeStyle = "rgba(" + rgb + "," + (alpha * 1.15).toFixed(3) + ")";
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    quoteTestBlobPath(ctx, w * (cx + rad * 0.06), h * (cy + rad * 0.05), w * rad * 0.7, r, 12);
    ctx.fillStyle = "rgba(" + rgb + "," + (alpha * 0.6).toFixed(3) + ")";
    ctx.fill();
  };
  wash(0.06, 0.04, 0.3, "72,160,160", 0.2);
  wash(0.32, -0.01, 0.2, "238,126,112", 0.19);
  wash(0.18, 0.15, 0.13, "232,184,84", 0.16);
  wash(0.97, 0.98, 0.34, "232,184,84", 0.2);
  wash(0.78, 1.03, 0.2, "238,126,112", 0.18);
  wash(1.02, 0.84, 0.14, "72,160,160", 0.15);

  // 튄 물방울
  const drops = [[0.24, 0.2, 0.008, "238,126,112"], [0.3, 0.25, 0.005, "72,160,160"], [0.7, 0.86, 0.007, "232,184,84"], [0.64, 0.9, 0.004, "238,126,112"], [0.9, 0.72, 0.006, "72,160,160"]];
  drops.forEach(([x, y, rr, rgb]) => {
    ctx.fillStyle = "rgba(" + rgb + ",.30)";
    ctx.beginPath();
    ctx.arc(w * x, h * y, w * rr, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalCompositeOperation = "source-over";
}

/* ---------- 4. 달빛능선 ---------- */
// 초승달 + 별가루 + 안개 낀 능선 3겹
function drawQuoteMoonRidge(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(1187);

  // 달무리
  let g = ctx.createRadialGradient(w * 0.76, h * 0.2, 0, w * 0.76, h * 0.2, w * 0.5);
  g.addColorStop(0, "rgba(255,244,214,.26)");
  g.addColorStop(0.35, "rgba(255,244,214,.08)");
  g.addColorStop(1, "rgba(255,244,214,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 별가루(위쪽 45%에만)
  for (let i = 0; i < 80; i++) {
    const rad = (0.6 + r() * r() * 2.2) * u;
    ctx.fillStyle = "rgba(235,240,255," + (0.2 + r() * 0.6).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(r() * w, r() * h * 0.45, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  [[0.14, 0.2, 9], [0.4, 0.09, 7], [0.58, 0.31, 6], [0.9, 0.38, 8]].forEach(([x, y, s]) => {
    quoteTestFourPointStar(ctx, w * x, h * y, s * u, "rgba(255,248,226,.78)");
  });

  // 초승달: 큰 원을 clip 하고, 작은 원을 뺀 영역만 칠한다(배경을 지우지 않음)
  const mx = w * 0.76;
  const my = h * 0.2;
  const mr = w * 0.115;
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.clip();
  const mg = ctx.createLinearGradient(mx - mr, my - mr, mx + mr, my + mr);
  mg.addColorStop(0, "#fff7dc");
  mg.addColorStop(1, "#f0dfb4");
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.rect(mx - mr * 2, my - mr * 2, mr * 4, mr * 4);
  ctx.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.9, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.restore();

  // 능선 3겹
  const ridge = (base, amp, freq, phase, top, bottom) => {
    const fill = ctx.createLinearGradient(0, h * (base - 0.08), 0, h);
    fill.addColorStop(0, top);
    fill.addColorStop(1, bottom);
    ctx.beginPath();
    ctx.moveTo(0, h);
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y =
        h * base -
        h * amp *
          (Math.sin(t * freq * 6.2832 + phase) * 0.55 +
            Math.sin(t * freq * 2.3 * 6.2832 + phase * 1.7) * 0.3 +
            Math.sin(t * freq * 5.1 * 6.2832 + phase * 0.6) * 0.15);
      ctx.lineTo(w * t, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ridge(0.86, 0.05, 0.9, 0.6, "rgba(52,76,150,.50)", "rgba(24,40,96,.70)");
  // 능선 사이 안개
  g = ctx.createLinearGradient(0, h * 0.82, 0, h * 0.96);
  g.addColorStop(0, "rgba(170,188,235,0)");
  g.addColorStop(0.5, "rgba(170,188,235,.12)");
  g.addColorStop(1, "rgba(170,188,235,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.82, w, h * 0.14);
  ridge(0.9, 0.04, 1.2, 2.1, "rgba(26,44,108,.62)", "rgba(14,24,66,.86)");
  ridge(0.945, 0.028, 1.6, 4.0, "rgba(12,20,56,.82)", "rgba(6,10,30,.95)");
}

/* ---------- 5. 프리즘 ---------- */
// 대각선 스펙트럼 띠 + 하이라이트 + 유리 조각 + 굴절 광선
function drawQuotePrismFoil(ctx, w, h) {
  const u = w / 1200;

  // 스펙트럼 띠
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-Math.PI / 6.2);
  const L = Math.hypot(w, h);
  let g = ctx.createLinearGradient(-L * 0.5, 0, L * 0.5, 0);
  g.addColorStop(0.3, "rgba(255,170,200,0)");
  g.addColorStop(0.38, "rgba(255,170,200,.22)");
  g.addColorStop(0.45, "rgba(255,214,160,.22)");
  g.addColorStop(0.51, "rgba(255,247,170,.18)");
  g.addColorStop(0.57, "rgba(176,236,196,.22)");
  g.addColorStop(0.63, "rgba(150,214,244,.24)");
  g.addColorStop(0.7, "rgba(184,170,250,.24)");
  g.addColorStop(0.78, "rgba(184,170,250,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-L, -L, L * 2, L * 2);

  // 하이라이트
  g = ctx.createLinearGradient(-L * 0.5, 0, L * 0.5, 0);
  g.addColorStop(0.435, "rgba(255,255,255,0)");
  g.addColorStop(0.47, "rgba(255,255,255,.55)");
  g.addColorStop(0.505, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-L, -L, L * 2, L * 2);
  ctx.restore();

  // 오른쪽 위 프리즘 삼각형
  const ax = w * 0.86, ay = h * 0.045;
  const bx = w * 0.76, by = h * 0.19;
  const cx = w * 0.96, cy = h * 0.19;
  const tg = ctx.createLinearGradient(bx, by, cx, ay);
  tg.addColorStop(0, "rgba(255,170,200,.16)");
  tg.addColorStop(0.5, "rgba(150,214,244,.16)");
  tg.addColorStop(1, "rgba(184,170,250,.16)");
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.strokeStyle = "rgba(110,120,200,.30)";
  ctx.lineWidth = 1.5 * u;
  ctx.stroke();

  // 굴절 광선: 삼각형 오른쪽 변에서 부채꼴로
  const rays = [["rgba(255,150,190,.42)", 0.0], ["rgba(255,205,140,.42)", 0.018], ["rgba(150,225,190,.42)", 0.036], ["rgba(140,205,245,.42)", 0.054], ["rgba(176,160,248,.42)", 0.072]];
  ctx.lineCap = "round";
  rays.forEach(([color, spread], i) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.moveTo(w * 0.91, h * 0.12);
    ctx.lineTo(w * (1.02), h * (0.27 + spread * 1.2 + i * 0.004));
    ctx.stroke();
  });

  // 유리 조각 facet
  const facets = [
    [[0.04, 0.9], [0.14, 0.82], [0.1, 0.97]],
    [[0.14, 0.82], [0.24, 0.93], [0.1, 0.97]],
    [[0.9, 0.84], [0.97, 0.76], [0.97, 0.93]],
  ];
  facets.forEach((tri) => {
    ctx.beginPath();
    tri.forEach(([x, y], i) => {
      if (i) ctx.lineTo(w * x, h * y);
      else ctx.moveTo(w * x, h * y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();
  });

  // 반짝임
  quoteTestFourPointStar(ctx, w * 0.2, h * 0.17, 13 * u, "rgba(255,255,255,.95)");
  quoteTestFourPointStar(ctx, w * 0.12, h * 0.3, 7 * u, "rgba(184,170,250,.8)");
  quoteTestFourPointStar(ctx, w * 0.82, h * 0.64, 9 * u, "rgba(150,214,244,.85)");
  quoteTestFourPointStar(ctx, w * 0.9, h * 0.52, 6 * u, "rgba(255,255,255,.9)");
}

function drawQuoteFrostWindow(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(5521);

  // 모서리 김서림
  [[0, 1, 0.55, 0.6], [1, 0, 0.42, 0.5]].forEach(([x, y, k, a]) => {
    const g = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, w * k);
    g.addColorStop(0, "rgba(255,255,255," + a + ")");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // 맺힌 물방울
  for (let i = 0; i < 38; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = (5 + r() * r() * 24) * u;
    ctx.fillStyle = "rgba(255,255,255,.13)";
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.62, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
  }

  // 서리 결정: 재귀 가지
  ctx.lineCap = "round";
  const branch = (x, y, a, len, depth, lw) => {
    if (depth <= 0 || len < 4 * u) return;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = lw * 3.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.80)";
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    branch(x2, y2, a + (r() - 0.5) * 0.25, len * 0.72, depth - 1, lw * 0.82);
    const mx = x + Math.cos(a) * len * 0.5;
    const my = y + Math.sin(a) * len * 0.5;
    branch(mx, my, a + 0.75, len * 0.5, depth - 1, lw * 0.75);
    branch(mx, my, a - 0.75, len * 0.5, depth - 1, lw * 0.75);
  };
  [-1.32, -1.02, -0.72, -0.42, -0.14].forEach((a) => {
    branch(0, h, a, w * (0.15 + r() * 0.08), 4, 2.4 * u);
  });
  [1.72, 2.05, 2.4, 2.8].forEach((a) => {
    branch(w, 0, a, w * (0.12 + r() * 0.07), 4, 2.2 * u);
  });

  quoteTestFourPointStar(ctx, w * 0.84, h * 0.58, 8 * u, "rgba(255,255,255,.9)");
  quoteTestFourPointStar(ctx, w * 0.16, h * 0.33, 6 * u, "rgba(255,255,255,.85)");
}

/* ---------- 2. 해변물결 ---------- */
// 석양빛 하늘, 낮게 뜬 해, 거품선이 겹친 파도, 갈매기
function drawQuoteTideLines(ctx, w, h) {
  const u = w / 1200;

  let g = ctx.createRadialGradient(w * 0.5, h * 0.64, 0, w * 0.5, h * 0.64, w * 0.5);
  g.addColorStop(0, "rgba(255,214,170,.55)");
  g.addColorStop(0.45, "rgba(255,214,170,.16)");
  g.addColorStop(1, "rgba(255,214,170,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const wave = (base, amp, freq, phase) => {
    ctx.beginPath();
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const x = (w * i) / steps;
      const y = h * base + h * amp * Math.sin((x / w) * freq * 6.2832 + phase);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  };
  for (let k = 0; k < 9; k++) {
    const base = 0.66 + k * 0.03;
    wave(base, 0.006 + k * 0.0016, 1.6 + k * 0.15, k * 1.3);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(60,140,160,.055)";
    ctx.fill();
    wave(base, 0.006 + k * 0.0016, 1.6 + k * 0.15, k * 1.3);
    ctx.strokeStyle = "rgba(255,255,255," + Math.max(0.2, 0.66 - k * 0.05).toFixed(2) + ")";
    ctx.lineWidth = (1.6 + k * 0.25) * u;
    ctx.stroke();
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  [[0.72, 0.17, 26], [0.82, 0.12, 18], [0.64, 0.1, 14]].forEach(([x, y, s]) => {
    const sx = s * u * 1.6;
    ctx.strokeStyle = "rgba(80,70,90,.42)";
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.moveTo(w * x - sx, h * y);
    ctx.quadraticCurveTo(w * x - sx / 2, h * y - sx * 0.55, w * x, h * y);
    ctx.quadraticCurveTo(w * x + sx / 2, h * y - sx * 0.55, w * x + sx, h * y);
    ctx.stroke();
  });
}

/* ---------- 3. 새벽숲 ---------- */
// 안개 낀 침엽수 3겹, 틈새로 들어오는 빛살, 반딧불
function drawQuoteForestHaze(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(3307);

  let g = ctx.createRadialGradient(w * 0.28, h * 0.08, 0, w * 0.28, h * 0.08, w * 0.6);
  g.addColorStop(0, "rgba(214,255,206,.28)");
  g.addColorStop(1, "rgba(214,255,206,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 빛살
  const tipX = w * 0.28;
  const tipY = -h * 0.04;
  for (let i = 0; i < 4; i++) {
    const ex = w * (0.08 + i * 0.22);
    const grad = ctx.createLinearGradient(tipX, tipY, ex, h * 0.9);
    grad.addColorStop(0, "rgba(220,255,214,.11)");
    grad.addColorStop(1, "rgba(220,255,214,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tipX - 6 * u, tipY);
    ctx.lineTo(tipX + 6 * u, tipY);
    ctx.lineTo(ex + w * 0.045, h * 0.9);
    ctx.lineTo(ex - w * 0.045, h * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  const pine = (x, baseY, ph, pw, color) => {
    ctx.fillStyle = color;
    for (let t = 0; t < 3; t++) {
      const apexY = baseY - ph + t * ph * 0.28;
      const botY = apexY + ph * 0.46;
      const half = pw * (0.42 + t * 0.22);
      ctx.beginPath();
      ctx.moveTo(x, apexY);
      ctx.lineTo(x + half, botY);
      ctx.lineTo(x - half, botY);
      ctx.closePath();
      ctx.fill();
    }
  };
  const row = (baseRatio, minH, maxH, step, color) => {
    for (let x = -step; x < w + step; x += step * (0.7 + r() * 0.6)) {
      const ph = (minH + r() * (maxH - minH)) * u;
      pine(x, h * baseRatio, ph, ph * 0.5, color);
    }
    ctx.fillRect(0, h * baseRatio, w, h);
  };
  row(0.9, 110, 170, 46 * u, "rgba(34,72,62,.72)");
  g = ctx.createLinearGradient(0, h * 0.8, 0, h * 0.95);
  g.addColorStop(0, "rgba(190,230,210,0)");
  g.addColorStop(0.55, "rgba(190,230,210,.12)");
  g.addColorStop(1, "rgba(190,230,210,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.8, w, h * 0.15);
  ctx.fillStyle = "rgba(22,52,46,.82)";
  row(0.96, 140, 210, 56 * u, "rgba(22,52,46,.82)");
  row(1.02, 170, 260, 70 * u, "rgba(8,22,20,.96)");

  // 반딧불
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 26; i++) {
    // 본문 가독성: 70%는 좌우 가장자리, 나머지는 아래쪽 숲 근처에만 둔다
    const edge = r() < 0.7;
    const x = edge ? (r() < 0.5 ? w * r() * 0.2 : w * (0.8 + r() * 0.2)) : w * (0.2 + r() * 0.6);
    const y = edge ? h * (0.35 + r() * 0.5) : h * (0.7 + r() * 0.18);
    const rad = (2 + r() * 2.6) * u;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, rad * 7);
    glow.addColorStop(0, "rgba(226,255,150,.5)");
    glow.addColorStop(1, "rgba(226,255,150,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, rad * 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(246,255,200,.9)";
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

/* ---------- 4. 필름누광 ---------- */
// 오래된 필름 가장자리로 새어 든 주황·마젠타 빛, 필름 입자, 스프로킷 구멍
function drawQuoteFilmLeak(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(8801);

  ctx.globalCompositeOperation = "screen";
  let g = ctx.createLinearGradient(0, 0, w * 0.36, 0);
  g.addColorStop(0, "rgba(255,96,40,.62)");
  g.addColorStop(0.35, "rgba(255,150,50,.26)");
  g.addColorStop(1, "rgba(255,150,50,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  g = ctx.createRadialGradient(w * 0.02, h * 0.3, 0, w * 0.02, h * 0.3, w * 0.5);
  g.addColorStop(0, "rgba(255,50,120,.42)");
  g.addColorStop(1, "rgba(255,50,120,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  g = ctx.createRadialGradient(w * 0.98, 0, 0, w * 0.98, 0, w * 0.4);
  g.addColorStop(0, "rgba(255,170,60,.38)");
  g.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  g = ctx.createRadialGradient(w * 0.9, h * 1.0, 0, w * 0.9, h * 1.0, w * 0.35);
  g.addColorStop(0, "rgba(255,90,60,.22)");
  g.addColorStop(1, "rgba(255,90,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  // 필름 입자
  for (let i = 0; i < 900; i++) {
    const light = r() < 0.55;
    ctx.fillStyle = light
      ? "rgba(255,240,225," + (0.04 + r() * 0.08).toFixed(3) + ")"
      : "rgba(0,0,0," + (0.08 + r() * 0.12).toFixed(3) + ")";
    const s = (1 + r() * 1.8) * u;
    ctx.fillRect(r() * w, r() * h, s, s);
  }

  // 스프로킷 구멍(위·아래)
  const holeW = 22 * u;
  const holeH = 14 * u;
  const step = 46 * u;
  ctx.fillStyle = "rgba(255,240,225,.08)";
  for (let x = step * 0.5; x < w; x += step) {
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x, 20 * u, holeW, holeH, 3 * u)
      : ctx.rect(x, 20 * u, holeW, holeH);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x, h - 20 * u - holeH, holeW, holeH, 3 * u)
      : ctx.rect(x, h - 20 * u - holeH, holeW, holeH);
    ctx.fill();
  }

  // 가는 필름 가장자리선
  ctx.strokeStyle = "rgba(255,240,225,.10)";
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.moveTo(0, 54 * u);
  ctx.lineTo(w, 54 * u);
  ctx.moveTo(0, h - 54 * u);
  ctx.lineTo(w, h - 54 * u);
  ctx.stroke();
}

/* ---------- 5. 별자리지도 ---------- */
// 성도(星圖): 동심원 궤도, 눈금, 금빛 별자리 선, 별가루
function drawQuoteStarChart(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(2603);

  // 별가루
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = "rgba(220,244,244," + (0.12 + r() * 0.4).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, (0.6 + r() * r() * 1.8) * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // 동심원 + 눈금
  const cx = w * 0.2;
  const cy = h * 0.8;
  ctx.strokeStyle = "rgba(170,225,230,.13)";
  ctx.lineWidth = 1.4 * u;
  [0.14, 0.26, 0.4, 0.56].forEach((k) => {
    ctx.beginPath();
    ctx.arc(cx, cy, w * k, 0, Math.PI * 2);
    ctx.stroke();
  });
  const outer = w * 0.56;
  ctx.strokeStyle = "rgba(170,225,230,.2)";
  for (let d = 0; d < 360; d += 6) {
    const a = (d * Math.PI) / 180;
    const len = (d % 30 === 0 ? 20 : 10) * u;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.lineTo(cx + Math.cos(a) * (outer - len), cy + Math.sin(a) * (outer - len));
    ctx.stroke();
  }

  // 자오선(점선)
  ctx.save();
  ctx.setLineDash([4 * u, 12 * u]);
  ctx.strokeStyle = "rgba(170,225,230,.18)";
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.18);
  ctx.stroke();
  ctx.restore();

  // 별자리
  const constellations = [
    [[0.62, 0.14], [0.72, 0.2], [0.8, 0.13], [0.87, 0.24], [0.78, 0.33]],
    [[0.66, 0.7], [0.76, 0.64], [0.86, 0.72], [0.82, 0.84]],
  ];
  constellations.forEach((pts) => {
    ctx.strokeStyle = "rgba(255,226,160,.4)";
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      if (i) ctx.lineTo(w * x, h * y);
      else ctx.moveTo(w * x, h * y);
    });
    ctx.stroke();
    pts.forEach(([x, y], i) => {
      const px = w * x;
      const py = h * y;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 22 * u);
      glow.addColorStop(0, "rgba(255,226,160,.38)");
      glow.addColorStop(1, "rgba(255,226,160,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, 22 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,226,160,.26)";
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      ctx.arc(px, py, 10 * u, 0, Math.PI * 2);
      ctx.stroke();
      if (i % 2 === 0) quoteTestFourPointStar(ctx, px, py, 9 * u, "rgba(255,244,214,.95)");
      else {
        ctx.fillStyle = "rgba(255,244,214,.95)";
        ctx.beginPath();
        ctx.arc(px, py, 3.4 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
}


/* ---------- 6. 폴카 ---------- */
function drawQuoteSoftPolka(ctx, w, h) {
  const u = w / 1200;
  const spacing = 56 * u;
  const offset = spacing * 0.5;
  for (let row = -1, y = spacing * 0.5; y < h + spacing; row += 1, y += spacing) {
    for (let x = -spacing; x < w + spacing; x += spacing) {
      const px = x + (row % 2 ? offset : 0);
      const radius = (14 + ((row + Math.floor(px / spacing)) % 3) * 3) * u;
      const alpha = quoteTestProtectedAlpha(px, y, w, h, 0.22, 0.5);
      const g = ctx.createRadialGradient(px, y, 0, px, y, radius);
      g.addColorStop(0, `rgba(150,205,235,${alpha.toFixed(3)})`);
      g.addColorStop(1, "rgba(150,205,235,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - radius, y - radius, radius * 2, radius * 2);
    }
  }
}

/* ---------- 7. 레이스 ---------- */
function drawQuoteLaceGrid(ctx, w, h) {
  const u = w / 1200;
  const grid = 40 * u;
  ctx.strokeStyle = "rgba(240,150,170,.20)";
  ctx.lineWidth = 1 * u;
  for (let x = 0; x <= w; x += grid) {
    ctx.globalAlpha = quoteTestIsProtectedArea(x, h * 0.5, w, h) ? 0.55 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += grid) {
    ctx.globalAlpha = y >= h * 0.13 && y <= h * 0.85 ? 0.55 : 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const scallopR = 30 * u;
  const scallopStep = 56 * u;
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.strokeStyle = "rgba(236,130,155,.70)";
  ctx.lineWidth = 2 * u;
  for (let x = -scallopR; x < w + scallopR; x += scallopStep) {
    ctx.beginPath();
    ctx.arc(x + scallopR, 18 * u, scallopR, Math.PI, 0);
    ctx.lineTo(x + scallopStep, 0);
    ctx.lineTo(x, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let dotX = x + 10 * u; dotX < x + scallopStep - 8 * u; dotX += 14 * u) {
      ctx.fillStyle = "rgba(236,130,155,.65)";
      ctx.beginPath();
      ctx.arc(dotX, 19 * u, 2.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.95)";
  }

  const drawHeart = (cx, cy, size, stroke, fill) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size, size);
    ctx.beginPath();
    ctx.moveTo(0, 0.35);
    ctx.bezierCurveTo(0.62, -0.2, 1.05, -0.72, 0.45, -1.1);
    ctx.bezierCurveTo(0.05, -1.36, -0.18, -1.05, 0, -0.74);
    ctx.bezierCurveTo(-0.18, -1.05, -0.4, -1.36, -0.82, -1.1);
    ctx.bezierCurveTo(-1.42, -0.72, -0.98, -0.2, 0, 0.35);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.11;
      ctx.stroke();
    }
    ctx.restore();
  };
  drawHeart(w * 0.05, h * 0.4, 18 * u, "rgba(90,58,68,.70)", "rgba(255,255,255,.3)");
  drawHeart(w * 0.95, h * 0.62, 18 * u, "rgba(255,150,175,.76)", "rgba(255,150,175,.60)");
}

/* ---------- 8. 레트로 ---------- */
function drawQuoteRetroWindow(ctx, w, h) {
  const u = w / 1200;
  const inset = 6 * u;
  ctx.fillStyle = "rgba(255,255,255,.24)";
  ctx.fillRect(0, 0, w, 44 * u + inset * 2);
  const bar = ctx.createLinearGradient(0, 0, w, 0);
  bar.addColorStop(0, "#0A2A8C");
  bar.addColorStop(1, "#2D6FD0");
  ctx.fillStyle = bar;
  ctx.fillRect(inset, inset, w - inset * 2, 44 * u);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fillRect(18 * u, 20 * u, 16 * u, 16 * u);
  const buttonY = 16 * u;
  const buttonW = 26 * u;
  [0, 1, 2].forEach((i) => {
    const x = w - (18 + (3 - i) * 30) * u;
    ctx.fillStyle = "#C9CDD3";
    ctx.fillRect(x, buttonY, buttonW, buttonW);
    ctx.strokeStyle = "rgba(255,255,255,.86)";
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(x, buttonY + buttonW);
    ctx.lineTo(x, buttonY);
    ctx.lineTo(x + buttonW, buttonY);
    ctx.stroke();
    ctx.strokeStyle = "rgba(70,74,84,.55)";
    ctx.beginPath();
    ctx.moveTo(x + buttonW, buttonY);
    ctx.lineTo(x + buttonW, buttonY + buttonW);
    ctx.lineTo(x, buttonY + buttonW);
    ctx.stroke();
  });

  ctx.strokeStyle = "rgba(255,255,255,.88)";
  ctx.lineWidth = 6 * u;
  ctx.strokeRect(3 * u, 3 * u, w - 6 * u, h - 6 * u);
  ctx.strokeStyle = "rgba(70,74,84,.55)";
  ctx.beginPath();
  ctx.moveTo(w - 3 * u, 3 * u);
  ctx.lineTo(w - 3 * u, h - 3 * u);
  ctx.lineTo(3 * u, h - 3 * u);
  ctx.stroke();

  const paw = (cx, cy) => {
    const s = 8 * u;
    ctx.fillStyle = "rgba(70,74,84,.48)";
    [[0, 0], [-1.1, -1.35], [-0.35, -1.95], [0.35, -1.95], [1.1, -1.35]].forEach(([dx, dy], idx) => {
      const r = idx === 0 ? s * 0.95 : s * 0.4;
      ctx.beginPath();
      ctx.arc(cx + dx * s, cy + dy * s, r, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  paw(60 * u, h - 58 * u);
  paw(w - 60 * u, h - 58 * u);
}

/* ---------- 9. 마커 ---------- */
function drawQuoteMarkerPlaid(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(4119);
  const drawWobbleLine = (points, widthPx, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach(([x, y], idx) => {
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  const makeVertical = (xBase) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push([xBase + (r() - 0.5) * 10 * u, (h / 24) * i]);
    return pts;
  };
  const makeHorizontal = (yBase) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push([(w / 24) * i, yBase + (r() - 0.5) * 10 * u]);
    return pts;
  };
  for (let i = 0; i < 7; i++) drawWobbleLine(makeVertical((90 + i * 150) * u), 12 * u, "rgba(130,200,245,.55)");
  for (let i = 0; i < 9; i++) drawWobbleLine(makeHorizontal((110 + i * 125) * u), 12 * u, "rgba(130,200,245,.55)");
  for (let i = 0; i < 4; i++) drawWobbleLine(makeVertical((160 + i * 260) * u), 15 * u, "rgba(255,236,140,.65)");
  for (let i = 0; i < 5; i++) drawWobbleLine(makeHorizontal((180 + i * 220) * u), 15 * u, "rgba(255,236,140,.62)");
  for (let i = 0; i < 6; i++) {
    const y = (70 + i * 150) * u;
    const g = ctx.createLinearGradient(0, y, 0, y + 40 * u);
    g.addColorStop(0, "rgba(130,200,245,.12)");
    g.addColorStop(1, "rgba(130,200,245,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, 40 * u);
  }
  const wash = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, w * 0.48);
  wash.addColorStop(0, "rgba(255,255,255,.60)");
  wash.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.68);
}

/* ---------- 10. 그래프 ---------- */
function drawQuoteGraphPaper(ctx, w, h) {
  const u = w / 1200;
  const grid = 36 * u;
  ctx.strokeStyle = "rgba(130,138,150,.26)";
  ctx.lineWidth = 1 * u;
  for (let x = 0; x <= w; x += grid) {
    ctx.globalAlpha = quoteTestIsProtectedArea(x, h * 0.5, w, h) ? 0.5 : 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += grid) {
    ctx.globalAlpha = y >= h * 0.13 && y <= h * 0.85 ? 0.5 : 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(220,110,120,.35)";
  ctx.beginPath(); ctx.moveTo(w * 0.04, 0); ctx.lineTo(w * 0.04, h); ctx.stroke();
  const size = 120 * u;
  const x0 = w - size;
  const y0 = h - size;
  const fold = ctx.createLinearGradient(x0, y0, w, h);
  fold.addColorStop(0, "#E9EBEF");
  fold.addColorStop(1, "#FFFFFF");
  ctx.fillStyle = "rgba(0,0,0,.08)";
  ctx.beginPath(); ctx.moveTo(x0 + 8 * u, h); ctx.lineTo(w, y0 + 8 * u); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = fold;
  ctx.beginPath(); ctx.moveTo(x0, h); ctx.lineTo(w, y0); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(170,176,186,.55)";
  ctx.beginPath(); ctx.moveTo(x0, h); ctx.lineTo(w, y0); ctx.stroke();
}

/* ---------- 11. 클라우드 ---------- */
function drawQuoteCumulus(ctx, w, h) {
  const u = w / 1200;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(142,198,245,.20)");
  sky.addColorStop(1, "rgba(215,236,251,.04)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const drawCloud = (cx, cy, size) => {
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const rr = size * (0.38 + ((i * 7) % 5) * 0.08);
      const x = cx + Math.cos(angle) * size * 0.55;
      const y = cy + Math.sin(angle) * size * 0.18;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    const shadow = ctx.createLinearGradient(cx, cy - size * 0.35, cx, cy + size * 0.5);
    shadow.addColorStop(0, "rgba(140,185,230,0)");
    shadow.addColorStop(1, "rgba(140,185,230,.34)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.14, size * 1.25, size * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawCloud(w * 0.22, h * 0.96, 78 * u);
  drawCloud(w * 0.86, h * 0.92, 72 * u);
  ctx.strokeStyle = "rgba(60,90,140,.35)";
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.quadraticCurveTo(w * 0.96, h * 0.12, w * 0.88, h * 0.3);
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,.34)";
  ctx.lineWidth = 5 * u;
  [[0.78, 0.12, 0.12], [0.84, 0.18, 0.18], [0.72, 0.2, 0.16]].forEach(([x, y, len]) => {
    ctx.beginPath();
    ctx.moveTo(w * x, h * y);
    ctx.quadraticCurveTo(w * (x + len * 0.4), h * (y - 0.018), w * (x + len), h * (y + 0.006));
    ctx.stroke();
  });
}

/* ---------- 12. 리플 ---------- */
function drawQuoteRipplePool(ctx, w, h) {
  const u = w / 1200;
  [[0.14, 0.1, 0.30, "rgba(255,190,150,.28)"], [0.9, 0.6, 0.22, "rgba(255,230,120,.18)"], [0.1, 0.88, 0.24, "rgba(170,230,170,.18)"]].forEach(([x, y, r, c]) => {
    const g = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, w * r);
    g.addColorStop(0, c);
    g.addColorStop(1, c.replace(/0\.[0-9]+\)$/, "0)"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const cx = w * 0.82;
  const cy = h * 0.88;
  for (let radius = 60 * u, i = 0; radius < 760 * u; radius *= 1.03, i++) {
    ctx.strokeStyle = i % 2 ? "rgba(60,150,160,.12)" : "rgba(255,255,255,.34)";
    ctx.lineWidth = (2 + (i % 4)) * u;
    ctx.globalAlpha = radius < w * 0.45 ? 0.85 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI * 0.95, Math.PI * 1.98);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ---------- 13. 크래프트 ---------- */
function drawQuoteKraft(ctx, w, h) {
  const u = w / 1200;
  const r = quoteTestRng(5123);
  ctx.lineCap = "round";
  for (let i = 0; i < 380; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = (8 + r() * 18) * u;
    const a = r() * Math.PI * 2;
    ctx.strokeStyle = r() < 0.56 ? `rgba(110,75,40,${(0.08 + r() * 0.06).toFixed(3)})` : `rgba(255,235,200,${(0.08 + r() * 0.08).toFixed(3)})`;
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  for (let i = 0; i < 250; i++) {
    ctx.fillStyle = `rgba(70,45,20,${(0.08 + r() * 0.10).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, (0.8 + r()) * u, 0, Math.PI * 2);
    ctx.fill();
  }
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.3, w * 0.5, h * 0.5, w * 0.8);
  vignette.addColorStop(0, "rgba(60,35,15,0)");
  vignette.addColorStop(1, "rgba(60,35,15,.14)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/* ---------- 14. 벨럼 ---------- */
function drawQuoteVellum(ctx, w, h) {
  const u = w / 1200;
  const lines = [
    [0, 0.34, 1, 0.52],
    [0.68, 0, 0.62, 1],
  ];
  lines.forEach(([x1, y1, x2, y2]) => {
    ctx.strokeStyle = "rgba(120,130,140,.22)";
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(w * x1, h * y1);
    ctx.lineTo(w * x2, h * y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(w * x1 + 2 * u, h * y1 + 2 * u);
    ctx.lineTo(w * x2 + 2 * u, h * y2 + 2 * u);
    ctx.stroke();
  });
  for (let i = 0; i < 90; i++) {
    const y = (h / 90) * i;
    ctx.strokeStyle = "rgba(255,255,255,.03)";
    ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (i % 2 ? 1 : 0) * u); ctx.stroke();
  }
  const size = 150 * u;
  const x0 = w - size;
  const fold = ctx.createLinearGradient(x0, 0, w, size);
  fold.addColorStop(0, "#FFFFFF");
  fold.addColorStop(1, "#E5E8EA");
  ctx.fillStyle = fold;
  ctx.beginPath(); ctx.moveTo(w - size, 0); ctx.lineTo(w, 0); ctx.lineTo(w, size); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.08)";
  ctx.beginPath(); ctx.moveTo(w - size, 0); ctx.lineTo(w - size * 0.55, size * 0.55); ctx.lineTo(w, size); ctx.closePath(); ctx.fill();
}

/* ---------- 15. 크럼플 ---------- */
function drawQuoteCrumple(ctx, w, h) {
  const u = w / 1200;
  const cols = 7;
  const rows = 7;
  const jitter = 0.35;
  const pts = [];
  for (let iy = 0; iy <= rows; iy++) {
    pts[iy] = [];
    for (let ix = 0; ix <= cols; ix++) {
      const baseX = (w / cols) * ix;
      const baseY = (h / rows) * iy;
      const jx = ix === 0 || ix === cols ? 0 : (Math.sin(ix * 12.37 + iy * 3.11) * 0.5 + 0.5) * 2 - 1;
      const jy = ix === 0 || ix === cols || iy === 0 || iy === rows ? 0 : (Math.cos(ix * 4.91 + iy * 6.77) * 0.5 + 0.5) * 2 - 1;
      pts[iy][ix] = [baseX + jx * (w / cols) * jitter * 0.5, baseY + jy * (h / rows) * jitter * 0.5];
    }
  }
  const fillTri = (a, b, c, light) => {
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const alpha = quoteTestIsProtectedArea(cx, cy, w, h) ? 0.022 : 0.05;
    ctx.fillStyle = light ? `rgba(255,255,255,${alpha.toFixed(3)})` : `rgba(0,0,0,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
    ctx.fill();
    if (!quoteTestIsProtectedArea(cx, cy, w, h)) {
      ctx.strokeStyle = "rgba(0,0,0,.03)";
      ctx.lineWidth = 0.8 * u;
      ctx.stroke();
    }
  };
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const p00 = pts[iy][ix];
      const p10 = pts[iy][ix + 1];
      const p01 = pts[iy + 1][ix];
      const p11 = pts[iy + 1][ix + 1];
      const light = (ix + iy) % 2 === 0;
      fillTri(p00, p10, p11, light);
      fillTri(p00, p11, p01, !light);
    }
  }
}


/* ---------- 16. 깅엄 ---------- */
function drawQuoteGingham(ctx, w, h) {
  const u = w / 1200;
  const paper = ctx.createLinearGradient(0, 0, w, h);
  paper.addColorStop(0, "rgba(250,239,239,.92)");
  paper.addColorStop(1, "rgba(245,229,229,.92)");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);

  const drawCheckBand = (x, y, width, height, alpha = 1) => {
    const cell = 34 * u;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    for (let yy = y; yy < y + height + cell; yy += cell) {
      for (let xx = x; xx < x + width + cell; xx += cell) {
        const even = ((Math.round((xx - x) / cell) + Math.round((yy - y) / cell)) % 2) === 0;
        ctx.fillStyle = even ? `rgba(236,188,198,${0.72 * alpha})` : `rgba(251,231,236,${0.92 * alpha})`;
        ctx.fillRect(xx, yy, cell, cell);
      }
    }
    ctx.fillStyle = `rgba(231,170,182,${0.26 * alpha})`;
    for (let xx = x; xx < x + width + cell; xx += cell) ctx.fillRect(xx + cell * 0.42, y, cell * 0.18, height);
    for (let yy = y; yy < y + height + cell; yy += cell) ctx.fillRect(x, yy + cell * 0.42, width, cell * 0.18);
    ctx.restore();
  };

  const bandH = 108 * u;
  drawCheckBand(0, 0, w, bandH, 1);
  drawCheckBand(0, h - bandH, w, bandH, 1);

  const drawQuarter = (corner) => {
    const radius = 156 * u;
    ctx.save();
    ctx.beginPath();
    if (corner === 'tr') {
      ctx.moveTo(w, 0);
      ctx.arc(w, 0, radius, Math.PI, Math.PI * 0.5, true);
    } else {
      ctx.moveTo(0, h);
      ctx.arc(0, h, radius, 0, Math.PI * 1.5, true);
    }
    ctx.closePath();
    ctx.clip();
    drawCheckBand(corner === 'tr' ? w - radius : 0, corner === 'tr' ? 0 : h - radius, radius, radius, 0.95);
    ctx.restore();
  };
  drawQuarter('tr');
  drawQuarter('bl');

  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.fillRect(0, bandH - 3 * u, w, 10 * u);
  ctx.fillRect(0, h - bandH - 7 * u, w, 10 * u);
}

// 지정 프리셋은 사용자 목록 썸네일의 CSS background를 Canvas에서도 같은 구성으로 재현한다.
// 목록 썸네일의 CSS px 단위는 편집기 기준 폭(380px)에 맞춰 최종 1200px Canvas로 비례 확대한다.
function drawReaderShareThumbnailStyle(ctx, effect, w, h) {
  const keys = new Set([
    "rosy-blush", "sky-sparkle", "lavender-mist", "rose-quartz-glow",
    "opal-shimmer", "mist-layers", "graphite-grain", "gingham",
    "ripple-pool", "graph-paper", "soft-polka", "lace-grid",
  ]);
  if (!keys.has(effect)) return false;

  const s = w / 380;
  const fillLinear = (angleDeg, stops) => {
    const angle = angleDeg * Math.PI / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const span = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createLinearGradient(cx - dx * span / 2, cy - dy * span / 2, cx + dx * span / 2, cy + dy * span / 2);
    stops.forEach(([offset, color]) => g.addColorStop(offset, color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  const fillRadial = (x, y, rx, ry, stops) => {
    ctx.save();
    ctx.translate(w * x, h * y);
    ctx.scale(w * rx, h * ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    stops.forEach(([offset, color]) => g.addColorStop(offset, color));
    ctx.fillStyle = g;
    ctx.fillRect(-1.05, -1.05, 2.1, 2.1);
    ctx.restore();
  };
  const drawGrid = (spacingPx, color, linePx = 1) => {
    const spacing = spacingPx * s;
    const line = Math.max(1, linePx * s);
    ctx.fillStyle = color;
    for (let x = 0; x < w; x += spacing) ctx.fillRect(x, 0, line, h);
    for (let y = 0; y < h; y += spacing) ctx.fillRect(0, y, w, line);
  };
  const drawRepeatingLines = (angleDeg, spacingPx, linePx, color) => {
    const spacing = spacingPx * s;
    const line = Math.max(1, linePx * s);
    const diag = Math.hypot(w, h) * 1.5;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((angleDeg - 90) * Math.PI / 180);
    ctx.fillStyle = color;
    for (let y = -diag; y <= diag; y += spacing) ctx.fillRect(-diag, y, diag * 2, line);
    ctx.restore();
  };

  if (effect === "rosy-blush") {
    fillLinear(138, [[0, "#fff9fa"], [.48, "#f7e7e9"], [1, "#f0dadd"]]);
    fillRadial(.82, .78, .42, .42, [[0, "rgba(218,137,149,.12)"], [.43, "rgba(218,137,149,.12)"], [1, "rgba(218,137,149,0)"]]);
    fillRadial(.18, .18, .38, .38, [[0, "rgba(255,255,255,.82)"], [.47, "rgba(255,255,255,.82)"], [1, "rgba(255,255,255,0)"]]);
  } else if (effect === "sky-sparkle") {
    fillLinear(155, [[0, "#f4f9ff"], [.52, "#e5f1ff"], [1, "#d8e8fb"]]);
    [[.20,.24,.028,.96,.43],[.74,.18,.025,.92,.40],[.84,.72,.026,.80,.42]].forEach(([x,y,r,a,solid]) => {
      fillRadial(x, y, r, r, [[0, `rgba(255,255,255,${a})`], [solid, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]);
    });
  } else if (effect === "lavender-mist") {
    fillLinear(145, [[0, "#fbf8ff"], [.54, "#eee8ff"], [1, "#e5dcf8"]]);
    fillRadial(.84, .72, .48, .34, [[0, "rgba(205,224,251,.72)"], [.38, "rgba(205,224,251,.72)"], [1, "rgba(205,224,251,0)"]]);
    fillRadial(.14, .24, .45, .32, [[0, "rgba(240,213,235,.72)"], [.36, "rgba(240,213,235,.72)"], [1, "rgba(240,213,235,0)"]]);
  } else if (effect === "rose-quartz-glow") {
    fillLinear(148, [[0, "#fffdfd"], [.34, "#fdf4f6"], [.62, "#f4e0e4"], [1, "#ece8ee"]]);
    fillRadial(.80, .78, .20, .20, [[0, "rgba(255,255,255,.72)"], [.35, "rgba(255,255,255,.72)"], [1, "rgba(255,255,255,0)"]]);
    fillRadial(.18, .18, .34, .34, [[0, "rgba(255,255,255,.96)"], [.41, "rgba(255,255,255,.96)"], [1, "rgba(255,255,255,0)"]]);
  } else if (effect === "opal-shimmer") {
    fillLinear(150, [[0, "#fffcfb"], [.28, "#f5f8f7"], [.58, "#eef0ff"], [1, "#f9f0f7"]]);
  } else if (effect === "mist-layers") {
    fillLinear(145, [[0, "#f6f8fb"], [.48, "#e8edf3"], [1, "#dce4ec"]]);
    fillRadial(.54, .44, .50, .34, [[0, "rgba(218,226,236,.30)"], [.32, "rgba(218,226,236,.30)"], [1, "rgba(218,226,236,0)"]]);
    fillRadial(.82, .70, .46, .32, [[0, "rgba(184,203,221,.30)"], [.30, "rgba(184,203,221,.30)"], [1, "rgba(184,203,221,0)"]]);
    fillRadial(.18, .24, .42, .30, [[0, "rgba(255,255,255,.76)"], [.29, "rgba(255,255,255,.76)"], [1, "rgba(255,255,255,0)"]]);
  } else if (effect === "graphite-grain") {
    fillLinear(145, [[0, "#f2f2ef"], [1, "#dfdfdc"]]);
    drawRepeatingLines(98, 8, 1, "rgba(44,48,53,.028)");
    drawRepeatingLines(8, 5, 1, "rgba(44,48,53,.055)");
  } else if (effect === "gingham") {
    fillLinear(135, [[0, "#faefef"], [1, "#f5e5e5"]]);
    const cell = 18 * s;
    ctx.fillStyle = "rgba(233,180,189,.55)";
    for (let x = 0; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
    ctx.fillStyle = "rgba(248,223,228,.55)";
    for (let x = cell; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
    ctx.fillStyle = "rgba(233,180,189,.45)";
    for (let y = 0; y < h; y += cell * 2) ctx.fillRect(0, y, w, cell);
    ctx.fillStyle = "rgba(248,223,228,.45)";
    for (let y = cell; y < h; y += cell * 2) ctx.fillRect(0, y, w, cell);
  } else if (effect === "ripple-pool") {
    fillLinear(150, [[0, "#bfe8e4"], [1, "#e9f5ee"]]);
    fillRadial(.14, .10, .24, .24, [[0, "rgba(255,190,150,.4)"], [1, "rgba(255,190,150,0)"]]);
    const cx = w * .82;
    const cy = h * .88;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
    [[.07,.01,"rgba(255,255,255,.4)"],[.155,.01,"rgba(255,255,255,.3)"]].forEach(([r, lw, color]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, far * lw);
      ctx.beginPath();
      ctx.arc(cx, cy, far * r, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (effect === "graph-paper") {
    fillLinear(135, [[0, "#ffffff"], [1, "#f4f5f7"]]);
    drawGrid(22, "rgba(130,138,150,.28)");
  } else if (effect === "soft-polka") {
    fillLinear(135, [[0, "#f2f9fd"], [1, "#e3f1fa"]]);
    const tile = 34 * s;
    const inner = 5 * s;
    const outer = 9 * s;
    for (let y = tile / 2; y < h + tile / 2; y += tile) {
      for (let x = tile / 2; x < w + tile / 2; x += tile) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, outer);
        g.addColorStop(0, "rgba(150,205,235,.35)");
        g.addColorStop(Math.min(.99, inner / outer), "rgba(150,205,235,.35)");
        g.addColorStop(1, "rgba(150,205,235,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - outer, y - outer, outer * 2, outer * 2);
      }
    }
  } else if (effect === "lace-grid") {
    fillLinear(160, [[0, "#fff1f4"], [1, "#ffe3ea"]]);
    drawGrid(24, "rgba(240,150,170,.22)");
  }
  return true;
}

function drawReaderShareThemeEffect(ctx, background, width, height) {
  const effect = String(background?.effect || "");
  if (!effect) return;
  // Reuse the original supplied lab effects for editor, PNG and admin gallery.
  const delegatedEffect = READER_SHARE_NEW8.effects[effect]
    || READER_SHARE_CURATED_SET1.effects[effect]
    || READER_SHARE_CURATED_SET2.effects[effect];
  if (typeof delegatedEffect === "function") {
    ctx.save();
    try { delegatedEffect(ctx, width, height); }
    finally { ctx.restore(); }
    return;
  }
  if (drawReaderShareThumbnailStyle(ctx, effect, width, height)) return;

  ctx.save();
  if (effect === "rosy-blush") {
    const glow = ctx.createRadialGradient(width * .18, height * .16, 0, width * .18, height * .16, width * .46);
    glow.addColorStop(0, "rgba(255,255,255,.46)");
    glow.addColorStop(.5, "rgba(255,255,255,.12)");
    glow.addColorStop(1, "rgba(180,91,99,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    const blush = ctx.createRadialGradient(width * .84, height * .8, 0, width * .84, height * .8, width * .38);
    blush.addColorStop(0, "rgba(180,91,99,.10)");
    blush.addColorStop(1, "rgba(180,91,99,0)");
    ctx.fillStyle = blush;
    ctx.fillRect(0, 0, width, height);
  } else if (effect === "sky-sparkle") {
    const mist = ctx.createRadialGradient(width * .2, height * .76, 0, width * .2, height * .76, width * .52);
    mist.addColorStop(0, "rgba(255,255,255,.34)");
    mist.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, width, height);
    const sparkles = [
      [.17,.19,2.8],[.29,.31,1.6],[.72,.16,2.1],[.82,.29,1.4],[.88,.68,2.5],[.67,.78,1.5],[.22,.73,1.8],[.42,.13,1.2]
    ];
    ctx.strokeStyle = "rgba(255,255,255,.66)";
    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.lineWidth = Math.max(1, width / 1200);
    for (const [x, y, r] of sparkles) {
      const cx = width * x, cy = height * y, rr = r * (width / 380);
      ctx.beginPath();
      ctx.moveTo(cx - rr * 1.8, cy); ctx.lineTo(cx + rr * 1.8, cy);
      ctx.moveTo(cx, cy - rr * 1.8); ctx.lineTo(cx, cy + rr * 1.8);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, rr * .22), 0, Math.PI * 2); ctx.fill();
    }
  } else if (effect === "lavender-mist") {
    const pink = ctx.createRadialGradient(width * .14, height * .24, 0, width * .14, height * .24, width * .48);
    pink.addColorStop(0, "rgba(232,190,222,.30)");
    pink.addColorStop(.55, "rgba(232,190,222,.10)");
    pink.addColorStop(1, "rgba(232,190,222,0)");
    ctx.fillStyle = pink; ctx.fillRect(0, 0, width, height);
    const blue = ctx.createRadialGradient(width * .86, height * .74, 0, width * .86, height * .74, width * .50);
    blue.addColorStop(0, "rgba(166,203,242,.28)");
    blue.addColorStop(.58, "rgba(166,203,242,.09)");
    blue.addColorStop(1, "rgba(166,203,242,0)");
    ctx.fillStyle = blue; ctx.fillRect(0, 0, width, height);
  } else if (effect === "rose-quartz-glow") {
    const pearl = ctx.createRadialGradient(width * .18, height * .18, 0, width * .18, height * .18, width * .42);
    pearl.addColorStop(0, "rgba(255,255,255,.58)");
    pearl.addColorStop(.4, "rgba(255,255,255,.2)");
    pearl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = pearl; ctx.fillRect(0, 0, width, height);
    const rose = ctx.createRadialGradient(width * .72, height * .72, 0, width * .72, height * .72, width * .4);
    rose.addColorStop(0, "rgba(208,148,160,.18)");
    rose.addColorStop(.48, "rgba(208,148,160,.07)");
    rose.addColorStop(1, "rgba(208,148,160,0)");
    ctx.fillStyle = rose; ctx.fillRect(0, 0, width, height);
    const silver = ctx.createLinearGradient(width * .05, height * .68, width * .95, height * .82);
    silver.addColorStop(0, "rgba(255,255,255,0)");
    silver.addColorStop(.3, "rgba(255,255,255,.16)");
    silver.addColorStop(.5, "rgba(255,255,255,.03)");
    silver.addColorStop(.76, "rgba(255,255,255,.14)");
    silver.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = silver;
    ctx.beginPath();
    ctx.moveTo(0, height * .76);
    ctx.bezierCurveTo(width * .2, height * .7, width * .42, height * .82, width * .6, height * .75);
    ctx.bezierCurveTo(width * .76, height * .69, width * .9, height * .79, width, height * .74);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.72)";
    [[.22,.22,1.8],[.82,.18,1.4],[.76,.76,1.5],[.52,.68,1.2]].forEach(([x,y,r]) => {
      const rr = r * (width / 420);
      ctx.beginPath();
      ctx.arc(width * x, height * y, rr, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (effect === "serenity-breeze") {
    const wave = ctx.createLinearGradient(width * .02, height * .62, width * .98, height * .8);
    wave.addColorStop(0, "rgba(255,255,255,0)");
    wave.addColorStop(.25, "rgba(255,255,255,.18)");
    wave.addColorStop(.5, "rgba(255,255,255,.04)");
    wave.addColorStop(.75, "rgba(255,255,255,.14)");
    wave.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wave;
    ctx.beginPath();
    ctx.moveTo(0, height * .72);
    ctx.bezierCurveTo(width * .18, height * .65, width * .36, height * .79, width * .5, height * .73);
    ctx.bezierCurveTo(width * .66, height * .66, width * .82, height * .82, width, height * .74);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.52)";
    [[.18,.24,1.8],[.32,.18,1.2],[.71,.22,1.4],[.84,.32,1.7],[.78,.68,1.1],[.55,.82,1.4]].forEach(([x,y,r]) => {
      const cx = width * x, cy = height * y, rr = r * (width / 420);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (effect === "opal-shimmer") {
    const orbs = [
      [0.18, 0.2, 0.32, "rgba(246,214,225,.16)"],
      [0.82, 0.22, 0.28, "rgba(188,218,255,.18)"],
      [0.28, 0.8, 0.3, "rgba(201,239,228,.18)"],
      [0.78, 0.76, 0.34, "rgba(241,216,184,.14)"]
    ];
    for (const [x, y, size, color] of orbs) {
      const orb = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, width * size);
      orb.addColorStop(0, color);
      orb.addColorStop(.55, color.replace(/0\.\d+\)$/, '0.05)'));
      orb.addColorStop(1, color.replace(/0\.\d+\)$/, '0)'));
      ctx.fillStyle = orb;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.strokeStyle = "rgba(255,255,255,.34)";
    ctx.lineWidth = Math.max(1, width / 1800);
    [[.2,.62,.08],[.54,.18,.06],[.75,.5,.07]].forEach(([x,y,size]) => {
      ctx.beginPath();
      ctx.ellipse(width*x, height*y, width*size, height*size*.46, -0.35, 0, Math.PI*2);
      ctx.stroke();
    });
  } else if (effect === "mist-layers") {
    const veils = [
      [.18,.24,.44,"rgba(255,255,255,.28)"],
      [.82,.7,.38,"rgba(186,205,222,.18)"],
      [.52,.48,.54,"rgba(224,231,238,.16)"]
    ];
    veils.forEach(([x,y,r,color]) => {
      const g = ctx.createRadialGradient(width*x,height*y,0,width*x,height*y,width*r);
      g.addColorStop(0,color);
      g.addColorStop(.58,color.replace(/0\.\d+\)$/, '0.06)'));
      g.addColorStop(1,"rgba(220,228,236,0)");
      ctx.fillStyle=g; ctx.fillRect(0,0,width,height);
    });
    ctx.strokeStyle="rgba(255,255,255,.20)";
    ctx.lineWidth=Math.max(1,width/1500);
    for(let i=0;i<4;i++){
      const y=.3+i*.14; ctx.beginPath(); ctx.moveTo(-width*.05,height*y);
      ctx.bezierCurveTo(width*.24,height*(y-.05),width*.52,height*(y+.05),width*1.05,height*(y-.015)); ctx.stroke();
    }
  } else if (effect === "celadon-glaze") {
    ctx.strokeStyle="rgba(54,100,88,.18)"; ctx.lineWidth=Math.max(1,width/1500);
    const cracks=[[[.08,.12],[.23,.28],[.18,.48],[.34,.66]],[[.82,.08],[.69,.24],[.76,.43],[.63,.61],[.72,.86]],[[.38,.02],[.46,.2],[.41,.37],[.53,.54],[.47,.76]]];
    cracks.forEach(line=>{ctx.beginPath();line.forEach(([x,y],i)=>i?ctx.lineTo(width*x,height*y):ctx.moveTo(width*x,height*y));ctx.stroke();});
  } else if (effect === "ink-echo") {
    [[.16,.2,.22,"rgba(37,55,81,.13)"],[.84,.76,.26,"rgba(62,76,98,.10)"],[.72,.18,.14,"rgba(92,105,124,.07)"]].forEach(([x,y,r,c])=>{const g=ctx.createRadialGradient(width*x,height*y,0,width*x,height*y,width*r);g.addColorStop(0,c);g.addColorStop(.55,c.replace(/0\.\d+\)$/, '0.035)'));g.addColorStop(1,"rgba(40,50,70,0)");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);});
    ctx.strokeStyle="rgba(49,74,106,.13)"; ctx.lineWidth=Math.max(1,width/1400);
    ctx.beginPath(); ctx.moveTo(width*.1,height*.78); ctx.bezierCurveTo(width*.32,height*.7,width*.48,height*.88,width*.7,height*.76); ctx.bezierCurveTo(width*.82,height*.69,width*.9,height*.74,width*.96,height*.68); ctx.stroke();
  } else if (effect === "aurora-weave") {
    const veils = [
      [.18, .24, .34, .28, [[0, "rgba(70,238,200,.26)"], [.42, "rgba(70,238,200,.12)"], [1, "rgba(70,238,200,0)"]]],
      [.78, .34, .38, .32, [[0, "rgba(157,101,255,.25)"], [.45, "rgba(157,101,255,.11)"], [1, "rgba(157,101,255,0)"]]],
      [.44, .78, .54, .22, [[0, "rgba(65,134,255,.10)"], [.5, "rgba(65,134,255,.05)"], [1, "rgba(65,134,255,0)"]]],
      [.52, .48, .46, .38, [[0, "rgba(255,255,255,.04)"], [.4, "rgba(255,255,255,.02)"], [1, "rgba(255,255,255,0)"]]],
    ];
    veils.forEach(([x, y, rx, ry, stops]) => {
      ctx.save();
      ctx.translate(width * x, height * y);
      ctx.scale(width * rx, height * ry);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      stops.forEach(([offset, color]) => glow.addColorStop(offset, color));
      ctx.fillStyle = glow;
      ctx.fillRect(-1.25, -1.25, 2.5, 2.5);
      ctx.restore();
    });
    const softSweep = ctx.createLinearGradient(width * .06, height * .12, width * .94, height * .84);
    softSweep.addColorStop(0, "rgba(70,238,200,.04)");
    softSweep.addColorStop(.5, "rgba(141,146,255,.02)");
    softSweep.addColorStop(1, "rgba(157,101,255,.04)");
    ctx.fillStyle = softSweep;
    ctx.fillRect(0, 0, width, height);
  } else if (effect === "sunset-layers") {
    const bands=[[.64,"rgba(255,255,255,.18)"],[.72,"rgba(255,225,204,.17)"],[.8,"rgba(183,151,222,.12)"]];
    bands.forEach(([y,c],idx)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,height*y);ctx.bezierCurveTo(width*.28,height*(y-.05+idx*.01),width*.58,height*(y+.05),width,height*(y-.01));ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.closePath();ctx.fill();});
  } else if (effect === "meteor-trails") {
    ctx.strokeStyle="rgba(230,233,255,.46)"; ctx.lineCap="round";
    [[.18,.22,.36,.08,1.8],[.68,.18,.22,.12,1.2],[.44,.58,.34,.10,1.4]].forEach(([x,y,dx,dy,lw])=>{ctx.lineWidth=Math.max(1,width/700*lw);ctx.beginPath();ctx.moveTo(width*x,height*y);ctx.lineTo(width*(x+dx),height*(y+dy));ctx.stroke();});
    ctx.fillStyle="rgba(255,255,255,.55)"; [[.12,.15],[.82,.36],[.26,.72],[.72,.78],[.9,.18]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(width*x,height*y,Math.max(1,width/700),0,Math.PI*2);ctx.fill();});
  } else if (effect === "wind-contours") {
    ctx.strokeStyle="rgba(82,124,142,.16)"; ctx.lineWidth=Math.max(1,width/1300);
    for(let i=0;i<7;i++){const y=.18+i*.1;ctx.beginPath();ctx.moveTo(-width*.05,height*y);ctx.bezierCurveTo(width*.22,height*(y-.08),width*.46,height*(y+.08),width*.72,height*y);ctx.bezierCurveTo(width*.86,height*(y-.05),width*.96,height*(y+.02),width*1.05,height*(y-.03));ctx.stroke();}
  } else if (effect === "glasshouse") {
    ctx.strokeStyle="rgba(70,112,94,.13)"; ctx.lineWidth=Math.max(1,width/1300);
    for(let x=.08;x<1;x+=.14){ctx.beginPath();ctx.moveTo(width*x,0);ctx.lineTo(width*(x-.18),height);ctx.stroke();}
    ctx.strokeStyle="rgba(255,255,255,.20)"; for(let x=.16;x<1;x+=.2){ctx.beginPath();ctx.moveTo(width*x,0);ctx.lineTo(width*(x+.14),height);ctx.stroke();}
  } else if (effect === "graphite-grain") {
    ctx.strokeStyle="rgba(42,46,52,.08)"; ctx.lineWidth=Math.max(1,width/1600);
    for(let y=0;y<height;y+=Math.max(8,height/90)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y+height*.02);ctx.stroke();}
    ctx.globalAlpha=.45; ctx.fillStyle="rgba(255,255,255,.22)"; for(let i=0;i<34;i++){const x=((i*37)%101)/100*width;const y=((i*61)%97)/96*height;ctx.fillRect(x,y,Math.max(1,width/900),Math.max(1,width/900));}
  } else if (effect === "petal-flow") {
    const petals = [
      [.08,.18,.018,-.5],[.14,.28,.013,.4],[.2,.14,.016,-.2],[.28,.34,.012,.8],
      [.72,.16,.012,-.7],[.82,.24,.018,.25],[.9,.38,.014,.7],[.78,.7,.016,-.3],
      [.9,.78,.011,.4],[.18,.76,.013,-.8],[.3,.84,.017,.15],[.66,.86,.012,.65]
    ];
    petals.forEach(([x,y,r,rot], index) => {
      ctx.save(); ctx.translate(width*x,height*y); ctx.rotate(rot);
      const rr=width*r; ctx.fillStyle=index%3===0?"rgba(218,126,146,.48)":"rgba(240,171,185,.40)";
      ctx.beginPath();
      ctx.moveTo(0,-rr);
      ctx.bezierCurveTo(rr*.85,-rr*.62,rr*.9,rr*.25,0,rr);
      ctx.bezierCurveTo(-rr*.9,rr*.25,-rr*.85,-rr*.62,0,-rr);
      ctx.fill(); ctx.restore();
    });
    ctx.strokeStyle="rgba(212,138,154,.12)"; ctx.lineWidth=Math.max(1,width/1500);
    ctx.beginPath(); ctx.moveTo(-width*.05,height*.36); ctx.bezierCurveTo(width*.28,height*.18,width*.52,height*.5,width*1.05,height*.28); ctx.stroke();
  } else if (effect === "soft-glow") {
    const lights=[[.12,.24,.022],[.2,.68,.014],[.34,.18,.012],[.68,.26,.018],[.82,.18,.011],[.88,.66,.022],[.7,.78,.013],[.44,.82,.01]];
    lights.forEach(([x,y,r],i)=>{
      const radius=width*r*5.4; const g=ctx.createRadialGradient(width*x,height*y,0,width*x,height*y,radius);
      const core=i%2?"rgba(238,255,170,.50)":"rgba(205,255,183,.48)";
      g.addColorStop(0,core); g.addColorStop(.18,"rgba(221,249,169,.22)"); g.addColorStop(1,"rgba(221,249,169,0)");
      ctx.fillStyle=g; ctx.fillRect(width*x-radius,height*y-radius,radius*2,radius*2);
    });
    ctx.strokeStyle="rgba(225,248,166,.24)"; ctx.lineCap="round"; ctx.lineWidth=Math.max(1,width/900);
    [[.12,.24,.08,.035],[.68,.26,.09,-.025],[.88,.66,.06,.045]].forEach(([x,y,dx,dy])=>{
      ctx.beginPath(); ctx.moveTo(width*x,height*y); ctx.quadraticCurveTo(width*(x+dx*.55),height*(y-dy*.8),width*(x+dx),height*(y+dy)); ctx.stroke();
    });
  } else if (effect === "paper-tape") {
    const unit=width/1200;
    ctx.strokeStyle="rgba(91,73,55,.16)"; ctx.lineWidth=Math.max(1,unit*1.3); ctx.setLineDash([unit*10,unit*9]);
    ctx.strokeRect(width*.055,height*.06,width*.89,height*.88); ctx.setLineDash([]);
    const tape=(x,y,w,h,rot,color)=>{ctx.save();ctx.translate(width*x,height*y);ctx.rotate(rot);ctx.fillStyle=color;ctx.fillRect(-width*w/2,-height*h/2,width*w,height*h);ctx.strokeStyle="rgba(116,92,66,.08)";ctx.lineWidth=Math.max(1,unit);for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(-width*w/2,height*h*i/10);ctx.lineTo(width*w/2,height*h*(i/10+.06));ctx.stroke();}ctx.restore();};
    tape(.18,.095,.2,.055,-.09,"rgba(215,178,136,.32)");
    tape(.82,.91,.18,.05,.08,"rgba(188,164,127,.26)");
    ctx.fillStyle="rgba(139,102,78,.18)";
    [[.88,.15,.012],[.12,.82,.009],[.86,.77,.008]].forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(width*x,height*y,width*r,0,Math.PI*2);ctx.fill();});
  } else if (effect === "dawn-fog") {
    [[.16,.72,.42,"rgba(255,255,255,.22)"],[.76,.24,.34,"rgba(205,222,233,.18)"],[.55,.54,.5,"rgba(255,255,255,.12)"]].forEach(([x,y,r,c])=>{const g=ctx.createRadialGradient(width*x,height*y,0,width*x,height*y,width*r);g.addColorStop(0,c);g.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);});
  } else if (effect === "hanji-gilt") {
    drawQuoteHanjiGilt(ctx, width, height);
  } else if (effect === "midnight-bookshop") {
    drawQuoteMidnightBookshop(ctx, width, height);
  } else if (effect === "watercolor-bleed") {
    drawQuoteWatercolorBleed(ctx, width, height);
  } else if (effect === "moon-ridge") {
    drawQuoteMoonRidge(ctx, width, height);
  } else if (effect === "prism-foil") {
    drawQuotePrismFoil(ctx, width, height);
  } else if (effect === "frost-window") {
    drawQuoteFrostWindow(ctx, width, height);
  } else if (effect === "tide-lines") {
    drawQuoteTideLines(ctx, width, height);
  } else if (effect === "forest-haze") {
    drawQuoteForestHaze(ctx, width, height);
  } else if (effect === "film-leak") {
    drawQuoteFilmLeak(ctx, width, height);
  } else if (effect === "star-chart") {
    drawQuoteStarChart(ctx, width, height);
  } else if (effect === "soft-polka") {
    drawQuoteSoftPolka(ctx, width, height);
  } else if (effect === "lace-grid") {
    drawQuoteLaceGrid(ctx, width, height);
  } else if (effect === "retro-window") {
    drawQuoteRetroWindow(ctx, width, height);
  } else if (effect === "marker-plaid") {
    drawQuoteMarkerPlaid(ctx, width, height);
  } else if (effect === "graph-paper") {
    drawQuoteGraphPaper(ctx, width, height);
  } else if (effect === "cumulus") {
    drawQuoteCumulus(ctx, width, height);
  } else if (effect === "ripple-pool") {
    drawQuoteRipplePool(ctx, width, height);
  } else if (effect === "kraft") {
    drawQuoteKraft(ctx, width, height);
  } else if (effect === "vellum") {
    drawQuoteVellum(ctx, width, height);
  } else if (effect === "crumple") {
    drawQuoteCrumple(ctx, width, height);
  } else if (effect === "gingham") {
    drawQuoteGingham(ctx, width, height);
  }
  ctx.restore();
}

function getReaderShareRenderModel() {
  ensureReaderShareState();
  const background = READER_SHARE_BACKGROUNDS[state.readerShareBackground] || READER_SHARE_BACKGROUNDS[0];
  const item = getReaderShareSourceItem();
  const text = getReaderShareEditedText(state.readerShareText).slice(0, 700);
  const font = READER_SHARE_FONTS.find((entry) => entry.key === state.readerShareFont) || READER_SHARE_FONTS[0];
  const size = READER_SHARE_SIZES[state.readerShareSize] || READER_SHARE_SIZES.xs;
  const weightSetting = READER_SHARE_WEIGHTS[state.readerShareWeight] || READER_SHARE_WEIGHTS.regular;
  const ratio = ["4:5", "2:3"].includes(state.readerShareRatio) ? state.readerShareRatio : "1:1";
  return {
    background,
    font,
    item,
    text,
    // Preserve the explicit size step for export as well. Long text is truncated
    // from the bottom by the layout logic instead of collapsing small steps.
    sizePx: size.px,
    fontWeight: weightSetting.weight || font.weight || 400,
    ratio,
    autoWrap: !!state.readerShareAutoWrap,
    brand: getReaderShareBrandName(),
  };
}

function fitShareLinesToWidth(ctx, rawText, maxWidth, autoWrap) {
  const paragraphs = String(rawText || "").split(/\r?\n/);
  const lines = [];
  const pushBrokenToken = (token) => {
    let part = "";
    for (const ch of Array.from(token)) {
      const test = part + ch;
      if (part && ctx.measureText(test).width > maxWidth) {
        lines.push(part);
        part = ch;
      } else {
        part = test;
      }
    }
    if (part) lines.push(part);
  };
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    if (!autoWrap) {
      pushBrokenToken(paragraph);
      continue;
    }
    const tokens = paragraph.split(/(\s+)/).filter(Boolean);
    let line = "";
    for (const token of tokens) {
      const test = line + token;
      if (!line) {
        if (ctx.measureText(token).width <= maxWidth) {
          line = token;
        } else {
          pushBrokenToken(token);
          line = "";
        }
        continue;
      }
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        continue;
      }
      lines.push(line.trimEnd());
      if (ctx.measureText(token).width <= maxWidth) {
        line = token.trimStart();
      } else {
        pushBrokenToken(token.trim());
        line = "";
      }
    }
    if (line) lines.push(line.trimEnd());
  }
  return lines.length ? lines : [""];
}

function computeReaderShareTextLayout(ctx, model, width, height) {
  const left = width * 0.07;
  const right = width * 0.07;
  const top = model.ratio === "2:3" ? height * 0.115 : model.ratio === "4:5" ? height * 0.12 : height * 0.13;
  const bottom = model.ratio === "2:3" ? height * 0.115 : model.ratio === "4:5" ? height * 0.13 : height * 0.15;
  const boxWidth = width - left - right;
  const boxHeight = height - top - bottom;
  const scale = width / 380;
  const fontSize = model.sizePx * scale;
  const lineHeight = fontSize * 1.42;
  ctx.font = `${model.fontWeight || model.font.weight || 400} ${fontSize}px ${model.font.css}`;
  let lines = fitShareLinesToWidth(ctx, model.text, boxWidth, model.autoWrap);

  const maxLines = Math.max(1, Math.floor(boxHeight / lineHeight));
  const truncated = lines.length > maxLines;
  if (truncated) {
    lines = lines.slice(0, maxLines);
    const last = Math.max(0, lines.length - 1);
    lines[last] = `${String(lines[last] || "").replace(/[.…\s]+$/u, "")}…`;
  }

  return { left, top, boxWidth, boxHeight, fontSize, lineHeight, lines, truncated };
}

// v10.07: optional per-preset text treatment from the supplied design lab.
// The regular text renderer, font selection, wrapping, save and clipboard paths stay unchanged.
function drawReaderShareTextFx(ctx, line, x, y, color, fx, scale, foilFill = null) {
  ctx.save();
  if (Array.isArray(fx?.halo)) {
    ctx.lineJoin = "round";
    ctx.strokeStyle = fx.halo[0];
    ctx.lineWidth = Number(fx.halo[1] || 0) * scale;
    ctx.strokeText(line, x, y);
  }
  if (fx?.emboss) {
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillText(line, x + 1.6 * scale, y + 1.9 * scale);
  }
  if (Array.isArray(fx?.shadow)) {
    ctx.shadowColor = fx.shadow[0];
    ctx.shadowBlur = Number(fx.shadow[1] || 0) * scale;
    ctx.shadowOffsetX = Number(fx.shadow[2] || 0) * scale;
    ctx.shadowOffsetY = Number(fx.shadow[3] || 0) * scale;
  }
  ctx.fillStyle = foilFill || color;
  ctx.fillText(line, x, y);
  ctx.restore();
}

async function renderReaderShareCanvas() {
  const model = getReaderShareRenderModel();
  const width = 1200;
  const height = model.ratio === "2:3" ? 1800 : model.ratio === "4:5" ? 1500 : 1200;
  try {
    await ensureReaderShareFont(model.font?.key);
    if (document.fonts?.load) {
      await document.fonts.load(`${model.fontWeight || model.font.weight || 400} 48px ${model.font.css}`);
      await document.fonts.ready;
    }
  } catch (_) {}

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_context_unavailable");

  const customRenderers = {
    ...READER_SHARE_GEMINI4.renderers,
    ...READER_SHARE_GEMINI_SELECT3.renderers,
  };
  const customRenderer = customRenderers[getReaderShareBackgroundKey(model.background)];
  if (typeof customRenderer === "function") {
    customRenderer(ctx, width, height, model);
    return canvas;
  }

  const colors = parseShareGradientColors(model.background.background);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors.start);
  gradient.addColorStop(1, colors.end);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,.02)";
  ctx.fillRect(0, 0, width, height);
  drawReaderShareThemeEffect(ctx, model.background, width, height);

  const scale = width / 380;
  const brandX = width * 0.07;
  const brandY = height * 0.058;
  const logoSize = 16 * scale;
  const brandFont = 10 * scale;
  const brandGap = 4 * scale;
  ctx.save();
  ctx.globalAlpha = 0.58;
  ctx.fillStyle = model.background.meta;
  if (typeof Path2D !== "undefined") {
    try {
      const catPath = new Path2D("M8.3 11.6 6.7 6.8l5.1 2.7A11.7 11.7 0 0 1 16 8.7c1.5 0 2.9.3 4.2.8l5.1-2.7-1.6 4.8a9.2 9.2 0 0 1 2 5.7c0 5.2-4.3 9-9.7 9s-9.7-3.8-9.7-9c0-2.2.7-4.1 2-5.7Z");
      ctx.save();
      ctx.translate(brandX, brandY);
      ctx.scale(logoSize / 32, logoSize / 32);
      ctx.fill(catPath);
      ctx.restore();
    } catch (_) {}
  }
  ctx.font = `800 ${brandFont}px Pretendard, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(model.brand, brandX + logoSize + brandGap, brandY + (logoSize * 0.52));
  ctx.restore();

  const layout = computeReaderShareTextLayout(ctx, model, width, height);
  ctx.fillStyle = model.background.text;
  ctx.globalAlpha = Number(model.textOpacity ?? 1);
  ctx.font = `${model.fontWeight || model.font.weight || 400} ${layout.fontSize}px ${model.font.css}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const totalHeight = layout.lines.length * layout.lineHeight;
  let y = layout.truncated
    ? layout.top
    : layout.top + Math.max(0, (layout.boxHeight - totalHeight) / 2);
  const centerX = width / 2;
  const textFx = model.background.textFx || null;
  const effectScale = width / 1200;
  let foilFill = null;
  if (Array.isArray(textFx?.foil)) {
    foilFill = ctx.createLinearGradient(0, y - layout.lineHeight / 2, 0, y + totalHeight - layout.lineHeight / 2);
    foilFill.addColorStop(0, textFx.foil[0]);
    foilFill.addColorStop(.5, textFx.foil[1]);
    foilFill.addColorStop(1, textFx.foil[2]);
  }
  for (const line of layout.lines) {
    if (textFx) drawReaderShareTextFx(ctx, line, centerX, y, model.background.text, textFx, effectScale, foilFill);
    else ctx.fillText(line, centerX, y);
    y += layout.lineHeight;
  }

  const meta = [model.item.title, model.item.author].filter(Boolean).join(" · ") || "제목 정보 없음";
  ctx.globalAlpha = 1;
  ctx.fillStyle = model.background.meta;
  ctx.font = `400 ${10 * scale}px Pretendard, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (textFx) drawReaderShareTextFx(ctx, meta, centerX, height - (height * 0.058), model.background.meta, textFx, effectScale);
  else ctx.fillText(meta, centerX, height - (height * 0.058));

  return canvas;
}

function downloadReaderShareBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function getReaderShareFilename() {
  const title = String(getReaderShareSourceItem().title || "quote-card")
    .replace(/[\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const ratio = state.readerShareRatio === "4:5" ? "4x5" : state.readerShareRatio === "2:3" ? "2x3" : "1x1";
  return `${title || "quote-card"}-${ratio}.png`;
}

function isReaderShareTouchDevice() {
  return !!window.matchMedia?.("(pointer: coarse)")?.matches;
}

function updateReaderShareActionLayout() {
  if (!readerShareUi?.actions) return;
  const visibleButtons = [...readerShareUi.actions.querySelectorAll('.reader-share-action')]
    .filter((button) => !button.hidden);
  const touch = isReaderShareTouchDevice();
  const count = Math.max(1, visibleButtons.length);
  readerShareUi.actions.style.setProperty('--share-action-count', String(count));
  readerShareUi.actions.dataset.layout = touch ? 'mobile' : 'desktop';
  // On touch screens, a fifth (lone) share action fills the two-column last row.
  const wideShare = touch && visibleButtons.length % 2 === 1
    && visibleButtons[visibleButtons.length - 1] === readerShareUi.shareButton;
  readerShareUi.actions.dataset.shareSystemWide = wideShare ? 'true' : 'false';
}

function updateReaderShareActionLabel() {
  if (!readerShareUi) return;
  const touch = isReaderShareTouchDevice();
  if (readerShareUi.saveButton) readerShareUi.saveButton.textContent = "이미지 저장";
  // v7.77 검증 동작: 준비 상태 때문에 버튼 자체를 비활성화하지 않는다.
  // 아직 Blob이 준비되지 않은 극히 짧은 구간은 클릭 핸들러가 안내 후 즉시 재준비한다.
  if (readerShareUi.clipboardButton) readerShareUi.clipboardButton.textContent = "클립보드 복사";
  if (readerShareUi.workLinkButton) {
    readerShareUi.workLinkButton.textContent = "작품 링크 복사";
    readerShareUi.workLinkButton.hidden = !getWorkShareUrl(getReaderShareSourceItem());
  }
  if (readerShareUi.shareButton) {
    readerShareUi.shareButton.textContent = "공유하기";
    readerShareUi.shareButton.hidden = !touch;
  }
  updateReaderShareActionLayout();
}

let readerSharePreparedBlob = null;
let readerSharePreparedBlobKey = "";
let readerSharePreparePromise = null;
let readerSharePreparePromiseKey = "";
let readerSharePrepareTimer = 0;
let readerSharePreviewUrl = "";
let readerSharePreviewKey = "";
let readerSharePreviewPromise = null;
let readerSharePreviewGeneration = 0;
let readerSharePreviewTimer = 0;

function getReaderShareBlobKey() {
  const item = getReaderShareSourceItem();
  return JSON.stringify({
    text: getReaderShareEditedText(state.readerShareText).slice(0, 700),
    background: state.readerShareBackground,
    ratio: state.readerShareRatio,
    font: state.readerShareFont,
    size: state.readerShareSize,
    weight: state.readerShareWeight,
    autoWrap: !!state.readerShareAutoWrap,
    title: item.title || "",
    author: item.author || "",
  });
}

function createReaderShareBlobPromise() {
  return renderReaderShareCanvas().then((canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("blob_failed")), "image/png");
  }));
}

async function normalizeReaderShareClipboardBlob(blob) {
  if (!(blob instanceof Blob) || blob.type !== "image/png" || blob.size <= 0) {
    throw new Error("clipboard_image_invalid");
  }

  // Keep the proven click-time ClipboardItem path untouched. Normalize the
  // prepared PNG beforehand so mobile clipboard receives a plain, decoded
  // PNG blob instead of depending on the browser's canvas-backed blob internals.
  if (typeof createImageBitmap === "function") {
    let bitmap = null;
    try {
      bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, bitmap.width || 1);
      canvas.height = Math.max(1, bitmap.height || 1);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("clipboard_canvas_unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value instanceof Blob && value.type === "image/png" && value.size > 0) {
            resolve(value);
          } else {
            reject(new Error("clipboard_image_invalid"));
          }
        }, "image/png");
      });
    } finally {
      try { bitmap?.close?.(); } catch (_) {}
    }
  }

  // Fallback still detaches the clipboard blob from the original canvas blob.
  const bytes = await blob.arrayBuffer();
  const normalized = new Blob([bytes], { type: "image/png" });
  if (!normalized.size) throw new Error("clipboard_image_invalid");
  return normalized;
}

function createReaderShareClipboardBlobPromise() {
  return createReaderShareBlobPromise().then(normalizeReaderShareClipboardBlob);
}

function getReaderShareOutputDimensions() {
  const ratio = ["4:5", "2:3"].includes(state.readerShareRatio) ? state.readerShareRatio : "1:1";
  return { width: 1200, height: ratio === "2:3" ? 1800 : ratio === "4:5" ? 1500 : 1200 };
}

function postReaderShareAdminOutputBlob(blob) {
  if (!READER_SHARE_ADMIN_EMBED_MODE || window.parent === window || !(blob instanceof Blob)) return;
  const dims = getReaderShareOutputDimensions();
  try {
    window.parent.postMessage({
      type: "rjs-quote-admin-output",
      key: readerShareAdminPreviewKey,
      blob,
      size: blob.size,
      width: dims.width,
      height: dims.height,
    }, window.location.origin);
  } catch (_) {}
}

function showReaderShareRenderedBlob(blob, key) {
  if (!(blob instanceof Blob) || !key || getReaderShareBlobKey() !== key) return false;
  readerSharePreparedBlob = blob;
  readerSharePreparedBlobKey = key;

  if (readerShareUi?.renderImage) {
    const nextUrl = URL.createObjectURL(blob);
    revokeReaderSharePreviewUrl();
    readerSharePreviewUrl = nextUrl;
    readerSharePreviewKey = key;
    readerShareUi.renderImage.src = nextUrl;
    readerShareUi.renderImage.hidden = false;
    if (readerShareUi.renderLoading) readerShareUi.renderLoading.hidden = true;
    readerShareUi.card?.classList.remove("is-render-loading");
  }
  postReaderShareAdminOutputBlob(blob);
  if (readerShareUi && !readerShareUi.backdrop.hidden) updateReaderShareActionLabel();
  return true;
}

function scheduleReaderShareUnifiedRender(delay = 280) {
  window.clearTimeout(readerSharePrepareTimer);
  window.clearTimeout(readerSharePreviewTimer);
  window.clearTimeout(readerShareAdminOutputTimer);
  const key = getReaderShareBlobKey();

  if (readerSharePreparedBlob && readerSharePreparedBlobKey === key) {
    if (readerSharePreviewKey !== key || !readerSharePreviewUrl) {
      showReaderShareRenderedBlob(readerSharePreparedBlob, key);
    } else {
      readerShareUi?.card?.classList.remove("is-render-loading");
      if (readerShareUi?.renderLoading) readerShareUi.renderLoading.hidden = true;
      if (readerShareUi?.renderImage) readerShareUi.renderImage.hidden = false;
      postReaderShareAdminOutputBlob(readerSharePreparedBlob);
    }
    return;
  }
  if (readerSharePreparePromise && readerSharePreparePromiseKey === key) return;

  readerSharePrepareTimer = window.setTimeout(() => {
    const renderKey = getReaderShareBlobKey();
    if (readerSharePreparedBlob && readerSharePreparedBlobKey === renderKey) {
      showReaderShareRenderedBlob(readerSharePreparedBlob, renderKey);
      return;
    }
    if (readerSharePreparePromise && readerSharePreparePromiseKey === renderKey) return;

    const generation = ++readerSharePreviewGeneration;
    const promise = createReaderShareClipboardBlobPromise();
    readerSharePreparePromise = promise;
    readerSharePreviewPromise = promise;
    readerSharePreparePromiseKey = renderKey;
    promise.then((blob) => {
      if (generation !== readerSharePreviewGeneration) return;
      showReaderShareRenderedBlob(blob, renderKey);
    }).catch((error) => {
      console.warn("reader share image pre-render failed", error);
      if (generation !== readerSharePreviewGeneration) return;
      readerShareUi?.card?.classList.remove("is-render-loading");
      if (readerShareUi?.renderLoading) readerShareUi.renderLoading.hidden = true;
      if (readerShareUi?.renderImage) readerShareUi.renderImage.hidden = true;
    }).finally(() => {
      if (readerSharePreparePromise === promise) {
        readerSharePreparePromise = null;
        readerSharePreparePromiseKey = "";
      }
      if (readerSharePreviewPromise === promise) readerSharePreviewPromise = null;
    });
  }, Math.max(0, Number(delay) || 0));
}

function scheduleReaderShareBlobPreparation(delay = 280) {
  scheduleReaderShareUnifiedRender(delay);
}

function getPreparedReaderShareBlob() {
  return readerSharePreparedBlobKey === getReaderShareBlobKey()
    ? readerSharePreparedBlob
    : null;
}

function copyReaderShareImageToClipboard() {
  if (!window.isSecureContext || !navigator.clipboard?.write || !window.ClipboardItem) {
    throw new Error("clipboard_image_unsupported");
  }
  if (typeof ClipboardItem.supports === "function" && !ClipboardItem.supports("image/png")) {
    throw new Error("clipboard_image_unsupported");
  }

  // v7.77에서 실제 모바일 붙여넣기까지 검증됐던 경로를 그대로 사용한다.
  // 편집 중 PNG Blob을 미리 생성해 두고, 탭 순간에는 DOM/UI 상태를 건드리거나
  // 비동기 렌더링을 기다리지 않은 채 ClipboardItem 생성 -> write()를 즉시 시작한다.
  const blob = getPreparedReaderShareBlob();
  if (!blob) {
    scheduleReaderShareBlobPreparation(0);
    throw new Error("clipboard_image_preparing");
  }

  let item;
  try {
    item = new ClipboardItem({ "image/png": blob });
  } catch (error) {
    throw new Error("clipboard_image_unsupported", { cause: error });
  }
  return navigator.clipboard.write([item]);
}

function setReaderShareBusy(isBusy) {
  const ui = ensureReaderShareUi();
  for (const button of [ui.saveButton, ui.clipboardButton, ui.shareButton]) {
    if (button) button.disabled = isBusy;
  }
  if (isBusy) {
    if (ui.saveButton) ui.saveButton.textContent = "생성 중...";
    if (ui.clipboardButton) ui.clipboardButton.textContent = "생성 중...";
    if (ui.shareButton) ui.shareButton.textContent = "생성 중...";
  } else {
    updateReaderShareActionLabel();
  }
}

async function handleReaderShareExport(mode) {
  const ui = ensureReaderShareUi();
  if (!String(state.readerShareText || "").trim()) {
    window.alert("공유할 문구가 없습니다.");
    return;
  }

  setReaderShareBusy(true);
  try {
    const exportKey = getReaderShareBlobKey();
    const pending = readerSharePreparePromise && readerSharePreparePromiseKey === exportKey
      ? readerSharePreparePromise
      : null;
    const blob = getPreparedReaderShareBlob() || await (pending || createReaderShareClipboardBlobPromise());
    if (getReaderShareBlobKey() === exportKey) {
      showReaderShareRenderedBlob(blob, exportKey);
    }
    const filename = getReaderShareFilename();
    if (mode === "save") {
      downloadReaderShareBlob(blob, filename);
      return;
    }
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        files: [file],
        title: filename,
        text: getWorkShareText(getReaderShareSourceItem()) || `${getReaderShareSourceItem().title || "문장 이미지"}`,
      });
      return;
    }
    downloadReaderShareBlob(blob, filename);
    window.alert("이 기기에서는 시스템 공유를 지원하지 않아 이미지 파일을 저장했어요.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error("reader share export failed", error);
    const message = String(error?.message || "");
    if (message.includes("clipboard_image_preparing")) {
      window.alert("클립보드용 이미지를 준비 중입니다. 잠시 후 다시 눌러 주세요.");
    } else if (message.includes("clipboard_image_unsupported")) {
      window.alert("이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다. 이미지 저장 또는 공유하기를 이용해 주세요.");
    } else {
      window.alert("이미지를 생성하지 못했습니다. 다시 시도해 주세요.");
    }
  } finally {
    setReaderShareBusy(false);
  }
}

// v8.15: preview vertical placement no longer depends on JS overflow measurement.
// The inner quote span uses flex auto margins: it is centered while it fits,
// and auto margins collapse to 0 when it is taller than the box, naturally
// anchoring the first line at the top without timing/font-load races.

function postReaderShareAdminPreview(background) {
  if (!READER_SHARE_ADMIN_EMBED_MODE || window.parent === window) return;
  try {
    window.parent.postMessage({
      type: "rjs-quote-admin-preview",
      key: readerShareAdminPreviewKey || getReaderShareBackgroundKey(background),
      name: String(background?.name || ""),
      background: String(background?.background || ""),
      textColor: String(background?.text || "#fff"),
      ratio: state.readerShareRatio,
      font: state.readerShareFont,
    }, window.location.origin);
  } catch (_) {}
}

function revokeReaderSharePreviewUrl() {
  if (!readerSharePreviewUrl) return;
  try { URL.revokeObjectURL(readerSharePreviewUrl); } catch (_) {}
  readerSharePreviewUrl = "";
}

function updateReaderSharePreview() {
  ensureReaderShareState();
  const ui = ensureReaderShareUi();
  const background = READER_SHARE_BACKGROUNDS[state.readerShareBackground] || READER_SHARE_BACKGROUNDS[0];
  const item = getReaderShareSourceItem();
  const text = getReaderShareEditedText(state.readerShareText).slice(0, 700);
  const font = READER_SHARE_FONTS.find((entry) => entry.key === state.readerShareFont) || READER_SHARE_FONTS[0];
  const size = READER_SHARE_SIZES[state.readerShareSize] || READER_SHARE_SIZES.xs;
  const textColor = background.text;
  const metaColor = background.meta;

  ui.card.dataset.ratio = state.readerShareRatio;
  ui.card.style.backgroundImage = "none";
  ui.card.style.background = background.background;
  ui.card.style.color = textColor;
  ui.meta.style.color = metaColor;
  ui.brand.style.color = metaColor;
  ui.quoteText.textContent = text;
  ui.quote.style.fontFamily = font.css;
  const weightSetting = READER_SHARE_WEIGHTS[state.readerShareWeight] || READER_SHARE_WEIGHTS.regular;
  ui.quote.style.fontWeight = String(weightSetting.weight || font.weight || 400);
  ui.quote.style.lineHeight = "1.42";
  // Keep 1~5 as explicit visual size steps in preview.
  // The old long-text penalty collapsed 1/2/3 to the same minimum on mobile.
  const previewFontSize = size.px;
  ui.quote.style.fontSize = `${previewFontSize}px`;
  ui.quote.style.opacity = String(Number(weightSetting.opacity ?? 1));
  ui.quote.style.whiteSpace = state.readerShareAutoWrap ? "pre-wrap" : "pre";
  ui.quote.style.wordBreak = state.readerShareAutoWrap ? "keep-all" : "normal";
  ui.quote.style.overflowWrap = state.readerShareAutoWrap ? "break-word" : "normal";
  // Vertical placement is handled by CSS auto margins on the inner text span.
  // This keeps short text centered and anchors overflowing text to the top
  // without asynchronous overflow measurement.
  ui.meta.textContent = [item.title, item.author].filter(Boolean).join(" · ") || "제목 정보 없음";
  ui.brand.textContent = getReaderShareBrandName();

  ui.thumbs.querySelectorAll("[data-share-background]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.shareBackground) === state.readerShareBackground);
  });
  ui.backdrop.querySelectorAll("[data-share-ratio]").forEach((button) => {
    button.classList.toggle("active", button.dataset.shareRatio === state.readerShareRatio);
  });
  ui.backdrop.querySelectorAll("[data-share-font]").forEach((button) => {
    button.classList.toggle("active", button.dataset.shareFont === state.readerShareFont);
  });
  ui.backdrop.querySelectorAll("[data-share-weight]").forEach((button) => {
    const isLight = button.dataset.shareWeight === "light";
    button.disabled = isLight && !readerShareFontSupportsLight();
    button.classList.toggle("active", button.dataset.shareWeight === state.readerShareWeight);
    if (button.disabled) {
      button.setAttribute("aria-label", "이 글꼴은 얇게 굵기를 지원하지 않음");
      button.title = "이 글꼴은 얇게 굵기를 지원하지 않아요";
    } else {
      button.removeAttribute("aria-label");
      button.removeAttribute("title");
    }
  });
  ui.backdrop.querySelectorAll("[data-share-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.shareSize === state.readerShareSize);
  });
  ui.wrap.classList.toggle("active", state.readerShareAutoWrap);
  ui.wrap.setAttribute("aria-pressed", state.readerShareAutoWrap ? "true" : "false");
  if (ui.card) ui.card.classList.add("is-render-loading");
  if (ui.renderImage) ui.renderImage.hidden = true;
  if (ui.renderLoading) ui.renderLoading.hidden = false;
  postReaderShareAdminPreview(background);
  scheduleReaderShareUnifiedRender(READER_SHARE_ADMIN_EMBED_MODE ? 300 : 280);
  updateReaderShareActionLabel();
}

function resetReaderShareEditorOptions() {
  state.readerShareSize = "xs";        // 2
  state.readerShareWeight = "regular"; // 보통
  normalizeReaderShareWeightForFont();
}

function getHistoryStateWithoutReaderShare() {
  const next = { ...(history.state || {}) };
  delete next.rjsReaderShare;
  return next;
}

async function openReaderShareSheet(options = {}) {
  const { allowEmpty = false, presetText = null, sourceItem = null } = options || {};
  if (typeof presetText === "string") state.readerShareText = presetText;
  state.readerShareSourceItem = sourceItem || state.activeReaderItem || state.readerShareSourceItem || null;
  if (allowEmpty || state.readerShareSourceItem?.source === "postype") {
    state.readerShareLocation = null;
  }
  if (!allowEmpty && !state.readerShareText) return;
  // A newly opened editor always starts from the agreed baseline.
  resetReaderShareEditorOptions();
  ensureReaderShareState();
  await loadReaderSharePresetVisibility({ admin: Boolean(readerShareAdminPreviewKey) });
  const visibleEntries = getVisibleReaderShareBackgroundEntries();
  if (!visibleEntries.some(({ index }) => index === state.readerShareBackground)) {
    state.readerShareBackground = visibleEntries[0]?.index ?? 0;
  }
  const ui = ensureReaderShareUi();
  renderReaderShareBackgroundThumbs(ui.thumbs);
  ui.floatButton.hidden = true;
  if (ui.selectionActions) ui.selectionActions.hidden = true;
  try {
    const selection = window.getSelection?.();
    selection && selection.removeAllRanges && selection.removeAllRanges();
  } catch (_) {}
  try {
    document.activeElement && typeof document.activeElement.blur === "function" && document.activeElement.blur();
  } catch (_) {}
  ui.input.value = state.readerShareText;
  ui.input.placeholder = state.readerShareSourceItem?.source === "postype"
    ? "작품에서 저장하고 싶은 문장을 직접 입력해 보세요."
    : "문장을 직접 입력하거나 수정해 보세요.";
  ui.backdrop.hidden = false;
  if (!history.state?.rjsReaderShare) {
    history.pushState({ ...(history.state || {}), rjsReaderShare: true }, "", location.href);
  }
  updateReaderSharePreview();
  scheduleReaderShareBlobPreparation(0);
  updateReaderShareActionLabel();
  if (allowEmpty) {
    window.requestAnimationFrame(() => {
      try {
        ui.input.focus();
        const end = ui.input.value.length;
        ui.input.setSelectionRange(end, end);
      } catch (_) {}
    });
  }
}

// The iframe only enables gallery rendering after its administrator-only catalog request succeeds.
// Each requested image is generated through renderReaderShareCanvas(), exactly as in user export.
let readerShareAdminGalleryReady = false;
window.addEventListener("message", async (event) => {
  if (!READER_SHARE_ADMIN_GALLERY_MODE || !readerShareAdminGalleryReady || window.parent === window) return;
  if (event.source !== window.parent || event.origin !== window.location.origin) return;
  const data = event.data || {};
  if (data.type !== "rjs-quote-gallery-render") return;
  const key = String(data.key || "");
  const requestId = Number(data.requestId);
  const index = READER_SHARE_BACKGROUNDS.findIndex((background) => getReaderShareBackgroundKey(background) === key);
  if (!Number.isSafeInteger(requestId) || index < 0 || !readerSharePresetVisibility?.has(key)) return;
  try {
    state.readerShareBackground = index;
    state.readerShareRatio = "1:1";
    const canvas = await renderReaderShareCanvas();
    const full = data.full === true;
    let output = canvas;
    if (!full) {
      output = document.createElement("canvas");
      output.width = 280;
      output.height = 280;
      const ctx = output.getContext("2d");
      if (!ctx) throw new Error("gallery_canvas_context_unavailable");
      ctx.drawImage(canvas, 0, 0, 280, 280);
    }
    const blob = await new Promise((resolve, reject) => {
      output.toBlob((value) => value ? resolve(value) : reject(new Error("gallery_blob_failed")), "image/png");
    });
    window.parent.postMessage({ type: "rjs-quote-gallery-image", key, requestId, full, blob }, window.location.origin);
  } catch (error) {
    window.parent.postMessage({ type: "rjs-quote-gallery-image", key, requestId, full: data.full === true, error: "이미지 생성 실패" }, window.location.origin);
    console.warn("문장 이미지 관리자 갤러리 렌더 실패", error);
  }
});

async function maybeOpenAdminReaderSharePreview() {
  const key = String(new URLSearchParams(window.location.search).get("quote-test") || "").trim();
  if (!key) return;
  try {
    const map = await loadReaderSharePresetVisibility({ admin: true, force: true });
    const index = READER_SHARE_BACKGROUNDS.findIndex((background) => getReaderShareBackgroundKey(background) === key);
    if (index < 0 || !map.has(key)) return;
    readerShareAdminPreviewKey = key;
    readerSharePresetVisibility = map;
    state.readerShareBackground = index;
    if (READER_SHARE_ADMIN_EMBED_MODE) document.documentElement.classList.add("quote-admin-embed");
    if (READER_SHARE_ADMIN_GALLERY_MODE && window.parent !== window) {
      // Use the real user Canvas renderer for every gallery preview; no duplicate drawing implementation.
      state.readerShareText = "마음에 남은 문장을 이곳에서 미리 확인해 보세요.";
      state.readerShareSourceItem = { id: "admin-quote-preview", source: "postype", title: "문장 이미지 테스트", author: "관리자 미리보기" };
      state.readerShareRatio = "1:1";
      resetReaderShareEditorOptions();
      ensureReaderShareState();
      readerShareAdminGalleryReady = true;
      window.parent.postMessage({
        type: "rjs-quote-gallery-ready",
        presets: READER_SHARE_BACKGROUNDS.filter((background) => map.has(getReaderShareBackgroundKey(background)))
          .map((background) => ({
            key: getReaderShareBackgroundKey(background),
            background: String(background.background || ""),
            textColor: String(background.text || "#222"),
            metaColor: String(background.meta || "#777"),
          })),
      }, window.location.origin);
      return;
    }
    await openReaderShareSheet({
      allowEmpty: true,
      presetText: "마음에 남은 문장을 이곳에서 미리 확인해 보세요.",
      sourceItem: { id: "admin-quote-preview", source: "postype", title: "문장 이미지 테스트", author: "관리자 미리보기" },
    });
  } catch (error) {
    console.warn("관리자 문장 이미지 테스트를 열지 못했습니다.", error);
  }
}

function closeReaderShareUi({ fromHistory = false } = {}) {
  if (!readerShareUi) return;
  readerShareUi.floatButton.hidden = true;
  readerShareUi.close?.({ fromHistory });
}

window.addEventListener("popstate", (event) => {
  if (readerShareUi && !readerShareUi.backdrop.hidden && !event.state?.rjsReaderShare) {
    closeReaderShareUi({ fromHistory: true });
  }
});

function getReaderShareEditedText(rawText) {
  return String(rawText || "").replace(/\r\n?/g, "\n");
}

function normalizeReaderShareInitialText(rawText) {
  return String(rawText || "")
    .replace(/\r\n?|\u2028|\u2029/g, "\n")
    .replace(/\u00a0|\u3000/g, " ")
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
    .replace(/[\t\f\v]+/g, " ")
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trim())
    // 빈 줄은 개수와 상관없이 완전히 제거하고 실제 내용이 있는 줄만 남긴다.
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

function getTextOffsetWithinContainer(container, node, nodeOffset) {
  if (!container || !node) return null;
  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    range.setEnd(node, nodeOffset);
    const length = range.toString().length;
    range.detach?.();
    return length;
  } catch (_) {
    return null;
  }
}

function getReaderSelectionBoundaryOffset(node, nodeOffset) {
  if (!node || !state.activeReaderItem) return null;

  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const pageRoot = element?.closest?.("#readerPageText");
  if (pageRoot) {
    const local = getTextOffsetWithinContainer(pageRoot, node, nodeOffset);
    return local == null ? null : clampReaderTextOffset(state.readerPageStart + local);
  }

  const contentRoot = element?.closest?.("#readerContent");
  if (!contentRoot) return null;

  const chunk = element?.closest?.(".reader-virtual-chunk[data-reader-chunk-index]");
  if (chunk && Array.isArray(state.largeReaderChunks)) {
    const chunkIndex = Math.max(0, Number(chunk.dataset.readerChunkIndex || 0));
    const local = getTextOffsetWithinContainer(chunk, node, nodeOffset);
    if (local == null) return null;
    let base = 0;
    for (let index = 0; index < chunkIndex; index += 1) {
      base += String(state.largeReaderChunks[index] || "").length;
    }
    return clampReaderTextOffset(base + local);
  }

  const local = getTextOffsetWithinContainer(contentRoot, node, nodeOffset);
  return local == null ? null : clampReaderTextOffset(local);
}

function getReaderSelectionLocation(range) {
  if (!range || !state.activeReaderItem || state.activeReaderItem.source === "postype") return null;
  const startOffset = getReaderSelectionBoundaryOffset(range.startContainer, range.startOffset);
  const endOffset = getReaderSelectionBoundaryOffset(range.endContainer, range.endOffset);
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return null;

  const safeStart = Math.min(startOffset, endOffset);
  const safeEnd = Math.max(startOffset, endOffset);
  return {
    workId: String(state.activeReaderItem.id || ""),
    startOffset: safeStart,
    endOffset: safeEnd,
    sourceText: String(range.toString() || "").slice(0, 1200),
  };
}

function getReaderTextSelection(options = {}) {
  if (els.readerOverlay?.hidden || !state.activeReaderItem) return null;
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const text = normalizeReaderShareInitialText(selection.toString()).slice(0, 700);
  if (!text) return null;

  const range = selection.getRangeAt(0);
  const common = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const allowed = common?.closest?.("#readerContent, #readerPageText");
  if (!allowed) return null;

  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  const rect = rects.at(-1) || range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return null;

  return {
    text,
    rect,
    // Computing TXT offsets walks/serializes DOM text and is much heavier than
    // the native selection geometry. Keep drag feedback lightweight and only
    // resolve offsets when the user actually chooses share/memo.
    location: options.includeLocation ? getReaderSelectionLocation(range) : null,
  };
}

function syncReaderShareSelection() {
  window.clearTimeout(readerShareSelectionTimer);
  const isTouchLike = window.matchMedia?.("(pointer: coarse)")?.matches;
  readerShareSelectionTimer = window.setTimeout(() => {
    const ui = ensureReaderShareUi();
    if (!ui.backdrop.hidden) return;

    const selected = getReaderTextSelection();
    if (!selected) {
      ui.floatButton.hidden = true;
      if (ui.selectionActions) ui.selectionActions.hidden = true;
      state.readerShareLocation = null;
      return;
    }

    state.readerShareText = selected.text;
    state.readerShareLocation = null;
    // Selection dragging must stay lightweight. The full 1200px Canvas PNG is
    // prepared only after the user actually opens the 문장 이미지 editor.
    const margin = 24;
    const buttonSize = 38;
    let x;
    let y;

    if (isTouchLike) {
      // Android/iOS selection handles extend below the text selection. Keep the
      // custom share button away from both end handles by centering it on the
      // last selected line and leaving a generous vertical clearance.
      const handleClearance = 54;
      const preferredX = selected.rect.left + (selected.rect.width / 2);
      x = Math.min(
        window.innerWidth - margin,
        Math.max(margin, preferredX)
      );
      const belowY = selected.rect.bottom + handleClearance;
      const aboveY = selected.rect.top - buttonSize - handleClearance;
      const hasRoomBelow = belowY + buttonSize + 12 < window.innerHeight;
      y = hasRoomBelow ? belowY : Math.max(54, aboveY);
    } else {
      const preferredX = selected.rect.right + (buttonSize * 0.42);
      x = Math.min(
        window.innerWidth - margin,
        Math.max(margin, preferredX)
      );
      const belowY = selected.rect.bottom + 8;
      const aboveY = selected.rect.top - buttonSize - 8;
      const hasRoomBelow = belowY + buttonSize + 8 < window.innerHeight;
      y = hasRoomBelow ? belowY : Math.max(54, aboveY);
    }

    if (ui.selectionActions) { ui.selectionActions.style.left = `${x}px`; ui.selectionActions.style.top = `${y}px`; ui.selectionActions.hidden = false; }
    ui.floatButton.hidden = false;
  }, isTouchLike ? 150 : 55);
}

function initReaderShareSelection() {
  ensureReaderShareUi();
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  let mobileGestureActive = false;
  let mobileSelectionSettledTimer = 0;

  const hideSelectionActions = () => {
    window.clearTimeout(readerShareSelectionTimer);
    window.clearTimeout(mobileSelectionSettledTimer);
    if (!readerShareUi) return;
    readerShareUi.floatButton.hidden = true;
    if (readerShareUi.selectionActions) readerShareUi.selectionActions.hidden = true;
  };

  // Native handles are owned by the browser/WebView. Avoid Range geometry
  // reads while a finger is down, but recover if the platform finishes its
  // Selection update after touchend/pointerup (common with long-press selection).
  document.addEventListener("selectionchange", () => {
    if (els.readerOverlay?.hidden) return;
    if (!coarsePointer) {
      syncReaderShareSelection();
      return;
    }
    window.clearTimeout(mobileSelectionSettledTimer);
    if (mobileGestureActive) return;
    mobileSelectionSettledTimer = window.setTimeout(() => {
      mobileSelectionSettledTimer = 0;
      if (!mobileGestureActive && !els.readerOverlay?.hidden) syncReaderShareSelection();
    }, 80);
  });

  const startMobileSelectionGesture = () => {
    if (coarsePointer) mobileGestureActive = true;
    hideSelectionActions();
  };
  els.readerPanel?.addEventListener("pointerdown", startMobileSelectionGesture, { passive: true });
  // Some WebViews deliver legacy touch events without PointerEvents.
  els.readerPanel?.addEventListener("touchstart", startMobileSelectionGesture, { passive: true });

  const finishMobileSelectionGesture = () => {
    if (!mobileGestureActive || !coarsePointer) return;
    mobileGestureActive = false;
    window.clearTimeout(readerShareSelectionTimer);
    readerShareSelectionTimer = window.setTimeout(syncReaderShareSelection, 65);
  };

  // Native selection-handle drags can finish outside the reader element.
  document.addEventListener("pointerup", finishMobileSelectionGesture, { passive: true });
  document.addEventListener("pointercancel", finishMobileSelectionGesture, { passive: true });
  els.readerPanel?.addEventListener("touchend", finishMobileSelectionGesture, { passive: true });
  els.readerPanel?.addEventListener("touchcancel", finishMobileSelectionGesture, { passive: true });
  els.readerPanel?.addEventListener("pointerup", () => {
    if (!coarsePointer) syncReaderShareSelection();
  }, { passive: true });
  els.readerPanel?.addEventListener("scroll", hideSelectionActions, { passive: true });
}


function updatePageScrollTopButton() {
  if (!els.pageScrollTop) return;

  const shouldShow =
    !document.body.classList.contains("reader-open") &&
    window.scrollY > 420;

  els.pageScrollTop.classList.toggle("visible", shouldShow);
}

window.addEventListener("scroll", () => {
  updatePageScrollTopButton();
  updateCompactHeader();
}, {
  passive: true,
});

els.pageScrollTop?.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});


async function loadPublicVersion() {
  if (!els.publicVersion) return null;

  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`version fetch failed: ${response.status}`);

    const data = await response.json();
    const version = String(data?.version || "").trim();
    if (!version) throw new Error("version is empty");

    els.publicVersion.textContent = `v${version}`;
    return version;
  } catch (error) {
    console.warn("사용자 버전 확인 실패", error);
    return null;
  }
}

function getIssueReportText() {
  const activeItem = state.activeReaderItem;
  const activeEntry = activeItem ? getUserLibraryEntry(activeItem.id) : null;
  const version = String(els.publicVersion?.textContent || "unknown").trim();
  const platform = String(
    navigator.userAgentData?.platform || navigator.platform || "unknown"
  );
  const viewport = `${window.innerWidth}x${window.innerHeight}`;
  const screenSize = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const dpr = Number(window.devicePixelRatio || 1);
  const page = `${window.location.pathname}${window.location.search}`;
  const progress = activeEntry?.progressPercent == null
    ? "-"
    : `${Number(activeEntry.progressPercent).toFixed(1)}%`;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const connectionInfo = connection
    ? `${connection.effectiveType || "-"} / downlink=${Number.isFinite(connection.downlink) ? `${connection.downlink}Mbps` : "-"} / saveData=${connection.saveData ? "예" : "아니오"}`
    : "확인 불가";
  const readerMode = state.readerDisplayMode === "page" ? "페이지" : "스크롤";
  const readerSettings = `테마=${getSavedTheme()}, 글씨=${getSavedReaderFontSize()}, 줄간격=${getSavedReaderSpacing()}, 좌우여백=${getSavedReaderSideMargin()}, 폰트=${getSavedReaderFontFamily()}`;

  return [
    `[셩냥책 문제 신고 정보]`,
    `버전: ${version}`,
    `시간: ${new Date().toLocaleString("ko-KR")}`,
    `온라인: ${navigator.onLine ? "예" : "아니오"}`,
    `로그인: ${state.user ? "예" : "아니오"}`,
    `인증 저장: local=${localStorage.getItem(AUTH_TOKEN_KEY) ? "있음" : "없음"} / session=${sessionStorage.getItem(AUTH_TOKEN_KEY) ? "있음" : "없음"} / jsCookie=${getAuthCookieToken() ? "있음" : "없음"} / serverCookie=HttpOnly(직접확인불가)`,
    `접속 호스트: ${window.location.host || "-"}`,
    `페이지: ${page}`,
    `화면: viewport ${viewport} / screen ${screenSize} / DPR ${dpr}`,
    `플랫폼: ${platform}`,
    `브라우저 UA: ${navigator.userAgent}`,
    `문서 상태: visibility=${document.visibilityState} / focus=${document.hasFocus() ? "있음" : "없음"}`,
    `네트워크 정보: ${connectionInfo}`,
    `뷰어 설정: 모드=${readerMode} / ${readerSettings}`,
    `보기: ${state.view} / 정렬: ${state.sort}`,
    `필터: CP=${state.combination}, 형태=${state.contentType}, 상태=${state.statusFilter}, 출처=${state.source}`,
    `검색어: ${state.search || "-"}`,
    activeItem
      ? `열린 작품: ${activeItem.title || "제목 미상"} / ID=${activeItem.id} / 출처=${activeItem.source || "drive"} / 진도=${progress}`
      : "열린 작품: 없음",
  ].join("\n");
}

// v10.13 — 작품 ID만으로 생성하는 링크. 위치·페이지·진행률 값은 포함하지 않는다.
const SHARED_WORK_WEB_ORIGIN = "https://rjs-cj6.pages.dev";
const incomingSharedWorkId = (() => {
  const id = new URLSearchParams(window.location.search).get("work") || "";
  return id.length <= 256 ? id : "";
})();
let incomingSharedWorkHandled = false;
let incomingSharedWorkItem = null;

function getWorkShareUrl(item) {
  const id = String(item?.id ?? "").trim();
  if (!id || id.length > 256) return "";
  // 외부에 공유할 수 있는 공개 인덱스에 있는 작품만 링크를 발행한다.
  if (!state.items.some((candidate) => String(candidate.id) === id)) return "";
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const liveWeb = (protocol === "https:" || protocol === "http:")
    && host !== "localhost" && host !== "127.0.0.1";
  const url = new URL("/", liveWeb ? window.location.origin : SHARED_WORK_WEB_ORIGIN);
  url.searchParams.set("work", id);
  return url.href;
}

function getWorkShareText(item) {
  const url = getWorkShareUrl(item);
  if (!url) return "";
  return `${String(item.title || "제목 미상")} • ${String(item.author || "작가 미상")}\n📎${url}`;
}

async function copyWorkShareLink(item, button) {
  const url = getWorkShareUrl(item);
  if (!url) { window.alert("공유할 수 있는 작품 링크를 찾지 못했습니다."); return; }
  try {
    await copyTextToClipboard(url);
    if (button) flashButtonLabel(button, "링크 복사 완료");
    else window.alert("작품 링크를 복사했어요.");
  } catch (error) {
    console.warn("작품 링크 복사 실패", error);
    window.alert("링크 복사에 실패했습니다. 다시 시도해 주세요.");
  }
}

async function shareWorkLink(item) {
  const text = getWorkShareText(item);
  if (!text) { window.alert("공유할 수 있는 작품 링크를 찾지 못했습니다."); return; }
  if (typeof navigator.share === "function") {
    try { await navigator.share({ title: `${item.title || "제목 미상"} • ${item.author || "작가 미상"}`, text }); }
    catch (error) { if (error?.name !== "AbortError") window.alert("작품 공유에 실패했습니다. 링크 복사를 이용해 주세요."); }
  } else {
    try {
      await copyTextToClipboard(text);
      window.alert("이 기기에서는 시스템 공유를 지원하지 않아 작품 정보와 링크를 복사했어요.");
    } catch (error) {
      console.warn("작품 공유 텍스트 복사 실패", error);
      window.alert("공유 내용 복사에 실패했습니다. 작품 링크 복사를 이용해 주세요.");
    }
  }
}

function closeReaderWorkShareMenu() {
  if (els.readerWorkShareMenu) els.readerWorkShareMenu.hidden = true;
  els.readerWorkShareButton?.setAttribute("aria-expanded", "false");
  if (els.readerMoreMenu) els.readerMoreMenu.hidden = true;
  els.readerMoreButton?.setAttribute("aria-expanded", "false");
}

function showIncomingSharedWork() {
  if (incomingSharedWorkHandled || !incomingSharedWorkId || !els.sharedWorkModal) return;
  incomingSharedWorkHandled = true;
  // The link is a one-time navigation hint, not a durable page state.
  // Consume it before openModal pushes its history entry so reload/back won't reopen it.
  const cleanUrl = new URL(window.location.href);
  if (cleanUrl.searchParams.has("work")) {
    cleanUrl.searchParams.delete("work");
    history.replaceState(history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }
  incomingSharedWorkItem = state.items.find((item) => String(item.id) === incomingSharedWorkId) || null;
  const item = incomingSharedWorkItem;
  els.sharedWorkTitle.textContent = item?.title || "작품을 찾을 수 없어요";
  els.sharedWorkAuthor.textContent = item?.author || "";
  els.sharedWorkStatus.textContent = item
    ? "공유받은 작품이에요. ‘작품 열기’를 눌러 읽을 수 있어요. 기존 이어보기 위치는 각자 유지됩니다."
    : "삭제되었거나 현재 목록에 없는 작품이에요. 작품 ID가 다른 작품을 대신 열지는 않습니다.";
  els.sharedWorkOpenButton.hidden = !item;
  els.sharedWorkOpenButton.textContent = item?.source === "postype" ? "원문 열기" : "작품 열기";
  // 공유 URL만 방문하는 동안에는 openReader/recordRecentView/persistProgress를 호출하지 않는다.
  openModal(els.sharedWorkModal);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Clipboard API can be blocked by browser/profile permissions even on HTTPS.
      // Fall through to the legacy copy path instead of reporting an immediate failure.
      console.warn("Clipboard API 복사 실패, fallback 사용", error);
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("clipboard copy failed");
}

function flashButtonLabel(button, label, duration = 1600) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = label;
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, duration);
}

async function copyIssueReportInfo(button = els.copyIssueInfoButton) {
  try {
    await copyTextToClipboard(getIssueReportText());
    flashButtonLabel(button, "복사 완료 ✓");
  } catch (error) {
    console.error("문제 신고 정보 복사 실패", error);
    flashButtonLabel(button, "복사 실패");
  }
}

function updateNetworkStatus() {
  if (!els.networkStatusBanner) return;
  els.networkStatusBanner.hidden = navigator.onLine;
  document.documentElement.classList.toggle("is-offline", !navigator.onLine);
}

function isStandaloneWebApp() {
  const displayModeStandalone = Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );
  const iosStandalone = window.navigator.standalone === true;
  return displayModeStandalone || iosStandalone;
}

function syncAppInstallHelpVisibility() {
  const standalone = isStandaloneWebApp();
  if (els.appInstallHelpPoint) els.appInstallHelpPoint.hidden = standalone;
  if (els.appInstallHelpSection) els.appInstallHelpSection.hidden = standalone;
  document.documentElement.classList.toggle("standalone-webapp", standalone);
}

// Android 앱 시스템 뒤로가기
const capacitorAppPlugin = window.Capacitor?.Plugins?.App;

if (capacitorAppPlugin?.addListener) {
  capacitorAppPlugin.addListener("backButton", () => {
    // Close the top-most in-reader UI first. Reader-share/simple-modal states
    // can carry rjsReaderOpen as well because they are pushed on top of it.
    if (history.state?.rjsReaderShare || history.state?.rjsSimpleModal) {
      history.back();
      return;
    }

    // A reader close is visually expected to be immediate. Waiting for the
    // asynchronous history pop can feel like the Android back press was lost,
    // especially while native text-selection handles are active. Finalize the
    // reader first, then pop its history entry. The subsequent popstate sees
    // an already-closed reader and is therefore a no-op.
    if (history.state?.rjsReaderOpen && !els.readerOverlay?.hidden && state.activeReaderItem) {
      finalizeReaderClose();
      history.back();
      return;
    }

    if (history.state?.rjsProfilePage || history.state?.rjsQuoteFeedPage) {
      history.back();
      return;
    }

    capacitorAppPlugin.minimizeApp();
  });
}

if (history.state?.rjsReaderOpen) {
  history.replaceState(
    {
      ...(history.state || {}),
      rjsReaderOpen: false,
    },
    "",
    window.location.href
  );
}
state.readerHistoryActive = false;

if (READER_SHARE_ADMIN_EMBED_MODE) {
  document.documentElement.classList.add("quote-admin-embed");
  applyUserPreferences();
  loadPublicVersion();
  void maybeOpenAdminReaderSharePreview();
} else {
  initAnalyticsSession();
  window.addEventListener("load", recordAnalyticsPageLoad, { once: true });
  document.addEventListener("visibilitychange", () => {
    accrueAnalyticsVisibleTime();
    persistAnalyticsSession();
  });
  window.addEventListener("pagehide", () => {
    flushAnalyticsSession({ beacon: true, keepalive: true });
  });

  initReaderShareSelection();
  applyUserPreferences();
  loadPublicVersion();
  updateNetworkStatus();
  syncAppInstallHelpVisibility();
  window.addEventListener("online", () => {
    updateNetworkStatus();
    if (state.authRestoreRetryNeeded) {
      state.authRestoreRetryCount = 0;
      restoreAuth();
    }
  });
  window.addEventListener("offline", updateNetworkStatus);
  updatePageScrollTopButton();
  updateCompactHeader();
  syncViewButtons();
  syncQuickFilterButtons();
  // 저장된 로그인 토큰이 있으면 bootstrap 복원이 끝날 때까지 비로그인 UI를 노출하지 않는다.
  // updateAccountUi()는 auth-session-pending을 해제하므로 토큰이 없는 경우에만 초기 호출한다.
  if (!getAuthToken()) updateAccountUi();
  loadArchive();
  restoreAuth();
  void maybeOpenAdminReaderSharePreview();
}
