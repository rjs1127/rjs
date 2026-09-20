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

function collectDatesFromObject(node, results, context = {}) {
  if (!node || typeof node !== "object") return;

  const localUrl =
    normalize(node.url) ||
    normalize(node.href) ||
    normalize(node.link) ||
    normalize(node.permalink) ||
    normalize(node.canonicalUrl);

  const localType =
    normalize(node["@type"]) ||
    normalize(node.type) ||
    normalize(node.__typename);

  const title =
    normalize(node.headline) ||
    normalize(node.title) ||
    normalize(node.name);

  const postLike =
    /\/post\/\d+/i.test(localUrl) ||
    /(article|post|episode|content)/i.test(localType) ||
    Boolean(title && (
      node.datePublished ||
      node.publishedAt ||
      node.published_at ||
      node.createdAt ||
      node.created_at
    ));

  if (postLike) {
    const rawDates = [
      node.datePublished,
      node.publishedAt,
      node.published_at,
      node.createdAt,
      node.created_at,
      node.uploadDate,
    ];

    for (const raw of rawDates) {
      const date = normalizeDate(raw);
      if (date) {
        results.push({
          date,
          url: localUrl,
          title,
          source: "object",
        });
      }
    }
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") {
          collectDatesFromObject(item, results, context);
        }
      }
    } else if (value && typeof value === "object") {
      collectDatesFromObject(value, results, context);
    }
  }
}

function collectEmbeddedJsonObjects(html) {
  const objects = [];

  const jsonLdPattern =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = jsonLdPattern.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      objects.push(JSON.parse(raw));
    } catch {}
  }

  const nextDataMatch = html.match(
    /<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (nextDataMatch?.[1]) {
    try {
      objects.push(JSON.parse(nextDataMatch[1]));
    } catch {}
  }

  return objects;
}

function collectEpisodeCardDates(html) {
  const results = [];

  // POSTYPE 회차 링크 주변만 좁게 잘라 날짜를 찾는다.
  const linkPattern = /href\s*=\s*["']([^"']*\/post\/\d+[^"']*)["']/gi;
  let match;

  while ((match = linkPattern.exec(html))) {
    const url = decodeHtml(match[1]);
    const from = Math.max(0, match.index - 1400);
    const to = Math.min(html.length, match.index + 2400);
    const fragment = html.slice(from, to);

    const dateCandidates = [];

    const datetimePattern =
      /<time[^>]*datetime\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let timeMatch;
    while ((timeMatch = datetimePattern.exec(fragment))) {
      const date = normalizeDate(timeMatch[1]);
      if (date) dateCandidates.push(date);
    }

    const jsonPattern =
      /"(?:datePublished|publishedAt|published_at|createdAt|created_at)"\s*:\s*"([^"]+)"/gi;
    let jsonMatch;
    while ((jsonMatch = jsonPattern.exec(fragment))) {
      const date = normalizeDate(jsonMatch[1]);
      if (date) dateCandidates.push(date);
    }

    const visiblePattern =
      /\b(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*\.?\s*(?:일)?\b/g;
    let visibleMatch;
    while ((visibleMatch = visiblePattern.exec(fragment))) {
      const date = normalizeDate(
        `${visibleMatch[1]}-${visibleMatch[2]}-${visibleMatch[3]}`
      );
      if (date) dateCandidates.push(date);
    }

    // 회차 카드 주변에 날짜가 여러 개면 링크에 가장 가까운 데이터만 쓰는 게 안전하다.
    if (dateCandidates.length) {
      results.push({
        date: dateCandidates[0],
        url,
        source: "episode-card",
      });
    }
  }

  return results;
}

function chooseLatestEpisodeDate(html, jsonLd) {
  const candidates = [];

  const embeddedObjects = [
    ...jsonLd,
    ...collectEmbeddedJsonObjects(html),
  ];

  for (const object of embeddedObjects) {
    if (Array.isArray(object)) {
      for (const item of object) {
        collectDatesFromObject(item, candidates);
      }
    } else {
      collectDatesFromObject(object, candidates);
    }
  }

  candidates.push(...collectEpisodeCardDates(html));

  const unique = new Map();

  for (const item of candidates) {
    if (!item?.date) continue;

    // 시리즈 페이지 자체 생성일/수정일처럼 회차와 관계없는 날짜를 배제하려고
    // post 링크 또는 post-like 객체에서 얻은 값만 남긴다.
    const key = `${item.date}|${item.url || ""}|${item.title || ""}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  const filtered = [...unique.values()].filter((item) => {
    if (item.url && /\/post\/\d+/i.test(item.url)) return true;
    return item.source === "object" && Boolean(item.title);
  });

  if (!filtered.length) return {
    date: "",
    candidateCount: 0,
  };

  filtered.sort((a, b) => a.date.localeCompare(b.date));

  return {
    date: filtered[filtered.length - 1].date,
    candidateCount: filtered.length,
  };
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

  let seriesCandidateCount = 0;

  if (seriesMode) {
    const latestEpisode = chooseLatestEpisodeDate(html, jsonLd);
    latestPublishedDate = latestEpisode.date;
    seriesCandidateCount = latestEpisode.candidateCount;
  } else {
    latestPublishedDate = normalizeDate(
      getMetaContent(html, "article:published_time") ||
      getMetaContent(html, "date", "name") ||
      findJsonLdValue(jsonLd, ["datePublished"])
    );
    if (!latestPublishedDate) {
      const latestEpisode = chooseLatestEpisodeDate(html, jsonLd);
      latestPublishedDate = latestEpisode.date;
    }
  }

  return {
    title: normalize(title),
    author: normalize(author),
    latestPublishedDate,
    mode: seriesMode ? "series" : "post",
    seriesCandidateCount,
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
        seriesCandidateCount: metadata.seriesCandidateCount || 0,
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
