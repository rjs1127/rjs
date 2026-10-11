import { requireUserDb } from "../../_user.js";
import { jsonResponse, requireKv } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";
import {
  QUOTE_IMAGE_PRESET_CATALOG,
  saveQuoteImagePresetVisibility,
  readQuoteImagePresetVisibility,
  resolveQuoteImagePresetCatalog,
} from "../../_quote_image_presets.js";

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const { overrides, feedOverrides, updatedAt } = await readQuoteImagePresetVisibility(kv, requireUserDb(context.env));
    return jsonResponse({ presets: resolveQuoteImagePresetCatalog(overrides, feedOverrides), updatedAt }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "문장 이미지 프리셋 설정을 불러오지 못했습니다." }, error?.status || 500);
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json();
    const key = String(body?.key || "").trim();
    const field = body?.field === "feed" ? "feed" : body?.field == null || body?.field === "visible" ? "visible" : "";
    const visible = body?.visible;
    const preset = QUOTE_IMAGE_PRESET_CATALOG.find((entry) => entry.key === key);
    if (!preset || !field || typeof visible !== "boolean") {
      return jsonResponse({ error: "프리셋과 노출 여부를 확인해 주세요." }, 400);
    }

    if (field === "feed" && visible && !resolveQuoteImagePresetCatalog().find(p => p.key === key).feedEligible) {
      return jsonResponse({ error: "이미지/SVG 배경은 피드에서 사용할 수 없습니다. CSS 배경만 선택해 주세요." }, 400);
    }
    const result = await saveQuoteImagePresetVisibility(kv, requireUserDb(context.env), key, field, visible);
    return jsonResponse({ ok: true, ...result, kvWritten: false }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "문장 이미지 프리셋 노출 설정을 저장하지 못했습니다." }, error?.status || 500);
  }
}
