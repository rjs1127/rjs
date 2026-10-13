// v10.51: standalone admin UI for encyclopedia. Existing admin app owns tab switching.
(() => {
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const form=$('catalogWorkForm'); if(!form) return;
  let selected=null, works=[], links=[], busy=false;
  const fields=['title','author','original_title','country','completion','genres','tags','synopsis','subcouple','subcouple_note','recommendation','warnings'];
  const setMessage=(text,error=false)=>{const el=$('catalogMessage');el.hidden=!text;el.textContent=text;el.style.color=error?'var(--sy-danger)':'';};
  async function call(body,query=''){
    const response=await fetch('/api/admin/work-catalog'+query,{method:body?'POST':'GET',credentials:'same-origin',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>({}));
    if(response.status===401){location.replace('/admin');throw Error('관리자 로그인이 필요합니다.');}
    if(!response.ok)throw Error(data.error||'요청에 실패했습니다.');
    return data;
  }
  function pick(id){
    selected=works.find(w=>w.id===id)||null;
    form.reset();
    if(selected){
      for(const field of fields){ const element=form.elements.namedItem(field); if(!element)continue;
        element.value=['genres','tags'].includes(field)?(selected[field]||[]).join(', '):(selected[field]??''); }
    }
    $('catalogEditorTitle').textContent=selected?`작품 수정 · ${selected.title}`:'새 작품 등록';
    $('catalogSave').textContent=selected?'작품 정보 저장':'작품 저장 (비공개 초안)';
    $('catalogSelectedControls').hidden=!selected;
    if(selected){$('catalogStatus').value=selected.status;renderLinks();}
    document.querySelectorAll('#catalogWorkList button').forEach(b=>b.classList.toggle('is-selected',b.dataset.id===id));
  }
  function renderLinks(){
    const el=$('catalogLinks');
    const own=links.filter(l=>l.work_id===selected?.id);
    el.innerHTML=own.length?own.map(l=>`<div class="catalog-admin-record"><span>${esc(l.source_type)} · <code>${esc(l.source_id)}</code></span><div class="catalog-admin-record-actions"><button type="button" data-unlink="${esc(l.source_type)}" data-source-id="${esc(l.source_id)}">연결 해제</button></div></div>`).join(''):'<p class="muted">연결된 콘텐츠가 없습니다.</p>';
  }
  function renderWorks(data){
    works=data.works||[]; links=data.links||[];
    $('catalogCounts').textContent=`(${works.length}건 표시)`;
    $('catalogWorkList').innerHTML=works.length?works.map(w=>`<button type="button" data-id="${esc(w.id)}" class="${w.id===selected?.id?'is-selected':''}"><span><strong>${esc(w.title)}</strong><br><small>${esc(w.author||'작가 미등록')} · ${esc({published:'공개',draft:'초안',archived:'보관'}[w.status])}</small></span><span aria-hidden="true">›</span></button>`).join(''):'<p class="muted">등록된 작품이 없습니다.</p>';
    $('catalogProposalCount').textContent=`(${(data.proposals||[]).length}건 대기)`;
    $('catalogProposalList').innerHTML=(data.proposals||[]).length?data.proposals.map(p=>{
      const f=p.payload||{};
      return `<article class="catalog-admin-record"><strong>${esc(p.kind==='create'?'신규 등록 제안':'기존 작품 수정 제안')} · ${esc(f.title)}</strong><small>제안 ID ${esc(p.id)} · ${new Date(p.created_at).toLocaleString('ko-KR')}</small><pre>${esc([p.work_id&&'기존 도감 ID: '+p.work_id,f.author&&'작가: '+f.author,f.original_title&&'원제: '+f.original_title,f.country&&'국가: '+f.country,f.completion&&'연재 상태: '+f.completion,f.genre_json&&'장르: '+JSON.parse(f.genre_json).join(', '),f.tags_json&&'키워드: '+JSON.parse(f.tags_json).join(', '),f.synopsis&&'줄거리: '+f.synopsis,f.subcouple&&'서브커플: '+f.subcouple,f.subcouple_note&&'서브커플 설명: '+f.subcouple_note,f.recommendation&&'추천: '+f.recommendation,f.warnings&&'주의 요소: '+f.warnings].filter(Boolean).join('\n'))}</pre><div class="catalog-admin-record-actions"><button type="button" data-review="approved" data-id="${esc(p.id)}">승인</button><button type="button" data-review="rejected" data-id="${esc(p.id)}">반려</button></div></article>`;
    }).join(''):'<p class="muted">현재 검토 대기 중인 제안이 없습니다.</p>';
    if(selected){const id=selected.id;pick(id);if(!selected)pick(null);} else pick(null);
    if(data.limited)setMessage('최대 100건만 표시합니다. 검색 조건을 좁혀 주세요.');
  }
  async function refresh(){const q=new URLSearchParams({q:$('catalogSearch').value.trim(),status:$('catalogFilter').value});setMessage('도감 관리 데이터를 불러오는 중…');try{renderWorks(await call(null,'?'+q));setMessage('');}catch(e){setMessage(e.message,true);}}
  async function mutate(payload,success){if(busy)return;busy=true;setMessage('저장 중…');try{await call(payload);await refresh();setMessage(success||'저장했습니다.');}catch(e){setMessage(e.message,true);}finally{busy=false;}}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const work={};for(const field of fields){const el=form.elements.namedItem(field);work[field]=['genres','tags'].includes(field)?el.value.split(',').map(s=>s.trim()).filter(Boolean):el.value;}
    const id=selected?.id;
    await mutate(id?{action:'update',id,work}:{action:'create',work},'작품을 저장했습니다.');
    if(!id){const matching=works.find(w=>w.title===work.title&&w.author===work.author);if(matching)pick(matching.id);}
  });
  $('catalogWorkList').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)pick(b.dataset.id);});
  $('catalogNewWork').addEventListener('click',()=>pick(null));
  $('catalogRefresh').addEventListener('click',refresh);
  $('catalogSearchButton').addEventListener('click',refresh);
  $('catalogSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();refresh();}});
  $('catalogFilter').addEventListener('change',refresh);
  $('catalogStatusSave').addEventListener('click',async()=>{
    if(!selected)return;const status=$('catalogStatus').value;
    if(status==='published'&&!confirm('이 작품 정보를 공개 조회 API에 게시할까요?'))return;
    await mutate({action:'status',id:selected.id,status},'공개 상태를 변경했습니다.');
  });
  $('catalogLink').addEventListener('click',async()=>{
    if(!selected)return;
    const source_type=$('catalogSourceType').value,source_id=$('catalogSourceId').value.trim();
    if(!source_id){setMessage('원본 ID를 입력해 주세요.',true);return;}
    await mutate({action:'link',id:selected.id,source_type,source_id},'원본 콘텐츠를 연결했습니다.');
  });
  $('catalogLinks').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-unlink]');if(!b||!confirm('이 작품과 원본의 연결만 해제할까요?'))return;
    await mutate({action:'unlink',source_type:b.dataset.unlink,source_id:b.dataset.sourceId},'연결을 해제했습니다.');
  });
  $('catalogProposalList').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-review]');if(!b)return;
    const verdict=b.dataset.review;
    if(!confirm(verdict==='approved'?'이 정보 제안을 승인할까요? 신규 작품은 비공개 초안으로 만들어집니다.':'이 정보 제안을 반려할까요?'))return;
    await mutate({action:'review',id:b.dataset.id,verdict},'정보 제안을 처리했습니다.');
  });
  let initialized=false;
  window.addEventListener('admin:tab',e=>{if(e.detail?.name==='work-catalog'){initialized=true;refresh();}});
  document.querySelector('[data-tab-target="work-catalog"]')?.addEventListener('click',()=>{if(!initialized){initialized=true;refresh();}});
  if(document.querySelector('[data-tab-panel="work-catalog"]:not([hidden])')){initialized=true;refresh();}
})();
