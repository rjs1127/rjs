const state = {
  items: [],
  combination: "전체",
  length: "전체",
  search: "",
  view: localStorage.getItem("archiveViewV2") || "list",
};

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
  refreshButton: document.getElementById("refreshButton"),
  cardViewButton: document.getElementById("cardViewButton"),
  listViewButton: document.getElementById("listViewButton"),
  heroEyebrow: document.getElementById("heroEyebrow"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  heroSection: document.getElementById("heroSection"),
  readerOverlay: document.getElementById("readerOverlay"),
  closeReader: document.getElementById("closeReader"),
  readerCombination: document.getElementById("readerCombination"),
  readerLength: document.getElementById("readerLength"),
  readerTitle: document.getElementById("readerTitle"),
  readerAuthor: document.getElementById("readerAuthor"),
  readerFileName: document.getElementById("readerFileName"),
  readerBody: document.getElementById("readerBody"),
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
  if (settings.subtitle) els.heroSubtitle.textContent = settings.subtitle;

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

function getFilteredItems() {
  const q = state.search.trim().toLocaleLowerCase("ko-KR");

  return state.items.filter((item) => {
    const matchesCombination =
      state.combination === "전체" || item.combination === state.combination;
    const matchesLength =
      state.length === "전체" || item.lengthType === state.length;

    const haystack = `${item.title || ""} ${item.author || ""} ${item.fileName || ""}`
      .toLocaleLowerCase("ko-KR");

    return matchesCombination && matchesLength && (!q || haystack.includes(q));
  });
}

function render() {
  const items = getFilteredItems();
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

async function openReader(item) {
  if (!item) return;

  document.body.classList.add("reader-open");
  els.readerOverlay.hidden = false;
  els.readerOverlay.scrollTop = 0;
  els.readerScrollTop?.classList.remove("visible");
  els.readerCombination.textContent = item.combination || "";
  els.readerLength.textContent = item.lengthType || "";
  els.readerTitle.textContent = item.title || "제목 미상";
  els.readerAuthor.textContent = item.author || "작성자 미상";
  els.readerFileName.textContent = `원본 파일명: ${item.fileName || ""}`;

  els.readerBody.innerHTML = `
    <div class="reader-loading">
      <div class="spinner" aria-hidden="true"></div>
      <p>본문을 불러오는 중…</p>
    </div>`;

  try {
    const params = new URLSearchParams({
      id: item.id,
      modified: item.modifiedTime || "unknown",
    });
    const response = await fetch(`/api/content?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data?.error || "본문을 불러오지 못했습니다.");
    els.readerBody.textContent = data.content || "";
  } catch (error) {
    els.readerBody.innerHTML =
      `<p class="reader-error">${escapeHtml(error?.message || "본문을 불러오지 못했습니다.")}</p>`;
  }
}

function closeReader() {
  els.readerOverlay.hidden = true;
  document.body.classList.remove("reader-open");
  els.readerBody.textContent = "";
}

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


function updateReaderScrollTopButton() {
  if (!els.readerScrollTop || !els.readerOverlay) return;

  els.readerScrollTop.classList.toggle(
    "visible",
    els.readerOverlay.scrollTop > 360
  );
}

els.readerOverlay.addEventListener("scroll", updateReaderScrollTopButton, {
  passive: true,
});

els.readerScrollTop?.addEventListener("click", () => {
  els.readerOverlay.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});


syncViewButtons();
loadArchive();
