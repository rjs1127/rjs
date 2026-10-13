// v10.62: authenticated reader registration of public, unlinked catalog works.
// Only catalog tables are touched; private TXT/POSTYPE records are never copied.
import { jsonResponse } from '../../_shared.js';
import { requireUser, userErrorResponse } from '../../_user.js';
import { catalogBody, catalogFields, catalogError, ensureWorkCatalogSchema } from '../../_work_catalog.js';

const isUuid = value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value || ''));
const respond = (data, status=200) => jsonResponse(data,status,{'cache-control':'no-store'});
const DAY = 86400000;
const PER_DAY = 3;
const EDIT_LIMIT = 12;
const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();

export async function onRequestPost(context) {
  try {
    const requestOrigin = context.request.headers.get('origin');
    if (requestOrigin && new URL(requestOrigin).origin !== new URL(context.request.url).origin)
      throw catalogError('요청 출처가 올바르지 않습니다.',403);
    const auth = await requireUser(context);
    await ensureWorkCatalogSchema(auth.db);
    const body = await catalogBody(context.request);
    const requestId = String(body.request_id || '');
    if (!isUuid(requestId)) throw catalogError('등록 요청 식별자가 올바르지 않습니다.');
    // Only metadata explicitly entered in the registration form is accepted.
    const title = normalize(body.title);
    const author = normalize(body.author);
    const originalTitle = normalize(body.original_title);
    const fields = catalogFields({title,author,original_title:originalTitle});
    const signature = JSON.stringify({title:fields.title,author:fields.author,original_title:fields.original_title});
    const previous = await auth.db.prepare(`SELECT user_id,request_json,work_id FROM catalog_direct_edits
      WHERE request_id=?`).bind(requestId).first();
    if (previous) {
      if (previous.user_id!==auth.userId || previous.request_json!==signature)
        throw catalogError('같은 요청 ID로 다른 작품을 등록할 수 없습니다.',409);
      const existing=await auth.db.prepare("SELECT id FROM catalog_works WHERE id=? AND status='published'")
        .bind(previous.work_id).first();
      if (!existing) throw catalogError('등록한 작품을 현재 열 수 없습니다.',409);
      return respond({ok:true,reused:true,work_id:existing.id});
    }
    // Duplicate checks include private drafts and archived works. Do not expose their details.
    const duplicate=await auth.db.prepare(`SELECT id,status FROM catalog_works
      WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?) LIMIT 1`)
      .bind(fields.title,fields.author).first();
    if (duplicate) return respond({error:'이미 등록된 작품이거나 등록 준비 중인 작품입니다. 작품명과 작가를 확인해 주세요.',
      ...(duplicate.status==='published'?{existing_public_id:duplicate.id}:{})},409);
    const now=Date.now();
    const workId=crypto.randomUUID();
    const token=crypto.randomUUID();
    // Atomic conditional insert serializes duplicate/title checks and both hourly limits.
    const insert=auth.db.prepare(`INSERT INTO catalog_works
      (id,title,author,original_title,country,completion,genre_json,tags_json,synopsis,
       subcouple,subcouple_note,recommendation,warnings,status,revision,last_mutation_token,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?, 'published',1,?,?,?
      WHERE NOT EXISTS (SELECT 1 FROM catalog_works WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?))
        AND NOT EXISTS (SELECT 1 FROM catalog_direct_edits WHERE request_id=?)
        AND (SELECT COUNT(*) FROM catalog_direct_edits WHERE user_id=? AND created_at>? AND operation='work_create')<?
        AND (SELECT COUNT(*) FROM catalog_direct_edits WHERE user_id=? AND created_at>?)<?`)
      .bind(workId,fields.title,fields.author,fields.original_title,fields.country,fields.completion,
        fields.genre_json,fields.tags_json,fields.synopsis,fields.subcouple,fields.subcouple_note,
        fields.recommendation,fields.warnings,token,now,now,fields.title,fields.author,
        requestId,auth.userId,now-DAY,PER_DAY,auth.userId,now-DAY,EDIT_LIMIT);
    const log=auth.db.prepare(`INSERT INTO catalog_direct_edits(request_id,user_id,work_id,operation,request_json,created_at)
      SELECT ?,?,?,'work_create',?,? WHERE EXISTS (
        SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=? AND status='published')`)
      .bind(requestId,auth.userId,workId,signature,now,workId,token);
    const audit=auth.db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
      SELECT ?,'reader_direct_create',?,? WHERE EXISTS (
        SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=? AND status='published')`)
      .bind(workId,JSON.stringify({user_id:auth.userId,request_id:requestId,title:fields.title,author:fields.author}),
        now,workId,token);
    const results=await auth.db.batch([insert,log,audit]);
    if(results.every(result=>result?.meta?.changes===1)) return respond({ok:true,work_id:workId},201);
    // A failed conditional insert cannot publish anything or generate an orphaned audit record.
    const retried=await auth.db.prepare('SELECT user_id,request_json,work_id FROM catalog_direct_edits WHERE request_id=?')
      .bind(requestId).first();
    if(retried) {
      if(retried.user_id!==auth.userId||retried.request_json!==signature) throw catalogError('등록 요청이 충돌했습니다.',409);
      return respond({ok:true,reused:true,work_id:retried.work_id});
    }
    const conflicts=await auth.db.prepare(`SELECT id,status FROM catalog_works WHERE lower(trim(title))=lower(?)
      AND lower(trim(author))=lower(?) LIMIT 1`).bind(fields.title,fields.author).first();
    if(conflicts) return respond({error:'이미 등록된 작품이거나 등록 준비 중인 작품입니다. 작품명과 작가를 확인해 주세요.',
      ...(conflicts.status==='published'?{existing_public_id:conflicts.id}:{})},409);
    const limit=await auth.db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN operation='work_create' THEN 1 ELSE 0 END) AS creates
      FROM catalog_direct_edits WHERE user_id=? AND created_at>?`).bind(auth.userId,now-DAY).first();
    if(Number(limit?.creates||0)>=PER_DAY || Number(limit?.total||0)>=EDIT_LIMIT)
      throw catalogError(`새 작품은 최근 24시간 동안 ${PER_DAY}개까지 등록할 수 있어요.`,429);
    throw catalogError('등록 정보가 변경되었어요. 다시 확인해 주세요.',409);
  } catch(error) {return userErrorResponse(error);}
}
