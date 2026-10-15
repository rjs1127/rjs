// v10.66 — field-scoped immediate edits and atomic multi-value additions.
// A single field is updated with optimistic concurrency; no proposals are approved here.
import { jsonResponse } from '../../_shared.js';
import { requireUser, userErrorResponse } from '../../_user.js';
import { catalogBody, catalogOperation, catalogError, ensureWorkCatalogSchema, catalogFields, publicCatalogWork } from '../../_work_catalog.js';

const uuid = value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value||''));
const ALLOWED = new Set(['tag_add','genre_add','synopsis_set','completion_set','subcouple_update','subcouple_set','subcouple_note_set','recommendation_add','recommendation_edit','recommendation_remove','tag_edit','tag_remove','genre_edit','genre_remove','warnings_set']);
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
    const isBatch=Object.hasOwn(body.change,'values');
    if(isBatch && Object.hasOwn(body.change,'value')) throw catalogError('단일 입력과 여러 입력을 동시에 보낼 수 없습니다.');
    if(isBatch && !['tag_add','genre_add','recommendation_add'].includes(operation)) throw catalogError('여러 항목 추가를 지원하지 않는 정보입니다.');
    const needsOld=['tag_edit','genre_edit','recommendation_edit','recommendation_remove'].includes(operation);
    const change=isBatch ? {values:body.change.values} : {value:body.change.value,
      ...(needsOld?{old:body.change.old}:{}),...(operation==='subcouple_update'?{note:body.change.note}:{})};
    if(isBatch){
      if(!Array.isArray(change.values)||!change.values.length||change.values.length>5||change.values.some(v=>typeof v!=='string'))
        throw catalogError('한 번에 1~5개의 항목을 입력해 주세요.');
    } else if(typeof change.value!=='string') throw catalogError('수정 내용은 문자열이어야 합니다.');
    if(operation==='subcouple_update' && typeof change.note!=='string')throw catalogError('서브커플 설명 형식이 올바르지 않습니다.');
    if(needsOld && (typeof change.old!=='string' || !change.old.trim()))
      throw catalogError('수정할 기존 정보가 올바르지 않습니다.');
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
    // Run every addition through the existing field validator, but commit only
    // one final column update (one revision, one request-id log, one audit).
    let result;
    if(operation==='subcouple_update'){
      const normalized=catalogFields({...publicCatalogWork(work),
        subcouple:change.value,subcouple_note:change.note});
      if(normalized.subcouple===work.subcouple && normalized.subcouple_note===work.subcouple_note)
        throw catalogError('기존 정보와 변경 내용이 같습니다.',409);
      result={column:'subcouple',before:work.subcouple,after:normalized.subcouple,
        extraColumn:'subcouple_note',extraBefore:work.subcouple_note,extraAfter:normalized.subcouple_note};
    }else if(isBatch){
      let draft={...work};
      for(const value of change.values){
        const step=catalogOperation(draft,operation,{value});
        if(result && step.column!==result.column) throw catalogError('서로 다른 정보는 함께 수정할 수 없습니다.');
        result={column:step.column,before:result?.before??step.before,after:step.after};
        draft={...draft,[step.column]:step.after};
      }
    } else result=catalogOperation(work,operation,change);
    const now=Date.now(),token=crypto.randomUUID(),nextRevision=revision+1;
    const details=JSON.stringify({source:'reader_direct',user_id:auth.userId,operation,column:result.column,before:result.before,after:result.after,request_id:requestId,...(isBatch?{added_count:change.values.length}:{}),...(result.extraColumn?{extra_column:result.extraColumn,extra_before:result.extraBefore,extra_after:result.extraAfter}:{})});
    const statements=[
      auth.db.prepare(`UPDATE catalog_works SET ${result.column}=?${result.extraColumn?', '+result.extraColumn+'=?':''},revision=revision+1,updated_at=?,last_mutation_token=?
        WHERE id=? AND status='published' AND revision=? AND ${result.column}=?${result.extraColumn?' AND '+result.extraColumn+'=?':''}
          AND NOT EXISTS (SELECT 1 FROM catalog_direct_edits WHERE request_id=?)`)
        .bind(...(result.extraColumn?[result.after,result.extraAfter]:[result.after]),now,token,id,revision,work[result.column],
          ...(result.extraColumn?[result.extraBefore]:[]),requestId),
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
      throw catalogError('작품 정보가 변경되었습니다. 최신 정보를 다시 불러와 주세요.',409);
    }
    const latest=await auth.db.prepare("SELECT w.*,COALESCE((SELECT a.status FROM catalog_adult_scene_status a WHERE a.work_id=w.id),'미확인') AS adult_scene_status FROM catalog_works w WHERE w.id=? AND w.status='published'").bind(id).first();
    return respond({ok:true,work:publicCatalogWork(latest)});
  }catch(error){return userErrorResponse(error);}
}
