import {
  ARCHIVE_CACHE_KEY,
  jsonResponse,
  requireKv,
  requireAdmin,
  buildArchiveFromDrive,
} from "../../_shared.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context);
    const kv = requireKv(context.env);

    const archive = await buildArchiveFromDrive(context.env);
    await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));

    return jsonResponse({
      ok: true,
      count: archive.count,
      syncedAt: archive.syncedAt,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "Drive 동기화에 실패했습니다." },
      error?.status || 500
    );
  }
}
