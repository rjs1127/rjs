import {
  ARCHIVE_CACHE_KEY,
  OVERRIDES_KEY,
  jsonResponse,
  requireKv,
  getJson,
  applyOverrides,
  readSettings,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";
import { requireUserDb } from "../../_user.js";
import { ensureFeedbackSchema } from "../../_feedback.js";

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);

    const [archive, overrides, settings] = await Promise.all([
      getJson(kv, ARCHIVE_CACHE_KEY, null),
      getJson(kv, OVERRIDES_KEY, {}),
      readSettings(kv),
    ]);

    const applied = archive ? applyOverrides(archive, overrides) : null;
    const baseItems = archive?.items || [];

    const needsReview = (applied?.items || []).filter(
      (item) => item.parseFailed && !item.manuallyEdited
    );

    const effectiveEditedCount = baseItems.filter(
      (item) => item.parseFailed && Boolean(overrides[item.id])
    ).length;

    let feedbackNewCount = 0;
    try {
      const db = requireUserDb(context.env);
      await ensureFeedbackSchema(db);
      const feedbackCount = await db.prepare(`
        SELECT COUNT(*) AS count
        FROM feedback
        WHERE status = 'new'
      `).first();
      feedbackNewCount = Number(feedbackCount?.count || 0);
    } catch (error) {
      console.warn("feedback badge count failed", error);
    }

    return jsonResponse({
      settings,
      syncedAt: archive?.syncedAt || null,
      count: archive?.count || 0,
      diagnostics: archive?.diagnostics || [],
      needsReview,
      editedCount: effectiveEditedCount,
      feedbackNewCount,
    });
  } catch (error) {
    return jsonResponse(
      { error: error?.message || "관리자 데이터를 불러오지 못했습니다." },
      error?.status || 500
    );
  }
}
