(()=>{'use strict';
const $=id=>document.getElementById(id), fields=['synopsis','genres','tags','recommendation','adult_scene_status','warnings'];
const names={synopsis:'줄거리',genres:'장르',tags:'키워드',recommendation:'추천 대상',adult_scene_status:'성적 묘사 분류',warnings:'주의·호불호 요소'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pin='',items=[],current=null,busy=false;
const say=(s,error=false)=>{$('status').textContent=s;$('status').style.color=error?'#bf4d45':''};
async function api(data){const response=await fetch('/api/guest-catalog-review',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({...data,code:pin})});const obj=await response.json().catch(()=>({}));if(!response.ok)throw Error(obj.error||'요청에 실패했습니다.');return obj;}
const formatted=v=>Array.isArray(v)?v.join(', '):String(v??'');
function stage(i){
 // The server returns last_recheck_merged_at and approved_at, not guest_merged_at.
 // Do not treat an approval older than the last merge as completion.
 if(i.has_incoming)return 'work';
 const merged=Number(i.last_recheck_merged_at||0), approved=Number(i.approved_at||0);
 if(!merged)return 'work';
 return approved>=merged&&approved>0?'hidden':'approve';
}
function stamp(value){const time=Number(value);return time?new Date(time).toLocaleString('ko-KR'):'기록 없음';}
let activeTab='work';
function repaint(){
 const q=$('search').value.trim().toLowerCase();
 const counts={work:0,approve:0};
 for(const i of items){const st=stage(i);if(st!=='hidden')counts[st]++;}
 const shown=items.filter(i=>stage(i)===activeTab&&(!q||`${i.draft.title} ${i.draft.author}`.toLowerCase().includes(q)));
 $('tabWork').textContent=`작업 중 (${counts.work})`;
 $('tabApprove').textContent=`작업 완료 · 승인 대기 (${counts.approve})`;
 for(const tab of ['Work','Approve']){$('tab'+tab).setAttribute('aria-selected',String(activeTab===(tab==='Work'?'work':'approve')));}
 $('counter').textContent=`내 담당 ${items.length}편 · 작업 중 ${counts.work}편 · 승인 대기 ${counts.approve}편 · 현재 ${shown.length}편`;
 $('listing').innerHTML=shown.map(i=>`<div class="row"><strong>${esc(i.draft.title)}</strong> <span class="muted">${esc(i.draft.author)}</span><div class="muted">${activeTab==='approve'?'병합 완료 · 공개 승인 대기 · '+esc(stamp(i.last_recheck_merged_at)):i.has_incoming?'재검수 결과 병합 대기':'병합할 새 재검수본 없음'}</div><button class="secondary" data-type="${esc(i.source_type)}" data-id="${esc(i.source_id)}">${activeTab==='approve'?'공개 도감 승인':'검수하기'}</button></div>`).join('')||'<p>해당 단계에 표시할 작품이 없어요.</p>';
}
async function refresh(){const res=await api({op:'list'});items=res.items||[];repaint();say('목록을 새로 불러왔습니다.');}
async function open(type,id){const d=await api({op:'detail',source_type:type,source_id:id});current=d;
const item=d.item,old=item.draft,proposal=d.incoming?.draft;
$('editor').hidden=false;
$('editor').innerHTML=`<h2>${esc(old.title)} <small class="muted">${esc(old.author)}</small></h2><p class="muted">초안 버전 ${item.sheet_revision} · ${proposal?'새 재검수본 병합 대기':'병합 대기 없음'}</p>${stage(item)==='approve'?`<div class="field"><strong>재검수 병합 완료 · 승인 대기</strong><p class="muted">병합 처리: ${esc(stamp(item.last_recheck_merged_at))}</p><p class="muted">현재 공개 승인 내역: ${esc(Object.keys(item.applied||{}).filter(f=>fields.includes(f)).map(f=>names[f]).join(', ')||'승인된 항목 없음')}</p><p class="muted">병합 완료와 공개 승인 완료는 서로 다릅니다.</p></div>`:''}${fields.map(f=>`<div class="field"><label>${names[f]}</label><div class="cols"><div><span class="muted">기존 초안</span><div class="value">${esc(formatted(old[f]))||'(없음)'}</div></div><div><span class="muted">새 재검수 결과</span><div class="value">${proposal?esc(formatted(proposal[f]))||'(없음)':'(없음)'}</div></div></div>${proposal?`<label><input type="checkbox" data-pick="${f}" ${f==='synopsis'?'':'checked'}> 새 재검수 값 선택 (줄거리는 기본 보류)</label>`:''}<label for="edit-${f}" class="muted">병합할 최종 내용</label><textarea id="edit-${f}" data-field="${f}">${esc(formatted(proposal&&f!=='synopsis' ? proposal[f] : old[f]))}</textarea>${f==='synopsis'?`<div class="synopsis-rework"><label><input type="checkbox" id="needSynopsis" ${d.rework&&d.rework.state!=='done'?'checked':''}> 줄거리 보완 필요</label><textarea id="why" placeholder="보완 메모 (선택)">${esc(d.rework?.reason||'')}</textarea><button class="secondary" id="saveSynopsis" type="button">보완 표시 저장</button></div>`:''}</div>`).join('')}
<div class="bar">${proposal?'<button id="merge">선택 내용 병합(비공개)</button>':''}<button id="save" class="secondary">편집한 초안 저장</button></div><div class="field"><strong>공개 도감에 승인·반영</strong><p class="muted">승인할 항목을 확인하세요. 기존에 승인한 내용과 현재 초안이 같은 항목은 기본 선택하지 않습니다. 신규 작품이면 공개 등록 여부도 확인합니다.</p>${fields.map(f=>`<label><input type="checkbox" data-approve="${f}"> ${names[f]} 승인</label>`).join('')}<label><input type="checkbox" id="publish"> 신규 작품 공개 등록 또는 비공개 작품 공개 전환</label><button id="approve">체크한 항목 도감에 승인·반영</button></div><button id="close" class="secondary">목록으로</button>`;
if(!proposal){document.querySelectorAll('[data-approve]').forEach(el=>{const f=el.dataset.approve;const prior=item.applied?.[f]?.source;el.checked=(prior===undefined||JSON.stringify(prior)!==JSON.stringify(old[f]))&&!(f==='synopsis'&&d.rework&&d.rework.state!=='done');});}
if(proposal)document.querySelectorAll('[data-pick]').forEach(ch=>ch.addEventListener('change',()=>{const f=ch.dataset.pick;$('edit-'+f).value=formatted(ch.checked?proposal[f]:old[f]);}));
$('editor').scrollIntoView({behavior:'smooth'});
}
function draft(){const d={...current.item.draft};for(const f of fields){const val=$('edit-'+f).value;d[f]=['genres','tags'].includes(f)?val.split(',').map(s=>s.trim()).filter(Boolean):val;}return d;}
async function action(a,payload){
 if(busy)return;
 busy=true;
 try{
  const i=current.item;
  const picked=a==='merge_incoming'?[...document.querySelectorAll('[data-pick]:checked')].map(el=>el.dataset.pick):[];
  await api({op:'action',action:a,source_type:i.source_type,source_id:i.source_id,...payload});
  await refresh();
  if(a==='merge_incoming'){
   // Merge and approval are distinct steps; close without losing the work item.
   $('editor').hidden=true;current=null;activeTab='approve';repaint();
   say(`병합 완료 · 선택 항목 ${picked.map(f=>names[f]).join(', ')||'수동 편집'} · 승인 대기 탭에서 공개 승인하세요.`);
  }else if(a==='approve'){
   $('editor').hidden=true;current=null;activeTab='approve';repaint();
   say('공개 도감 승인 완료. 승인된 작품은 친구의 작업 목록에서 숨겨집니다.');
  }else{
   await open(i.source_type,i.source_id);say('저장했습니다.');
  }
 }catch(e){say(e.message,true);}finally{busy=false;}
}
$('entry').addEventListener('submit',async e=>{e.preventDefault();pin=$('pin').value.trim();try{await api({op:'login'});$('pin').value='';$('login').hidden=true;$('review').style.display='block';await refresh();}catch(err){pin='';say(err.message,true);}});
$('logout').onclick=()=>{pin='';current=null;$('review').style.display='none';$('login').hidden=false;say('검수 화면에서 나왔습니다.');};$('refresh').onclick=()=>refresh().catch(e=>say(e.message,true));$('search').oninput=repaint;
$('tabWork').onclick=()=>{activeTab='work';repaint();};$('tabApprove').onclick=()=>{activeTab='approve';repaint();};
$('listing').onclick=e=>{const btn=e.target.closest('[data-id]');if(btn)open(btn.dataset.type,btn.dataset.id).catch(err=>say(err.message,true));};
$('editor').onclick=e=>{const b=e.target.closest('button');if(!b||!current)return;const i=current.item;switch(b.id){case 'merge':if(confirm('선택한 내용으로 새 재검수본을 병합할까요?'))action('merge_incoming',{sheet_revision:i.sheet_revision,draft:draft()});break;case 'save':if(confirm('현재 편집 내용을 비공개 초안에 저장할까요?'))action('save_draft',{sheet_revision:i.sheet_revision,draft:draft()});break;case 'approve':{const fs=[...document.querySelectorAll('[data-approve]:checked')].map(x=>x.dataset.approve);if(!fs.length)return say('승인할 항목을 선택해 주세요.',true);if(current.incoming)return say('새 재검수 비교 대기를 먼저 병합해 주세요.',true);if(confirm(`${fs.map(f=>names[f]).join(', ')} 항목을 공개 도감에 반영할까요?`))action('approve',{sheet_revision:i.sheet_revision,fields:fs,publish:$('publish').checked});break;}case 'saveSynopsis':action('rework_mark',{state:$('needSynopsis').checked?'needed':'clear',reason:$('why').value});break;case 'close':$('editor').hidden=true;current=null;break;}};
})();
