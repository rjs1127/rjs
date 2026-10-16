import { jsonResponse, requireKv, getJson, ARCHIVE_CACHE_KEY, OVERRIDES_KEY, applyOverrides } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { requireAdminSession } from '../../_admin_session.js';
import { ensureWorkCatalogSchema } from '../../_work_catalog.js';
const respond=(x,status=200)=>jsonResponse(x,status,{'cache-control':'no-store'});
const valid=(x)=>typeof x==='string'&&/^[a-zA-Z0-9_-]{15,160}$/.test(x);
async function schema(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS drive_source_versions (
    old_source_id TEXT PRIMARY KEY, current_source_id TEXT NOT NULL,
    work_id TEXT NOT NULL, reason TEXT NOT NULL,
    position_status TEXT NOT NULL DEFAULT '확인 필요', created_at INTEGER NOT NULL,
    CHECK(old_source_id<>current_source_id))`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_source_versions_current ON drive_source_versions(current_source_id)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS drive_source_version_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,old_source_id TEXT NOT NULL,
    current_source_id TEXT NOT NULL,work_id TEXT NOT NULL,action TEXT NOT NULL,
    reason TEXT NOT NULL,created_at INTEGER NOT NULL)`).run();
}
async function driveItems(env){
 const kv=requireKv(env);let archive=await getJson(kv,ARCHIVE_CACHE_KEY,null);
 if(!archive) return []; // Never force expensive Drive scan just for this screen.
 const overrides=await getJson(kv,OVERRIDES_KEY,{});
 return applyOverrides(archive,overrides)?.items||[];
}
async function inspect(db,env,oldId,newId){
 const items=await driveItems(env);const source=items.find(x=>String(x.id)===newId);
 if(!source)throw Object.assign(new Error('현재 Drive 목록에서 새 파일을 찾지 못했습니다. Drive 동기화 후 확인하세요.'),{status:409});
 const target=await db.prepare(`SELECT w.id,w.title,w.author,w.status FROM catalog_source_links l
 JOIN catalog_works w ON w.id=l.work_id WHERE l.source_type='drive' AND l.source_id=? LIMIT 1`).bind(newId).first();
 if(!target)throw Object.assign(new Error('새 원본 ID에 연결된 작품도감이 없습니다. 먼저 도감 원본을 연결해 주세요.'),{status:409});
 if(target.status!=='published')throw Object.assign(new Error('공개 작품도감에 연결된 현재 원본만 등록할 수 있습니다.'),{status:409});
 const oldLink=await db.prepare(`SELECT work_id FROM catalog_source_links WHERE source_type='drive' AND source_id=?`).bind(oldId).first();
 if(oldLink&&oldLink.work_id!==target.id)throw Object.assign(new Error('구 원본 ID가 다른 도감 작품에 연결돼 있습니다.'),{status:409});
 const oldAlias=await db.prepare(`SELECT * FROM drive_source_versions WHERE old_source_id=? OR current_source_id=? LIMIT 1`).bind(oldId,oldId).first();
 const newAlias=await db.prepare(`SELECT * FROM drive_source_versions WHERE old_source_id=? LIMIT 1`).bind(newId).first();
 const grouped=await db.prepare(`SELECT title,author,COUNT(*) AS count FROM shared_quotes WHERE work_id=? GROUP BY title,author ORDER BY count DESC LIMIT 8`).bind(oldId).all();
 const oldPrivate=await db.prepare(`SELECT COUNT(*) AS n FROM user_quotes WHERE work_id=?`).bind(oldId).first();
 return {old_source_id:oldId,current_source_id:newId,work_id:target.id,
  current_title:target.title,current_author:target.author,current_status:target.status,
  drive_title:source.title||source.fileName||'',drive_filename:source.fileName||'',
  old_quote_groups:grouped.results||[],old_private_count:Number(oldPrivate?.n||0),
  old_alias:oldAlias||null,new_alias:newAlias||null,old_catalog_link:oldLink||null,
  can_register:!oldAlias&&!newAlias&&oldId!==newId};
}
const normalize=value=>String(value||'').normalize('NFKC').replace(/\s*\((?:가독성\s*편집|수정본)\)\s*$/u,'').replace(/[\s\p{P}\p{S}]+/gu,'').toLocaleLowerCase('ko-KR');
function candidateScore(group,work){
 const a=normalize(group.feed_title),b=normalize(work.title);
 if(!a||!b)return 0;
 const title=a===b?100:(a.length>=3&&b.length>=3&&(a.includes(b)||b.includes(a))?48:0);
 if(!title)return 0;
 const authors=normalize(group.feed_author)&&normalize(group.feed_author)===normalize(work.author);
 return title+(authors?30:0);
}
async function discover(db,env){
 // Only surface legacy public IDs with no live published catalog link. Never mutate data here.
 const [quotes,works,aliases]=await Promise.all([
  db.prepare(`SELECT sq.work_id AS old_source_id,sq.title,sq.author,COUNT(*) AS quote_count,
    MAX(CASE WHEN uq.work_id IS NOT NULL AND uq.work_id<>sq.work_id THEN 1 ELSE 0 END) AS private_differs
    FROM shared_quotes sq LEFT JOIN user_quotes uq ON uq.id=sq.quote_id AND uq.user_id=sq.user_id
    WHERE sq.work_id IS NOT NULL AND sq.work_id<>''
    GROUP BY sq.work_id,sq.title,sq.author ORDER BY quote_count DESC`).all(),
  db.prepare(`SELECT w.id AS work_id,w.title,w.author,w.status,l.source_type,l.source_id
    FROM catalog_works w JOIN catalog_source_links l ON l.work_id=w.id AND l.source_type='drive'`).all(),
  db.prepare(`SELECT old_source_id,current_source_id,work_id FROM drive_source_versions`).all()
 ]);
 const sourceItems=await driveItems(env);const activeDrive=new Set(sourceItems.map(x=>String(x.id)));
 const candidates=(works.results||[]).filter(w=>w.source_id&&activeDrive.has(String(w.source_id)));
 const resolved=new Set((aliases.results||[]).filter(a=>candidates.some(w=>w.work_id===a.work_id&&String(w.source_id)===String(a.current_source_id)&&w.status==='published')).map(a=>String(a.old_source_id)));
 const linked=new Set((works.results||[]).filter(w=>w.status==='published').map(w=>String(w.source_id)));
 const groups=new Map();
 for(const q of quotes.results||[]){const old=String(q.old_source_id);if(linked.has(old)||resolved.has(old))continue;
  const key=old+'\u0000'+normalize(q.title)+'\u0000'+normalize(q.author);
  if(groups.has(key)){groups.get(key).quote_count+=Number(q.quote_count||0);continue;}
  const matches=candidates.map(w=>({...w,score:candidateScore({feed_title:q.title,feed_author:q.author},w)}))
    .filter(w=>w.score>0&&String(w.source_id)!==old).sort((a,b)=>b.score-a.score||String(a.title).localeCompare(String(b.title),'ko'));
  groups.set(key,{old_source_id:old,title:q.title||'',author:q.author||'',quote_count:Number(q.quote_count||0),private_differs:!!q.private_differs,
   already_registered:(aliases.results||[]).some(a=>String(a.old_source_id)===old),
   candidates:matches.slice(0,10).map(w=>({work_id:w.work_id,title:w.title,author:w.author,status:w.status,source_id:w.source_id,score:w.score})),candidate_count:matches.length});
 }
 return {items:Array.from(groups.values()).sort((a,b)=>b.quote_count-a.quote_count).slice(0,300),
   total_groups:groups.size,drive_cache_available:sourceItems.length>0,
   note:'제목·작가 기반 후보일 뿐 동일 작품을 증명하지 않습니다. 구·신 파일의 내용과 문장 위치를 확인하세요.'};
}
export async function onRequestGet(context){
 try{await requireAdminSession(context);const db=requireUserDb(context.env);await ensureWorkCatalogSchema(db);await schema(db);
  const url=new URL(context.request.url);const oldId=url.searchParams.get('old_id');const newId=url.searchParams.get('new_id');
  if(url.searchParams.get('mode')==='discover')return respond({ok:true,...await discover(db,context.env)});
  if(oldId!==null||newId!==null){if(!valid(oldId)||!valid(newId))return respond({error:'Drive 파일 ID 형식이 올바르지 않습니다.'},400);return respond({ok:true,preview:await inspect(db,context.env,oldId,newId)});}
  const rows=await db.prepare(`SELECT v.*,w.title,w.author FROM drive_source_versions v LEFT JOIN catalog_works w ON w.id=v.work_id ORDER BY v.created_at DESC LIMIT 250`).all();
  return respond({ok:true,items:rows.results||[]});
 }catch(e){return respond({error:e.message||'원본 이력 조회에 실패했습니다.'},e.status||500)}
}
export async function onRequestPost(context){
 try{await requireAdminSession(context);const db=requireUserDb(context.env);await ensureWorkCatalogSchema(db);await schema(db);
  const b=await context.request.json();const oldId=String(b.old_source_id||''),newId=String(b.current_source_id||'');
  if(!valid(oldId)||!valid(newId)||oldId===newId)return respond({error:'서로 다른 구·신 Drive ID를 입력하세요.'},400);
  if(b.action==='register'){
   const info=await inspect(db,context.env,oldId,newId);
   if(!info.can_register)return respond({error:'이미 다른 교체 이력이 있거나 순환 연결 가능성이 있습니다. 이력을 확인하세요.'},409);
   if(b.confirm!==true||b.confirmed_title!==info.current_title||b.confirmation_text!=='동일 작품 확인')
    return respond({error:'대상 제목과 동일 작품 확인값이 일치하지 않습니다.'},409);
   const reason=String(b.reason||'').trim();if(reason.length<4||reason.length>300)return respond({error:'수정 사유를 4~300자로 작성하세요.'},400);
   if(info.old_quote_groups.length===0&&info.old_private_count===0)return respond({error:'과거 ID의 개인·공개 문장을 찾지 못했습니다. 원본 연관성을 먼저 확인하세요.'},409);
   const now=Date.now();const result=await db.batch([
    db.prepare(`INSERT INTO drive_source_versions(old_source_id,current_source_id,work_id,reason,created_at) VALUES(?,?,?,?,?)`).bind(oldId,newId,info.work_id,reason,now),
    db.prepare(`INSERT INTO drive_source_version_audit(old_source_id,current_source_id,work_id,action,reason,created_at) VALUES(?,?,?,?,?,?)`).bind(oldId,newId,info.work_id,'register',reason,now)]);
   return respond({ok:true,registered:true,position_status:'확인 필요'});
  }
  if(b.action==='revoke'){
   if(b.confirmation_text!=='연결 해제')return respond({error:'연결 해제 확인값이 올바르지 않습니다.'},400);
   const row=await db.prepare('SELECT * FROM drive_source_versions WHERE old_source_id=? AND current_source_id=?').bind(oldId,newId).first();
   if(!row)return respond({error:'연결 이력이 변경됐습니다.'},409);
   const now=Date.now();await db.batch([
    db.prepare('DELETE FROM drive_source_versions WHERE old_source_id=? AND current_source_id=?').bind(oldId,newId),
    db.prepare(`INSERT INTO drive_source_version_audit(old_source_id,current_source_id,work_id,action,reason,created_at) VALUES(?,?,?,?,?,?)`).bind(oldId,newId,row.work_id,'revoke',row.reason,now)]);
   return respond({ok:true,revoked:true});
  }
  return respond({error:'알 수 없는 작업입니다.'},400);
 }catch(e){return respond({error:e.message||'원본 연결 저장에 실패했습니다.'},e.status||500)}
}
