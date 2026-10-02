const fs = require("fs");
const path = require("path");

const mobileRoot = __dirname;
const indexPath = path.join(mobileRoot, "www", "index.html");
const cssPath = path.join(mobileRoot, "www", "app-update.css");
const jsPath = path.join(mobileRoot, "www", "app-update.js");

if (!fs.existsSync(indexPath)) {
  throw new Error("mobile/www/index.html이 없습니다. prepare-web.cjs를 먼저 실행해 주세요.");
}

let index = fs.readFileSync(indexPath, "utf8");

const css = `
/* ===== RJS APP UPDATE NOTICE V3 ===== */
.app-update-notice {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  margin: 12px 0 14px;
  padding: 10px 38px 10px 11px;
  border: 1px solid color-mix(in srgb, var(--theme-line, #ddd7ce) 78%, transparent);
  border-radius: 15px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-surface-strong, #fff) 96%, #efe6d8 4%),
      color-mix(in srgb, var(--theme-surface, #fff) 98%, transparent)
    );
  box-shadow: 0 5px 16px rgba(30, 26, 22, .045);
  color: var(--theme-text, #191816);
  overflow: hidden;
}

.app-update-notice[hidden] {
  display: none !important;
}

.app-update-notice::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: currentColor;
  opacity: .14;
}

.app-update-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--theme-surface-soft, #f6f2ec);
  border: 1px solid var(--theme-line-soft, #e8e2d9);
  color: var(--theme-text, #191816);
}

.app-update-icon svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.app-update-copy {
  min-width: 0;
}

.app-update-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 2px;
}

.app-update-title {
  font-size: 11.5px;
  line-height: 1.2;
  font-weight: 850;
  letter-spacing: -.02em;
}

.app-update-version {
  display: inline-flex;
  align-items: center;
  min-height: 17px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--theme-surface-soft, #f6f2ec);
  color: var(--theme-muted, #77736d);
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
}

.app-update-message {
  margin: 0;
  color: var(--theme-muted, #77736d);
  font-size: 9.5px;
  line-height: 1.35;
  word-break: keep-all;
}

.app-update-action {
  appearance: none;
  min-width: 62px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: var(--theme-primary-bg, #191816);
  color: var(--theme-primary-text, #fff);
  font: inherit;
  font-size: 9.5px;
  font-weight: 850;
  cursor: pointer;
  white-space: nowrap;
}

.app-update-action:active {
  transform: translateY(1px);
}

.app-update-close {
  appearance: none;
  position: absolute;
  top: 5px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-muted, #77736d);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  opacity: .56;
}

.app-update-close:hover,
.app-update-close:focus-visible {
  background: var(--theme-surface-soft, #f6f2ec);
  opacity: .9;
}

html.theme-dark .app-update-notice,
body.theme-dark .app-update-notice,
[data-theme="dark"] .app-update-notice {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-surface-strong, #2a2724) 95%, #eee8df 5%),
      color-mix(in srgb, var(--theme-surface, #211f1c) 98%, transparent)
    );
  border-color: color-mix(in srgb, var(--theme-line-soft, #39352f) 88%, transparent);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .14);
}

html.theme-dark .app-update-close,
body.theme-dark .app-update-close,
[data-theme="dark"] .app-update-close {
  opacity: .52;
}

@media (max-width: 560px) {
  .app-update-notice {
    gap: 8px;
    margin: 10px 0 12px;
    padding: 9px 34px 9px 9px;
    border-radius: 13px;
  }

  .app-update-icon {
    width: 29px;
    height: 29px;
    border-radius: 9px;
  }

  .app-update-icon svg {
    width: 14px;
    height: 14px;
  }

  .app-update-title {
    font-size: 10.5px;
  }

  .app-update-version {
    min-height: 16px;
    padding: 2px 5px;
    font-size: 7.5px;
  }

  .app-update-message {
    font-size: 8.7px;
  }

  .app-update-action {
    min-width: 58px;
    height: 28px;
    padding: 0 9px;
    border-radius: 9px;
    font-size: 9px;
  }

  .app-update-close {
    top: 4px;
    right: 5px;
    width: 21px;
    height: 21px;
    font-size: 14px;
  }
}

@media (max-width: 390px) {
  .app-update-notice {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .app-update-action {
    grid-column: 2;
    justify-self: start;
    min-width: 68px;
    height: 27px;
  }
}
/* ===== /RJS APP UPDATE NOTICE V3 ===== */
`;

