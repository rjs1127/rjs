import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { requireAdminSession } from '../../_admin_session.js';
import { ensureWorkCatalogSchema, catalogBody, catalogFields, catalogError, allCatalogWork, fieldsParams, WORK_FIELDS } from '../../_work_catalog.js';

const uuid = v => /^[a-f0-9-]{36}$/i.test(String(v||''));
const audit = (db,workId,action,data,now) => db.prepare('INSERT INTO catalog_audit(work_id,action,details_json,created_at) VALUES(?,?,?,?)').bind(workId,action,JSON.stringify(data||{}),now);
function cleanStatus(value){ if (!['draft','published','archived'].includes(value)) throw catalogError('공개 상태가 올바르지 않습니다.'); return value; }
const err = e => jsonResponse({error:e?.message||'도감 관리 요청에 실패했습니다.'},e?.status||500,{'cache-control':'no-store'});

export async function onRequestGet(context){
  try {
    await requireAdminSession(context);
    const db=requireUserDb(context.env); await ensureWorkCatalogSchema(db);
    const url=new URL(context.request.url);
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
    const sql=`SELECT * FROM catalog_works ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY updated_at DESC,id DESC LIMIT 100`;
    const params=[...(status==='all'?[]:[status]),...(q?[like,like]:[])];
    const [works,proposals,counts,links]=await Promise.all([
      db.prepare(sql).bind(...params).all(),
      db.prepare("SELECT id,work_id,user_id,kind,payload_json,status,created_at,admin_note,base_updated_at FROM catalog_proposals WHERE status='pending' ORDER BY created_at ASC LIMIT 100").all(),
      db.prepare("SELECT status,COUNT(*) AS total FROM catalog_works GROUP BY status").all(),
      db.prepare("SELECT source_type,source_id,work_id FROM catalog_source_links ORDER BY created_at DESC LIMIT 10000").all(),
    ]);
    return jsonResponse({works:(works.results||[]).map(allCatalogWork),proposals:(proposals.results||[]).map(p=>({...p,payload:JSON.parse(p.payload_json),payload_json:undefined})),counts:counts.results||[],links:links.results||[],limited:(works.results||[]).length===100},200,{'cache-control':'no-store'});
  }catch(e){return err(e);}
}

