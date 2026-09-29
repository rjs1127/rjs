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

const LAST_DRIVE_SYNC_KEY = "archive:last-drive-sync:v1";

export async function runDriveSync(env) {
  const kv = requireKv(env);

  const [scannedArchive, previousArchive, existingOverrides] = await Promise.all([
    buildArchiveFromDrive(env),
    getJson(kv, ARCHIVE_CACHE_KEY, null),
    getJson(kv, OVERRIDES_KEY, {}),
  ]);

  // Drive 전체 구조는 확인하되 캐시에는 실제 변경된 파일/구조만 반영한다.
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

  if (delta.changed || overridesChanged) {
    await refreshPublicArchiveIndex(kv, { archive, overrides: reconciliation.overrides });
  }

  const lastSync = {
    checkedAt: delta.checkedAt || new Date().toISOString(),
    syncedAt: archive.syncedAt || null,
    changed: Boolean(delta.changed || overridesChanged),
    addedCount: delta.added.length,
    updatedCount: delta.updated.length,
    removedCount: delta.removed.length,
    unchangedCount: delta.unchangedCount,
    count: archive.count,
  };
  await kv.put(LAST_DRIVE_SYNC_KEY, JSON.stringify(lastSync));

  return {
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
    lastSync,
    added: delta.added,
    updated: delta.updated,
    removed: delta.removed,
    diagnostics: archive.diagnostics || [],
    reconciledCount: reconciliation.reconciled.length,
    reconciled: reconciliation.reconciled,
  };
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const data = await runDriveSync(context.env);
    return jsonResponse(data);
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "Drive 동기화에 실패했습니다." },
      error?.status || 500
    );
  }
}
