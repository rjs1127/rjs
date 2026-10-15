import { PUBLIC_ARCHIVE_INDEX_KEY, requireKv, getJson } from './_shared.js';

// Reuse public source CP metadata; never infer links from titles or store a second copy.
export async function catalogPublicSources(env) {
  const archive = await getJson(requireKv(env), PUBLIC_ARCHIVE_INDEX_KEY, null);
  return archive?.items || [];
}
export async function catalogCpSources(env) {
  return catalogCpJsonFromSources(await catalogPublicSources(env));
}
export const CATALOG_CP_CTE = `WITH cp_sources AS (
  SELECT json_extract(value,'$.type') AS type, json_extract(value,'$.id') AS id,
    json_extract(value,'$.cp') AS cp FROM json_each(?)
), work_cp AS (
  SELECT DISTINCT l.work_id,s.cp FROM catalog_source_links l
    JOIN cp_sources s ON s.type=l.source_type AND s.id=l.source_id
)`;
export function withCatalogCp(work, row) {
  return { ...work, main_couples: JSON.parse(row.main_couples_json || '[]') };
}

// Use the status resolved in the existing public archive index, not '연재물' alone.
export function catalogSourceCompletion(item) {
  const status=String(item?.status || '').trim();
  if(status==='완결')return 'completed';
  if(status==='연재' || status==='연재중')return 'ongoing';
  if(status==='미완')return 'incomplete';
  return 'unknown';
}
export function catalogCpJsonFromSources(items) {
  return JSON.stringify(items.filter(item=>item.combination?.trim()).map(item=>({
    type:item.source || 'drive',id:String(item.id),cp:item.combination.trim()
  })));
}

// Join only the links of returned works in JS. The current public archive stays
// the sole CP/status source of truth; avoid serializing it into every list SQL.
export function catalogSourceMetadata(items, neededKeys=null) {
  const cpByKey=new Map(),statusByKey=new Map();
  for(const item of items) {
    const id=String(item?.id??'');
    if(!id)continue;
    const type=item.source||'drive';
    const cp=String(item.combination||'').trim();
    if(neededKeys&&!neededKeys.has(`${type}\u0000${id}`))continue;
    if(cp)cpByKey.set(`${type}\u0000${id}`,cp);
    statusByKey.set(`${item.source==='postype'?'postype':'drive'}\u0000${id}`,catalogSourceCompletion(item));
  }
  return {cpByKey,statusByKey};
}
export function catalogLinkedMetadata(work, linksJson, metadata) {
  let links=[];
  try { links=JSON.parse(linksJson||'[]'); } catch { links=[]; }
  const cps=new Set(), known=new Set();
  for(const link of links) {
    const key=`${link.type}\u0000${link.id}`;
    const cp=metadata.cpByKey.get(key);
    if(cp)cps.add(cp);
    const status=metadata.statusByKey.get(key);
    if(status&&status!=='unknown')known.add(status);
  }
  const result={...work,main_couples:[...cps]};
  if(result.completion_mode==='auto'&&known.size===1)result.source_completion=[...known][0];
  return result;
}

// Bounded UTF-8 JSON binds for the *occasional* full CP aggregate/filter.
// The default list/detail path never needs these SQL parameters.
export function catalogCpChunkedCte(items) {
  const chunks=[];let current=[],bytes=2;
  const encoder=new TextEncoder();
  for(const source of items){
    const cp=String(source.combination||'').trim();
    if(!cp)continue;
    const tuple=[String(source.source||'drive'),String(source.id),cp];
    const size=encoder.encode(JSON.stringify(tuple)).length+1;
    if(current.length&&bytes+size>120000){chunks.push(JSON.stringify(current));current=[];bytes=2;}
    current.push(tuple);bytes+=size;
  }
  if(current.length)chunks.push(JSON.stringify(current));
  if(chunks.length>70)throw new Error('원본 CP 정보가 너무 많아 조회를 완료하지 못했습니다.');
  const pieces=(chunks.length?chunks:['[]']).map(()=>
    "SELECT json_extract(value,'$[0]') AS type,json_extract(value,'$[1]') AS id,json_extract(value,'$[2]') AS cp FROM json_each(?)");
  return {
    cte:`WITH cp_sources AS (${pieces.join(' UNION ALL ')}),work_cp AS (
      SELECT DISTINCT l.work_id,s.cp FROM catalog_source_links l JOIN cp_sources s
        ON s.type=l.source_type AND s.id=l.source_id)`,
    args:chunks.length?chunks:['[]']
  };
}

export function catalogLinkedKeys(rows) {
  const keys=new Set();
  for(const row of rows){
    let links=[];
    try{links=JSON.parse(row?.source_links_json||'[]');}catch{links=[];}
    for(const link of links)keys.add(`${link.type}\u0000${link.id}`);
  }
  return keys;
}

// Bound SQL source-status lookup for precise, cursor-safe completion filtering.
// This query is generated only when a completion filter is selected; the normal
// list fetch still uses one page of work IDs and the existing JS metadata join.
export function catalogCompletionFilterCte(items) {
  const encoder=new TextEncoder(),chunks=[];let current=[],size=2;
  for(const item of items){
    const status=catalogSourceCompletion(item);
    if(status==='unknown')continue;
    const tuple=[item.source==='postype'?'postype':'drive',String(item.id),status];
    const next=encoder.encode(JSON.stringify(tuple)).length+1;
    if(current.length&&size+next>110000){chunks.push(JSON.stringify(current));current=[];size=2;}
    current.push(tuple);size+=next;
  }
  if(current.length)chunks.push(JSON.stringify(current));
  if(chunks.length>70)throw new Error('원본 연재상태 필터 정보가 너무 많습니다.');
  const values=chunks.length?chunks:['[]'];
  return {
    cte:`completion_sources AS (${values.map(()=>`SELECT
      json_extract(value,'$[0]') AS type,json_extract(value,'$[1]') AS id,
      json_extract(value,'$[2]') AS status FROM json_each(?)`).join(' UNION ALL ')}),
    work_source_completion AS (SELECT l.work_id,
      CASE WHEN COUNT(DISTINCT s.status)=1 THEN MIN(s.status) ELSE 'unknown' END AS source_completion
      FROM catalog_source_links l JOIN completion_sources s
        ON l.source_type=s.type AND l.source_id=s.id GROUP BY l.work_id)`,
    args:values
  };
}
