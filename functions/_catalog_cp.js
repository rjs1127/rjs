import { PUBLIC_ARCHIVE_INDEX_KEY, requireKv, getJson } from './_shared.js';

// Reuse public source CP metadata; never infer links from titles or store a second copy.
export async function catalogPublicSources(env) {
  const archive = await getJson(requireKv(env), PUBLIC_ARCHIVE_INDEX_KEY, null);
  return archive?.items || [];
}
export async function catalogCpSources(env) {
  return JSON.stringify((await catalogPublicSources(env)).filter(item => item.combination?.trim()).map(item => ({
    type: item.source || 'drive', id: String(item.id), cp: item.combination.trim()
  })));
}
export const CATALOG_CP_CTE = `WITH cp_sources AS (
  SELECT json_extract(value,'$.type') AS type, json_extract(value,'$.id') AS id,
    json_extract(value,'$.cp') AS cp FROM json_each(?)
), work_cp AS (
  SELECT DISTINCT l.work_id,s.cp FROM catalog_source_links l
    JOIN cp_sources s ON s.type=l.source_type AND s.id=l.source_id
)`;
export function withCatalogCp(work, row) {
  return { ...work, main_couples: JSON.parse(row.main_couples_json || '[]') };
}
