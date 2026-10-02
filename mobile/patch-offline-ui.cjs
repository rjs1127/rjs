const fs = require("fs");
const path = require("path");

const root = __dirname;
const appPath = path.join(root, "www", "app.js");
const indexPath = path.join(root, "www", "index.html");
const themePath = path.join(root, "www", "theme.css");

let app = fs.readFileSync(appPath, "utf8");
let index = fs.readFileSync(indexPath, "utf8");
let theme = fs.readFileSync(themePath, "utf8");

// Windows에서 생성된 CRLF 파일도 패치 문자열과 동일하게 처리한다.
app = app.replace(/\r\n/g, "\n");
index = index.replace(/\r\n/g, "\n");
theme = theme.replace(/\r\n/g, "\n");

function requireText(source, marker, label) {
  if (!source.includes(marker)) {
    throw new Error(`${label} 위치를 찾지 못했습니다.`);
  }
}

function replaceOnce(source, before, after, label) {
  requireText(source, before, label);
  return source.replace(before, after);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label} 시작 위치를 찾지 못했습니다.`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label} 끝 위치를 찾지 못했습니다.`);
  return source.slice(0, start) + replacement + "\n" + source.slice(end);
}

requireText(app, "const mobileOfflineFilesystem", "기존 오프라인 패치");
requireText(app, "async function saveMobileOfflineContent(item, text) {", "오프라인 본문 저장 함수");

// 1) 마이페이지 > 내 서재 옆에 앱 전용 오프라인 저장 탭 추가
if (!index.includes('data-profile-tab="offline"')) {
  const libraryTab = '            <button type="button" data-profile-tab="library">내 서재</button>';
  index = replaceOnce(
    index,
    libraryTab,
    libraryTab + '\n            <button type="button" data-profile-tab="offline">오프라인 저장</button>',
    "내 서재 탭"
  );
}

// 2) 앱 전용 스타일: 카드 = 작은 표시 / 리스트 = 은은한 배경 / 다크모드 포함
if (!theme.includes("RJS MOBILE OFFLINE UI")) {
  theme += `

/* ===== RJS MOBILE OFFLINE UI ===== */
.mobile-offline-card-mark {
  position:absolute;
  left:16px;
  bottom:20px;
  z-index:1;
  display:inline-flex;
  align-items:center;
  min-height:18px;
  padding:2px 6px;
  border:1px solid var(--theme-line-soft);
  border-radius:999px;
  background:var(--theme-surface-soft);
  color:var(--theme-muted);
  font-size:9px;
  font-weight:700;
  line-height:1;
  letter-spacing:-.15px;
  opacity:.72;
  pointer-events:none;
}
html.theme-light .content-list tbody tr.mobile-offline-saved {
  background:rgba(92,88,82,.045);
}
html.theme-dark .content-list tbody tr.mobile-offline-saved {
  background:rgba(255,255,255,.032);
}
html.theme-light .content-list tbody tr.mobile-offline-saved:hover,
html.theme-dark .content-list tbody tr.mobile-offline-saved:hover {
  background:var(--theme-hover);
}
.mobile-offline-profile-entry {
  cursor:pointer;
}
.mobile-offline-profile-entry:hover,
.mobile-offline-profile-entry:focus-visible {
  background:var(--theme-hover);
}
.mobile-offline-profile-entry:focus-visible {
  outline:2px solid var(--theme-line);
  outline-offset:-2px;
}
@media (max-width:640px) {
  .mobile-offline-card-mark {
    left:14px;
    bottom:18px;
    font-size:8.5px;
    opacity:.68;
  }
}
/* ===== /RJS MOBILE OFFLINE UI ===== */
`;
}

// 3) 기존 본문 저장 함수가 저장 직후 UI 상태도 갱신하도록 확장
app = replaceBetween(
  app,
  "async function saveMobileOfflineContent(item, text) {",
  "async function readMobileOfflineContent(item) {",
`async function saveMobileOfflineContent(item, text) {
  if (!item?.id) return false;

  const saved = await writeMobileOfflineFile(
    getMobileOfflineContentPath(item),
    text
  );

  if (saved) {
    const bytes = new TextEncoder().encode(String(text ?? "")).byteLength;
    updateMobileOfflineEntry(item, bytes, Date.now());
  }

  return saved;
}`,
  "오프라인 본문 저장 함수"
);

