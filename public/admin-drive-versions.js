(() => {
'use strict';
const api='/api/admin/drive-source-versions';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const request=async(url,options)=>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});const data=await response.json();if(!response.ok||data.error)throw Error(data.error||`HTTP ${response.status}`);return data;};
let preview=null;
async function refresh(){
 const box=$('driveVersionsList');if(!box)return;
 try{const data=await request(api);box.innerHTML=(data.items||[]).map(x=>`<div class="drive-version-entry"><strong>${esc(x.title||'등록 작품')}</strong> <span>${esc(x.author||'')}</span><div class="drive-version-id">기존 ${esc(x.old_source_id)} → 현재 ${esc(x.current_source_id)}</div><small>문장 위치: ${esc(x.position_status)} · ${esc(x.reason)}</small> <button type="button" data-version-revoke="${esc(x.old_source_id)}" data-current="${esc(x.current_source_id)}">연결 해제</button></div>`).join('')||'<p class="muted">아직 등록된 교체 이력이 없습니다.</p>';
 }catch(e){box.textContent=e.message;}
}
function say(msg){$('driveVersionsMessage').textContent=msg;}
async function runPreview(){
 preview=null;$('driveVersionsRegister').disabled=true;
 const old=$('driveOldId').value.trim(),current=$('driveNewId').value.trim();
 try {const d=await request(`${api}?old_id=${encodeURIComponent(old)}&new_id=${encodeURIComponent(current)}`);preview=d.preview;
 const p=preview;$('driveVersionsPreview').innerHTML=`<p><strong>대상 도감:</strong> ${esc(p.current_title)} / ${esc(p.current_author)} (${esc(p.current_status)})</p><p><strong>현재 파일:</strong> ${esc(p.drive_filename||p.drive_title)}</p><p>공개 문장 묶음: ${p.old_quote_groups.map(g=>`${esc(g.title)} / ${esc(g.author)} ${Number(g.count)}개`).join(', ')||'없음'} · 개인 문장 ${p.old_private_count}개</p><p class="muted">두 파일의 본문·문장 위치는 자동으로 비교하지 않습니다. 제목이 같아도 실제 같은 작품인지 확인하세요. 문장 위치는 등록 후에도 확인 필요로 남습니다.</p>${p.can_register?'':'<p>기존 이력 또는 순환 연결 가능성 때문에 등록할 수 없습니다.</p>'}`;
 $('driveVersionsRegister').disabled=!p.can_register;say('검토할 원본 정보를 불러왔습니다.');
 }catch(e){$('driveVersionsPreview').textContent='';say(e.message);}
}
async function register(){if(!preview)return;
 if($('driveConfirmedTitle').value.trim()!==preview.current_title){say('작품 제목을 정확히 입력해야 합니다.');return;}
 const reason=$('driveVersionReason').value.trim();
 if(!reason){say('교체 사유를 입력하세요.');return;}
 if(!window.confirm(`기존 ${preview.old_source_id}\n현재 ${preview.current_source_id}\n\n실제로 같은 작품인지, 과거 문장이 해당 작품의 내용인지 확인했나요?\n기존 문장/링크는 수정하지 않고 조회 별칭만 등록합니다.`))return;
 try{await request(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'register',old_source_id:preview.old_source_id,current_source_id:preview.current_source_id,confirmed_title:preview.current_title,confirmation_text:'동일 작품 확인',reason,confirm:true})});say('연결 관계를 등록했습니다. 작품도감의 문장 목록에서 구버전 문장도 조회됩니다. 문장 위치는 별도로 확인하세요.');preview=null;$('driveVersionsRegister').disabled=true;await refresh();}
 catch(e){say(e.message);}
}
async function revoke(button){const old=button.dataset.versionRevoke,current=button.dataset.current;
 if(!window.confirm(`구버전 연결 ${old}을 해제할까요? 기존 문장 데이터는 삭제되지 않습니다.`))return;
 try{await request(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'revoke',old_source_id:old,current_source_id:current,confirmation_text:'연결 해제'})});say('연결 관계를 해제했습니다.');await refresh();}catch(e){say(e.message);}
}

