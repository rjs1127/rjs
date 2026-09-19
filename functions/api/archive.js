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

export async function onRequestGet(context) {
  try {
    const kv = requireKv(context.env);

    let archive = await getJson(kv, ARCHIVE_CACHE_KEY, null);

    // First request only: build cache automatically.
    if (!archive) {
      archive = await buildArchiveFromDrive(context.env);
      await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
    }

    const [overrides, settings] = await Promise.all([
      getJson(kv, OVERRIDES_KEY, {}),
      readSettings(kv),
    ]);

    return jsonResponse(
      {
        ...applyOverrides(archive, overrides),
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
