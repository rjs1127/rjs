// v10.79: administrator-only spreadsheet staging and field-scoped approval.
// Staging is intentionally separate from catalog_works, so readers may register
// a title while its spreadsheet row is waiting for review.
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { requireAdminSession } from '../../_admin_session.js';
import { catalogPublicSources } from '../../_catalog_cp.js';
import { ensureWorkCatalogSchema, catalogFields, catalogError, allCatalogWork } from '../../_work_catalog.js';

const RELEVANT = ['synopsis','genres','tags','recommendation','adult_scene_status','warnings'];
const PUBLIC_ADULT = Object.freeze({'직접적 묘사':'있음','묘사 없음':'없음','확인 필요':'확인 필요','미확인':'미확인'});
const ADULT_STATUSES = new Set(['미확인','직접적 묘사','묘사 없음','확인 필요']);
// Extra review-only fields are never approved into catalog_works.
const REVIEW_META = Object.freeze({
  original_number:30,original_filename:420,original_path:1600,
  original_sha256:64,duplicate_note:500,analysis_scope:160,
  summary_progress:120,recheck_log:8000
});
function reviewMetadata(input,previous={}){
  const result={};
  for(const [name,max] of Object.entries(REVIEW_META)){
    const source=Object.prototype.hasOwnProperty.call(input||{},name)?input[name]:previous?.[name];
    if(source===undefined||source===null)continue;
    const value=text(source);
    if(value.length>max)throw catalogError(`${name} 검수 참고정보가 ${max}자를 초과했습니다.`);
    if(name==='original_sha256'&&value&&!/^[a-f0-9]{64}$/i.test(value))
      throw catalogError('원본 파일 식별자(SHA-256)가 올바르지 않습니다.');
    result[name]=value;
  }
  return result;
}
const respond = (data,code=200) => jsonResponse(data,code,{'cache-control':'no-store'});
const errorReply = error => respond({error:error?.message||'작품도감 엑셀 관리 요청에 실패했습니다.'},error?.status||500);
const text = value => String(value??'').trim();
const key = (type,id) => `${type}\u0000${id}`;
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const noBl = values => [...new Set((values||[]).filter(v=>text(v).normalize('NFKC').toUpperCase()!=='BL'))];
const limit = (n,max) => Number.isSafeInteger(Number(n))&&Number(n)>=1&&Number(n)<=max ? Number(n) : null;

