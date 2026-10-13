import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { publicCatalogWork } from '../../_work_catalog.js';
export async function onRequestGet(context) {
  try {
    const db = requireUserDb(context.env);
    const url = new URL(context.request.url);
    const q = (url.searchParams.get('q') || '').trim().slice(0,80);
    const genre = (url.searchParams.get('genre') || '').trim().slice(0,30);
    const tag = (url.searchParams.get('tag') || '').trim().slice(0,30);
    const page = Math.min(20, Math.max(1, Number(url.searchParams.get('page') || 1) || 1));
    const where = ["status='published'"];
    const args=[];
    if(q){where.push("(title LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\' OR original_title LIKE ? ESCAPE '\\')");args.push(...Array(3).fill(`%${q.replace(/[\\%_]/g,'\\$&')}%`));}
    if(genre){where.push('EXISTS (SELECT 1 FROM json_each(catalog_works.genre_json) WHERE value=?)');args.push(genre);}
    if(tag){where.push('EXISTS (SELECT 1 FROM json_each(catalog_works.tags_json) WHERE value=?)');args.push(tag);}
    const rows = await db.prepare(`SELECT * FROM catalog_works WHERE ${where.join(' AND ')} ORDER BY updated_at DESC,id DESC LIMIT 21 OFFSET ?`)
      .bind(...args,(page-1)*20).all();
    const results = rows.results || [];
    return jsonResponse({ items: results.slice(0,20).map(publicCatalogWork),page,hasMore:results.length>20 },200,{'cache-control':'public,max-age=30'});
  } catch(e) { if(/no such table/i.test(e?.message||'')) return jsonResponse({items:[],page:1,hasMore:false},200,{'cache-control':'no-store'}); return jsonResponse({error:e.message||'작품 도감 조회에 실패했습니다.'},e.status||500,{'cache-control':'no-store'}); }
}
