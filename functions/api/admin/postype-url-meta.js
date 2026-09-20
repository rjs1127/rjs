import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const MAX_HTML_BYTES = 2_000_000;
const MAX_SERIES_POST_CHECKS = 36;

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

function getChannelUrl(seriesUrl) {
  const info = parseSeriesInfo(seriesUrl);
  if (!info) return "";
  return `${info.origin}/@${info.handle}`;
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripKnownTitleSuffix(title, suffixes = []) {
  let result = normalize(title);
  for (const suffix of suffixes) {
    const cleanSuffix = normalize(suffix);
    if (!cleanSuffix || cleanSuffix.toLowerCase() === "postype") continue;
    const pattern = new RegExp(`\\s*[:|\\-–—]\\s*${escapeRegExp(cleanSuffix)}\\s*$`, "i");
    const next = result.replace(pattern, "").trim();
    if (next && next !== result) result = next;
  }
  return result;
}

function stripGenericChannelSuffix(title) {
  const value = normalize(title);
  const match = value.match(/^(.{2,160}?)\s+:\s+([^:]{1,40})$/);
  if (!match) return value;
  const suffix = normalize(match[2]);
  if (!suffix || /[.!?。！？]$/.test(suffix)) return value;
  return normalize(match[1]);
}

function cleanTitle(value, suffixes = []) {
  const withoutPostype = normalize(value)
    .replace(/\s*[|\-–—:]\s*포스타입\s*$/i, "")
    .trim();

  const withoutKnownSuffix = stripKnownTitleSuffix(withoutPostype, suffixes);
  return stripGenericChannelSuffix(withoutKnownSuffix);
}

function findEmbeddedChannelName(html) {
  const decoded = decodeHtml(html);
  const patterns = [
    /"channelName"\s*:\s*"([^"]+)"/i,
    /"channel_name"\s*:\s*"([^"]+)"/i,
    /"blogName"\s*:\s*"([^"]+)"/i,
    /"blog_name"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return "";
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

function mergeUniqueUrls(...groups) {
  const result = [];
  const seen = new Set();

  for (const group of groups) {
    for (const value of group || []) {
      if (!value || seen.has(value)) continue;
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}


function readJsonScripts(html) {
  const results = [];

  const scriptPattern =
    /<script[^>]*type\s*=\s*["'](?:application\/json|application\/ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = scriptPattern.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      results.push(JSON.parse(raw));
    } catch {}
  }

  const nextDataMatch = html.match(
    /<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (nextDataMatch?.[1]) {
    try {
      results.push(JSON.parse(nextDataMatch[1]));
    } catch {}
  }

  return results;
}

function valueMatchesSeriesId(value, seriesId) {
  if (value === null || value === undefined) return false;

  if (Array.isArray(value)) {
    return value.some((item) =>
      valueMatchesSeriesId(item, seriesId)
    );
  }

  if (typeof value === "object") {
    const idCandidates = [
      value.id,
      value.seriesId,
      value.series_id,
    ];

    if (
      idCandidates.some(
        (candidate) => String(candidate ?? "") === String(seriesId)
      )
    ) {
      return true;
    }

    return false;
  }

  return String(value) === String(seriesId);
}

function objectHasTargetSeries(node, seriesId) {
  if (!node || typeof node !== "object") return false;

  const directKeys = [
    "seriesId",
    "series_id",
    "seriesIds",
    "series_ids",
  ];

  for (const key of directKeys) {
    if (
      Object.prototype.hasOwnProperty.call(node, key) &&
      valueMatchesSeriesId(node[key], seriesId)
    ) {
      return true;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(node, "series") &&
    valueMatchesSeriesId(node.series, seriesId)
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(node, "seriesInfo") &&
    valueMatchesSeriesId(node.seriesInfo, seriesId)
  ) {
    return true;
  }

  return false;
}

function extractPostIdentity(node, baseUrl) {
  if (!node || typeof node !== "object") {
    return { url: "", id: "", title: "" };
  }

  const rawUrl =
    normalize(node.url) ||
    normalize(node.href) ||
    normalize(node.link) ||
    normalize(node.permalink) ||
    normalize(node.canonicalUrl);

  let url = "";
  if (rawUrl) {
    try {
      url = new URL(rawUrl, baseUrl).toString();
    } catch {}
  }

  const id =
    normalize(node.postId) ||
    normalize(node.post_id) ||
    normalize(node.contentId) ||
    normalize(node.content_id) ||
    (
      /\/post\/(\d+)/i.test(url)
        ? (url.match(/\/post\/(\d+)/i)?.[1] || "")
        : ""
    );

  const title =
    normalize(node.title) ||
    normalize(node.headline) ||
    normalize(node.name);

  return { url, id, title };
}

function extractNodeDate(node) {
  if (!node || typeof node !== "object") return "";

  const keys = [
    "datePublished",
    "publishedAt",
    "published_at",
    "publishedDate",
    "published_date",
    "createdAt",
    "created_at",
    "uploadDate",
  ];

  for (const key of keys) {
    const date = normalizeDate(node[key]);
    if (date) return date;
  }

  return "";
}

function collectStructuredSeriesDates(html, seriesUrl, seriesId) {
  const roots = readJsonScripts(html);
  const results = [];
  const seen = new Set();

  function walk(node, inheritedSeriesMatch = false, depth = 0) {
    if (!node || depth > 40) return;

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, inheritedSeriesMatch, depth + 1);
      }
      return;
    }

    if (typeof node !== "object") return;

    const localSeriesMatch =
      inheritedSeriesMatch ||
      objectHasTargetSeries(node, seriesId);

    const identity = extractPostIdentity(node, seriesUrl);
    const date = extractNodeDate(node);

    const postLike =
      Boolean(identity.id) ||
      /\/post\/\d+/i.test(identity.url) ||
      Boolean(
        identity.title &&
        date &&
        (
          Object.prototype.hasOwnProperty.call(node, "postId") ||
          Object.prototype.hasOwnProperty.call(node, "post_id") ||
          Object.prototype.hasOwnProperty.call(node, "datePublished") ||
          Object.prototype.hasOwnProperty.call(node, "publishedAt") ||
          Object.prototype.hasOwnProperty.call(node, "published_at")
        )
      );

    if (localSeriesMatch && postLike && date) {
      const key =
        `${identity.id}|${identity.url}|${identity.title}|${date}`;

      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          date,
          url: identity.url,
          id: identity.id,
          title: identity.title,
          source: "structured-series-data",
        });
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") {
        // series 자체의 정보가 아닌 추천/관련 콘텐츠 영역으로 내려갈 때
        // inherited match가 무조건 퍼지는 것을 줄이기 위해 명백한 추천 키는 끊는다.
        const breakInheritance =
          /recommend|related|similar|suggest|popular|advert/i.test(key);

        walk(
          value,
          breakInheritance ? false : localSeriesMatch,
          depth + 1
        );
      }
    }
  }

  for (const root of roots) {
    walk(root, false, 0);
  }

  return results;
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


