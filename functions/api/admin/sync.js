import {
  ARCHIVE_CACHE_KEY,
  OVERRIDES_KEY,
  jsonResponse,
  requireKv,
  requireAdmin,
  getJson,
  buildArchiveFromDrive,
  reconcileOverridesWithArchive,
} from "../../_shared.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context);
    const kv = requireKv(context.env);

    const [archive, existingOverrides] = await Promise.all([
      buildArchiveFromDrive(context.env),
      getJson(kv, OVERRIDES_KEY, {}),
    ]);

    const reconciliation = reconcileOverridesWithArchive(
      archive,
      existingOverrides
    );

    await Promise.all([
      kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive)),
      kv.put(OVERRIDES_KEY, JSON.stringify(reconciliation.overrides)),
    ]);

    return jsonResponse({
      ok: true,
      count: archive.count,
      syncedAt: archive.syncedAt,
      diagnostics: archive.diagnostics || [],
      reconciledCount: reconciliation.reconciled.length,
      reconciled: reconciliation.reconciled,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "Drive 동기화에 실패했습니다." },
      error?.status || 500
    );
  }
}
