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
  readerHistoryActive: false,
  user: null,
  userLibrary: new Map(),
  userLikes: new Map(),
  savedQuotes: [],
  savedQuoteCount: null,
  savedQuotesLoaded: false,
  savedQuotesLoading: false,
  savedQuotesError: false,
  quoteFeedItems: [],
  quoteFeedNextCursor: null,
  quoteFeedLoading: false,
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
const READER_FONT_FAMILIES = {
  default: 'Pretendard, "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
  paperlogy: 'Paperozi, Pretendard, "Noto Sans KR", sans-serif',
  ridibatang: 'Ridibatang, "Noto Serif KR", "Nanum Myeongjo", serif',
  chosunilbo: 'ChosunIlboMyungjo, "Noto Serif KR", "Nanum Myeongjo", serif',
  inkliquid: 'InkLiquid, cursive',
  kopubbatang: '"KoPub Batang", "Noto Serif KR", "Nanum Myeongjo", serif',
};

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
  return Object.prototype.hasOwnProperty.call(READER_FONT_FAMILIES, value)
    ? value
    : "ridibatang";
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
  root.style.setProperty("--reader-font-family", READER_FONT_FAMILIES[fontFamily] || READER_FONT_FAMILIES.default);

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

  if (els.viewerSettingsScopeText) {
    els.viewerSettingsScopeText.textContent = state.user
      ? "로그인 상태에서는 이 브라우저에 설정값이 유지됩니다."
      : "비회원 설정은 현재 브라우저 세션에서만 유지됩니다.";
  }

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
  quoteFeedModal: document.getElementById("quoteFeedModal"),
  quoteFeedModalPreview: document.getElementById("quoteFeedModalPreview"),
  quoteFeedModalText: document.getElementById("quoteFeedModalText"),
  quoteFeedModalTitle: document.getElementById("quoteFeedModalTitle"),
  quoteFeedModalAuthor: document.getElementById("quoteFeedModalAuthor"),
  quoteFeedModalDate: document.getElementById("quoteFeedModalDate"),
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
  readerLoadingTitle: document.getElementById("readerLoadingTitle"),
  readerLoadingText: document.getElementById("readerLoadingText"),
  readerProgressBar: document.getElementById("readerProgressBar"),
  readerProgressLabel: document.getElementById("readerProgressLabel"),
  readerScrollTop: document.getElementById("readerScrollTop"),
  viewerSettingsButton: document.getElementById("viewerSettingsButton"),
  bookmarkLibraryButton: document.getElementById("bookmarkLibraryButton"),
  recentLibraryButton: document.getElementById("recentLibraryButton"),
  helpButton: document.getElementById("helpButton"),
  signupButton: document.getElementById("signupButton"),
  loginButton: document.getElementById("loginButton"),
  readerBookmarkButton: document.getElementById("readerBookmarkButton"),
  readerLikeButton: document.getElementById("readerLikeButton"),
  readerDownloadButton: document.getElementById("readerDownloadButton"),
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
  feedbackModal: document.getElementById("feedbackModal"),
  feedbackForm: document.getElementById("feedbackForm"),
  feedbackCategory: document.getElementById("feedbackCategory"),
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
  viewerSettingsScopeText: document.getElementById("viewerSettingsScopeText"),
  accountModal: document.getElementById("accountModal"),
  accountModalUser: document.getElementById("accountModalUser"),
  darkModeToggle: document.getElementById("darkModeToggle"),
  readerSpacingButtons: Array.from(document.querySelectorAll("[data-reader-spacing]")),
  readerFontSizeButtons: Array.from(document.querySelectorAll("[data-reader-font-size]")),
  readerFontFamilyButtons: Array.from(document.querySelectorAll("[data-reader-font-family]")),
  logoutButton: document.getElementById("logoutButton"),
};


const AUTH_TOKEN_KEY = "rjsBookAuthTokenV1";
const AUTH_COOKIE_KEY = "rjsBookAuthRememberV1";
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

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
    || sessionStorage.getItem(AUTH_TOKEN_KEY)
    || getAuthCookieToken()
    || "";
}

function setAuthToken(token, remember = true) {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  setAuthCookieToken("");

  if (!token) return;

  if (remember) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setAuthCookieToken(token);
    return;
  }

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
    throw new Error(data?.error || "요청을 처리하지 못했습니다.");
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
  state.profileUserCreatedAt = null;
  state.profileOpen = false;
  state.remoteProgressState = new Map();
  state.remoteProgressSyncedAt = new Map();
  state.progressSavePending = new Map();
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
  return {
    id: Number(row?.id || 0),
    title: String(row?.title || ""),
    author: String(row?.author || ""),
    quoteText: String(row?.quote_text ?? row?.quoteText ?? ""),
    createdAt: Number(row?.created_at ?? row?.createdAt ?? 0),
    shared,
    sharedAt: row?.shared_at == null && row?.sharedAt == null ? null : Number(row?.shared_at ?? row?.sharedAt),
    _persistedShared: shared,
    _shareSaving: false,
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
    const quoteCount = state.savedQuotesLoaded
      ? quotes.length
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
  return {
    quoteId: Number(row?.quote_id ?? row?.quoteId ?? 0),
    workId: String(row?.work_id ?? row?.workId ?? ""),
    title: String(row?.title || ""),
    author: String(row?.author || ""),
    quoteText: String(row?.quote_text ?? row?.quoteText ?? ""),
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
    const direct = state.items.find((candidate) => candidate.id === item.workId);
    if (direct) return direct;
  }
  const title = normalizeSearchText(item.title);
  const author = normalizeSearchText(item.author);
  if (!title) return null;
  return state.items.find((candidate) =>
    normalizeSearchText(candidate.title) === title &&
    (!author || normalizeSearchText(candidate.author) === author)
  ) || null;
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
    els.quoteFeedGrid.innerHTML = items.map((item) => {
      const theme = getQuoteFeedTheme(item);
      const sizes = getQuoteFeedCardSizes(item.quoteText);
      const saving = state.quoteFeedLikeSaving.has(String(item.quoteId));
      return `
        <article class="quote-feed-card"
          style="--quote-bg:${theme.background};--quote-color:${theme.text};--quote-size:${sizes.desktop}px;--quote-mobile-size:${sizes.mobile}px">
          <button type="button" class="quote-feed-card-open" data-quote-feed-id="${item.quoteId}" aria-label="문장 자세히 보기">
            <span class="quote-feed-card-inner">
              <span class="quote-feed-card-copy"><span class="quote-feed-card-text">${escapeHtml(item.quoteText)}</span></span>
              <span class="quote-feed-card-source">
                <strong>${escapeHtml(item.title || "제목 미상")}</strong>
                <span>${escapeHtml(item.author || "작성자 미상")}</span>
              </span>
            </span>
          </button>
          <button type="button" class="quote-feed-like-button${item.liked ? " is-liked" : ""}" data-quote-feed-like="${item.quoteId}" aria-pressed="${item.liked ? "true" : "false"}" ${saving ? "disabled" : ""}>
            <span aria-hidden="true">${item.liked ? "♥" : "♡"}</span><b>${item.likeCount}</b>
          </button>
        </article>`;
    }).join("");
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
    els.quoteFeedMoreButton.textContent = state.quoteFeedLoading ? "불러오는 중…" : "문장 더보기";
  }
}

