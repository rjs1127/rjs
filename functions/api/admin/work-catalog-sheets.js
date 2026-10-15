// v10.79: administrator-only spreadsheet staging and field-scoped approval.
// Staging is intentionally separate from catalog_works, so readers may register
// a title while its spreadsheet row is waiting for review.
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { requireAdminSession } from '../../_admin_session.js';
import { catalogPublicSources } from '../../_catalog_cp.js';
import { ensureWorkCatalogSchema, catalogFields, catalogError, allCatalogWork } from '../../_work_catalog.js';

const RELEVANT = ['synopsis','genres','tags','recommendation'];
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
}
function parse(raw,fallback){try{return JSON.parse(raw);}catch{return fallback;}}
function decode(row){return {...row,draft:parse(row.draft_json,{}),applied:parse(row.applied_json,{}) ,draft_json:undefined,applied_json:undefined};}
function sourceKey(item){
  const type=text(item?.source_type),id=text(item?.source_id);
  if(!['drive','postype'].includes(type)||!id||id.length>240 ||
    (type==='drive'&&!/^[a-z0-9_-]{10,200}$/i.test(id)))
    throw catalogError('원본 유형 또는 ID가 올바르지 않습니다.');
  return {type,id};
}
function checkedDraft(item,source){
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
  if(reviewNote.length>700)throw catalogError('검수 메모는 700자 이내로 입력해 주세요.');
  return {title:f.title,author:f.author,
    synopsis:f.synopsis,genres:JSON.parse(f.genre_json),tags:JSON.parse(f.tags_json),
    recommendation:f.recommendation,review_status:reviewStatus,review_note:reviewNote};
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
  const linked=await db.prepare(`SELECT w.* FROM catalog_source_links l
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
    await requireAdminSession(context);
    const db=requireUserDb(context.env);await schema(db);
    const url=new URL(context.request.url);
    const type=url.searchParams.get('source_type'),id=url.searchParams.get('source_id');
    if(type!==null||id!==null){
      const pair=sourceKey({source_type:type,source_id:id});
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
        .bind(pair.type,pair.id).first();
      if(!row)throw catalogError('엑셀 초안이 없습니다.',404);
      const {work,collision}=await findContext(db,pair.type,pair.id,parse(row.draft_json,{}).title,parse(row.draft_json,{}).author);
      return respond({item:decode(row),work:work?allCatalogWork(work):null,collision});
    }
    // 1,000 rows or an explicit error — never truncate an exported workbook.
    const count=await db.prepare('SELECT COUNT(*) AS total FROM catalog_sheet_drafts').first();
    if(Number(count?.total)>1000)throw catalogError('현재 내보내기 상한(1,000행)을 넘었습니다. 분할 내보내기 기능이 필요합니다.',409);
    const rows=await db.prepare(`SELECT d.*,l.work_id,w.status AS work_status
      FROM catalog_sheet_drafts d LEFT JOIN catalog_source_links l
      ON l.source_type=d.source_type AND l.source_id=d.source_id
      LEFT JOIN catalog_works w ON w.id=l.work_id
      ORDER BY d.source_type,d.source_id LIMIT 1001`).all();
    return respond({items:(rows.results||[]).map(decode),total:Number(count?.total||0)});
  }catch(e){return errorReply(e);}
}
export async function onRequestPost(context){
  try{
    await requireAdminSession(context);
    const origin=context.request.headers.get('origin');
    if(origin&&new URL(origin).origin!==new URL(context.request.url).origin)
      throw catalogError('잘못된 요청 출처입니다.',403);
    const db=requireUserDb(context.env);await schema(db);
    const raw=await context.request.text();
    if(raw.length>100000)throw catalogError('한 번에 가져올 엑셀 데이터가 너무 큽니다.',413);
    let body;try{body=JSON.parse(raw);}catch{throw catalogError('JSON 형식이 잘못됐습니다.');}
    const action=body?.action,now=Date.now();
    if(action==='import_batch'){
      const input=body?.items;
      if(!Array.isArray(input)||input.length<1||input.length>12)
        throw catalogError('엑셀은 한 번에 1~12행씩 가져올 수 있습니다.');
      const sources=await catalogPublicSources(context.env);
      const indexed=new Map(sources.map(s=>[key(s.source==='postype'?'postype':'drive',String(s.id)),s]));
      const jobs=[],seen=new Set();let unchanged=0;
      for(const item of input){
        const {type,id}=sourceKey(item),k=key(type,id);
        if(seen.has(k))throw catalogError('같은 원본 ID가 엑셀 배치 안에 중복돼 있습니다.');
        seen.add(k);
        const value=checkedDraft(item,indexed.get(k));
        const json=JSON.stringify(value);
        const existing=await db.prepare('SELECT draft_json,sheet_revision FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
          .bind(type,id).first();
        if(existing?.draft_json===json){unchanged++;continue;}
        if(existing && limit(item.sheet_revision,1e9)!==Number(existing.sheet_revision))
          throw catalogError(`${value.title}: 엑셀 초안 버전이 오래됐습니다. 현재 관리 화면에서 최신 엑셀을 내보낸 후 수정해 주세요.`,409);
        jobs.push(db.prepare(`INSERT INTO catalog_sheet_drafts
          (source_type,source_id,draft_json,created_at,updated_at) VALUES(?,?,?,?,?)
          ON CONFLICT(source_type,source_id) DO UPDATE SET
          draft_json=excluded.draft_json,sheet_revision=sheet_revision+1,
          review_state='pending',updated_at=excluded.updated_at
          WHERE catalog_sheet_drafts.sheet_revision=?`)
          .bind(type,id,json,now,now,Number(item.sheet_revision||1)));
      }
      if(jobs.length){const results=await db.batch(jobs);if(results.some(x=>x.meta?.changes!==1))throw catalogError('가져오기 저장을 검증할 수 없습니다.',409);}
      return respond({ok:true,changed:jobs.length,unchanged});
    }
    if(action==='save_draft'){
      // Edit one staged row in place. Never write to catalog_works or publish here.
      const {type,id}=sourceKey(body);
      const revision=limit(body.sheet_revision,1e9);
      if(!revision||!body.draft||typeof body.draft!=='object'||Array.isArray(body.draft))
        throw catalogError('저장할 검수 초안과 버전을 확인해 주세요.');
      const row=await db.prepare('SELECT draft_json,sheet_revision FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
        .bind(type,id).first();
      if(!row)throw catalogError('엑셀 검수 초안이 없습니다.',404);
      if(Number(row.sheet_revision)!==revision)
        throw catalogError('다른 곳에서 초안이 변경됐습니다. 최신 검수함을 다시 열어 확인해 주세요.',409);
      const sources=await catalogPublicSources(context.env);
      const source=sources.find(x=>key(x.source==='postype'?'postype':'drive',String(x.id))===key(type,id));
      const previous=parse(row.draft_json,{});
      const edited=checkedDraft({...body.draft,title:previous.title,author:previous.author},source);
      const updated=JSON.stringify(edited);
      if(updated===row.draft_json)return respond({ok:true,changed:false,sheet_revision:revision});
      const result=await db.prepare(`UPDATE catalog_sheet_drafts SET
        draft_json=?,sheet_revision=sheet_revision+1,review_state='pending',updated_at=?
        WHERE source_type=? AND source_id=? AND sheet_revision=? AND draft_json=?`)
        .bind(updated,now,type,id,revision,row.draft_json).run();
      if(result.meta?.changes!==1)
        throw catalogError('초안이 동시에 수정됐습니다. 최신 버전을 다시 열어 주세요.',409);
      return respond({ok:true,changed:true,sheet_revision:revision+1});
    }
    if(action==='approve'){
      const {type,id}=sourceKey(body);
      const requested=body.fields;
      const revision=limit(body.sheet_revision,1e9);
      if(!revision||!Array.isArray(requested)||!requested.length||requested.length>4||
        new Set(requested).size!==requested.length||requested.some(x=>!RELEVANT.includes(x)))
        throw catalogError('승인할 항목과 최신 초안 버전을 선택해 주세요.');
      const row=await db.prepare('SELECT * FROM catalog_sheet_drafts WHERE source_type=? AND source_id=?')
        .bind(type,id).first();
      if(!row)throw catalogError('엑셀 초안이 없습니다.',404);
      if(row.sheet_revision!==revision)throw catalogError('엑셀 초안이 변경됐습니다. 다시 확인해 주세요.',409);
      const draft=parse(row.draft_json,{}),applied=parse(row.applied_json,{});
      const {work,collision}=await findContext(db,type,id,draft.title,draft.author);
      if(!work&&body.publish!==true)throw catalogError('신규 작품 승인은 공개 등록으로만 완료할 수 있습니다. 초안 보관은 엑셀 검수함을 사용해 주세요.',409);
      if(!work && collision)throw catalogError('동일 제목·작가의 기존 도감이 있으나 원본 링크가 없습니다. 관리자가 기존 작품에 원본을 연결한 뒤 승인해 주세요.',409);
      let idWork=work?.id||crypto.randomUUID();
      let update={},nextApplied={...applied};
      if(work){
        const current=allCatalogWork(work);
        for(const field of requested){
          const piece=proposed(current,draft,applied,field);
          update[field]=piece.rendered;nextApplied[field]={...piece,source:draft[field]};
        }
        const validated=catalogFields({...current,...update});
        for(const field of requested){
          update[field]=(field==='genres'?JSON.parse(validated.genre_json):field==='tags'?JSON.parse(validated.tags_json):validated[field]);
          nextApplied[field].rendered=update[field];
        }
      }else{
        const fields=catalogFields({title:draft.title,author:draft.author,
          completion:'auto',synopsis:requested.includes('synopsis')?draft.synopsis:'',
          recommendation:requested.includes('recommendation')?draft.recommendation:'',
          genres:requested.includes('genres')?draft.genres:[],tags:requested.includes('tags')?draft.tags:[]});
        update={synopsis:fields.synopsis,recommendation:fields.recommendation,
          genres:JSON.parse(fields.genre_json),tags:JSON.parse(fields.tags_json)};
        for(const field of requested) nextApplied[field]={base:(field==='genres'||field==='tags')?[]:'',rendered:update[field],source:draft[field]};
      }
      const jobs=[];
      const token=crypto.randomUUID();
      const changed=work && requested.some(f=>!same(fieldValue(allCatalogWork(work),f),update[f]));
      const needsWorkUpdate=Boolean(work && (changed || (body.publish===true&&work.status!=='published')));
      if(needsWorkUpdate){
        const columns=requested.filter(f=>!same(fieldValue(allCatalogWork(work),f),update[f]));
        if(body.publish===true&&work.status!=='published')columns.push('status');
        const updates=columns.map(f=>`${f==='genres'?'genre_json':f==='tags'?'tags_json':f}=?`).join(',');
        const args=columns.map(f=>f==='genres'||f==='tags'?JSON.stringify(update[f]):f==='status'?'published':update[f]);
        jobs.push(db.prepare(`UPDATE catalog_works SET ${updates},revision=revision+1,last_mutation_token=?,updated_at=? WHERE id=? AND revision=?`)
          .bind(...args,token,now,work.id,Number(work.revision||1)));
      }else if(!work){
        // New work only appears after administrator explicitly approves.
        // Public reader registration remains possible while in staging.
        jobs.push(db.prepare(`INSERT INTO catalog_works
          (id,title,author,completion,genre_json,tags_json,synopsis,recommendation,status,last_mutation_token,created_at,updated_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS
          (SELECT 1 FROM catalog_works WHERE lower(trim(title))=lower(?) AND lower(trim(author))=lower(?))`)
          .bind(idWork,draft.title,draft.author,'auto',JSON.stringify(update.genres),JSON.stringify(update.tags),
            update.synopsis,update.recommendation,body.publish===true?'published':'draft',token,now,now,draft.title,draft.author));
        jobs.push(db.prepare(`INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at)
          SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM catalog_works WHERE id=? AND last_mutation_token=?)`)
          .bind(type,id,idWork,now,idWork,token));
      }
      const fullyApproved=RELEVANT.every(field=>
        nextApplied[field]?same(nextApplied[field].source,draft[field]):!draft[field]?.length);
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
          created:!work}),now,idWork,type,id,idWork,now,revision));
      let results;
      try{results=await db.batch(jobs);}catch(e){if(/UNIQUE|constraint/i.test(String(e?.message||'')))throw catalogError('승인 도중 원본·작품이 먼저 등록됐습니다. 새로 열어 병합 대상을 확인해 주세요.',409);throw e;}
      if(results.some(r=>r?.meta?.changes!==1))throw catalogError('동시 변경을 감지했습니다. 최신 도감 상태를 확인해 주세요.',409);
      return respond({ok:true,work_id:idWork,created:!work,fields:requested});
    }
    throw catalogError('지원하지 않는 엑셀 관리 작업입니다.');
  }catch(e){return errorReply(e);}
}
