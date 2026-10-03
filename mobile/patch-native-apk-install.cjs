const fs = require("fs");
const path = require("path");

const jsPath = path.join(__dirname, "www", "app-update.js");

if (!fs.existsSync(jsPath)) {
  throw new Error(
    "mobile/www/app-update.js가 없습니다. patch-app-update.cjs를 먼저 실행해 주세요."
  );
}

let js = fs.readFileSync(jsPath, "utf8");

// 앱을 열 때마다 최신 버전을 확인하도록 6시간 캐시를 제거한다.
js = js
  .replace(
    /^\s*const CACHE_KEY = "rjsAppUpdateCheckCacheV1";\s*$/m,
    ""
  )
  .replace(
    /^\s*const CACHE_MS = 6 \* 60 \* 60 \* 1000;\s*$/m,
    ""
  )
  .replace(
    /\n\s*function readCache\(\) \{[\s\S]*?\n\s*\}\n\s*function writeCache\(data\) \{[\s\S]*?\n\s*\}\n(?=\s*function getDismissedBuild\(\))/,
    "\n"
  );

const getLatestInfoRegex =
  /\s*async function getLatestInfo\(\) \{[\s\S]*?\n\s*\}\n(?=\s*async function openUpdateUrl\(url\))/;

if (!getLatestInfoRegex.test(js)) {
  throw new Error("앱 업데이트 최신 버전 조회 함수 위치를 찾지 못했습니다.");
}

js = js.replace(
  getLatestInfoRegex,
`  async function getLatestInfo() {
    try {
      localStorage.removeItem("rjsAppUpdateCheckCacheV1");
    } catch {}

    const response = await fetch("/api/mobile-version?_=" + Date.now(), {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache"
      }
    });

    if (!response.ok) {
      throw new Error("mobile_version_fetch_failed");
    }

    return response.json();
  }

`
);

if (js.includes("RJS NATIVE APK INSTALL V1")) {
  fs.writeFileSync(jsPath, js, "utf8");
  console.log("앱 업데이트 6시간 캐시 제거 완료 · 네이티브 설치 패치는 이미 적용되어 있습니다.");
  process.exit(0);
}

const browserLine =
  '  const Browser = window.Capacitor?.Plugins?.Browser;';

if (!js.includes(browserLine)) {
  throw new Error("Browser 플러그인 선언 위치를 찾지 못했습니다.");
}

js = js.replace(
  browserLine,
`${browserLine}
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const ApkInstaller = window.Capacitor?.Plugins?.ApkInstaller;`
);

const checkMarker = "  async function checkAppUpdate() {";

if (!js.includes(checkMarker)) {
  throw new Error("checkAppUpdate 위치를 찾지 못했습니다.");
}

const nativeInstaller = `  // ===== RJS NATIVE APK INSTALL V1 =====
  async function downloadAndInstallUpdate(url, latestVersion) {
    if (!url) {
      window.alert("업데이트 파일을 준비 중이에요.");
      return;
    }

    if (!Filesystem?.downloadFile || !ApkInstaller?.install) {
      await openUpdateUrl(url);
      return;
    }

    const safeVersion =
      String(latestVersion || "latest")
        .replace(/[^0-9A-Za-z._-]+/g, "_") || "latest";
    const apkPath = \`updates/syungbook-v\${safeVersion}.apk\`;
    let progressHandle = null;
    const originalText = action.textContent || "업데이트";

    action.disabled = true;
    action.textContent = "받는 중…";

    try {
      if (Filesystem?.addListener) {
        progressHandle = await Filesystem.addListener(
          "progress",
          (status) => {
            const total = Number(status?.contentLength || 0);
            const bytes = Number(status?.bytes || 0);

            if (total > 0 && bytes >= 0) {
              const percent = Math.max(
                0,
                Math.min(100, Math.round((bytes / total) * 100))
              );
              action.textContent = \`\${percent}%\`;
            }
          }
        );
      }

      const result = await Filesystem.downloadFile({
        url,
        path: apkPath,
        directory: "CACHE",
        recursive: true,
        progress: true,
      });

      if (!result?.path) {
        throw new Error("apk_download_path_missing");
      }

      action.textContent = "설치 열기";

      await ApkInstaller.install({
        path: result.path,
      });
    } catch (error) {
      console.warn("[RJS Mobile] native update install failed", error);

      try {
        await openUpdateUrl(url);
      } catch (fallbackError) {
        console.warn(
          "[RJS Mobile] update browser fallback failed",
          fallbackError
        );
        window.alert(
          "업데이트 설치 화면을 열지 못했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
    } finally {
      try {
        await progressHandle?.remove?.();
      } catch {}

      action.disabled = false;
      action.textContent = originalText;
    }
  }
  // ===== /RJS NATIVE APK INSTALL V1 =====

`;

js = js.replace(checkMarker, nativeInstaller + checkMarker);

const oldClick = `      action.onclick = () => {
        openUpdateUrl(String(latest?.downloadUrl || "").trim())
          .catch((error) => {
            console.warn("[RJS Mobile] update open failed", error);
            window.alert("업데이트 페이지를 열지 못했습니다.");
          });
      };`;

const newClick = `      action.onclick = () => {
        downloadAndInstallUpdate(
          String(latest?.downloadUrl || "").trim(),
          latestVersion
        ).catch((error) => {
          console.warn("[RJS Mobile] native update failed", error);
          window.alert("업데이트를 시작하지 못했습니다.");
        });
      };`;

if (!js.includes(oldClick)) {
  throw new Error("업데이트 버튼 동작 위치를 찾지 못했습니다.");
}

js = js.replace(oldClick, newClick);

fs.writeFileSync(jsPath, js, "utf8");
console.log("앱 업데이트 6시간 캐시 제거 + 네이티브 APK 설치 연결 완료");
