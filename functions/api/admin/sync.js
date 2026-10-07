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
import { createDailyRestorePoint } from "../../_ops_automation.js";

const LAST_DRIVE_SYNC_KEY = "archive:last-drive-sync:v1";
const LARGE_REMOVAL_MIN_COUNT = 10;
const LARGE_REMOVAL_RATIO = 0.10;

function collectDriveScanIssues(archive) {
  const issues = [];
  for (const diag of archive?.diagnostics || []) {
    if (diag?.error) {
      issues.push(`${diag.combination || "조합 폴더"}: ${diag.error}`);
    }
    for (const lengthDiag of diag?.lengthFolders || []) {
      if (lengthDiag?.error) {
        issues.push(`${diag.combination || "조합 폴더"}/${lengthDiag.name || "하위 폴더"}: ${lengthDiag.error}`);
      }
    }
  }
  return issues;
}

function getLargeRemovalWarning(previousCount, removedCount) {
  const previous = Math.max(0, Number(previousCount || 0));
  const removed = Math.max(0, Number(removedCount || 0));
  if (!previous || !removed) return "";

  const ratio = removed / previous;
  if (removed === previous || (removed >= LARGE_REMOVAL_MIN_COUNT && ratio >= LARGE_REMOVAL_RATIO)) {
    return `Drive 작품이 한 번에 ${removed.toLocaleString("ko-KR")}개 (${Math.round(ratio * 100)}%) 삭제될 예정이라 자동 반영을 보류했습니다.`;
  }
  return "";
}

async function saveBlockedLastSync(kv, previousArchive, scannedArchive, patch = {}) {
  const checkedAt = scannedArchive?.syncedAt || new Date().toISOString();
  const lastSync = {
    state: "warning",
    blocked: true,
    checkedAt,
    syncedAt: previousArchive?.syncedAt || null,
    changed: false,
    addedCount: 0,
    updatedCount: 0,
    removedCount: 0,
    count: Number(previousArchive?.count || 0),
    candidateCount: Number(scannedArchive?.count || 0),
    ...patch,
  };
  await kv.put(LAST_DRIVE_SYNC_KEY, JSON.stringify(lastSync));
  return lastSync;
}

export async function runDriveSync(env, options = {}) {
  const kv = requireKv(env);
  const allowLargeRemoval = Boolean(options.allowLargeRemoval);

  const [scannedArchive, previousArchive, existingOverrides] = await Promise.all([
    buildArchiveFromDrive(env),
    getJson(kv, ARCHIVE_CACHE_KEY, null),
    getJson(kv, OVERRIDES_KEY, {}),
  ]);

  // 부분 폴더 조회 실패를 '작품 삭제'로 오인하지 않는다.
  const scanIssues = collectDriveScanIssues(scannedArchive);
  if (scanIssues.length) {
    const warning = "Drive 일부 폴더를 정상적으로 읽지 못해 이번 동기화를 반영하지 않았습니다.";
    const lastSync = await saveBlockedLastSync(kv, previousArchive, scannedArchive, {
      warning,
      blockedReason: "scan_error",
      scanIssueCount: scanIssues.length,
    });
    return {
      ok: true,
      blocked: true,
      blockedReason: "scan_error",
      warning,
      scanIssues,
      changed: false,
      kvWritten: false,
      count: Number(previousArchive?.count || 0),
      candidateCount: Number(scannedArchive?.count || 0),
      syncedAt: previousArchive?.syncedAt || null,
      checkedAt: lastSync.checkedAt,
      addedCount: 0,
      updatedCount: 0,
      removedCount: 0,
      candidateRemovedCount: 0,
      unchangedCount: Number(previousArchive?.count || 0),
      lastSync,
      added: [],
      updated: [],
      removed: [],
      diagnostics: scannedArchive?.diagnostics || [],
      reconciledCount: 0,
      reconciled: [],
    };
  }

  // Drive 전체 구조는 확인하되 캐시에는 실제 변경된 파일/구조만 반영한다.
  const delta = mergeDriveArchiveDelta(previousArchive, scannedArchive);
  const previousCount = Number(previousArchive?.count || 0);
  const removalWarning = getLargeRemovalWarning(previousCount, delta.removed.length);

  if (removalWarning && !allowLargeRemoval) {
    const lastSync = await saveBlockedLastSync(kv, previousArchive, scannedArchive, {
      warning: removalWarning,
      blockedReason: "large_removal",
      candidateRemovedCount: delta.removed.length,
      previousCount,
    });
    return {
      ok: true,
      blocked: true,
      blockedReason: "large_removal",
      warning: `${removalWarning} 관리자가 수동 동기화에서 한 번 더 확인하면 적용할 수 있습니다.`,
      changed: false,
      kvWritten: false,
      count: previousCount,
      candidateCount: Number(scannedArchive?.count || 0),
      previousCount,
      syncedAt: previousArchive?.syncedAt || null,
      checkedAt: lastSync.checkedAt,
      addedCount: delta.added.length,
      updatedCount: delta.updated.length,
      removedCount: 0,
      candidateRemovedCount: delta.removed.length,
      unchangedCount: delta.unchangedCount,
      lastSync,
      added: delta.added,
      updated: delta.updated,
      removed: [],
      candidateRemoved: delta.removed,
      diagnostics: scannedArchive?.diagnostics || [],
      reconciledCount: 0,
      reconciled: [],
    };
  }

  const archive = delta.archive;
  const reconciliation = reconcileOverridesWithArchive(
    archive,
    existingOverrides,
    previousArchive
  );

  const overridesChanged =
    JSON.stringify(existingOverrides || {}) !==
    JSON.stringify(reconciliation.overrides || {});

  if (delta.changed || overridesChanged) {
    await createDailyRestorePoint(kv, "drive", {
      archive: previousArchive,
      overrides: existingOverrides || {},
    }, {
      addedCount: delta.added.length,
      updatedCount: delta.updated.length,
      removedCount: delta.removed.length,
      overridesChanged,
    });
  }

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
    state: "success",
    blocked: false,
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
    blocked: false,
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
    let body = {};
    try { body = await context.request.json(); } catch {}
    const data = await runDriveSync(context.env, {
      allowLargeRemoval: body?.forceLargeRemoval === true,
    });
    return jsonResponse(data);
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "Drive 동기화에 실패했습니다." },
      error?.status || 500
    );
  }
}
