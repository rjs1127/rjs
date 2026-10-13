// v10.63: Link public encyclopedia entries to still-published site source IDs.
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { catalogPublicSources } from '../../_catalog_cp.js';
const validId = id => /^[a-f0-9-]{36}$/i.test(String(id||''));
export async function onRequestGet(context) {
  try {
    const id=new URL(context.request.url).searchParams.get('id');
    if(!validId(id))return jsonResponse({error:'작품 ID가 올바르지 않습니다.'},400);
    const db=requireUserDb(context.env);
    const row=await db.prepare("SELECT id FROM catalog_works WHERE id=? AND status='published'").bind(id).first();
    if(!row)return jsonResponse({error:'공개된 작품이 없습니다.'},404,{'cache-control':'no-store'});
    const links=await db.prepare('SELECT source_type,source_id FROM catalog_source_links WHERE work_id=? ORDER BY source_type,created_at').bind(id).all();
    const valid=new Map((await catalogPublicSources(context.env)).map(item=>[
      `${item.source==='postype'?'postype':'drive'}\u0000${item.id}`,item
    ]));
    const items=[];
    for(const link of links.results||[]) {
      const source=valid.get(`${link.source_type}\u0000${link.source_id}`);
      if(!source)continue;
      if(link.source_type==='postype' && !(typeof source.url==='string' && /^https:\/\//i.test(source.url)))continue;
      items.push({source_type:link.source_type,source_id:link.source_id,label:link.source_type==='postype'?'POSTYPE':'TXT'});
    }
    return jsonResponse({items:items.slice(0,12)},200,{'cache-control':'no-store'});
  } catch(error) {
    if(/no such table/i.test(String(error?.message||'')))return jsonResponse({items:[]},200,{'cache-control':'no-store'});
    return jsonResponse({error:'연결된 작품을 조회하지 못했어요.'},500,{'cache-control':'no-store'});
  }
}
