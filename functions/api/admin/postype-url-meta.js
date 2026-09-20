import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const MAX_HTML_BYTES = 1_500_000;

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
      try {
        return String.fromCodePoint(Number(code));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      try {
        return String.fromCodePoint(parseInt(code, 16));
      } catch {
        return _;
      }
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

      if (value && typeof value === "object") {
        if (typeof value.name === "string" && normalize(value.name)) {
          return decodeHtml(value.name);
        }
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
    if (match?.[1]) {
      try {
        return decodeHtml(JSON.parse(`"${match[1]}"`));
      } catch {
        return decodeHtml(match[1]);
      }
    }
  }

  return "";
}

function extractMetadata(html) {
  const jsonLd = readJsonLd(html);

  const title = cleanTitle(
    getMetaContent(html, "og:title") ||
      getMetaContent(html, "twitter:title", "name") ||
      findJsonLdValue(jsonLd, ["headline"]) ||
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

    if (!isPostypeUrl(inputUrl)) {
      return jsonResponse(
        { error: "https://...postype.com 형식의 포스타입 URL만 사용할 수 있습니다." },
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
        { error: "페이지가 너무 커서 자동 정보를 읽지 않았습니다. 제목/작가를 직접 입력해 주세요." },
        400,
        { "cache-control": "no-store" }
      );
    }

    const html = new TextDecoder("utf-8").decode(buffer);
    const metadata = extractMetadata(html);

    return jsonResponse(
      {
        ok: true,
        url: response.url,
        title: metadata.title,
        author: metadata.author,
        found: Boolean(metadata.title || metadata.author),
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message || "포스타입 URL 정보를 불러오지 못했습니다.",
      },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
