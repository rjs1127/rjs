import { jsonResponse } from "../../_shared.js";
import {
  requireUserDb,
  ensureUserSchema,
  userErrorResponse,
} from "../../_user.js";
import { requireAdminSession } from "../../_admin_session.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const LEGACY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

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

async function migrateLegacyVisitsOnce(db) {
  const migrated = await db.prepare(`
    SELECT meta_value
    FROM user_system_meta
    WHERE meta_key = 'legacy_visit_metrics_v1'
    LIMIT 1
  `).first();

  if (migrated?.meta_value === "done") return;

  const legacyCount = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM user_visits
  `).first();

  if (Number(legacyCount?.count || 0) > 0) {
    const perUser = await db.prepare(`
      SELECT
        user_id,
        COUNT(*) AS visit_count,
        MAX(visited_at) AS last_visit_at
      FROM user_visits
      GROUP BY user_id
    `).all();

    const perDay = await db.prepare(`
      SELECT
        strftime(
          '%Y-%m-%d',
          CAST(visited_at / 1000 AS INTEGER),
          'unixepoch',
          '+9 hours'
        ) AS metric_date,
        COUNT(*) AS visit_count,
        MAX(visited_at) AS updated_at
      FROM user_visits
      GROUP BY metric_date
    `).all();

    const statements = [];

    for (const row of perUser.results || []) {
      statements.push(
        db.prepare(`
          INSERT INTO user_visit_stats(user_id, visit_count, last_visit_at)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            visit_count = MAX(
              user_visit_stats.visit_count,
              excluded.visit_count
            ),
            last_visit_at = MAX(
              COALESCE(user_visit_stats.last_visit_at, 0),
              COALESCE(excluded.last_visit_at, 0)
            )
        `).bind(
          row.user_id,
          Number(row.visit_count || 0),
          Number(row.last_visit_at || 0)
        )
      );
    }

    for (const row of perDay.results || []) {
      if (!row.metric_date) continue;

      statements.push(
        db.prepare(`
          INSERT INTO daily_user_metrics(metric_date, visit_count, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(metric_date) DO UPDATE SET
            visit_count = MAX(
              daily_user_metrics.visit_count,
              excluded.visit_count
            ),
            updated_at = MAX(
              daily_user_metrics.updated_at,
              excluded.updated_at
            )
        `).bind(
          row.metric_date,
          Number(row.visit_count || 0),
          Number(row.updated_at || Date.now())
        )
      );
    }

    // Batch in chunks so a large legacy history does not create one huge request.
    for (let i = 0; i < statements.length; i += 80) {
      await db.batch(statements.slice(i, i + 80));
    }
  }

  await db.prepare(`
    INSERT INTO user_system_meta(meta_key, meta_value, updated_at)
    VALUES ('legacy_visit_metrics_v1', 'done', ?)
    ON CONFLICT(meta_key) DO UPDATE SET
      meta_value = excluded.meta_value,
      updated_at = excluded.updated_at
  `).bind(Date.now()).run();
}

async function cleanupLegacyVisitRows(db) {
  const cutoff = Date.now() - LEGACY_RETENTION_MS;

  await db.prepare(`
    DELETE FROM user_visits
    WHERE visited_at < ?
  `).bind(cutoff).run();
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);

    const db = requireUserDb(context.env);

    // Cached per Worker isolate. Normal user APIs no longer perform schema checks.
    await ensureUserSchema(db);

    // Legacy raw visit rows are migrated once, then only retained for 90 days.
    await migrateLegacyVisitsOnce(db);
    await cleanupLegacyVisitRows(db);

    const url = new URL(context.request.url);
    const days = Math.max(
      7,
      Math.min(30, Number(url.searchParams.get("days") || 14))
    );

    const dateKeys = buildDateKeys(days);
    const from = dateKeys[0].start;
    const fromDate = dateKeys[0].key;

    const [
      usersResult,
      signupRows,
      dailyMetricRows,
      totalUsersRow,
      totalVisitsRow,
    ] = await Promise.all([
      db.prepare(`
        WITH
        item_stats AS (
          SELECT
            user_id,
            MAX(updated_at) AS last_item_at,
            SUM(CASE WHEN bookmarked = 1 THEN 1 ELSE 0 END) AS bookmark_count,
            SUM(CASE WHEN viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS recent_count,
            SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) AS read_count
          FROM user_items
          GROUP BY user_id
        ),
        session_stats AS (
          SELECT
            user_id,
            MAX(created_at) AS last_session_at
          FROM user_sessions
          GROUP BY user_id
        )
        SELECT
          u.user_id,
          u.created_at,
          COALESCE(v.last_visit_at, 0) AS last_visit_at,
          COALESCE(v.visit_count, 0) AS visit_count,
          COALESCE(i.last_item_at, 0) AS last_item_at,
          COALESCE(i.bookmark_count, 0) AS bookmark_count,
          COALESCE(i.recent_count, 0) AS recent_count,
          COALESCE(i.read_count, 0) AS read_count,
          COALESCE(s.last_session_at, 0) AS last_session_at
        FROM users u
        LEFT JOIN user_visit_stats v ON v.user_id = u.user_id
        LEFT JOIN item_stats i ON i.user_id = u.user_id
        LEFT JOIN session_stats s ON s.user_id = u.user_id
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
        SELECT metric_date, visit_count
        FROM daily_user_metrics
        WHERE metric_date >= ?
        ORDER BY metric_date ASC
      `).bind(fromDate).all(),

      db.prepare(`SELECT COUNT(*) AS count FROM users`).first(),

      db.prepare(`
        SELECT COALESCE(SUM(visit_count), 0) AS count
        FROM user_visit_stats
      `).first(),
    ]);

    const daily = new Map(
      dateKeys.map(({ key }) => [
        key,
        {
          date: key,
          signups: 0,
          visits: 0,
        },
      ])
    );

    for (const row of signupRows.results || []) {
      const key = kstDateKey(row.created_at);
      if (daily.has(key)) daily.get(key).signups += 1;
    }

    for (const row of dailyMetricRows.results || []) {
      if (daily.has(row.metric_date)) {
        daily.get(row.metric_date).visits =
          Number(row.visit_count || 0);
      }
    }

    const dailyStats = [...daily.values()];

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
