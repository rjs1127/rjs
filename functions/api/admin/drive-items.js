import {
  ARCHIVE_CACHE_KEY,
  jsonResponse,
  requireKv,
  getJson,
  buildArchiveFromDrive,
  refreshPublicArchiveIndex,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const DRIVE_CONTENT_TYPE_OVERRIDES_KEY =
  "archive:drive-content-type-overrides:v1";
const DRIVE_STATUS_OVERRIDES_KEY =
  "archive:drive-status-overrides:v1";
const DRIVE_SHORT_MAX_BYTES = 200 * 1024;
const LAST_DRIVE_SYNC_KEY = "archive:last-drive-sync:v1";

function normalize(value) {
  return String(value ?? "").trim();
}

function autoContentType(item) {
  return Number(item?.size || 0) > DRIVE_SHORT_MAX_BYTES
    ? "연재물"
    : "단편";
}

function toAdminItem(item, typeOverrides, statusOverrides) {
  const manualType =
    ["단편", "연재물"].includes(typeOverrides?.[item.id])
      ? typeOverrides[item.id]
      : "";
  const auto = autoContentType(item);
  const contentType = manualType || auto;

  const manualStatus =
    contentType === "연재물" &&
    ["연재", "완결"].includes(statusOverrides?.[item.id])
      ? statusOverrides[item.id]
      : "";

  return {
    id: item.id,
    title: item.title || "",
    author: item.author || "",
    combination: item.combination || "",
    fileName: item.fileName || "",
    folderType: item.lengthType || "",
    size: Number(item.size || 0),
    createdTime: item.createdTime || null,
    modifiedTime: item.modifiedTime || null,
    autoContentType: auto,
    overrideContentType: manualType,
    contentType,
    overrideStatus: manualStatus,
    status: contentType === "단편" ? "완결" : (manualStatus || "완결"),
  };
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);

    let archive = await getJson(kv, ARCHIVE_CACHE_KEY, null);
    if (!archive) {
      archive = await buildArchiveFromDrive(context.env);
      await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
    }

    const [typeOverrides, statusOverrides, lastSync] = await Promise.all([
      getJson(kv, DRIVE_CONTENT_TYPE_OVERRIDES_KEY, {}),
      getJson(kv, DRIVE_STATUS_OVERRIDES_KEY, {}),
      getJson(kv, LAST_DRIVE_SYNC_KEY, null),
    ]);

    const items = (archive?.items || [])
      .map((item) => toAdminItem(item, typeOverrides, statusOverrides))
      .sort((a, b) => {
        const createdDiff =
          (Date.parse(b.createdTime || "") || 0) -
          (Date.parse(a.createdTime || "") || 0);
        if (createdDiff !== 0) return createdDiff;

        const modifiedDiff =
          (Date.parse(b.modifiedTime || "") || 0) -
          (Date.parse(a.modifiedTime || "") || 0);
        if (modifiedDiff !== 0) return modifiedDiff;

        return String(a.title).localeCompare(
          String(b.title),
          "ko",
          { numeric: true }
        );
      });

    return jsonResponse(
      {
        ok: true,
        thresholdBytes: DRIVE_SHORT_MAX_BYTES,
        thresholdKb: 200,
        count: items.length,
        overrideCount: items.filter(
          (item) => item.overrideContentType || item.overrideStatus
        ).length,
        statusOverrideCount: items.filter(
          (item) => item.overrideStatus
        ).length,
        lastSync,
        mismatchCount: items.filter((item) => {
          const folderExpected =
            item.folderType === "장편"
              ? "연재물"
              : item.folderType === "단편"
                ? "단편"
                : "";
          return folderExpected && folderExpected !== item.autoContentType;
        }).length,
        items,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "Drive 작품형태 목록을 불러오지 못했습니다." },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);

    const body = await context.request.json();
    const updates = Array.isArray(body?.updates) ? body.updates : [];

    const archive = await getJson(kv, ARCHIVE_CACHE_KEY, null);
    if (!archive) {
      return jsonResponse(
        { error: "Drive 캐시가 없습니다. 먼저 Drive 다시 읽기를 실행해 주세요." },
        400
      );
    }

    const archiveItems = archive.items || [];
    const itemById = new Map(
      archiveItems.map((item) => [String(item.id || ""), item])
    );
    const validIds = new Set(itemById.keys());

    const [currentTypes, currentStatuses] = await Promise.all([
      getJson(kv, DRIVE_CONTENT_TYPE_OVERRIDES_KEY, {}),
      getJson(kv, DRIVE_STATUS_OVERRIDES_KEY, {}),
    ]);

    const nextTypes = {};
    for (const [id, value] of Object.entries(currentTypes || {})) {
      if (
        validIds.has(id) &&
        ["단편", "연재물"].includes(normalize(value))
      ) {
        nextTypes[id] = normalize(value);
      }
    }

    const nextStatuses = {};
    for (const [id, value] of Object.entries(currentStatuses || {})) {
      if (
        validIds.has(id) &&
        ["연재", "완결"].includes(normalize(value))
      ) {
        nextStatuses[id] = normalize(value);
      }
    }

    let changedCount = 0;
    let typeChanged = false;
    let statusChanged = false;

    for (const raw of updates) {
      const id = normalize(raw?.id);
      const typeValue = normalize(raw?.contentType);
      const statusValue = normalize(raw?.status);

      if (!id || !validIds.has(id)) {
        return jsonResponse(
          { error: `Drive에서 파일을 찾지 못했습니다: ${id || "(ID 없음)"}` },
          400
        );
      }

      if (!["", "auto", "단편", "연재물"].includes(typeValue)) {
        return jsonResponse(
          { error: `${id}: 작품형태는 자동/단편/연재물만 사용할 수 있습니다.` },
          400
        );
      }

      if (!["", "auto", "연재", "완결"].includes(statusValue)) {
        return jsonResponse(
          { error: `${id}: 상태는 자동/연재중/완결만 사용할 수 있습니다.` },
          400
        );
      }

      const beforeType = nextTypes[id] || "";
      const afterType =
        typeValue === "" || typeValue === "auto"
          ? ""
          : typeValue;

      if (beforeType !== afterType) {
        if (afterType) nextTypes[id] = afterType;
        else delete nextTypes[id];

        changedCount += 1;
        typeChanged = true;
      }

      const sourceItem = itemById.get(id);
      const resolvedContentType =
        afterType ||
        autoContentType(sourceItem);

      const beforeStatus = nextStatuses[id] || "";
      let afterStatus = "";

      if (resolvedContentType === "연재물") {
        afterStatus =
          statusValue === "연재"
            ? "연재"
            : statusValue === "완결"
              ? "완결"
              : "";
      }

      if (beforeStatus !== afterStatus) {
        if (afterStatus) nextStatuses[id] = afterStatus;
        else delete nextStatuses[id];

        changedCount += 1;
        statusChanged = true;
      }
    }

    if (typeChanged) {
      await kv.put(
        DRIVE_CONTENT_TYPE_OVERRIDES_KEY,
        JSON.stringify(nextTypes)
      );
    }

    if (statusChanged) {
      await kv.put(
        DRIVE_STATUS_OVERRIDES_KEY,
        JSON.stringify(nextStatuses)
      );
    }

    if (typeChanged || statusChanged) {
      await refreshPublicArchiveIndex(kv, {
        driveTypeOverrides: nextTypes,
        driveStatusOverrides: nextStatuses,
      });
    }

    return jsonResponse(
      {
        ok: true,
        changedCount,
        overrideCount:
          new Set([
            ...Object.keys(nextTypes),
            ...Object.keys(nextStatuses),
          ]).size,
        statusOverrideCount: Object.keys(nextStatuses).length,
        kvWritten: typeChanged || statusChanged,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "Drive 작품형태/상태 저장에 실패했습니다." },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
