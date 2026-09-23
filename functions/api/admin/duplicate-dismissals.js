import { jsonResponse, requireKv, getJson } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const DUPLICATE_DISMISSALS_KEY = "archive:duplicate-dismissals:v1";

function normalizePairs(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean))].sort();
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const stored = await getJson(kv, DUPLICATE_DISMISSALS_KEY, { pairs: [] });
    return jsonResponse({ ok: true, pairs: normalizePairs(stored?.pairs) }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "중복 제외 기록을 불러오지 못했습니다." }, error?.status || 500);
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json().catch(() => ({}));
    const incoming = normalizePairs(body?.pairs);
    if (!incoming.length) return jsonResponse({ ok: true, pairs: [] });

    const stored = await getJson(kv, DUPLICATE_DISMISSALS_KEY, { pairs: [] });
    const pairs = normalizePairs([...(stored?.pairs || []), ...incoming]);
    await kv.put(DUPLICATE_DISMISSALS_KEY, JSON.stringify({ pairs, updatedAt: new Date().toISOString() }));
    return jsonResponse({ ok: true, pairs, addedCount: incoming.length });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "중복 제외 기록을 저장하지 못했습니다." }, error?.status || 500);
  }
}
