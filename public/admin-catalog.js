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
      warnings_set:'주의 요소 변경',adult_scene_set:'성적 묘사 여부 변경 제안',recommendation_add:'추천 대상 추가',
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
  const baseColumns=['source_type','source_id','작품명','작가','줄거리','장르','키워드','추천 대상','검수 상태','검수 메모','초안 버전','도감 작품 ID','도감 공개 상태','엑셀 승인 상태'];
  const reviewFields=['original_number','original_filename','original_path','original_sha256','duplicate_note','analysis_scope','summary_progress','recheck_log'];
  const reviewColumns=['원본 번호','원본 파일명','원본 경로','원본 식별자','중복 참고','분석 범위','요약 진행 상태','재검수 기록'];
  const adultFields=['adult_scene_status','adult_scene_note'];
  const adultColumns=['성적 묘사 판정','성적 묘사 판정 근거'];
  const trackingColumns=['최근 재검수 처리일','재검수 처리 횟수'];
  const columns=[...baseColumns,...reviewColumns,...adultColumns,...trackingColumns];
  const names={synopsis:'줄거리',genres:'장르',tags:'키워드',recommendation:'추천 대상',adult_scene_status:'성적 묘사 여부'};
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
      <div class="catalog-sheet-filters"><input id="catalogSheetSearch" type="search" placeholder="작품명·작가·검수 메모 검색" aria-label="엑셀 검수 작품 및 검수 메모 검색">
        <select id="catalogSheetFilter" aria-label="도감 승인 상태"><option value="pending">승인 대기</option><option value="all">전체 승인 상태</option><option value="approved">승인됨</option></select>
        <select id="catalogSheetReviewFilter" aria-label="엑셀 원고 검수 상태"><option value="all">전체 검수 상태</option><option value="검수 필요">검수 필요</option><option value="초안">초안</option><option value="검수 완료">검수 완료</option></select>
        <select id="catalogSheetLinkFilter" aria-label="도감 연결 여부"><option value="all">전체 도감 연결</option><option value="linked">도감 연결됨</option><option value="unlinked">도감 미등록</option></select>
        <select id="catalogSheetIncomingFilter" aria-label="재검수 진행 여부"><option value="all">전체 재검수 진행</option><option value="never">재검수 미처리</option><option value="waiting">새 재검수 비교 대기</option><option value="merged">재검수 병합 완료</option><option value="approved">재검수 후 도감 승인</option></select>
        <select id="catalogSheetAdultFilter" aria-label="성적 묘사 분류"><option value="all">전체 성적 묘사 분류</option><option value="미확인">미확인</option><option value="직접적 묘사">직접적 묘사</option><option value="묘사 없음">묘사 없음</option><option value="확인 필요">확인 필요</option></select>
        <select id="catalogSheetSort" aria-label="검수함 정렬"><option value="default">기본 순서</option><option value="latest">최근 재검수 처리순</option></select></div>
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
  const importDifferent=(incoming,current,field)=>JSON.stringify(field==='adult_scene_status'?(incoming||'미확인'):(incoming??''))!==
    JSON.stringify(field==='adult_scene_status'?(current||'미확인'):(current??''));
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
    const linkFilter=$('catalogSheetLinkFilter').value;
    const incomingFilter=$('catalogSheetIncomingFilter').value;
    const adultFilter=$('catalogSheetAdultFilter').value;
    const recheckStage=item=>item.has_incoming?'waiting':!Number(item.recheck_count)?'never':
      Number(item.approved_at||0)>=Number(item.last_recheck_merged_at||0)?'approved':'merged';
    const all=state.items.filter(item=>(filter==='all'||item.review_state===filter||(filter==='pending'&&Boolean(item.has_incoming)))&&
      (reviewFilter==='all'||normalize(item.draft.review_status)===reviewFilter)&&
      (linkFilter==='all'||(Boolean(item.work_id)===(linkFilter==='linked')))&&
      (incomingFilter==='all'||recheckStage(item)===incomingFilter)&&
      (adultFilter==='all'||(item.draft.adult_scene_status||'미확인')===adultFilter)&&
      (!q||`${item.draft.title} ${item.draft.author} ${item.draft.review_note||''} ${item.draft.duplicate_note||''} ${item.draft.analysis_scope||''} ${item.draft.recheck_log||''}`.normalize('NFKC').toLocaleLowerCase().includes(q)));
    if($('catalogSheetSort').value==='latest')all.sort((a,b)=>Number(b.last_recheck_merged_at||0)-Number(a.last_recheck_merged_at||0));
    const total=state.items.length;
    const pending=state.items.filter(item=>item.review_state!=='approved').length;
    const approved=state.items.filter(item=>item.review_state==='approved').length;
    const linked=state.items.filter(item=>Boolean(item.work_id)).length;
    const incomingCount=state.items.filter(item=>Boolean(item.has_incoming)).length;
    const processed=state.items.filter(item=>Number(item.recheck_count)>0).length;
    $('catalogSheetStats').innerHTML=[['전체 초안',total],['승인 대기',pending],['재검수 비교 대기',incomingCount],['재검수 처리',processed],['도감 연결',linked]]
      .map(([label,count])=>`<div class="catalog-sheet-stat"><span>${label}</span><strong>${count.toLocaleString('ko-KR')}</strong></div>`).join('');
    const tabCount=$('catalogSheetTabCount');tabCount.hidden=!total;tabCount.textContent=total.toLocaleString('ko-KR');
    $('catalogSheetResultCount').textContent=`${all.length.toLocaleString('ko-KR')}편 검색됨 · ${Math.min(all.length,state.limit).toLocaleString('ko-KR')}편 표시`;
    $('catalogSheetList').innerHTML=all.length?all.slice(0,state.limit).map(item=>{
      const review=normalize(item.draft.review_status)||'미검수';
      const approved=item.review_state==='approved';
      const linked=Boolean(item.work_id);
      return `<button type="button" class="catalog-sheet-row" data-sheet-type="${escape(item.source_type)}" data-sheet-id="${escape(item.source_id)}" aria-label="${escape(item.draft.title)} 검수 정보 비교 및 승인">
        <span class="catalog-sheet-work"><strong>${escape(item.draft.title)}</strong><small>${escape(item.draft.author||'작가 미상')} <span aria-hidden="true">·</span> 엑셀 v${Number(item.sheet_revision)||1}</small>${item.has_incoming?'<span class="catalog-sheet-incoming-indicator">재검수본 도착 · 비교 필요</span>':''}
          <small class="catalog-sheet-tracking">${Number(item.recheck_count)?`재검수 ${Number(item.recheck_count)}회 · 최근 병합 ${escape(new Date(Number(item.last_recheck_merged_at)).toLocaleDateString('ko-KR'))}`:'재검수 처리 기록 없음'} · 성적 묘사: ${escape(item.draft.adult_scene_status||'미확인')}</small></span>
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
    const sheetXml=(table,headers,widths,filterStart=1)=>{
      const items=[headers,...table];
      const rowXml=items.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>
        `<c r="${colName(j)}${i+1}" t="inlineStr" s="${i?0:1}"><is><t xml:space="preserve">${xlsxXml(v??'')}</t></is></c>`).join('')}</row>`).join('');
      return `<?xml version="1.0"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((v,i)=>`<col min="${i+1}" max="${i+1}" width="${v}" customWidth="1"/>`).join('')}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A${filterStart}:${colName(headers.length-1)}${items.length}"/></worksheet>`;
    };
    const widths=[15,34,25,16,60,34,40,40,16,30,14,35,18,18,14,40,50,52,32,22,20,48,22,50,22,17];
    const counts=arr=>arr.reduce((map,v)=>(map[v]=(map[v]||0)+1,map),{});
    const statuses=counts(rows.map(row=>String(row[8]||'미검수')));
    const scopes=counts(rows.map(row=>String(row[19]||'미기록')));
    const summary=[['전체 작품',rows.length,'도감_관리 시트가 유일한 수정·재가져오기 기준입니다.'],
      ...Object.entries(statuses).map(([label,count])=>['검수 상태 · '+label,count,'']),
      ...Object.entries(scopes).map(([label,count])=>['분석 범위 · '+label,count,'']),
      ['도감 연결됨',rows.filter(row=>Boolean(row[11])).length,''],
      ['도감 미등록',rows.filter(row=>!row[11]).length,''],
      ['엑셀 승인됨',rows.filter(row=>row[13]==='approved').length,''],
      ['v10.85 이후 재검수 병합 완료',rows.filter(row=>Number(row[25])>0).length,'횟수는 사이트가 병합된 Work 재검수 기록만 집계'],
      ['성적 묘사 판정 · 직접적 묘사',rows.filter(row=>row[22]==='직접적 묘사').length,'관리자 승인 전에는 공개 주의사항에 반영되지 않음'],
      ['성적 묘사 판정 · 미확인',rows.filter(row=>!row[22]||row[22]==='미확인').length,'원문을 확인하지 않은 작품은 묘사 없음으로 단정하지 않음']];
    const needed=rows.filter(row=>row[8]==='검수 필요');
    const helpRows=needed.map(row=>[row[2],row[3],row[8],row[9],row[19],row[20],row[21],row[1]]);
    const zip=new JSZip();
    zip.file('[Content_Types].xml',`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml',`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="도감_관리" sheetId="1" r:id="rId1"/><sheet name="검수필요_참고" sheetId="2" r:id="rId2"/><sheet name="진행현황_참고" sheetId="3" r:id="rId3"/></sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('xl/styles.xml',`<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF254D4F"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`);
    zip.file('xl/worksheets/sheet1.xml',sheetXml(rows,columns,widths));
    zip.file('xl/worksheets/sheet2.xml',sheetXml(helpRows,['작품명','작가','검수 상태','검수 메모','분석 범위','요약 진행 상태','재검수 기록','사이트 원본 ID'],[27,20,18,65,24,19,65,36]));
    zip.file('xl/worksheets/sheet3.xml',sheetXml(summary,['항목','수량','안내'],[36,18,74]));
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
    if(baseColumns.some((c,i)=>String(head[i]||'').trim()!==c))throw Error('엑셀 양식 또는 열 순서가 다릅니다. 검수함 내보내기 파일을 사용해 주세요.');
    const extrasPresent=reviewColumns.every((c,i)=>String(head[baseColumns.length+i]||'').trim()===c);
    const anyExtra=reviewColumns.some((_,i)=>String(head[baseColumns.length+i]||'').trim());
    if(anyExtra&&!extrasPresent)throw Error('재검수 참고정보 열이 일부 누락되거나 순서가 바뀌었습니다.');
    const adultOffset=baseColumns.length+reviewColumns.length;
    const adultPresent=adultColumns.every((c,i)=>String(head[adultOffset+i]||'').trim()===c);
    const adultAny=adultColumns.some((_,i)=>String(head[adultOffset+i]||'').trim());
    if(adultAny&&!adultPresent)throw Error('성적 묘사 판정 열이 누락되거나 순서가 바뀌었습니다.');
    if(adultPresent&&!extrasPresent)throw Error('성적 묘사 판정에는 재검수 참고정보 열이 필요합니다.');
    if(adultPresent&&trackingColumns.some((c,i)=>String(head[adultOffset+adultColumns.length+i]||'').trim()!==c))
      throw Error('재검수 처리 현황 열이 누락되거나 순서가 바뀌었습니다.');
    const entries=[],seen=new Set();
    for(const [i,row] of output.entries()){
      if(row.every(v=>!String(v||'').trim()))continue;
      const type=normalize(row[0]),id=normalize(row[1]),k=sourceKey(type,id);
      if(!['drive','postype'].includes(type)||!id||seen.has(k))throw Error(`엑셀 ${i+2}행의 원본 ID가 없거나 중복됐습니다.`);
      seen.add(k);
      entries.push({source_type:type,source_id:id,title:normalize(row[2]),author:normalize(row[3]),
        synopsis:String(row[4]||''),genres:genreTokens(row[5]),tags:tagTokens(row[6]),
        recommendation:String(row[7]||''),review_status:String(row[8]||''),review_note:String(row[9]||''),
        sheet_revision:Number(row[10]||1),
        ...(extrasPresent?Object.fromEntries(reviewFields.map((field,j)=>[field,String(row[baseColumns.length+j]||'')])):{}),
        ...(adultPresent?Object.fromEntries(adultFields.map((field,j)=>[field,String(row[adultOffset+j]||'')])):{})});
    }
    if(!entries.length||entries.length>1000)throw Error('가져올 엑셀은 1~1,000행이어야 합니다.');
    entries.hasReviewMetadata=extrasPresent;
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
          [...'synopsis,genres,tags,recommendation,review_status,review_note'.split(','),...reviewFields,...adultFields].some(f=>x[f]!==undefined&&importDifferent(x[f],old.draft[f],f));
      });
      if(stale.length)throw Error(`이전 버전 엑셀 데이터 ${stale.length}행이 발견됐습니다. 최신 검수함을 내보내서 다시 수정해 주세요.`);
      const changes=entries.filter(x=>{
        const old=current.get(sourceKey(x.source_type,x.source_id));
        return !old||[...'synopsis,genres,tags,recommendation,review_status,review_note'.split(','),...reviewFields,...adultFields].some(f=>x[f]!==undefined&&importDifferent(x[f],old.draft[f],f));
      });
      if(!changes.length){status('변경된 엑셀 데이터가 없습니다.');return;}
      // The unchanged 451+ rows were already compared locally against the current
      // server snapshot. Only rows to be written need D1-level preflight; otherwise
      // 459/12 sequential requests repeatedly enumerate all sources and can stall.
      // Server revisions and pending incoming conflicts are still checked for every
      // changed row before any write. Rechecked in import_batch to avoid races.
      for(let i=0;i<changes.length;i+=12){
        status(`재검수 엑셀 사전 점검 중… ${Math.min(i+12,changes.length)} / ${changes.length}개 변경 후보 (전체 ${entries.length}행 대조 완료)`);
        await api({action:'preflight_import',items:changes.slice(i,i+12)});
      }
      if(!confirm(`${entries.length}행 확인 · 변경 후보 ${changes.length}행입니다.\n기존 행의 재검수 결과는 별도 비교 대기함에 저장되며 현재 관리자 초안과 공개 도감은 변경되지 않습니다.\n새 작품 행만 초안으로 생성합니다. 계속할까요?`))return;
      let changed=0,unchanged=0;
      // Only changed rows are sent; unchanged workbook rows never need writes.
      // The server validates the source identity, draft revision and pending state.
      for(let i=0;i<changes.length;i+=12){
        status(`비공개 검수함 저장 중… ${Math.min(i+12,changes.length)} / ${changes.length}개 변경 후보`);
        const result=await api({action:'import_batch',items:changes.slice(i,i+12)});
        changed+=result.changed||0;unchanged+=result.unchanged||0;
      }
      await reload(true);status(`가져오기 완료: 변경 후보 ${changed}행은 기존 초안 보존 후 비교 대기(신규 행은 비공개 등록) · 원본 ${entries.length}행 중 ${entries.length-changed}행 변경 없음. 작품별 선택 병합과 공개 승인이 필요합니다.`);
    }catch(error){status(`가져오기 중단: ${error.message}. 완료된 배치는 검수함에 남고 공개 데이터는 변경되지 않습니다.`,true);}
    finally{state.loading=false;$('catalogSheetFile').value='';}
  }
  async function exportExcel(){
    if(state.loading)return;
    state.loading=true;status('엑셀 내보내기 생성 중…');
    try{
      const items=(await api(null)).items||[];
      const pending=items.filter(item=>Boolean(item.has_incoming)).length;
      if(pending&&!confirm(`새 재검수 비교 대기 ${pending}편은 아직 병합되지 않아 이번 엑셀 내보내기에 포함되지 않습니다.\n계속 내보낼까요?`))return;
      if(!window.JSZip)throw Error('엑셀 라이브러리를 불러오지 못했습니다.');
      const rows=items.map(item=>[item.source_type,item.source_id,item.draft.title,item.draft.author,
        item.draft.synopsis,(item.draft.genres||[]).filter(v=>normalize(v).toUpperCase()!=='BL').join(' · '),
        (item.draft.tags||[]).join(' · '),item.draft.recommendation,item.draft.review_status,item.draft.review_note,
        item.sheet_revision,item.work_id||'',item.work_status||'',item.review_state,
        ...reviewFields.map(f=>item.draft[f]||''),
        item.draft.adult_scene_status||'미확인',item.draft.adult_scene_note||'',
        item.last_recheck_merged_at?new Date(Number(item.last_recheck_merged_at)).toISOString().slice(0,10):'',
        Number(item.recheck_count)||0]);
      download(`RRR_작품도감_엑셀검수함_${new Date().toISOString().slice(0,10)}.xlsx`,await makeWorkbook(rows));
      status(`${rows.length}편의 엑셀 검수함을 내보냈습니다. 원본 ID 열은 수정하지 마세요.`);
    }catch(e){status(e.message,true);}finally{state.loading=false;}
  }
  const editableFields=['synopsis','genres','tags','recommendation'];
  const displayDraftField=value=>Array.isArray(value)?value.join(' · '):String(value??'');
  function readDraftEditor(){
    const area=$('catalogSheetReview');
    const previous=state.current?.item?.draft||{};
    const edited={...previous};
    for(const field of editableFields){
      const raw=area.querySelector(`[data-sheet-edit="${field}"]`)?.value||'';
      edited[field]=field==='genres'?genreTokens(raw):field==='tags'?tagTokens(raw):raw.trim();
    }
    edited.review_status=area.querySelector('#catalogSheetReviewStatus')?.value||'';
    edited.review_note=area.querySelector('#catalogSheetReviewNote')?.value.trim()||'';
    for(const field of ['duplicate_note','analysis_scope','summary_progress','recheck_log',...adultFields]){
      const el=area.querySelector(`[data-review-meta="${field}"]`);
      if(el)edited[field]=el.value.trim();
    }
    return edited;
  }
  function isDraftDirty(){
    const previous=state.current?.item?.draft;
    if(!previous)return false;
    const edited=readDraftEditor();
    return ['synopsis','genres','tags','recommendation','review_status','review_note','duplicate_note','analysis_scope','summary_progress','recheck_log',...adultFields]
      .some(field=>importDifferent(edited[field],previous[field]??(Array.isArray(edited[field])?[]:''),field));
  }
  function refreshDraftButtons(){
    const area=$('catalogSheetReview');
    const dirty=isDraftDirty();
    const save=area.querySelector('#catalogSheetSave');
    const approveButton=area.querySelector('#catalogSheetApprove');
    if(save)save.disabled=state.loading||!dirty||Boolean(state.current?.incoming);
    if(approveButton)approveButton.disabled=state.loading||dirty||Boolean(state.current?.collision)||Boolean(state.current?.incoming);
    const merge=area.querySelector('#catalogSheetMerge');if(merge)merge.disabled=state.loading;
    const discard=area.querySelector('#catalogSheetDiscard');if(discard)discard.disabled=state.loading;
    const hint=area.querySelector('#catalogSheetEditHint');
    if(hint)hint.textContent=state.current?.incoming?'새 재검수본과 현재 초안을 비교하고 필요한 문장만 복사하거나 직접 조합하세요. 이후 선택 병합으로 비공개 저장해야 승인이 가능합니다.':dirty?'수정 중인 내용이 있습니다. 비공개 초안으로 먼저 저장한 뒤 승인해 주세요.':'검수 초안은 수정 후 별도 저장하며, 저장만으로 도감에 공개되지 않습니다.';
  }
  async function openReview(type,id){
    if(state.loading)return;
    const ticket=++state.reviewSeq;
    const area=$('catalogSheetReview');if(area.hidden)state.lastFocus=document.activeElement;state.current=null;area.hidden=false;document.body.classList.add('catalog-sheet-dialog-open');area.textContent='작품별 승인 비교 정보를 불러오는 중…';
    try{
      const data=await api(null,'?'+new URLSearchParams({source_type:type,source_id:id}));
      if(ticket!==state.reviewSeq)return;
      state.current=data;
      const {item,work,collision,incoming}=data;
      const rows=Object.entries(names).map(([field,label])=>{
        if(field==='adult_scene_status'){
          const current=work?.adult_scene_status||'미확인';
          const staged=item.draft.adult_scene_status||'미확인';
          const mapping={'직접적 묘사':'있음','묘사 없음':'없음','미확인':'미확인','확인 필요':'확인 필요'};
          const selected=Object.prototype.hasOwnProperty.call(item.draft,'adult_scene_status')&&staged!=='미확인';
          return `<div class="catalog-sheet-diff"><label class="catalog-sheet-diff-title"><input type="checkbox" name="sheetField" value="adult_scene_status" ${selected?'checked':''}> 성적 묘사 여부 승인 · 주의사항</label>
            <div><em>현재 공개 상태</em><pre>${escape(current)}</pre></div>
            <div><em>비공개 Work 검수 판정</em><pre>${escape(mapping[staged]||'미확인')}</pre><small>수정은 아래 ‘성적 묘사 판정’에서 저장한 후 승인하세요. 키워드에는 자동 추가하지 않습니다.</small></div></div>`;
        }
        const current=work?(work[field]??((field==='genres'||field==='tags')?[]:'')):((field==='genres'||field==='tags')?[]:'');
        const staged=item.draft[field]??((field==='genres'||field==='tags')?[]:'');
        const listType=field==='genres'||field==='tags';
        const lengthLimit=field==='synopsis'?3000:field==='recommendation'?1500:800;
        const approved=item.applied?.[field]?.source;
        return `<div class="catalog-sheet-diff"><label class="catalog-sheet-diff-title"><input type="checkbox" name="sheetField" value="${field}" ${displayDraftField(staged)?'checked':''}> ${label} 승인</label>
          <div><em>현재 공개 데이터</em><pre>${escape(displayDraftField(current)||'—')}</pre>${approved!==undefined?`<small class="catalog-sheet-approved-source">마지막 엑셀 승인분: ${escape(displayDraftField(approved)||'(빈 값)')}</small>`:''}</div>
          <label class="catalog-sheet-edit-column"><em>엑셀 검수 초안 · 직접 수정 가능</em><textarea data-sheet-edit="${field}" rows="${listType?2:5}" maxlength="${lengthLimit}" spellcheck="false" aria-label="${label} 검수 초안 수정">${escape(displayDraftField(staged))}</textarea>
          ${listType?'<small>여러 항목은 · 기호로 구분하세요. BL 장르는 자동 제외됩니다.</small>':''}</label></div>`;
      }).join('');
      // Imported Work revisions are kept separately until explicitly reconciled.
      const allFields=[...editableFields,'review_status','review_note','duplicate_note','analysis_scope','summary_progress','recheck_log',...adultFields];
      const incomingRows=incoming?allFields.filter(field=>JSON.stringify(item.draft[field]??'')!==JSON.stringify(incoming.draft[field]??''))
        .map(field=>{const label=names[field]||({review_status:'원고 검수 상태',review_note:'검수 메모',duplicate_note:'중복 참고',analysis_scope:'분석 범위',summary_progress:'요약 진행 상태',recheck_log:'재검수 기록',adult_scene_status:'성적 묘사 판정',adult_scene_note:'성적 묘사 판정 근거'}[field]);
          return `<div class="catalog-sheet-incoming-row"><strong>${escape(label)}</strong><div class="catalog-sheet-incoming-values"><div><em>현재 관리자 초안</em><pre>${escape(displayDraftField(item.draft[field])||'—')}</pre></div><div><em>새 Work 재검수본</em><pre>${escape(displayDraftField(incoming.draft[field])||'—')}</pre></div></div><button type="button" class="secondary-admin-button" data-copy-incoming="${field}">이 항목 재검수안 사용</button></div>`;
        }).join(''):'';
      const incomingPanel=incoming?`<section class="catalog-sheet-incoming"><h5>새 재검수본 비교 대기</h5><p>기존 관리자 편집본은 보존돼 있어요. 아래 항목별로 채택하면 위의 최종 초안 편집칸에 복사됩니다. 필요하면 위에서 직접 문장을 다듬은 뒤 <b>선택 병합</b>하세요. 공개 도감은 승인 전까지 그대로입니다.</p>
        ${incomingRows||'<p>검수 항목은 현재 초안과 같습니다. 내용 확인 후 선택 병합하거나 취소해 주세요.</p>'}
        <div class="catalog-sheet-incoming-actions"><button type="button" id="catalogSheetMerge">선택한 결과로 비공개 병합 저장</button><button type="button" id="catalogSheetDiscard" class="secondary-admin-button">이 재검수 대기본 취소</button></div></section>`:'';
      const reviewStatuses=['검수 필요','초안','검수 완료'];
      const currentStatus=String(item.draft.review_status||'');
      if(currentStatus&&!reviewStatuses.includes(currentStatus))reviewStatuses.push(currentStatus);
      area.innerHTML=`<div class="catalog-sheet-dialog"><div class="catalog-sheet-review-head"><div><p class="catalog-sheet-eyebrow">FIELD REVIEW</p><h4 id="catalogSheetReviewTitle">${escape(item.draft.title)}</h4><p class="muted">${escape(item.draft.author)} · 초안 버전 ${item.sheet_revision}</p></div>
        <button type="button" data-sheet-close="1" class="secondary-admin-button">닫기</button></div>
        <p class="muted">${work?'기존 도감 데이터를 보존하고 선택한 항목에 검수 정보를 보완합니다.':'승인 전에는 사용자가 이 작품을 먼저 등록할 수 있습니다.'}
        ${collision?'⚠ 같은 제목·작가의 미연결 도감 작품이 있습니다. 원본 연결을 먼저 확인해 주세요.':''}</p>
        ${incomingPanel}<div class="catalog-sheet-diff-grid">${rows}</div>
        <div class="catalog-sheet-review-meta"><label>원고 검수 상태<select id="catalogSheetReviewStatus">${reviewStatuses.map(value=>`<option value="${escape(value)}" ${value===currentStatus?'selected':''}>${escape(value)}</option>`).join('')}</select></label>
        <label>검수 메모<textarea id="catalogSheetReviewNote" rows="4" maxlength="8000">${escape(item.draft.review_note||'')}</textarea></label>
        <div class="catalog-sheet-provenance"><strong>원본·재검수 참고정보</strong><p>${escape(item.draft.original_filename||'원본 파일명 미보충')}</p>
        <p>원본 번호: ${escape(item.draft.original_number||'—')} · 식별자: ${escape(item.draft.original_sha256||'—')}</p>
        <p class="catalog-sheet-provenance-path">${escape(item.draft.original_path||'원본 경로 미보충')}</p></div>
        <label>중복 참고<textarea data-review-meta="duplicate_note" rows="2" maxlength="500">${escape(item.draft.duplicate_note||'')}</textarea></label>
        <label>분석 범위<input data-review-meta="analysis_scope" maxlength="160" value="${escape(item.draft.analysis_scope||'')}"></label>
        <label>요약 진행 상태<input data-review-meta="summary_progress" maxlength="120" value="${escape(item.draft.summary_progress||'')}"></label>
        <label>재검수 기록 (날짜별로 이어서 추가)<textarea data-review-meta="recheck_log" rows="4" maxlength="8000" placeholder="예: 2026-10-15 · 원문 후반부 재확인, 인물 관계 수정 근거 등">${escape(item.draft.recheck_log||'')}</textarea></label>
        <div class="catalog-sheet-provenance"><strong>재검수 처리 현황</strong><p>이 패치 이후 기록 ${Number(item.recheck_count)||0}회 · 마지막 병합: ${item.last_recheck_merged_at?escape(new Date(Number(item.last_recheck_merged_at)).toLocaleString('ko-KR')):'없음'}</p><small>이 숫자는 새 재검수 기록이 추가된 Work 결과를 관리자가 비교·병합한 횟수입니다. 이전 메모는 소급 계산하지 않습니다.</small></div>
        <label>성적 묘사 판정<select data-review-meta="adult_scene_status">${['미확인','직접적 묘사','묘사 없음','확인 필요'].map(v=>`<option value="${escape(v)}" ${(item.draft.adult_scene_status||'미확인')===v?'selected':''}>${escape(v)}</option>`).join('')}</select></label>
        <label>성적 묘사 판정 근거<textarea data-review-meta="adult_scene_note" rows="3" maxlength="800" placeholder="구체적인 원문 장면의 맥락 및 확인 범위. 직접적인 본문 인용은 불필요합니다.">${escape(item.draft.adult_scene_note||'')}</textarea><small>원문 일부만 확인했다면 ‘묘사 없음’으로 단정하지 마세요. ‘직접적 묘사’는 주의사항 공개 반영 전 관리자 확인이 필요합니다.</small></label>
      </div>
        <p id="catalogSheetEditHint" class="catalog-sheet-edit-hint">검수 초안은 수정 후 별도 저장하며, 저장만으로 도감에 공개되지 않습니다.</p>
        <p id="catalogSheetModalStatus" class="catalog-sheet-modal-status" role="status" aria-live="polite"></p>
        <label class="catalog-sheet-publish"><input type="checkbox" id="catalogSheetPublish" ${(!work||work.status==='published')?'checked':''}> ${work?'승인하면서 비공개 작품인 경우 공개 전환':'신규 작품을 승인하고 공개 등록'}</label>
        <div class="catalog-sheet-history"><button type="button" id="catalogSheetHistoryLoad" class="secondary-admin-button">이전 초안·승인 버전 보기</button><p class="muted">복원은 공개 데이터를 직접 되돌리지 않고 비공개 초안만 새 버전으로 저장합니다.</p><div id="catalogSheetHistoryList" aria-live="polite"></div></div>
        <div class="catalog-sheet-approve-actions"><button id="catalogSheetSave" type="button" class="secondary-admin-button" disabled>비공개 초안 저장</button><button id="catalogSheetApprove" type="button" ${collision?'disabled':''}>선택 항목 도감에 반영</button></div></div>`;
      refreshDraftButtons();
      area.querySelector('[data-sheet-close]')?.focus();
    }catch(error){area.innerHTML=`<div class="catalog-sheet-dialog"><p>${escape(error.message)}</p><button type="button" data-sheet-close="1">닫기</button></div>`;}
  }
  function closeReview(force=false){
    if(state.loading&&!force)return;
    if(!force&&isDraftDirty()&&!confirm('저장하지 않은 초안 수정 내용이 있습니다. 저장하지 않고 닫을까요?'))return;
    ++state.reviewSeq;state.current=null;
    $('catalogSheetReview').hidden=true;document.body.classList.remove('catalog-sheet-dialog-open');
    if(state.lastFocus?.isConnected)state.lastFocus.focus();state.lastFocus=null;
  }
  function modalMessage(message,error=false){
    const el=$('catalogSheetModalStatus');
    if(el){el.textContent=message;el.style.color=error?'var(--sy-danger)':'';}
  }
  async function saveDraft(){
    const current=state.current;
    if(!current||state.loading||!isDraftDirty())return;
    const {item}=current;
    const draft=readDraftEditor();
    state.loading=true;refreshDraftButtons();modalMessage('수정한 검수 초안을 비공개 저장 중…');
    try{
      const checked=[...$('catalogSheetReview').querySelectorAll('input[name="sheetField"]:checked')].map(x=>x.value);
      const publish=$('catalogSheetPublish').checked;
      const result=await api({action:'save_draft',source_type:item.source_type,source_id:item.source_id,
        sheet_revision:item.sheet_revision,draft});
      await reload(true);
      state.loading=false;
      await openReview(item.source_type,item.source_id);
      const area=$('catalogSheetReview');
      for(const checkbox of area.querySelectorAll('input[name="sheetField"]')) checkbox.checked=checked.includes(checkbox.value);
      if(area.querySelector('#catalogSheetPublish'))$('catalogSheetPublish').checked=publish;
      modalMessage(result.changed?'비공개 초안 저장 완료. 원하는 항목을 선택해 승인할 수 있습니다.':'변경된 내용이 없습니다.');
      status(`${item.draft.title}: 검수 초안 저장 완료 · 도감 공개 내용은 변경되지 않았습니다.`);
    }catch(error){modalMessage(error.message,true);state.loading=false;refreshDraftButtons();}
    finally{state.loading=false;refreshDraftButtons();}
  }
  function applyIncoming(field){
    const incoming=state.current?.incoming;
    if(!incoming||!Object.prototype.hasOwnProperty.call(incoming.draft,field))return;
    const area=$('catalogSheetReview');
    const element=area.querySelector(`[data-sheet-edit="${field}"],[data-review-meta="${field}"]`) ||
      (field==='review_status'?area.querySelector('#catalogSheetReviewStatus'):field==='review_note'?area.querySelector('#catalogSheetReviewNote'):null);
    if(!element)return;
    element.value=displayDraftField(incoming.draft[field]);
    if(field==='review_status'&&element.value!==incoming.draft[field]){
      const opt=document.createElement('option');opt.value=incoming.draft[field];opt.textContent=incoming.draft[field];element.append(opt);element.value=opt.value;
    }
    refreshDraftButtons();
    modalMessage(`${names[field]||field}: 재검수안이 편집란에 복사됐습니다. 다른 부분도 선택하거나 직접 조합한 뒤 병합 저장하세요.`);
  }
  async function mergeIncoming(){
    const current=state.current;if(!current?.incoming||state.loading)return;
    const {item}=current,draft=readDraftEditor();
    if(!confirm(`${item.draft.title}: 화면에 작성한 최종 내용으로 비공개 초안을 병합할까요?\n현재 공개 작품과 마지막 승인 내용은 아직 변경되지 않습니다.`))return;
    state.loading=true;refreshDraftButtons();
    try{
      await api({action:'merge_incoming',source_type:item.source_type,source_id:item.source_id,sheet_revision:item.sheet_revision,draft});
      await reload(true);state.loading=false;await openReview(item.source_type,item.source_id);
      modalMessage('재검수 결과 병합 완료. 새 검수 기록이 있다면 누적 횟수에 반영됩니다. 공개 내용은 별도로 승인해야 합니다.');
    }catch(e){modalMessage(e.message,true);}finally{state.loading=false;refreshDraftButtons();}
  }
  async function discardIncoming(){
    const current=state.current;if(!current?.incoming||state.loading)return;
    if(!confirm('이 Work 재검수 대기본만 삭제할까요? 관리자 초안과 공개 작품은 그대로 유지됩니다.'))return;
    const {item}=current;state.loading=true;
    try{
      await api({action:'discard_incoming',source_type:item.source_type,source_id:item.source_id,sheet_revision:item.sheet_revision});
      await reload(true);state.loading=false;await openReview(item.source_type,item.source_id);
      modalMessage('재검수 대기본을 취소했습니다. 기존 관리자 초안은 유지됩니다.');
    }catch(e){modalMessage(e.message,true);}finally{state.loading=false;refreshDraftButtons();}
  }
  async function showHistory(){
    const item=state.current?.item;if(!item||state.loading)return;
    const list=$('catalogSheetHistoryList');list.textContent='이전 버전을 불러오는 중…';
    try{
      const out=await api(null,'?'+new URLSearchParams({history:'1',source_type:item.source_type,source_id:item.source_id}));
      const actions={before_manual_edit:'수동 수정 전',before_recheck_merge:'재검수 병합 전',before_history_restore:'복원 전',before_public_approval:'공개 승인 전'};
      list.innerHTML=out.items?.length?out.items.map((entry)=>{
        const old=entry.snapshot?.draft||{};
        const preview=`줄거리: ${old.synopsis||'—'}\n장르: ${displayDraftField(old.genres)||'—'}\n키워드: ${displayDraftField(old.tags)||'—'}\n추천 대상: ${old.recommendation||'—'}\n검수 상태: ${old.review_status||'—'}\n검수 메모: ${old.review_note||'—'}\n재검수 기록: ${old.recheck_log||'—'}\n성적 묘사 판정: ${old.adult_scene_status||'미확인'}\n당시 승인된 엑셀 줄거리: ${entry.snapshot?.applied?.synopsis?.source||'—'}`;
        return `<details class="catalog-sheet-history-entry"><summary>${escape(actions[entry.event_type]||entry.event_type)} · 이전 초안 v${Number(entry.sheet_revision)} · ${escape(new Date(entry.created_at).toLocaleString('ko-KR'))}</summary><pre>${escape(preview)}</pre><button type="button" class="secondary-admin-button" data-sheet-restore="${escape(entry.id)}">이 버전을 비공개 초안으로 복원</button></details>`;
      }).join(''):'<p class="muted">이 패치 도입 후 생성된 변경 이력이 없습니다. 이후 편집부터 이전 내용이 보관됩니다.</p>';
    }catch(e){list.textContent=e.message;}
  }
  async function restoreHistory(id){
    const current=state.current;if(!current||state.loading)return;
    if(current.incoming){modalMessage('재검수 대기본부터 병합하거나 취소해 주세요.',true);return;}
    if(isDraftDirty()){modalMessage('현재 편집 중인 내용을 저장하거나 다시 열어 정리해 주세요.',true);return;}
    if(!confirm('선택한 이전 버전을 새로운 비공개 초안으로 복원할까요?\n기존 승인 기록과 현재 공개 작품은 그대로 유지됩니다. 실제 도감 변경은 별도 승인이 필요합니다.'))return;
    const {item}=current;state.loading=true;
    try{
      const result=await api({action:'restore_history',source_type:item.source_type,source_id:item.source_id,sheet_revision:item.sheet_revision,history_id:id});
      await reload(true);state.loading=false;await openReview(item.source_type,item.source_id);
      modalMessage(result.changed?'이전 내용을 새 비공개 초안으로 복원했습니다. 공개 도감은 변경되지 않았습니다.':'이미 현재 초안과 동일한 내용입니다.');
    }catch(e){modalMessage(e.message,true);}finally{state.loading=false;refreshDraftButtons();}
  }
  async function approve(){
    const current=state.current;if(!current||state.loading)return;
    if(isDraftDirty()){modalMessage('수정한 내용을 먼저 비공개 초안으로 저장해 주세요.',true);return;}
    const fields=[...$('catalogSheetReview').querySelectorAll('input[name="sheetField"]:checked')].map(x=>x.value);
    if(!fields.length){modalMessage('반영할 항목을 하나 이상 선택해 주세요.',true);return;}
    const {item}=current;
    if(!confirm(`${item.draft.title}의 ${fields.map(x=>names[x]).join(', ')} 항목을 실제 도감에 반영할까요?\n기존 정보는 보존하며, 성적 묘사 여부는 독립된 주의사항으로 반영됩니다.`))return;
    state.loading=true;
    const b=$('catalogSheetApprove');b.disabled=true;
    try{
      const out=await api({action:'approve',source_type:item.source_type,source_id:item.source_id,
        sheet_revision:item.sheet_revision,fields,publish:$('catalogSheetPublish').checked});
      closeReview(true);
      await reload(true);status(`${item.draft.title}: ${fields.map(f=>names[f]).join('·')} 반영 완료${out.created?' (관리자 신규 등록)':''}.`);
    }catch(e){modalMessage(e.message,true);b.disabled=false;}
    finally{state.loading=false;}
  }
  $('catalogSheetFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)void importExcel(file);});
  $('catalogSheetExport').addEventListener('click',()=>void exportExcel());
  $('catalogSheetReload').addEventListener('click',()=>void reload());
  $('catalogSheetSearch').addEventListener('input',()=>{state.limit=50;displayList();});
  $('catalogSheetFilter').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetReviewFilter').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetLinkFilter').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetIncomingFilter').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetAdultFilter').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetSort').addEventListener('change',()=>{state.limit=50;displayList();});
  $('catalogSheetMore').addEventListener('click',()=>{state.limit+=50;displayList();});
  $('catalogSheetList').addEventListener('click',event=>{
    const target=event.target.closest('button[data-sheet-id]');
    if(target)void openReview(target.dataset.sheetType,target.dataset.sheetId);
  });
  document.addEventListener('keydown',event=>{
    const area=$('catalogSheetReview');if(area.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeReview();}
    else if(event.key==='Tab'){
      const focusable=[...area.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])')];
      if(!focusable.length)return;
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  $('catalogSheetReview').addEventListener('input',event=>{if(event.target.matches('[data-sheet-edit],[data-review-meta],#catalogSheetReviewNote'))refreshDraftButtons();});
  $('catalogSheetReview').addEventListener('change',event=>{if(event.target.matches('[data-sheet-edit],[data-review-meta],#catalogSheetReviewStatus'))refreshDraftButtons();});
  $('catalogSheetReview').addEventListener('click',event=>{
    if(event.target===$('catalogSheetReview')||event.target.closest('[data-sheet-close]'))closeReview();
    else if(event.target.closest('#catalogSheetSave'))void saveDraft();
    else if(event.target.closest('#catalogSheetApprove'))void approve();
    else if(event.target.closest('[data-copy-incoming]'))applyIncoming(event.target.closest('[data-copy-incoming]').dataset.copyIncoming);
    else if(event.target.closest('#catalogSheetMerge'))void mergeIncoming();
    else if(event.target.closest('#catalogSheetDiscard'))void discardIncoming();
    else if(event.target.closest('#catalogSheetHistoryLoad'))void showHistory();
    else if(event.target.closest('[data-sheet-restore]'))void restoreHistory(event.target.closest('[data-sheet-restore]').dataset.sheetRestore);
  });
})();
