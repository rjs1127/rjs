import { catalogPublicSources, catalogCpJsonFromSources, catalogSourceCompletion, CATALOG_CP_CTE, withCatalogCp } from '../../_catalog_cp.js';
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { publicCatalogWork } from '../../_work_catalog.js';

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
    const page = Math.min(100, Math.max(1, Math.floor(Number(params.get('page') || 1) || 1)));
    const sort = params.get('sort') === 'title' ? 'title' : 'recent';
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
    if (cp) {where.push('EXISTS (SELECT 1 FROM work_cp WHERE work_id=catalog_works.id AND cp=?)');args.push(cp);}
    if (subcouple) {where.push('subcouple=?');args.push(subcouple);}
    const orderBy = sort === 'title' ? 'title COLLATE NOCASE ASC,id ASC' : 'updated_at DESC,id DESC';
    // Use the same public archive snapshot for CP and confirmed source status.
    // Status hints never overwrite catalog_works.completion or change its fill score.
    const sources=await catalogPublicSources(context.env);
    const publicStatus=new Map(sources.map(item=>[`${item.source==='postype'?'postype':'drive'}\u0000${String(item.id)}`,catalogSourceCompletion(item)]));
    const rows = await db.prepare(`${CATALOG_CP_CTE} SELECT catalog_works.*, (SELECT json_group_array(cp) FROM work_cp WHERE work_id=catalog_works.id) AS main_couples_json,
      (SELECT json_group_array(json_object('type',source_type,'id',source_id)) FROM catalog_source_links WHERE work_id=catalog_works.id) AS source_links_json
      FROM catalog_works WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT 21 OFFSET ?`)
      .bind(catalogCpJsonFromSources(sources),...args,(page-1)*20).all();
    const results = rows.results || [];
    const items=results.slice(0,20).map(row=>{
      const work=withCatalogCp(publicCatalogWork(row),row);
      if(work.completion==='unknown') {
        const known=new Set(JSON.parse(row.source_links_json||'[]')
          .map(link=>publicStatus.get(`${link.type}\u0000${link.id}`))
          .filter(value=>value && value!=='unknown'));
        if(known.size===1)work.source_completion=[...known][0];
      }
      return work;
    });
    return jsonResponse({items,page,hasMore:results.length>20},200,{'cache-control':'no-store'});
  } catch(e) {
    if (/no such table/i.test(e?.message||'')) return jsonResponse({items:[],page:1,hasMore:false},200,{'cache-control':'no-store'});
    return jsonResponse({error:e.message||'작품 도감 조회에 실패했습니다.'},e.status||500,{'cache-control':'no-store'});
  }
}
