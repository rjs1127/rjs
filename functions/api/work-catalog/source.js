// Safe public mapping: only published encyclopedia metadata, never private file data.
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { publicCatalogWork } from '../../_work_catalog.js';
export async function onRequestGet(context){
  try {
    const url=new URL(context.request.url);
    const type=String(url.searchParams.get('type')||'');
    const id=String(url.searchParams.get('id')||'').trim();
    if(!['drive','postype'].includes(type)||!id||id.length>240)return jsonResponse({error:'원본 콘텐츠 ID가 올바르지 않습니다.'},400);
    const db=requireUserDb(context.env);
    const work=await db.prepare(`SELECT w.* FROM catalog_source_links l
      JOIN catalog_works w ON w.id=l.work_id
      WHERE l.source_type=? AND l.source_id=? AND w.status='published' LIMIT 1`).bind(type,id).first();
    if(!work)return jsonResponse({error:'연결된 공개 작품 정보가 없습니다.'},404,{'cache-control':'public,max-age=30'});
    return jsonResponse({work:publicCatalogWork(work)},200,{'cache-control':'public,max-age=30'});
  } catch(error){
    if(/no such table/i.test(error?.message||''))return jsonResponse({error:'연결된 공개 작품 정보가 없습니다.'},404);
    return jsonResponse({error:error?.message||'도감 연결 조회 실패'},error?.status||500,{'cache-control':'no-store'});
  }
}
