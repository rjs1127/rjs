import {
  ARCHIVE_CACHE_KEY,
  jsonResponse,
  requireKv,
  getJson,
  buildArchiveFromDrive,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const DRIVE_CONTENT_TYPE_OVERRIDES_KEY =
  "archive:drive-content-type-overrides:v1";
const DRIVE_SHORT_MAX_BYTES = 200 * 1024;

function normalize(value) {
  return String(value ?? "").trim();
}

function autoContentType(item) {
  return Number(item?.size || 0) > DRIVE_SHORT_MAX_BYTES
    ? "연재물"
    : "단편";
}

function toAdminItem(item, overrides) {
  const manual = ["단편", "연재물"].includes(overrides?.[item.id])
    ? overrides[item.id]
    : "";
  const auto = autoContentType(item);

  return {
    id: item.id,
    title: item.title || "",
    author: item.author || "",
    combination: item.combination || "",
    fileName: item.fileName || "",
    folderType: item.lengthType || "",
    size: Number(item.size || 0),
    modifiedTime: item.modifiedTime || null,
    autoContentType: auto,
    overrideContentType: manual,
    contentType: manual || auto,
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

    const overrides = await getJson(
      kv,
      DRIVE_CONTENT_TYPE_OVERRIDES_KEY,
      {}
    );

    const items = (archive?.items || [])
      .map((item) => toAdminItem(item, overrides))
      .sort((a, b) => {
        const cp = String(a.combination).localeCompare(
          String(b.combination),
          "ko",
          { numeric: true }
        );
        if (cp !== 0) return cp;

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
        overrideCount: items.filter((item) => item.overrideContentType).length,
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

    const validIds = new Set(
      (archive.items || []).map((item) => String(item.id || ""))
    );

    const current = await getJson(
      kv,
      DRIVE_CONTENT_TYPE_OVERRIDES_KEY,
      {}
    );

    const next = {};
    for (const [id, value] of Object.entries(current || {})) {
      if (
        validIds.has(id) &&
        ["단편", "연재물"].includes(normalize(value))
      ) {
        next[id] = normalize(value);
      }
    }

    let changedCount = 0;

    for (const raw of updates) {
      const id = normalize(raw?.id);
      const value = normalize(raw?.contentType);

      if (!id || !validIds.has(id)) {
        return jsonResponse(
          { error: `Drive에서 파일을 찾지 못했습니다: ${id || "(ID 없음)"}` },
          400
        );
      }

      if (!["", "auto", "단편", "연재물"].includes(value)) {
        return jsonResponse(
          { error: `${id}: 작품형태는 자동/단편/연재물만 사용할 수 있습니다.` },
          400
        );
      }

      const before = next[id] || "";
      const after =
        value === "" || value === "auto"
          ? ""
          : value;

      if (before === after) continue;

      if (after) next[id] = after;
      else delete next[id];

      changedCount += 1;
    }

    if (changedCount) {
      await kv.put(
        DRIVE_CONTENT_TYPE_OVERRIDES_KEY,
        JSON.stringify(next)
      );
    }

    return jsonResponse(
      {
        ok: true,
        changedCount,
        overrideCount: Object.keys(next).length,
        kvWritten: changedCount > 0,
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "Drive 작품형태 저장에 실패했습니다." },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
