import { jsonResponse, requireKv } from "../_shared.js";
import { readQuoteImagePresetVisibility, resolveQuoteImagePresetCatalog } from "../_quote_image_presets.js";

export async function onRequestGet(context) {
  try {
    const kv = requireKv(context.env);
    const { overrides, updatedAt } = await readQuoteImagePresetVisibility(kv);
    const presets = resolveQuoteImagePresetCatalog(overrides).map(({ key, visible }) => ({ key, visible }));
    return jsonResponse({ presets, updatedAt }, 200, {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "문장 이미지 프리셋 설정을 불러오지 못했습니다." }, error?.status || 500);
  }
}
