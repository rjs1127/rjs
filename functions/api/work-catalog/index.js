import { catalogPublicSources, catalogCpChunkedCte, catalogSourceMetadata, catalogLinkedMetadata, catalogLinkedKeys } from '../../_catalog_cp.js';
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { publicCatalogWork } from '../../_work_catalog.js';

// v10.77: Opaque, filter-bound keyset cursor. Kept separate from the legacy page API.
function filterFingerprint(values) {
  const text=JSON.stringify(values);
  let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
  return hash.toString(16).padStart(8,'0');
}
function cursorError() { const error=new Error('목록 이어보기 정보가 올바르지 않아요. 목록을 새로 불러와 주세요.');error.status=400;return error; }
function encodeCursor(row,sort,fingerprint) {
  const payload=JSON.stringify({v:1,s:sort,f:fingerprint,k:sort==='title'?row.title:row.updated_at,i:row.id});
  return btoa(String.fromCharCode(...new TextEncoder().encode(payload))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeCursor(value,sort,fingerprint) {
  if(!/^[A-Za-z0-9_-]{12,2048}$/.test(value))throw cursorError();
  try {
    const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
    const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(padded),c=>c.charCodeAt(0))));
    if(!payload||Array.isArray(payload)||payload.v!==1||payload.s!==sort||payload.f!==fingerprint||
       typeof payload.i!=='string'||!/^[0-9a-f-]{36}$/i.test(payload.i)||
       (sort==='title' ? typeof payload.k!=='string'||payload.k.length>180 : !Number.isSafeInteger(payload.k)||payload.k<0))throw cursorError();
    return payload;
  }catch(_error){throw cursorError();}
}


// Read-only public encyclopedia. Every query is limited to published works.
export async function onRequestGet(context) {
  try {
    const db = requireUserDb(context.env);
    const params = new URL(context.request.url).searchParams;
    const q = (params.get('q') || '').trim().slice(0, 80);
    const genre = (params.get('genre') || '').trim().slice(0, 30);
    const tags = [...new Set([...params.getAll('tag'), ...params.getAll('tags').flatMap(v => v.split(','))]
      .map(v => v.normalize('NFKC').trim().replace(/^#+/, ''))
      .filter(Boolean))].slice(0, 5);
    if (tags.some(tag => tag.length > 30)) return jsonResponse({error:'키워드 길이가 올바르지 않습니다.'},400);
    const tagMode = params.get('tag_mode') === 'any' ? 'any' : 'all';
    const completion = (params.get('completion') || '').trim();
    const cp = (params.get('cp') || '').trim();
    if (cp.length > 200) return jsonResponse({error:'CP 조건이 올바르지 않습니다.'},400);
    const subcouple = (params.get('subcouple') || '').trim();
    if (completion && !['unknown','ongoing','completed','incomplete','hiatus'].includes(completion)) return jsonResponse({error:'연재 상태가 올바르지 않습니다.'},400);
    if (subcouple && !['unknown','yes','no'].includes(subcouple)) return jsonResponse({error:'서브커플 조건이 올바르지 않습니다.'},400);
    const cursorMode=params.get('mode')==='cursor' || params.has('cursor');
    const page = Math.min(100, Math.max(1, Math.floor(Number(params.get('page') || 1) || 1)));
    const sort = params.get('sort') === 'title' ? 'title' : 'recent';
    const fingerprint=filterFingerprint([q,genre,[...tags].sort(),tagMode,completion,cp,subcouple,sort]);
    const cursor=cursorMode&&params.has('cursor')?decodeCursor(params.get('cursor'),sort,fingerprint):null;
    const where = ["status='published'"];
    const args=[];
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push(`(title LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\' OR original_title LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM json_each(catalog_works.genre_json) WHERE value LIKE ? ESCAPE '\\')
        OR EXISTS (SELECT 1 FROM json_each(catalog_works.tags_json) WHERE value LIKE ? ESCAPE '\\'))`);
      args.push(like,like,like,like,like);
    }
    if (genre) {where.push('EXISTS (SELECT 1 FROM json_each(catalog_works.genre_json) WHERE value=?)');args.push(genre);}
    if (tags.length) {
      if (tagMode === 'any') {
        where.push(`EXISTS (SELECT 1 FROM json_each(catalog_works.tags_json) WHERE value IN (${tags.map(()=>'?').join(',')}))`);
        args.push(...tags);
      } else {
        for (const tag of tags) {where.push('EXISTS (SELECT 1 FROM json_each(catalog_works.tags_json) WHERE value=?)');args.push(tag);}
      }
    }
    if (completion) {where.push('completion=?');args.push(completion);}
    if (cp) {where.push('EXISTS (SELECT 1 FROM work_cp WHERE work_id=catalog_works.id)');}
    if (subcouple) {where.push('subcouple=?');args.push(subcouple);}
    const orderBy = sort === 'title' ? 'title COLLATE NOCASE ASC,id ASC' : 'updated_at DESC,id DESC';
    if(cursor) {
      if(sort==='title') {
        where.push('(catalog_works.title COLLATE NOCASE > ? COLLATE NOCASE OR (catalog_works.title COLLATE NOCASE = ? COLLATE NOCASE AND catalog_works.id > ?))');
      } else {
        where.push('(catalog_works.updated_at < ? OR (catalog_works.updated_at = ? AND catalog_works.id < ?))');
      }
      args.push(cursor.k,cursor.k,cursor.i);
    }
    // The filtered list needs CP source IDs only when a CP filter is active.
    // Without that filter, the page's linked source IDs are mapped to the
    // public source metadata in JS after the LIMIT instead of a huge SQL JSON.
    const sources=await catalogPublicSources(context.env);
    const cpSources=cp?sources.filter(item=>String(item.combination||'').trim()===cp):[];
    const cpQuery=cp?catalogCpChunkedCte(cpSources):null;
    const rows = await db.prepare(`${cpQuery?.cte||''} SELECT catalog_works.*,
      (SELECT json_group_array(json_object('type',source_type,'id',source_id))
        FROM catalog_source_links WHERE work_id=catalog_works.id) AS source_links_json
      FROM catalog_works WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT 21${cursorMode?'':' OFFSET ?'}`)
      .bind(...(cpQuery?.args||[]),...args,...(cursorMode?[]:[(page-1)*20])).all();
    const results = rows.results || [];
    const metadata=catalogSourceMetadata(sources,catalogLinkedKeys(results.slice(0,20)));
    const items=results.slice(0,20).map(row=>
      catalogLinkedMetadata(publicCatalogWork(row),row.source_links_json,metadata));
    const hasMore=results.length>20 && (cursorMode || page<100);
    const nextCursor=cursorMode&&hasMore?encodeCursor(results[19],sort,fingerprint):null;
    return jsonResponse({items,page:cursorMode?null:page,hasMore,nextCursor},200,{'cache-control':'no-store'});
  } catch(e) {
    if (/no such table/i.test(e?.message||'')) return jsonResponse({items:[],page:1,hasMore:false,nextCursor:null},200,{'cache-control':'no-store'});
    return jsonResponse({error:e.message||'작품 도감 조회에 실패했습니다.'},e.status||500,{'cache-control':'no-store'});
  }
}