export async function onRequestPost(context){
  try {
    await requireAdminSession(context);
    const db=requireUserDb(context.env); await ensureWorkCatalogSchema(db);
    const body=await catalogBody(context.request);
    const action=String(body.action||''); const now=Date.now();
    if(action==='upsert_source'){
      const sourceType=String(body.source_type||'');
      const sourceId=String(body.source_id||'').trim();
      if(!['drive','postype'].includes(sourceType)||!sourceId||sourceId.length>240) throw catalogError('원본 유형/ID가 올바르지 않습니다.');
      const fields=catalogFields(body.work||{});
      const status=cleanStatus(body.status||'draft');
      const link=await db.prepare('SELECT work_id FROM catalog_source_links WHERE source_type=? AND source_id=?').bind(sourceType,sourceId).first();
      const id=link?.work_id||crypto.randomUUID();
      const jobs=link?[
        db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},status=?,updated_at=? WHERE id=?`).bind(...fieldsParams(fields),status,now,id),
      ]:[
        db.prepare(`INSERT INTO catalog_works(id,${WORK_FIELDS},status,created_at,updated_at) VALUES(?,${Array(12).fill('?').join(',')},?,?,?)`).bind(id,...fieldsParams(fields),status,now,now),
        db.prepare('INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at) VALUES(?,?,?,?)').bind(sourceType,sourceId,id,now),
      ];
      jobs.push(audit(db,id,link?'update_source':'create_source',{source_type:sourceType,source_id:sourceId,status},now));
      await db.batch(jobs);
      return jsonResponse({ok:true,id,created:!link},link?200:201);
    }
    if(action==='save_work'){
      const id=String(body.id||''); if(!uuid(id)) throw catalogError('도감 작품 ID가 올바르지 않습니다.');
      const fields=catalogFields(body.work||{});
      const status=cleanStatus(body.status||'draft');
      const exists=await db.prepare('SELECT id FROM catalog_works WHERE id=?').bind(id).first();
      if(!exists) throw catalogError('삭제되었거나 존재하지 않는 작품입니다.',404);
      await db.batch([
        db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},status=?,updated_at=? WHERE id=?`).bind(...fieldsParams(fields),status,now,id),
        audit(db,id,'save_work',{status},now),
      ]);
      return jsonResponse({ok:true,id});
    }
    if(action==='delete'){
      const id=String(body.id||''); if(!uuid(id)) throw catalogError('도감 작품 ID가 올바르지 않습니다.');
      const exists=await db.prepare('SELECT id,title FROM catalog_works WHERE id=?').bind(id).first();
      if(!exists) throw catalogError('이미 삭제되었거나 존재하지 않는 작품입니다.',404);
      // Include legacy approved 'create' proposals (their work_id was originally NULL).
      const relatedAudits=await db.prepare("SELECT details_json FROM catalog_audit WHERE work_id=? AND action='proposal_approved'").bind(id).all();
      const proposalIds=(relatedAudits.results||[]).map(row=>{
        try { return JSON.parse(row.details_json)?.proposal_id; } catch { return null; }
      }).filter(uuid);
      // Atomic batch: delete all catalogue-owned metadata and references.
      // TXT files, POSTYPE sheets and personal records are NEVER modified.
      await db.batch([
        ...(proposalIds.length?[db.prepare(`DELETE FROM catalog_proposals WHERE work_id=? OR id IN (${proposalIds.map(()=>'?').join(',')})`).bind(id,...proposalIds)]:
          [db.prepare('DELETE FROM catalog_proposals WHERE work_id=?').bind(id)]),
        db.prepare('DELETE FROM catalog_source_links WHERE work_id=?').bind(id),
        db.prepare('DELETE FROM catalog_audit WHERE work_id=?').bind(id),
        db.prepare('DELETE FROM catalog_works WHERE id=?').bind(id),
      ]);
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
      const current=await db.prepare('SELECT id,status FROM catalog_works WHERE id=?').bind(id).first();
      if(!current) throw catalogError('존재하지 않는 작품입니다.',404);
      const f=catalogFields(body.work||{});
      await db.batch([
        db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},updated_at=? WHERE id=?`).bind(...fieldsParams(f),now,id),
        audit(db,id,'update',{},now),
      ]);
      return jsonResponse({ok:true,id});
    }
    if(action==='status'){
      const id=String(body.id||'');if(!uuid(id)) throw catalogError('작품 ID가 올바르지 않습니다.');
      const status=cleanStatus(body.status);
      const current=await db.prepare('SELECT status FROM catalog_works WHERE id=?').bind(id).first();
      if(!current) throw catalogError('존재하지 않는 작품입니다.',404);
      if(current.status!==status) await db.batch([
        db.prepare('UPDATE catalog_works SET status=?,updated_at=? WHERE id=?').bind(status,now,id),
        audit(db,id,'status',{from:current.status,to:status},now),
      ]);
      return jsonResponse({ok:true,id,status});
    }
    if(action==='link'||action==='unlink'){
      const sourceType=String(body.source_type||''); const sourceId=String(body.source_id||'').trim();
      if(!['drive','postype'].includes(sourceType)||!sourceId||sourceId.length>240) throw catalogError('원본 유형/ID가 올바르지 않습니다.');
      if(action==='link'){
        const id=String(body.id||''); if(!uuid(id)) throw catalogError('작품 ID가 올바르지 않습니다.');
        const exists=await db.prepare('SELECT id FROM catalog_works WHERE id=?').bind(id).first();
        if(!exists) throw catalogError('도감 작품이 없습니다.',404);
        const linked=await db.prepare('SELECT work_id FROM catalog_source_links WHERE source_type=? AND source_id=?').bind(sourceType,sourceId).first();
        if(linked && linked.work_id!==id) throw catalogError('다른 도감 작품에 이미 연결된 원본 ID입니다.',409);
        if(!linked) await db.batch([
          db.prepare('INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at) VALUES(?,?,?,?)').bind(sourceType,sourceId,id,now),
          audit(db,id,'link',{source_type:sourceType,source_id:sourceId},now),
        ]);
        return jsonResponse({ok:true});
      }
      const linked=await db.prepare('SELECT work_id FROM catalog_source_links WHERE source_type=? AND source_id=?').bind(sourceType,sourceId).first();
      if(linked) await db.batch([
        db.prepare('DELETE FROM catalog_source_links WHERE source_type=? AND source_id=?').bind(sourceType,sourceId),
        audit(db,linked.work_id,'unlink',{source_type:sourceType,source_id:sourceId},now),
      ]);
      return jsonResponse({ok:true});
    }
    if(action==='review'){
      const id=String(body.id||''); if(!uuid(id)) throw catalogError('제안 ID가 올바르지 않습니다.');
      const verdict=String(body.verdict||'');
      if(!['approved','rejected'].includes(verdict)) throw catalogError('검토 결과가 올바르지 않습니다.');
      const note=String(body.note||'').trim(); if(note.length>500) throw catalogError('검토 메모는 500자 이내입니다.');
      const p=await db.prepare('SELECT * FROM catalog_proposals WHERE id=? AND status=\'pending\'').bind(id).first();
      if(!p) throw catalogError('검토 대기 중인 제안이 없습니다.',409);
      const jobs=[]; let workId=p.work_id;
      if(verdict==='approved'){
        const fields=JSON.parse(p.payload_json);
        const f=catalogFields({ ...fields,genres:JSON.parse(fields.genre_json||'[]'),tags:JSON.parse(fields.tags_json||'[]') });
        if(p.kind==='edit'){
          const current=await db.prepare('SELECT id,updated_at FROM catalog_works WHERE id=?').bind(p.work_id).first();
          if(!current) throw catalogError('수정 대상 작품이 없습니다.',409);
          if(current.updated_at!==p.base_updated_at) throw catalogError('제안 이후 작품이 변경되었습니다. 최신 정보를 확인한 뒤 제안을 반려하거나 관리자 화면에서 수동 반영해 주세요.',409);
          jobs.push(db.prepare(`UPDATE catalog_works SET ${WORK_FIELDS.split(',').map(k=>`${k}=?`).join(',')},updated_at=? WHERE id=?`).bind(...fieldsParams(f),now,p.work_id));
        }else{
          workId=crypto.randomUUID();
          jobs.push(db.prepare(`INSERT INTO catalog_works(id,${WORK_FIELDS},status,created_at,updated_at) VALUES(?,${Array(12).fill('?').join(',')},'draft',?,?)`).bind(workId,...fieldsParams(f),now,now));
        }
      }
      jobs.push(db.prepare("UPDATE catalog_proposals SET status=?,admin_note=?,reviewed_at=? WHERE id=? AND status='pending'").bind(verdict,note,now,id));
      jobs.push(audit(db,workId,`proposal_${verdict}`,{proposal_id:id,kind:p.kind},now));
      await db.batch(jobs);
      return jsonResponse({ok:true,work_id:workId});
    }
    throw catalogError('지원하지 않는 작업입니다.');
  }catch(e){return err(e);}
}
