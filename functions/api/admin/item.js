import {
  OVERRIDES_KEY,
  jsonResponse,
  requireKv,
  requireAdmin,
  getJson,
} from "../../_shared.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context);
    const kv = requireKv(context.env);
    const body = await context.request.json();

    const id = String(body?.id || "").trim();
    const title = String(body?.title || "").trim();
    const author = String(body?.author || "").trim();

    if (!id || !title) {
      return jsonResponse({ error: "파일 ID와 제목은 필수입니다." }, 400);
    }

    const overrides = await getJson(kv, OVERRIDES_KEY, {});
    overrides[id] = {
      title,
      author: author || "작성자 미상",
      updatedAt: new Date().toISOString(),
    };

    await kv.put(OVERRIDES_KEY, JSON.stringify(overrides));

    return jsonResponse({ ok: true, override: overrides[id] });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "파일명 수정에 실패했습니다." },
      error?.status || 500
    );
  }
}
