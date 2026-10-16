// PIN-scoped spreadsheet review only. Never issues or accepts an admin session.
import { jsonResponse } from '../_shared.js';
import { checkGuestCatalogReviewRequest, recordGuestCatalogReviewFailure } from '../_abuse_guard.js';
import { onRequestGet as getSheet, onRequestPost as postSheet } from './admin/work-catalog-sheets.js';
const reply=(body,status=200)=>jsonResponse(body,status,{'cache-control':'no-store, private','x-content-type-options':'nosniff'});
async function matches(a,b){
  const enc=new TextEncoder();
  const [aa,bb]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);
  let diff=0;const x=new Uint8Array(aa),y=new Uint8Array(bb);
  for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
export async function onRequestPost(context){
  const req=context.request;
  const origin=new URL(req.url).origin,other=req.headers.get('origin'),site=req.headers.get('sec-fetch-site');
  if((other&&other!==origin)||(site&&!['same-origin','none'].includes(site)))return reply({error:'허용되지 않은 요청입니다.'},403);
  if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get('content-type')||''))return reply({error:'JSON 요청만 허용됩니다.'},415);
  const limited=checkGuestCatalogReviewRequest(req);if(limited)return limited;
  const raw=await req.text();if(raw.length>30000)return reply({error:'요청 크기가 제한을 초과했습니다.'},413);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'요청 형식이 올바르지 않습니다.'},400);}
  const configured=String(context.env.CATALOG_REVIEW_GUEST_PIN||'').trim();
  if(!configured)return reply({error:'재검수 전용 암호가 설정되지 않았습니다.'},503);
  const pin=typeof body.code==='string'&&body.code.length<=64?body.code.trim():'';
  if(!pin||!await matches(configured,pin)){
    recordGuestCatalogReviewFailure(req);return reply({error:'암호가 올바르지 않습니다.'},401);
  }
  const op=body.op;
  if(op==='login')return reply({ok:true});
  if(op==='list'||op==='detail'){
    const url=new URL(req.url);
    if(op==='detail'){
      if(!['drive','postype'].includes(body.source_type)||typeof body.source_id!=='string'||body.source_id.length>240)return reply({error:'잘못된 작품 정보입니다.'},400);
      url.searchParams.set('source_type',body.source_type);url.searchParams.set('source_id',body.source_id);
    }
    const forwarded=new Request(url.toString(),{method:'GET',headers:req.headers});
    return getSheet({...context,request:forwarded,reviewGuest:true});
  }
  if(op==='action'){
    if(!['merge_incoming','save_draft','approve','rework_mark'].includes(body.action))return reply({error:'이 작업은 허용되지 않습니다.'},403);
    const safe={...body};delete safe.code;delete safe.op;
    const forwarded=new Request(req.url,{method:'POST',headers:{'content-type':'application/json','origin':origin},body:JSON.stringify(safe)});
    return postSheet({...context,request:forwarded,reviewGuest:true});
  }
  return reply({error:'지원하지 않는 작업입니다.'},400);
}
