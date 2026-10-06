const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VERSIONED_STATIC_ASSETS = ["app.js", "style.css", "theme.css"];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getContentVersion(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex")
    .slice(0, 12);
}

function versionStaticAssetUrls(html, { publicDir }) {
  let output = String(html || "");

  for (const asset of VERSIONED_STATIC_ASSETS) {
    const filePath = path.join(publicDir, asset);
    if (!fs.existsSync(filePath)) {
      throw new Error(`[build] versioned asset missing: public/${asset}`);
    }

    const pattern = new RegExp(`(/${escapeRegExp(asset)}\\?v=)[^"'\\s&<>]+`, "g");
    if (!pattern.test(output)) {
      throw new Error(`[build] cache-busting URL missing in index.html: /${asset}?v=`);
    }

    pattern.lastIndex = 0;
    const version = getContentVersion(filePath);
    output = output.replace(pattern, `$1${version}`);
  }

  return output;
}

module.exports = {
  VERSIONED_STATIC_ASSETS,
  getContentVersion,
  versionStaticAssetUrls,
};
