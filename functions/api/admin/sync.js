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
  repairPublicArchiveIndexIfDirty,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";
import { createDailyRestorePoint } from "../../_ops_automation.js";

const LAST_DRIVE_SYNC_KEY = "archive:last-drive-sync:v1";
const LARGE_REMOVAL_MIN_COUNT = 10;
const LARGE_REMOVAL_RATIO = 0.10;
const BODY_CACHE_PURGE_QUEUE_KEY = "archive:body-cache-purge-queue:v1";

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


async function enqueueBodyCachePurges(kv, ids = []) {
  const nextIds = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!nextIds.length) return [];
  const previous = await getJson(kv, BODY_CACHE_PURGE_QUEUE_KEY, []);
  const merged = [...new Set([...(Array.isArray(previous) ? previous : []), ...nextIds])];
  await kv.put(BODY_CACHE_PURGE_QUEUE_KEY, JSON.stringify(merged));
  return merged;
}

async function purgeQueuedBodyCaches(kv, archive) {
  const queued = await getJson(kv, BODY_CACHE_PURGE_QUEUE_KEY, []);
  if (!Array.isArray(queued) || !queued.length) return { queued: 0, deletedKeys: 0 };

  const activeIds = new Set((archive?.items || []).map((item) => String(item?.id || "")).filter(Boolean));
  const targets = [...new Set(queued.map((id) => String(id || "").trim()).filter((id) => id && !activeIds.has(id)))];
  if (!targets.length) {
    await kv.delete(BODY_CACHE_PURGE_QUEUE_KEY);
    return { queued: queued.length, deletedKeys: 0 };
  }

  let deletedKeys = 0;
  for (const id of targets) {
    let cursor = undefined;
    do {
      const page = await kv.list({ prefix: `body:${id}:`, ...(cursor ? { cursor } : {}) });
      for (const key of page?.keys || []) {
        await kv.delete(key.name);
        deletedKeys += 1;
      }
      cursor = page?.list_complete ? undefined : page?.cursor;
    } while (cursor);
  }

  await kv.delete(BODY_CACHE_PURGE_QUEUE_KEY);
  return { queued: targets.length, deletedKeys };
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
  const initialReconciliation = reconcileOverridesWithArchive(
    archive,
    existingOverrides,
    previousArchive
  );

  // Drive 스캔 중 관리자가 수동 제목/작가를 수정해도 오래된 스냅샷으로
  // OVERRIDES_KEY 전체를 덮어쓰지 않는다. 실제로 제거가 필요한 ID만
  // 저장 직전에 최신 overrides에서 지운다.
  const reconciledIds = new Set((initialReconciliation.reconciled || []).map((item) => String(item?.id || "")).filter(Boolean));
  let latestOverrides = existingOverrides || {};
  let nextOverrides = initialReconciliation.overrides || {};
  if (reconciledIds.size) {
    latestOverrides = await getJson(kv, OVERRIDES_KEY, {});
    nextOverrides = { ...(latestOverrides || {}) };
    for (const id of reconciledIds) delete nextOverrides[id];
  }

  const overridesChanged =
    JSON.stringify(latestOverrides || {}) !==
    JSON.stringify(nextOverrides || {});
  const reconciliation = { ...initialReconciliation, overrides: nextOverrides };

  if (delta.changed || overridesChanged) {
    await createDailyRestorePoint(kv, "drive", {
      archive: previousArchive,
      overrides: latestOverrides || {},
    }, {
      addedCount: delta.added.length,
      updatedCount: delta.updated.length,
      removedCount: delta.removed.length,
      overridesChanged,
    });
  }

  // 삭제된 Drive 파일의 본문 캐시는 나중에라도 반드시 정리할 수 있도록
  // 원본 아카이브를 바꾸기 전에 삭제 대기열을 남긴다. 파일이 복구되면
  // purge 단계에서 현재 아카이브를 보고 자동으로 제외한다.
  if (delta.removed.length) {
    await enqueueBodyCachePurges(kv, delta.removed);
  }

  if (delta.changed) {
    await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
  }
  if (overridesChanged) {
    await kv.put(OVERRIDES_KEY, JSON.stringify(nextOverrides));
  }

  let publicIndexRepaired = false;
  if (delta.changed || overridesChanged) {
    // overrides는 여기서 다시 읽게 해 동기화 도중 들어온 관리자 수정이
    // 공개 인덱스에서 되돌아가지 않도록 한다.
    await refreshPublicArchiveIndex(kv, { archive });
  } else {
    publicIndexRepaired = await repairPublicArchiveIndexIfDirty(kv, { archive });
  }

  let cachePurge = { queued: 0, deletedKeys: 0 };
  let cachePurgeWarning = "";
  try {
    cachePurge = await purgeQueuedBodyCaches(kv, archive);
  } catch (error) {
    cachePurgeWarning = `삭제된 TXT 본문 캐시 정리를 완료하지 못했습니다: ${error?.message || "알 수 없는 오류"}`;
    console.warn(cachePurgeWarning);
  }

  const lastSync = {
    state: cachePurgeWarning ? "warning" : "success",
    blocked: false,
    checkedAt: delta.checkedAt || new Date().toISOString(),
    syncedAt: archive.syncedAt || null,
    changed: Boolean(delta.changed || overridesChanged),
    addedCount: delta.added.length,
    updatedCount: delta.updated.length,
    removedCount: delta.removed.length,
    unchangedCount: delta.unchangedCount,
    count: archive.count,
    publicIndexRepaired,
    cachePurgeDeletedKeys: Number(cachePurge.deletedKeys || 0),
    cachePurgeWarning,
    warning: cachePurgeWarning,
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
    publicIndexRepaired,
    cachePurgeDeletedKeys: Number(cachePurge.deletedKeys || 0),
    cachePurgeWarning,
    warning: cachePurgeWarning,
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
