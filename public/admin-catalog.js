// v10.53: source-linked catalogue editor with keyword chips and independent recommendation lines.
// Original source data is read only; all writes use the dedicated catalogue D1 tables.
(() => {
  const $ = id => document.getElementById(id);
  const form = $('catalogWorkForm');
  if (!form) return;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields = ['title','author','original_title','country','completion','genres','tags','synopsis','subcouple','subcouple_note','recommendation','warnings'];
  let sources = [], works = [], links = [], proposals = [], current = null, opener = null;
  let sourceErrors = [], shown = 50, busy = false, loaded = false, loadId = 0, dialogId = 0;
  let tagTokens = [], recommendationRows = [];
  const cleanToken = value => String(value||'').normalize('NFKC').trim().replace(/^#+\s*/, '').trim();
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
  function linkedMap(){return new Map(links.map(l=>[key(l.source_type,l.source_id),l.work_id]));}
  function workMap(){return new Map(works.map(w=>[w.id,w]));}
  function renderStandalone(){
    const ids=new Set(links.map(l=>l.work_id));
    const orphans=works.filter(w=>!ids.has(w.id));
    $('catalogStandaloneCount').textContent=`(${orphans.length}건)`;
    $('catalogStandaloneList').innerHTML=orphans.length?orphans.map(w=>
      `<button type="button" data-work-id="${escapeHtml(w.id)}"><span><strong>${escapeHtml(w.title)}</strong><small>${escapeHtml(w.author||'작가 미등록')} · ${statuses[w.status]||'미확인'}</small></span><span aria-hidden="true">›</span></button>`
    ).join(''):'<p class="muted">원본에 연결되지 않은 작품이 없습니다.</p>';
  }
  function renderSourceList(){
    const q=$('catalogSearch').value.trim().normalize('NFKC').toLocaleLowerCase();
    const filter=$('catalogSourceFilter').value, state=$('catalogFilter').value;
    const lm=linkedMap(), wm=workMap();
    const filtered=sources.filter(s=>{
      if(filter!=='all' && s.type!==filter) return false;
      if(q && !`${s.title} ${s.author} ${s.id} ${s.combination||''}`.normalize('NFKC').toLocaleLowerCase().includes(q)) return false;
      const id=lm.get(key(s.type,s.id)); const w=wm.get(id);
      if(state==='none') return !id;
      if(state==='linked') return !!id;
      if(state==='published'||state==='draft') return !!id && w?.status===state;
      return true;
    });
    $('catalogCounts').textContent=`(${filtered.length.toLocaleString('ko-KR')}건 / 원본 ${sources.length.toLocaleString('ko-KR')}건)`;
    $('catalogWorkList').innerHTML=filtered.length?filtered.slice(0,shown).map(s=>{
      const id=lm.get(key(s.type,s.id)); const w=wm.get(id);
      const status=id?(w?statuses[w.status]:'정보 등록됨'):'정보 미등록';
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
    const result=await api(null,'?status=all');
    works=result.works||[]; links=result.links||[]; proposals=result.proposals||[];
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
            next.push({type,id,title:String(x.title||''),author:String(x.author||''),genre:String(x.genre||''),combination:String(x.combination||'')});
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
    ++dialogId; $('catalogEditorOverlay').hidden=true;
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
    form.elements.namedItem('completion').value=work?.completion||'unknown';
    form.elements.namedItem('subcouple').value=work?.subcouple||'unknown';
    tagTokens=(Array.isArray(work?.tags)?work.tags:[]).map(cleanToken).filter(Boolean);renderTags();
    recommendationRows=work?.recommendation?String(work.recommendation).split(/\n\s*\n/):[''];
    renderRecommendations();
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
  $('catalogProposalList').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-review]');if(!b||busy)return;
    const verdict=b.dataset.review;
    if(!confirm(verdict==='approved'?'이 정보 제안을 승인할까요? 신규 작품은 비공개 초안으로 생성됩니다.':'이 정보 제안을 반려할까요?'))return;
    await mutate({action:'review',id:b.dataset.id,verdict},'정보 제안을 처리했습니다.');
  });
  window.addEventListener('admin:tab',e=>{if(e.detail?.name==='work-catalog')reload(!loaded);});
  if(!document.querySelector('[data-tab-panel="work-catalog"]')?.hidden)reload(true);
})();