function formatPostypeUnixDate(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return "";

  // POSTYPE API의 publishedAt은 Unix seconds.
  // 한국 서비스 화면과 날짜 경계를 맞추기 위해 KST(+09:00) 기준 YYYY-MM-DD로 변환한다.
  const milliseconds = raw > 1_000_000_000_000
    ? raw
    : raw * 1000;

  const kst = new Date(milliseconds + (9 * 60 * 60 * 1000));
  if (Number.isNaN(kst.getTime())) return "";

  return kst.toISOString().slice(0, 10);
}

async function fetchSeriesPostsApi(seriesUrl) {
  const info = parseSeriesInfo(seriesUrl);
  if (!info) {
    return {
      ok: false,
      latestPublishedDate: "",
      latestPostUrl: "",
      postId: "",
      title: "",
      apiPostCount: 0,
      strategy: "series-api-invalid-url",
    };
  }

  const apiUrl =
    `https://api.postype.com/api/v1/series/${encodeURIComponent(info.seriesId)}/posts` +
    `?sort=publishedAt,desc&sort=createdAt,desc&page=0`;

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 ArchiveAdmin/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return {
      ok: false,
      latestPublishedDate: "",
      latestPostUrl: "",
      postId: "",
      title: "",
      apiPostCount: 0,
      status: response.status,
      strategy: "series-api-http-error",
    };
  }

  const data = await response.json();
  const content = Array.isArray(data?.content) ? data.content : [];

  // API 자체가 publishedAt DESC, createdAt DESC로 정렬되어 있으므로
  // 현재 시리즈에 속한 "첫 번째 POST"만 사용한다.
  const latestEntry = content.find((entry) => {
    if (entry?.type !== "POST") return false;

    const item = entry?.feedItem;
    if (!item) return false;

    return String(item?.series?.seriesId ?? "") === String(info.seriesId);
  });

  const item = latestEntry?.feedItem;
  if (!item) {
    return {
      ok: false,
      latestPublishedDate: "",
      latestPostUrl: "",
      postId: "",
      title: "",
      apiPostCount: content.length,
      strategy: "series-api-empty",
    };
  }

  const latestPublishedDate =
    formatPostypeUnixDate(item.publishedAt);

  if (!latestPublishedDate) {
    return {
      ok: false,
      latestPublishedDate: "",
      latestPostUrl: "",
      postId: normalize(item.postId),
      title: normalize(item.title),
      apiPostCount: content.length,
      strategy: "series-api-no-published-date",
    };
  }

  const postId = normalize(item.postId);
  const latestPostUrl = postId
    ? `${info.origin}/@${info.handle}/post/${postId}`
    : "";

  return {
    ok: true,
    latestPublishedDate,
    latestPostUrl,
    postId,
    // 시리즈 등록 시 작품 제목은 최신 회차 제목이 아니라 series.title 사용
    seriesTitle: normalize(item?.series?.title),
    // 작가는 채널명이 아니라 POSTYPE 프로필 닉네임 사용
    authorName:
      normalize(item?.profile?.nickname) ||
      normalize(item?.author?.profile?.nickname),
    latestPostTitle: normalize(item.title),
    apiPostCount: content.length,
    strategy: "series-api-first-post",
  };
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
      seriesPageCandidateCount: 0,
      channelPageCandidateCount: 0,
      structuredCandidateCount: 0,
      apiPostCount: 0,
      strategy: "series-invalid-url",
    };
  }

  // 1순위: POSTYPE 웹앱이 실제 시리즈 목록에 사용하는 공식 API.
  // 요청 자체가 최신 발행일 내림차순이므로 content[0]에 해당하는 첫 POST가 최신화다.
  const apiResult = await fetchSeriesPostsApi(seriesUrl);

  if (apiResult.ok) {
    return {
      latestPublishedDate: apiResult.latestPublishedDate,
      latestPostUrl: apiResult.latestPostUrl,
      checkedPostCount: 0,
      matchedSeriesPostCount: 1,
      discoveredPostCount: apiResult.apiPostCount,
      seriesPageCandidateCount: 0,
      channelPageCandidateCount: 0,
      structuredCandidateCount: 0,
      apiPostCount: apiResult.apiPostCount,
      seriesTitle: apiResult.seriesTitle || "",
      authorName: apiResult.authorName || "",
      strategy: apiResult.strategy,
    };
  }

  // API가 일시적으로 막히거나 응답이 비어 있을 때만 기존 HTML 방식으로 fallback.
  const structuredDates =
    collectStructuredSeriesDates(
      seriesHtml,
      seriesUrl,
      info.seriesId
    );

  if (structuredDates.length) {
    const dated = [...structuredDates]
      .filter((item) => item?.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const latest = dated.at(-1);

    if (latest) {
      return {
        latestPublishedDate: latest.date || "",
        latestPostUrl: latest.url || "",
        checkedPostCount: 0,
        matchedSeriesPostCount: dated.length,
        discoveredPostCount: structuredDates.length,
        seriesPageCandidateCount: structuredDates.length,
        channelPageCandidateCount: 0,
        structuredCandidateCount: structuredDates.length,
        apiPostCount: apiResult.apiPostCount || 0,
        strategy: "series-html-fallback",
      };
    }
  }

  return {
    latestPublishedDate: "",
    latestPostUrl: "",
    checkedPostCount: 0,
    matchedSeriesPostCount: 0,
    discoveredPostCount: 0,
    seriesPageCandidateCount: 0,
    channelPageCandidateCount: 0,
    structuredCandidateCount: 0,
    apiPostCount: apiResult.apiPostCount || 0,
    strategy: apiResult.strategy || "series-api-failed",
  };
}

