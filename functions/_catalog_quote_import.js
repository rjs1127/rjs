import { catalogPublicSources } from './_catalog_cp.js';
import { catalogFields, fieldsParams, WORK_FIELDS } from './_work_catalog.js';

export async function importQuoteWorks(db, env) {
  const sources = await catalogPublicSources(env);
  const byId = new Map();
  for (const item of sources) {
    const id = String(item.id || '');
    if (!id) continue;
    // Quote IDs have no source type. Ambiguous source IDs require administrator review.
    if (byId.has(id)) { byId.set(id, null); continue; }
    byId.set(id, item);
  }
  const entries = [...byId.values()].filter(item => item && item.title &&
    ['drive','postype'].includes(item.source || 'drive')).map(item => ({
      id:String(item.id), type:item.source || 'drive', title:item.title, author:item.author || ''
    }));
  const candidates = await db.prepare(`SELECT json_extract(s.value,'$.id') AS id,
    json_extract(s.value,'$.type') AS type, json_extract(s.value,'$.title') AS title,
    json_extract(s.value,'$.author') AS author FROM json_each(?) s
    WHERE json_extract(s.value,'$.id') IN (SELECT work_id FROM shared_quotes WHERE work_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM catalog_source_links l
        WHERE l.source_id=json_extract(s.value,'$.id') AND l.source_type=json_extract(s.value,'$.type'))
    ORDER BY id LIMIT 21`).bind(JSON.stringify(entries)).all();
  const jobs = [], now = Date.now();
  for (const source of (candidates.results || []).slice(0,20)) {
    const id = crypto.randomUUID();
    const fields = catalogFields({title:source.title,author:source.author});
    jobs.push(
      db.prepare(`INSERT INTO catalog_works(id,${WORK_FIELDS},status,created_at,updated_at)
        SELECT ?,${Array(12).fill('?').join(',')},'published',?,?
        WHERE NOT EXISTS (SELECT 1 FROM catalog_source_links WHERE source_type=? AND source_id=?)
          AND EXISTS (SELECT 1 FROM shared_quotes WHERE work_id=?)`)
        .bind(id,...fieldsParams(fields),now,now,source.type,source.id,source.id),
      db.prepare(`INSERT INTO catalog_source_links(source_type,source_id,work_id,created_at)
        SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM catalog_works WHERE id=?)`)
        .bind(source.type,source.id,id,now,id),
      db.prepare(`INSERT INTO catalog_audit(work_id,action,details_json,created_at)
        SELECT ?,'import_public_quotes',?,? WHERE EXISTS (SELECT 1 FROM catalog_works WHERE id=?)`)
        .bind(id,JSON.stringify({source_type:source.type,source_id:source.id}),now,id)
    );
  }
  const results = jobs.length ? await db.batch(jobs) : [];
  return {ok:true,created:results.filter((_,i)=>i%3===0).reduce((n,r)=>n+(Number(r.meta?.changes)||0),0),
    hasMore:(candidates.results || []).length>20};
}
