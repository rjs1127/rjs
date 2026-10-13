// Prepared for future user-facing editing UI. Pending submissions are never automatically public.
import { jsonResponse } from '../../_shared.js';
import { requireUser, userErrorResponse } from '../../_user.js';
import { ensureWorkCatalogSchema, catalogBody, catalogFields, catalogError } from '../../_work_catalog.js';
export async function onRequestPost(context){
  try {
    const auth=await requireUser(context);
    await ensureWorkCatalogSchema(auth.db);
    const body=await catalogBody(context.request);
    const kind=body.kind==='edit'?'edit':body.kind==='create'?'create':null;
    if(!kind) throw catalogError('제안 유형을 지정해 주세요.');
    const workId=kind==='edit'?String(body.work_id||''):null;
    let baseUpdatedAt=null;
    if(kind==='edit'){
      if(!/^[0-9a-f-]{36}$/i.test(workId)) throw catalogError('작품 ID가 올바르지 않습니다.');
      const work=await auth.db.prepare("SELECT id,updated_at FROM catalog_works WHERE id=? AND status='published'").bind(workId).first();
      if(!work) throw catalogError('공개된 작품만 수정 제안할 수 있습니다.',404);
      baseUpdatedAt=work.updated_at;
    }
    const fields=catalogFields(body.work||{});
    const now=Date.now();
    // Persistent limit across Workers isolates; avoid unauthenticated/unbounded submission writes.
    const recent=await auth.db.prepare('SELECT COUNT(*) AS total FROM catalog_proposals WHERE user_id=? AND created_at>?').bind(auth.userId,now-86400000).first();
    if(Number(recent?.total||0)>=5) throw catalogError('하루 최대 5건까지 정보 제안이 가능합니다.',429);
    const id=crypto.randomUUID();
    await auth.db.prepare("INSERT INTO catalog_proposals(id,work_id,user_id,kind,payload_json,base_updated_at,status,created_at) VALUES(?,?,?,?,?,?,'pending',?)")
      .bind(id,workId,auth.userId,kind,JSON.stringify(fields),baseUpdatedAt,now).run();
    return jsonResponse({ok:true,id,status:'pending'},201,{'cache-control':'no-store'});
  }catch(e){return userErrorResponse(e);}
}
