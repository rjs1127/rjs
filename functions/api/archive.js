import {
  ARCHIVE_CACHE_KEY,
  PUBLIC_ARCHIVE_INDEX_KEY,
  jsonResponse,
  requireKv,
  getJson,
  buildArchiveFromDrive,
  refreshPublicArchiveIndex,
} from "../_shared.js";

export async function onRequestGet(context) {
  try {
    const kv = requireKv(context.env);

    // 사용자 목록은 정규화가 끝난 단일 공개 인덱스만 읽는다.
    // 최초 1회 또는 인덱스가 비어 있을 때만 기존 캐시를 조합해 복구한다.
    let index = await getJson(kv, PUBLIC_ARCHIVE_INDEX_KEY, null);

    if (!index) {
      let archive = await getJson(kv, ARCHIVE_CACHE_KEY, null);

      if (!archive) {
        archive = await buildArchiveFromDrive(context.env);
        await kv.put(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
      }

      index = await refreshPublicArchiveIndex(kv);
    }

    if (!index) {
      throw new Error("공개 콘텐츠 인덱스를 만들지 못했습니다.");
    }

    return jsonResponse(index, 200, {
      "cache-control": "no-store",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "콘텐츠 목록을 불러오지 못했습니다." },
      500,
      { "cache-control": "no-store" }
    );
  }
}
