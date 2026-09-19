import {
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  jsonResponse,
  requireKv,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json();

    const settings = {
      eyebrow: String(body?.eyebrow ?? DEFAULT_SETTINGS.eyebrow).trim(),
      title: String(body?.title ?? DEFAULT_SETTINGS.title).trim(),
      subtitle: String(body?.subtitle ?? DEFAULT_SETTINGS.subtitle).trim(),
      updatedAt: new Date().toISOString(),
    };

    if (!settings.title) {
      return jsonResponse({ error: "메인 타이틀은 비워둘 수 없습니다." }, 400);
    }

    await kv.put(SETTINGS_KEY, JSON.stringify(settings));
    return jsonResponse({ ok: true, settings });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "화면 문구 저장에 실패했습니다." },
      error?.status || 500
    );
  }
}
