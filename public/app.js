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
  largeReaderChunks: null,
  largeReaderRenderedCount: 0,
  largeReaderRendering: false,
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

    if (!parsed) return null;

    const hasScroll = Number.isFinite(parsed.scrollTop);
    const hasChunk = Number.isFinite(parsed.chunkIndex);

    if (!hasScroll && !hasChunk && !Number.isFinite(parsed.percent)) {
      return null;
    }

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

  try {
    if (isLargeReaderFile(item) && state.largeReaderChunks) {
      const position = getLargeReaderPosition();
      if (!position) return;

      if ((position.index === 0 && position.ratio < 0.03) || position.percent >= 99) {
        localStorage.removeItem(`${READER_PROGRESS_PREFIX}${item.id}`);
        return;
      }

      localStorage.setItem(
        `${READER_PROGRESS_PREFIX}${item.id}`,
        JSON.stringify({
          mode: "chunk",
          chunkIndex: position.index,
          chunkRatio: position.ratio,
          percent: position.percent,
          updatedAt: Date.now(),
        })
      );
      return;
    }

    const maxScroll = Math.max(
      0,
      els.readerPanel.scrollHeight - els.readerPanel.clientHeight
    );

    const scrollTop = Math.max(0, els.readerPanel.scrollTop);
    const percent = maxScroll > 0
      ? Math.min(100, Math.round((scrollTop / maxScroll) * 100))
      : 0;

    if (scrollTop < 40 || percent >= 99) {
      localStorage.removeItem(`${READER_PROGRESS_PREFIX}${item.id}`);
      return;
    }

    localStorage.setItem(
      `${READER_PROGRESS_PREFIX}${item.id}`,
      JSON.stringify({
        mode: "scroll",
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
  saveReaderProgress();
  state.readerRenderToken += 1;
  state.activeReaderItem = null;
  resetLargeReaderState();
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