// 4) 오프라인 파일 스캔/기존 캐시 마이그레이션/용량/전체삭제 관리
const archiveMarker = "async function loadArchive(force = false) {";
if (!app.includes("RJS MOBILE OFFLINE UI STATE")) {
  requireText(app, archiveMarker, "목록 로드 함수");
  const helpers = `
// ===== RJS MOBILE OFFLINE UI STATE =====
const mobileOfflineUiState = {
  loaded: false,
  refreshing: false,
  entries: new Map(),
  totalBytes: 0,
};

function isMobileOfflineAppRuntime() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

function formatMobileOfflineMegabytes(bytes) {
  const mb = Math.max(0, Number(bytes || 0)) / (1024 * 1024);
  if (mb < 1) return \`${'${mb.toFixed(2)}'} MB\`;
  if (mb < 10) return \`${'${mb.toFixed(1)}'} MB\`;
  return \`${'${Math.round(mb)}'} MB\`;
}

function getMobileOfflineEntries() {
  return [...mobileOfflineUiState.entries.values()].sort((a, b) =>
    Number(b.savedAt || 0) - Number(a.savedAt || 0) ||
    String(a.title || "").localeCompare(String(b.title || ""), "ko")
  );
}

function isMobileOfflineSaved(itemOrId) {
  const id = typeof itemOrId === "object" ? itemOrId?.id : itemOrId;
  return Boolean(id && mobileOfflineUiState.entries.has(String(id)));
}

function updateMobileOfflineEntry(item, bytes = 0, savedAt = Date.now()) {
  if (!item?.id || item.source === "postype") return;

  const id = String(item.id);
  const old = mobileOfflineUiState.entries.get(id);
  if (old) {
    mobileOfflineUiState.totalBytes = Math.max(
      0,
      mobileOfflineUiState.totalBytes - Math.max(0, Number(old.bytes || 0))
    );
  }

  const entry = {
    id,
    title: String(item.title || "제목 미상"),
    author: String(item.author || "작성자 미상"),
    bytes: Math.max(0, Number(bytes || 0)),
    savedAt: Math.max(0, Number(savedAt || Date.now())),
  };

  mobileOfflineUiState.entries.set(id, entry);
  mobileOfflineUiState.totalBytes += entry.bytes;
  mobileOfflineUiState.loaded = true;

  if (state.items.length) render();
  if (state.profileOpen) renderProfilePage();
}

async function refreshMobileOfflineEntries({ rerender = true } = {}) {
  if (!isMobileOfflineAppRuntime() || !mobileOfflineFilesystem) return;
  if (mobileOfflineUiState.refreshing) return;

  mobileOfflineUiState.refreshing = true;

  try {
    await ensureMobileOfflineDirectory();

    const result = await mobileOfflineFilesystem.readdir({
      path: \`${'${MOBILE_OFFLINE_DIR}'}/content\`,
      directory: "DATA",
    });

    const files = Array.isArray(result?.files) ? result.files : [];
    const itemsBySafeId = new Map(
      state.items
        .filter((item) => item?.id && item.source !== "postype")
        .map((item) => [mobileOfflineSafeId(item.id), item])
    );

    const entries = new Map();
    let totalBytes = 0;

    for (const file of files) {
      const name = typeof file === "string" ? file : String(file?.name || "");
      if (!name.endsWith(".txt")) continue;

      const safeId = name.slice(0, -4);
      const item = itemsBySafeId.get(safeId);
      if (!item) continue;

      let bytes = Math.max(0, Number(typeof file === "object" ? file?.size : 0) || 0);
      let savedAt = Math.max(
        0,
        Number(typeof file === "object" ? (file?.mtime || file?.ctime) : 0) || 0
      );

      if (!bytes || !savedAt) {
        try {
          const stat = await mobileOfflineFilesystem.stat({
            path: \`${'${MOBILE_OFFLINE_DIR}'}/content/${'${name}'}\`,
            directory: "DATA",
          });
          if (!bytes) bytes = Math.max(0, Number(stat?.size || 0));
          if (!savedAt) savedAt = Math.max(0, Number(stat?.mtime || stat?.ctime || 0));
        } catch {}
      }

      const id = String(item.id);
      entries.set(id, {
        id,
        title: String(item.title || "제목 미상"),
        author: String(item.author || "작성자 미상"),
        bytes,
        savedAt,
      });
      totalBytes += bytes;
    }

    mobileOfflineUiState.entries = entries;
    mobileOfflineUiState.totalBytes = totalBytes;
    mobileOfflineUiState.loaded = true;
  } catch (error) {
    console.warn("[RJS Mobile] offline cache scan failed", error);
  } finally {
    mobileOfflineUiState.refreshing = false;
  }

  if (rerender) {
    if (state.items.length) render();
    if (state.profileOpen) renderProfilePage();
  }
}

async function clearAllMobileOfflineContent() {
  if (!isMobileOfflineAppRuntime() || !mobileOfflineFilesystem) return;

  try {
    await mobileOfflineFilesystem.rmdir({
      path: \`${'${MOBILE_OFFLINE_DIR}'}/content\`,
      directory: "DATA",
      recursive: true,
    });
  } catch {}

  await ensureMobileOfflineDirectory();
  mobileOfflineUiState.entries = new Map();
  mobileOfflineUiState.totalBytes = 0;
  mobileOfflineUiState.loaded = true;

  if (state.items.length) render();
  if (state.profileOpen) renderProfilePage();
}
// ===== /RJS MOBILE OFFLINE UI STATE =====

`;
  app = app.replace(archiveMarker, helpers + archiveMarker);
}