function extractBaseMetadata(html) {
  const jsonLd = readJsonLd(html);

  const rawTitle =
    getMetaContent(html, "og:title") ||
    getMetaContent(html, "twitter:title", "name") ||
    findJsonLdValue(jsonLd, ["headline", "name"]) ||
    getTitleTag(html);

  const author =
    getMetaContent(html, "author", "name") ||
    findJsonLdValue(jsonLd, ["author", "creator"]) ||
    findEmbeddedAuthor(html);

  const channelName =
    getMetaContent(html, "og:site_name") ||
    findEmbeddedChannelName(html);

  const title = cleanTitle(rawTitle, [author, channelName]);

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
    const requestedLinkType = normalize(body?.linkType);

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
      requestedLinkType === "series" ||
      requestedLengthType === "시리즈" ||
      (requestedLinkType !== "post" && isSeriesUrl(page.url));

    const baseMetadata = extractBaseMetadata(page.html);

    let latestPublishedDate = "";
    let latestPostUrl = "";
    let checkedPostCount = 0;
    let matchedSeriesPostCount = 0;
    let discoveredPostCount = 0;
    let seriesPageCandidateCount = 0;
    let channelPageCandidateCount = 0;
    let structuredCandidateCount = 0;
    let apiPostCount = 0;
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
      seriesPageCandidateCount = resolved.seriesPageCandidateCount || 0;
      channelPageCandidateCount = resolved.channelPageCandidateCount || 0;
      structuredCandidateCount = resolved.structuredCandidateCount || 0;
      apiPostCount = resolved.apiPostCount || 0;
      strategy = resolved.strategy;

      // 시리즈는 POSTYPE 실제 series API 값을 우선 사용.
      // series.title은 순수 시리즈 제목이라 채널명 suffix가 붙지 않는다.
      if (resolved.seriesTitle) {
        baseMetadata.title = resolved.seriesTitle;
      }
      if (resolved.authorName) {
        baseMetadata.author = resolved.authorName;
      }
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
        seriesPageCandidateCount,
        channelPageCandidateCount,
        structuredCandidateCount,
        apiPostCount,
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
