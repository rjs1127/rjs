import { jsonResponse, requireAdmin } from "../../_shared.js";
import {
  requireUserDb,
  ensureUserSchema,
  userErrorResponse,
} from "../../_user.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(timestamp) {
  return new Date(Number(timestamp) + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function buildDateKeys(days) {
  const now = Date.now();
  const todayStartUtc =
    Math.floor((now + KST_OFFSET_MS) / 86400000) * 86400000 -
    KST_OFFSET_MS;

  return Array.from({ length: days }, (_, index) => {
    const start = todayStartUtc - (days - 1 - index) * 86400000;
    return {
      key: kstDateKey(start),
      start,
    };
  });
}

export async function onRequestGet(context) {
  try {
    requireAdmin(context);

    const db = requireUserDb(context.env);
    await ensureUserSchema(db);

    const url = new URL(context.request.url);
    const days = Math.max(
      7,
      Math.min(30, Number(url.searchParams.get("days") || 14))
    );

    const dateKeys = buildDateKeys(days);
    const from = dateKeys[0].start;

    const [
      usersResult,
      signupRows,
      visitRows,
      totalUsersRow,
      totalVisitsRow,
    ] = await Promise.all([
      db.prepare(`
        SELECT
          u.user_id,
          u.created_at,
          COALESCE((
            SELECT MAX(v.visited_at)
            FROM user_visits v
            WHERE v.user_id = u.user_id
          ), 0) AS last_visit_at,
          COALESCE((
            SELECT MAX(i.updated_at)
            FROM user_items i
            WHERE i.user_id = u.user_id
          ), 0) AS last_item_at,
          COALESCE((
            SELECT MAX(s.created_at)
            FROM user_sessions s
            WHERE s.user_id = u.user_id
          ), 0) AS last_session_at,
          COALESCE((
            SELECT COUNT(*)
            FROM user_items i
            WHERE i.user_id = u.user_id AND i.bookmarked = 1
          ), 0) AS bookmark_count,
          COALESCE((
            SELECT COUNT(*)
            FROM user_items i
            WHERE i.user_id = u.user_id AND i.viewed_at IS NOT NULL
          ), 0) AS recent_count,
          COALESCE((
            SELECT COUNT(*)
            FROM user_items i
            WHERE i.user_id = u.user_id AND i.read_at IS NOT NULL
          ), 0) AS read_count,
          COALESCE((
            SELECT COUNT(*)
            FROM user_visits v
            WHERE v.user_id = u.user_id
          ), 0) AS visit_count
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 1000
      `).all(),

      db.prepare(`
        SELECT created_at
        FROM users
        WHERE created_at >= ?
        ORDER BY created_at ASC
      `).bind(from).all(),

      db.prepare(`
        SELECT user_id, visited_at
        FROM user_visits
        WHERE visited_at >= ?
        ORDER BY visited_at ASC
      `).bind(from).all(),

      db.prepare(`SELECT COUNT(*) AS count FROM users`).first(),

      db.prepare(`SELECT COUNT(*) AS count FROM user_visits`).first(),
    ]);

    const daily = new Map(
      dateKeys.map(({ key }) => [
        key,
        {
          date: key,
          signups: 0,
          visits: 0,
          uniqueUsers: new Set(),
        },
      ])
    );

    for (const row of signupRows.results || []) {
      const key = kstDateKey(row.created_at);
      if (daily.has(key)) daily.get(key).signups += 1;
    }

    for (const row of visitRows.results || []) {
      const key = kstDateKey(row.visited_at);
      if (!daily.has(key)) continue;
      const target = daily.get(key);
      target.visits += 1;
      target.uniqueUsers.add(row.user_id);
    }

    const dailyStats = [...daily.values()].map((row) => ({
      date: row.date,
      signups: row.signups,
      visits: row.visits,
      uniqueVisitors: row.uniqueUsers.size,
    }));

    const users = (usersResult.results || []).map((row) => ({
      userId: row.user_id,
      createdAt: Number(row.created_at || 0),
      lastActivityAt: Math.max(
        Number(row.last_visit_at || 0),
        Number(row.last_item_at || 0),
        Number(row.last_session_at || 0)
      ),
      bookmarkCount: Number(row.bookmark_count || 0),
      recentCount: Number(row.recent_count || 0),
      readCount: Number(row.read_count || 0),
      visitCount: Number(row.visit_count || 0),
    }));

    return jsonResponse(
      {
        ok: true,
        summary: {
          totalUsers: Number(totalUsersRow?.count || 0),
          totalVisits: Number(totalVisitsRow?.count || 0),
          todaySignups: dailyStats.at(-1)?.signups || 0,
          todayVisits: dailyStats.at(-1)?.visits || 0,
        },
        daily: dailyStats,
        users,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);
    return userErrorResponse(error);
  }
}
