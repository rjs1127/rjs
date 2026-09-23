import {
  OVERRIDES_KEY,
  jsonResponse,
  requireKv,
  getJson,
  refreshPublicArchiveIndex,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json();

    const id = String(body?.id || "").trim();
    const title = String(body?.title || "").trim();
    const author = String(body?.author || "").trim();

    if (!id || !title) {
      return jsonResponse({ error: "파일 ID와 제목은 필수입니다." }, 400);
    }

    const overrides = await getJson(kv, OVERRIDES_KEY, {});
    const normalizedAuthor = author || "작성자 미상";
    const current = overrides[id] || null;

    if (
      current &&
      String(current.title || "") === title &&
      String(current.author || "") === normalizedAuthor
    ) {
      return jsonResponse({
        ok: true,
        changed: false,
        kvWritten: false,
        override: current,
      });
    }

    overrides[id] = {
      title,
      author: normalizedAuthor,
      updatedAt: new Date().toISOString(),
    };

    await kv.put(OVERRIDES_KEY, JSON.stringify(overrides));
    await refreshPublicArchiveIndex(kv, { overrides });

    return jsonResponse({
      ok: true,
      changed: true,
      kvWritten: true,
      override: overrides[id],
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "파일명 수정에 실패했습니다." },
      error?.status || 500
    );
  }
}
