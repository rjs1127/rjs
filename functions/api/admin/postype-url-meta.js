import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const MAX_HTML_BYTES = 2_000_000;
const MAX_SERIES_POST_CHECKS = 6;

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
    new RegExp(
      `<meta[^>]*${attr}\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*${attr}\\s*=\\s*["']${escaped}["'][^>]*>`,
      "i"
    ),
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
  const pattern =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

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

      if (typeof value === "string" && normalize(value)) {
        return decodeHtml(value);
      }

      if (
        value &&
        typeof value === "object" &&
        typeof value.name === "string" &&
        normalize(value.name)
      ) {
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

function findEmbeddedAuthor(html) {
  const patterns = [
    /"author"\s*:\s*\{[^{}]{0,500}?"name"\s*:\s*"([^"]+)"/i,
    /"creator"\s*:\s*\{[^{}]{0,500}?"name"\s*:\s*"([^"]+)"/i,
    /"nickname"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;

    try {
      return decodeHtml(JSON.parse(`"${match[1]}"`));
    } catch {
      return decodeHtml(match[1]);
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

    if (
      year >= 2010 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return [
        String(year),
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0"),
      ].join("-");
    }
  }

  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return "";

  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  if (year < 2010 || year > 2100) return "";

  return [
    String(year),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function extractSinglePostPublishedDate(html) {
  const jsonLd = readJsonLd(html);

  const primary =
    getMetaContent(html, "article:published_time") ||
    findJsonLdValue(jsonLd, ["datePublished"]) ||
    getMetaContent(html, "date", "name");

  const normalized = normalizeDate(primary);
  if (normalized) return normalized;

  const patterns = [
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /"publishedAt"\s*:\s*"([^"]+)"/i,
    /"published_at"\s*:\s*"([^"]+)"/i,
    /<time[^>]*datetime\s*=\s*["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const date = normalizeDate(match?.[1]);
    if (date) return date;
  }

  return "";
}

function extractSeriesPostUrls(html, baseUrl) {
  const urls = [];
  const seen = new Set();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = hrefPattern.exec(html))) {
    const raw = decodeHtml(match[1]);
    if (!raw || !/\/post\/\d+/i.test(raw)) continue;

    let absolute;
    try {
      absolute = new URL(raw, baseUrl).toString();
    } catch {
      continue;
    }

    if (!isPostypeUrl(absolute)) continue;

    const canonical = absolute.split("#")[0];
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    urls.push(canonical);
  }

  return urls;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 ArchiveAdmin/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return { ok: false, status: response.status, url: response.url || url, html: "" };
  }

  if (!isPostypeUrl(response.url)) {
    return { ok: false, status: 400, url: response.url || url, html: "" };
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) {
    return { ok: false, status: 415, url: response.url || url, html: "" };
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_HTML_BYTES) {
    return { ok: false, status: 413, url: response.url || url, html: "" };
  }

  return {
    ok: true,
    status: response.status,
    url: response.url,
    html: new TextDecoder("utf-8").decode(buffer),
  };
}

async function resolveSeriesLatestPublishedDate(seriesHtml, seriesUrl) {
  const postUrls = extractSeriesPostUrls(seriesHtml, seriesUrl);

  if (!postUrls.length) {
    return {
      latestPublishedDate: "",
      latestPostUrl: "",
      checkedPostCount: 0,
      discoveredPostCount: 0,
      strategy: "linked-post-pages",
    };
  }

  // '첫 화 보기' 같은 링크가 앞쪽에 섞일 수 있으므로 여러 실제 포스트를 직접 확인한다.
  const targets = postUrls.slice(0, MAX_SERIES_POST_CHECKS);

  const results = await Promise.all(
    targets.map(async (url) => {
      const page = await fetchHtml(url);
      if (!page.ok) return null;

      const publishedDate = extractSinglePostPublishedDate(page.html);
      if (!publishedDate) return null;

      return { url: page.url, publishedDate };
    })
  );

  const valid = results
    .filter(Boolean)
    .sort((a, b) => a.publishedDate.localeCompare(b.publishedDate));

  return {
    latestPublishedDate: valid.at(-1)?.publishedDate || "",
    latestPostUrl: valid.at(-1)?.url || "",
    checkedPostCount: targets.length,
    discoveredPostCount: postUrls.length,
    strategy: "linked-post-pages",
  };
}

function extractBaseMetadata(html) {
  const jsonLd = readJsonLd(html);

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

  return {
    title: normalize(title),
    author: normalize(author),
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

    const page = await fetchHtml(inputUrl);

    if (!page.ok) {
      const message =
        page.status === 413
          ? "페이지가 너무 커서 자동 정보를 읽지 않았습니다."
          : "포스타입 페이지를 불러오지 못했습니다.";

      return jsonResponse(
        { error: `${message} (${page.status})` },
        400,
        { "cache-control": "no-store" }
      );
    }

    const seriesMode =
      requestedLengthType === "시리즈" ||
      isSeriesUrl(page.url);

    const baseMetadata = extractBaseMetadata(page.html);

    let latestPublishedDate = "";
    let latestPostUrl = "";
    let checkedPostCount = 0;
    let discoveredPostCount = 0;
    let strategy = "single-post-meta";

    if (seriesMode) {
      const resolved = await resolveSeriesLatestPublishedDate(
        page.html,
        page.url
      );

      latestPublishedDate = resolved.latestPublishedDate;
      latestPostUrl = resolved.latestPostUrl;
      checkedPostCount = resolved.checkedPostCount;
      discoveredPostCount = resolved.discoveredPostCount;
      strategy = resolved.strategy;
    } else {
      latestPublishedDate =
        extractSinglePostPublishedDate(page.html);
    }

    return jsonResponse(
      {
        ok: true,
        url: page.url,
        title: baseMetadata.title,
        author: baseMetadata.author,
        latestPublishedDate,
        latestPostUrl,
        checkedPostCount,
        discoveredPostCount,
        strategy,
        mode: seriesMode ? "series" : "post",
        found: Boolean(
          baseMetadata.title ||
          baseMetadata.author ||
          latestPublishedDate
        ),
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error:
          error?.message ||
          "포스타입 URL 정보를 불러오지 못했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
