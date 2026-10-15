import { catalogPublicSources, catalogSourceMetadata, catalogLinkedMetadata, catalogLinkedKeys } from '../../_catalog_cp.js';
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { publicCatalogWork, ensureWorkCatalogSchema } from '../../_work_catalog.js';
export async function onRequestGet(context) {
  try {
    const db=requireUserDb(context.env); await ensureWorkCatalogSchema(db);
    const id=String(context.params.id||'');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonResponse({error:'잘못된 작품 ID입니다.'},400);
    const sources=await catalogPublicSources(context.env);
    // Resolve CP and source-completion from this work's actual linked IDs.
    // No whole-archive CP JSON bind and no second completion SELECT.
    const work=await db.prepare(`SELECT catalog_works.*,
      COALESCE((SELECT a.status FROM catalog_adult_scene_status a WHERE a.work_id=catalog_works.id),'미확인') AS adult_scene_status,
      (SELECT json_group_array(json_object('type',source_type,'id',source_id))
        FROM catalog_source_links WHERE work_id=catalog_works.id) AS source_links_json
      FROM catalog_works WHERE id=? AND status='published'`).bind(id).first();
    if(!work) return jsonResponse({error:'공개된 작품 정보가 없습니다.'},404);
    const result=catalogLinkedMetadata(publicCatalogWork(work),work.source_links_json,catalogSourceMetadata(sources,catalogLinkedKeys([work])));
    return jsonResponse({work:result},200,{'cache-control':'no-store'});
  }catch(e){if(/no such table/i.test(e?.message||''))return jsonResponse({error:'공개된 작품 정보가 없습니다.'},404);return jsonResponse({error:e.message||'작품 상세 조회에 실패했습니다.'},e.status||500,{'cache-control':'no-store'});}
}
