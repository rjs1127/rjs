import {
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  jsonResponse,
  requireKv,
  refreshPublicArchiveIndex,
  readSettings,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json();

    const faviconUrl = String(
      body?.faviconUrl ?? DEFAULT_SETTINGS.faviconUrl
    ).trim();

    const allowedFavicon =
      !faviconUrl ||
      faviconUrl.startsWith("/") ||
      /^https?:\/\//i.test(faviconUrl) ||
      /^data:image\//i.test(faviconUrl);

    if (!allowedFavicon) {
      return jsonResponse(
        { error: "파비콘은 https URL, /로 시작하는 경로, 또는 data:image 형식만 사용할 수 있습니다." },
        400
      );
    }

    const settings = {
      faviconUrl: faviconUrl || DEFAULT_SETTINGS.faviconUrl,
      eyebrow: String(body?.eyebrow ?? DEFAULT_SETTINGS.eyebrow).trim(),
      title: String(body?.title ?? DEFAULT_SETTINGS.title).trim(),
      updatedAt: new Date().toISOString(),
    };


    if (!settings.title) {
      return jsonResponse({ error: "메인 타이틀은 비워둘 수 없습니다." }, 400);
    }

    const current = await readSettings(kv);
    const unchanged =
      String(current?.faviconUrl || "") === settings.faviconUrl &&
      String(current?.eyebrow || "") === settings.eyebrow &&
      String(current?.title || "") === settings.title;

    if (unchanged) {
      return jsonResponse({
        ok: true,
        changed: false,
        kvWritten: false,
        settings: current,
      });
    }

    await kv.put(SETTINGS_KEY, JSON.stringify(settings));
    await refreshPublicArchiveIndex(kv, { settings });
    return jsonResponse({ ok: true, changed: true, kvWritten: true, settings });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "화면 문구 저장에 실패했습니다." },
      error?.status || 500
    );
  }
}
