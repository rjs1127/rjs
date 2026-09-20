const state = {
  items: [],
  combination: "전체",
  length: "전체",
  source: "전체",
  search: "",
  sort: localStorage.getItem("archiveSort") || "title",
  view: localStorage.getItem("archiveViewV2") || "list",
  mobileFiltersOpen: false,
  activeReaderItem: null,
  readerRenderToken: 0,
  suspendReaderProgressSave: false,
  readerLoadingStartedAt: 0,
  largeReaderChunks: null,
  largeReaderRenderedCount: 0,
  largeReaderRendering: false,
  user: null,
  userLibrary: new Map(),
  authMode: "login",
  pendingAuthReason: "",
  lastRemoteProgressAt: 0,
  libraryKind: "bookmarks",
  librarySearch: "",
  visitRecordedUserId: "",
  remoteProgressState: new Map(),
  bookmarkSaveTimers: new Map(),
  bookmarkOnly: false,
  readingOnly: false,
  resumeShortcutItemId: "",
};

const LARGE_FILE_LOADING_THRESHOLD_BYTES = 810 * 1024;
const LARGE_FILE_MIN_LOADING_VISIBLE_MS = 1700;

const UI_THEME_KEY = "rjsBookThemeV1";
const READER_SPACING_KEY = "rjsBookReaderSpacingV1";

function getSavedTheme() {
  return localStorage.getItem(UI_THEME_KEY) === "dark" ? "dark" : "light";
}

function getSavedReaderSpacing() {
  const value = localStorage.getItem(READER_SPACING_KEY);
  return ["compact", "normal", "wide"].includes(value) ? value : "normal";
}

