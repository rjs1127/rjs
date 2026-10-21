// External indexing is opt-in. Missing rows are always N (no bulk migration).
export async function ensureCatalogSeo(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_search_visibility (
    work_id TEXT PRIMARY KEY REFERENCES catalog_works(id),
    enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
    updated_at INTEGER NOT NULL
  )`).run();
}
export const SEO_ORIGIN = 'https://rjs-cj6.pages.dev';
export const seoUuid = id => /^[0-9a-f-]{36}$/i.test(String(id || ''));
export const escapeSeo = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
