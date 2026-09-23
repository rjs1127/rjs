import { jsonResponse } from "../../_shared.js";
import {
  requireUser,
  ensureDownloadTrackingSchema,
  ensurePersonalizationSchema,
  userErrorResponse,
} from "../../_user.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKstDateKey(timestamp) {
  return new Date(timestamp + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);

    // 기존 library/profile 엔드포인트가 보장하던 스키마 호환성을 유지한다.
    await ensureDownloadTrackingSchema(auth.db);
    await ensurePersonalizationSchema(auth.db);

    // 로그인 직후 필요한 읽기 데이터를 한 번의 D1 batch로 묶는다.
    const [userResult, itemsResult, likesResult, quotesResult] = await auth.db.batch([
      auth.db.prepare(`
        SELECT user_id, created_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `).bind(auth.userId),
      auth.db.prepare(`
        SELECT
          file_id,
          progress_percent,
          scroll_top,
          chunk_index,
          chunk_ratio,
          bookmarked,
          viewed_at,
          read_at,
          downloaded_at,
          updated_at
        FROM user_items
        WHERE user_id = ?
        ORDER BY COALESCE(viewed_at, updated_at) DESC
        LIMIT 500
      `).bind(auth.userId),
      auth.db.prepare(`
        SELECT work_id, title, author, liked_at
        FROM user_likes
        WHERE user_id = ?
        ORDER BY liked_at DESC
        LIMIT 500
      `).bind(auth.userId),
      auth.db.prepare(`
        SELECT id, title, author, quote_text, created_at
        FROM user_quotes
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 500
      `).bind(auth.userId),
    ]);

    const now = Date.now();
    const metricDate = getKstDateKey(now);
    let visitRecorded = true;

    // 방문 통계는 개인화 데이터 로딩 성공 여부와 분리해 best-effort로 기록한다.
    // 실패하더라도 로그인/라이브러리 복원을 막지 않는다.
    try {
      await auth.db.batch([
        auth.db.prepare(`
          INSERT INTO user_visit_stats(user_id, visit_count, last_visit_at)
          VALUES (?, 1, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            visit_count = user_visit_stats.visit_count + 1,
            last_visit_at = excluded.last_visit_at
        `).bind(auth.userId, now),
        auth.db.prepare(`
          INSERT INTO daily_user_metrics(metric_date, visit_count, updated_at)
          VALUES (?, 1, ?)
          ON CONFLICT(metric_date) DO UPDATE SET
            visit_count = daily_user_metrics.visit_count + 1,
            updated_at = excluded.updated_at
        `).bind(metricDate, now),
      ]);
    } catch (error) {
      visitRecorded = false;
      console.warn("로그인 초기 방문 통계 기록 실패", error);
    }

    const userRow = userResult?.results?.[0] || null;

    return jsonResponse({
      ok: true,
      user: {
        userId: auth.userId,
        createdAt: userRow?.created_at == null ? null : Number(userRow.created_at),
      },
      items: itemsResult?.results || [],
      likes: likesResult?.results || [],
      quotes: quotesResult?.results || [],
      visitRecorded,
      visitedAt: visitRecorded ? now : null,
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}