function applyUserPreferences() {
  const theme = getSavedTheme();
  const spacing = getSavedReaderSpacing();
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
  root.dataset.readerSpacing = spacing;

  if (els.darkModeToggle) {
    const enabled = theme === "dark";
    els.darkModeToggle.textContent = enabled ? "ON" : "OFF";
    els.darkModeToggle.classList.toggle("active", enabled);
    els.darkModeToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  }

  els.readerSpacingButtons?.forEach((button) => {
    const active = button.dataset.readerSpacing === spacing;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}


const els = {
  status: document.getElementById("status"),
  contentGrid: document.getElementById("contentGrid"),
  contentListWrap: document.getElementById("contentListWrap"),
  contentListBody: document.getElementById("contentListBody"),
  emptyState: document.getElementById("emptyState"),
  resultCount: document.getElementById("resultCount"),
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  heroSearchBox: document.getElementById("heroSearchBox"),
  siteHeader: document.getElementById("siteHeader"),
  compactHeaderSearch: document.getElementById("compactHeaderSearch"),
  compactSearchInput: document.getElementById("compactSearchInput"),
  compactClearSearch: document.getElementById("compactClearSearch"),
  brandText: document.getElementById("brandText"),
  siteFavicon: document.getElementById("siteFavicon"),
  siteShortcutIcon: document.getElementById("siteShortcutIcon"),
  siteAppleTouchIcon: document.getElementById("siteAppleTouchIcon"),
  combinationFilters: document.getElementById("combinationFilters"),
  lengthFilters: document.getElementById("lengthFilters"),
  sourceFilters: document.getElementById("sourceFilters"),
  controlsGrid: document.getElementById("controlsGrid"),
  filterToggleButton: document.getElementById("filterToggleButton"),
  filterSummary: document.getElementById("filterSummary"),
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
  readerLoadingTitle: document.getElementById("readerLoadingTitle"),
  readerLoadingText: document.getElementById("readerLoadingText"),
  readerProgressBar: document.getElementById("readerProgressBar"),
  readerProgressLabel: document.getElementById("readerProgressLabel"),
  readerScrollTop: document.getElementById("readerScrollTop"),
  bookmarkLibraryButton: document.getElementById("bookmarkLibraryButton"),
  recentLibraryButton: document.getElementById("recentLibraryButton"),
  helpButton: document.getElementById("helpButton"),
  signupButton: document.getElementById("signupButton"),
  loginButton: document.getElementById("loginButton"),
  readerBookmarkButton: document.getElementById("readerBookmarkButton"),
  readerDownloadButton: document.getElementById("readerDownloadButton"),
  authModal: document.getElementById("authModal"),
  authModalTitle: document.getElementById("authModalTitle"),
  authModalDescription: document.getElementById("authModalDescription"),
  authLoginTab: document.getElementById("authLoginTab"),
  authSignupTab: document.getElementById("authSignupTab"),
  authForm: document.getElementById("authForm"),
  authUserId: document.getElementById("authUserId"),
  authPassword: document.getElementById("authPassword"),
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
  helpModal: document.getElementById("helpModal"),
  helpLoginButton: document.getElementById("helpLoginButton"),
  libraryModal: document.getElementById("libraryModal"),
  libraryModalTitle: document.getElementById("libraryModalTitle"),
  libraryModalDescription: document.getElementById("libraryModalDescription"),
  librarySearchInput: document.getElementById("librarySearchInput"),
  libraryClearButton: document.getElementById("libraryClearButton"),
  libraryModalList: document.getElementById("libraryModalList"),
  accountModal: document.getElementById("accountModal"),
  accountModalUser: document.getElementById("accountModalUser"),
  darkModeToggle: document.getElementById("darkModeToggle"),
  readerSpacingButtons: Array.from(document.querySelectorAll("[data-reader-spacing]")),
  logoutButton: document.getElementById("logoutButton"),
};


const AUTH_TOKEN_KEY = "rjsBookAuthTokenV1";

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
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
  return [
    els.authModal,
    els.signupModal,
    els.helpModal,
    els.libraryModal,
    els.accountModal,
  ].filter(Boolean);
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

  document.body.style.position = "fixed";
  document.body.style.top = `-${modalPageScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";

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

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.paddingRight = "";

  setBackgroundInert(false);

  window.scrollTo({
    top: modalPageScrollY,
    left: 0,
    behavior: "auto",
  });

  if (
    modalLastFocusedElement &&
    document.contains(modalLastFocusedElement)
  ) {
    window.setTimeout(() => {
      try {
        modalLastFocusedElement.focus({ preventScroll: true });
      } catch {
        modalLastFocusedElement.focus();
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

function closeModal(modal) {
  if (!modal) return;

  modal.hidden = true;

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
  focusModal(modal);
}

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
  state.remoteProgressState = new Map();
  state.visitRecordedUserId = "";
  state.bookmarkOnly = false;
  state.readingOnly = false;
  state.resumeShortcutItemId = "";
  syncQuickFilterButtons();
  updateResumeShortcut();
  updateAccountUi();
  updateReaderBookmarkButton();

  if (state.items.length) {
    render();
  }
}

function updateAccountUi() {
  const loggedIn = Boolean(state.user?.userId);

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
}

function normalizeLibraryRow(row) {
  return {
    fileId: row.file_id,
    progressPercent: Number(row.progress_percent || 0),
    scrollTop: row.scroll_top == null ? null : Number(row.scroll_top),
    chunkIndex: row.chunk_index == null ? null : Number(row.chunk_index),
    chunkRatio: row.chunk_ratio == null ? null : Number(row.chunk_ratio),
    bookmarked: Boolean(row.bookmarked),
    viewedAt: row.viewed_at == null ? null : Number(row.viewed_at),
    readAt: row.read_at == null ? null : Number(row.read_at),
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
    if (progress < 1 || progress >= 95 || entry?.readAt) continue;

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
    Math.min(94, Math.round(Number(latest.entry.progressPercent || 0)))
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

async function loadUserLibrary() {
  if (!state.user) {
    state.userLibrary = new Map();
    return;
  }

  const data = await userApi("/api/user/library");
  state.userLibrary = new Map(
    (data.items || []).map((row) => {
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

  updateReaderBookmarkButton();
  syncQuickFilterButtons();
  updateResumeShortcut();

  if (state.items.length) {
    render();
  }
}

async function restoreAuth() {
  const token = getAuthToken();
  if (!token) {
    updateAccountUi();
    return;
  }

  try {
    const data = await userApi("/api/auth/me");
    state.user = data.user;
    updateAccountUi();
    await loadUserLibrary();
    await recordLoggedInVisit();
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
  els.readerBookmarkButton.querySelector("span").textContent =
    bookmarked ? "★" : "☆";
  els.readerBookmarkButton.title = bookmarked ? "북마크 해제" : "북마크";
}

async function recordRecentView(item) {
  if (!state.user || !item) return;

  const viewedAt = Date.now();
  updateUserLibraryEntry(item.id, { viewedAt });

  try {
    await userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify({
        action: "view",
        fileId: item.id,
      }),
    });
  } catch (error) {
    console.warn("최근 조회 저장 실패", error);
  }
}


function shouldPersistProgress(fileId, saved) {
  const previous = state.remoteProgressState.get(fileId);
  if (!previous) return true;

  const nextPercent = Number(saved?.percent || 0);
  const previousPercent = Number(previous.progressPercent || 0);

  if (nextPercent >= 95 && !previous.readAt) return true;
  if (Math.abs(nextPercent - previousPercent) >= 0.5) return true;

  if (saved?.mode === "chunk") {
    if (Number(saved.chunkIndex ?? -1) !== Number(previous.chunkIndex ?? -1)) {
      return true;
    }

    if (
      Math.abs(
        Number(saved.chunkRatio ?? 0) -
        Number(previous.chunkRatio ?? 0)
      ) >= 0.01
    ) {
      return true;
    }
  }

  if (saved?.mode === "scroll") {
    const nextScroll = Number(saved.scrollTop || 0);
    const previousScroll = Number(previous.scrollTop || 0);

    if (Math.abs(nextScroll - previousScroll) >= 80) return true;
  }

  return false;
}

async function persistProgress(item, saved) {
  if (!state.user || !item || !saved) return;
  if (!shouldPersistProgress(item.id, saved)) return;

  const payload = {
    action: "progress",
    fileId: item.id,
    percent: Number(saved.percent || 0),
    mode: saved.mode === "chunk" ? "chunk" : "scroll",
    scrollTop: saved.scrollTop ?? null,
    chunkIndex: saved.chunkIndex ?? null,
    chunkRatio: saved.chunkRatio ?? null,
  };

  updateUserLibraryEntry(item.id, {
    progressPercent: payload.percent,
    scrollTop: payload.scrollTop,
    chunkIndex: payload.chunkIndex,
    chunkRatio: payload.chunkRatio,
    readAt:
      payload.percent >= 95
        ? (getUserLibraryEntry(item.id)?.readAt || Date.now())
        : getUserLibraryEntry(item.id)?.readAt || null,
    updatedAt: Date.now(),
  });

  try {
    await userApi("/api/user/item", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.lastRemoteProgressAt = Date.now();
    state.remoteProgressState.set(item.id, {
      progressPercent: payload.percent,
      scrollTop: payload.scrollTop,
      chunkIndex: payload.chunkIndex,
      chunkRatio: payload.chunkRatio,
      readAt:
        payload.percent >= 95
          ? (getUserLibraryEntry(item.id)?.readAt || Date.now())
          : getUserLibraryEntry(item.id)?.readAt || null,
    });
    updateResumeShortcut();
    if (state.items.length) render();
  } catch (error) {
    console.warn("이어보기 저장 실패", error);
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
    })
    .slice(0, 100);
}

function renderUserLibraryModal() {
  const kind = state.libraryKind;
  const visible = getLibraryVisibleEntries();

  if (els.libraryClearButton) {
    els.libraryClearButton.textContent =
      kind === "bookmarks" ? "북마크 전체 해제" : "최근 조회 전체 삭제";
    els.libraryClearButton.disabled = !visible.length && !state.librarySearch;
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

  els.libraryModalTitle.textContent =
    state.libraryKind === "bookmarks" ? "북마크" : "최근 조회";
  els.libraryModalDescription.textContent =
    state.libraryKind === "bookmarks"
      ? "저장해 둔 작품입니다. 검색하거나 필요 없는 북마크를 해제할 수 있어요."
      : "최근 열어본 작품입니다. 검색하거나 기록을 정리할 수 있어요.";

  if (els.librarySearchInput) {
    els.librarySearchInput.value = "";
  }

  renderUserLibraryModal();
  openModal(els.libraryModal);
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
    ? `<p>${escapeHtml(message)}</p>`
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
  const siteName = String(settings.siteName || "RJS BOOK").trim() || "RJS BOOK";
  const faviconUrl = getVersionedFaviconUrl(
    settings.faviconUrl,
    settings.updatedAt
  );

  document.title = siteName;

  if (els.brandText) {
    els.brandText.textContent = siteName;
  }

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

function sortItems(items) {
  const collator = new Intl.Collator("ko", {
    sensitivity: "base",
    numeric: true,
  });

  return [...items].sort((a, b) => {
    if (state.sort === "title") {
      const titleCompare = collator.compare(a.title || "", b.title || "");
      if (titleCompare !== 0) return titleCompare;
      return collator.compare(a.author || "", b.author || "");
    }

    if (state.sort === "author") {
      const authorCompare = collator.compare(a.author || "", b.author || "");
      if (authorCompare !== 0) return authorCompare;
      return collator.compare(a.title || "", b.title || "");
    }

    const aTime = Date.parse(a.createdTime || a.modifiedTime || "") || 0;
    const bTime = Date.parse(b.createdTime || b.modifiedTime || "") || 0;
    if (bTime !== aTime) return bTime - aTime;

    return collator.compare(a.title || "", b.title || "");
  });
}

function updateFilterSummary() {
  if (!els.filterSummary) return;

  const parts = [];
  if (state.combination !== "전체") parts.push(state.combination);
  if (state.length !== "전체") parts.push(state.length);
  if (state.source !== "전체") {
    parts.push(state.source === "postype" ? "POSTYPE" : "TXT");
  }
  if (state.bookmarkOnly) parts.push("북마크");
  if (state.readingOnly) parts.push("읽는 중");
  if (state.view === "card") parts.push("카드형");

  els.filterSummary.textContent = parts.length ? parts.join(" · ") : "전체";
}

function getFilteredItems() {
  const tokens = getSearchTokens(state.search);

  const filtered = state.items.filter((item) => {
    const matchesCombination =
      state.combination === "전체" || item.combination === state.combination;
    const matchesLength =
      state.length === "전체" || item.lengthType === state.length;
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
        progress >= 1 &&
        progress < 95 &&
        !libraryEntry?.readAt
      );

    return (
      matchesCombination &&
      matchesLength &&
      matchesSource &&
      matchesSearch &&
      matchesBookmark &&
      matchesReading
    );
  });

  return sortItems(filtered);
}

function render() {
  const items = getFilteredItems();
  updateFilterSummary();
  els.resultCount.textContent = `총 ${items.length.toLocaleString("ko-KR")}개`;

  if (!items.length) {
    els.contentGrid.hidden = true;
    els.contentListWrap.hidden = true;
    els.emptyState.hidden = false;
    syncViewButtons();
    return;
  }

  els.emptyState.hidden = true;

  if (state.view === "list") {
    renderList(items);
    els.contentGrid.hidden = true;
    els.contentListWrap.hidden = false;
  } else {
    renderCards(items);
    els.contentGrid.hidden = false;
    els.contentListWrap.hidden = true;
  }

  syncViewButtons();
}


function getItemReadingBadge(item) {
  if (!state.user || !item || item.source === "postype") return "";

  const entry = getUserLibraryEntry(item.id);
  if (!entry) return "";

  if (entry.readAt) {
    return `<span class="reading-state-badge read">✓ 읽음</span>`;
  }

  const percent = Math.round(Number(entry.progressPercent || 0));
  if (percent > 0 && percent < 99) {
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

  return `
    <a class="${className}"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
      data-download-id="${escapeHtml(item.id)}"
      aria-label="${escapeHtml(item.title || "TXT")} 다운로드"
      title="TXT 다운로드">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5v11"></path>
        <path d="m7.75 10.5 4.25 4.25 4.25-4.25"></path>
        <path d="M5 19.5h14"></path>
      </svg>
    </a>
  `;
}

function getSourceLabel(item) {
  return item?.source === "postype" ? "POSTYPE" : "TXT";
}

function getSourceBadgeHtml(item, className = "source-badge") {
  const source = item?.source === "postype" ? "postype" : "drive";
  return `<span class="${className} ${source}">${getSourceLabel(item)}</span>`;
}

function getPostypeMetaHtml(item) {
  if (item?.source !== "postype") return "";

  const parts = [
    item.genre,
    item.status,
    item.subCp1 ? `서브 ${item.subCp1}` : "",
    item.subCp2 ? `서브 ${item.subCp2}` : "",
  ].filter(Boolean);

  if (!parts.length) return "";
  return `<p class="card-source-meta">${escapeHtml(parts.join(" · "))}</p>`;
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
          <span class="card-tag card-length-tag">${escapeHtml(item.lengthType)}</span>
        </div>
        ${getItemReadingBadge(item)}
      </div>
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <p class="card-author">${escapeHtml(item.author)}</p>
      ${getPostypeMetaHtml(item)}
      <div class="card-actions">
        ${getDownloadButtonHtml(item, "item-download-button card-download-button")}
        <span class="card-arrow" aria-hidden="true">↗</span>
      </div>
    </article>
  `).join("");
}

