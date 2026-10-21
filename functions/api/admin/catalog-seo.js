import { requireAdminSession } from '../../_admin_session.js';
import { requireUserDb } from '../../_user.js';
import { jsonResponse } from '../../_shared.js';
import { ensureWorkCatalogSchema } from '../../_work_catalog.js';
import { ensureCatalogSeo, seoUuid } from '../../_catalog_seo.js';
const error = e => jsonResponse({error:e?.message || '검색 노출 변경 실패'},e?.status || 500,{'cache-control':'no-store'});
export async function onRequestGet(ctx) {
  try {
    await requireAdminSession(ctx);
    const id=new URL(ctx.request.url).searchParams.get('id');
    if(!seoUuid(id))return jsonResponse({error:'작품 ID 오류'},400);
    const db=requireUserDb(ctx.env);await ensureWorkCatalogSchema(db);await ensureCatalogSeo(db);
    const work=await db.prepare(`SELECT w.id,w.title,w.status,COALESCE(v.enabled,0) AS enabled
      FROM catalog_works w LEFT JOIN catalog_search_visibility v ON v.work_id=w.id WHERE w.id=?`).bind(id).first();
    if(!work)return jsonResponse({error:'작품 없음'},404);
    return jsonResponse({id,enabled:work.enabled===1,status:work.status,title:work.title},200,{'cache-control':'no-store'});
  }catch(e){return error(e);}
}
export async function onRequestPost(ctx) {
  try {
    await requireAdminSession(ctx);
    const body=await ctx.request.json();
    if(!seoUuid(body?.id)||typeof body.enabled!=='boolean')return jsonResponse({error:'요청 형식 오류'},400);
    const db=requireUserDb(ctx.env);await ensureWorkCatalogSchema(db);await ensureCatalogSeo(db);
    const work=await db.prepare('SELECT id,status FROM catalog_works WHERE id=?').bind(body.id).first();
    if(!work)return jsonResponse({error:'작품 없음'},404);
    if(body.enabled&&work.status!=='published')return jsonResponse({error:'공개 작품만 외부 검색을 허용할 수 있습니다.'},409);
    const now=Date.now();
    await db.batch([
      db.prepare(`INSERT INTO catalog_search_visibility(work_id,enabled,updated_at) VALUES(?,?,?)
        ON CONFLICT(work_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`).bind(body.id,body.enabled?1:0,now),
      db.prepare('INSERT INTO catalog_audit(work_id,action,details_json,created_at) VALUES(?,?,?,?)').bind(body.id,'admin_seo_visibility',JSON.stringify({enabled:body.enabled}),now)
    ]);
    return jsonResponse({ok:true,id:body.id,enabled:body.enabled},200,{'cache-control':'no-store'});
  }catch(e){return error(e);}
}
