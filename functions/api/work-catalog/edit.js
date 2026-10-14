// v10.60 — logged-in readers may update public encyclopedia fields immediately.
// A single field is updated with optimistic concurrency; no proposals are approved here.
import { jsonResponse } from '../../_shared.js';
import { requireUser, userErrorResponse } from '../../_user.js';
import { catalogBody, catalogOperation, catalogError, ensureWorkCatalogSchema, publicCatalogWork } from '../../_work_catalog.js';

const uuid = value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value||''));
const DAY = 86400000;
const LIMIT = 12;
const ALLOWED = new Set(['tag_add','synopsis_set','subcouple_set','subcouple_note_set','recommendation_add','warnings_set']);
const respond = (data,status=200) => jsonResponse(data,status,{'cache-control':'no-store'});

export async function onRequestPost(context) {
  try {
    const origin = context.request.headers.get('origin');
    if (origin && new URL(origin).origin !== new URL(context.request.url).origin)
      throw catalogError('요청 출처가 올바르지 않습니다.',403);
    const auth = await requireUser(context);
    await ensureWorkCatalogSchema(auth.db);
    const body = await catalogBody(context.request);
    const id=String(body.work_id||'');
    const requestId=String(body.request_id||'');
    const operation=String(body.operation||'');
    const revision=Number(body.base_revision);
    if (!uuid(id)||!uuid(requestId)) throw catalogError('작품 또는 요청 식별자가 올바르지 않습니다.');
    if (!ALLOWED.has(operation)) throw catalogError('지원하지 않는 직접 수정 항목입니다.');
    if (!Number.isSafeInteger(revision)||revision<1) throw catalogError('작품 버전이 올바르지 않습니다.');
    if (!body.change || typeof body.change!=='object' || Array.isArray(body.change)) throw catalogError('수정 내용이 올바르지 않습니다.');
    const change={value:body.change.value};
    if(typeof change.value!=='string') throw catalogError('수정 내용은 문자열이어야 합니다.');
    const signature=JSON.stringify({id,operation,revision,change});
    const previous=await auth.db.prepare('SELECT user_id,request_json,work_id FROM catalog_direct_edits WHERE request_id=?')
      .bind(requestId).first();
    if(previous){
      if(previous.user_id!==auth.userId||previous.request_json!==signature) throw catalogError('같은 요청 ID로 다른 수정을 저장할 수 없습니다.',409);
      return respond({ok:true,reused:true,work_id:previous.work_id});
    }
    const work=await auth.db.prepare("SELECT * FROM catalog_works WHERE id=? AND status='published'").bind(id).first();
    if(!work) throw catalogError('공개된 작품만 수정할 수 있습니다.',404);
    if(Number(work.revision||1)!==revision) throw catalogError('다른 이용자가 작품을 수정했어요. 최신 정보를 확인한 후 다시 저장해 주세요.',409);
    const result=catalogOperation(work,operation,change);
    const now=Date.now(),token=crypto.randomUUID(),nextRevision=revision+1;
    const details=JSON.stringify({source:'reader_direct',user_id:auth.userId,operation,column:result.column,before:result.before,after:result.after,request_id:requestId});
    const statements=[
      auth.db.prepare(`UPDATE catalog_works SET ${result.column}=?,revision=revision+1,updated_at=?,last_mutation_token=?
        WHERE id=? AND status='published' AND revision=? AND ${result.column}=?
          AND (SELECT COUNT(*) FROM catalog_direct_edits WHERE user_id=? AND created_at>?)<?
          AND NOT EXISTS (SELECT 1 FROM catalog_direct_edits WHERE request_id=?)`)
        .bind(result.after,now,token,id,revision,work[result.column],auth.userId,now-DAY,LIMIT,requestId),
      auth.db.prepare(`INSERT INTO catalog_direct_edits(request_id,user_id,work_id,operation,request_json,created_at)
        SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM catalog_works WHERE id=? AND revision=? AND last_mutation_token=?)`)
        .bind(requestId,auth.userId,id,operation,signature,now,id,nextRevision,token),
      auth.db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
        SELECT ?,'reader_direct_edit',?,? WHERE EXISTS (SELECT 1 FROM catalog_works WHERE id=? AND revision=? AND last_mutation_token=?)`)
        .bind(id,details,now,id,nextRevision,token),
    ];
    const writes=await auth.db.batch(statements);
    if(writes[0]?.meta?.changes!==1 || writes[1]?.meta?.changes!==1 || writes[2]?.meta?.changes!==1){
      const saved=await auth.db.prepare('SELECT user_id,request_json FROM catalog_direct_edits WHERE request_id=?').bind(requestId).first();
      if(saved?.user_id===auth.userId && saved.request_json===signature) return respond({ok:true,reused:true,work_id:id});
      const count=await auth.db.prepare('SELECT COUNT(*) AS n FROM catalog_direct_edits WHERE user_id=? AND created_at>?').bind(auth.userId,now-DAY).first();
      if(Number(count?.n||0)>=LIMIT) throw catalogError(`정보 수정은 최근 24시간 동안 ${LIMIT}회까지 할 수 있어요.`,429);
      throw catalogError('작품 정보가 변경되었습니다. 최신 정보를 다시 불러와 주세요.',409);
    }
    const latest=await auth.db.prepare("SELECT * FROM catalog_works WHERE id=? AND status='published'").bind(id).first();
    return respond({ok:true,work:publicCatalogWork(latest)});
  }catch(error){return userErrorResponse(error);}
}
