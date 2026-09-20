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

export async function onRequestGet(context) {
  try {
    const kv = requireKv(context.env);

    let archive = await getJson(kv, ARCHIVE_CACHE_KEY, null);

    // First request only: build Drive cache automatically.
    if (!archive) {
      archive = await buildArchiveFromDrive(context.env);
      await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
    }

    const [overrides, settings, postypeArchive] = await Promise.all([
      getJson(kv, OVERRIDES_KEY, {}),
      readSettings(kv),
      getJson(kv, POSTYPE_INDEX_KEY, null),
    ]);

    const driveArchive = applyOverrides(archive, overrides);
    const driveItems = (driveArchive?.items || []).map((item) => ({
      ...item,
      source: item.source || "drive",
    }));

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