async function loadQuoteFeed({ append = false } = {}) {
  if (state.quoteFeedLoading) return;
  if (append && !state.quoteFeedNextCursor) return;
  state.quoteFeedLoading = true;
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
    if (els.quoteFeedStatus) {
      els.quoteFeedStatus.hidden = false;
      els.quoteFeedStatus.textContent = "문장 피드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
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
  state.profileTab = ["bookmarks","recent","likes","quotes"].includes(tab) ? tab : "bookmarks";
  state.profileSearch = "";
  state.profileVisibleLimit = 15;
  setMobileFiltersOpen(false);
  if (els.profileSearchInput) els.profileSearchInput.value = "";
  for (const el of [els.heroSection, document.querySelector(".controls"), document.querySelector(".content-section")]) {
    if (el) el.hidden = true;
  }
  els.profilePage.hidden = false;
  renderProfilePage();
  if (state.profileTab === "quotes" && !state.savedQuotesLoaded) {
    loadSavedQuotes();
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
  const data = await userApi("/api/user/profile", {
    method: "POST",
    body: JSON.stringify({
      action: "quote_save",
      title: item.title || "",
      author: item.author || "",
      quoteText,
    }),
  });
  const savedQuote = data.quote ? normalizeSavedQuote(data.quote) : null;
  if (savedQuote) {
    if (state.savedQuotesLoaded) {
      state.savedQuotes.unshift(savedQuote);
      state.savedQuoteCount = state.savedQuotes.length;
    } else {
      state.savedQuoteCount = Math.max(0, Number(state.savedQuoteCount || 0)) + 1;
    }
  }
  if (state.profileOpen) renderProfilePage();
  return savedQuote;
}

async function restoreAuth() {
  const token = getAuthToken();
  if (!token) {
    applyUserPreferences();
    updateAccountUi();
    return;
  }

  try {
    // 로그인 첫 화면에 필요한 개인화 데이터를 한 번의 요청으로 복원한다.
    // 기존 /auth/me + /user/library + /user/profile + /user/visit 호출을
    // 합쳐 Functions/D1 세션 조회 중복을 줄인다.
    const data = await userApi("/api/user/bootstrap", {
      method: "POST",
      body: "{}",
    });
    state.user = data.user;
    applyUserPreferences();
    updateAccountUi();
    applyUserLibraryRows(data.items || []);
    applyUserProfileData(data);
    if (data.visitRecorded !== false) {
      state.visitRecordedUserId = state.user?.userId || "";
    }
  } catch {
    clearUserSession(true);
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

  // The server-side recent-view write is folded into /api/content so opening
  // one work does not create a second Functions round trip. Keep the local
  // timestamp immediate so recent-item UI still updates without waiting.
  updateUserLibraryEntry(item.id, { viewedAt: Date.now() });
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

  if (settings.eyebrow) els.heroEyebrow.textContent = settings.eyebrow;
  if (settings.title) els.heroTitle.textContent = settings.title;

  els.heroSection?.classList.remove("hero-settings-pending");
  els.heroSection?.classList.add("hero-settings-ready");
}

async function loadArchive(force = false) {
  showStatus("저장된 콘텐츠 목록을 불러오고 있어요.");
  els.resultCount.textContent = "불러오는 중…";

  try {
    const url = force ? `/api/archive?t=${Date.now()}` : "/api/archive";
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
          type="button" data-combination="${escapeHtml(value)}">${escapeHtml(value)}</button>`
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

function normalizeSortValue(value) {
  if (value === "latest") return "registered";
  return ["title", "author", "registered", "published", "bookmarks"].includes(value)
    ? value
    : "title";
}

function syncSourceFilterChips() {
  els.sourceFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.source === state.source);
  });
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
  return Date.parse(
    item?.latestPublishedDate ||
    item?.publishedDate ||
    item?.publishedAt ||
    item?.updatedAt ||
    item?.createdAt ||
    ""
  ) || 0;
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
  const collator = new Intl.Collator("ko", {
    sensitivity: "base",
    numeric: true,
  });

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

  els.combinationFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.combination === "전체");
  });

  els.contentTypeFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.contentType === "전체");
  });

  els.statusFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.statusFilter === "전체");
  });

  els.sourceFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.source === "전체");
  });

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
  if (state.view === "card") parts.push("카드형");

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

    const haystack = normalizeSearchText(
      `${item.title || ""} ${item.author || ""} ${item.fileName || ""} ` +
      `${item.combination || ""} ${item.subCp1 || ""} ${item.subCp2 || ""} ` +
      `${item.genre || ""} ${item.status || ""}`
    );

    const matchesSearch =
      tokens.length === 0 || tokens.every((token) => haystack.includes(token));

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
    return `<span class="reading-state-badge progress">${percent}%</span>`;
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

  const previousTimer = state.bookmarkSaveTimers.get(fileId);
  if (previousTimer) window.clearTimeout(previousTimer);

  const timer = window.setTimeout(async () => {
    state.bookmarkSaveTimers.delete(fileId);
    const finalValue = Boolean(getUserLibraryEntry(fileId)?.bookmarked);

    try {
      const data = await userApi("/api/user/item", {
        method: "POST",
        body: JSON.stringify({
          action: "bookmark",
          fileId,
          bookmarked: finalValue,
        }),
      });
      applyBookmarkCountResponse(fileId, data);
    } catch (error) {
      console.warn("포스타입 북마크 저장 실패", error);
    }
  }, 300);

  state.bookmarkSaveTimers.set(fileId, timer);
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

  const previousTimer = state.bookmarkSaveTimers.get(fileId);
  if (previousTimer) window.clearTimeout(previousTimer);
  const timer = window.setTimeout(async () => {
    state.bookmarkSaveTimers.delete(fileId);
    const finalValue = Boolean(getUserLibraryEntry(fileId)?.bookmarked);
    try {
      const data = await userApi("/api/user/item", {
        method: "POST",
        body: JSON.stringify({
          action: "bookmark",
          fileId,
          bookmarked: finalValue,
        }),
      });
      applyBookmarkCountResponse(fileId, data);
    } catch (error) {
      console.warn("북마크 저장 실패", error);
    }
  }, 300);
  state.bookmarkSaveTimers.set(fileId, timer);
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
        ${downloadUrl ? `<a role="menuitem" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer" data-download-id="${escapeHtml(item.id)}">TXT</a>` : ""}
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

function renderCards(items) {
  els.contentGrid.innerHTML = items.map((item) => `
    <article class="content-card ${item.source === "postype" ? "postype-item" : "drive-item"}"
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
      class="${item.source === "postype" ? "postype-item" : "drive-item"}">
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
  els.readerPageMeasure.textContent = text || " ";

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
    els.readerPageStatus.textContent =
      end >= length
        ? "100%"
        : `${getReaderProgressDisplayPercent(percent)}%`;
  }
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

  els.readerPageText.textContent =
    String(state.readerText).slice(safeStart, end);

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

  const pageActive = nextMode === "page";
  els.readerPanel.classList.toggle(
    "reader-page-mode",
    pageActive
  );

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

  await nextFrame();

  if (previousMode === "page" || Number.isFinite(options.offset)) {
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
  }
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

function showReaderLoading(item) {
  const isLarge = isLargeReaderFile(item);
  resetLargeReaderState();
  resetReaderPageState();
  state.readerText = "";
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
      await nextFrame();
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
  section.appendChild(document.createTextNode(text));
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

function getReaderChunkTextNode(section) {
  if (!section) return null;

  for (const node of section.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) return node;
  }

  return null;
}

function getReaderChunkTextY(section, charOffset) {
  const textNode = getReaderChunkTextNode(section);
  if (!textNode) return null;

  const length = textNode.data.length;
  const safeOffset = Math.max(0, Math.min(length, Math.floor(Number(charOffset) || 0)));
  const range = document.createRange();

  try {
    if (length <= 0) {
      const rect = section.getBoundingClientRect();
      return rect.top;
    }

    // A one-character range gives a stable line box in Chromium/WebKit.
    // At EOF use the final character because a collapsed range can report
    // an empty rect on some mobile Safari builds.
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
      const desiredViewportY = panelRect.top + margin;
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
      const tolerance = Math.max(26, panel.clientHeight * 0.03);
      reached = Math.abs(
        targetRect.top - (panelRect.top + margin)
      ) <= tolerance;
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
    const textNode = getReaderChunkTextNode(section);
    if (!textNode) return false;

    const charOffset = Math.round(
      (textNode.data?.length || 0) * Math.max(0, Math.min(1, Number(position.ratio) || 0))
    );

    return scrollReaderTextNodeIntoView(textNode, charOffset, options);
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
  const textNode = getReaderChunkTextNode(section);
  if (!textNode) return 0;

  const length = textNode.data.length;
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
  const textNode = getReaderChunkTextNode(section);
  const length = textNode?.data?.length || 0;
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
  const textNode = getReaderChunkTextNode(current);
  const chunkLength = textNode?.data?.length || 0;
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
  if (!els.readerContent) return false;

  els.readerContent.textContent = "";
  resetLargeReaderState();

  const item = state.activeReaderItem;
  const isLarge = isLargeReaderFile(item);
  const openingInPageMode =
    isReaderPageModeEligible(item) &&
    getPreferredReaderDisplayMode() === "page";

  if (isLarge) {
    state.largeReaderChunks = splitLargeReaderText(text);

    setReaderLoadingProgress(
      76,
      "첫 화면을 준비하는 중…",
      "긴 파일은 처음부터 전부 그리지 않고 읽는 만큼만 화면에 표시합니다."
    );

    const initialLastIndex = Math.min(
      state.largeReaderChunks.length - 1,
      IS_SAFARI_READER ? 2 : 1
    );

    await renderLargeReaderThrough(initialLastIndex, renderToken);

    if (renderToken !== state.readerRenderToken) return false;

    setReaderLoadingProgress(
      94,
      "스크롤 준비 중…",
      "첫 읽기 화면의 스크롤 영역을 준비하고 있습니다."
    );

    await nextFrame();
    void els.readerPanel.scrollHeight;
    await nextFrame();

    unlockReaderScroll();

    // 잠금을 푼 상태에서 실제 scrollbar가 먼저 나타나도록 기다린다.
    await nextFrame();
    await nextFrame();

    if (renderToken !== state.readerRenderToken) return false;

    setReaderLoadingProgress(
      100,
      "준비 완료",
      "이제 바로 읽을 수 있습니다. 아래로 읽으면 다음 내용이 자동으로 이어집니다."
    );

    if (!openingInPageMode) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      els.readerLoadingOverlay?.classList.add("done");
      await new Promise((resolve) => setTimeout(resolve, 180));

      if (els.readerLoadingOverlay) {
        els.readerLoadingOverlay.remove();
        els.readerLoadingOverlay = null;
      }
    }

    return true;
  }

  const totalChars = Math.max(1, text.length);
  const chunkSize = 60000;
  let offset = 0;

  while (offset < text.length) {
    if (renderToken !== state.readerRenderToken) return false;

    const end = Math.min(text.length, offset + chunkSize);
    els.readerContent.appendChild(
      document.createTextNode(text.slice(offset, end))
    );

    offset = end;

    setReaderLoadingProgress(
      64 + (offset / totalChars) * 31,
      "본문을 화면에 배치하는 중…",
      "거의 다 준비됐습니다."
    );

    await nextFrame();
  }

  if (renderToken !== state.readerRenderToken) return false;

  unlockReaderScroll();
  await nextFrame();

  setReaderLoadingProgress(
    100,
    "준비 완료",
    "이제 바로 읽을 수 있습니다."
  );

  if (!openingInPageMode) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    els.readerLoadingOverlay?.classList.add("done");
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (els.readerLoadingOverlay) {
      els.readerLoadingOverlay.remove();
      els.readerLoadingOverlay = null;
    }
  }

  return true;
}

async function streamTextIntoReader(response, renderToken) {
  const text = await collectResponseText(response, renderToken);

  if (text === null || renderToken !== state.readerRenderToken) {
    return false;
  }

  state.readerText = text;
  return renderLongText(text, renderToken);
}

function showResumePrompt(item) {
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

  if (els.readerResumeButton) els.readerResumeButton.disabled = false;
  if (els.readerRestartButton) els.readerRestartButton.disabled = false;

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

async function openReader(item) {
  if (!item) return;

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
  els.siteHeader?.classList.remove("compact-mode");
  els.pageScrollTop?.classList.remove("visible");
  els.readerOverlay.hidden = false;

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

    const response = await fetch(`/api/content?${params.toString()}`, {
      headers: contentHeaders,
    });

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
    const rendered = await streamTextIntoReader(response, renderToken);

    if (!rendered || renderToken !== state.readerRenderToken) return;

    const preferredMode =
      isReaderPageModeEligible(item) &&
      getPreferredReaderDisplayMode() === "page"
        ? "page"
        : "scroll";

    await setReaderDisplayMode(preferredMode, {
      persist: false,
      offset: 0,
      initialLayout: true,
    });

    showResumePrompt(item);

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
  closeReaderShareUi();
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
}

function closeReader(options = {}) {
  const fromHistory = Boolean(options.fromHistory);

  if (!fromHistory && state.readerHistoryActive) {
    history.back();
    return;
  }

  finalizeReaderClose();
}


window.addEventListener("popstate", () => {
  if (!els.readerOverlay?.hidden && state.activeReaderItem) {
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
  `;
  els.sortSelect.value = state.sort;
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

els.sortSelect.addEventListener("change", async (event) => {
  disableInitialRecentPostypeBoost();
  state.sort = normalizeSortValue(event.target.value);
  applySourceForSort();
  localStorage.setItem("archiveSort", state.sort);

  if (state.sort === "bookmarks") {
    els.sortSelect.disabled = true;
    try {
      await loadBookmarkCounts();
    } catch (error) {
      console.warn("북마크 순위 로드 실패", error);
      window.alert(error?.message || "북마크 순위를 불러오지 못했습니다.");
    } finally {
      els.sortSelect.disabled = false;
    }
  }

  render();
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
  syncSourceFilterChips();

  els.contentTypeFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle(
      "active",
      chip.dataset.contentType === state.contentType
    );
  });

  els.statusFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle(
      "active",
      chip.dataset.statusFilter === state.statusFilter
    );
  });

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
  button.addEventListener("click", () => {
    const fontFamily = button.dataset.readerFontFamily;
    if (!Object.prototype.hasOwnProperty.call(READER_FONT_FAMILIES, fontFamily)) return;
    setViewerPreference(READER_FONT_FAMILY_KEY, fontFamily);
    applyUserPreferences();
  });
});

els.viewerSettingsButton?.addEventListener("click", () => {
  applyUserPreferences();
  openModal(els.viewerSettingsModal);
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

function openFeedbackModal() {
  if (els.feedbackMessageState) {
    els.feedbackMessageState.hidden = true;
    els.feedbackMessageState.classList.remove("is-error");
  }
  openModal(els.feedbackModal);
  ensureFeedbackTurnstile();
}

els.helpFeedbackButton?.addEventListener("click", () => {
  openFeedbackModal();
});

els.feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = String(els.feedbackMessage?.value || "").trim();
  if (message.length < 5) {
    els.feedbackMessageState.textContent = "내용을 5자 이상 입력해 주세요.";
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
        page: `${location.pathname}${location.search}`,
        version: String(els.publicVersion?.textContent || "").trim(),
        diagnostic: getIssueReportText(),
        turnstileToken: feedbackTurnstileToken,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "의견을 보내지 못했습니다.");
    localStorage.setItem("archiveFeedbackSentAt", String(Date.now()));
    els.feedbackMessage.value = "";
    if (els.feedbackWebsite) els.feedbackWebsite.value = "";
    els.feedbackMessageState.textContent = "의견을 보냈어요. 고맙습니다.";
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
    els.feedbackSubmitButton.textContent = "익명으로 보내기";
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
      "계정 복구가 현재 제공되지 않는다는 안내를 확인해 주세요.",
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
      body: JSON.stringify({ userId, password }),
    });

    setAuthToken(data.token, els.authRemember?.checked !== false);
    state.user = data.user;
    applyUserPreferences();
    updateAccountUi();
    await loadUserBootstrap();

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

  const previousTimer = state.bookmarkSaveTimers.get(fileId);
  if (previousTimer) window.clearTimeout(previousTimer);

  const timer = window.setTimeout(async () => {
    state.bookmarkSaveTimers.delete(fileId);
    const finalValue = Boolean(getUserLibraryEntry(fileId)?.bookmarked);

    try {
      const data = await userApi("/api/user/item", {
        method: "POST",
        body: JSON.stringify({
          action: "bookmark",
          fileId,
          bookmarked: finalValue,
        }),
      });
      applyBookmarkCountResponse(fileId, data);
    } catch (error) {
      console.warn("북마크 저장 실패", error);
    }
  }, 650);

  state.bookmarkSaveTimers.set(fileId, timer);
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
  const item = findQuoteFeedWork(state.quoteFeedActiveItem);
  if (!item) return;
  closeModal(els.quoteFeedModal);
  hideQuoteFeedPage({ clearHistoryMarker: true });
  openContentItem(item);
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
    if (state.profileTab === "quotes" && !state.savedQuotesLoaded) {
      loadSavedQuotes();
    }
  });
});

