import { catalogPublicSources, catalogCpJsonFromSources, catalogSourceCompletion, CATALOG_CP_CTE, withCatalogCp } from '../../_catalog_cp.js';
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { publicCatalogWork } from '../../_work_catalog.js';
export async function onRequestGet(context) {
  try {
    const db=requireUserDb(context.env);
    const id=String(context.params.id||'');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonResponse({error:'잘못된 작품 ID입니다.'},400);
    const sources=await catalogPublicSources(context.env);
    const work=await db.prepare(`${CATALOG_CP_CTE} SELECT catalog_works.*, (SELECT json_group_array(cp) FROM work_cp WHERE work_id=catalog_works.id) AS main_couples_json FROM catalog_works WHERE id=? AND status='published'`).bind(catalogCpJsonFromSources(sources),id).first();
    if(!work) return jsonResponse({error:'공개된 작품 정보가 없습니다.'},404);
    const result=withCatalogCp(publicCatalogWork(work),work);
    if(result.completion==='unknown') {
      const links=await db.prepare('SELECT source_type,source_id FROM catalog_source_links WHERE work_id=? LIMIT 16').bind(id).all();
      const connected=new Set((links.results||[]).map(link=>`${link.source_type}\u0000${link.source_id}`));
      const known=new Set(sources.filter(item=>connected.has(`${item.source==='postype'?'postype':'drive'}\u0000${item.id}`))
        .map(catalogSourceCompletion).filter(value=>value!=='unknown'));
      if(known.size===1)result.source_completion=[...known][0];
    }
    return jsonResponse({work:result},200,{'cache-control':'no-store'});
  }catch(e){if(/no such table/i.test(e?.message||''))return jsonResponse({error:'공개된 작품 정보가 없습니다.'},404);return jsonResponse({error:e.message||'작품 상세 조회에 실패했습니다.'},e.status||500,{'cache-control':'no-store'});}
}