// 5) 목록 로드 직후 기존 저장 파일을 스캔해서 표시 상태 복원
if (!app.includes("await refreshMobileOfflineEntries({ rerender: false });")) {
  const itemsMarker = "    state.items = Array.isArray(data.items) ? data.items : [];";
  app = replaceOnce(
    app,
    itemsMarker,
    itemsMarker + "\n    await refreshMobileOfflineEntries({ rerender: false });",
    "목록 데이터 반영"
  );
}

// 6) 카드형 = 작은 '오프라인' 표시, 리스트형 = 클래스만 추가해서 배경 처리
app = replaceOnce(
  app,
  '<article class="content-card ${item.source === "postype" ? "postype-item" : "drive-item"}"',
  '<article class="content-card ${item.source === "postype" ? "postype-item" : "drive-item"}${isMobileOfflineSaved(item) ? " mobile-offline-saved" : ""}"',
  "카드 클래스"
);

app = replaceOnce(
  app,
  '      ${getPostypeMetaHtml(item)}\n      <div class="card-actions">',
  '      ${getPostypeMetaHtml(item)}\n      ${item.source !== "postype" && isMobileOfflineSaved(item) ? `<span class="mobile-offline-card-mark" title="오프라인 저장됨">오프라인</span>` : ""}\n      <div class="card-actions">',
  "카드 오프라인 표시"
);

app = replaceOnce(
  app,
  '      class="${item.source === "postype" ? "postype-item" : "drive-item"}">',
  '      class="${item.source === "postype" ? "postype-item" : "drive-item"}${isMobileOfflineSaved(item) ? " mobile-offline-saved" : ""}">',
  "리스트 클래스"
);

// 7) 마이페이지 렌더링에 오프라인 저장 탭 추가
if (!app.includes('state.profileTab === "offline"')) {
  const libraryBranch = '  } else if (state.profileTab === "library") {';
  const offlineBranch = `  } else if (state.profileTab === "offline") {
    const offlineEntries = getMobileOfflineEntries().filter((row) =>
      !q || normalizeSearchText(\`${'${row.title} ${row.author}'}\`).includes(q)
    );
    rows = offlineEntries;
    html = offlineEntries.length
      ? offlineEntries.map((row) => \`
        <div class="profile-entry mobile-offline-profile-entry"
          data-profile-offline-open="${'${escapeHtml(row.id)}'}"
          tabindex="0" role="button"
          aria-label="${'${escapeHtml(row.title)}'} 열기">
          <div class="profile-entry-main">
            <span class="profile-entry-title">${'${escapeHtml(row.title)}'}</span>
            <span class="profile-entry-meta">${'${escapeHtml(row.author)}'} · ${'${formatMobileOfflineMegabytes(row.bytes)}'}</span>
          </div>
        </div>\`).join("")
      : '<div class="profile-empty">오프라인에 저장된 작품이 없습니다.</div>';
`;
  app = replaceOnce(
    app,
    libraryBranch,
    offlineBranch + libraryBranch,
    "마이페이지 내 서재 분기"
  );
}

// 오프라인 탭은 위에 전체 저장 개수 + 실제 용량 표시
app = replaceOnce(
  app,
  '    els.profileListMeta.textContent = pagedKinds && total > shown ? `${shown} / ${total}개` : `${total}개`;',
  '    els.profileListMeta.textContent = state.profileTab === "offline"\n      ? `${mobileOfflineUiState.entries.size}개 · ${formatMobileOfflineMegabytes(mobileOfflineUiState.totalBytes)}`\n      : (pagedKinds && total > shown ? `${shown} / ${total}개` : `${total}개`);',
  "마이페이지 목록 요약"
);

