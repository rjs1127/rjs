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
      siteName: String(body?.siteName ?? DEFAULT_SETTINGS.siteName).trim(),
      faviconUrl: faviconUrl || DEFAULT_SETTINGS.faviconUrl,
      eyebrow: String(body?.eyebrow ?? DEFAULT_SETTINGS.eyebrow).trim(),
      title: String(body?.title ?? DEFAULT_SETTINGS.title).trim(),
      updatedAt: new Date().toISOString(),
    };

    if (!settings.siteName) {
      return jsonResponse({ error: "사이트 이름은 비워둘 수 없습니다." }, 400);
    }

    if (settings.siteName.length > 40) {
      return jsonResponse({ error: "사이트 이름은 40자 이하로 입력해주세요." }, 400);
    }

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
