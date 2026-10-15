import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { requireAdminSession } from '../../_admin_session.js';
import { ensureWorkCatalogSchema, catalogFields, catalogError, allCatalogWork, fieldsParams, WORK_FIELDS, catalogOperation } from '../../_work_catalog.js';

const uuid = v => /^[a-f0-9-]{36}$/i.test(String(v||''));
const audit = (db,workId,action,data,now) => db.prepare('INSERT INTO catalog_audit(work_id,action,details_json,created_at) VALUES(?,?,?,?)').bind(workId,action,JSON.stringify(data||{}),now);
function cleanStatus(value){ if (!['draft','published','archived'].includes(value)) throw catalogError('공개 상태가 올바르지 않습니다.'); return value; }
function expectedRevision(value) {
  if (value==null) return null; // Existing v10.53 clients retain backward-compatible saves.
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<1) throw catalogError('작품 수정 기준 버전이 올바르지 않습니다.');
  return number;
}
function revisionGuard(actual,expected) {
  if(expected!==null && Number(actual?.revision||1)!==expected)
    throw catalogError('다른 관리자가 작품 정보를 변경했습니다. 새로 열어 확인해 주세요.',409);
}
// Only field-level audit records with an actual previous value are restorable.
// Historical administrator bulk saves did not keep previous field values.
const RESTORABLE_COLUMNS = new Set([
  'title','author','original_title','country','completion','genre_json','tags_json',
  'synopsis','subcouple','subcouple_note','recommendation','warnings'
]);
function restorationRecord(record){
  if(!record || !['reader_direct_edit','admin_restore'].includes(record.action))return null;
  let details;
  try{details=JSON.parse(record.details_json);}catch{return null;}
  if(!details || typeof details!=='object' || !RESTORABLE_COLUMNS.has(details.column) ||
     typeof details.after!=='string')return null;
  const arrayColumn=details.column==='genre_json'||details.column==='tags_json';
  const before=arrayColumn && Array.isArray(details.before) ? JSON.stringify(details.before) : details.before;
  if(typeof before!=='string')return null;
  if(details.extra_column!==undefined &&
     (details.column!=='subcouple' || details.extra_column!=='subcouple_note' ||
      typeof details.extra_before!=='string' || typeof details.extra_after!=='string'))return null;
  return {id:Number(record.id),action:record.action,created_at:record.created_at,
    column:details.column,before,after:details.after,
    ...(details.extra_column?{extra_column:details.extra_column,extra_before:details.extra_before,extra_after:details.extra_after}:{})};
}
function validateRestoredFields(row,entry){
  const next=allCatalogWork(row);
  const apply=(column,value)=>{
    if(column==='genre_json'||column==='tags_json'){
      let arr;try{arr=JSON.parse(value);}catch{throw catalogError('과거 태그 정보가 손상되어 복원할 수 없습니다.',409);}
      next[column==='genre_json'?'genres':'tags']=arr;
    }else next[column]=value;
  };
  apply(entry.column,entry.before);
  if(entry.extra_column)apply(entry.extra_column,entry.extra_before);
  const checked=catalogFields(next);
  if(checked[entry.column]!==entry.before || (entry.extra_column&&checked[entry.extra_column]!==entry.extra_before))
    throw catalogError('이전 값이 현재 입력 규칙과 일치하지 않아 복원할 수 없습니다.',409);
  return checked;
}

const err = e => jsonResponse({error:e?.message||'도감 관리 요청에 실패했습니다.'},e?.status||500,{'cache-control':'no-store'});

