import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';

export async function onRequestGet(context) {
  try {
    const params = new URL(context.request.url).searchParams;
    const id = params.get('id') || '';
    const cursor = params.get('cursor');
    if (!/^[a-f0-9-]{36}$/i.test(id)) return jsonResponse({error:'작품 ID가 올바르지 않습니다.'},400);
    if (cursor !== null && !/^[1-9]\d{0,14}$/.test(cursor))
      return jsonResponse({error:'문장 조회 위치가 올바르지 않습니다.'},400);
    const db = requireUserDb(context.env);
    const work = await db.prepare("SELECT id FROM catalog_works WHERE id=? AND status='published'").bind(id).first();
    if (!work) return jsonResponse({error:'공개된 작품이 없습니다.'},404,{'cache-control':'no-store'});
    // Read the current public table directly: withdrawal/deletion never leaves a copied quote.
    const rows = await db.prepare(`SELECT q.quote_id,q.quote_text FROM shared_quotes q
      WHERE EXISTS (SELECT 1 FROM catalog_source_links l WHERE l.work_id=? AND l.source_id=q.work_id)
        ${cursor !== null ? 'AND q.quote_id<?' : ''}
      ORDER BY q.quote_id DESC LIMIT 6`).bind(id,...(cursor !== null ? [Number(cursor)] : [])).all();
    const items = (rows.results || []).slice(0,5);
    return jsonResponse({items,nextCursor:(rows.results || []).length>5 ? String(items.at(-1).quote_id) : null},200,{'cache-control':'no-store'});
  } catch (error) {
    if (/no such table/i.test(error?.message || '')) return jsonResponse({items:[],nextCursor:null},200,{'cache-control':'no-store'});
    return jsonResponse({error:'공개 문장을 불러오지 못했습니다.'},500,{'cache-control':'no-store'});
  }
}
