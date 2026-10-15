// v10.95: read-only admin audit. Never reassign or expose private quotations.
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { requireAdminSession } from '../../_admin_session.js';
import { ensureWorkCatalogSchema } from '../../_work_catalog.js';

const reply=(data,status=200)=>jsonResponse(data,status,{'cache-control':'no-store'});
const canonical=value=>String(value||'').normalize('NFKC').replace(/\s*\((?:가독성\s*편집|수정본)\)\s*$/u,'').replace(/\s+/gu,'').toLocaleLowerCase('ko-KR');
export async function onRequestGet(context){
  try{
    await requireAdminSession(context);
    const db=requireUserDb(context.env);
    await ensureWorkCatalogSchema(db);
    // Do not create/alter the historical quote tables just to run a diagnostic.
    const [quotesResult,worksResult]=await Promise.all([
      db.prepare(`SELECT sq.work_id AS public_source_id,sq.title AS feed_title,sq.author AS feed_author,
          uq.work_id AS private_source_id,COUNT(*) AS quote_count,
          MAX(sq.shared_at) AS last_shared_at,
          MAX(CASE WHEN l.work_id IS NOT NULL AND w.status='published' THEN 1 ELSE 0 END) AS linked_published,
          MAX(CASE WHEN l.work_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_any,
          MAX(CASE WHEN uq.work_id IS NOT NULL AND uq.work_id!=COALESCE(sq.work_id,'') THEN 1 ELSE 0 END) AS private_id_differs
        FROM shared_quotes sq
        LEFT JOIN user_quotes uq ON uq.id=sq.quote_id AND uq.user_id=sq.user_id
        LEFT JOIN catalog_source_links l ON l.source_id=sq.work_id
        LEFT JOIN catalog_works w ON w.id=l.work_id
        GROUP BY sq.work_id,sq.title,sq.author,uq.work_id
        ORDER BY quote_count DESC,feed_title ASC`).all(),
      db.prepare(`SELECT w.id,w.title,w.author,w.status,l.source_type,l.source_id
        FROM catalog_works w LEFT JOIN catalog_source_links l ON l.work_id=w.id`).all()
    ]);
    const all=quotesResult.results||[],works=worksResult.results||[];
    const output=[];
    for(const q of all){
      if(Number(q.linked_published))continue;
      const title=canonical(q.feed_title);
      const matches=title?works.filter(w=>canonical(w.title)===title):[];
      const candidates=matches.slice(0,8).map(w=>({title:w.title,author:w.author,work_id:w.id,
        status:w.status,source_type:w.source_type||'',source_id:w.source_id||''}));
      output.push({feed_title:q.feed_title||'',feed_author:q.feed_author||'',
        public_source_id:q.public_source_id||'',private_source_id:q.private_source_id||'',
        quote_count:Number(q.quote_count)||0,last_shared_at:Number(q.last_shared_at)||0,
        private_id_differs:!!q.private_id_differs,
        reason:!q.public_source_id?'원본 ID 없음':q.linked_any?'연결된 도감 비공개':'공개 도감 연결 없음',
        candidates,more_candidates:matches.length>8});
    }
    return reply({ok:true,scanned_groups:all.length,unmatched_groups:output.length,
      unmatched_quote_count:output.reduce((sum,x)=>sum+x.quote_count,0),items:output,
      note:'제목 유사 후보는 참고용이며 원본 ID 일치를 증명하지 않습니다. 읽기 전용 점검입니다.'});
  }catch(error){
    if(/no such table/i.test(error?.message||''))return reply({ok:true,scanned_groups:0,unmatched_groups:0,unmatched_quote_count:0,items:[],note:'공개 문장 테이블이 존재하지 않습니다.'});
    return reply({error:error?.message||'문장 연결 점검에 실패했습니다.'},error?.status||500);
  }
}
