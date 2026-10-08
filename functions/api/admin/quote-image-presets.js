import { jsonResponse, requireKv } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";
import {
  QUOTE_IMAGE_PRESET_CATALOG,
  QUOTE_IMAGE_PRESET_VISIBILITY_KEY,
  readQuoteImagePresetVisibility,
  resolveQuoteImagePresetCatalog,
} from "../../_quote_image_presets.js";

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const { overrides, updatedAt } = await readQuoteImagePresetVisibility(kv);
    return jsonResponse({ presets: resolveQuoteImagePresetCatalog(overrides), updatedAt }, 200, { "cache-control": "no-store" });
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
    const visible = body?.visible;
    const preset = QUOTE_IMAGE_PRESET_CATALOG.find((entry) => entry.key === key);
    if (!preset || typeof visible !== "boolean") {
      return jsonResponse({ error: "프리셋과 노출 여부를 확인해 주세요." }, 400);
    }

    const current = await readQuoteImagePresetVisibility(kv);
    const overrides = { ...current.overrides };
    const currentVisible = typeof overrides[key] === "boolean" ? overrides[key] : preset.defaultVisible;
    if (currentVisible === visible) {
      return jsonResponse({ ok: true, changed: false, kvWritten: false, presets: resolveQuoteImagePresetCatalog(overrides), updatedAt: current.updatedAt }, 200, { "cache-control": "no-store" });
    }

    if (visible === preset.defaultVisible) delete overrides[key];
    else overrides[key] = visible;

    const resolved = resolveQuoteImagePresetCatalog(overrides);
    if (!resolved.some((entry) => entry.visible)) {
      return jsonResponse({ error: "사용자에게 노출되는 프리셋은 최소 1개 이상이어야 합니다." }, 400);
    }

    const updatedAt = new Date().toISOString();
    await kv.put(QUOTE_IMAGE_PRESET_VISIBILITY_KEY, JSON.stringify({ overrides, updatedAt }));
    return jsonResponse({ ok: true, changed: true, kvWritten: true, presets: resolved, updatedAt }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "문장 이미지 프리셋 노출 설정을 저장하지 못했습니다." }, error?.status || 500);
  }
}
