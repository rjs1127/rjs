// v10.52: original TXT/POSTYPE registered items -> catalogue edit dialog.
// Original source data is read only; all writes use the dedicated catalogue D1 tables.
(() => {
  const $ = id => document.getElementById(id);
  const form = $('catalogWorkForm');
  if (!form) return;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields = ['title','author','original_title','country','completion','genres','tags','synopsis','subcouple','subcouple_note','recommendation','warnings'];
  let sources = [], works = [], links = [], proposals = [], current = null, opener = null;
  let sourceErrors = [], shown = 50, busy = false, loaded = false, loadId = 0, dialogId = 0;

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
    $('catalogProposalList').innerHTML=proposals.length?proposals.map(p=>{
      const f=p.payload||{};
      let genres=[],tags=[];
      try{genres=JSON.parse(f.genre_json||'[]'); tags=JSON.parse(f.tags_json||'[]');}catch{}
      const details=[p.work_id&&`대상 작품 ID: ${p.work_id}`,f.author&&`작가: ${f.author}`,
        genres.length&&`장르: ${genres.join(', ')}`,tags.length&&`키워드: ${tags.join(', ')}`,
        f.synopsis&&`줄거리: ${f.synopsis}`,f.subcouple_note&&`서브커플: ${f.subcouple_note}`,
        f.recommendation&&`추천: ${f.recommendation}`].filter(Boolean).join('\n');
      return `<article class="catalog-admin-record"><strong>${p.kind==='create'?'신규 등록 제안':'수정 제안'} · ${escapeHtml(f.title)}</strong>
        <small>${new Date(p.created_at).toLocaleString('ko-KR')}</small><pre>${escapeHtml(details)}</pre>
        <div class="catalog-admin-record-actions"><button type="button" data-review="approved" data-id="${escapeHtml(p.id)}">승인</button><button type="button" data-review="rejected" data-id="${escapeHtml(p.id)}">반려</button></div></article>`;
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
        (field==='title'?source?.title||'':field==='author'?source?.author||'':field==='genres'?source?.genre||'':'');
    }
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
      work[f]=['genres','tags'].includes(f)?input.value.split(',').map(x=>x.trim()).filter(Boolean):input.value;
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
    const work=getForm(),status=$('catalogStatus').value;
    const payload=current.source?{action:'upsert_source',source_type:current.source.type,source_id:current.source.id,work,status}:
      {action:'save_work',id:current.work?.id,work,status};
    if(status==='published'&&current.work?.status!=='published'&&!confirm('이 작품 정보를 공개 조회 API에 게시할까요?'))return;
    await mutate(payload,'도감 정보를 저장했습니다.',true);
  });
  $('catalogDelete').addEventListener('click',async()=>{
    if(!current?.work||current.loading||busy)return;
    const {work,linkedSources}=current;
    const desc=`${work.title}의 도감 정보와 연결 ${linkedSources.length}건, 관련 수정 제안·이력을 완전히 삭제합니다.\nTXT 파일 및 POSTYPE 원본은 삭제되지 않습니다.`;
    if(!confirm(desc+'\n\n이 작업은 되돌릴 수 없습니다.'))return;
    if(prompt('확인하려면 삭제를 입력해 주세요.')!=='삭제')return;
    await mutate({action:'delete',id:work.id},'도감 정보와 관련 도감 데이터가 완전히 삭제되었습니다.',true);
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
