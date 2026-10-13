// v10.54: v1 submission compatibility + v2 single-field suggestions.
import { jsonResponse } from '../../_shared.js';
import { requireUser, userErrorResponse } from '../../_user.js';
import { ensureWorkCatalogSchema, catalogBody, catalogFields, catalogError, catalogOperation, catalogFingerprint } from '../../_work_catalog.js';
const uuid = value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value||''));
const respond = (data,status=200) => jsonResponse(data,status,{'cache-control':'no-store'});
export async function onRequestGet(context) {
  try {
    const auth=await requireUser(context); await ensureWorkCatalogSchema(auth.db);
    const url=new URL(context.request.url);
    const before=Number(url.searchParams.get('before')||0);
    if (before && (!Number.isSafeInteger(before)||before<=0)) throw catalogError('조회 기준이 올바르지 않습니다.');
    const sql=`SELECT id,work_id,kind,payload_json,base_updated_at,status,admin_note,created_at,reviewed_at
      FROM catalog_proposals WHERE user_id=? ${before?'AND created_at<?':''}
      ORDER BY created_at DESC,id DESC LIMIT 21`;
    const list=await auth.db.prepare(sql).bind(auth.userId,...(before?[before]:[])).all();
    const rows=list.results||[];
    return respond({items:rows.slice(0,20).map(r=>({
      ...r,payload:JSON.parse(r.payload_json),payload_json:undefined
    })),hasMore:rows.length>20,nextBefore:rows.length>20?rows[19].created_at:null});
  }catch(e){return userErrorResponse(e);}
}
export async function onRequestPost(context){
  try {
    const auth=await requireUser(context);
    await ensureWorkCatalogSchema(auth.db);
    const body=await catalogBody(context.request);
    const kind=body.kind==='edit'?'edit':body.kind==='create'?'create':null;
    if(!kind) throw catalogError('제안 유형을 지정해 주세요.');
    const workId=kind==='edit'?String(body.work_id||''):null;
    let baseUpdatedAt=null, payload,requestId=null,fingerprint=null;
    const isV2=body.format===2;
    if (body.format!==undefined && !isV2) throw catalogError('지원하지 않는 제안 형식입니다.');
    let work=null;
    if(isV2){
      if(kind!=='edit') throw catalogError('신규 작품 제안은 기존 형식을 이용해 주세요.');
      requestId=String(body.request_id||'');
      if(!uuid(requestId)) throw catalogError('중복 제출 방지 식별자가 올바르지 않습니다.');
      fingerprint=await catalogFingerprint({
        work_id:workId,operation:String(body.operation||''),
        change:{...body.change,value:String(body.change?.value??'').normalize('NFKC').trim()}
      });
      const previous=await auth.db.prepare('SELECT id,fingerprint,status FROM catalog_proposals WHERE user_id=? AND request_id=?').bind(auth.userId,requestId).first();
      if(previous){
        if(previous.fingerprint!==fingerprint) throw catalogError('같은 요청 ID로 다른 내용을 제출할 수 없습니다.',409);
        return respond({ok:true,id:previous.id,status:previous.status,reused:true});
      }
    }
    if(kind==='edit'){
      if(!uuid(workId)) throw catalogError('작품 ID가 올바르지 않습니다.');
      work=await auth.db.prepare("SELECT * FROM catalog_works WHERE id=? AND status='published'").bind(workId).first();
      if(!work) throw catalogError('공개된 작품만 수정 제안할 수 있습니다.',404);
      baseUpdatedAt=work.updated_at;
    }
    if(isV2){
      if(kind!=='edit') throw catalogError('신규 작품 제안은 기존 형식을 이용해 주세요.');
      const revision=Number(body.base_revision);
      if (!Number.isSafeInteger(revision)||revision<1) throw catalogError('기준 작품 버전이 올바르지 않습니다.');
      if (revision!==Number(work.revision||1)) throw catalogError('작품 정보가 변경되었습니다. 다시 확인해 주세요.',409);
      const operation=String(body.operation||'');
      const change=body.change;
      const op=catalogOperation(work,operation,change);
      const reason=String(body.reason||'').trim(),spoiler=body.spoiler===true;
      if(reason.length>500) throw catalogError('수정 이유는 500자 이내로 입력해 주세요.');
      payload={format:2,operation,base_revision:revision,before:op.before,change,
        reason,spoiler,column:op.column};
    }else{
      const fields=catalogFields(body.work||{});
      payload=fields; // Legacy whole-work proposals remain explicitly v1.
    }
    const now=Date.now(),id=crypto.randomUUID();
    // One atomic INSERT statement enforces the daily limit; separate SELECT + INSERT races are avoided.
    try{
      const result=await auth.db.prepare(`INSERT INTO catalog_proposals(
        id,work_id,user_id,kind,payload_json,base_updated_at,status,created_at,request_id,fingerprint)
        SELECT ?,?,?,?,?,?,'pending',?,?,?
        WHERE (SELECT COUNT(*) FROM catalog_proposals WHERE user_id=? AND created_at>?)<5`)
        .bind(id,workId,auth.userId,kind,JSON.stringify(payload),baseUpdatedAt,now,requestId,fingerprint,auth.userId,now-86400000).run();
      if(!result.meta?.changes) throw catalogError('하루 최대 5건까지 정보 제안이 가능합니다.',429);
    }catch(error){
      if(!isV2 || !/UNIQUE constraint/i.test(String(error?.message||''))) throw error;
      const existing=await auth.db.prepare('SELECT id,request_id,fingerprint,status FROM catalog_proposals WHERE user_id=? AND (request_id=? OR (fingerprint=? AND status=\'pending\')) LIMIT 1')
        .bind(auth.userId,requestId,fingerprint).first();
      if(existing){
        if(existing.request_id===requestId && existing.fingerprint!==fingerprint) throw catalogError('같은 요청 ID로 다른 내용을 제출할 수 없습니다.',409);
        return respond({ok:true,id:existing.id,status:existing.status,reused:true});
      }
      throw error;
    }
    return respond({ok:true,id,status:'pending'},201);
  }catch(e){return userErrorResponse(e);}
}
