import {
  jsonResponse,
  requireKv,
  getAccessToken,
  driveFetch,
  verifyFileInsideArchive,
  decodeTextSmart,
} from "../_shared.js";
import { requireUser } from "../_user.js";


async function recordAuthenticatedRecentView(context, fileId) {
  try {
    if (!context.request.headers.get("authorization")) return;

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
  if (!context.request.headers.get("authorization")) return;

  const task = recordAuthenticatedRecentView(context, fileId);
  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
    return;
  }

  task.catch(() => {});
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const fileId = url.searchParams.get("id");
  const modified = url.searchParams.get("modified") || "unknown";
  const raw = url.searchParams.get("raw") === "1";

  if (!fileId) return jsonResponse({ error: "파일 ID가 없습니다." }, 400);

  // Logged-in recent-view tracking shares this same Functions request instead
  // of issuing a separate /api/user/item POST from the browser.
  scheduleAuthenticatedRecentView(context, fileId);

  try {
    const kv = requireKv(context.env);
    const bodyCacheKey = `body:${fileId}:${modified}`;
    const cached = await kv.get(bodyCacheKey);

    if (cached !== null) {
      if (raw) {
        const byteLength = new TextEncoder().encode(cached).byteLength;
        return new Response(cached, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "private, max-age=300",
            "x-content-bytes": String(byteLength),
            "x-content-cached": "1",
          },
        });
      }

      return jsonResponse(
        { id: fileId, content: cached, cached: true },
        200,
        { "cache-control": "private, max-age=300" }
      );
    }

    const accessToken = await getAccessToken(context.env);
    const verified = await verifyFileInsideArchive(accessToken, fileId);

    const response = await driveFetch(
      accessToken,
      `/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
    );

    const buffer = await response.arrayBuffer();
    const content = decodeTextSmart(buffer);

    await kv.put(bodyCacheKey, content);

    if (raw) {
      const byteLength = new TextEncoder().encode(content).byteLength;
      return new Response(content, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "private, max-age=300",
          "x-content-bytes": String(byteLength),
          "x-content-cached": "0",
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
      { "cache-control": "private, max-age=300" }
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
