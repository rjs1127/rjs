import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';

// Discover filter chips from published rows only; bounded results and no personal files.
export async function onRequestGet(context) {
  try {
    const db = requireUserDb(context.env);
    const [genres,tags] = await Promise.all([
      db.prepare(`SELECT j.value AS value, COUNT(*) AS count FROM catalog_works w, json_each(w.genre_json) j
        WHERE w.status='published' AND j.type='text' AND length(j.value) BETWEEN 1 AND 30
        GROUP BY j.value ORDER BY count DESC,j.value ASC LIMIT 24`).all(),
      db.prepare(`SELECT j.value AS value, COUNT(*) AS count FROM catalog_works w, json_each(w.tags_json) j
        WHERE w.status='published' AND j.type='text' AND length(j.value) BETWEEN 1 AND 30
        GROUP BY j.value ORDER BY count DESC,j.value ASC LIMIT 36`).all()
    ]);
    const pick = rows => (rows.results || []).map(r=>({value:String(r.value),count:Number(r.count)||0}));
    return jsonResponse({genres:pick(genres),tags:pick(tags)},200,{'cache-control':'public,max-age=120'});
  } catch (e) {
    if (/no such table/i.test(e?.message||'')) return jsonResponse({genres:[],tags:[]},200,{'cache-control':'no-store'});
    return jsonResponse({error:'도감 필터를 불러오지 못했습니다.'},500,{'cache-control':'no-store'});
  }
}