export async function onRequestGet(context){
  try {
    await requireAdminSession(context);
    const db=requireUserDb(context.env); await ensureWorkCatalogSchema(db);
    const url=new URL(context.request.url);
    const historyId=url.searchParams.get('history_id');
    if(historyId!==null){
      if(!uuid(historyId))throw catalogError('이력을 조회할 작품 ID가 올바르지 않습니다.');
      const work=await db.prepare('SELECT id,revision,title FROM catalog_works WHERE id=?').bind(historyId).first();
      if(!work)throw catalogError('해당 도감 작품이 없습니다.',404);
      const auditRows=await db.prepare(`SELECT id,action,details_json,created_at FROM catalog_audit
        WHERE work_id=? AND action IN ('reader_direct_edit','admin_restore') ORDER BY id DESC LIMIT 30`)
        .bind(historyId).all();
      return jsonResponse({revision:Number(work.revision||1),title:work.title,
        entries:(auditRows.results||[]).map(restorationRecord).filter(Boolean)},200,{'cache-control':'no-store'});
    }
    const sourceType=url.searchParams.get('source_type');
    const sourceId=url.searchParams.get('source_id');
    if(sourceType!==null || sourceId!==null){
      if(!['drive','postype'].includes(sourceType)||!sourceId||sourceId.length>240) throw catalogError('원본 ID가 올바르지 않습니다.');
      const row=await db.prepare(`SELECT w.* FROM catalog_works w JOIN catalog_source_links l ON l.work_id=w.id WHERE l.source_type=? AND l.source_id=?`).bind(sourceType,sourceId).first();
      const related=row?await db.prepare('SELECT source_type,source_id FROM catalog_source_links WHERE work_id=?').bind(row.id).all():{results:[]};
      return jsonResponse({work:row?allCatalogWork(row):null,linked_sources:related.results||[]},200,{'cache-control':'no-store'});
    }

    const q=String(url.searchParams.get('q')||'').trim().slice(0,80);
    const status=String(url.searchParams.get('status')||'all');
    if(!['all','draft','published','archived'].includes(status)) throw catalogError('필터 값이 올바르지 않습니다.');
    const like=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
    const conditions=[...(status==='all'?[]:['status=?']),...(q?['(title LIKE ? ESCAPE \'\\\' OR author LIKE ? ESCAPE \'\\\')']:[])];
    const sql=`SELECT catalog_works.*,
      EXISTS (SELECT 1 FROM catalog_source_links l WHERE l.work_id=catalog_works.id) AS has_source_links
      FROM catalog_works ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY updated_at DESC,id DESC LIMIT 100`;
    const params=[...(status==='all'?[]:[status]),...(q?[like,like]:[])];
    const [works,proposals,counts,links]=await Promise.all([
      db.prepare(sql).bind(...params).all(),
      db.prepare("SELECT id,work_id,user_id,kind,payload_json,status,created_at,admin_note,base_updated_at FROM catalog_proposals WHERE status='pending' ORDER BY created_at ASC LIMIT 100").all(),
      db.prepare("SELECT status,COUNT(*) AS total FROM catalog_works GROUP BY status").all(),
      // New admin UI looks up only source IDs present in its current archive.
      // Preserve the old response for older deployed admin assets.
      url.searchParams.get('source_lookups')==='1'?Promise.resolve({results:[]}):
        db.prepare("SELECT source_type,source_id,work_id FROM catalog_source_links ORDER BY created_at DESC LIMIT 10000").all(),
    ]);
    return jsonResponse({works:(works.results||[]).map(row=>({...allCatalogWork(row),has_source_links:Boolean(row.has_source_links)})),proposals:(proposals.results||[]).map(p=>({...p,payload:JSON.parse(p.payload_json),payload_json:undefined})),counts:counts.results||[],links:links.results||[],limited:(works.results||[]).length===100},200,{'cache-control':'no-store'});
  }catch(e){return err(e);}
}

