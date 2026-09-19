const state = {
  items: [],
  combination: "전체",
  length: "전체",
  search: "",
};

const els = {
  status: document.getElementById("status"),
  contentGrid: document.getElementById("contentGrid"),
  emptyState: document.getElementById("emptyState"),
  resultCount: document.getElementById("resultCount"),
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  combinationFilters: document.getElementById("combinationFilters"),
  lengthFilters: document.getElementById("lengthFilters"),
  refreshButton: document.getElementById("refreshButton"),
  readerOverlay: document.getElementById("readerOverlay"),
  closeReader: document.getElementById("closeReader"),
  readerCombination: document.getElementById("readerCombination"),
  readerLength: document.getElementById("readerLength"),
  readerTitle: document.getElementById("readerTitle"),
  readerAuthor: document.getElementById("readerAuthor"),
  readerBody: document.getElementById("readerBody"),
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
  els.emptyState.hidden = true;
}

function hideStatus() {
  els.status.hidden = true;
}

async function loadArchive(force = false) {
  showStatus("Google Drive에서 콘텐츠를 불러오고 있어요.");
  els.resultCount.textContent = "불러오는 중…";

  try {
    const url = force ? `/api/archive?refresh=${Date.now()}` : "/api/archive";
    const response = await fetch(url, { cache: force ? "no-store" : "default" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "콘텐츠를 불러오지 못했습니다.");
    }

    state.items = Array.isArray(data.items) ? data.items : [];
    buildCombinationFilters(data.combinations || []);
    hideStatus();
    render();
  } catch (error) {
    console.error(error);
    els.resultCount.textContent = "연결 오류";
    showStatus(
      error?.message ||
        "Google Drive 연결에 실패했습니다. Cloudflare 환경 변수 설정을 확인해주세요.",
      true
    );
  }
}

function buildCombinationFilters(combinations) {
  const values = ["전체", ...new Set(combinations.filter(Boolean))];
  els.combinationFilters.innerHTML = values
    .map(
      (value) => `
        <button
          class="chip ${state.combination === value ? "active" : ""}"
          type="button"
          data-combination="${escapeHtml(value)}"
        >${escapeHtml(value)}</button>
      `
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

    const matchesSearch = !q || haystack.includes(q);

    return matchesCombination && matchesLength && matchesSearch;
  });
}

function render() {
  const items = getFilteredItems();

  els.resultCount.textContent = `총 ${items.length.toLocaleString("ko-KR")}개`;

  if (!items.length) {
    els.contentGrid.hidden = true;
    els.emptyState.hidden = false;
    return;
  }

  els.emptyState.hidden = true;
  els.contentGrid.hidden = false;
  els.contentGrid.innerHTML = items
    .map(
      (item) => `
      <article
        class="content-card"
        tabindex="0"
        role="button"
        data-id="${escapeHtml(item.id)}"
        aria-label="${escapeHtml(item.title)} 본문 열기"
      >
        <div class="card-tags">
          <span class="card-tag">${escapeHtml(item.combination)}</span>
          <span class="card-tag">${escapeHtml(item.lengthType)}</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-author">${escapeHtml(item.author)}</p>
        <span class="card-arrow" aria-hidden="true">↗</span>
      </article>
    `
    )
    .join("");
}

async function openReader(item) {
  if (!item) return;

  document.body.classList.add("reader-open");
  els.readerOverlay.hidden = false;
  els.readerCombination.textContent = item.combination || "";
  els.readerLength.textContent = item.lengthType || "";
  els.readerTitle.textContent = item.title || "파일명 불명";
  els.readerAuthor.textContent = item.author || "파일명 불명";
  els.readerBody.innerHTML = `
    <div class="reader-loading">
      <div class="spinner" aria-hidden="true"></div>
      <p>본문을 불러오는 중…</p>
    </div>
  `;

  try {
    const response = await fetch(`/api/content?id=${encodeURIComponent(item.id)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "본문을 불러오지 못했습니다.");
    }

    els.readerBody.textContent = data.content || "";
  } catch (error) {
    console.error(error);
    els.readerBody.innerHTML = `<p class="reader-error">${escapeHtml(
      error?.message || "본문을 불러오지 못했습니다."
    )}</p>`;
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
    chip.classList.toggle(
      "active",
      chip.dataset.combination === state.combination
    );
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

els.contentGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;

  const item = state.items.find((entry) => entry.id === card.dataset.id);
  openReader(item);
});

els.contentGrid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-id]");
  if (!card) return;
  event.preventDefault();

  const item = state.items.find((entry) => entry.id === card.dataset.id);
  openReader(item);
});

els.closeReader.addEventListener("click", closeReader);

els.readerOverlay.addEventListener("click", (event) => {
  if (event.target === els.readerOverlay) closeReader();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.readerOverlay.hidden) closeReader();
});

els.refreshButton.addEventListener("click", () => loadArchive(true));

loadArchive();
