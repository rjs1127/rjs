import {
  ARCHIVE_CACHE_KEY,
  OVERRIDES_KEY,
  jsonResponse,
  requireKv,
  requireAdmin,
  getJson,
  applyOverrides,
  readSettings,
} from "../../_shared.js";

export async function onRequestGet(context) {
  try {
    requireAdmin(context);
    const kv = requireKv(context.env);

    const [archive, overrides, settings] = await Promise.all([
      getJson(kv, ARCHIVE_CACHE_KEY, null),
      getJson(kv, OVERRIDES_KEY, {}),
      readSettings(kv),
    ]);

    const applied = archive ? applyOverrides(archive, overrides) : null;
    const needsReview = (applied?.items || []).filter(
      (item) => item.parseFailed && !item.manuallyEdited
    );

    return jsonResponse({
      settings,
      syncedAt: archive?.syncedAt || null,
      count: archive?.count || 0,
      diagnostics: archive?.diagnostics || [],
      needsReview,
      editedCount: Object.keys(overrides).length,
    });
  } catch (error) {
    return jsonResponse(
      { error: error?.message || "관리자 데이터를 불러오지 못했습니다." },
      error?.status || 500
    );
  }
}
