import {
  ARCHIVE_CACHE_KEY,
  OVERRIDES_KEY,
  jsonResponse,
  requireKv,
  getJson,
  buildArchiveFromDrive,
  mergeDriveArchiveDelta,
  reconcileOverridesWithArchive,
  refreshPublicArchiveIndex,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);

    const [scannedArchive, previousArchive, existingOverrides] = await Promise.all([
      buildArchiveFromDrive(context.env),
      getJson(kv, ARCHIVE_CACHE_KEY, null),
      getJson(kv, OVERRIDES_KEY, {}),
    ]);

    // Drive 전체 구조는 확인하되 캐시에는 실제 변경된 파일/구조만 반영한다.
    // 변경이 없으면 기존 JSON을 그대로 유지해 불필요한 KV 쓰기를 피한다.
    const delta = mergeDriveArchiveDelta(previousArchive, scannedArchive);
    const archive = delta.archive;
    const reconciliation = reconcileOverridesWithArchive(
      archive,
      existingOverrides,
      previousArchive
    );

    const overridesChanged =
      JSON.stringify(existingOverrides || {}) !==
      JSON.stringify(reconciliation.overrides || {});

    if (delta.changed) {
      await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
    }
    if (overridesChanged) {
      await kv.put(OVERRIDES_KEY, JSON.stringify(reconciliation.overrides));
    }

    // 사용자 화면용 단일 JSON 인덱스는 원본 캐시가 실제 바뀐 경우에만 갱신한다.
    if (delta.changed || overridesChanged) {
      await refreshPublicArchiveIndex(kv, { archive, overrides: reconciliation.overrides });
    }

    return jsonResponse({
      ok: true,
      changed: delta.changed || overridesChanged,
      kvWritten: delta.changed || overridesChanged,
      count: archive.count,
      syncedAt: archive.syncedAt,
      checkedAt: delta.checkedAt,
      addedCount: delta.added.length,
      updatedCount: delta.updated.length,
      removedCount: delta.removed.length,
      unchangedCount: delta.unchangedCount,
      added: delta.added,
      updated: delta.updated,
      removed: delta.removed,
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
