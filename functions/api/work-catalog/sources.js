// v10.63: Search only items already visible in the site's public TXT/POSTYPE archive.
import { jsonResponse } from '../../_shared.js';
import { catalogPublicSources } from '../../_catalog_cp.js';

const label = item => String(item ?? '').normalize('NFKC').replace(/\s+/g,' ').trim();
const sourceType = item => item.source === 'postype' ? 'postype' : 'drive';
const validSource = item => {
  const id=String(item?.id??'');
  const type=sourceType(item);
  return Boolean(label(item?.title)) && id.length>0 && id.length<=240 &&
    (type !== 'drive' || /^[A-Za-z0-9_-]{10,200}$/.test(id)) &&
    (type !== 'postype' || (typeof item.url==='string' && /^https:\/\//i.test(item.url)));
};
export async function onRequestGet(context) {
  try {
    const q=label(new URL(context.request.url).searchParams.get('q')).toLocaleLowerCase('ko-KR').slice(0,80);
    if (!q) return jsonResponse({items:[]},200,{'cache-control':'no-store'});
    const sources=await catalogPublicSources(context.env);
    const matches=[];
    for(const item of sources) {
      if(!validSource(item))continue;
      const terms=[item.title,item.author,item.fileName,item.searchAliases].map(v=>label(v).toLocaleLowerCase('ko-KR'));
      if(!terms.some(s=>s.includes(q)))continue;
      matches.push({source_type:sourceType(item),source_id:String(item.id),title:label(item.title),author:label(item.author)});
      if(matches.length===12)break;
    }
    return jsonResponse({items:matches},200,{'cache-control':'no-store'});
  } catch(error){
    return jsonResponse({error:'사이트 작품을 검색하지 못했어요. 잠시 후 다시 시도해 주세요.'},500,{'cache-control':'no-store'});
  }
}
