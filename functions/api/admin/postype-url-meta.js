import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const MAX_HTML_BYTES = 2_000_000;

function normalize(value) {
  return String(value ?? "").trim();
}

function decodeHtml(value) {
  return normalize(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      try { return String.fromCodePoint(Number(code)); } catch { return _; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      try { return String.fromCodePoint(parseInt(code, 16)); } catch { return _; }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function isPostypeUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "postype.com" || hostname.endsWith(".postype.com"))
    );
  } catch {
    return false;
  }
}

function isSeriesUrl(value) {
  try {
    return /\/series\/\d+(?:\/|$)/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

function getMetaContent(html, key, attr = "property") {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]*${attr}\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*${attr}\\s*=\\s*["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function getTitleTag(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : "";
}

function cleanTitle(value) {
  return normalize(value)
    .replace(/\s*[|\-–—:]\s*포스타입\s*$/i, "")
    .trim();
}

function readJsonLd(html) {
  const results = [];
  const pattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch {}
  }
  return results;
}

function findJsonLdValue(nodes, keys) {
  const queue = [...nodes];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    for (const key of keys) {
      const value = node[key];
      if (typeof value === "string" && normalize(value)) return decodeHtml(value);
      if (value && typeof value === "object" && typeof value.name === "string" && normalize(value.name)) {
        return decodeHtml(value.name);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) queue.push(...value);
      else if (value && typeof value === "object") queue.push(value);
    }
  }
  return "";
}

function normalizeDate(value) {
  const text = normalize(value);
  if (!text) return "";

  const direct = text.match(/^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/);
  if (direct) {
    const year = Number(direct[1]);
    const month = Number(direct[2]);
    const day = Number(direct[3]);
    if (year >= 2010 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  if (year < 2010 || year > 2100) return "";
  return [
    year,
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function collectSeriesDateCandidates(html, jsonLd) {
  const values = [];
  const push = (value) => {
    const date = normalizeDate(value);
    if (date) values.push(date);
  };

  const queue = [...jsonLd];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    for (const [key, value] of Object.entries(node)) {
      if (/^(datePublished|dateCreated|uploadDate|publishedAt|published_at|createdAt|created_at)$/i.test(key) && typeof value === "string") {
        push(value);
      }
      if (Array.isArray(value)) queue.push(...value);
      else if (value && typeof value === "object") queue.push(value);
    }
  }

  const patterns = [
    /"(?:datePublished|publishedAt|published_at|createdAt|created_at)"\s*:\s*"([^"]+)"/gi,
    /<time[^>]*datetime\s*=\s*["']([^"']+)["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html))) push(match[1]);
  }

  const visible = /\b(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*\.?\s*(?:일)?\b/g;
  let match;
  while ((match = visible.exec(html))) {
    push(`${match[1]}-${match[2]}-${match[3]}`);
  }

  return [...new Set(values)].sort();
}

function findEmbeddedAuthor(html) {
  const patterns = [
    /"author"\s*:\s*\{[^{}]{0,500}?"name"\s*:\s*"([^"]+)"/i,
    /"creator"\s*:\s*\{[^{}]{0,500}?"name"\s*:\s*"([^"]+)"/i,
    /"nickname"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try { return decodeHtml(JSON.parse(`"${match[1]}"`)); }
      catch { return decodeHtml(match[1]); }
    }
  }
  return "";
}

function extractMetadata(html, pageUrl, requestedLengthType) {
  const jsonLd = readJsonLd(html);
  const seriesMode = requestedLengthType === "시리즈" || isSeriesUrl(pageUrl);

  const title = cleanTitle(
    getMetaContent(html, "og:title") ||
    getMetaContent(html, "twitter:title", "name") ||
    findJsonLdValue(jsonLd, ["headline", "name"]) ||
    getTitleTag(html)
  );

  const author =
    getMetaContent(html, "author", "name") ||
    findJsonLdValue(jsonLd, ["author", "creator"]) ||
    findEmbeddedAuthor(html);

  let latestPublishedDate = "";

  if (seriesMode) {
    const candidates = collectSeriesDateCandidates(html, jsonLd);
    latestPublishedDate = candidates.at(-1) || "";
  } else {
    latestPublishedDate = normalizeDate(
      getMetaContent(html, "article:published_time") ||
      getMetaContent(html, "date", "name") ||
      findJsonLdValue(jsonLd, ["datePublished"])
    );
    if (!latestPublishedDate) {
      const candidates = collectSeriesDateCandidates(html, jsonLd);
      latestPublishedDate = candidates.at(-1) || "";
    }
  }

  return {
    title: normalize(title),
    author: normalize(author),
    latestPublishedDate,
    mode: seriesMode ? "series" : "post",
  };
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);

    const body = await context.request.json();
    const inputUrl = normalize(body?.url);
    const requestedLengthType = normalize(body?.lengthType);

    if (!isPostypeUrl(inputUrl)) {
      return jsonResponse(
        { error: "https://...postype.com 형식의 포스타입 URL만 사용할 수 있습니다." },
        400,
        { "cache-control": "no-store" }
      );
    }

    if (requestedLengthType === "시리즈" && !isSeriesUrl(inputUrl)) {
      return jsonResponse(
        { error: "시리즈는 POSTYPE 시리즈 페이지 URL(/series/...)을 입력해 주세요." },
        400,
        { "cache-control": "no-store" }
      );
    }

    const response = await fetch(inputUrl, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 ArchiveAdmin/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return jsonResponse(
        { error: `포스타입 페이지를 불러오지 못했습니다. (${response.status})` },
        400,
        { "cache-control": "no-store" }
      );
    }

    if (!isPostypeUrl(response.url)) {
      return jsonResponse(
        { error: "포스타입 외부 주소로 이동된 URL은 처리하지 않습니다." },
        400,
        { "cache-control": "no-store" }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return jsonResponse(
        { error: "HTML 포스타입 페이지 URL을 입력해 주세요." },
        400,
        { "cache-control": "no-store" }
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      return jsonResponse(
        { error: "페이지가 너무 커서 자동 정보를 읽지 않았습니다. 직접 입력해 주세요." },
        400,
        { "cache-control": "no-store" }
      );
    }

    const html = new TextDecoder("utf-8").decode(buffer);
    const metadata = extractMetadata(html, response.url, requestedLengthType);

    return jsonResponse(
      {
        ok: true,
        url: response.url,
        title: metadata.title,
        author: metadata.author,
        latestPublishedDate: metadata.latestPublishedDate,
        mode: metadata.mode,
        found: Boolean(metadata.title || metadata.author || metadata.latestPublishedDate),
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { ok: false, error: error?.message || "포스타입 URL 정보를 불러오지 못했습니다." },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