els.profileSearchInput?.addEventListener("input", (event) => {
  state.profileSearch = event.target.value || "";
  state.profileVisibleLimit = 15;
  renderProfilePage();
});

els.profileList?.addEventListener("click", async (event) => {
  const open = event.target.closest("[data-profile-open]");
  if (open) {
    const item = state.items.find((candidate) => candidate.id === open.dataset.profileOpen);
    if (item) {
      hideProfilePage({ clearHistoryMarker: true });
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
  const quoteShare = event.target.closest("[data-profile-quote-share]");
  if (quoteShare) {
    const quote = state.savedQuotes.find((entry) => String(entry.id) === String(quoteShare.dataset.profileQuoteShare));
    if (!quote || quote._shareSaving) return;

    quote.shared = !quote.shared;
    renderProfilePage();

    const matchedWork = state.items.find((candidate) =>
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


function setSearchValue(value, source = "main") {
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
  render();
}

let mainHeaderCompactActive = false;



function updateCompactHeader() {
  if (!els.siteHeader || !els.heroSearchBox) return;

  if (document.body.classList.contains("reader-open")) {
    mainHeaderCompactActive = false;
    els.siteHeader.classList.remove("compact-mode");
    return;
  }

  const searchRect = els.heroSearchBox.getBoundingClientRect();
  const enterThreshold = Math.max(54, Math.min(88, Math.round((els.siteHeader.offsetHeight || 64) + 6)));
  const leaveThreshold = enterThreshold + 36;

  // Search box 상단이 헤더 근처로 올라오면 먼저 compact로 전환한다.
  if (!mainHeaderCompactActive && searchRect.top <= enterThreshold) {
    mainHeaderCompactActive = true;
    els.siteHeader.classList.add("compact-mode");
    return;
  }

  // 다시 위로 올렸을 때는 search box의 하단이 충분히 내려와 보이면 일반 모드로 복귀한다.
  if (mainHeaderCompactActive && searchRect.bottom >= leaveThreshold) {
    mainHeaderCompactActive = false;
    els.siteHeader.classList.remove("compact-mode");
  }
}

els.searchInput.addEventListener("input", (event) => {
  setSearchValue(event.target.value, "main");
});

els.compactSearchInput?.addEventListener("input", (event) => {
  setSearchValue(event.target.value, "compact");
});

els.clearSearch.addEventListener("click", () => {
  setSearchValue("", "main");
  els.searchInput.focus();
});

els.compactClearSearch?.addEventListener("click", () => {
  setSearchValue("", "compact");
  els.compactSearchInput?.focus();
});

els.tabletCombinationSelect?.addEventListener("change", (event) => {
  disableInitialRecentPostypeBoost();
  state.combination = event.target.value;
  els.combinationFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.combination === state.combination);
  });
  render();
});

els.tabletContentTypeSelect?.addEventListener("change", (event) => {
  disableInitialRecentPostypeBoost();
  state.contentType = event.target.value;
  els.contentTypeFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.contentType === state.contentType);
  });
  render();
});