export async function onRequestPost(context){
  try {
    await requireAdminSession(context);
    const db=requireUserDb(context.env); await ensureWorkCatalogSchema(db);
    // Only the bounded administrator source-lookup read accepts larger JSON.
    // Preserve the existing 18k body limit for every mutation operation.
    const text=await context.request.text();
    if(text.length>240000)throw catalogError('요청 본문 크기 제한을 초과했습니다.',413);
    let body;
    try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}
    catch{throw catalogError('JSON 본문 형식이 올바르지 않습니다.');}
    const action=String(body.action||'');
    if(action!=='lookup_sources'&&text.length>18000)throw catalogError('요청 본문 크기 제한을 초과했습니다.',413);
    const now=Date.now();
    if(action==='lookup_sources'){
      // Bounded, read-only source link lookups; avoids scanning 10,000 links
      // just to label the TXT/POSTYPE entries visible in the archive.
      const values=body.sources;
      if(!Array.isArray(values)||values.length<1||values.length>800)
        throw catalogError('조회할 원본 목록이 올바르지 않습니다.');
      const seen=new Set(),pairs=[];
      for(const item of values){
        const type=item?.source_type,id=item?.source_id;
        if(!['drive','postype'].includes(type)||typeof id!=='string'||!id.trim()||id.length>240)
          throw catalogError('원본 유형 또는 ID가 올바르지 않습니다.');
        const key=`${type}\u0000${id}`;
        if(!seen.has(key)){seen.add(key);pairs.push([type,id]);}
      }
      const rows=await db.prepare(`SELECT l.source_type,l.source_id,l.work_id,w.status AS work_status
        FROM json_each(?) requested
        JOIN catalog_source_links l ON l.source_type=json_extract(requested.value,'$[0]')
          AND l.source_id=json_extract(requested.value,'$[1]')
        LEFT JOIN catalog_works w ON w.id=l.work_id`).bind(JSON.stringify(pairs)).all();
      return jsonResponse({links:rows.results||[]},200,{'cache-control':'no-store'});
    }
    if(action==='restore_field'){
      const id=String(body.id||'');
      const eventId=Number(body.audit_id);
      const expected=expectedRevision(body.expected_revision);
      if(!uuid(id)||!Number.isSafeInteger(eventId)||eventId<1||expected===null)
        throw catalogError('복원할 작품·이력·현재 버전을 선택해 주세요.');
      const current=await db.prepare('SELECT * FROM catalog_works WHERE id=?').bind(id).first();
      if(!current)throw catalogError('복원 대상 작품이 없습니다.',404);
      revisionGuard(current,expected);
      const event=await db.prepare(`SELECT id,action,details_json,created_at FROM catalog_audit
        WHERE id=? AND work_id=?`).bind(eventId,id).first();
      const record=restorationRecord(event);
      if(!record)throw catalogError('변경 전 값이 없어 복원할 수 없는 이력입니다.',409);
      validateRestoredFields(current,record);
      const currentBefore=current[record.column];
      const previousValue=record.before;
      const extraBefore=record.extra_column?current[record.extra_column]:undefined;
      if(currentBefore===previousValue && (!record.extra_column || extraBefore===record.extra_before))
        throw catalogError('현재 정보가 이미 복원할 값과 같습니다.',409);
      const token=crypto.randomUUID();
      const details={column:record.column,before:currentBefore,after:previousValue,from_audit_id:eventId,
        ...(record.extra_column?{extra_column:record.extra_column,extra_before:extraBefore,extra_after:record.extra_before}:{})};
      const updates=`${record.column}=?${record.extra_column?', '+record.extra_column+'=?':''}`;
      const results=await db.batch([
        db.prepare(`UPDATE catalog_works SET ${updates},revision=revision+1,updated_at=?,last_mutation_token=?
          WHERE id=? AND revision=?`)
          .bind(previousValue,...(record.extra_column?[record.extra_before]:[]),now,token,id,expected),
        db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
          SELECT ?,'admin_restore',?,? FROM catalog_works WHERE id=? AND last_mutation_token=? AND revision=?`)
          .bind(id,JSON.stringify(details),now,id,token,expected+1),
      ]);
      if(results.some(r=>r?.meta?.changes!==1))throw catalogError('작품이 변경되어 복원을 완료하지 못했습니다. 다시 조회해 주세요.',409);
      const updated=await db.prepare('SELECT * FROM catalog_works WHERE id=?').bind(id).first();
      return jsonResponse({ok:true,id,work:allCatalogWork(updated)},200,{'cache-control':'no-store'});
    }
    if(action==='upsert_source'){
      const sourceType=String(body.source_type||'');
      const sourceId=String(body.source_id||'').trim();
      if(!['drive','postype'].includes(sourceType)||!sourceId||sourceId.length>240) throw catalogError('원본 유형/ID가 올바르지 않습니다.');
      const fields=catalogFields(body.work||{});
      const status=cleanStatus(body.status||'draft');
      const link=await db.prepare('SELECT work_id FROM catalog_source_links WHERE source_type=? AND source_id=?').bind(sourceType,sourceId).first();
      const id=link?.work_id||crypto.randomUUID();
      if(link){
        const existing=await db.prepare('SELECT revision FROM catalog_works WHERE id=?').bind(id).first();
        if(!existing) throw catalogError('연결된 도감 작품이 없습니다.',409);
        revisionGuard(existing,expectedRevision(body.expected_revision));
        const token=crypto.randomUUID();
        const result=await db.batch([
          db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},
            status=?,revision=revision+1,last_mutation_token=?,updated_at=? WHERE id=? AND revision=?`)
            .bind(...fieldsParams(fields),status,token,now,id,Number(existing.revision||1)),
          db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
            SELECT ?,?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?`)
            .bind(id,'update_source',JSON.stringify({source_type:sourceType,source_id:sourceId,status}),now,id,token),
        ]);
        if(result[0]?.meta?.changes!==1 || result[1]?.meta?.changes!==1)
          throw catalogError('다른 관리자가 먼저 수정했습니다. 작품을 다시 열어 확인해 주세요.',409);
      }else{
        await db.batch([
          db.prepare(`INSERT INTO catalog_works(id,${WORK_FIELDS},status,created_at,updated_at) VALUES(?,${Array(12).fill('?').join(',')},?,?,?)`).bind(id,...fieldsParams(fields),status,now,now),
          db.prepare('INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at) VALUES(?,?,?,?)').bind(sourceType,sourceId,id,now),
          audit(db,id,'create_source',{source_type:sourceType,source_id:sourceId,status},now),
        ]);
      }
      return jsonResponse({ok:true,id,created:!link},link?200:201);
    }
    if(action==='save_work'){
      const id=String(body.id||''); if(!uuid(id)) throw catalogError('도감 작품 ID가 올바르지 않습니다.');
      const fields=catalogFields(body.work||{});
      const status=cleanStatus(body.status||'draft');
      const exists=await db.prepare('SELECT id,revision FROM catalog_works WHERE id=?').bind(id).first();
      if(!exists) throw catalogError('삭제되었거나 존재하지 않는 작품입니다.',404);
      revisionGuard(exists,expectedRevision(body.expected_revision));
      const token=crypto.randomUUID();
      const result=await db.batch([
        db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},
          status=?,revision=revision+1,last_mutation_token=?,updated_at=? WHERE id=? AND revision=?`)
          .bind(...fieldsParams(fields),status,token,now,id,Number(exists.revision||1)),
        db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
          SELECT ?,?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?`)
          .bind(id,'save_work',JSON.stringify({status}),now,id,token),
      ]);
      if(result[0]?.meta?.changes!==1 || result[1]?.meta?.changes!==1)
        throw catalogError('다른 관리자가 먼저 수정했습니다. 작품을 다시 열어 확인해 주세요.',409);
      return jsonResponse({ok:true,id});
    }
    if(action==='delete'){
      const id=String(body.id||''); if(!uuid(id)) throw catalogError('도감 작품 ID가 올바르지 않습니다.');
      const exists=await db.prepare('SELECT id,title,revision FROM catalog_works WHERE id=?').bind(id).first();
      if(!exists) throw catalogError('이미 삭제되었거나 존재하지 않는 작품입니다.',404);
      revisionGuard(exists,expectedRevision(body.expected_revision));
      // Include legacy approved 'create' proposals (their work_id was originally NULL).
      const relatedAudits=await db.prepare("SELECT details_json FROM catalog_audit WHERE work_id=? AND action='proposal_approved'").bind(id).all();
      const proposalIds=(relatedAudits.results||[]).map(row=>{
        try { return JSON.parse(row.details_json)?.proposal_id; } catch { return null; }
      }).filter(uuid);
      const token=crypto.randomUUID();
      const guarded="EXISTS (SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=?)";
      // Atomic ownership claim prevents stale dialog deletion or partial reference removal.
      const jobs=[
        db.prepare("UPDATE catalog_works SET last_mutation_token=? WHERE id=? AND revision=?")
          .bind(token,id,Number(exists.revision||1)),
        proposalIds.length
          ? db.prepare(`DELETE FROM catalog_proposals WHERE (work_id=? OR id IN (${proposalIds.map(()=>'?').join(',')})) AND ${guarded}`)
              .bind(id,...proposalIds,id,token)
          : db.prepare(`DELETE FROM catalog_proposals WHERE work_id=? AND ${guarded}`).bind(id,id,token),
        db.prepare(`DELETE FROM catalog_source_links WHERE work_id=? AND ${guarded}`).bind(id,id,token),
        db.prepare(`DELETE FROM catalog_direct_edits WHERE work_id=? AND ${guarded}`).bind(id,id,token),
        db.prepare(`DELETE FROM catalog_audit WHERE work_id=? AND ${guarded}`).bind(id,id,token),
        db.prepare('DELETE FROM catalog_works WHERE id=? AND last_mutation_token=?').bind(id,token),
      ];
      const results=await db.batch(jobs);
      if(results[0]?.meta?.changes!==1 || results.at(-1)?.meta?.changes!==1)
        throw catalogError('작품이 변경되었거나 이미 삭제되었습니다. 목록을 새로고침해 주세요.',409);
      return jsonResponse({ok:true,id,deleted:true});
    }
    if(action==='create'){
      const f=catalogFields(body.work||{});
      const status=cleanStatus(body.status||'draft');
      const id=crypto.randomUUID();
      await db.batch([
        db.prepare(`INSERT INTO catalog_works(id,${WORK_FIELDS},status,created_at,updated_at) VALUES(?,${Array(12).fill('?').join(',')},?,?,?)`).bind(id,...fieldsParams(f),status,now,now),
        audit(db,id,'create',{status},now),
      ]);
      return jsonResponse({ok:true,id},201);
    }
    if(action==='update'){
      const id=String(body.id||''); if(!uuid(id)) throw catalogError('작품 ID가 올바르지 않습니다.');
      const current=await db.prepare('SELECT id,status,revision FROM catalog_works WHERE id=?').bind(id).first();
      if(!current) throw catalogError('존재하지 않는 작품입니다.',404);
      revisionGuard(current,expectedRevision(body.expected_revision));
      const f=catalogFields(body.work||{}),token=crypto.randomUUID();
      const results=await db.batch([
        db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},
          revision=revision+1,last_mutation_token=?,updated_at=? WHERE id=? AND revision=?`)
          .bind(...fieldsParams(f),token,now,id,Number(current.revision||1)),
        db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
          SELECT ?,?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?`)
          .bind(id,'update','{}',now,id,token),
      ]);
      if(results.some(r=>r.meta?.changes!==1)) throw catalogError('작품이 변경되었습니다. 새로 확인해 주세요.',409);
      return jsonResponse({ok:true,id});
    }
    if(action==='status'){
      const id=String(body.id||'');if(!uuid(id)) throw catalogError('작품 ID가 올바르지 않습니다.');
      const status=cleanStatus(body.status);
      const current=await db.prepare('SELECT status,revision FROM catalog_works WHERE id=?').bind(id).first();
      if(!current) throw catalogError('존재하지 않는 작품입니다.',404);
      revisionGuard(current,expectedRevision(body.expected_revision));
      if(current.status!==status){
        const token=crypto.randomUUID();
        const results=await db.batch([
          db.prepare('UPDATE catalog_works SET status=?,revision=revision+1,last_mutation_token=?,updated_at=? WHERE id=? AND revision=?')
            .bind(status,token,now,id,Number(current.revision||1)),
          db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
            SELECT ?,?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?`)
            .bind(id,'status',JSON.stringify({from:current.status,to:status}),now,id,token),
        ]);
        if(results.some(r=>r.meta?.changes!==1)) throw catalogError('작품 상태가 변경되었습니다. 새로 확인해 주세요.',409);
      }
      return jsonResponse({ok:true,id,status});
    }
    if(action==='link'||action==='unlink'){
      const sourceType=String(body.source_type||''); const sourceId=String(body.source_id||'').trim();
      if(!['drive','postype'].includes(sourceType)||!sourceId||sourceId.length>240) throw catalogError('원본 유형/ID가 올바르지 않습니다.');
      const linked=await db.prepare('SELECT work_id FROM catalog_source_links WHERE source_type=? AND source_id=?').bind(sourceType,sourceId).first();
      let workId=linked?.work_id;
      if(action==='link'){
        workId=String(body.id||''); if(!uuid(workId)) throw catalogError('작품 ID가 올바르지 않습니다.');
        if(linked && linked.work_id!==workId) throw catalogError('다른 도감 작품에 이미 연결된 원본 ID입니다.',409);
      }
      if(!workId) return jsonResponse({ok:true});
      const current=await db.prepare('SELECT revision FROM catalog_works WHERE id=?').bind(workId).first();
      if(!current) throw catalogError('도감 작품이 없습니다.',404);
      revisionGuard(current,expectedRevision(body.expected_revision));
      if((action==='link' && !linked) || (action==='unlink' && linked)){
        const token=crypto.randomUUID();
        const jobs=[
          db.prepare('UPDATE catalog_works SET revision=revision+1,last_mutation_token=?,updated_at=? WHERE id=? AND revision=?')
            .bind(token,now,workId,Number(current.revision||1)),
        ];
        if(action==='link') {
          jobs.push(db.prepare(`INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at)
            SELECT ?,?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?`)
            .bind(sourceType,sourceId,workId,now,workId,token));
        }else{
          jobs.push(db.prepare(`DELETE FROM catalog_source_links WHERE source_type=? AND source_id=? AND work_id=?
            AND EXISTS(SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=?)`)
            .bind(sourceType,sourceId,workId,workId,token));
        }
        jobs.push(db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
          SELECT ?,?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?`)
          .bind(workId,action,JSON.stringify({source_type:sourceType,source_id:sourceId}),now,workId,token));
        let results;
        try{results=await db.batch(jobs);}
        catch(e){if(/UNIQUE constraint/i.test(String(e?.message||''))) throw catalogError('이미 다른 작품에 연결된 원본입니다.',409);throw e;}
        if(results.some(r=>r.meta?.changes!==1)) throw catalogError('연결 정보가 변경되었습니다. 다시 확인해 주세요.',409);
      }
      return jsonResponse({ok:true});
    }
    if(action==='review'){
      const id=String(body.id||''); if(!uuid(id)) throw catalogError('제안 ID가 올바르지 않습니다.');
      const verdict=String(body.verdict||'');
      if(!['approved','rejected'].includes(verdict)) throw catalogError('검토 결과가 올바르지 않습니다.');
      const note=String(body.note||'').trim(); if(note.length>500) throw catalogError('검토 메모는 500자 이내입니다.');
      const p=await db.prepare("SELECT * FROM catalog_proposals WHERE id=? AND status='pending'").bind(id).first();
      if(!p) throw catalogError('검토 대기 중인 제안이 없습니다.',409);
      let payload;
      try { payload=JSON.parse(p.payload_json); } catch { throw catalogError('제안 데이터가 손상되어 검토할 수 없습니다.',409); }
      const v2=payload?.format===2;
      let workId=p.work_id, newValue=null, column=null, fields=null, current=null;
      if(verdict==='approved' && p.kind==='edit'){
        current=await db.prepare(`SELECT w.*,COALESCE((SELECT a.status FROM catalog_adult_scene_status a WHERE a.work_id=w.id),'미확인') AS adult_scene_status FROM catalog_works w WHERE w.id=?`).bind(p.work_id).first();
        if(!current) throw catalogError('수정 대상 작품이 없습니다.',409);
        if(v2){
          if(current.status!=='published' || Number(current.revision||1)!==Number(payload.base_revision))
            throw catalogError('제안 이후 작품이 변경되었습니다. 내용을 확인하고 재제안을 요청해 주세요.',409);
          const op=catalogOperation(current,payload.operation,payload.change);
          if(op.column!==payload.column || JSON.stringify(op.before)!==JSON.stringify(payload.before))
            throw catalogError('제안 당시 정보와 현재 정보가 다릅니다.',409);
          column=op.column;newValue=op.after;
        }else{
          if(p.base_updated_at!==current.updated_at) throw catalogError('제안 이후 작품이 변경되었습니다. 수동 반영하거나 반려해 주세요.',409);
          fields=catalogFields({ ...payload,genres:JSON.parse(payload.genre_json||'[]'),tags:JSON.parse(payload.tags_json||'[]') });
        }
      } else if(verdict==='approved' && p.kind==='create') {
        if(v2) throw catalogError('미지원 신규 작품 제안 형식입니다.',409);
        fields=catalogFields({ ...payload,genres:JSON.parse(payload.genre_json||'[]'),tags:JSON.parse(payload.tags_json||'[]') });
        workId=crypto.randomUUID();
      }
      const token=crypto.randomUUID();
      let claimSql="UPDATE catalog_proposals SET status=?,admin_note=?,reviewed_at=?,review_token=? WHERE id=? AND status='pending'";
      const claimArgs=[verdict,note,now,token,id];
      if(verdict==='approved' && p.kind==='edit') {
        claimSql+=" AND work_id=? AND EXISTS(SELECT 1 FROM catalog_works WHERE id=? AND revision=?";
        claimArgs.push(p.work_id,p.work_id,Number(current.revision||1));
        if(v2){
          claimSql+=" AND status='published')";
        }else{
          claimSql+=" AND updated_at=?)";
          claimArgs.push(p.base_updated_at);
        }
      }
      const claim=db.prepare(claimSql).bind(...claimArgs);
      const jobs=[claim];
      if(verdict==='approved' && p.kind==='edit'){
        const condition=" AND EXISTS (SELECT 1 FROM catalog_proposals WHERE id=? AND review_token=? AND status='approved')";
        if(v2){
          // Column comes only from the server-side whitelist; values are always bound.
          if(column==='adult_scene_status'){
            jobs.push(db.prepare(`UPDATE catalog_works SET revision=revision+1,updated_at=?,last_mutation_token=?
              WHERE id=? AND revision=?${condition}`)
              .bind(now,token,p.work_id,Number(current.revision||1),id,token));
            jobs.push(db.prepare(`INSERT INTO catalog_adult_scene_status(work_id,status,updated_at)
              SELECT ?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?
              ON CONFLICT(work_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`)
              .bind(p.work_id,newValue,now,p.work_id,token));
          }else jobs.push(db.prepare(`UPDATE catalog_works SET ${column}=?,revision=revision+1,updated_at=?
            WHERE id=? AND revision=?${condition}`)
            .bind(newValue,now,p.work_id,Number(current.revision||1),id,token));
        }else{
          jobs.push(db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},
            revision=revision+1,updated_at=? WHERE id=? AND revision=?${condition}`)
            .bind(...fieldsParams(fields),now,p.work_id,Number(current.revision||1),id,token));
        }
      } else if(verdict==='approved' && p.kind==='create'){
        jobs.push(db.prepare(`INSERT INTO catalog_works(id,${WORK_FIELDS},status,created_at,updated_at)
          SELECT ?,${Array(12).fill('?').join(',')},'draft',?,? FROM catalog_proposals
          WHERE id=? AND status='approved' AND review_token=?`)
          .bind(workId,...fieldsParams(fields),now,now,id,token));
        jobs.push(db.prepare("UPDATE catalog_proposals SET work_id=? WHERE id=? AND review_token=? AND status='approved'")
          .bind(workId,id,token));
      }
      jobs.push(db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
        SELECT ?,?,?,? FROM catalog_proposals WHERE id=? AND review_token=? AND status=?`
      ).bind(workId,`proposal_${verdict}`,JSON.stringify({
        proposal_id:id,kind:p.kind,format:v2?2:1,operation:v2?payload.operation:null,
        base_revision:v2?payload.base_revision:null,reviewed_revision:current?.revision||null,
      }),now,id,token,verdict));
      const results=await db.batch(jobs);
      if(results[0]?.meta?.changes!==1) throw catalogError('다른 관리자가 이미 처리했거나 작품 정보가 변경되었습니다.',409);
      if(results.slice(1).some(result=>result.meta?.changes!==1))
        throw catalogError('도감 정보와 검토 상태가 일치하지 않습니다. 운영 DB를 확인해 주세요.',500);
      return jsonResponse({ok:true,work_id:workId});
    }
    throw catalogError('지원하지 않는 작업입니다.');
  }catch(e){return err(e);}
}