async function schema(db){
  await ensureWorkCatalogSchema(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_sheet_drafts (
    source_type TEXT NOT NULL CHECK(source_type IN ('drive','postype')),
    source_id TEXT NOT NULL,
    draft_json TEXT NOT NULL,
    applied_json TEXT NOT NULL DEFAULT '{}',
    review_state TEXT NOT NULL DEFAULT 'pending' CHECK(review_state IN ('pending','approved')),
    sheet_revision INTEGER NOT NULL DEFAULT 1,
    approved_work_id TEXT,
    approved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(source_type,source_id)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_sheet_incoming (
    source_type TEXT NOT NULL,source_id TEXT NOT NULL,
    candidate_json TEXT NOT NULL,base_revision INTEGER NOT NULL,
    created_at INTEGER NOT NULL,PRIMARY KEY(source_type,source_id)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_sheet_history (
    id TEXT PRIMARY KEY,source_type TEXT NOT NULL,source_id TEXT NOT NULL,
    event_type TEXT NOT NULL,sheet_revision INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,created_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS catalog_sheet_history_lookup
    ON catalog_sheet_history(source_type,source_id,created_at DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_sheet_guest_assignments (
    source_type TEXT NOT NULL,source_id TEXT NOT NULL, assigned_at INTEGER NOT NULL,
    PRIMARY KEY(source_type,source_id)
  )`).run();
  // Server-owned evidence of completed Work result reconciliation. Historical
  // free-text logs are never automatically converted into confirmed events.
  // Independent synopsis rework tracking; never occupies the global incoming slot.
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_sheet_synopsis_rework (
    source_type TEXT NOT NULL, source_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'needed' CHECK(state IN ('needed','sent','ready','done')),
    reason TEXT NOT NULL DEFAULT '', proposal TEXT NOT NULL DEFAULT '',
    request_id TEXT NOT NULL DEFAULT '', requested_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL, completed_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(source_type,source_id)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_sheet_recheck_stats (
    source_type TEXT NOT NULL, source_id TEXT NOT NULL,
    recheck_count INTEGER NOT NULL DEFAULT 0,
    last_merged_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(source_type,source_id)
  )`).run();
}
function parse(raw,fallback){try{return JSON.parse(raw);}catch{return fallback;}}
function decode(row){return {...row,draft:parse(row.draft_json,{}),applied:parse(row.applied_json,{}) ,draft_json:undefined,applied_json:undefined};}
function snapshot(row){return JSON.stringify({draft:parse(row.draft_json,{}),applied:parse(row.applied_json,{}),review_state:row.review_state,approved_work_id:row.approved_work_id,approved_at:row.approved_at});}
function historyStatement(db,row,type,id,event,now){
  return db.prepare(`INSERT INTO catalog_sheet_history
    (id,source_type,source_id,event_type,sheet_revision,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),type,id,event,Number(row.sheet_revision),snapshot(row),now);
}
async function assertGuestAssigned(db,type,id){
  const assigned=await db.prepare('SELECT 1 AS ok FROM catalog_sheet_guest_assignments WHERE source_type=? AND source_id=?').bind(type,id).first();
  if(!assigned)throw catalogError('이 작품은 배정되지 않았습니다.',403);
}
async function requireNoIncoming(db,type,id){
  const pending=await db.prepare('SELECT 1 AS pending FROM catalog_sheet_incoming WHERE source_type=? AND source_id=?').bind(type,id).first();
  if(pending)throw catalogError('새 재검수본이 비교 대기 중입니다. 먼저 병합하거나 대기본을 취소해 주세요.',409);
}
function sourceKey(item){
  const type=text(item?.source_type),id=text(item?.source_id);
  if(!['drive','postype'].includes(type)||!id||id.length>240 ||
    (type==='drive'&&!/^[a-z0-9_-]{10,200}$/i.test(id)))
    throw catalogError('원본 유형 또는 ID가 올바르지 않습니다.');
  return {type,id};
}
function checkedDraft(item,source,previous={}){
  // Titles and authors are always grounded in today's public archive metadata.
  // Spreadsheet values cannot rename somebody else's source.
  if(!source)throw catalogError('사이트 공개 원본에서 찾을 수 없는 작품은 가져올 수 없습니다.',409);
  const canonical=v=>text(v).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase();
  if((text(item.title)&&canonical(item.title)!==canonical(source.title)) ||
    (text(item.author)&&canonical(item.author)!==canonical(source.author)))
    throw catalogError('엑셀의 작품명·작가가 사이트 원본 ID와 다릅니다. 원본 ID나 제목 변경 여부를 확인해 주세요.',409);
  const input={title:text(source.title),author:text(source.author),
    synopsis:item.synopsis??'',recommendation:item.recommendation??'',
    genres:noBl(item.genres),tags:item.tags};
  const f=catalogFields(input);
  const reviewStatus=text(item.review_status).slice(0,60);
  const reviewNote=text(item.review_note);
  if(reviewNote.length>8000)throw catalogError('검수 메모는 8,000자 이내로 입력해 주세요.');
  // Not reading the manuscript is NOT evidence that it contains no direct scenes.
  // Keep a legacy row without an adult field unchanged when a newly exported
  // workbook merely contains the default '미확인'. This avoids 459 false diffs.
  const requestedStatus=text(Object.hasOwn(item,'adult_scene_status')?item.adult_scene_status:previous.adult_scene_status)||'미확인';
  if(!ADULT_STATUSES.has(requestedStatus))throw catalogError('성적 묘사 판정값이 올바르지 않습니다.');
  const note=text(Object.hasOwn(item,'adult_scene_note')?item.adult_scene_note:previous.adult_scene_note);
  if(note.length>800)throw catalogError('성적 묘사 판정 근거는 800자 이내로 입력해 주세요.');
  const extra={};
  if(requestedStatus!=='미확인'||Object.hasOwn(previous,'adult_scene_status'))extra.adult_scene_status=requestedStatus;
  if(note||Object.hasOwn(previous,'adult_scene_note'))extra.adult_scene_note=note;
  return {title:f.title,author:f.author,
    synopsis:f.synopsis,genres:JSON.parse(f.genre_json),
    tags:JSON.parse(f.tags_json),
    recommendation:f.recommendation,...((boundedWarnings(item,previous)||Object.prototype.hasOwnProperty.call(previous,'warnings'))?{warnings:boundedWarnings(item,previous)}:{}),review_status:reviewStatus,review_note:reviewNote,
    ...reviewMetadata(item,previous),...extra};
}
function boundedWarnings(item,previous){
  const value=text(Object.prototype.hasOwnProperty.call(item,'warnings')?item.warnings:previous.warnings);
  if(value.length>1000)throw catalogError('주의·호불호 요소는 1,000자 이내로 입력해 주세요.');
  // Legacy 26-column workbooks cannot remove a previously reviewed warning.
  return value;
}
function sameTitle(a,b){return text(a).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase()===text(b).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase();}
function renderText(base,newPart){
  const a=String(base??''),b=text(newPart);
  if(!b)return a;
  if(a.trim()===b || a.split(/\n\s*\n/).some(x=>x.trim()===b))return a;
  return a?`${a}\n\n${b}`:b;
}
function fieldValue(work,name){return name==='genres'?work.genres:name==='tags'?work.tags:work[name];}
function proposed(current,draft,oldApplied,name){
  const field=fieldValue(current,name);
  const previous=oldApplied[name];
  if(previous && !same(field,previous.rendered))
    throw catalogError(`${name} 항목이 마지막 승인 이후 사용자에 의해 변경됐습니다. 관리자에서 확인 후 해당 항목을 직접 병합해 주세요.`,409);
  const base=previous?previous.base:field;
  const suggestion=draft[name];
  const merged=(name==='genres'||name==='tags')
    ? [...new Set([...base,...(suggestion||[])])]
    : renderText(base,suggestion);
  return {base,rendered:merged};
}
async function findContext(db,type,id,title,author){
  const linked=await db.prepare(`SELECT w.*,
    COALESCE((SELECT a.status FROM catalog_adult_scene_status a WHERE a.work_id=w.id),'미확인') AS adult_scene_status FROM catalog_source_links l
    JOIN catalog_works w ON w.id=l.work_id
    WHERE l.source_type=? AND l.source_id=?`).bind(type,id).first();
  if(linked)return {work:linked,collision:null};
  // Prevent duplicate catalog work creation when a legacy unlinked work shares
  // the same normalized title/author. Never auto-attach by title alone.
  const candidates=await db.prepare('SELECT id,title,author,status FROM catalog_works WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?) LIMIT 2')
    .bind(title,author).all();
  const collision=(candidates.results||[]).find(x=>sameTitle(x.title,title)&&sameTitle(x.author,author))||null;
  return {work:null,collision};
}
export async function onRequestGet(context){
  try{
    if(!context.reviewGuest)await requireAdminSession(context);
    const db=requireUserDb(context.env);await schema(db);
    const url=new URL(context.request.url);
    const type=url.searchParams.get('source_type'),id=url.searchParams.get('source_id');
    if(context.reviewGuest&&url.searchParams.get('history')==='1')throw catalogError('접근할 수 없는 기능입니다.',403);
    if(url.searchParams.get('history')==='1'){
      const pair=sourceKey({source_type:type,source_id:id});
      const results=await db.prepare(`SELECT id,event_type,sheet_revision,snapshot_json,created_at
        FROM catalog_sheet_history WHERE source_type=? AND source_id=?
        ORDER BY created_at DESC,rowid DESC LIMIT 30`).bind(pair.type,pair.id).all();
      return respond({items:(results.results||[]).map(x=>({...x,snapshot:parse(x.snapshot_json,{}),snapshot_json:undefined}))});
    }
    if(type!==null||id!==null){
      const pair=sourceKey({source_type:type,source_id:id});
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
        .bind(pair.type,pair.id).first();
      if(!row)throw catalogError('엑셀 초안이 없습니다.',404);
      if(context.reviewGuest)await assertGuestAssigned(db,pair.type,pair.id);
      const {work,collision}=await findContext(db,pair.type,pair.id,parse(row.draft_json,{}).title,parse(row.draft_json,{}).author);
      const incoming=await db.prepare('SELECT candidate_json,base_revision,created_at FROM catalog_sheet_incoming WHERE source_type=? AND source_id=?').bind(pair.type,pair.id).first();
      const stats=await db.prepare('SELECT recheck_count,last_merged_at FROM catalog_sheet_recheck_stats WHERE source_type=? AND source_id=?').bind(pair.type,pair.id).first();
      const rework=await db.prepare('SELECT state,reason,proposal,request_id,requested_at,updated_at,completed_at FROM catalog_sheet_synopsis_rework WHERE source_type=? AND source_id=?').bind(pair.type,pair.id).first();
      return respond({rework:rework||null,item:{...decode(row),recheck_count:stats?.recheck_count||0,last_recheck_merged_at:stats?.last_merged_at||0},work:work?allCatalogWork(work):null,collision,
        incoming:incoming?{draft:parse(incoming.candidate_json,{}),base_revision:incoming.base_revision,created_at:incoming.created_at}:null});
    }
    // 1,000 rows or an explicit error — never truncate an exported workbook.
    const count=await db.prepare('SELECT COUNT(*) AS total FROM catalog_sheet_drafts').first();
    if(Number(count?.total)>1000)throw catalogError('현재 내보내기 상한(1,000행)을 넘었습니다. 분할 내보내기 기능이 필요합니다.',409);
    const rows=await db.prepare(`SELECT d.*,l.work_id,w.status AS work_status,
      CASE WHEN incoming.source_id IS NULL THEN 0 ELSE 1 END AS has_incoming,
      CASE WHEN guest.source_id IS NULL THEN 0 ELSE 1 END AS guest_assigned,
      COALESCE(stats.recheck_count,0) AS recheck_count,
      COALESCE(stats.last_merged_at,0) AS last_recheck_merged_at,
      rework.state AS rework_state,rework.reason AS rework_reason
      FROM catalog_sheet_drafts d LEFT JOIN catalog_sheet_guest_assignments guest ON guest.source_type=d.source_type AND guest.source_id=d.source_id
      LEFT JOIN catalog_sheet_incoming incoming
      ON incoming.source_type=d.source_type AND incoming.source_id=d.source_id
      LEFT JOIN catalog_sheet_recheck_stats stats
      ON stats.source_type=d.source_type AND stats.source_id=d.source_id
      LEFT JOIN catalog_sheet_synopsis_rework rework ON rework.source_type=d.source_type AND rework.source_id=d.source_id
      LEFT JOIN catalog_source_links l
      ON l.source_type=d.source_type AND l.source_id=d.source_id
      LEFT JOIN catalog_works w ON w.id=l.work_id
      ${context.reviewGuest?'WHERE EXISTS(SELECT 1 FROM catalog_sheet_guest_assignments ga WHERE ga.source_type=d.source_type AND ga.source_id=d.source_id)':''}
      ORDER BY d.source_type,d.source_id LIMIT 1001`).all();
    const items=(rows.results||[]).map(decode);
    if(!context.reviewGuest){
      // Same public archive CP source as the published catalog; no title-based guessing.
      const cpSources=await catalogPublicSources(context.env);
      const cpBySource=new Map(cpSources.filter(s=>String(s.combination||'').trim()).map(s=>[
        `${s.source==='postype'?'postype':'drive'}\u0000${String(s.id)}`,String(s.combination).trim()
      ]));
      for(const item of items)item.main_cp=cpBySource.get(`${item.source_type}\u0000${item.source_id}`)||'';
    }
    return respond({items,total:context.reviewGuest?items.length:Number(count?.total||0)});
  }catch(e){return errorReply(e);}
}
export async function onRequestPost(context){
  try{
    if(!context.reviewGuest)await requireAdminSession(context);
    const origin=context.request.headers.get('origin');
    if(origin&&new URL(origin).origin!==new URL(context.request.url).origin)
      throw catalogError('잘못된 요청 출처입니다.',403);
    const db=requireUserDb(context.env);await schema(db);
    const raw=await context.request.text();
    if(raw.length>100000)throw catalogError('한 번에 가져올 엑셀 데이터가 너무 큽니다.',413);
    let body;try{body=JSON.parse(raw);}catch{throw catalogError('JSON 형식이 잘못됐습니다.');}
    const action=body?.action,now=Date.now();
    if(context.reviewGuest){
      if(!['merge_incoming','save_draft','approve','rework_mark'].includes(action))
        throw catalogError('재검수 전용 권한으로 실행할 수 없는 작업입니다.',403);
      const pair=sourceKey(body);
      await assertGuestAssigned(db,pair.type,pair.id);
    }
    if(action==='guest_assign'){
      const pair=sourceKey(body);
      const exists=await db.prepare('SELECT 1 AS ok FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?').bind(pair.type,pair.id).first();
      if(!exists)throw catalogError('검수 목록에 없는 작품입니다.',404);
      if(body.assigned===true)await db.prepare('INSERT OR IGNORE INTO catalog_sheet_guest_assignments(source_type,source_id,assigned_at) VALUES(?,?,?)').bind(pair.type,pair.id,now).run();
      else await db.prepare('DELETE FROM catalog_sheet_guest_assignments WHERE source_type=? AND source_id=?').bind(pair.type,pair.id).run();
      return respond({ok:true,assigned:body.assigned===true});
    }
    if(action==='guest_assign_batch'){
      const count=limit(body.count,50);
      if(!count)throw catalogError('배정할 작품 수를 확인해 주세요.');
      const pending=await db.prepare(`SELECT d.source_type,d.source_id FROM catalog_sheet_drafts d
        JOIN catalog_sheet_incoming i ON i.source_type=d.source_type AND i.source_id=d.source_id
        LEFT JOIN catalog_sheet_guest_assignments a ON a.source_type=d.source_type AND a.source_id=d.source_id
        WHERE a.source_id IS NULL ORDER BY d.source_type,d.source_id LIMIT ?`).bind(count).all();
      const rows=pending.results||[];
      if(rows.length)await db.batch(rows.map(r=>db.prepare('INSERT OR IGNORE INTO catalog_sheet_guest_assignments(source_type,source_id,assigned_at) VALUES(?,?,?)').bind(r.source_type,r.source_id,now)));
      return respond({ok:true,count:rows.length});
    }
    if(action==='rework_mark'){
      const {type,id}=sourceKey(body);
      const state=text(body.state);
      if(!['needed','clear'].includes(state))throw catalogError('보완 지정 상태가 올바르지 않습니다.');
      const reason=text(body.reason);
      if(reason.length>500)throw catalogError('보완 메모는 500자 이내여야 합니다.');
      const exists=await db.prepare('SELECT 1 AS found FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?').bind(type,id).first();
      if(!exists)throw catalogError('검수 목록에 없는 작품입니다.',404);
      if(state==='clear'){
        await db.prepare('DELETE FROM catalog_sheet_synopsis_rework WHERE source_type=? AND source_id=?').bind(type,id).run();
      }else{
        await db.prepare(`INSERT INTO catalog_sheet_synopsis_rework(source_type,source_id,state,reason,updated_at)
          VALUES(?,?,'needed',?,?) ON CONFLICT(source_type,source_id) DO UPDATE SET
          state=CASE WHEN catalog_sheet_synopsis_rework.state='done' THEN 'needed' ELSE catalog_sheet_synopsis_rework.state END,
          reason=excluded.reason,
          proposal=CASE WHEN catalog_sheet_synopsis_rework.state='done' THEN '' ELSE catalog_sheet_synopsis_rework.proposal END,
          request_id=CASE WHEN catalog_sheet_synopsis_rework.state='done' THEN '' ELSE catalog_sheet_synopsis_rework.request_id END,
          requested_at=CASE WHEN catalog_sheet_synopsis_rework.state='done' THEN 0 ELSE catalog_sheet_synopsis_rework.requested_at END,
          updated_at=excluded.updated_at`)
          .bind(type,id,reason,now).run();
      }
      return respond({ok:true});
    }
    if(action==='rework_export_mark'){
      const ids=body.items;
      if(!Array.isArray(ids)||!ids.length||ids.length>100)throw catalogError('내보낼 작품은 1~100편이어야 합니다.');
      const requestId=crypto.randomUUID();
      const jobs=[];
      for(const item of ids){
        const {type,id}=sourceKey(item);
        jobs.push(db.prepare(`UPDATE catalog_sheet_synopsis_rework SET state='sent',request_id=?,requested_at=?,updated_at=?
          WHERE source_type=? AND source_id=? AND state='needed'`).bind(requestId,now,now,type,id));
      }
      const results=await db.batch(jobs);
      if(results.some(result=>result.meta?.changes!==1))throw catalogError('보완 대상이 변경됐습니다. 목록을 새로고침하고 다시 내보내 주세요.',409);
      return respond({ok:true,request_id:requestId});
    }
    if(action==='rework_results'){
      const items=body.items;
      if(!Array.isArray(items)||!items.length||items.length>12)throw catalogError('보완 결과는 한 번에 1~12행씩 가져올 수 있습니다.');
      const jobs=[],seen=new Set();
      for(const item of items){
        const {type,id}=sourceKey(item),k=key(type,id);
        if(seen.has(k))throw catalogError('보완 결과에 중복된 원본 ID가 있습니다.');
        seen.add(k);
        const synopsis=text(item.synopsis),requestId=text(item.request_id);
        if(!synopsis||synopsis.length>12000)throw catalogError('보완 줄거리는 1~12,000자여야 합니다.');
        const row=await db.prepare(`SELECT r.state,r.request_id,d.draft_json FROM catalog_sheet_synopsis_rework r
          JOIN catalog_sheet_drafts d ON d.source_type=r.source_type AND d.source_id=r.source_id
          WHERE r.source_type=? AND r.source_id=?`).bind(type,id).first();
        if(!row||!['sent','ready'].includes(row.state)||!requestId||requestId!==row.request_id)
          throw catalogError(`${type}/${id}: 해당 Work 요청 이력이 없거나 요청 ID가 다릅니다.`,409);
        const draft=parse(row.draft_json,{});
        if(text(item.title)!==text(draft.title)||text(item.author)!==text(draft.author))
          throw catalogError(`${type}/${id}: 원본 작품명 또는 작가가 다릅니다.`,409);
        // Only the dedicated proposal slot is modified, not the existing incoming review.
        jobs.push(db.prepare(`UPDATE catalog_sheet_synopsis_rework SET state='ready',proposal=?,updated_at=?
          WHERE source_type=? AND source_id=? AND request_id=? AND state IN ('sent','ready')`)
          .bind(synopsis,now,type,id,requestId));
      }
      const results=await db.batch(jobs);
      if(results.some(x=>x.meta?.changes!==1))throw catalogError('보완 결과가 동시에 변경됐습니다. 새로고침 후 다시 시도해 주세요.',409);
      return respond({ok:true,changed:results.length});
    }
    if(action==='rework_accept'){
      const {type,id}=sourceKey(body),revision=limit(body.sheet_revision,1e9);
      if(!revision)throw catalogError('최신 검수 초안 버전이 필요합니다.');
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?').bind(type,id).first();
      const rework=await db.prepare('SELECT * FROM catalog_sheet_synopsis_rework WHERE source_type=? AND source_id=?').bind(type,id).first();
      if(!row||!rework||rework.state!=='ready'||Number(row.sheet_revision)!==revision)
        throw catalogError('보완 결과가 대기 중이 아니거나 검수 초안이 변경됐습니다.',409);
      const old=parse(row.draft_json,{});
      const wantsPublic=body.publish===true;
      const nextSynopsis=rework.proposal;
      if(!nextSynopsis||nextSynopsis.length>3000)
        throw catalogError('보완 줄거리의 길이는 1~3,000자여야 합니다. Work 결과를 수정한 뒤 다시 가져와 주세요.',409);
      const next=JSON.stringify({...old,synopsis:nextSynopsis});
      let publicJob=null,auditJob=null,nextApplied=null;
      if(wantsPublic){
        const {work,collision}=await findContext(db,type,id,old.title,old.author);
        if(!work||collision)throw catalogError('공개 승인 전에 작품도감의 원본 연결을 확인해 주세요. 원본 미연결 작품은 비공개 초안만 반영할 수 있습니다.',409);
        const applied=parse(row.applied_json,{}),previous=applied.synopsis;
        if(previous&&!same(work.synopsis,previous.rendered))
          throw catalogError('기존 승인 후 공개 줄거리가 따로 수정되었습니다. 공개 화면을 확인한 뒤 승인해 주세요.',409);
        const validated=catalogFields({...allCatalogWork(work),synopsis:nextSynopsis});
        const token=crypto.randomUUID();
        publicJob=db.prepare(`UPDATE catalog_works SET synopsis=?,revision=revision+1,last_mutation_token=?,updated_at=?
          WHERE id=? AND revision=? AND synopsis=?`).bind(validated.synopsis,token,now,work.id,Number(work.revision||1),work.synopsis);
        nextApplied=JSON.stringify({...applied,synopsis:{base:'',rendered:validated.synopsis,source:nextSynopsis}});
        auditJob=db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
          SELECT ?,'admin_synopsis_rework',?,? WHERE EXISTS(SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=?)`)
          .bind(work.id,JSON.stringify({source_type:type,source_id:id,sheet_revision:revision,request_id:rework.request_id}),now,work.id,token);
      }
      // The pre-existing incoming candidate is retained and its revision pointer
      // moves with the draft; older synopsis must never overwrite this result silently.
      const results=await db.batch([
        db.prepare(`UPDATE catalog_sheet_drafts SET draft_json=?,sheet_revision=sheet_revision+1,
          review_state='pending',updated_at=?,applied_json=COALESCE(?,applied_json),approved_at=CASE WHEN ? IS NOT NULL THEN ? ELSE approved_at END
          WHERE source_type=? AND source_id=? AND sheet_revision=? AND draft_json=?`)
          .bind(next,now,nextApplied,nextApplied,now,type,id,revision,row.draft_json),
        db.prepare(`UPDATE catalog_sheet_incoming SET base_revision=base_revision+1 WHERE source_type=? AND source_id=? AND base_revision=?`)
          .bind(type,id,revision),
        db.prepare(`UPDATE catalog_sheet_synopsis_rework SET state='done',completed_at=?,updated_at=?
          WHERE source_type=? AND source_id=? AND state='ready' AND proposal=?`)
          .bind(now,now,type,id,rework.proposal),
        historyStatement(db,row,type,id,'before_synopsis_rework',now),
        ...(publicJob?[publicJob,auditJob]:[])
      ]);
      if(results[0]?.meta?.changes!==1||results[2]?.meta?.changes!==1||results[3]?.meta?.changes!==1||(publicJob&&(results[4]?.meta?.changes!==1||results[5]?.meta?.changes!==1)))
        throw catalogError('보완 반영 중 동시 변경이 발견됐습니다.',409);
      return respond({ok:true,sheet_revision:revision+1,published:wantsPublic,has_incoming:Boolean(results[1]?.meta?.changes)});
    }
    if(action==='import_batch'||action==='preflight_import'){
      const input=body?.items;
      if(!Array.isArray(input)||input.length<1||input.length>12)
        throw catalogError('엑셀은 한 번에 1~12행씩 가져올 수 있습니다.');
      const sources=await catalogPublicSources(context.env);
      const indexed=new Map(sources.map(s=>[key(s.source==='postype'?'postype':'drive',String(s.id)),s]));
      const jobs=[],seen=new Set();let unchanged=0;const unchangedKeys=[];
      for(const item of input){
        const {type,id}=sourceKey(item),k=key(type,id);
        if(seen.has(k))throw catalogError('같은 원본 ID가 엑셀 배치 안에 중복돼 있습니다.');
        seen.add(k);
        const existing=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
          .bind(type,id).first();
        const value=checkedDraft(item,indexed.get(k),parse(existing?.draft_json,{}));
        const json=JSON.stringify(value);
        if(existing?.draft_json===json){unchanged++;unchangedKeys.push({source_type:type,source_id:id});continue;}
        if(existing && limit(item.sheet_revision,1e9)!==Number(existing.sheet_revision))
          throw catalogError(`${value.title}: 엑셀 초안 버전이 오래됐습니다. 현재 관리 화면에서 최신 엑셀을 내보낸 후 수정해 주세요.`,409);
        if(existing){
          // Import never destroys an admin-edited draft. Keep a separate incoming
          // comparison candidate until the administrator explicitly merges it.
          const pending=await db.prepare('SELECT candidate_json FROM catalog_sheet_incoming WHERE source_type=? AND source_id=?')
            .bind(type,id).first();
          if(pending){
            if(pending.candidate_json===json){unchanged++;unchangedKeys.push({source_type:type,source_id:id});continue;}
            throw catalogError(`${value.title}: 이전에 가져온 재검수본이 아직 비교 대기 중입니다. 먼저 병합 또는 취소해 주세요.`,409);
          }
          jobs.push(db.prepare(`INSERT INTO catalog_sheet_incoming
            (source_type,source_id,candidate_json,base_revision,created_at)
            SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM catalog_sheet_drafts
              WHERE source_type=? AND source_id=? AND sheet_revision=?)`)
            .bind(type,id,json,existing.sheet_revision,now,type,id,existing.sheet_revision));
        }else{
          jobs.push(db.prepare(`INSERT INTO catalog_sheet_drafts
            (source_type,source_id,draft_json,created_at,updated_at) VALUES(?,?,?,?,?)`)
            .bind(type,id,json,now,now));
        }
      }
      if(action==='preflight_import')return respond({ok:true,changed:jobs.length,unchanged,unchanged_keys:unchangedKeys});
      if(jobs.length){const results=await db.batch(jobs);if(results.some(x=>x.meta?.changes!==1))throw catalogError('가져오기 저장을 검증할 수 없습니다.',409);}
      return respond({ok:true,changed:jobs.length,unchanged});
    }
    if(action==='seed_review_metadata'){
      // Backfill missing review provenance ONLY. Never replace synopsis, review notes,
      // a newer draft, approvals, or public catalog fields.
      const input=body?.items;
      if(!Array.isArray(input)||input.length<1||input.length>12)
        throw catalogError('검수 참고정보 보충은 1~12행씩 진행합니다.');
      let changed=0,unchanged=0;
      const used=new Set(),jobs=[];
      for(const item of input){
        const {type,id}=sourceKey(item),k=key(type,id);
        if(used.has(k))throw catalogError('중복 원본 ID가 있습니다.');
        used.add(k);
        const existing=await db.prepare('SELECT draft_json,sheet_revision FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
          .bind(type,id).first();
        if(!existing)throw catalogError('검수함에 없는 원본입니다. 일반 엑셀 가져오기를 먼저 진행해 주세요.',409);
        await requireNoIncoming(db,type,id);
        const old=parse(existing.draft_json,{});
        const candidates=reviewMetadata(item);
        const updates={};
        for(const [name,val] of Object.entries(candidates)){
          if(val&&!text(old[name]))updates[name]=val;
        }
        if(!Object.keys(updates).length){unchanged++;continue;}
        jobs.push(db.prepare(`UPDATE catalog_sheet_drafts SET draft_json=?,
          sheet_revision=sheet_revision+1,updated_at=?
          WHERE source_type=? AND source_id=? AND sheet_revision=? AND draft_json=?`)
          .bind(JSON.stringify({...old,...updates}),now,type,id,existing.sheet_revision,existing.draft_json));
      }
      if(jobs.length){
        const results=await db.batch(jobs);
        if(results.some(x=>x.meta?.changes!==1))
          throw catalogError('동시 변경이 있어 참고정보 보충을 중단했습니다. 새로고침 후 다시 시도해 주세요.',409);
        changed=jobs.length;
      }
      return respond({ok:true,changed,unchanged});
    }
    if(action==='save_draft'){
      // Edit one staged row in place. Never write to catalog_works or publish here.
      const {type,id}=sourceKey(body);
      const revision=limit(body.sheet_revision,1e9);
      if(!revision||!body.draft||typeof body.draft!=='object'||Array.isArray(body.draft))
        throw catalogError('저장할 검수 초안과 버전을 확인해 주세요.');
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
        .bind(type,id).first();
      if(!row)throw catalogError('엑셀 검수 초안이 없습니다.',404);
      await requireNoIncoming(db,type,id);
      if(Number(row.sheet_revision)!==revision)
        throw catalogError('다른 곳에서 초안이 변경됐습니다. 최신 검수함을 다시 열어 확인해 주세요.',409);
      const previous=parse(row.draft_json,{});
      // An existing staged row was source-checked on import. Guest edits must
      // preserve its immutable title/author. Avoid loading/parsing the entire
      // public archive index (KV) on every single-work guest merge/save.
      const source=context.reviewGuest
        ? {title:previous.title,author:previous.author}
        : (await catalogPublicSources(context.env)).find(x=>key(x.source==='postype'?'postype':'drive',String(x.id))===key(type,id));
      const edited=checkedDraft({...body.draft,title:previous.title,author:previous.author},source,previous);
      const updated=JSON.stringify(edited);
      if(updated===row.draft_json)return respond({ok:true,changed:false,sheet_revision:revision});
      const results=await db.batch([
        db.prepare(`UPDATE catalog_sheet_drafts SET
          draft_json=?,sheet_revision=sheet_revision+1,review_state='pending',updated_at=?
          WHERE source_type=? AND source_id=? AND sheet_revision=? AND draft_json=?
          AND NOT EXISTS(SELECT 1 FROM catalog_sheet_incoming WHERE source_type=? AND source_id=?)`)
          .bind(updated,now,type,id,revision,row.draft_json,type,id),
        historyStatement(db,row,type,id,'before_manual_edit',now)
      ]);
      if(results[0]?.meta?.changes!==1)
        throw catalogError('초안이 동시에 수정됐습니다. 최신 버전을 다시 열어 주세요.',409);
      return respond({ok:true,changed:true,sheet_revision:revision+1});
    }
    if(action==='merge_incoming'){
      const {type,id}=sourceKey(body),revision=limit(body.sheet_revision,1e9);
      if(!revision||!body.draft||typeof body.draft!=='object'||Array.isArray(body.draft))
        throw catalogError('병합할 최종 초안과 버전을 확인해 주세요.');
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?').bind(type,id).first();
      const incoming=await db.prepare('SELECT * FROM catalog_sheet_incoming WHERE source_type=? AND source_id=?').bind(type,id).first();
      if(!row||!incoming)throw catalogError('비교할 새 재검수본이 없습니다.',404);
      if(Number(row.sheet_revision)!==revision||Number(incoming.base_revision)!==revision)
        throw catalogError('재검수본을 가져온 뒤 초안이 바뀌었습니다. 최신 데이터를 다시 확인해 주세요.',409);
      const previous=parse(row.draft_json,{});
      // An existing staged row was source-checked on import. Guest edits must
      // preserve its immutable title/author. Avoid loading/parsing the entire
      // public archive index (KV) on every single-work guest merge/save.
      const source=context.reviewGuest
        ? {title:previous.title,author:previous.author}
        : (await catalogPublicSources(context.env)).find(x=>key(x.source==='postype'?'postype':'drive',String(x.id))===key(type,id));
      const merged=checkedDraft({...body.draft,title:previous.title,author:previous.author},source,previous);
      const completed=await db.prepare("SELECT state FROM catalog_sheet_synopsis_rework WHERE source_type=? AND source_id=?").bind(type,id).first();
      const arrived=parse(incoming.candidate_json,{});
      if(completed?.state==='done'&&text(merged.synopsis)!==text(previous.synopsis)&&text(merged.synopsis)===text(arrived.synopsis))
        throw catalogError('이미 보완한 줄거리를 과거 전체 재검수본으로 덮어쓰려 합니다. 줄거리 편집칸은 현재 보완본을 유지하고 다른 항목만 병합해 주세요.',409);
      const updated=JSON.stringify(merged);
      // Count only a Work result with a NEW, appended audit note. Spreadsheet
      // edits without a new inspection log do not imply source-text review.
      const originalLog=text(previous.recheck_log);
      const arrivedLog=text(arrived.recheck_log);
      const isNewReview=Boolean(arrivedLog&&arrivedLog!==originalLog&&
        (!originalLog||arrivedLog.startsWith(originalLog)));
      if(isNewReview){
        // Retain the Work inspection evidence even when the admin keeps their
        // own preferred synopsis, tags or draft wording during merge.
        const chosenLog=text(merged.recheck_log);
        const newPiece=arrivedLog.slice(originalLog.length).trim();
        if(!chosenLog.includes(newPiece)){
          const retained=chosenLog.includes(originalLog)?chosenLog:originalLog;
          const combined=[retained,newPiece].filter(Boolean).join('\n');
          if(combined.length>8000)throw catalogError('재검수 기록 길이 한도를 초과했습니다. 이전 기록을 보존하며 정리해 주세요.');
          merged.recheck_log=combined;
        }
      }
      const safeUpdated=JSON.stringify(merged);
      const jobs=[
        db.prepare(`UPDATE catalog_sheet_drafts SET draft_json=?,sheet_revision=sheet_revision+1,
          review_state='pending',updated_at=? WHERE source_type=? AND source_id=? AND sheet_revision=? AND draft_json=?
          AND EXISTS(SELECT 1 FROM catalog_sheet_incoming WHERE source_type=? AND source_id=? AND base_revision=?)`)
          .bind(safeUpdated,now,type,id,revision,row.draft_json,type,id,revision),
        historyStatement(db,row,type,id,'before_recheck_merge',now),
        db.prepare('DELETE FROM catalog_sheet_incoming WHERE source_type=? AND source_id=? AND base_revision=?')
          .bind(type,id,revision)
      ];
      if(isNewReview){
        jobs.push(db.prepare(`INSERT INTO catalog_sheet_recheck_stats(source_type,source_id,recheck_count,last_merged_at)
          VALUES(?,?,1,?) ON CONFLICT(source_type,source_id) DO UPDATE SET
          recheck_count=recheck_count+1,last_merged_at=excluded.last_merged_at`)
          .bind(type,id,now));
      }
      const results=await db.batch(jobs);
      if(results.some(x=>x.meta?.changes!==1))throw catalogError('병합 중 동시 변경이 발견됐습니다.',409);
      return respond({ok:true,sheet_revision:revision+1,recheck_recorded:isNewReview});
    }
    if(action==='discard_incoming'){
      const {type,id}=sourceKey(body),revision=limit(body.sheet_revision,1e9);
      if(!revision)throw catalogError('현재 초안 버전을 확인해 주세요.');
      const result=await db.prepare(`DELETE FROM catalog_sheet_incoming WHERE source_type=? AND source_id=?
        AND EXISTS(SELECT 1 FROM catalog_sheet_drafts
        WHERE source_type=? AND source_id=? AND sheet_revision=?)`)
        .bind(type,id,type,id,revision).run();
      if(result.meta?.changes!==1)throw catalogError('비교 대기본이 변경됐습니다. 다시 확인해 주세요.',409);
      return respond({ok:true});
    }
    if(action==='restore_history'){
      const {type,id}=sourceKey(body),revision=limit(body.sheet_revision,1e9),historyId=text(body.history_id);
      if(!revision||!historyId||historyId.length>90)throw catalogError('복원할 이력과 현재 초안 버전을 확인해 주세요.');
      await requireNoIncoming(db,type,id);
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?').bind(type,id).first();
      const historic=await db.prepare(`SELECT snapshot_json FROM catalog_sheet_history
        WHERE id=? AND source_type=? AND source_id=?`).bind(historyId,type,id).first();
      if(!row||!historic)throw catalogError('복원할 이력을 찾을 수 없습니다.',404);
      if(Number(row.sheet_revision)!==revision)throw catalogError('초안이 변경됐습니다. 다시 확인해 주세요.',409);
      const historicalDraft=parse(historic.snapshot_json,{}).draft;
      if(!historicalDraft)throw catalogError('이력의 초안 데이터가 없습니다.',409);
      const sources=await catalogPublicSources(context.env);
      const source=sources.find(x=>key(x.source==='postype'?'postype':'drive',String(x.id))===key(type,id));
      const previous=parse(row.draft_json,{});
      const restored=JSON.stringify(checkedDraft({...historicalDraft,title:previous.title,author:previous.author},source,previous));
      if(restored===row.draft_json)return respond({ok:true,changed:false,sheet_revision:revision});
      const results=await db.batch([
        db.prepare(`UPDATE catalog_sheet_drafts SET draft_json=?,sheet_revision=sheet_revision+1,
          review_state='pending',updated_at=? WHERE source_type=? AND source_id=? AND sheet_revision=? AND draft_json=?`)
          .bind(restored,now,type,id,revision,row.draft_json),
        historyStatement(db,row,type,id,'before_history_restore',now)
      ]);
      if(results[0].meta?.changes!==1)throw catalogError('초안 복원이 충돌했습니다.',409);
      return respond({ok:true,changed:true,sheet_revision:revision+1});
    }
    if(action==='approve'){
      const {type,id}=sourceKey(body);
      const requested=body.fields;
      const revision=limit(body.sheet_revision,1e9);
      if(!revision||!Array.isArray(requested)||!requested.length||requested.length>6||
        new Set(requested).size!==requested.length||requested.some(x=>!RELEVANT.includes(x)))
        throw catalogError('승인할 항목과 최신 초안 버전을 선택해 주세요.');
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
        .bind(type,id).first();
      if(!row)throw catalogError('엑셀 초안이 없습니다.',404);
      await requireNoIncoming(db,type,id);
      if(row.sheet_revision!==revision)throw catalogError('엑셀 초안이 변경됐습니다. 다시 확인해 주세요.',409);
      const draft=parse(row.draft_json,{}),applied=parse(row.applied_json,{});
      const {work,collision}=await findContext(db,type,id,draft.title,draft.author);
      if(!work&&body.publish!==true)throw catalogError('신규 작품 승인은 공개 등록으로만 완료할 수 있습니다. 초안 보관은 엑셀 검수함을 사용해 주세요.',409);
      if(!work && collision)throw catalogError('동일 제목·작가의 기존 도감이 있으나 원본 링크가 없습니다. 관리자가 기존 작품에 원본을 연결한 뒤 승인해 주세요.',409);
      let idWork=work?.id||crypto.randomUUID();
      let update={},nextApplied={...applied};
      const coreRequested=requested.filter(field=>field!=='adult_scene_status');
      const wantsAdult=requested.includes('adult_scene_status');
      const desiredAdult=PUBLIC_ADULT[draft.adult_scene_status||'미확인'];
      if(wantsAdult&&!desiredAdult)throw catalogError('성적 묘사 판정이 올바르지 않습니다.');
      const previousAdult=applied.adult_scene_status;
      const existingAdult=work?.adult_scene_status||'미확인';
      if(wantsAdult&&previousAdult&&existingAdult!==previousAdult.rendered)
        throw catalogError('성적 묘사 상태가 마지막 승인 이후 수정되었습니다. 최신 상태를 검토해 주세요.',409);
      const adultChanged=wantsAdult&&desiredAdult!==existingAdult;
      if(wantsAdult)nextApplied.adult_scene_status={base:previousAdult?.base??existingAdult,rendered:desiredAdult,source:draft.adult_scene_status||'미확인'};
      if(work){
        const current=allCatalogWork(work);
        for(const field of coreRequested){
          const piece=proposed(current,draft,applied,field);
          update[field]=piece.rendered;nextApplied[field]={...piece,source:draft[field]};
        }
        const validated=catalogFields({...current,...update});
        for(const field of coreRequested){
          update[field]=(field==='genres'?JSON.parse(validated.genre_json):field==='tags'?JSON.parse(validated.tags_json):validated[field]);
          nextApplied[field].rendered=update[field];
        }
      }else{
        const fields=catalogFields({title:draft.title,author:draft.author,
          completion:'auto',synopsis:coreRequested.includes('synopsis')?draft.synopsis:'',
          recommendation:coreRequested.includes('recommendation')?draft.recommendation:'',
          genres:coreRequested.includes('genres')?draft.genres:[],tags:coreRequested.includes('tags')?draft.tags:[],
          warnings:coreRequested.includes('warnings')?draft.warnings:''});
        update={synopsis:fields.synopsis,recommendation:fields.recommendation,warnings:fields.warnings,
          genres:JSON.parse(fields.genre_json),tags:JSON.parse(fields.tags_json)};
        for(const field of coreRequested) nextApplied[field]={base:(field==='genres'||field==='tags')?[]:'',rendered:update[field],source:draft[field]};
      }
      const jobs=[];
      const token=crypto.randomUUID();
      const changed=work && (adultChanged||coreRequested.some(f=>!same(fieldValue(allCatalogWork(work),f),update[f])));
      const needsWorkUpdate=Boolean(work && (changed || (body.publish===true&&work.status!=='published')));
      if(needsWorkUpdate){
        const columns=coreRequested.filter(f=>!same(fieldValue(allCatalogWork(work),f),update[f]));
        if(body.publish===true&&work.status!=='published')columns.push('status');
        const updates=columns.map(f=>`${f==='genres'?'genre_json':f==='tags'?'tags_json':f}=?`).join(',');
        const args=columns.map(f=>f==='genres'||f==='tags'?JSON.stringify(update[f]):f==='status'?'published':update[f]);
        jobs.push(db.prepare(`UPDATE catalog_works SET ${updates?updates+',':''}revision=revision+1,last_mutation_token=?,updated_at=? WHERE id=? AND revision=?`)
          .bind(...args,token,now,work.id,Number(work.revision||1)));
      }else if(!work){
        // New work only appears after administrator explicitly approves.
        // Public reader registration remains possible while in staging.
        jobs.push(db.prepare(`INSERT INTO catalog_works
          (id,title,author,completion,genre_json,tags_json,synopsis,recommendation,warnings,status,last_mutation_token,created_at,updated_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS
          (SELECT 1 FROM catalog_works WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?))`)
          .bind(idWork,draft.title,draft.author,'auto',JSON.stringify(update.genres),JSON.stringify(update.tags),
            update.synopsis,update.recommendation,update.warnings,body.publish===true?'published':'draft',token,now,now,draft.title,draft.author));
        jobs.push(db.prepare(`INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at)
          SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=?)`)
          .bind(type,id,idWork,now,idWork,token));
      }
      // A separate public caution field; never alters taste keyword tags or free-text warnings.
      if(wantsAdult&&(adultChanged||!work&&desiredAdult!=='미확인')){
        jobs.push(db.prepare(`INSERT INTO catalog_adult_scene_status(work_id,status,updated_at)
          SELECT ?,?,? FROM catalog_works WHERE id=? AND last_mutation_token=?
          ON CONFLICT(work_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`)
          .bind(idWork,desiredAdult,now,idWork,token));
      }
      const fullyApproved=RELEVANT.every(field=>
        nextApplied[field]?same(nextApplied[field].source,draft[field]):(field==='adult_scene_status'?(draft[field]===undefined||draft[field]==='미확인'):!draft[field]?.length));
      const stageGuard=needsWorkUpdate?' AND EXISTS(SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=?)':
        !work?' AND EXISTS(SELECT 1 FROM catalog_source_links WHERE source_type=? AND source_id=? AND work_id=?)':'';
      const stageArgs=needsWorkUpdate?[idWork,token]:!work?[type,id,idWork]:[];
      jobs.push(db.prepare(`UPDATE catalog_sheet_drafts SET applied_json=?,review_state=?,
        approved_work_id=?,approved_at=?,updated_at=? WHERE source_type=? AND source_id=? AND sheet_revision=?${stageGuard}`)
        .bind(JSON.stringify(nextApplied),fullyApproved?'approved':'pending',idWork,now,now,type,id,revision,...stageArgs));
      jobs.push(db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
        SELECT ?,'admin_sheet_approve',?,? FROM catalog_works w
        WHERE w.id=? AND EXISTS(SELECT 1 FROM catalog_sheet_drafts d
        WHERE d.source_type=? AND d.source_id=? AND d.approved_work_id=?
          AND d.approved_at=? AND d.sheet_revision=?)`)
        .bind(idWork,JSON.stringify({source_type:type,source_id:id,fields:requested,sheet_revision:revision,
          created:!work,reviewer:context.reviewGuest?'guest-reviewer':'administrator'}),now,idWork,type,id,idWork,now,revision));
      jobs.push(historyStatement(db,row,type,id,'before_public_approval',now));
      let results;
      try{results=await db.batch(jobs);}catch(e){if(/UNIQUE|constraint/i.test(String(e?.message||'')))throw catalogError('승인 도중 원본·작품이 먼저 등록됐습니다. 새로 열어 병합 대상을 확인해 주세요.',409);throw e;}
      if(results.some(r=>r?.meta?.changes!==1))throw catalogError('동시 변경을 감지했습니다. 최신 도감 상태를 확인해 주세요.',409);
      return respond({ok:true,work_id:idWork,created:!work,fields:requested});
    }
    throw catalogError('지원하지 않는 엑셀 관리 작업입니다.');
  }catch(e){return errorReply(e);}
}
