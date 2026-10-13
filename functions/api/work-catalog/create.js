// v10.63: new encyclopedia works MUST be bound to an existing public site source.
import { jsonResponse } from '../../_shared.js';
import { catalogPublicSources } from '../../_catalog_cp.js';
import { requireUser, userErrorResponse } from '../../_user.js';
import { catalogBody, catalogFields, catalogError, ensureWorkCatalogSchema } from '../../_work_catalog.js';

const isUuid = value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value || ''));
const respond = (data,status=200) => jsonResponse(data,status,{'cache-control':'no-store'});
const DAY=86400000, PER_DAY=3, EDIT_LIMIT=12;
const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();
export async function onRequestPost(context) {
  try {
    const requestOrigin=context.request.headers.get('origin');
    if(requestOrigin && new URL(requestOrigin).origin!==new URL(context.request.url).origin)
      throw catalogError('요청 출처가 올바르지 않습니다.',403);
    const auth=await requireUser(context);
    await ensureWorkCatalogSchema(auth.db);
    const body=await catalogBody(context.request);
    const requestId=String(body.request_id||'');
    if(!isUuid(requestId))throw catalogError('등록 요청 식별자가 올바르지 않습니다.');
    const sourceType=String(body.source_type||'');
    const sourceId=String(body.source_id||'');
    if(!['drive','postype'].includes(sourceType)||!sourceId||sourceId.length>240)
      throw catalogError('사이트에 등록된 작품을 검색하여 선택해 주세요.');
    // Never trust client-provided title, author, or arbitrary URLs.
    const sources=await catalogPublicSources(context.env);
    const source=sources.find(item=>String(item.id)===sourceId && (item.source==='postype'?'postype':'drive')===sourceType);
    if(!source || !normalize(source.title) ||
       (sourceType==='drive'&&!/^[A-Za-z0-9_-]{10,200}$/.test(sourceId)) ||
       (sourceType==='postype'&&!(typeof source.url==='string'&&/^https:\/\//i.test(source.url))))
      throw catalogError('현재 사이트에서 제공하지 않는 작품입니다. 다시 검색해 주세요.',404);
    const fields=catalogFields({title:normalize(source.title),author:normalize(source.author)});
    const signature=JSON.stringify({source_type:sourceType,source_id:sourceId});
    const previous=await auth.db.prepare('SELECT user_id,request_json,work_id FROM catalog_direct_edits WHERE request_id=?').bind(requestId).first();
    if(previous) {
      if(previous.user_id!==auth.userId||previous.request_json!==signature)throw catalogError('요청 식별자가 충돌했습니다.',409);
      const work=await auth.db.prepare("SELECT id FROM catalog_works WHERE id=? AND status='published'").bind(previous.work_id).first();
      if(!work)throw catalogError('등록된 작품을 현재 열 수 없습니다.',409);
      return respond({ok:true,reused:true,work_id:work.id});
    }
    const linked=await auth.db.prepare(`SELECT w.id,w.status FROM catalog_source_links l JOIN catalog_works w ON w.id=l.work_id
      WHERE l.source_type=? AND l.source_id=? LIMIT 1`).bind(sourceType,sourceId).first();
    const duplicate=linked||await auth.db.prepare(`SELECT id,status FROM catalog_works
      WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?) LIMIT 1`).bind(fields.title,fields.author).first();
    if(duplicate)return respond({error:'이미 등록된 작품이거나 등록 준비 중인 작품입니다.',
      ...(duplicate.status==='published'?{existing_public_id:duplicate.id}:{})},409);
    const now=Date.now(),workId=crypto.randomUUID(),token=crypto.randomUUID();
    const insert=auth.db.prepare(`INSERT INTO catalog_works
      (id,title,author,original_title,country,completion,genre_json,tags_json,synopsis,
       subcouple,subcouple_note,recommendation,warnings,status,revision,last_mutation_token,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?, 'published',1,?,?,?
      WHERE NOT EXISTS (SELECT 1 FROM catalog_works WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?))
        AND NOT EXISTS (SELECT 1 FROM catalog_source_links WHERE source_type=? AND source_id=?)
        AND NOT EXISTS (SELECT 1 FROM catalog_direct_edits WHERE request_id=?)
        AND (SELECT COUNT(*) FROM catalog_direct_edits WHERE user_id=? AND created_at>? AND operation='work_create')<?
        AND (SELECT COUNT(*) FROM catalog_direct_edits WHERE user_id=? AND created_at>?)<?`)
      .bind(workId,fields.title,fields.author,fields.original_title,fields.country,fields.completion,
        fields.genre_json,fields.tags_json,fields.synopsis,fields.subcouple,fields.subcouple_note,
        fields.recommendation,fields.warnings,token,now,now,fields.title,fields.author,
        sourceType,sourceId,requestId,auth.userId,now-DAY,PER_DAY,auth.userId,now-DAY,EDIT_LIMIT);
    // Conditional on *our* inserted work token; link must be unique by source.
    const link=auth.db.prepare(`INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at)
      SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=?)
      `)
      .bind(sourceType,sourceId,workId,now,workId,token);
    const log=auth.db.prepare(`INSERT INTO catalog_direct_edits(request_id,user_id,work_id,operation,request_json,created_at)
      SELECT ?,?,?,'work_create',?,? WHERE EXISTS (SELECT 1 FROM catalog_source_links WHERE source_type=? AND source_id=? AND work_id=?)`)
      .bind(requestId,auth.userId,workId,signature,now,sourceType,sourceId,workId);
    const audit=auth.db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
      SELECT ?,'reader_direct_create',?,? WHERE EXISTS (SELECT 1 FROM catalog_source_links WHERE source_type=? AND source_id=? AND work_id=?)`)
      .bind(workId,JSON.stringify({user_id:auth.userId,request_id:requestId,source_type:sourceType,source_id:sourceId}),now,sourceType,sourceId,workId);
    const results=await auth.db.batch([insert,link,log,audit]);
    if(results.every(result=>result?.meta?.changes===1))return respond({ok:true,work_id:workId},201);
    // All writes in the batch are conditional; a failed insert leaves no linked orphan.
    const retried=await auth.db.prepare('SELECT user_id,request_json,work_id FROM catalog_direct_edits WHERE request_id=?').bind(requestId).first();
    if(retried) {
      if(retried.user_id!==auth.userId||retried.request_json!==signature)throw catalogError('등록 요청이 충돌했습니다.',409);
      return respond({ok:true,reused:true,work_id:retried.work_id});
    }
    const conflict=await auth.db.prepare(`SELECT w.id,w.status FROM catalog_source_links l JOIN catalog_works w ON w.id=l.work_id
      WHERE l.source_type=? AND l.source_id=? LIMIT 1`).bind(sourceType,sourceId).first() ||
      await auth.db.prepare('SELECT id,status FROM catalog_works WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?) LIMIT 1').bind(fields.title,fields.author).first();
    if(conflict)return respond({error:'이미 등록된 작품이거나 등록 준비 중인 작품입니다.',
      ...(conflict.status==='published'?{existing_public_id:conflict.id}:{})},409);
    const limit=await auth.db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN operation='work_create' THEN 1 ELSE 0 END) AS creates
      FROM catalog_direct_edits WHERE user_id=? AND created_at>?`).bind(auth.userId,now-DAY).first();
    if(Number(limit?.creates||0)>=PER_DAY||Number(limit?.total||0)>=EDIT_LIMIT)
      throw catalogError(`새 작품은 최근 24시간 동안 ${PER_DAY}개까지 등록할 수 있어요.`,429);
    throw catalogError('등록이 완료되지 않았어요. 다시 검색해 주세요.',409);
  }catch(error){return userErrorResponse(error);}
}
