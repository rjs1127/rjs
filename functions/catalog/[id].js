import { requireUserDb } from '../_user.js';
import { ensureWorkCatalogSchema } from '../_work_catalog.js';
import { catalogPublicSources } from '../_catalog_cp.js';
import { ensureCatalogSeo, SEO_ORIGIN, seoUuid, escapeSeo } from '../_catalog_seo.js';
const absent = () => new Response('작품을 찾을 수 없습니다.',{status:404,headers:{'content-type':'text/plain; charset=utf-8','x-robots-tag':'noindex','cache-control':'no-store'}});
export async function onRequestGet(ctx) {
  const id=String(ctx.params.id||'');if(!seoUuid(id))return absent();
  try {
    const db=requireUserDb(ctx.env);await ensureWorkCatalogSchema(db);await ensureCatalogSeo(db);
    const w=await db.prepare(`SELECT w.title,w.author,w.synopsis,w.genre_json,w.tags_json,w.id,
       v.enabled FROM catalog_works w JOIN catalog_search_visibility v ON v.work_id=w.id
       WHERE w.id=? AND w.status='published' AND v.enabled=1`).bind(id).first();
    if(!w)return absent();
    // CP derives from the already-published source metadata, never guessed from title.
    let cp='';
    try {
      const links=await db.prepare('SELECT source_type,source_id FROM catalog_source_links WHERE work_id=?').bind(id).all();
      const keys=new Set((links.results||[]).map(l=>l.source_type+'\u0000'+l.source_id));
      const sources=await catalogPublicSources(ctx.env);
      cp=String(sources.find(s=>keys.has((s.source||'drive')+'\u0000'+s.id) && s.combination)?.combination||'').trim().slice(0,45);
    }catch(_){/* CP may be temporarily unavailable; never block the public page. */}
    const cpName=cp ? (cp.includes('팬픽') ? cp : cp+' 팬픽') : '신화 팬픽';
    const title=escapeSeo(`${w.title} - ${cpName} | 셩냥책`);
    const summary=String(w.synopsis||'').replace(/\s+/g,' ').trim();
    const desc=escapeSeo((summary ? `${w.title} · ${w.author||'작가 미확인'} · ${summary}` : `${w.title} · ${w.author||'작가 미확인'} · ${cpName} 작품 정보와 줄거리를 셩냥책에서 확인하세요.`).slice(0,165));
    const url=SEO_ORIGIN+'/catalog/'+id;
    const asset=await ctx.env.ASSETS.fetch(new Request(SEO_ORIGIN+'/',{headers:{accept:'text/html'}}));
    if(!asset.ok)return new Response('일시적으로 작품 페이지를 열 수 없습니다.',{status:503});
    let html=await asset.text();
    html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title}</title>`)
      .replace(/<meta name="description"[^>]*>/i,`<meta name="description" content="${desc}" />`)
      .replace(/<link rel="canonical"[^>]*>/i,`<link rel="canonical" href="${url}" />`)
      .replace(/<meta id="ogTitle"[^>]*>/i,`<meta id="ogTitle" property="og:title" content="${title}" />`)
      .replace(/<meta id="ogUrl"[^>]*>/i,`<meta id="ogUrl" property="og:url" content="${url}" />`)
      .replace(/<meta property="og:description"[^>]*>/i,`<meta property="og:description" content="${desc}" />`)
      .replace(/<meta id="twitterTitle"[^>]*>/i,`<meta id="twitterTitle" name="twitter:title" content="${title}" />`)
      .replace(/<meta name="twitter:description"[^>]*>/i,`<meta name="twitter:description" content="${desc}" />`);
    const article=`<section id="catalogSeoIntro" aria-label="작품 소개" style="max-width:800px;margin:24px auto;padding:24px"><h1>${escapeSeo(w.title)}</h1><p>${escapeSeo(w.author||'작가 미확인')} · ${escapeSeo(cpName)}</p>${summary?`<p>${escapeSeo(summary.slice(0,3000))}</p>`:''}<p><a href="${SEO_ORIGIN}/?catalog=${encodeURIComponent(id)}">셩냥책에서 작품 상세 보기</a></p></section>`;
    html=html.replace(/<body([^>]*)>/i,(m)=>m+article);
    return new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, must-revalidate','x-content-type-options':'nosniff'}});
  }catch(e){return new Response('작품을 불러오지 못했습니다.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','x-robots-tag':'noindex','cache-control':'no-store'}});}
}
