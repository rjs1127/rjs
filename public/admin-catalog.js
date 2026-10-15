// v10.53: source-linked catalogue editor with keyword chips and independent recommendation lines.
// Original source data is read only; all writes use the dedicated catalogue D1 tables.
(() => {
  const $ = id => document.getElementById(id);
  const form = $('catalogWorkForm');
  if (!form) return;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields = ['title','author','original_title','country','completion','genres','tags','synopsis','subcouple','subcouple_note','recommendation','warnings'];
  let sources = [], works = [], links = [], proposals = [], current = null, opener = null;
  let sourceErrors = [], shown = 50, busy = false, loaded = false, loadId = 0, catalogLoadSeq = 0, dialogId = 0;
  let tagTokens = [], recommendationRows = [];
  const cleanToken = value => String(value||'').normalize('NFKC').trim().replace(/^#+\s*/, '').trim();
  // Audit entries are fetched on demand only; no history requests on normal tab loads.
  const restoreFooter=form.querySelector('.catalog-dialog-footer');
  const restoreToggle=document.createElement('button');
  restoreToggle.id='catalogRestoreToggle';restoreToggle.type='button';
  restoreToggle.className='secondary-admin-button catalog-restore-toggle';
  restoreToggle.textContent='수정 이력 · 복원';restoreToggle.hidden=true;
  const restorePanel=document.createElement('section');
  restorePanel.id='catalogRestorePanel';restorePanel.className='catalog-restore-panel catalog-span';
  restorePanel.hidden=true;restorePanel.setAttribute('aria-label','작품 정보 수정 이력 및 복원');
  restoreFooter?.before(restorePanel);restoreFooter?.prepend(restoreToggle);
  const restoreLabels={title:'작품명',author:'작가',original_title:'원제',country:'국가',completion:'연재 상태',
    genre_json:'장르',tags_json:'키워드',synopsis:'줄거리',subcouple:'서브커플',
    subcouple_note:'서브커플 설명',recommendation:'추천 문구',warnings:'주의·호불호 요소'};
  const restorePreview=(value,column)=>{
    let text=String(value??'');
    if(column==='genre_json'||column==='tags_json'){
      try{text=JSON.parse(text).join(', ');}catch(_){}
    }
    return text.length>180?`${text.slice(0,180)}…`:text||'(비어 있음)';
  };
  let historyLoadToken=0;
  function resetRestorePanel(work){
    ++historyLoadToken;
    restorePanel.hidden=true;restorePanel.replaceChildren();
    restoreToggle.hidden=!work;restoreToggle.textContent='수정 이력 · 복원';
  }
  async function loadRestorableHistory(force=false){
    if(!current?.work||(busy&&!force))return;
    const id=current.work.id, ticket=++historyLoadToken;
    restorePanel.hidden=false;
    restorePanel.textContent='수정 이력을 불러오는 중…';
    try{
      const info=await api(null,`?history_id=${encodeURIComponent(id)}`);
      if(ticket!==historyLoadToken || current?.work?.id!==id)return;
      restorePanel.innerHTML=`<div class="catalog-restore-head"><strong>변경 전 정보 복원</strong><small>최근 ${info.entries.length}건 · 필요할 때만 조회</small></div>
        <p class="catalog-restore-note">이용자가 수정한 항목을 이전 값으로 되돌릴 수 있어요. 복원도 변경 이력에 남습니다. 과거 관리자 전체 저장처럼 변경 전 내용이 없던 이력은 복원할 수 없어요.</p>
        ${info.entries.length?info.entries.map(item=>`<article class="catalog-restore-item">
          <div class="catalog-restore-item-top"><strong>${escapeHtml(restoreLabels[item.column]||item.column)}</strong>
          <small>${new Date(item.created_at).toLocaleString('ko-KR')} · ${item.action==='admin_restore'?'관리자 복원':'이용자 수정'}</small></div>
          <div class="catalog-restore-comparison"><div><span>이전 값 (복원 대상)</span><p>${escapeHtml(restorePreview(item.before,item.column))}</p></div>
          <div><span>수정 당시 값</span><p>${escapeHtml(restorePreview(item.after,item.column))}</p></div></div>
          ${item.extra_column?`<p class="catalog-restore-extra">${escapeHtml(restoreLabels[item.extra_column])}도 함께 복원됩니다.</p>`:''}
          <button type="button" data-catalog-restore="${item.id}">이전 값으로 복원</button>
        </article>`).join(''):'<p class="catalog-restore-note">복원 가능한 이용자 수정 기록이 아직 없어요.</p>'}`;
    }catch(error){if(ticket===historyLoadToken)restorePanel.textContent=error.message;}
  }
  restoreToggle.addEventListener('click',()=>{
    if(restorePanel.hidden){restoreToggle.textContent='이력 닫기';void loadRestorableHistory();}
    else {++historyLoadToken;restorePanel.hidden=true;restoreToggle.textContent='수정 이력 · 복원';}
  });
  restorePanel.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-catalog-restore]');
    if(!button||!current?.work||busy)return;
    const eventId=Number(button.dataset.catalogRestore);
    if(!Number.isSafeInteger(eventId)||eventId<1)return;
    const source=current.source,work=current.work;
    if(!confirm('선택한 변경의 이전 값을 현재 작품 정보에 적용할까요?\n복원 전 저장하지 않은 입력은 사라집니다.\n복원 내역도 다시 기록됩니다.'))return;
    busy=true;restoreToggle.disabled=true;$('catalogSave').disabled=true;$('catalogDelete').disabled=true;
    try{
      const result=await api({action:'restore_field',id:work.id,audit_id:eventId,expected_revision:work.revision});
      if(current?.work?.id!==work.id)return;
      current.work=result.work;fill(result.work,source);
      message('이전 정보로 복원했습니다. 이력에서도 다시 확인할 수 있어요.',false,true);
      await loadCatalog();
      if(current?.work?.id===work.id){await loadRestorableHistory(true);restoreToggle.textContent='이력 닫기';}
    }catch(error){message(error.message,true,true);}
    finally{busy=false;restoreToggle.disabled=false;$('catalogSave').disabled=false;$('catalogDelete').disabled=false;}
  });
  function renderTags(){
    const list=$('catalogTagList');list.replaceChildren();
    tagTokens.forEach((tag,i)=>{
      const pill=document.createElement('span');pill.className='catalog-tag-chip';
      const text=document.createElement('span');text.textContent=`#${tag}`;
      const del=document.createElement('button');del.type='button';del.dataset.removeTag=String(i);del.textContent='×';del.setAttribute('aria-label',`키워드 ${tag} 제거`);
      pill.append(text,del);list.append(pill);
    });
    form.elements.namedItem('tags').value=tagTokens.join(', ');
  }
  function addTags(value){
    const raw=String(value||'').trim();if(!raw)return true;
    const parts=raw.includes(',')?raw.split(','):
      /^#[^\s#]+(?:\s+#[^\s#]+)+$/.test(raw)?raw.match(/#[^\s#]+/g):[raw];
    const next=[...tagTokens];
    for(const part of parts){
      const token=cleanToken(part);if(!token)continue;
      if(token.length>30){message('키워드는 각각 30자 이내로 입력해 주세요.',true,true);return false;}
      if(!next.includes(token))next.push(token);
      if(next.length>20){message('키워드는 최대 20개까지 등록할 수 있습니다.',true,true);return false;}
    }
    tagTokens=next;renderTags();$('catalogTagEntry').value='';message('',false,true);return true;
  }
  function recommendationValue(){return recommendationRows.map(v=>v.trim()).filter(Boolean).join('\n\n');}
  function refreshRecommendationCount(){
    const len=recommendationValue().length;
    $('catalogRecommendationCount').textContent=`${len.toLocaleString('ko-KR')} / 1,500자`;
    $('catalogRecommendationCount').classList.toggle('is-over-limit',len>1500);
    form.elements.namedItem('recommendation').value=recommendationValue();
  }
  function renderRecommendations(){
    const list=$('catalogRecommendationList');list.replaceChildren();
    recommendationRows.forEach((value,i)=>{
      const row=document.createElement('div');row.className='catalog-recommendation-row';
      const label=document.createElement('label');label.textContent=`추천 ${i+1}`;
      const textarea=document.createElement('textarea');textarea.rows=2;textarea.maxLength=1500;textarea.dataset.recommendationIndex=String(i);textarea.value=value;
      const del=document.createElement('button');del.type='button';del.className='catalog-recommendation-remove';del.dataset.removeRecommendation=String(i);del.textContent='삭제';del.setAttribute('aria-label',`추천 ${i+1} 삭제`);
      label.append(textarea);row.append(label,del);list.append(row);
    });
    refreshRecommendationCount();
  }

  function message(text, error=false, inDialog=false) {
    const el=$(inDialog?'catalogDialogMessage':'catalogMessage');
    if(!el) return;
    el.hidden=!text; el.textContent=text; el.style.color=error?'var(--sy-danger)':'';
  }
  async function api(payload, query='') {
    const r=await fetch('/api/admin/work-catalog'+query,{
      method:payload?'POST':'GET',credentials:'same-origin',
      headers:{'content-type':'application/json'},
      ...(payload?{body:JSON.stringify(payload)}:{}),
    });
    const data=await r.json().catch(()=>({}));
    if(r.status===401){ location.replace('/admin'); throw Error('관리자 로그인이 필요합니다.'); }
    if(!r.ok) throw Error(data.error||'도감 요청에 실패했습니다.');
    return data;
  }
  async function sourceApi(path){
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(response.status===401){location.replace('/admin');throw Error('관리자 로그인이 필요합니다.');}
    if(!response.ok) throw Error(data.error||'원본 목록 요청 실패');
    return data.items||[];
  }
  const key=(type,id)=>`${type}\u0000${id}`;
  const labelType=t=>t==='drive'?'TXT · Drive':'POSTYPE';
  const statuses={draft:'비공개 초안',published:'공개',archived:'보관'};
  // The source status is read live; never store a copy unless manually chosen.
  const completionPicker=form.elements.namedItem('completion');
  if(completionPicker){
    const auto=document.createElement('option');auto.value='auto';auto.textContent='자동 (원본 기준)';
    completionPicker.prepend(auto);
    const unknown=completionPicker.querySelector('option[value="unknown"]');
    if(unknown){unknown.value='manual_unknown';unknown.textContent='미확인 (수동 지정)';}
  }
  const sourceCompletion=source=>({완결:'completed',연재:'ongoing',연재중:'ongoing',미완:'incomplete'})[String(source?.status||'').trim()]||'unknown';
  function linkedMap(){return new Map(links.map(l=>[key(l.source_type,l.source_id),l.work_id]));}
  function workMap(){return new Map(works.map(w=>[w.id,w]));}
  function renderStandalone(){
    const ids=new Set(links.map(l=>l.work_id));
    const orphans=works.filter(w=>w.has_source_links===undefined?!ids.has(w.id):!w.has_source_links);
    $('catalogStandaloneCount').textContent=`(${orphans.length}건)`;
    $('catalogStandaloneList').innerHTML=orphans.length?orphans.map(w=>
      `<button type="button" data-work-id="${escapeHtml(w.id)}"><span><strong>${escapeHtml(w.title)}</strong><small>${escapeHtml(w.author||'작가 미등록')} · ${statuses[w.status]||'미확인'}</small></span><span aria-hidden="true">›</span></button>`
    ).join(''):'<p class="muted">원본에 연결되지 않은 작품이 없습니다.</p>';
  }
  function renderSourceList(){
    const q=$('catalogSearch').value.trim().normalize('NFKC').toLocaleLowerCase();
    const filter=$('catalogSourceFilter').value, state=$('catalogFilter').value;
    const lm=linkedMap(), wm=workMap(), statusBySource=new Map(links.map(l=>[key(l.source_type,l.source_id),l.work_status]));
    const filtered=sources.filter(s=>{
      if(filter!=='all' && s.type!==filter) return false;
      if(q && !`${s.title} ${s.author} ${s.id} ${s.combination||''}`.normalize('NFKC').toLocaleLowerCase().includes(q)) return false;
      const id=lm.get(key(s.type,s.id)); const w=wm.get(id);
      if(state==='none') return !id;
      if(state==='linked') return !!id;
      if(state==='published'||state==='draft') return !!id && (w?.status||statusBySource.get(key(s.type,s.id)))===state;
      return true;
    });
    $('catalogCounts').textContent=`(${filtered.length.toLocaleString('ko-KR')}건 / 원본 ${sources.length.toLocaleString('ko-KR')}건)`;
    $('catalogWorkList').innerHTML=filtered.length?filtered.slice(0,shown).map(s=>{
      const id=lm.get(key(s.type,s.id)); const w=wm.get(id);
      const status=id?(statuses[w?.status||statusBySource.get(key(s.type,s.id))]||'정보 등록됨'):'정보 미등록';
      return `<button type="button" data-type="${s.type}" data-source-id="${escapeHtml(s.id)}">
        <span class="catalog-source-main"><strong>${escapeHtml(s.title||s.id)}</strong><small>${escapeHtml(s.author||'작가 미등록')} · ${labelType(s.type)} · ${escapeHtml(s.id)}</small></span>
        <span class="catalog-source-status ${id?'is-linked':''}">${status}</span><span aria-hidden="true">›</span>
      </button>`;
    }).join(''):'<p class="muted">해당하는 등록 작품이 없습니다.</p>';
    $('catalogMore').hidden=filtered.length<=shown;
  }
  function renderProposals(){
    $('catalogProposalCount').textContent=`(${proposals.length}건 대기)`;
    const wm=workMap();
    const names={
      tag_add:'키워드 추가',tag_remove:'키워드 제거',genre_add:'장르 추가',genre_remove:'장르 제거',
      completion_set:'연재 상태 변경',subcouple_set:'서브커플 상태 변경',
      subcouple_note_set:'서브커플 설명 변경',synopsis_set:'줄거리 변경',
      title_set:'제목 변경',author_set:'작가 변경',original_title_set:'원제 변경',
      warnings_set:'주의 요소 변경',recommendation_add:'추천 대상 추가',
      recommendation_remove:'추천 대상 제거',recommendation_edit:'추천 대상 수정'
    };
    proposals.forEach(p=>{
      if(p.payload?.format===2 && !names[p.payload.operation])p.unsupported=true;
    });
    $('catalogProposalList').innerHTML=proposals.length?proposals.map(p=>{
      const f=p.payload||{},v2=f.format===2,work=wm.get(p.work_id);
      let details='',title='';
      if(v2){
        title=`${work?.title||'작품 ID '+p.work_id} · ${names[f.operation]||'알 수 없는 항목'}`;
        const before=Array.isArray(f.before)?f.before.map(x=>'#'+x).join(', ')||'정보 없음':String(f.before||'미등록');
        const after=f.operation?.endsWith('_remove')?'제거 요청':String(f.change?.value||'정보 삭제 요청');
        details=`현재: ${before}\n제안: ${after}${f.reason?'\n사유: '+f.reason:''}\n기준 버전: ${f.base_revision}`;
        if(work && work.revision!==f.base_revision) details+='\n⚠ 기준 버전 이후 작품 정보 변경 · 재검토 필요';
      }else{
        let genres=[],tags=[];
        try{genres=JSON.parse(f.genre_json||'[]'); tags=JSON.parse(f.tags_json||'[]');}catch{}
        title=`${p.kind==='create'?'신규 작품':'작품 수정'} · ${f.title||work?.title||'제목 미등록'}`;
        details=[p.work_id&&`대상 작품 ID: ${p.work_id}`,f.author&&`작가: ${f.author}`,
          genres.length&&`장르: ${genres.join(', ')}`,tags.length&&`키워드: ${tags.join(', ')}`,
          f.synopsis&&`줄거리: ${f.synopsis}`,f.subcouple_note&&`서브커플: ${f.subcouple_note}`,
          f.recommendation&&`추천: ${f.recommendation}`].filter(Boolean).join('\n');
        if(p.kind==='edit') details+='\n⚠ 이전 방식의 작품 전체 변경 제안 · 승인 전 모든 항목 확인 필요';
      }
      return `<article class="catalog-admin-record"><strong>${escapeHtml(title)}</strong>
        <small>${new Date(p.created_at).toLocaleString('ko-KR')} · ${v2?'항목별 제안':'기존 전체 제안'}</small>
        <pre>${escapeHtml(details)}</pre>
        <div class="catalog-admin-record-actions"><button type="button" data-review="approved" data-id="${escapeHtml(p.id)}" ${p.unsupported?'disabled':''}>승인</button><button type="button" data-review="rejected" data-id="${escapeHtml(p.id)}">반려</button></div></article>`;
    }).join(''):'<p class="muted">현재 검토 대기 중인 제안이 없습니다.</p>';
  }
  async function loadCatalog(){
    const ticket=++catalogLoadSeq, activeLoadId=loadId;
    // The archive UI needs link status for its source list, not every DB link.
    // All requested source keys are checked before rendering linked/none filters.
    const result=await api(null,'?status=all&source_lookups=1');
    const chunks=[];
    for(let i=0;i<sources.length;i+=800)
      chunks.push(sources.slice(i,i+800).map(s=>({source_type:s.type,source_id:s.id})));
    const matched=[];
    // Bound concurrent administrator lookups and keep the current list intact
    // until every requested chunk has succeeded.
    for(let i=0;i<chunks.length;i+=3){
      const pages=await Promise.all(chunks.slice(i,i+3).map(s=>api({action:'lookup_sources',sources:s})));
      for(const page of pages)matched.push(...(page.links||[]));
    }
    if(ticket!==catalogLoadSeq||activeLoadId!==loadId)return;
    works=result.works||[]; links=matched; proposals=result.proposals||[];
    renderSourceList(); renderStandalone(); renderProposals();
    if(result.limited) message('기존 도감 목록은 최대 100건까지 요약 표시됩니다. 등록된 원본을 누르면 연결된 실제 도감 정보를 별도로 확인합니다.');
  }
  async function reload(refreshSources=false){
    if(busy)return;
    const callId=++loadId;
    message('도감 및 원본 등록 목록을 불러오는 중…');
    try{
      if(refreshSources||!loaded){
        const results=await Promise.allSettled([sourceApi('/api/admin/drive-items'),sourceApi('/api/admin/postype-list')]);
        if(callId!==loadId)return;
        sourceErrors=[]; const next=[];
        results.forEach((r,i)=>{
          const type=i===0?'drive':'postype';
          if(r.status==='rejected'){sourceErrors.push(`${labelType(type)}: ${r.reason?.message||'불러오기 실패'}`);return;}
          for(const x of r.value){
            const id=String(x.id||'').trim();if(!id)continue;
            next.push({type,id,title:String(x.title||''),author:String(x.author||''),genre:String(x.genre||''),status:String(x.status||''),combination:String(x.combination||'')});
          }
        });
        // Do not discard a previously successful source if the refresh partially fails.
        if(next.length||!loaded){
          const goodTypes=new Set(results.map((r,i)=>r.status==='fulfilled'?(i===0?'drive':'postype'):null).filter(Boolean));
          sources=[...sources.filter(x=>!goodTypes.has(x.type)),...next].sort((a,b)=>a.title.localeCompare(b.title,'ko',{numeric:true}));
        }
        loaded=true;
      }
      await loadCatalog();
      if(callId!==loadId)return;
      $('catalogSourceStatus').textContent=`TXT · POSTYPE 등록 작품 ${sources.length.toLocaleString('ko-KR')}건 · 항목을 눌러 정보 등록/수정`;
      message(sourceErrors.length?'일부 원본 목록을 가져오지 못했습니다: '+sourceErrors.join(' / '):'');
    }catch(e){message(e.message,true);}
  }
  function openDialog(){
    const el=$('catalogEditorOverlay');el.hidden=false;
    document.body.classList.add('catalog-dialog-open');
    $('catalogEditorOverlay').querySelector('.catalog-admin-dialog').focus();
  }
  function closeDialog(){
    if(busy)return;
    ++dialogId; ++historyLoadToken; $('catalogEditorOverlay').hidden=true;
    document.body.classList.remove('catalog-dialog-open');
    current=null; message('',false,true); opener?.focus?.(); opener=null;
  }
  function fill(work,source){
    form.reset();
    for(const field of fields){
      const el=form.elements.namedItem(field);if(!el)continue;
      el.value=work?(['genres','tags'].includes(field)?(work[field]||[]).join(', '):(work[field]??'')):
        (field==='title'?source?.title||'':field==='author'?source?.author||'':field==='genres'?source?.genre||'':
          (field==='completion'||field==='subcouple')?'unknown':'');
    }
    // Existing country values stay in the hidden field; the public schema remains compatible.
    form.elements.namedItem('completion').value=work?.completion_mode==='auto'?'auto':
      work?.completion==='unknown'?'manual_unknown':(work?.completion||'auto');
    form.elements.namedItem('subcouple').value=work?.subcouple||'unknown';
    tagTokens=(Array.isArray(work?.tags)?work.tags:[]).map(cleanToken).filter(Boolean);renderTags();
    recommendationRows=work?.recommendation?String(work.recommendation).split(/\n\s*\n/):[''];
    renderRecommendations();
    resetRestorePanel(work);
    $('catalogStatus').value=work?.status||'draft';
    $('catalogDelete').hidden=!work;
    $('catalogEditorTitle').textContent=work?'작품 도감 정보 수정':'작품 도감 정보 등록';
    $('catalogEditorSource').textContent=source?`${labelType(source.type)} · ${source.id}`:'도감에 별도로 등록된 작품';
  }
  async function selectSource(type,id,trigger){
    const source=sources.find(s=>s.type===type&&s.id===id);
    if(!source)return;
    opener=trigger;current={source,work:null,linkedSources:[],loading:true};const ticket=++dialogId;
    fill(null,source);openDialog();$('catalogSave').disabled=true;message('저장된 도감 정보를 확인 중…',false,true);
    try{
      const data=await api(null,'?'+new URLSearchParams({source_type:type,source_id:id}));
      if(ticket!==dialogId)return;
      current.work=data.work;current.linkedSources=data.linked_sources||[];current.loading=false;$('catalogSave').disabled=false;
      fill(data.work,source);message('',false,true);
    }catch(e){if(ticket===dialogId){message(e.message,true,true);current=null;$('catalogSave').disabled=true;}}
  }
  function selectOrphan(id,trigger){
    const work=works.find(w=>w.id===id);if(!work)return;
    opener=trigger; current={source:null,work,linkedSources:[]}; ++dialogId;
    fill(work,null);openDialog();message('',false,true);
  }
  function getForm(){
    const work={};
    for(const f of fields){const input=form.elements.namedItem(f);
      work[f]=f==='tags'?[...tagTokens]:f==='genres'?input.value.split(',').map(x=>x.trim()).filter(Boolean):
        f==='recommendation'?recommendationValue():input.value;
    }
    return work;
  }
  async function mutate(payload,success,close=false){
    if(busy)return false;
    busy=true; $('catalogSave').disabled=true; $('catalogDelete').disabled=true;
    message('처리 중…',false,Boolean(current));
    try{
      await api(payload);
      if(close){ // keep dialog open if the subsequent refresh fails
        current=null; $('catalogEditorOverlay').hidden=true; document.body.classList.remove('catalog-dialog-open');
        opener?.focus?.();opener=null;
      }
      await loadCatalog();
      message(success);return true;
    }catch(e){message(e.message,true,Boolean(current));return false;}
    finally{busy=false;$('catalogSave').disabled=false;$('catalogDelete').disabled=false;}
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!current||current.loading||busy)return;
    if(!addTags($('catalogTagEntry').value))return;
    if(recommendationValue().length>1500){message('추천 문구는 전체 1,500자 이내로 입력해 주세요.',true,true);return;}
    const work=getForm(),status=$('catalogStatus').value;
    const expected_revision=current.work?.revision||undefined;
    const payload=current.source?{action:'upsert_source',source_type:current.source.type,source_id:current.source.id,work,status,expected_revision}:
      {action:'save_work',id:current.work?.id,work,status,expected_revision};
    if(status==='published'&&current.work?.status!=='published'&&!confirm('이 작품 정보를 공개 조회 API에 게시할까요?'))return;
    await mutate(payload,'도감 정보를 저장했습니다.',true);
  });
  $('catalogTagAdd').addEventListener('click',()=>addTags($('catalogTagEntry').value));
  $('catalogTagEntry').addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===','){e.preventDefault();addTags($('catalogTagEntry').value);}
  });
  $('catalogTagList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-remove-tag]');if(!b)return;
    tagTokens.splice(Number(b.dataset.removeTag),1);renderTags();
  });
  $('catalogRecommendationAdd').addEventListener('click',()=>{
    if(recommendationRows.length>=10){message('추천 문구는 최대 10개까지 입력할 수 있습니다.',true,true);return;}
    recommendationRows.push('');renderRecommendations();
    $('catalogRecommendationList').querySelector('.catalog-recommendation-row:last-child textarea')?.focus();
  });
  $('catalogRecommendationList').addEventListener('input',e=>{
    const index=e.target.dataset.recommendationIndex;if(index===undefined)return;
    recommendationRows[Number(index)]=e.target.value;refreshRecommendationCount();
  });
  $('catalogRecommendationList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-remove-recommendation]');if(!b)return;
    recommendationRows.splice(Number(b.dataset.removeRecommendation),1);
    if(!recommendationRows.length)recommendationRows=[''];renderRecommendations();
  });
  $('catalogDelete').addEventListener('click',async()=>{
    if(!current?.work||current.loading||busy)return;
    const {work,linkedSources}=current;
    const desc=`${work.title}의 도감 정보와 연결 ${linkedSources.length}건, 관련 수정 제안·이력을 완전히 삭제합니다.\nTXT 파일 및 POSTYPE 원본은 삭제되지 않습니다.`;
    if(!confirm(desc+'\n\n이 작업은 되돌릴 수 없습니다.'))return;
    if(prompt('확인하려면 삭제를 입력해 주세요.')!=='삭제')return;
    await mutate({action:'delete',id:work.id,expected_revision:work.revision},'도감 정보와 관련 도감 데이터가 완전히 삭제되었습니다.',true);
  });
  $('catalogWorkList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-type][data-source-id]');
    if(b)selectSource(b.dataset.type,b.dataset.sourceId,b);
  });
  $('catalogStandaloneList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-work-id]');if(b)selectOrphan(b.dataset.workId,b);
  });
  $('catalogEditorOverlay').addEventListener('click',e=>{if(e.target.closest('[data-catalog-close]'))closeDialog();});
  document.addEventListener('keydown',e=>{
    if($('catalogEditorOverlay').hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeDialog();}
    if(e.key==='Tab'){
      const list=[...$('catalogEditorOverlay').querySelectorAll('button:not([hidden]):not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(el=>el.getClientRects().length);
      if(!list.length)return;
      const first=list[0],last=list[list.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  $('catalogSearch').addEventListener('input',()=>{shown=50;renderSourceList();});
  $('catalogSearchButton').addEventListener('click',()=>{shown=50;renderSourceList();});
  for(const id of ['catalogSourceFilter','catalogFilter'])$(id).addEventListener('change',()=>{shown=50;renderSourceList();});
  $('catalogMore').addEventListener('click',()=>{shown+=50;renderSourceList();});
  $('catalogRefresh').addEventListener('click',()=>reload(true));
  const importQuotesButton=document.createElement('button');
  importQuotesButton.className=$('catalogRefresh').className;
  importQuotesButton.type='button';importQuotesButton.id='catalogImportQuotes';importQuotesButton.textContent='공개 문장 작품 추가';
  $('catalogRefresh').after(importQuotesButton);
  importQuotesButton.addEventListener('click',async()=>{
    if(busy||!confirm('공개 문장이 있는 미등록 작품을 최대 20개 공개 도감으로 추가할까요? 기존 도감은 변경하지 않으며, 나머지 정보는 공란·미확인으로 둡니다.'))return;
    busy=true;importQuotesButton.disabled=true;
    try {
      const response=await fetch('/api/admin/work-catalog-import',{method:'POST',credentials:'same-origin'});
      const result=await response.json();
      if(response.status===401){location.replace('/admin');throw Error('관리자 로그인이 필요합니다.');}
      if(!response.ok)throw Error(result.error||'공개 문장 작품 등록 실패');
      await loadCatalog();message(`${result.created}개 작품을 추가했습니다. 기존 제목·작가와 중복되는 작품은 자동 등록하거나 병합하지 않아요. 필요한 원본 연결은 관리자 작품 팝업에서 확인해 주세요.${result.hasMore?' 남은 작품은 버튼을 다시 눌러 추가하세요.':''}`);
    }catch(error){message(error.message,true);}
    finally{busy=false;importQuotesButton.disabled=false;}
  });
  $('catalogProposalList').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-review]');if(!b||busy)return;
    const verdict=b.dataset.review;
    if(!confirm(verdict==='approved'?'이 정보 제안을 승인할까요? 신규 작품은 비공개 초안으로 생성됩니다.':'이 정보 제안을 반려할까요?'))return;
    await mutate({action:'review',id:b.dataset.id,verdict},'정보 제안을 처리했습니다.');
  });
  window.addEventListener('admin:tab',e=>{if(e.detail?.name==='work-catalog')reload(!loaded);});
  if(!document.querySelector('[data-tab-panel="work-catalog"]')?.hidden)reload(true);
})();

// v10.81: separate the registered catalogue and Excel review UI.
// v10.79 data contract and ordinary source/reader flows above remain unchanged.
(() => {
  const anchor=document.getElementById('catalogRefresh');
  if(!anchor)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const columns=['source_type','source_id','작품명','작가','줄거리','장르','키워드','추천 대상','검수 상태','검수 메모','초안 버전','도감 작품 ID','도감 공개 상태','엑셀 승인 상태'];
  const names={synopsis:'줄거리',genres:'장르',tags:'키워드',recommendation:'추천 대상'};
  const state={items:[],ready:false,loading:false,current:null,limit:50,reviewSeq:0,lastFocus:null};
  const panel=anchor.closest('.catalog-admin-panel');
  const header=anchor.closest('.panel-head');
  if(!panel||!header)return;
  // Keep the established registered-work editor and user proposals as-is,
  // but put them in their own in-page tab. No site-wide admin tab changes.
  const registeredPane=document.createElement('div');
  registeredPane.id='catalogRegisteredPane';registeredPane.className='catalog-admin-pane';
  [...panel.children].filter(node=>node!==header).forEach(node=>registeredPane.append(node));
  const tabs=document.createElement('div');
  tabs.className='catalog-manager-tabs';tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','작품 도감 관리 화면');
  tabs.innerHTML=`<button type="button" id="catalogRegisteredTab" class="catalog-manager-tab is-active" role="tab" aria-selected="true" aria-controls="catalogRegisteredPane">등록 작품 목록</button>
    <button type="button" id="catalogSheetTab" class="catalog-manager-tab" role="tab" aria-selected="false" aria-controls="catalogSheetPane">엑셀 검수함 <span id="catalogSheetTabCount" class="catalog-manager-count" hidden></span></button>`;
  const root=document.createElement('section');
  root.className='catalog-sheet-panel catalog-admin-pane';root.id='catalogSheetPane';
  root.hidden=true;root.setAttribute('role','tabpanel');root.setAttribute('aria-labelledby','catalogSheetTab');
  registeredPane.setAttribute('role','tabpanel');registeredPane.setAttribute('aria-labelledby','catalogRegisteredTab');
  root.innerHTML=`<div class="catalog-sheet-heading"><div><p class="catalog-sheet-eyebrow">SPREADSHEET REVIEW</p><h3>엑셀 검수함</h3>
    <p class="muted">엑셀에서 정리한 내용을 비공개로 검수하고, 필요한 항목만 공개 도감에 승인해 반영합니다. 기존 사용자 데이터는 자동으로 바뀌지 않습니다.</p></div></div>
    <div id="catalogSheetStats" class="catalog-sheet-stats" aria-label="검수함 현황"></div>
    <div class="catalog-sheet-toolbar"><label class="catalog-sheet-upload" for="catalogSheetFile"><span>엑셀 가져오기</span>
      <input id="catalogSheetFile" type="file" accept=".xlsx" aria-label="도감 엑셀 파일 선택"></label>
      <button id="catalogSheetExport" type="button" class="secondary-admin-button">엑셀 내보내기</button>
      <button id="catalogSheetReload" type="button" class="secondary-admin-button">새로고침</button></div>
    <p id="catalogSheetStatus" role="status" aria-live="polite" class="catalog-sheet-status muted"></p>
    <div class="catalog-sheet-directory">
      <div class="catalog-sheet-directory-head"><div><h4>작품 검수 목록</h4><p class="muted" id="catalogSheetResultCount">검색 및 필터로 작품을 찾을 수 있어요.</p></div></div>
      <div class="catalog-sheet-filters"><input id="catalogSheetSearch" type="search" placeholder="작품명 또는 작가 검색" aria-label="엑셀 검수 작품 검색">
        <select id="catalogSheetFilter" aria-label="도감 승인 상태"><option value="pending">승인 대기</option><option value="all">전체 승인 상태</option><option value="approved">승인됨</option></select>
        <select id="catalogSheetReviewFilter" aria-label="엑셀 원고 검수 상태"><option value="all">전체 검수 상태</option><option value="검수 필요">검수 필요</option><option value="초안">초안</option><option value="검수 완료">검수 완료</option></select></div>
      <div class="catalog-sheet-table-labels" aria-hidden="true"><span>작품명 / 작가</span><span>원고 검수</span><span>도감 연결</span><span>승인 상태</span><span></span></div>
      <div id="catalogSheetList" class="catalog-sheet-list"></div>
      <div class="catalog-sheet-footer"><button id="catalogSheetMore" type="button" class="secondary-admin-button" hidden>다음 50편 보기</button></div>
    </div>
    <div id="catalogSheetReview" class="catalog-sheet-review" role="dialog" aria-modal="true" aria-labelledby="catalogSheetReviewTitle" hidden></div>`;
  panel.append(tabs,registeredPane,root);
  // Only the registered catalogue view needs its own refresh button.
  function switchView(view){
    const isSheet=view==='sheets';
    root.hidden=!isSheet;registeredPane.hidden=isSheet;
    panel.dataset.catalogView=isSheet?'sheets':'registered';
    for(const [id,selected] of [['catalogSheetTab',isSheet],['catalogRegisteredTab',!isSheet]]){
      const tab=panel.querySelector('#'+id);
      tab.classList.toggle('is-active',selected);
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex=selected?0:-1;
    }
    if(isSheet&&!state.ready)void reload();
  }
  tabs.querySelector('#catalogRegisteredTab').addEventListener('click',()=>switchView('registered'));
  tabs.querySelector('#catalogSheetTab').addEventListener('click',()=>switchView('sheets'));
  tabs.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='ArrowRight'?'sheets':'registered';
    switchView(next);tabs.querySelector(next==='sheets'?'#catalogSheetTab':'#catalogRegisteredTab').focus();
  });
  const $=id=>document.getElementById(id);
  const status=(s,error=false)=>{const el=$('catalogSheetStatus');el.textContent=s;el.style.color=error?'var(--sy-danger)':'';};
  const sourceKey=(a,b)=>`${a}\u0000${b}`;
  const normalize=t=>String(t||'').normalize('NFKC').trim();
  const genreTokens=s=>String(s||'').split('·').map(normalize).filter(x=>x&&x.toUpperCase()!=='BL');
  const tagTokens=s=>String(s||'').split('·').map(normalize).filter(Boolean);
  function download(name,blob){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function api(payload,params=''){
    const res=await fetch('/api/admin/work-catalog-sheets'+params,{
      method:payload?'POST':'GET',credentials:'same-origin',cache:'no-store',
      headers:payload?{'content-type':'application/json'}:{},...(payload?{body:JSON.stringify(payload)}:{})
    });
    let data={};try{data=await res.json();}catch(_){ }
    if(res.status===401){location.replace('/admin');throw Error('관리자 로그인 정보가 만료됐습니다.');}
    if(!res.ok)throw Error(data.error||'엑셀 검수 요청에 실패했습니다.');return data;
  }
  function displayList(){
    const q=normalize($('catalogSheetSearch').value).toLocaleLowerCase();
    const filter=$('catalogSheetFilter').value;
    const reviewFilter=$('catalogSheetReviewFilter').value;
    const all=state.items.filter(item=>(filter==='all'||item.review_state===filter)&&
      (reviewFilter==='all'||normalize(item.draft.review_status)===reviewFilter)&&
      (!q||`${item.draft.title} ${item.draft.author}`.normalize('NFKC').toLocaleLowerCase().includes(q)));
    const total=state.items.length;
    const pending=state.items.filter(item=>item.review_state!=='approved').length;
    const approved=state.items.filter(item=>item.review_state==='approved').length;
    const linked=state.items.filter(item=>Boolean(item.work_id||item.approved_work_id)).length;
    $('catalogSheetStats').innerHTML=[['전체 초안',total],['승인 대기',pending],['승인됨',approved],['기존 도감 연결',linked]]
      .map(([label,count])=>`<div class="catalog-sheet-stat"><span>${label}</span><strong>${count.toLocaleString('ko-KR')}</strong></div>`).join('');
    const tabCount=$('catalogSheetTabCount');tabCount.hidden=!total;tabCount.textContent=total.toLocaleString('ko-KR');
    $('catalogSheetResultCount').textContent=`${all.length.toLocaleString('ko-KR')}편 검색됨 · ${Math.min(all.length,state.limit).toLocaleString('ko-KR')}편 표시`;
    $('catalogSheetList').innerHTML=all.length?all.slice(0,state.limit).map(item=>{
      const review=normalize(item.draft.review_status)||'미검수';
      const approved=item.review_state==='approved';
      const linked=Boolean(item.work_id||item.approved_work_id);
      return `<button type="button" class="catalog-sheet-row" data-sheet-type="${escape(item.source_type)}" data-sheet-id="${escape(item.source_id)}" aria-label="${escape(item.draft.title)} 검수 정보 비교 및 승인">
        <span class="catalog-sheet-work"><strong>${escape(item.draft.title)}</strong><small>${escape(item.draft.author||'작가 미상')} <span aria-hidden="true">·</span> 엑셀 v${Number(item.sheet_revision)||1}</small></span>
        <span class="catalog-sheet-cell"><span class="catalog-sheet-mini-label">원고 검수</span><span class="catalog-sheet-pill ${review==='검수 완료'?'is-done':review==='검수 필요'?'is-needs':'is-neutral'}">${escape(review)}</span></span>
        <span class="catalog-sheet-cell"><span class="catalog-sheet-mini-label">도감 연결</span><span class="catalog-sheet-linked">${linked?'연결된 작품':'아직 미등록'}</span></span>
        <span class="catalog-sheet-cell"><span class="catalog-sheet-mini-label">승인 상태</span><span class="catalog-sheet-pill ${approved?'is-done':'is-waiting'}">${approved?'승인됨':'비공개 대기'}</span></span>
        <span class="catalog-sheet-open" aria-hidden="true">›</span>
      </button>`;
    }).join(''):'<p class="catalog-sheet-empty">조건에 맞는 작품이 없습니다. 검색어 또는 필터를 변경해 주세요.</p>';
    $('catalogSheetMore').hidden=state.limit>=all.length;
  }
  async function reload(force=false){
    if(state.loading&&!force)return;
    state.loading=true;status('엑셀 검수함을 불러오는 중…');
    try{const data=await api(null);state.items=data.items||[];state.ready=true;displayList();status(`검수함 ${state.items.length.toLocaleString('ko-KR')}편을 불러왔습니다. 승인 전 정보는 공개되지 않습니다.`);}
    catch(error){status(error.message,true);}finally{state.loading=false;}
  }
  function xlsxXml(t){return String(t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
  function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
  function makeWorkbook(rows){
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const rowXml=[columns,...rows].map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>
      `<c r="${colName(j)}${i+1}" t="inlineStr" s="${i?0:1}"><is><t xml:space="preserve">${xlsxXml(v??'')}</t></is></c>`).join('')}</row>`).join('');
    const zip=new JSZip();
    zip.file('[Content_Types].xml',`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml',`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="도감_관리" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('xl/styles.xml',`<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF254D4F"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`);
    zip.file('xl/worksheets/sheet1.xml',`<?xml version="1.0"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${[15,34,25,16,60,34,40,40,16,30,14,35,18,18][i]}" customWidth="1"/>`).join('')}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A1:N${rows.length+1}"/></worksheet>`);
    return zip.generateAsync({type:'blob',compression:'DEFLATE'});
  }
  const readXml = xml => {
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw Error('손상된 엑셀 XML입니다.');return doc;
  };
  async function parseWorkbook(file){
    if(!window.JSZip)throw Error('엑셀 처리 라이브러리가 로드되지 않았습니다. 인터넷 연결을 확인해 주세요.');
    if(file.size>15*1024*1024)throw Error('엑셀 크기는 최대 15MB입니다.');
    const zip=await JSZip.loadAsync(file),ws=zip.file('xl/worksheets/sheet1.xml');
    if(!ws)throw Error('시트 1을 찾지 못했습니다. 도감 관리 양식을 사용해 주세요.');
    const shared=[];
    if(zip.file('xl/sharedStrings.xml')){
      const strings=readXml(await zip.file('xl/sharedStrings.xml').async('string'));
      for(const el of strings.getElementsByTagNameNS('*','si'))
        shared.push([...el.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join(''));
    }
    const xml=readXml(await ws.async('string'));
    const output=[];
    for(const row of xml.getElementsByTagNameNS('*','row')){
      const cols=[];
      for(const cell of row.getElementsByTagNameNS('*','c')){
        const match=/^[A-Z]+/.exec(cell.getAttribute('r')||'');if(!match)continue;
        let index=0;for(const char of match[0])index=index*26+char.charCodeAt(0)-64;index--;
        if(index<0||index>40)continue;
        const inline=cell.getElementsByTagNameNS('*','is')[0],value=cell.getElementsByTagNameNS('*','v')[0];
        let raw=inline?[...inline.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(''):value?.textContent||'';
        if(cell.getAttribute('t')==='s')raw=shared[Number(raw)]||'';
        cols[index]=raw;
      }
      output.push(cols);
    }
    const head=output.shift()||[];
    if(columns.some((c,i)=>String(head[i]||'').trim()!==c))throw Error('엑셀 양식 또는 열 순서가 다릅니다. 관리 도감 내보내기 파일을 사용해 주세요.');
    const entries=[],seen=new Set();
    for(const [i,row] of output.entries()){
      if(row.every(v=>!String(v||'').trim()))continue;
      const type=normalize(row[0]),id=normalize(row[1]),k=sourceKey(type,id);
      if(!['drive','postype'].includes(type)||!id||seen.has(k))throw Error(`엑셀 ${i+2}행의 원본 ID가 없거나 중복됐습니다.`);
      seen.add(k);
      entries.push({source_type:type,source_id:id,title:normalize(row[2]),author:normalize(row[3]),
        synopsis:String(row[4]||''),genres:genreTokens(row[5]),tags:tagTokens(row[6]),
        recommendation:String(row[7]||''),review_status:String(row[8]||''),review_note:String(row[9]||''),
        sheet_revision:Number(row[10]||1)});
    }
    if(!entries.length||entries.length>1000)throw Error('가져올 엑셀은 1~1,000행이어야 합니다.');
    return entries;
  }
  async function importExcel(file){
    if(state.loading)return;
    state.loading=true;status('엑셀 파일을 검증하고 있습니다…');
    try{
      const entries=await parseWorkbook(file);
      const current=new Map(state.items.map(x=>[sourceKey(x.source_type,x.source_id),x]));
      const stale=entries.filter(x=>{const old=current.get(sourceKey(x.source_type,x.source_id));
        return old&&Number(old.sheet_revision)!==Number(x.sheet_revision)&&
          ['synopsis','genres','tags','recommendation','review_status','review_note'].some(f=>JSON.stringify(x[f])!==JSON.stringify(old.draft[f]));
      });
      if(stale.length)throw Error(`이전 버전 엑셀 데이터 ${stale.length}행이 발견됐습니다. 최신 검수함을 내보내서 다시 수정해 주세요.`);
      const changes=entries.filter(x=>{
        const old=current.get(sourceKey(x.source_type,x.source_id));
        return !old||['synopsis','genres','tags','recommendation','review_status','review_note'].some(f=>JSON.stringify(x[f])!==JSON.stringify(old.draft[f]));
      });
      if(!changes.length){status('변경된 엑셀 데이터가 없습니다.');return;}
      if(!confirm(`${entries.length}행을 확인했습니다. 이 중 변경 후보 ${changes.length}행을 비공개 검수함에 저장할까요?\n\n기존 공개 작품과 이미 승인한 정보는 이 과정에서 변경되지 않습니다.`))return;
      let changed=0,unchanged=0;
      // Small bounded batches keep D1 writes and request payloads predictable.
      for(let i=0;i<entries.length;i+=12){
        status(`비공개 검수함 저장 중… ${Math.min(i+12,entries.length)} / ${entries.length}행`);
        const result=await api({action:'import_batch',items:entries.slice(i,i+12)});
        changed+=result.changed||0;unchanged+=result.unchanged||0;
      }
      await reload(true);status(`검수함 저장 완료: 변경 ${changed}행 · 변경 없음 ${unchanged}행. 공개 반영은 작품별 관리자 승인이 필요합니다.`);
    }catch(error){status(`가져오기 중단: ${error.message}. 완료된 배치는 검수함에 남고 공개 데이터는 변경되지 않습니다.`,true);}
    finally{state.loading=false;$('catalogSheetFile').value='';}
  }
  async function exportExcel(){
    if(state.loading)return;
    state.loading=true;status('엑셀 내보내기 생성 중…');
    try{
      const items=(await api(null)).items||[];
      if(!window.JSZip)throw Error('엑셀 라이브러리를 불러오지 못했습니다.');
      const rows=items.map(item=>[item.source_type,item.source_id,item.draft.title,item.draft.author,
        item.draft.synopsis,(item.draft.genres||[]).filter(v=>normalize(v).toUpperCase()!=='BL').join(' · '),
        (item.draft.tags||[]).join(' · '),item.draft.recommendation,item.draft.review_status,item.draft.review_note,
        item.sheet_revision,item.work_id||item.approved_work_id||'',item.work_status||'',item.review_state]);
      download(`RRR_작품도감_엑셀검수함_${new Date().toISOString().slice(0,10)}.xlsx`,await makeWorkbook(rows));
      status(`${rows.length}편의 엑셀 검수함을 내보냈습니다. 원본 ID 열은 수정하지 마세요.`);
    }catch(e){status(e.message,true);}finally{state.loading=false;}
  }
  async function openReview(type,id){
    if(state.loading)return;
    const ticket=++state.reviewSeq;
    const area=$('catalogSheetReview');state.lastFocus=document.activeElement;area.hidden=false;document.body.classList.add('catalog-sheet-dialog-open');area.textContent='작품별 승인 비교 정보를 불러오는 중…';
    try{
      const data=await api(null,'?'+new URLSearchParams({source_type:type,source_id:id}));
      if(ticket!==state.reviewSeq)return;
      state.current=data;
      const {item,work,collision}=data;
      const rows=Object.entries(names).map(([field,label])=>{
        const current=work?(work[field]||((field==='genres'||field==='tags')?[]:'')):((field==='genres'||field==='tags')?[]:'');
        const staged=item.draft[field]||((field==='genres'||field==='tags')?[]:'');
        const display=v=>Array.isArray(v)?v.join(' · '):String(v||'');
        return `<label class="catalog-sheet-diff"><span class="catalog-sheet-diff-title"><input type="checkbox" name="sheetField" value="${field}" ${display(staged)?'checked':''}> ${label} 승인</span>
          <span><em>현재 공개 데이터</em><pre>${escape(display(current)||'—')}</pre></span>
          <span><em>엑셀 검수 초안</em><pre>${escape(display(staged)||'—')}</pre></span></label>`;
      }).join('');
      area.innerHTML=`<div class="catalog-sheet-dialog"><div class="catalog-sheet-review-head"><div><p class="catalog-sheet-eyebrow">FIELD REVIEW</p><h4 id="catalogSheetReviewTitle">${escape(item.draft.title)}</h4><p class="muted">${escape(item.draft.author)} · 엑셀 버전 ${item.sheet_revision}</p></div>
        <button type="button" data-sheet-close="1" class="secondary-admin-button">닫기</button></div>
        <p class="muted">${work?'연결된 실제 도감 작품에 선택 항목만 병합합니다.':'승인 전에는 이용자가 직접 작품을 등록할 수 있습니다.'}
        ${collision?'⚠ 동일 제목·작가의 연결되지 않은 도감 작품이 있습니다. 관리자에서 먼저 원본 연결을 확인해 주세요.':''}</p>
        <div class="catalog-sheet-diff-grid">${rows}</div>
        <label class="catalog-sheet-publish"><input type="checkbox" id="catalogSheetPublish" ${(!work||work.status==='published')?'checked':''}> ${work?'승인하면서 비공개 작품인 경우 공개 전환':'신규 작품을 승인하고 공개 등록'}</label>
        <div class="catalog-sheet-approve-actions"><button id="catalogSheetApprove" type="button" ${collision?'disabled':''}>선택 항목 도감에 반영</button></div></div>`;
      area.querySelector('[data-sheet-close]')?.focus();
    }catch(error){area.innerHTML=`<div class="catalog-sheet-dialog"><p>${escape(error.message)}</p><button type="button" data-sheet-close="1">닫기</button></div>`;}
  }
  function closeReview(){
    ++state.reviewSeq;state.current=null;
    $('catalogSheetReview').hidden=true;document.body.classList.remove('catalog-sheet-dialog-open');
    if(state.lastFocus?.isConnected)state.lastFocus.focus();state.lastFocus=null;
  }
  async function approve(){
    const current=state.current;if(!current||state.loading)return;
    const fields=[...$('catalogSheetReview').querySelectorAll('input[name="sheetField"]:checked')].map(x=>x.value);
    if(!fields.length){status('반영할 항목을 하나 이상 선택해 주세요.',true);return;}
    const {item}=current;
    if(!confirm(`${item.draft.title}의 ${fields.map(x=>names[x]).join(', ')} 항목을 실제 도감에 반영할까요?\n기존 정보는 보존하고 승인된 엑셀 정보만 덧붙입니다.`))return;
    state.loading=true;
    const b=$('catalogSheetApprove');b.disabled=true;
    try{
      const out=await api({action:'approve',source_type:item.source_type,source_id:item.source_id,
        sheet_revision:item.sheet_revision,fields,publish:$('catalogSheetPublish').checked});
      closeReview();
      await reload(true);status(`${item.draft.title}: ${fields.map(f=>names[f]).join('·')} 반영 완료${out.created?' (관리자 신규 등록)':''}.`);
    }catch(e){status(e.message,true);b.disabled=false;}
    finally{state.loading=false;}
  }
  $('catalogSheetFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)void importExcel(file);});
  $('catalogSheetExport').addEventListener('click',()=>void exportExcel());
  $('catalogSheetReload').addEventListener('click',()=>void reload());
  $('catalogSheetSearch').addEventListener('input',()=>{state.limit=50;displayList();});
  $('catalogSheetFilter').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetReviewFilter').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetMore').addEventListener('click',()=>{state.limit+=50;displayList();});
  $('catalogSheetList').addEventListener('click',event=>{
    const target=event.target.closest('button[data-sheet-id]');
    if(target)void openReview(target.dataset.sheetType,target.dataset.sheetId);
  });
  document.addEventListener('keydown',event=>{
    const area=$('catalogSheetReview');if(area.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeReview();}
    else if(event.key==='Tab'){
      const focusable=[...area.querySelectorAll('button:not([disabled]),input:not([disabled])')];
      if(!focusable.length)return;
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  $('catalogSheetReview').addEventListener('click',event=>{
    if(event.target===$('catalogSheetReview')||event.target.closest('[data-sheet-close]'))closeReview();
    else if(event.target.closest('#catalogSheetApprove'))void approve();
  });
})();
