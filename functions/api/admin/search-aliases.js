import { SEARCH_ALIASES_KEY, jsonResponse, requireKv, getJson, refreshPublicArchiveIndex } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const normalizeKey = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
const cleanAliases = (value) => [...new Set((Array.isArray(value) ? value : String(value || "").split(",")).map((v) => String(v || "").trim()).filter(Boolean))].slice(0, 30);

async function readAliases(kv) {
  const data = await getJson(kv, SEARCH_ALIASES_KEY, { authors: {}, works: {} });
  return { authors: data?.authors && typeof data.authors === "object" ? data.authors : {}, works: data?.works && typeof data.works === "object" ? data.works : {} };
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    return jsonResponse({ ok: true, aliases: await readAliases(kv) });
  } catch (error) { return jsonResponse({ error: error?.message || "검색 별칭을 불러오지 못했습니다." }, error?.status || 500); }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json();
    const type = body?.type === "work" ? "work" : "author";
    const author = String(body?.author || "").trim();
    const title = String(body?.title || "").trim();
    const aliases = cleanAliases(body?.aliases);
    if (!author) return jsonResponse({ error: "작가명을 입력해 주세요." }, 400);
    if (type === "work" && !title) return jsonResponse({ error: "작품명을 입력해 주세요." }, 400);
    const data = await readAliases(kv);
    const key = type === "author" ? normalizeKey(author) : `${normalizeKey(title)}\u001f${normalizeKey(author)}`;
    const bucket = type === "author" ? data.authors : data.works;
    if (body?.action === "delete" || aliases.length === 0) delete bucket[key];
    else bucket[key] = { author, ...(type === "work" ? { title } : {}), aliases, updatedAt: new Date().toISOString() };
    await kv.put(SEARCH_ALIASES_KEY, JSON.stringify(data));
    await refreshPublicArchiveIndex(kv, { searchAliases: data });
    return jsonResponse({ ok: true, aliases: data });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "검색 별칭 저장에 실패했습니다." }, error?.status || 500);
  }
}
