import {
  ARCHIVE_CACHE_KEY,
  OVERRIDES_KEY,
  jsonResponse,
  requireKv,
  getJson,
  buildArchiveFromDrive,
  applyOverrides,
  readSettings,
} from "../_shared.js";

const POSTYPE_INDEX_KEY = "postype:index:v1";
const DRIVE_CONTENT_TYPE_OVERRIDES_KEY = "archive:drive-content-type-overrides:v1";
const DRIVE_STATUS_OVERRIDES_KEY = "archive:drive-status-overrides:v1";
const DRIVE_SHORT_MAX_BYTES = 200 * 1024;

function getDriveAutoContentType(item) {
  const size = Number(item?.size || 0);
  return size > DRIVE_SHORT_MAX_BYTES ? "연재물" : "단편";
}

export async function onRequestGet(context) {
  try {
    const kv = requireKv(context.env);

    let archive = await getJson(kv, ARCHIVE_CACHE_KEY, null);

    // First request only: build Drive cache automatically.
    if (!archive) {
      archive = await buildArchiveFromDrive(context.env);
      await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
    }

    const [
      overrides,
      settings,
      postypeArchive,
      driveTypeOverrides,
      driveStatusOverrides,
    ] = await Promise.all([
      getJson(kv, OVERRIDES_KEY, {}),
      readSettings(kv),
      getJson(kv, POSTYPE_INDEX_KEY, null),
      getJson(kv, DRIVE_CONTENT_TYPE_OVERRIDES_KEY, {}),
      getJson(kv, DRIVE_STATUS_OVERRIDES_KEY, {}),
    ]);

    const driveArchive = applyOverrides(archive, overrides);
    const driveItems = (driveArchive?.items || []).map((item) => {
      const autoContentType = getDriveAutoContentType(item);
      const manualContentType = ["단편", "연재물"].includes(driveTypeOverrides?.[item.id])
        ? driveTypeOverrides[item.id]
        : "";

      const contentType = manualContentType || autoContentType;
      const manualStatus =
        contentType === "연재물" &&
        ["연재", "완결"].includes(driveStatusOverrides?.[item.id])
          ? driveStatusOverrides[item.id]
          : "";

      return {
        ...item,
        source: item.source || "drive",
        autoContentType,
        contentType,
        contentTypeOverride: manualContentType,
        status: contentType === "단편" ? "완결" : (manualStatus || "완결"),
        statusOverride: manualStatus,
      };
    });

    const postypeItems = Array.isArray(postypeArchive?.items)
      ? postypeArchive.items.map((item) => ({
          ...item,
          source: "postype",
        }))
      : [];

    const items = [...driveItems, ...postypeItems];
    const combinations = [
      ...new Set(
        items
          .map((item) => String(item.combination || "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b, "ko", { sensitivity: "base", numeric: true })
    );

    return jsonResponse(
      {
        ...driveArchive,
        items,
        count: items.length,
        combinations,
        sourceCounts: {
          drive: driveItems.length,
          postype: postypeItems.length,
        },
        postypeSyncedAt: postypeArchive?.syncedAt || null,
        settings,
      },
      200,
      {
        "cache-control": "no-store",
      }
    );
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "콘텐츠 목록을 불러오지 못했습니다." },
      500,
      { "cache-control": "no-store" }
    );
  }
}
