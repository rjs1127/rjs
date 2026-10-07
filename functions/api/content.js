import {
  ARCHIVE_CACHE_KEY,
  getJson,
  jsonResponse,
  requireKv,
  getAccessToken,
  driveFetch,
  verifyFileInsideArchive,
  decodeTextSmart,
} from "../_shared.js";
import { requireUser, getBearerToken, getCookieToken } from "../_user.js";


const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const RFC3339_MODIFIED_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeModifiedParam(value) {
  const raw = String(value || "unknown").trim();
  if (!raw || raw === "unknown") return "unknown";
  if (raw.length > 64 || !RFC3339_MODIFIED_PATTERN.test(raw)) return null;
  return Number.isFinite(Date.parse(raw)) ? raw : null;
}

function getBodyCacheKey(fileId, modified) {
  return `body:${fileId}:${modified || "unknown"}`;
}

function hasUserSessionCredential(request) {
  return Boolean(getBearerToken(request) || getCookieToken(request));
}

async function recordAuthenticatedRecentView(context, fileId) {
  try {
    if (!hasUserSessionCredential(context.request)) return;

    const auth = await requireUser(context);
    const now = Date.now();

    await auth.db.prepare(`
      INSERT INTO user_items(user_id, file_id, viewed_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, file_id) DO UPDATE SET
        viewed_at = excluded.viewed_at,
        updated_at = excluded.updated_at
    `).bind(auth.userId, fileId, now, now).run();
  } catch (error) {
    // Recent-view tracking is best-effort and must never block public content.
    console.warn("최근 조회 통합 기록 실패", error);
  }
}

function scheduleAuthenticatedRecentView(context, fileId) {
  if (!hasUserSessionCredential(context.request)) return;

  const task = recordAuthenticatedRecentView(context, fileId);
  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
    return;
  }

  task.catch(() => {});
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const fileId = String(url.searchParams.get("id") || "").trim();
  const modified = normalizeModifiedParam(url.searchParams.get("modified"));
  const raw = url.searchParams.get("raw") === "1";

  if (!fileId) return jsonResponse({ error: "파일 ID가 없습니다." }, 400);
  if (!DRIVE_FILE_ID_PATTERN.test(fileId)) {
    return jsonResponse({ error: "파일 ID 형식이 올바르지 않습니다." }, 400);
  }
  if (modified == null) {
    return jsonResponse({ error: "파일 수정 시각 형식이 올바르지 않습니다." }, 400);
  }

  try {
    const serverStartedAt = Date.now();
    const kv = requireKv(context.env);
    const requestedBodyCacheKey = getBodyCacheKey(fileId, modified);

    let kvReadStartedAt = Date.now();
    // The source archive remains authoritative even if the public index update failed.
    const [archive, cachedBody] = await Promise.all([
      getJson(kv, ARCHIVE_CACHE_KEY, null),
      kv.get(requestedBodyCacheKey, raw ? "arrayBuffer" : "text"),
    ]);
    if (Array.isArray(archive?.items) && !archive.items.some((item) => item.id === fileId)) {
      return jsonResponse({ error: "삭제되었거나 현재 제공되지 않는 작품입니다." }, 404, {
        "cache-control": "no-store",
      });
    }
    // Without an authoritative archive, verify Drive before trusting an old body.
    let cached = Array.isArray(archive?.items) ? cachedBody : null;
    let kvReadMs = Date.now() - kvReadStartedAt;

    const respondFromCache = (value) => {
      // Recent-view tracking starts only after a valid body has actually been found.
      scheduleAuthenticatedRecentView(context, fileId);
      if (raw) {
        const byteLength = value.byteLength;
        return new Response(value, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "x-content-public": "1",
            "cache-control": "private, no-cache",
            "x-content-bytes": String(byteLength),
            "x-content-cached": "1",
            "x-content-server-kv-read-ms": String(kvReadMs),
            "x-content-server-total-ms": String(Date.now() - serverStartedAt),
          },
        });
      }

      return jsonResponse(
        { id: fileId, content: value, cached: true },
        200,
        {
          "cache-control": "private, no-cache",
          "x-content-server-kv-read-ms": String(kvReadMs),
          "x-content-server-total-ms": String(Date.now() - serverStartedAt),
        }
      );
    };

    if (cached !== null) return respondFromCache(cached);

    const tokenStartedAt = Date.now();
    const accessToken = await getAccessToken(context.env);
    const tokenMs = Date.now() - tokenStartedAt;

    const verifyStartedAt = Date.now();
    const verified = await verifyFileInsideArchive(accessToken, fileId);
    const verifyMs = Date.now() - verifyStartedAt;

    // Never create arbitrary body:* keys from a client supplied modified value.
    // Once Drive has verified the file, only its real modifiedTime becomes the write key.
    const verifiedModified = normalizeModifiedParam(verified?.file?.modifiedTime) || "unknown";
    const canonicalBodyCacheKey = getBodyCacheKey(fileId, verifiedModified);

    if (canonicalBodyCacheKey !== requestedBodyCacheKey) {
      kvReadStartedAt = Date.now();
      cached = raw
        ? await kv.get(canonicalBodyCacheKey, "arrayBuffer")
        : await kv.get(canonicalBodyCacheKey, "text");
      kvReadMs += Date.now() - kvReadStartedAt;
      if (cached !== null) return respondFromCache(cached);
    }

    const driveRequestStartedAt = Date.now();
    const response = await driveFetch(
      accessToken,
      `/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
    );
    const driveRequestMs = Date.now() - driveRequestStartedAt;

    const driveDownloadStartedAt = Date.now();
    const buffer = await response.arrayBuffer();
    const driveDownloadMs = Date.now() - driveDownloadStartedAt;

    const decodeStartedAt = Date.now();
    const content = decodeTextSmart(buffer);
    const decodeMs = Date.now() - decodeStartedAt;

    const kvWriteStartedAt = Date.now();
    await kv.put(canonicalBodyCacheKey, content);
    const kvWriteMs = Date.now() - kvWriteStartedAt;

    const buildServerTimingHeaders = () => ({
      "x-content-server-kv-read-ms": String(kvReadMs),
      "x-content-server-token-ms": String(tokenMs),
      "x-content-server-verify-ms": String(verifyMs),
      "x-content-server-drive-request-ms": String(driveRequestMs),
      "x-content-server-drive-download-ms": String(driveDownloadMs),
      "x-content-server-decode-ms": String(decodeMs),
      "x-content-server-kv-write-ms": String(kvWriteMs),
      "x-content-server-total-ms": String(Date.now() - serverStartedAt),
    });

    // Record recent-view only after Drive download/decode/cache write succeeded.
    scheduleAuthenticatedRecentView(context, fileId);

    if (raw) {
      const byteLength = new TextEncoder().encode(content).byteLength;
      return new Response(content, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-content-public": "1",
          "cache-control": "private, no-cache",
          "x-content-bytes": String(byteLength),
          "x-content-cached": "0",
          ...buildServerTimingHeaders(),
        },
      });
    }

    return jsonResponse(
      {
        id: verified.file.id,
        fileName: verified.file.name,
        combination: verified.combination,
        lengthType: verified.lengthType,
        content,
        cached: false,
      },
      200,
      {
        "cache-control": "private, no-cache",
        ...buildServerTimingHeaders(),
      }
    );
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "본문을 불러오지 못했습니다." },
      500,
      { "cache-control": "no-store" }
    );
  }
}