els.tabletStatusSelect?.addEventListener("change", (event) => {
  disableInitialRecentPostypeBoost();
  state.statusFilter = event.target.value;
  els.statusFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.statusFilter === state.statusFilter);
  });
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
  els.combinationFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.combination === state.combination);
  });
  render();
});

els.contentTypeFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-content-type]");
  if (!button) return;

  disableInitialRecentPostypeBoost();
  state.contentType = button.dataset.contentType;
  els.contentTypeFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.contentType === state.contentType);
  });

  render();
});

els.statusFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status-filter]");
  if (!button) return;

  disableInitialRecentPostypeBoost();
  state.statusFilter = button.dataset.statusFilter;
  els.statusFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.statusFilter === state.statusFilter);
  });

  render();
});

els.sourceFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-source]");
  if (!button) return;

  disableInitialRecentPostypeBoost();
  state.source = button.dataset.source;
  els.sourceFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.source === state.source);
  });
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

window.addEventListener("pagehide", flushReaderProgressBeforePageExit);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushReaderProgressBeforePageExit();
  }
});

let readerProgressSaveTimer = 0;
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

const READER_SHARE_BACKGROUNDS = [
  {
    name: "베이지",
    background: "linear-gradient(145deg, #fffdf9 0%, #f6f3ee 100%)",
    text: "#191816",
    meta: "#77716a",
    accent: "#191816",
  },
  {
    name: "다크",
    background: "linear-gradient(145deg, #211f1c 0%, #171614 100%)",
    text: "#f2ede6",
    meta: "#aaa39a",
    accent: "#eee8df",
  },
  {
    name: "그레이",
    background: "linear-gradient(145deg, #ebe6df 0%, #ddd7ce 100%)",
    text: "#2a2724",
    meta: "#77716a",
    accent: "#39352f",
  },
  {
    name: "모카",
    background: "linear-gradient(145deg, #38342f 0%, #2a2724 100%)",
    text: "#eee8df",
    meta: "#aaa39a",
    accent: "#f3eee7",
  },
  {
    name: "샌드",
    background: "linear-gradient(145deg, #f3eee7 0%, #aaa39a 100%)",
    text: "#191816",
    meta: "#4d4841",
    accent: "#2a2724",
  },
  {
    name: "로지",
    background: "radial-gradient(circle at 18% 18%, rgba(255,255,255,.82) 0 18%, rgba(255,255,255,0) 38%), radial-gradient(circle at 82% 78%, rgba(218,137,149,.12) 0 18%, rgba(218,137,149,0) 42%), linear-gradient(138deg, #fff9fa 0%, #f7e7e9 48%, #f0dadd 100%)",
    text: "#b45b63",
    meta: "#c58a92",
    accent: "#b45b63",
    effect: "rosy-blush",
  },
  {
    name: "스카이",
    background: "radial-gradient(circle at 20% 24%, rgba(255,255,255,.96) 0 1.2%, rgba(255,255,255,0) 2.8%), radial-gradient(circle at 74% 18%, rgba(255,255,255,.92) 0 1%, rgba(255,255,255,0) 2.5%), radial-gradient(circle at 84% 72%, rgba(255,255,255,.80) 0 1.1%, rgba(255,255,255,0) 2.6%), linear-gradient(155deg, #f4f9ff 0%, #e5f1ff 52%, #d8e8fb 100%)",
    text: "#4b78c2",
    meta: "#86a5d9",
    accent: "#4b78c2",
    effect: "sky-sparkle",
  },
  {
    name: "라벤더",
    background: "radial-gradient(ellipse at 14% 24%, rgba(240,213,235,.72) 0 16%, rgba(240,213,235,0) 45%), radial-gradient(ellipse at 84% 72%, rgba(205,224,251,.72) 0 18%, rgba(205,224,251,0) 48%), linear-gradient(145deg, #fbf8ff 0%, #eee8ff 54%, #e5dcf8 100%)",
    text: "#7652b8",
    meta: "#a28ecf",
    accent: "#7652b8",
    effect: "lavender-mist",
  },
  {
    name: "로즈쿼츠",
    background: "radial-gradient(circle at 18% 18%, rgba(255,255,255,.96) 0 14%, rgba(255,255,255,0) 34%), radial-gradient(circle at 80% 78%, rgba(255,255,255,.72) 0 7%, rgba(255,255,255,0) 20%), linear-gradient(148deg, #fffdfd 0%, #fdf4f6 34%, #f4e0e4 62%, #ece8ee 100%)",
    text: "#b77b88",
    meta: "#c4a2ab",
    accent: "#b77b88",
    effect: "rose-quartz-glow",
  },
  {
    name: "세레니티",
    background: "linear-gradient(150deg, #fbfdff 0%, #eef5ff 48%, #deebfb 100%)",
    text: "#5378bf",
    meta: "#87a1cf",
    accent: "#5378bf",
    effect: "serenity-breeze",
  },
  {
    name: "오팔",
    background: "linear-gradient(150deg, #fffcfb 0%, #f5f8f7 28%, #eef0ff 58%, #f9f0f7 100%)",
    text: "#6e64a3",
    meta: "#9c93c0",
    accent: "#6e64a3",
    effect: "opal-shimmer",
  },
];

