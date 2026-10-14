// v10.67 — Public metadata-only work history; never reveal account IDs or prior text.
import { jsonResponse } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';

const labels=Object.freeze({
  genre_add:'장르 추가',genre_remove:'장르 삭제',genre_edit:'장르 수정',tag_add:'키워드 추가',tag_remove:'키워드 삭제',tag_edit:'키워드 수정',
  synopsis_set:'줄거리 수정',completion_set:'연재 상태 변경',
  subcouple_update:'서브커플 유무·설명 수정',subcouple_set:'서브커플 유무 수정',
  subcouple_note_set:'서브커플 설명 수정',recommendation_add:'추천 문구 추가',recommendation_edit:'추천 문구 수정',recommendation_remove:'추천 문구 삭제',
  warnings_set:'주의·호불호 정보 수정'
});
const reply=(payload,status=200)=>jsonResponse(payload,status,{'cache-control':'no-store'});
export async function onRequestGet(context){
  try {
    const id=new URL(context.request.url).searchParams.get('id')||'';
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
      return reply({error:'작품 ID가 올바르지 않습니다.'},400);
    const db=requireUserDb(context.env);
    // Never reveal history of an unpublished or archived work.
    const work=await db.prepare("SELECT id FROM catalog_works WHERE id=? AND status='published'").bind(id).first();
    if(!work)return reply({error:'공개 작품이 없습니다.'},404);
    const rows=await db.prepare(`SELECT action,details_json,created_at FROM catalog_audit
      WHERE work_id=? AND action IN ('reader_direct_edit','reader_direct_create','proposal_approved','update','update_source','create','create_source','admin_restore')
      ORDER BY created_at DESC,id DESC LIMIT 20`).bind(id).all();
    const items=(rows.results||[]).map(row=>{
      let details={};try{details=JSON.parse(row.details_json||'{}')||{};}catch{}
      const label=row.action==='reader_direct_edit' ? (labels[details.operation]||'작품 정보 수정'):
        row.action==='reader_direct_create'?'도감 작품 등록':
        row.action==='proposal_approved'?'정보 제안 반영':
        row.action==='admin_restore'?'관리자 정보 복원':
        row.action==='create'||row.action==='create_source'?'관리자 작품 등록':'관리자 작품 정보 변경';
      // Keep personal identifiers, free-text before/after, tokens and URLs server-side.
      return {label,created_at:Number(row.created_at)||0};
    });
    return reply({items});
  }catch(error){
    if(/no such table/i.test(String(error?.message||'')))return reply({items:[]});
    return reply({error:'수정 이력을 불러오지 못했습니다.'},500);
  }
}
