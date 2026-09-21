const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const wranglerPath = path.join(root, "wrangler.toml");
const indexPath = path.join(root, "public", "index.html");
const token = "__SITE_NAME__";

function decodeTomlString(raw) {
  const value = String(raw || "").trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if (!fs.existsSync(wranglerPath)) {
  throw new Error("wrangler.toml을 찾지 못했습니다. SITE_NAME을 [vars]에 등록해 주세요.");
}

const wrangler = fs.readFileSync(wranglerPath, "utf8");
const varsMatch = wrangler.match(/\[vars\]([\s\S]*?)(?=\n\s*\[|$)/);

if (!varsMatch) {
  throw new Error("wrangler.toml의 [vars] 섹션을 찾지 못했습니다.");
}

const siteMatch = varsMatch[1].match(/^\s*SITE_NAME\s*=\s*(.+?)\s*$/m);
const siteName = decodeTomlString(siteMatch?.[1] || "").trim();

if (!siteName) {
  throw new Error('wrangler.toml [vars]에 SITE_NAME = "사이트 이름"을 설정해 주세요.');
}

let html = fs.readFileSync(indexPath, "utf8");
if (!html.includes(token)) {
  throw new Error(`${token} 플레이스홀더를 public/index.html에서 찾지 못했습니다.`);
}

html = html.replaceAll(token, htmlEscape(siteName));
fs.writeFileSync(indexPath, html, "utf8");

console.log(`[build] SITE_NAME injected: ${siteName}`);

// Do not publish local/build helpers with the public site. The Git working
// tree remains unchanged; this cleanup only affects the build output clone.
try {
  fs.rmSync(__dirname, { recursive: true, force: true });
} catch {
  // Cleanup failure is non-fatal.
}
