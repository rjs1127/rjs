const state = {
  items: [],
  combination: "전체",
  length: "전체",
  search: "",
  sort: localStorage.getItem("archiveSort") || "latest",
  view: localStorage.getItem("archiveViewV2") || "list",
  mobileFiltersOpen: false,
  activeReaderItem: null,
  readerRenderToken: 0,
  suspendReaderProgressSave: false,
  readerLoadingStartedAt: 0,
};

const LARGE_FILE_LOADING_THRESHOLD_BYTES = 810 * 1024;
const LARGE_FILE_MIN_LOADING_VISIBLE_MS = 1700;

const els = {
  status: document.getElementById("status"),
  contentGrid: document.getElementById("contentGrid"),
  contentListWrap: document.getElementById("contentListWrap"),
  contentListBody: document.getElementById("contentListBody"),
  emptyState: document.getElementById("emptyState"),
  resultCount: document.getElementById("resultCount"),
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  combinationFilters: document.getElementById("combinationFilters"),
  lengthFilters: document.getElementById("lengthFilters"),
  controlsGrid: document.getElementById("controlsGrid"),
  filterToggleButton: document.getElementById("filterToggleButton"),
  filterSummary: document.getElementById("filterSummary"),
  sortSelect: document.getElementById("sortSelect"),
  resetFiltersButton: document.getElementById("resetFiltersButton"),
  refreshButton: document.getElementById("refreshButton"),
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
};

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