let discoverItems=[];
async function autoScan(){
 const wrap=$('driveVersionsCandidates');if(!wrap)return;
 wrap.textContent='기존 문장과 현재 드라이브 파일을 비교하는 중…';
 try{
  const res=await request(api+'?mode=discover');discoverItems=res.items||[];
  const visible=discoverItems;
  $('driveVersionsScanSummary').textContent=`확인 필요 ${res.total_groups}그룹 · 현재 Drive 파일 목록 ${res.drive_cache_available?'확인됨':'동기화 필요'}`;
  wrap.innerHTML=visible.map((x,i)=>`<div class="drive-version-entry"><strong>${esc(x.title||'(제목 없음)')}</strong> · ${esc(x.author||'작가 미상')} <small>공개 문장 ${x.quote_count}개</small><div class="drive-version-id">기존 원본: ${esc(x.old_source_id)}</div>${x.already_registered?'<p class="muted">기존 연결 이력이 존재합니다. 현재 연결을 점검하세요.</p>':''}${x.private_differs?'<p class="muted">개인 저장 원본 ID가 다른 문장이 있습니다. 위치 확인 필요</p>':''}<div class="drive-version-suggestions">${x.candidates.map((c,j)=>`<div><strong>${esc(c.title)}</strong> / ${esc(c.author)} · ${esc(c.status)} <small>일치 근거: ${c.score>=130?'제목·작가':c.score>=100?'제목':'부분 제목'} / ID ${esc(c.source_id)}</small> <button type="button" data-version-pick="${i}" data-suggest="${j}" ${x.already_registered?'disabled':''}>후보 검토</button></div>`).join('')||'<p class="muted">추천 후보 없음 — 현재 등록 작품에서 직접 검색해 선택할 수 있습니다.</p>'}</div>${x.already_registered?'':`<button type="button" data-version-manual="${i}">다른 작품 직접 검색</button>`}</div>`).join('')||'<p class="muted">점검 대상이 없습니다.</p>';
 }catch(e){wrap.textContent='자동 점검 실패: '+e.message;}
}
let pickerOld='';
async function searchWorks(){
 const q=$('driveVersionsWorkSearch').value.trim();const box=$('driveVersionsWorkResults');
 if(!q){box.textContent='작품명이나 작가를 입력하세요.';return;}
 try{
  // Read-only catalog audit returns all catalog works, including unpublished works.
  const data=await request('/api/admin/catalog-quote-audit');
  const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
  const term=norm(q);
  const results=(data.works||[]).filter(w=>w.source_type==='drive'&&w.source_id&&(norm(w.title).includes(term)||norm(w.author).includes(term)||String(w.source_id).includes(q))).slice(0,60);
  box.innerHTML=results.map((w,i)=>`<div class="drive-version-entry"><strong>${esc(w.title)}</strong> / ${esc(w.author)} (${esc(w.status)}) <small>${esc(w.source_id)}</small> <button type="button" data-direct-pick="${i}">이 작품 검토</button></div>`).join('')||'<p>해당 검색어로 연결된 도감 작품이 없습니다.</p>';
  box._results=results;
 }catch(e){box.textContent=e.message;}
}
function usePair(oldId,newId){$('driveOldId').value=oldId;$('driveNewId').value=newId;$('driveVersionsPreview').scrollIntoView({behavior:'smooth',block:'center'});runPreview();}

