import { requireUserDb } from './_user.js';
import { ensureWorkCatalogSchema } from './_work_catalog.js';
import { ensureCatalogSeo, SEO_ORIGIN } from './_catalog_seo.js';
export async function onRequestGet(ctx){
  try {
    const db=requireUserDb(ctx.env);await ensureWorkCatalogSchema(db);await ensureCatalogSeo(db);
    const rows=await db.prepare(`SELECT w.id FROM catalog_works w JOIN catalog_search_visibility v ON v.work_id=w.id
      WHERE w.status='published' AND v.enabled=1 ORDER BY w.id LIMIT 5000`).all();
    const urls=[SEO_ORIGIN+'/',...(rows.results||[]).map(w=>SEO_ORIGIN+'/catalog/'+w.id)];
    const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>`  <url><loc>${u}</loc></url>`).join('\n')+'\n</urlset>';
    return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}});
  }catch(_){return new Response('일시적으로 사이트맵을 생성할 수 없습니다.',{status:503,headers:{'cache-control':'no-store'}});}
}
