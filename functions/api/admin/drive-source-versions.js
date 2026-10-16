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
export async function onRequestGet(context){
 try{await requireAdminSession(context);const db=requireUserDb(context.env);await ensureWorkCatalogSchema(db);await schema(db);
  const url=new URL(context.request.url);const oldId=url.searchParams.get('old_id');const newId=url.searchParams.get('new_id');
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