const js = `
(() => {
  const notice = document.getElementById("appUpdateNotice");
  const title = document.getElementById("appUpdateTitle");
  const version = document.getElementById("appUpdateVersion");
  const message = document.getElementById("appUpdateMessage");
  const action = document.getElementById("appUpdateAction");
  const close = document.getElementById("appUpdateClose");

  if (!notice || !window.Capacitor?.isNativePlatform?.()) return;

  const App = window.Capacitor?.Plugins?.App;
  const Browser = window.Capacitor?.Plugins?.Browser;
  const DISMISSED_KEY = "rjsAppUpdateDismissedBuildV1";
  const CACHE_KEY = "rjsAppUpdateCheckCacheV1";
  const CACHE_MS = 6 * 60 * 60 * 1000;

  function normalizeBuild(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.checkedAt || !parsed?.data) return null;
      if ((Date.now() - Number(parsed.checkedAt)) > CACHE_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        checkedAt: Date.now(),
        data
      }));
    } catch {}
  }

  function getDismissedBuild() {
    try {
      return normalizeBuild(localStorage.getItem(DISMISSED_KEY));
    } catch {
      return 0;
    }
  }

  function dismiss(build) {
    try {
      localStorage.setItem(DISMISSED_KEY, String(build));
    } catch {}
    notice.hidden = true;
  }

  async function getLatestInfo() {
    const cached = readCache();
    if (cached) return cached;

    const response = await fetch("/api/mobile-version", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("mobile_version_fetch_failed");
    }

    const data = await response.json();
    writeCache(data);
    return data;
  }

  async function openUpdateUrl(url) {
    if (!url) {
      window.alert("업데이트 파일을 준비 중이에요.");
      return;
    }

    if (Browser?.open) {
      await Browser.open({ url });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function checkAppUpdate() {
    if (navigator.onLine === false || !App?.getInfo) return;

    try {
      const [current, latest] = await Promise.all([
        App.getInfo(),
        getLatestInfo()
      ]);

      if (latest?.enabled === false) return;

      const currentBuild = normalizeBuild(current?.build);
      const latestBuild = normalizeBuild(latest?.build);

      if (!latestBuild || latestBuild <= currentBuild) return;
      if (getDismissedBuild() === latestBuild) return;

      const currentVersion = String(current?.version || "현재");
      const latestVersion = String(latest?.version || "").trim() || "최신";

      title.textContent = "새 버전이 있어요";
      version.textContent = \`v\${currentVersion} → v\${latestVersion}\`;
      message.textContent =
        String(latest?.message || "").trim() ||
        "더 안정적인 셩냥책을 사용할 수 있어요.";

      notice.hidden = false;

      action.onclick = () => {
        openUpdateUrl(String(latest?.downloadUrl || "").trim())
          .catch((error) => {
            console.warn("[RJS Mobile] update open failed", error);
            window.alert("업데이트 페이지를 열지 못했습니다.");
          });
      };

      close.onclick = () => dismiss(latestBuild);
    } catch (error) {
      console.warn("[RJS Mobile] update check skipped", error);
    }
  }

  checkAppUpdate();

  window.addEventListener("online", () => {
    window.setTimeout(checkAppUpdate, 500);
  });
})();
`;

const markup = `
      <aside id="appUpdateNotice" class="app-update-notice" hidden aria-live="polite">
        <div class="app-update-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 17 17 7"></path>
            <path d="M9 7h8v8"></path>
          </svg>
        </div>
        <div class="app-update-copy">
          <div class="app-update-title-row">
            <strong id="appUpdateTitle" class="app-update-title">새 버전이 있어요</strong>
            <span id="appUpdateVersion" class="app-update-version"></span>
          </div>
          <p id="appUpdateMessage" class="app-update-message"></p>
        </div>
        <button id="appUpdateAction" class="app-update-action" type="button">업데이트</button>
        <button id="appUpdateClose" class="app-update-close" type="button" aria-label="이번 버전 알림 닫기">×</button>
      </aside>`;

fs.writeFileSync(cssPath, css.trimStart(), "utf8");
fs.writeFileSync(jsPath, js.trimStart(), "utf8");

/* 기존 업데이트 카드가 있으면 먼저 제거 */
index = index.replace(
  /\s*<aside\s+id=["']appUpdateNotice["'][\s\S]*?<\/aside>\s*/i,
  "\n"
);

/* 검색창이 들어있는 heroSection 바로 뒤 = 검색창 아래 / 필터 위 */
const heroOpenRegex = /<section\b[^>]*\bid=["']heroSection["'][^>]*>/i;
const heroOpenMatch = index.match(heroOpenRegex);

if (!heroOpenMatch || heroOpenMatch.index == null) {
  throw new Error("heroSection 시작 위치를 찾지 못했습니다.");
}

const heroCloseIndex = index.indexOf("</section>", heroOpenMatch.index + heroOpenMatch[0].length);
if (heroCloseIndex < 0) {
  throw new Error("heroSection 종료 위치를 찾지 못했습니다.");
}

const insertAt = heroCloseIndex + "</section>".length;
index =
  index.slice(0, insertAt) +
  "\n" +
  markup +
  index.slice(insertAt);

if (!index.includes("/app-update.css")) {
  const headMarker = "</head>";
  if (!index.includes(headMarker)) {
    throw new Error("index.html의 </head>를 찾지 못했습니다.");
  }

  index = index.replace(
    headMarker,
    '  <link rel="stylesheet" href="/app-update.css?v=3" />\n</head>'
  );
} else {
  index = index.replace(
    /\/app-update\.css\?v=\d+/g,
    "/app-update.css?v=3"
  );
}

if (!index.includes("/app-update.js")) {
  const appScriptRegex = /<script\b[^>]*\bsrc=["']\/app\.js[^"']*["'][^>]*><\/script>/i;
  const appScriptMatch = index.match(appScriptRegex);

  if (!appScriptMatch) {
    throw new Error("app.js script 위치를 찾지 못했습니다.");
  }

  index = index.replace(
    appScriptMatch[0],
    '  <script src="/app-update.js?v=3" defer></script>\n' + appScriptMatch[0]
  );
} else {
  index = index.replace(
    /\/app-update\.js\?v=\d+/g,
    "/app-update.js?v=3"
  );
}

fs.writeFileSync(indexPath, index, "utf8");
console.log("앱 업데이트 카드 위치/크기 V3 적용 완료");
