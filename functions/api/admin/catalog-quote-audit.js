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
    const [quotesResult,worksResult,quoteDetails]=await Promise.all([
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
        FROM catalog_works w LEFT JOIN catalog_source_links l ON l.work_id=w.id`).all(),
      db.prepare(`SELECT sq.quote_id,sq.work_id AS public_source_id,sq.title AS feed_title,sq.author AS feed_author,
        uq.work_id AS private_source_id FROM shared_quotes sq LEFT JOIN user_quotes uq
        ON uq.id=sq.quote_id AND uq.user_id=sq.user_id`).all()
    ]);
    const all=quotesResult.results||[],works=worksResult.results||[];
    const detailRows=quoteDetails.results||[];
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
        candidates,more_candidates:matches.length>8,
        quotes:detailRows.filter(row=>String(row.public_source_id||'')===String(q.public_source_id||'')
          &&String(row.feed_title||'')===String(q.feed_title||'')
          &&String(row.feed_author||'')===String(q.feed_author||'')
          &&String(row.private_source_id||'')===String(q.private_source_id||''))
          .map(row=>({quote_id:Number(row.quote_id),private_source_id:row.private_source_id||''}))});
    }
    return reply({ok:true,scanned_groups:all.length,unmatched_groups:output.length,
      unmatched_quote_count:output.reduce((sum,x)=>sum+x.quote_count,0),items:output,
      works:works.filter(w=>w.status==='published'&&w.source_id).map(w=>({id:w.id,title:w.title,author:w.author,source_type:w.source_type,source_id:w.source_id})),
      note:'제목 유사 후보는 참고용이며 원본 ID 일치를 증명하지 않습니다. 읽기 전용 점검입니다.'});
  }catch(error){
    if(/no such table/i.test(error?.message||''))return reply({ok:true,scanned_groups:0,unmatched_groups:0,unmatched_quote_count:0,items:[],note:'공개 문장 테이블이 존재하지 않습니다.'});
    return reply({error:error?.message||'문장 연결 점검에 실패했습니다.'},error?.status||500);
  }
}

// v10.97: admin-confirmed, single-public-quote source repair. No fuzzy/automatic writes.
export async function onRequestPost(context){
  try{
    await requireAdminSession(context);
    const db=requireUserDb(context.env);await ensureWorkCatalogSchema(db);
    const body=await context.request.json();
    const quoteId=Number(body?.quote_id);
    const expected=String(body?.expected_source_id||'');
    const workId=String(body?.work_id||'');
    const sourceId=String(body?.source_id||'');
    if(!Number.isSafeInteger(quoteId)||quoteId<1||expected.length>300||
      !/^[a-f0-9-]{36}$/i.test(workId)||!sourceId||sourceId.length>300||body?.confirm!==true)
      return reply({error:'문장 또는 복구 대상과 확인 동의가 올바르지 않습니다.'},400);
    const quote=await db.prepare(`SELECT sq.quote_id,sq.work_id,sq.user_id,sq.title,sq.author,
      uq.work_id AS private_source_id FROM shared_quotes sq LEFT JOIN user_quotes uq
      ON uq.id=sq.quote_id AND uq.user_id=sq.user_id WHERE sq.quote_id=?`).bind(quoteId).first();
    if(!quote)return reply({error:'공개 문장이 없거나 공유가 취소됐습니다.'},404);
    if(String(quote.work_id||'')!==expected)return reply({error:'다른 작업에서 공개 문장 원본 ID가 바뀌었습니다. 점검 결과를 새로 열어 주세요.'},409);
    const target=await db.prepare(`SELECT w.id,w.title,w.author,l.source_id,l.source_type FROM catalog_works w
      JOIN catalog_source_links l ON l.work_id=w.id WHERE w.id=? AND w.status='published' AND l.source_id=?`)
      .bind(workId,sourceId).first();
    if(!target)return reply({error:'선택한 공개 작품의 원본 연결이 변경됐습니다.'},409);
    const privateId=String(quote.private_source_id||'');
    if(privateId&&privateId!==sourceId)return reply({error:'개인 저장 문장의 원본 ID와 선택한 작품 원본이 다릅니다. 자동 수정하지 않았습니다. 원본 연결을 먼저 확인해 주세요.'},409);
    if(expected===sourceId)return reply({ok:true,unchanged:true});
    const linked=await db.prepare(`SELECT w.id FROM catalog_source_links l JOIN catalog_works w ON w.id=l.work_id
      WHERE l.source_id=? AND w.status='published' LIMIT 1`).bind(expected).first();
    if(linked&&linked.id!==workId)return reply({error:'공개 문장이 이미 다른 공개 도감에 연결되어 있습니다. 자동으로 이동하지 않았습니다.'},409);
    const now=Date.now();
    await db.prepare(`CREATE TABLE IF NOT EXISTS catalog_quote_link_repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,quote_id INTEGER NOT NULL,old_source_id TEXT,
      new_source_id TEXT NOT NULL,work_id TEXT NOT NULL,created_at INTEGER NOT NULL)`).run();
    const result=await db.prepare(`UPDATE shared_quotes SET work_id=? WHERE quote_id=? AND COALESCE(work_id,'')=?`)
      .bind(sourceId,quoteId,expected).run();
    if(Number(result?.meta?.changes||0)!==1)return reply({error:'처리 중 문장 연결이 변경됐습니다. 다시 점검해 주세요.'},409);
    await db.prepare(`INSERT INTO catalog_quote_link_repairs(quote_id,old_source_id,new_source_id,work_id,created_at)
      VALUES(?,?,?,?,?)`).bind(quoteId,expected,sourceId,workId,now).run();
    return reply({ok:true,quote_id:quoteId,work_title:target.title});
  }catch(error){return reply({error:error?.message||'문장 연결 복구에 실패했습니다.'},error?.status||500);}
}
