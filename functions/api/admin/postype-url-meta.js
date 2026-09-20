import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const MAX_HTML_BYTES = 2_000_000;
const MAX_SERIES_POST_CHECKS = 18;

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
    .replace(/\\u002F/gi, "/")
    .replace(/\\u003A/gi, ":")
    .replace(/\\\//g, "/")
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

function parseSeriesInfo(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/@([^/]+)\/series\/(\d+)/i);
    if (!match) return null;
    return {
      handle: match[1],
      seriesId: match[2],
      origin: url.origin,
    };
  } catch {
    return null;
  }
}

function isSeriesUrl(value) {
  return Boolean(parseSeriesInfo(value));
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

function postBelongsToSeries(html, seriesId) {
  const decoded = decodeHtml(html);

  const patterns = [
    new RegExp(`/series/${seriesId}(?:["'/?#]|$)`, "i"),
    new RegExp(`"seriesId"\\s*:\\s*"?${seriesId}"?`, "i"),
    new RegExp(`"series_id"\\s*:\\s*"?${seriesId}"?`, "i"),
    new RegExp(`"series"\\s*:\\s*\\{[^{}]{0,1200}"id"\\s*:\\s*"?${seriesId}"?`, "i"),
  ];

  return patterns.some((pattern) => pattern.test(decoded));
}

function extractCandidatePostUrls(html, seriesUrl) {
  const info = parseSeriesInfo(seriesUrl);
  if (!info) return [];

  const decoded = decodeHtml(html);
  const candidates = [];
  const seen = new Set();

  const add = (value) => {
    if (!value) return;

    let url;
    try {
      url = new URL(value, seriesUrl);
    } catch {
      return;
    }

    if (!isPostypeUrl(url.toString())) return;

    const postMatch = url.pathname.match(/\/(?:@[^/]+\/)?post\/(\d+)/i);
    if (!postMatch) return;

    // 시리즈 URL의 채널 핸들을 기준으로 canonical URL을 다시 만든다.
    // JSON 안에 /post/ID만 있는 경우도 이 방식으로 처리 가능.
    const postId = postMatch[1];
    const canonical =
      `${info.origin}/@${info.handle}/post/${postId}`;

    if (seen.has(canonical)) return;
    seen.add(canonical);
    candidates.push(canonical);
  };

  // 1) href 링크
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = hrefPattern.exec(decoded))) {
    add(match[1]);
  }

  // 2) JSON / 스크립트 안에 들어 있는 전체 URL
  const fullUrlPattern =
    /https?:\/\/(?:www\.)?postype\.com\/@[^"'\\\s<]+\/post\/\d+/gi;
  while ((match = fullUrlPattern.exec(decoded))) {
    add(match[0]);
  }

  // 3) JSON 안의 상대 경로 /@handle/post/ID
  const relativePattern = /\/@[^"'\\\s<]+\/post\/\d+/gi;
  while ((match = relativePattern.exec(decoded))) {
    add(match[0]);
  }

  // 4) 가장 중요한 fallback:
  // 페이지 내부에 "/post/12345" 형태로만 들어 있는 포스트 ID도 수집.
  const idPattern = /\/post\/(\d+)/gi;
  while ((match = idPattern.exec(decoded))) {
    add(`/@${info.handle}/post/${match[1]}`);
  }

  return candidates;
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

function chooseCandidateSubset(urls) {
  if (urls.length <= MAX_SERIES_POST_CHECKS) return urls;

  // SSR/Next 데이터에서 실제 시리즈 글이 앞 또는 뒤에 몰리는 경우를 모두 고려.
  const headCount = Math.ceil(MAX_SERIES_POST_CHECKS / 2);
  const tailCount = MAX_SERIES_POST_CHECKS - headCount;

  return [
    ...urls.slice(0, headCount),
    ...urls.slice(-tailCount),
  ].filter((value, index, array) => array.indexOf(value) === index);
}

async function resolveSeriesLatestPublishedDate(seriesHtml, seriesUrl) {
  const info = parseSeriesInfo(seriesUrl);
  if (!info) {
    return {
      latestPublishedDate: "",
      latestPostUrl: "",
      checkedPostCount: 0,
      matchedSeriesPostCount: 0,
      discoveredPostCount: 0,
      strategy: "series-membership-verified",
    };
  }

  const postUrls = extractCandidatePostUrls(seriesHtml, seriesUrl);
  const targets = chooseCandidateSubset(postUrls);

  const results = await Promise.all(
    targets.map(async (url) => {
      const page = await fetchHtml(url);
      if (!page.ok) return null;

      // 핵심: 같은 채널의 다른 글이 아니라
      // 현재 seriesId를 실제로 포함하고 있는 포스트만 인정한다.
      if (!postBelongsToSeries(page.html, info.seriesId)) {
        return {
          url: page.url,
          matched: false,
          publishedDate: "",
        };
      }

      const publishedDate = extractSinglePostPublishedDate(page.html);
      if (!publishedDate) {
        return {
          url: page.url,
          matched: true,
          publishedDate: "",
        };
      }

      return {
        url: page.url,
        matched: true,
        publishedDate,
      };
    })
  );

  const matched = results.filter((item) => item?.matched);
  const dated = matched
    .filter((item) => item.publishedDate)
    .sort((a, b) => a.publishedDate.localeCompare(b.publishedDate));

  return {
    latestPublishedDate: dated.at(-1)?.publishedDate || "",
    latestPostUrl: dated.at(-1)?.url || "",
    checkedPostCount: targets.length,
    matchedSeriesPostCount: matched.length,
    discoveredPostCount: postUrls.length,
    strategy: "series-membership-verified",
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
    let matchedSeriesPostCount = 0;
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
      matchedSeriesPostCount = resolved.matchedSeriesPostCount;
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
        matchedSeriesPostCount,
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