function getListBookmarkIndicator(item) {
  if (!state.user || !item || item.source === "postype") return "";

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
      <td>${escapeHtml(item.lengthType)}</td>
      <td class="list-title">
        <span class="list-title-row">
          <span class="list-title-main">
            <span class="list-title-heading">
              ${getSourceBadgeHtml(item, "list-source-badge")}
              <span class="list-title-text">${escapeHtml(item.title)}</span>
            </span>
            ${getItemReadingBadge(item)}
          </span>
          <span class="list-title-actions">
            ${getListBookmarkIndicator(item)}
            ${getDownloadButtonHtml(item, "item-download-button list-download-button")}
          </span>
        </span>
        ${
          item.source === "postype"
            ? `<span class="list-source-meta">${escapeHtml(
                [item.genre, item.status, item.subCp1, item.subCp2]
                  .filter(Boolean)
                  .join(" · ")
              )}</span>`
            : ""
        }
      </td>
      <td>${escapeHtml(item.author)}</td>
    </tr>
  `).join("");
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

function getReaderProgress(id) {
  if (!id || !state.user) return null;

  const entry = getUserLibraryEntry(id);
  if (!entry || entry.progressPercent <= 0 || entry.progressPercent >= 99) {
    return null;
  }

  if (Number.isFinite(entry.chunkIndex)) {
    return {
      mode: "chunk",
      chunkIndex: entry.chunkIndex,
      chunkRatio: Number(entry.chunkRatio || 0),
      percent: entry.progressPercent,
    };
  }

  if (Number.isFinite(entry.scrollTop)) {
    return {
      mode: "scroll",
      scrollTop: entry.scrollTop,
      percent: entry.progressPercent,
    };
  }

  return {
    mode: "scroll",
    scrollTop: 0,
    percent: entry.progressPercent,
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

function saveReaderProgress() {
  if (state.suspendReaderProgressSave || !state.user) return null;

  const item = state.activeReaderItem;
  if (!item || !els.readerPanel) return null;

  let saved = null;

  if (isLargeReaderFile(item) && state.largeReaderChunks) {
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
    const percent = maxScroll > 0
      ? Math.min(100, Math.round((scrollTop / maxScroll) * 100))
      : 0;

    saved = {
      mode: "scroll",
      scrollTop,
      percent,
    };
  }

  updateUserLibraryEntry(item.id, {
    progressPercent: saved.percent,
    scrollTop: saved.mode === "scroll" ? saved.scrollTop : null,
    chunkIndex: saved.mode === "chunk" ? saved.chunkIndex : null,
    chunkRatio: saved.mode === "chunk" ? saved.chunkRatio : null,
    readAt:
      saved.percent >= 95
        ? (getUserLibraryEntry(item.id)?.readAt || Date.now())
        : getUserLibraryEntry(item.id)?.readAt || null,
    updatedAt: Date.now(),
  });

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

function lockReaderScroll() {
  els.readerPanel?.classList.add("reader-loading-locked");
}

function unlockReaderScroll() {
  els.readerPanel?.classList.remove("reader-loading-locked");
}

function showReaderLoading(item) {
  const isLarge = isLargeReaderFile(item);
  resetLargeReaderState();
  lockReaderScroll();

  els.readerBody.innerHTML = `
    <div id="readerRenderShell" class="reader-render-shell">
      <div id="readerContent" class="reader-content" aria-live="off"></div>

      <div id="readerLoadingOverlay" class="reader-loading-overlay">
        <div class="reader-loading rich-loading">
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
          <span id="readerProgressLabel" class="reader-progress-label">4%</span>
        </div>
      </div>
    </div>
  `;

  els.readerContent = document.getElementById("readerContent");
  els.readerLoadingOverlay = document.getElementById("readerLoadingOverlay");
  els.readerLoadingTitle = document.getElementById("readerLoadingTitle");
  els.readerLoadingText = document.getElementById("readerLoadingText");
  els.readerProgressBar = document.getElementById("readerProgressBar");
  els.readerProgressLabel = document.getElementById("readerProgressLabel");

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

function resetLargeReaderState() {
  state.largeReaderChunks = null;
  state.largeReaderRenderedCount = 0;
  state.largeReaderRendering = false;
}

function splitLargeReaderText(text) {
  const chunks = [];
  let offset = 0;

  while (offset < text.length) {
    let end = Math.min(text.length, offset + LARGE_READER_CHUNK_CHARS);

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
}

async function renderLargeReaderThrough(targetIndex, renderToken) {
  if (
    !state.largeReaderChunks ||
    state.largeReaderRendering ||
    renderToken !== state.readerRenderToken
  ) {
    return;
  }

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

  if (distanceToBottom > 1500) return;

  const target = Math.min(
    state.largeReaderChunks.length - 1,
    state.largeReaderRenderedCount + 1
  );

  await renderLargeReaderThrough(target, state.readerRenderToken);
}

function getLargeReaderPosition() {
  if (!state.largeReaderChunks || !els.readerPanel || !els.readerContent) {
    return null;
  }

  const sections = Array.from(
    els.readerContent.querySelectorAll(".reader-virtual-chunk")
  );

  if (!sections.length) return null;

  const viewportTop = els.readerPanel.scrollTop + 92;
  let current = sections[0];

  for (const section of sections) {
    if (section.offsetTop <= viewportTop) {
      current = section;
    } else {
      break;
    }
  }

  const index = Number(current.dataset.readerChunkIndex || 0);
  const localOffset = Math.max(0, viewportTop - current.offsetTop);
  const ratio = current.offsetHeight > 0
    ? Math.min(1, localOffset / current.offsetHeight)
    : 0;

  const total = Math.max(1, state.largeReaderChunks.length);
  const percent = Math.min(
    100,
    Math.max(0, Math.round(((index + ratio) / total) * 100))
  );

  return { index, ratio, percent };
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

  if (isLarge) {
    state.largeReaderChunks = splitLargeReaderText(text);

    setReaderLoadingProgress(
      76,
      "첫 화면을 준비하는 중…",
      "긴 파일은 처음부터 전부 그리지 않고 읽는 만큼만 화면에 표시합니다."
    );

    const initialLastIndex = Math.min(
      state.largeReaderChunks.length - 1,
      1
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

    await new Promise((resolve) => setTimeout(resolve, 180));

    els.readerLoadingOverlay?.classList.add("done");
    await new Promise((resolve) => setTimeout(resolve, 180));

    if (els.readerLoadingOverlay) {
      els.readerLoadingOverlay.remove();
      els.readerLoadingOverlay = null;
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

  await new Promise((resolve) => setTimeout(resolve, 100));

  els.readerLoadingOverlay?.classList.add("done");
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (els.readerLoadingOverlay) {
    els.readerLoadingOverlay.remove();
    els.readerLoadingOverlay = null;
  }

  return true;
}

async function streamTextIntoReader(response, renderToken) {
  const text = await collectResponseText(response, renderToken);

  if (text === null || renderToken !== state.readerRenderToken) {
    return false;
  }

  return renderLongText(text, renderToken);
}

function showResumePrompt(item) {
  if (!els.readerResume) return;

  const saved = getReaderProgress(item?.id);

  if (!saved || Number(saved.percent || 0) <= 0 || saved.percent >= 99) {
    els.readerResume.hidden = true;
    return;
  }

  els.readerResume.hidden = false;
  els.readerResume.dataset.itemId = item.id;

  if (els.readerResumeButton) els.readerResumeButton.disabled = false;
  if (els.readerRestartButton) els.readerRestartButton.disabled = false;

  if (els.readerResumeText) {
    els.readerResumeText.textContent =
      `${saved.percent || 0}% 지점까지 읽었습니다.`;
  }
}


function triggerItemDownload(item) {
  if (!item) return;

  const url = getDownloadUrl(item);
  if (!url) return;

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

  state.activeReaderItem = item;
  state.suspendReaderProgressSave = true;
  const renderToken = ++state.readerRenderToken;

  document.body.classList.add("reader-open");
  mainHeaderCompactActive = false;
  els.siteHeader?.classList.remove("compact-mode");
  els.pageScrollTop?.classList.remove("visible");
  els.readerOverlay.hidden = false;

  if (els.readerPanel) els.readerPanel.scrollTop = 0;

  readerCompactActive = false;
  els.readerPanel?.classList.remove("reader-compact");
  els.readerScrollTop?.classList.remove("visible");
  if (els.readerResume) els.readerResume.hidden = true;

  els.readerCombination.textContent = item.combination || "";
  els.readerLength.textContent = item.lengthType || "";
  els.readerTitle.textContent = item.title || "제목 미상";
  els.readerAuthor.textContent = item.author || "작성자 미상";
  els.readerFileName.textContent = `원본 파일명: ${item.fileName || ""}`;

  state.readerLoadingStartedAt = performance.now();
  updateReaderBookmarkButton();
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

    const response = await fetch(`/api/content?${params.toString()}`);

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

    showResumePrompt(item);

    window.setTimeout(() => {
      state.suspendReaderProgressSave = false;
    }, 250);
  } catch (error) {
    window.clearInterval(waitTimer);

    if (renderToken !== state.readerRenderToken) return;

    unlockReaderScroll();
    els.readerBody.innerHTML =
      `<p class="reader-error">${escapeHtml(error?.message || "본문을 불러오지 못했습니다.")}</p>`;
    els.readerLoadingOverlay = null;
    els.readerContent = null;
  }
}

function closeReader() {
  unlockReaderScroll();
  state.suspendReaderProgressSave = false;

  const closingItem = state.activeReaderItem;
  const savedProgress = saveReaderProgress();

  if (closingItem && savedProgress && state.user) {
    persistProgress(closingItem, savedProgress);
  }

  state.readerRenderToken += 1;
  state.activeReaderItem = null;
  resetLargeReaderState();
  els.readerOverlay.hidden = true;
  readerCompactActive = false;
  els.readerPanel?.classList.remove("reader-compact");
  els.readerScrollTop?.classList.remove("visible");
  document.body.classList.remove("reader-open");
  els.readerBody.textContent = "";
  updatePageScrollTopButton();
  updateCompactHeader();
}


if (!["latest", "title", "author"].includes(state.sort)) {
  state.sort = "latest";
}
els.sortSelect.value = state.sort;

els.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  localStorage.setItem("archiveSort", state.sort);
  render();
});

els.filterToggleButton?.addEventListener("click", () => {
  state.mobileFiltersOpen = !state.mobileFiltersOpen;
  els.controlsGrid?.classList.toggle("mobile-open", state.mobileFiltersOpen);
  els.filterToggleButton.setAttribute(
    "aria-expanded",
    state.mobileFiltersOpen ? "true" : "false"
  );
});

els.resetFiltersButton?.addEventListener("click", () => {
  state.search = "";
  state.combination = "전체";
  state.length = "전체";
  state.source = "전체";
  state.bookmarkOnly = false;
  state.readingOnly = false;

  els.searchInput.value = "";
  if (els.compactSearchInput) els.compactSearchInput.value = "";
  els.clearSearch.classList.remove("visible");
  els.compactClearSearch?.classList.remove("visible");

  els.combinationFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.combination === "전체");
  });

  els.lengthFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.length === "전체");
  });

  els.sourceFilters?.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.source === "전체");
  });

  syncQuickFilterButtons();
  render();
});

els.readerResume?.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const item = state.activeReaderItem;
  if (!item || !els.readerPanel) return;

  event.preventDefault();
  event.stopPropagation();

  if (button.id === "readerResumeButton") {
    const saved = getReaderProgress(item.id);
    if (!saved) {
      els.readerResume.hidden = true;
      return;
    }

    if (isLargeReaderFile(item) && state.largeReaderChunks) {
      const total = state.largeReaderChunks.length;
      let targetIndex = Number(saved.chunkIndex);

      if (!Number.isFinite(targetIndex)) {
        const percent = Math.max(0, Math.min(99, Number(saved.percent || 0)));
        targetIndex = Math.floor((percent / 100) * total);
      }

      targetIndex = Math.max(0, Math.min(total - 1, targetIndex));

      els.readerResumeButton.disabled = true;
      els.readerRestartButton.disabled = true;
      els.readerResumeText.textContent = "읽던 위치까지 준비하고 있습니다…";

      await renderLargeReaderThrough(targetIndex, state.readerRenderToken);

      const targetChunk = els.readerContent?.querySelector(
        `.reader-virtual-chunk[data-reader-chunk-index="${targetIndex}"]`
      );

      if (targetChunk) {
        const ratio = Math.max(
          0,
          Math.min(1, Number(saved.chunkRatio || 0))
        );

        state.suspendReaderProgressSave = true;
        els.readerResume.hidden = true;

        const targetTop =
          targetChunk.offsetTop +
          targetChunk.offsetHeight * ratio -
          92;

        els.readerPanel.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
        });

        window.setTimeout(() => {
          state.suspendReaderProgressSave = false;
          saveReaderProgress();
        }, 900);
      }

      els.readerResumeButton.disabled = false;
      els.readerRestartButton.disabled = false;
      return;
    }

    const target = getResumeTarget(saved);

    temporarilySuspendProgressSave(900);
    els.readerResume.hidden = true;

    requestAnimationFrame(() => {
      els.readerPanel.scrollTo({
        top: target,
        behavior: "smooth",
      });
    });

    return;
  }

  if (button.id === "readerRestartButton") {
    if (state.user) {
      updateUserLibraryEntry(item.id, {
        progressPercent: 0,
        scrollTop: 0,
        chunkIndex: null,
        chunkRatio: null,
        updatedAt: Date.now(),
      });

      persistProgress(item, {
        mode: "scroll",
        scrollTop: 0,
        percent: 0,
      });
    }

    temporarilySuspendProgressSave(500);
    els.readerResume.hidden = true;

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
  localStorage.setItem(UI_THEME_KEY, nextTheme);
  applyUserPreferences();
});

els.readerSpacingButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    const spacing = button.dataset.readerSpacing;
    if (!["compact", "normal", "wide"].includes(spacing)) return;
    localStorage.setItem(READER_SPACING_KEY, spacing);
    applyUserPreferences();
  });
});

els.loginButton?.addEventListener("click", () => {
  if (state.user) {
    els.accountModalUser.textContent =
      `${state.user.userId} 계정으로 로그인되어 있습니다.`;
    openModal(els.accountModal);
    return;
  }

  openAuthModal("login");
});

els.signupButton?.addEventListener("click", () => {
  openSignupModal();
});

els.helpButton?.addEventListener("click", () => {
  openModal(els.helpModal);
});

els.helpLoginButton?.addEventListener("click", () => {
  openAuthModal("login");
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
    updateAccountUi();
    await loadUserLibrary();
    await recordLoggedInVisit();

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

    setAuthToken(data.token);
    state.user = data.user;
    updateAccountUi();
    await loadUserLibrary();
    await recordLoggedInVisit();

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
      await userApi("/api/user/item", {
        method: "POST",
        body: JSON.stringify({
          action: "bookmark",
          fileId,
          bookmarked: finalValue,
        }),
      });
    } catch (error) {
      console.warn("북마크 저장 실패", error);
    }
  }, 650);

  state.bookmarkSaveTimers.set(fileId, timer);
});

els.librarySearchInput?.addEventListener("input", (event) => {
  state.librarySearch = event.target.value || "";
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

    state.librarySearch = "";
    if (els.librarySearchInput) els.librarySearchInput.value = "";
    renderUserLibraryModal();
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
      await userApi("/api/user/item", {
        method: "POST",
        body: JSON.stringify({
          action: kind === "bookmarks" ? "bookmark" : "remove_recent",
          fileId,
          bookmarked: false,
        }),
      });

      const current = getUserLibraryEntry(fileId);
      if (current) {
        updateUserLibraryEntry(
          fileId,
          kind === "bookmarks"
            ? { bookmarked: false, updatedAt: Date.now() }
            : { viewedAt: null, updatedAt: Date.now() }
        );
      }

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
  openReader(item);
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    closeModal(document.getElementById(button.dataset.closeModal));
  });
});

for (const modal of [
  els.authModal,
  els.signupModal,
  els.helpModal,
  els.libraryModal,
  els.accountModal,
]) {
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal);
  });
}

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

  // Activate only after the original hero search box has essentially left
  // the viewport. Use a wide exit threshold so the sticky header's own
  // height change cannot immediately flip the state back.
  if (!mainHeaderCompactActive && searchRect.bottom <= 8) {
    mainHeaderCompactActive = true;
    els.siteHeader.classList.add("compact-mode");
    return;
  }

  if (mainHeaderCompactActive && searchRect.bottom >= 80) {
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

els.combinationFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-combination]");
  if (!button) return;

  state.combination = button.dataset.combination;
  els.combinationFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.combination === state.combination);
  });
  render();
});

els.lengthFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-length]");
  if (!button) return;

  state.length = button.dataset.length;
  els.lengthFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.length === state.length);
  });
  render();
});

els.sourceFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-source]");
  if (!button) return;

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

function openContentItem(item) {
  if (!item) return;

  if (item.source === "postype") {
    if (!item.url) return;
    window.open(item.url, "_blank", "noopener,noreferrer");
    return;
  }

  openReader(item);
}

function handleContentOpenClick(event) {
  if (event.target.closest("[data-download-id]")) {
    event.stopPropagation();
    return;
  }

  openContentItem(findItemFromEvent(event));
}

els.contentGrid.addEventListener("click", handleContentOpenClick);
els.contentListBody.addEventListener("click", handleContentOpenClick);

for (const container of [els.contentGrid, els.contentListBody]) {
  container.addEventListener("keydown", (event) => {
    if (event.target.closest("[data-download-id]")) return;
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
    closeModal(openSimpleModal);
    return;
  }

  if (!els.readerOverlay.hidden) closeReader();
});



let readerProgressSaveTimer = 0;
let readerCompactActive = false;

function syncReaderCompactMode(scrollTop) {
  if (!els.readerPanel) return;

  // Header height itself changes when compact mode switches.
  // Separate enter/exit thresholds prevent the scroll position from bouncing
  // around one threshold and causing visible flicker.
  if (!readerCompactActive && scrollTop >= 130) {
    readerCompactActive = true;
    els.readerPanel.classList.add("reader-compact");
  } else if (readerCompactActive && scrollTop <= 55) {
    readerCompactActive = false;
    els.readerPanel.classList.remove("reader-compact");
  }
}

function updateReaderScrollUi() {
  if (!els.readerPanel) return;

  const scrollTop = els.readerPanel.scrollTop;

  window.clearTimeout(readerProgressSaveTimer);
  readerProgressSaveTimer = window.setTimeout(() => {
    const saved = saveReaderProgress();

    if (
      saved &&
      state.user &&
      state.activeReaderItem &&
      // Frequent scroll events stay client-side; D1 sync is at most every 5 minutes.
      Date.now() - state.lastRemoteProgressAt >= 5 * 60 * 1000
    ) {
      persistProgress(state.activeReaderItem, saved);
    }
  }, 240);

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

els.readerScrollTop?.addEventListener("click", () => {
  els.readerPanel?.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});



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


applyUserPreferences();
updatePageScrollTopButton();
updateCompactHeader();
syncViewButtons();
syncQuickFilterButtons();
updateAccountUi();
loadArchive();
restoreAuth();
