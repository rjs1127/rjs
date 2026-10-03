const fs = require("fs");
const path = require("path");

const mobileRoot = __dirname;
const repoRoot = path.resolve(mobileRoot, "..");
const sourceDir = path.join(repoRoot, "public");
const targetDir = path.join(mobileRoot, "www");
const apiOrigin = "https://rjs-cj6.pages.dev";

console.log("[1/4] public -> mobile/www 복사");
fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
// 웹 배포용 APK는 앱 내부 번들에 다시 포함하지 않는다.
fs.rmSync(path.join(targetDir, "downloads"), {
  recursive: true,
  force: true,
});

console.log("[2/4] 앱용 SITE_NAME 적용");
const indexPath = path.join(targetDir, "index.html");
let index = fs.readFileSync(indexPath, "utf8");
index = index.replaceAll("__SITE_NAME__", "셩냥책");

const marker = '  <script src="/app.js';
const markerIndex = index.indexOf(marker);

if (markerIndex < 0) {
  throw new Error("index.html에서 app.js 로딩 위치를 찾지 못했습니다.");
}

const mobileBootstrap = `  <script>
    (() => {
      const API_ORIGIN = "${apiOrigin}";
      const originalFetch = window.fetch.bind(window);

      window.fetch = (input, init) => {
        const nextInput =
          typeof input === "string" && input.startsWith("/api/")
            ? API_ORIGIN + input
            : input;

        return originalFetch(nextInput, init);
      };
    })();
  </script>
`;

index =
  index.slice(0, markerIndex) +
  mobileBootstrap +
  index.slice(markerIndex);

fs.writeFileSync(indexPath, index, "utf8");

console.log("[3/4] 앱용 analytics beacon 주소 적용");
const appPath = path.join(targetDir, "app.js");
let app = fs.readFileSync(appPath, "utf8");

app = app.replace(
  'navigator.sendBeacon("/api/analytics/session", blob);',
  `navigator.sendBeacon("${apiOrigin}/api/analytics/session", blob);`
);

fs.writeFileSync(appPath, app, "utf8");

console.log("[4/4] Capacitor를 앱 내부 파일 방식으로 전환");
const config = {
  appId: "hs.rjs.syungbook",
  appName: "셩냥책",
  webDir: "www"
};

fs.writeFileSync(
  path.join(mobileRoot, "capacitor.config.json"),
  JSON.stringify(config, null, 2) + "\n",
  "utf8"
);

console.log("");
console.log("완료: server.url 제거 + 앱 내부 웹파일 생성 완료");