app = replaceOnce(
  app,
  '    const clearable = state.profileTab === "bookmarks" || state.profileTab === "recent";\n    els.profileClearButton.hidden = !clearable;\n    els.profileClearButton.disabled = !clearable || total === 0;',
  '    const clearable = state.profileTab === "bookmarks" || state.profileTab === "recent" || state.profileTab === "offline";\n    const clearTotal = state.profileTab === "offline" ? mobileOfflineUiState.entries.size : total;\n    els.profileClearButton.hidden = !clearable;\n    els.profileClearButton.disabled = !clearable || clearTotal === 0;',
  "마이페이지 전체삭제 버튼"
);

// 8) showProfilePage에서 offline 탭 허용
app = replaceOnce(
  app,
  'state.profileTab = ["bookmarks","recent","likes","library"].includes(tab) ? tab : "bookmarks";',
  'state.profileTab = ["bookmarks","recent","likes","library","offline"].includes(tab) ? tab : "bookmarks";',
  "마이페이지 탭 허용 목록"
);

// 9) 오프라인 탭 선택 시 파일 상태 한 번 더 새로고침
app = replaceOnce(
  app,
  '    if (state.profileTab === "library" && !state.myLibraryLoaded) {\n      loadMyLibrary();\n    }',
  '    if (state.profileTab === "library" && !state.myLibraryLoaded) {\n      loadMyLibrary();\n    }\n    if (state.profileTab === "offline") {\n      refreshMobileOfflineEntries();\n    }',
  "마이페이지 탭 클릭 처리"
);

// 10) 오프라인 저장 목록 행 전체 클릭 시 바로 뷰어 열기
app = replaceOnce(
  app,
  'els.profileList?.addEventListener("click", async (event) => {\n  const libraryWork = event.target.closest("[data-library-work]");',
  'els.profileList?.addEventListener("click", async (event) => {\n  const offlineWork = event.target.closest("[data-profile-offline-open]");\n  if (offlineWork) {\n    const item = state.items.find((candidate) => String(candidate.id) === String(offlineWork.dataset.profileOfflineOpen));\n    if (item) openContentItem(item);\n    return;\n  }\n  const libraryWork = event.target.closest("[data-library-work]");',
  "오프라인 저장 목록 클릭"
);

// 키보드 접근성도 동일하게 Enter/Space로 열기
if (!app.includes("data-profile-offline-open][tabindex")) {
  const searchListener = 'els.profileSearchInput?.addEventListener("input", (event) => {';
  const keyHandler = `els.profileList?.addEventListener("keydown", (event) => {
  const offlineWork = event.target.closest("[data-profile-offline-open][tabindex]");
  if (!offlineWork || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  const item = state.items.find((candidate) => String(candidate.id) === String(offlineWork.dataset.profileOfflineOpen));
  if (item) openContentItem(item);
});
`;
  app = replaceOnce(app, searchListener, keyHandler + searchListener, "오프라인 목록 키보드 처리");
}

// 11) 오프라인 탭 전체삭제는 본문 캐시만 삭제 (북마크/진도/최근기록 유지)
app = replaceOnce(
  app,
  '  const kind = state.profileTab;\n  if (kind !== "bookmarks" && kind !== "recent") return;',
  '  const kind = state.profileTab;\n  if (kind === "offline") {\n    if (!window.confirm("오프라인에 저장된 작품을 모두 삭제할까요?\\n북마크·최근 조회·읽기 진도는 삭제되지 않습니다.")) return;\n    els.profileClearButton.disabled = true;\n    try {\n      await clearAllMobileOfflineContent();\n    } catch (error) {\n      console.warn(error);\n      window.alert("오프라인 저장 데이터를 삭제하지 못했습니다.");\n    } finally {\n      els.profileClearButton.disabled = false;\n    }\n    return;\n  }\n  if (kind !== "bookmarks" && kind !== "recent") return;',
  "마이페이지 전체삭제 동작"
);

// 12) 오프라인에서 저장되지 않은 TXT는 뷰어를 열기 전에 명확히 안내
app = replaceOnce(
  app,
  'async function openReader(item, options = {}) {\n  if (!item) return;',
  'async function openReader(item, options = {}) {\n  if (!item) return;\n\n  if (\n    isMobileOfflineAppRuntime() &&\n    navigator.onLine === false &&\n    item.source !== "postype" &&\n    !isMobileOfflineSaved(item)\n  ) {\n    window.alert("오프라인에 저장되지 않은 작품입니다.\\n온라인 연결 후 한 번 열어주세요.");\n    return;\n  }',
  "오프라인 미저장 안내"
);

fs.writeFileSync(indexPath, index, "utf8");
fs.writeFileSync(themePath, theme, "utf8");
fs.writeFileSync(appPath, app, "utf8");

console.log("오프라인 저장 UI/관리 패치 완료");