function applySettings(settings = {}) {
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

    const haystack = normalizeSearchText(
      `${item.title || ""} ${item.author || ""} ${item.fileName || ""}`
    );

    const matchesSearch =
      tokens.length === 0 || tokens.every((token) => haystack.includes(token));

    return matchesCombination && matchesLength && matchesSearch;
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

function renderCards(items) {
  els.contentGrid.innerHTML = items.map((item) => `
    <article class="content-card" tabindex="0" role="button"
      data-id="${escapeHtml(item.id)}"
      aria-label="${escapeHtml(item.title)} 본문 열기">
      <div class="card-tags">
        <span class="card-tag">${escapeHtml(item.combination)}</span>
        <span class="card-tag">${escapeHtml(item.lengthType)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <p class="card-author">${escapeHtml(item.author)}</p>
      <span class="card-arrow" aria-hidden="true">↗</span>
    </article>
  `).join("");
}

function renderList(items) {
  els.contentListBody.innerHTML = items.map((item) => `
    <tr tabindex="0" data-id="${escapeHtml(item.id)}">
      <td>${escapeHtml(item.combination)}</td>
      <td>${escapeHtml(item.lengthType)}</td>
      <td class="list-title">${escapeHtml(item.title)}</td>
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
  if (!id) return null;

  try {
    const parsed = JSON.parse(
      localStorage.getItem(`${READER_PROGRESS_PREFIX}${id}`) || "null"
    );

    if (!parsed || !Number.isFinite(parsed.scrollTop)) return null;
    return parsed;
  } catch {
    return null;
  }
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
  if (state.suspendReaderProgressSave) return;

  const item = state.activeReaderItem;
  if (!item || !els.readerPanel) return;

  const maxScroll = Math.max(
    0,
    els.readerPanel.scrollHeight - els.readerPanel.clientHeight
  );

  const scrollTop = Math.max(0, els.readerPanel.scrollTop);
  const percent = maxScroll > 0
    ? Math.min(100, Math.round((scrollTop / maxScroll) * 100))
    : 0;

  try {
    if (scrollTop < 40 || percent >= 99) {
      localStorage.removeItem(`${READER_PROGRESS_PREFIX}${item.id}`);
      return;
    }

    localStorage.setItem(
      `${READER_PROGRESS_PREFIX}${item.id}`,
      JSON.stringify({
        scrollTop,
        percent,
        updatedAt: Date.now(),
      })
    );
  } catch {}
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

async function renderLongText(text, renderToken) {
  if (!els.readerContent) return;

  els.readerContent.textContent = "";

  const totalChars = Math.max(1, text.length);

  // 긴 파일일수록 작은 단위로 나눠 메인 스레드를 자주 양보한다.
  const chunkSize =
    totalChars > 3000000 ? 18000 :
    totalChars > 1200000 ? 26000 :
    totalChars > 500000 ? 36000 :
    60000;

  let offset = 0;
  let batchCount = 0;

  while (offset < text.length) {
    if (renderToken !== state.readerRenderToken) return false;

    const end = Math.min(text.length, offset + chunkSize);
    els.readerContent.appendChild(
      document.createTextNode(text.slice(offset, end))
    );

    offset = end;
    batchCount += 1;

    const ratio = offset / totalChars;

    setReaderLoadingProgress(
      64 + ratio * 31,
      "본문을 화면에 배치하는 중…",
      ratio < .7
        ? "긴 본문을 조금씩 나누어 표시하고 있습니다."
        : "거의 다 준비됐습니다."
    );

    // 몇 덩어리마다 브라우저에게 페인트/입력 처리 시간을 준다.
    if (batchCount % 2 === 0) {
      await nextFrame();
    } else {
      await nextTask();
    }
  }

  if (renderToken !== state.readerRenderToken) return false;

  setReaderLoadingProgress(
    96,
    "마지막 화면 정리 중…",
    "글 배치와 스크롤 영역을 계산하고 있습니다."
  );

  // 실제 scrollHeight 계산을 여기서 끝내고 로딩 UI를 유지한다.
  await nextFrame();
  void els.readerContent.offsetHeight;
  await nextFrame();
  await nextTask();
  await nextFrame();

  setReaderLoadingProgress(
    100,
    "준비 완료",
    "이제 바로 읽을 수 있습니다."
  );

  const item = state.activeReaderItem;
  const isLarge = isLargeReaderFile(item);

  if (isLarge) {
    const elapsed = performance.now() - (state.readerLoadingStartedAt || 0);
    const remaining = Math.max(
      0,
      LARGE_FILE_MIN_LOADING_VISIBLE_MS - elapsed
    );

    setReaderLoadingProgress(
      100,
      "준비 완료",
      "긴 파일이라 스크롤이 안정될 때까지 잠시만 기다려주세요."
    );

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    // 마지막 레이아웃/스크롤 높이가 안정되도록 몇 프레임 더 기다린다.
    await nextFrame();
    await nextFrame();
    await nextTask();
  } else {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (renderToken !== state.readerRenderToken) return false;

  els.readerLoadingOverlay?.classList.add("done");
  await new Promise((resolve) => setTimeout(resolve, isLarge ? 260 : 150));

  if (els.readerLoadingOverlay) {
    els.readerLoadingOverlay.remove();
    els.readerLoadingOverlay = null;
  }

  unlockReaderScroll();
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

  if (!saved || saved.scrollTop < 40 || saved.percent >= 99) {
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

async function openReader(item) {
  if (!item) return;

  state.activeReaderItem = item;
  state.suspendReaderProgressSave = true;
  const renderToken = ++state.readerRenderToken;

  document.body.classList.add("reader-open");
  els.pageScrollTop?.classList.remove("visible");
  els.readerOverlay.hidden = false;

  if (els.readerPanel) els.readerPanel.scrollTop = 0;

  els.readerPanel?.classList.remove("reader-compact");
  els.readerScrollTop?.classList.remove("visible");
  if (els.readerResume) els.readerResume.hidden = true;

  els.readerCombination.textContent = item.combination || "";
  els.readerLength.textContent = item.lengthType || "";
  els.readerTitle.textContent = item.title || "제목 미상";
  els.readerAuthor.textContent = item.author || "작성자 미상";
  els.readerFileName.textContent = `원본 파일명: ${item.fileName || ""}`;

  state.readerLoadingStartedAt = performance.now();
  showReaderLoading(item);

  let waitingProgress = 5;
  const waitTimer = window.setInterval(() => {
    waitingProgress = Math.min(38, waitingProgress + Math.max(1, (40 - waitingProgress) * .08));
    setReaderLoadingProgress(
      waitingProgress,
      "본문을 불러오는 중…",
      Number(item.size || 0) > 700000
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
  saveReaderProgress();
  state.readerRenderToken += 1;
  state.activeReaderItem = null;
  els.readerOverlay.hidden = true;
  els.readerPanel?.classList.remove("reader-compact");
  els.readerScrollTop?.classList.remove("visible");
  document.body.classList.remove("reader-open");
  els.readerBody.textContent = "";
  updatePageScrollTopButton();
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

  els.searchInput.value = "";
  els.clearSearch.classList.remove("visible");

  els.combinationFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.combination === "전체");
  });

  els.lengthFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.length === "전체");
  });

  render();
});

els.readerResume?.addEventListener("click", (event) => {
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
    try {
      localStorage.removeItem(`${READER_PROGRESS_PREFIX}${item.id}`);
    } catch {}

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


els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  els.clearSearch.classList.toggle("visible", Boolean(state.search));
  render();
});

els.clearSearch.addEventListener("click", () => {
  state.search = "";
  els.searchInput.value = "";
  els.clearSearch.classList.remove("visible");
  els.searchInput.focus();
  render();
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

function findItemFromEvent(event) {
  const target = event.target.closest("[data-id]");
  if (!target) return null;
  return state.items.find((entry) => entry.id === target.dataset.id);
}

els.contentGrid.addEventListener("click", (event) => openReader(findItemFromEvent(event)));
els.contentListBody.addEventListener("click", (event) => openReader(findItemFromEvent(event)));

for (const container of [els.contentGrid, els.contentListBody]) {
  container.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = findItemFromEvent(event);
    if (!item) return;
    event.preventDefault();
    openReader(item);
  });
}

els.cardViewButton.addEventListener("click", () => setView("card"));
els.listViewButton.addEventListener("click", () => setView("list"));
els.closeReader.addEventListener("click", closeReader);

els.readerOverlay.addEventListener("click", (event) => {
  if (event.target === els.readerOverlay) closeReader();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.readerOverlay.hidden) closeReader();
});

els.refreshButton.addEventListener("click", () => loadArchive(true));


let readerProgressSaveTimer = 0;

function updateReaderScrollUi() {
  if (!els.readerPanel) return;

  const scrollTop = els.readerPanel.scrollTop;

  window.clearTimeout(readerProgressSaveTimer);
  readerProgressSaveTimer = window.setTimeout(saveReaderProgress, 240);

  els.readerPanel.classList.toggle(
    "reader-compact",
    scrollTop > 90
  );

  els.readerScrollTop?.classList.toggle(
    "visible",
    scrollTop > 180
  );
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

window.addEventListener("scroll", updatePageScrollTopButton, {
  passive: true,
});

els.pageScrollTop?.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});


updatePageScrollTopButton();
syncViewButtons();
loadArchive();