const READER_SHARE_FONTS = [
  { key: "paperlogy", label: "페이퍼로지", css: 'Paperozi, Pretendard, "Noto Sans KR", sans-serif', weight: 500 },
  { key: "ridibatang", label: "리디바탕", css: 'Ridibatang, "Noto Serif KR", "Nanum Myeongjo", serif', weight: 400 },
  { key: "kopubbatang", label: "KoPub 바탕", css: '"KoPub Batang", "Noto Serif KR", "Nanum Myeongjo", serif', weight: 400 },
  { key: "chosunilbo", label: "조선일보명조", css: 'ChosunIlboMyungjo, "Noto Serif KR", "Nanum Myeongjo", serif', weight: 400 },
  { key: "inkliquid", label: "잉크립퀴드", css: 'InkLiquid, cursive', weight: 400 },
];

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
    .reader-share-card { position:relative; width:min(82vw, 380px); aspect-ratio:1/1; border-radius:18px; overflow:hidden; background:#eee center/cover no-repeat; box-shadow:0 12px 28px rgba(29,20,33,.17); transition:aspect-ratio .16s ease,width .16s ease; }
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
    .reader-share-thumbs { display:flex; gap:8px; overflow:auto; padding:1px 1px 3px; scrollbar-width:none; }
    .reader-share-thumbs::-webkit-scrollbar { display:none; }
    .reader-share-thumb { position:relative; flex:0 0 58px; width:58px; height:52px; padding:0; border:2px solid transparent; border-radius:11px; overflow:hidden; cursor:pointer; box-shadow:inset 0 0 0 1px rgba(70,55,75,.08); }
    .reader-share-thumb.active { border-color:#5a4e45; box-shadow:0 0 0 2px rgba(90,78,69,.14), inset 0 0 0 1px rgba(255,255,255,.22); }
    .reader-share-thumb::after { content:attr(data-theme-name); position:absolute; left:5px; right:5px; bottom:4px; font-size:8px; font-weight:800; line-height:1; text-align:center; color:var(--thumb-label,#fff); text-shadow:0 1px 3px rgba(0,0,0,.2); }
    .reader-share-input { width:100%; min-height:70px; max-height:120px; resize:vertical; box-sizing:border-box; border:1px solid rgba(90,74,98,.16); border-radius:12px; background:rgba(255,255,255,.66); color:inherit; padding:10px 11px; font:inherit; font-size:13px; line-height:1.5; outline:none; }
    .reader-share-input:focus { border-color:rgba(90,78,69,.45); box-shadow:0 0 0 3px rgba(90,78,69,.08); }
    .reader-share-actions { display:grid; grid-template-columns:repeat(var(--share-action-count, 4),minmax(0,1fr)); gap:8px; }
    .reader-share-action[data-share-system][hidden] { display:none !important; }
    .reader-share-action { min-height:42px; border-radius:12px; border:1px solid rgba(91,75,99,.18); font-size:13px; font-weight:800; cursor:pointer; }
    .reader-share-action.primary { background:#191816; color:#fff; border-color:#191816; }
    .reader-share-action.secondary { background:rgba(255,255,255,.64); color:inherit; }
    .reader-share-action:disabled { opacity:.56; cursor:wait; }
    .reader-share-options { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
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
  `;
  document.head.appendChild(style);

  const floatButton = document.createElement("button");
  floatButton.type = "button";
  floatButton.className = "reader-share-float";
  floatButton.hidden = true;
  floatButton.setAttribute("aria-label", "선택한 문구 공유 카드 만들기");
  floatButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5"></circle>
      <circle cx="6" cy="12" r="2.5"></circle>
      <circle cx="18" cy="19" r="2.5"></circle>
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"></path>
    </svg>`;
  document.body.appendChild(floatButton);

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
  const shareButton = backdrop.querySelector("[data-share-system]");
  const savedPanel = backdrop.querySelector("[data-share-saved-panel]");
  const publicToggle = backdrop.querySelector("[data-share-public-toggle]");
  let lastSavedQuote = null;

  thumbs.innerHTML = READER_SHARE_BACKGROUNDS.map((background, index) => `
    <button type="button" class="reader-share-thumb" data-share-background="${index}" data-theme-name="${background.name}" aria-label="${background.name} 테마" style="background:${background.background};--thumb-label:${background.text}"></button>`).join("");

  fonts.innerHTML = READER_SHARE_FONTS.map((font) => `
    <button type="button" class="reader-share-chip" data-share-font="${font.key}">${font.label}</button>`).join("");

  weights.innerHTML = Object.entries(READER_SHARE_WEIGHTS).map(([key, value]) => `
    <button type="button" class="reader-share-chip" data-share-weight="${key}">${value.label}</button>`).join("");

  sizes.innerHTML = Object.entries(READER_SHARE_SIZES).map(([key, size]) => `
    <button type="button" class="reader-share-chip" data-share-size="${key}" aria-label="${size.label}" title="${size.label}">${size.button}</button>`).join("");

  const close = ({ fromHistory = false } = {}) => {
    backdrop.hidden = true;
    lastSavedQuote = null;
    state.readerShareText = "";
    state.readerShareSourceItem = null;
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
    thumbs.classList.add("is-dragging");
    thumbs.setPointerCapture?.(event.pointerId);
  });

  thumbs.addEventListener("pointermove", (event) => {
    if (thumbDragPointerId !== event.pointerId) return;
    const deltaX = event.clientX - thumbDragStartX;
    if (Math.abs(deltaX) > 3) thumbDragMoved = true;
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
        quoteSaveButton.textContent = "저장 완료";
        quoteSaveButton.classList.add("saved");
        if (savedPanel) {
          savedPanel.hidden = false;
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
          publicToggle.disabled = false;
          publicToggle.setAttribute("aria-pressed", "false");
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
    openReaderShareSheet();
  });

  readerShareUi = { style, floatButton, backdrop, sheet, thumbs, input, card, quote, quoteText, meta, brand, fonts, weights, sizes, actions, wrap, quoteSaveButton, saveButton, clipboardButton, shareButton, savedPanel, publicToggle, close };
  return readerShareUi;
}

function parseShareGradientColors(backgroundValue) {
  const matches = String(backgroundValue || "").match(/#(?:[0-9a-fA-F]{3}){1,2}/g) || [];
  return {
    start: matches[0] || "#f6f3ee",
    end: matches[1] || matches[0] || "#fffdf9",
  };
}

function drawReaderShareThemeEffect(ctx, background, width, height) {
  const effect = String(background?.effect || "");
  if (!effect) return;

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

async function renderReaderShareCanvas() {
  const model = getReaderShareRenderModel();
  const width = 1200;
  const height = model.ratio === "2:3" ? 1800 : model.ratio === "4:5" ? 1500 : 1200;
  try {
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
  for (const line of layout.lines) {
    ctx.fillText(line, centerX, y);
    y += layout.lineHeight;
  }

  const meta = [model.item.title, model.item.author].filter(Boolean).join(" · ") || "제목 정보 없음";
  ctx.globalAlpha = 1;
  ctx.fillStyle = model.background.meta;
  ctx.font = `400 ${10 * scale}px Pretendard, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(meta, centerX, height - (height * 0.058));

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
}

function updateReaderShareActionLabel() {
  if (!readerShareUi) return;
  const touch = isReaderShareTouchDevice();
  if (readerShareUi.saveButton) readerShareUi.saveButton.textContent = "이미지 저장";
  // v7.77 검증 동작: 준비 상태 때문에 버튼 자체를 비활성화하지 않는다.
  // 아직 Blob이 준비되지 않은 극히 짧은 구간은 클릭 핸들러가 안내 후 즉시 재준비한다.
  if (readerShareUi.clipboardButton) readerShareUi.clipboardButton.textContent = "클립보드 복사";
  if (readerShareUi.shareButton) {
    readerShareUi.shareButton.textContent = "공유하기";
    readerShareUi.shareButton.hidden = !touch;
  }
  updateReaderShareActionLayout();
}

let readerSharePreparedBlob = null;
let readerSharePreparedBlobKey = "";
let readerSharePreparePromise = null;
let readerSharePrepareTimer = 0;

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

function scheduleReaderShareBlobPreparation(delay = 90) {
  window.clearTimeout(readerSharePrepareTimer);
  const key = getReaderShareBlobKey();
  if (readerSharePreparedBlob && readerSharePreparedBlobKey === key) return;

  readerSharePrepareTimer = window.setTimeout(() => {
    const preparedKey = getReaderShareBlobKey();
    if (readerSharePreparedBlob && readerSharePreparedBlobKey === preparedKey) return;

    const promise = createReaderShareClipboardBlobPromise();
    readerSharePreparePromise = promise;
    promise.then((blob) => {
      if (getReaderShareBlobKey() !== preparedKey) return;
      readerSharePreparedBlob = blob;
      readerSharePreparedBlobKey = preparedKey;
      if (readerShareUi && !readerShareUi.backdrop.hidden) {
        updateReaderShareActionLabel();
      }
    }).catch((error) => {
      console.warn("reader share image pre-render failed", error);
    }).finally(() => {
      if (readerSharePreparePromise === promise) readerSharePreparePromise = null;
    });
  }, Math.max(0, Number(delay) || 0));
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
    const blob = getPreparedReaderShareBlob() || await createReaderShareBlobPromise();
    if (!readerSharePreparedBlob || readerSharePreparedBlobKey !== getReaderShareBlobKey()) {
      readerSharePreparedBlob = blob;
      readerSharePreparedBlobKey = getReaderShareBlobKey();
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
        text: `${getReaderShareSourceItem().title || "문장 이미지"}`,
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

  ui.thumbs.querySelectorAll("[data-share-background]").forEach((button, index) => {
    button.classList.toggle("active", index === state.readerShareBackground);
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
  scheduleReaderShareBlobPreparation(120);
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

function openReaderShareSheet(options = {}) {
  const { allowEmpty = false, presetText = null, sourceItem = null } = options || {};
  if (typeof presetText === "string") state.readerShareText = presetText;
  state.readerShareSourceItem = sourceItem || state.activeReaderItem || state.readerShareSourceItem || null;
  if (!allowEmpty && !state.readerShareText) return;
  // A newly opened editor always starts from the agreed baseline.
  resetReaderShareEditorOptions();
  ensureReaderShareState();
  const ui = ensureReaderShareUi();
  ui.floatButton.hidden = true;
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

function closeReaderShareUi({ fromHistory = false } = {}) {
  if (!readerShareUi) return;
  readerShareUi.floatButton.hidden = true;
  window.clearTimeout(readerSharePrepareTimer);
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

function getReaderTextSelection() {
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
      return;
    }

    state.readerShareText = selected.text;
    scheduleReaderShareBlobPreparation(0);
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

    ui.floatButton.style.left = `${x}px`;
    ui.floatButton.style.top = `${y}px`;
    ui.floatButton.hidden = false;
  }, isTouchLike ? 220 : 55);
}

function initReaderShareSelection() {
  ensureReaderShareUi();
  document.addEventListener("selectionchange", () => {
    if (els.readerOverlay?.hidden) return;
    syncReaderShareSelection();
  });
  els.readerPanel?.addEventListener("pointerup", syncReaderShareSelection);
  els.readerPanel?.addEventListener("touchend", syncReaderShareSelection, { passive: true });
  els.readerPanel?.addEventListener("scroll", () => {
    readerShareUi && (readerShareUi.floatButton.hidden = true);
  }, { passive: true });
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

  return [
    `[셩냥책 베타 문제 신고 정보]`,
    `버전: ${version}`,
    `시간: ${new Date().toLocaleString("ko-KR")}`,
    `온라인: ${navigator.onLine ? "예" : "아니오"}`,
    `로그인: ${state.user ? "예" : "아니오"}`,
    `페이지: ${page}`,
    `화면: viewport ${viewport} / screen ${screenSize} / DPR ${dpr}`,
    `플랫폼: ${platform}`,
    `브라우저 UA: ${navigator.userAgent}`,
    `보기: ${state.view} / 정렬: ${state.sort}`,
    `필터: CP=${state.combination}, 형태=${state.contentType}, 상태=${state.statusFilter}, 출처=${state.source}`,
    `검색어: ${state.search || "-"}`,
    activeItem
      ? `열린 작품: ${activeItem.title || "제목 미상"} / ID=${activeItem.id} / 출처=${activeItem.source || "drive"} / 진도=${progress}`
      : "열린 작품: 없음",
  ].join("\n");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
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

initReaderShareSelection();
applyUserPreferences();
updateNetworkStatus();
window.addEventListener("online", updateNetworkStatus);
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
