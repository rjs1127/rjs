const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "www", "app.js");
let app = fs.readFileSync(appPath, "utf8");

const helperMarker = "async function loadArchive(force = false) {";

if (!app.includes(helperMarker)) {
  throw new Error("loadArchive 위치를 찾지 못했습니다.");
}

const helper = `
// ===== RJS MOBILE OFFLINE CACHE =====
const mobileOfflineFilesystem =
  window.Capacitor?.Plugins?.Filesystem || null;

const MOBILE_OFFLINE_DIR = "rjs-offline";

async function ensureMobileOfflineDirectory() {
  if (!mobileOfflineFilesystem) return false;

  try {
    await mobileOfflineFilesystem.mkdir({
      path: \`\${MOBILE_OFFLINE_DIR}/content\`,
      directory: "DATA",
      recursive: true,
    });
  } catch {}

  return true;
}

function mobileOfflineSafeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function writeMobileOfflineFile(path, text) {
  if (!mobileOfflineFilesystem) return false;

  try {
    await ensureMobileOfflineDirectory();

    await mobileOfflineFilesystem.writeFile({
      path,
      data: String(text ?? ""),
      directory: "DATA",
      encoding: "utf8",
    });

    return true;
  } catch (error) {
    console.warn("[RJS Mobile] offline write failed", error);
    return false;
  }
}

async function readMobileOfflineFile(path) {
  if (!mobileOfflineFilesystem) return null;

  try {
    const result = await mobileOfflineFilesystem.readFile({
      path,
      directory: "DATA",
      encoding: "utf8",
    });

    return typeof result.data === "string" ? result.data : null;
  } catch {
    return null;
  }
}

function getMobileOfflineContentPath(item) {
  return \`\${MOBILE_OFFLINE_DIR}/content/\${mobileOfflineSafeId(item?.id)}.txt\`;
}

async function saveMobileOfflineContent(item, text) {
  if (!item?.id) return false;
  return writeMobileOfflineFile(
    getMobileOfflineContentPath(item),
    text
  );
}

async function readMobileOfflineContent(item) {
  if (!item?.id) return null;
  return readMobileOfflineFile(
    getMobileOfflineContentPath(item)
  );
}

async function saveMobileOfflineArchive(data) {
  return writeMobileOfflineFile(
    \`\${MOBILE_OFFLINE_DIR}/archive.json\`,
    JSON.stringify(data)
  );
}

async function readMobileOfflineArchive() {
  const raw = await readMobileOfflineFile(
    \`\${MOBILE_OFFLINE_DIR}/archive.json\`
  );

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
// ===== /RJS MOBILE OFFLINE CACHE =====

`;

app = app.replace(helperMarker, helper + helperMarker);


/* 작품 목록 */
const archiveRegex =
  /    const url = force \? `\/api\/archive\?t=\$\{Date\.now\(\)\}` : "\/api\/archive";\r?\n    const response = await fetch\(url, \{ cache: "no-store" \}\);\r?\n    const data = await response\.json\(\);\r?\n\r?\n    if \(!response\.ok\) throw new Error\([^\r\n]+\);/;

if (!archiveRegex.test(app)) {
  throw new Error("archive fetch 구간을 찾지 못했습니다.");
}

app = app.replace(
  archiveRegex,
`    const url = force ? \`/api/archive?t=\${Date.now()}\` : "/api/archive";
    let data = null;

    if (navigator.onLine === false) {
      data = await readMobileOfflineArchive();
    }

    if (!data) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const freshData = await response.json();

        if (!response.ok) {
          throw new Error(
            freshData?.error || "콘텐츠를 불러오지 못했습니다."
          );
        }

        data = freshData;
        void saveMobileOfflineArchive(data);
      } catch (networkError) {
        data = await readMobileOfflineArchive();

        if (!data) throw networkError;
      }
    }`
);


/* 작품 본문 */
const contentRegex =
  /    const fetchStartedAt = performance\.now\(\);\r?\n    const response = await fetch\(`\/api\/content\?\$\{params\.toString\(\)\}`, \{\r?\n      headers: contentHeaders,\r?\n    \}\);\r?\n    const responseMs = performance\.now\(\) - fetchStartedAt;/;

if (!contentRegex.test(app)) {
  throw new Error("content fetch 구간을 찾지 못했습니다.");
}

app = app.replace(
  contentRegex,
`    const fetchStartedAt = performance.now();
    let response = null;
    let usedOfflineCache = false;

    if (navigator.onLine === false) {
      const cachedText = await readMobileOfflineContent(item);

      if (cachedText !== null) {
        response = new Response(cachedText, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "x-rjs-offline": "1",
          },
        });
        usedOfflineCache = true;
      }
    }

    if (!response) {
      try {
        response = await fetch(\`/api/content?\${params.toString()}\`, {
          headers: contentHeaders,
        });
      } catch (networkError) {
        const cachedText = await readMobileOfflineContent(item);

        if (cachedText === null) throw networkError;

        response = new Response(cachedText, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "x-rjs-offline": "1",
          },
        });
        usedOfflineCache = true;
      }
    }

    const responseMs = performance.now() - fetchStartedAt;`
);


/* 온라인에서 정상 로딩된 본문 저장 */
const renderedMarker =
`    if (!streamStats?.rendered || renderToken !== state.readerRenderToken) return;`;

if (!app.includes(renderedMarker)) {
  throw new Error("본문 렌더 완료 위치를 찾지 못했습니다.");
}

app = app.replace(
  renderedMarker,
`    if (!streamStats?.rendered || renderToken !== state.readerRenderToken) return;

    if (!usedOfflineCache && state.readerText) {
      void saveMobileOfflineContent(item, state.readerText);
    }`
);

fs.writeFileSync(appPath, app, "utf8");

console.log("오프라인 독서 패치 완료");
