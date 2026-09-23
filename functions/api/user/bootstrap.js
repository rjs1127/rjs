import { jsonResponse } from "../../_shared.js";
import {
  requireUser,
  ensureDownloadTrackingSchema,
  ensurePersonalizationSchema,
  userErrorResponse,
} from "../../_user.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const VISIT_SESSION_WINDOW_MS = 30 * 60 * 1000;

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

    // 로그인 직후 메인 화면에 필요한 읽기 데이터만 한 번의 D1 batch로 묶는다.
    // 저장문장은 프로필의 저장문장 탭을 열 때 지연 로딩하여 초기 D1/응답 부하를 줄인다.
    const [userResult, itemsResult, likesResult] = await auth.db.batch([
      auth.db.prepare(`
        SELECT
          u.user_id,
          u.created_at,
          v.last_visit_at
        FROM users u
        LEFT JOIN user_visit_stats v ON v.user_id = u.user_id
        WHERE u.user_id = ?
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
    ]);

    const now = Date.now();
    const metricDate = getKstDateKey(now);
    const userRow = userResult?.results?.[0] || null;
    const lastVisitAt = Number(userRow?.last_visit_at || 0);
    const shouldCountVisit =
      !lastVisitAt || now - lastVisitAt >= VISIT_SESSION_WINDOW_MS;
    let visitRecorded = true;
    let visitCounted = false;

    // 방문 통계는 새로고침 횟수가 아니라 30분 단위의 방문 세션으로 집계한다.
    // 같은 사용자가 짧은 시간 안에 반복 새로고침해도 D1 write와 방문 수를 늘리지 않는다.
    // last_visit_at은 위의 기존 user 조회에 JOIN하여 별도 D1 조회를 추가하지 않는다.
    if (shouldCountVisit) {
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
        visitCounted = true;
      } catch (error) {
        visitRecorded = false;
        console.warn("로그인 초기 방문 통계 기록 실패", error);
      }
    }

    return jsonResponse({
      ok: true,
      user: {
        userId: auth.userId,
        createdAt: userRow?.created_at == null ? null : Number(userRow.created_at),
      },
      items: itemsResult?.results || [],
      likes: likesResult?.results || [],
      visitRecorded,
      visitCounted,
      visitedAt: visitCounted ? now : (lastVisitAt || null),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}
