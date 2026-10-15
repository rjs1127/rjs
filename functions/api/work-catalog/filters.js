import { catalogPublicSources, catalogCpChunkedCte } from '../../_catalog_cp.js';
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';

// Discover filter chips from published rows only; bounded results and no personal files.
export async function onRequestGet(context) {
  try {
    const db = requireUserDb(context.env);
    // CP filter choices are an infrequent, explicit request; unlike every
    // list/detail request they genuinely need the complete published mapping.
    // Split the JSON parameter into bounded chunks while retaining DISTINCT
    // work/CP pairs across chunk boundaries.
    const sources=await catalogPublicSources(context.env);
    const cpSourceList=sources.filter(item=>String(item.combination||'').trim());
    const cpPlan=cpSourceList.length?catalogCpChunkedCte(cpSourceList):null;
    const cpQuery=cpPlan?`${cpPlan.cte} SELECT c.cp AS value,COUNT(*) AS count FROM work_cp c
      JOIN catalog_works w ON w.id=c.work_id WHERE w.status='published' GROUP BY c.cp ORDER BY c.cp`:
      'SELECT CAST(NULL AS TEXT) AS value,0 AS count WHERE 0';
    const [genres,tags,couples] = await Promise.all([
      db.prepare(`SELECT replace(j.value,' ','') AS value, COUNT(*) AS count FROM catalog_works w, json_each(w.genre_json) j
        WHERE w.status='published' AND j.type='text' AND length(j.value) BETWEEN 1 AND 30
        GROUP BY replace(j.value,' ','') ORDER BY count DESC,value ASC LIMIT 24`).all(),
      db.prepare(`SELECT replace(j.value,' ','') AS value, COUNT(*) AS count FROM catalog_works w, json_each(w.tags_json) j
        WHERE w.status='published' AND j.type='text' AND length(j.value) BETWEEN 1 AND 30
        GROUP BY replace(j.value,' ','') ORDER BY count DESC,value ASC LIMIT 36`).all(),
      db.prepare(cpQuery).bind(...(cpPlan?.args||[])).all()
    ]);
    const pick = rows => (rows.results || []).map(r=>({value:String(r.value),count:Number(r.count)||0}));
    return jsonResponse({genres:pick(genres),tags:pick(tags),couples:pick(couples)},200,{'cache-control':'no-store'});
  } catch (e) {
    if (/no such table/i.test(e?.message||'')) return jsonResponse({genres:[],tags:[],couples:[]},200,{'cache-control':'no-store'});
    return jsonResponse({error:'도감 필터를 불러오지 못했습니다.'},500,{'cache-control':'no-store'});
  }
}