function setup(){const panel=document.querySelector('[data-tab-panel="drive-library"]');if(!panel)return;
 const box=document.createElement('section');box.className='panel drive-version-panel';box.innerHTML=`<div class="panel-head"><div><p class="eyebrow">DRIVE VERSIONS</p><h2>원본 교체·연결 이력</h2><p class="muted">오타 수정 등으로 신규 Drive 파일 ID가 생성된 경우, 과거 문장의 원본 ID를 새 도감 작품과 연결합니다. 구버전 기록과 문장 자체는 변경하지 않습니다.</p></div><button type="button" id="driveVersionsRefresh" class="secondary-admin-button">이력 새로고침</button></div><div class="drive-version-form"><label>구버전 Drive ID<input id="driveOldId" type="text" placeholder="기존 공개 문장의 원본 ID"></label><label>현재 Drive ID<input id="driveNewId" type="text" placeholder="현재 도감에 연결된 Drive ID"></label><button type="button" class="secondary-admin-button" id="driveVersionsCheck">연결 영향 미리보기</button></div><div id="driveVersionsPreview" class="drive-version-preview"></div><div class="drive-version-form"><label>대상 도감 작품명 확인<input id="driveConfirmedTitle" type="text" placeholder="미리보기에서 확인한 작품 제목을 정확히 입력"></label><label>교체 사유<input id="driveVersionReason" type="text" placeholder="오타 수정 후 새 파일 업로드"></label><button id="driveVersionsRegister" type="button" class="primary" disabled>동일 작품으로 등록</button></div><p id="driveVersionsMessage" role="status" class="muted" aria-live="polite"></p><div id="driveVersionsList" class="drive-versions-list"></div>`;
 panel.appendChild(box);
 const discovery=document.createElement('div');discovery.className='drive-version-discovery';discovery.innerHTML=`<h3>원본 ID 자동 비교·연결 후보</h3><p class="muted">기존 공유 문장의 원본 ID와 현재 등록된 Drive 작품을 비교합니다. 후보는 제목·작가 유사도로 추천하며 자동 연결하지 않습니다.</p><button type="button" id="driveVersionsScan">미연결 원본 자동 점검</button> <span id="driveVersionsScanSummary" role="status"></span><div id="driveVersionsCandidates"></div><section id="driveVersionsSearchPanel" hidden><h4>다른 작품 검색</h4><div class="drive-version-form"><input id="driveVersionsWorkSearch" placeholder="제목·작가·원본 ID 검색" type="search"><button type="button" id="driveVersionsWorkSearchButton">검색</button></div><div id="driveVersionsWorkResults"></div></section>`;
 box.insertBefore(discovery,box.querySelector('.drive-version-form'));
 $('driveVersionsScan').addEventListener('click',autoScan);
 $('driveVersionsCandidates').addEventListener('click',e=>{const pick=e.target.closest('[data-version-pick]');if(pick){const x=discoverItems[Number(pick.dataset.versionPick)],c=x?.candidates[Number(pick.dataset.suggest)];if(x&&c)usePair(x.old_source_id,c.source_id);return;}const manual=e.target.closest('[data-version-manual]');if(manual){const x=discoverItems[Number(manual.dataset.versionManual)];if(!x)return;pickerOld=x.old_source_id;$('driveVersionsSearchPanel').hidden=false;$('driveVersionsWorkSearch').value=x.title;$('driveVersionsWorkSearchPanel')?.scrollIntoView();searchWorks();}});
 $('driveVersionsWorkSearchButton').addEventListener('click',searchWorks);
 $('driveVersionsWorkSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchWorks();}});
 $('driveVersionsWorkResults').addEventListener('click',e=>{const b=e.target.closest('[data-direct-pick]');if(!b)return;const w=$('driveVersionsWorkResults')._results?.[Number(b.dataset.directPick)];if(w)usePair(pickerOld,w.source_id);});
 $('driveVersionsCheck').addEventListener('click',runPreview);$('driveVersionsRegister').addEventListener('click',register);$('driveVersionsRefresh').addEventListener('click',refresh);$('driveVersionsList').addEventListener('click',e=>{const b=e.target.closest('[data-version-revoke]');if(b)revoke(b);});refresh();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
