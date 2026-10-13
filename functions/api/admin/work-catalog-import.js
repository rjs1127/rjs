import { jsonResponse } from '../../_shared.js';
import { requireAdminSession } from '../../_admin_session.js';
import { requireUserDb } from '../../_user.js';
import { ensureWorkCatalogSchema } from '../../_work_catalog.js';
import { importQuoteWorks } from '../../_catalog_quote_import.js';

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const db = requireUserDb(context.env);
    await ensureWorkCatalogSchema(db);
    return jsonResponse(await importQuoteWorks(db, context.env),200,{'cache-control':'no-store'});
  } catch (error) {
    if (/no such table: shared_quotes/i.test(error?.message || ''))
      return jsonResponse({ok:true,created:0,hasMore:false},200,{'cache-control':'no-store'});
    return jsonResponse({error:error?.message || '공개 문장 작품 등록에 실패했습니다.'},error?.status || 500,{'cache-control':'no-store'});
  }
}
