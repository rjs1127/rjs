/* v10.68 · Public work encyclopedia with authenticated direct edits; private reading data remains separate. */
(() => {
  'use strict';
  const root = document.getElementById('workCatalogPage');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const refs = {
    browse: $('wcCatalogBrowser'), detail: $('wcCatalogDetail'),
    form: $('wcSearchForm'), query: $('wcSearchInput'), genres: $('wcGenreChoices'),
    tags: $('wcTagChoices'), filter: $('wcFilterPanel'), filterToggle: $('wcFilterToggle'),
    filterBadge: $('wcFilterBadge'), completion: $('wcCompletionFilter'),
    cp: $('wcCpFilter'), subcouple: $('wcSubcoupleFilter'), sort: $('wcSortSelect'),
    reset: $('wcResetFilters'), active: $('wcActiveFilters'),
    status: $('wcCatalogStatus'), cards: $('wcCatalogCards'),
    more: $('wcMoreWrap'), moreButton: $('wcMoreButton'), meta: $('wcResultsMeta')
  };
  const data = {
    query:'', cp:'', genre:'', tags:[], tagMode:'all', completion:'', subcouple:'', sort:'recent',
    genres:[], tagOptions:[], items:[], nextPage:1, hasMore:false,
    loaded:false, loading:false, seq:0, abort:null, filtersLoaded:false, detailId:'',
    quoteItems:[], quoteCursor:null, quoteAbort:null, quoteLoading:false,
    detailSeq:0, detailAbort:null, currentWork:null, editSaving:false, previousScroll:0, lastFocus:null, debounce:null
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const statusLabel = {unknown:'미확인',ongoing:'연재 중',completed:'완결',incomplete:'미완',hiatus:'휴재'};
  const coupleLabel = {unknown:'미확인',yes:'있음',no:'없음'};
  const validId = id => /^[0-9a-f-]{36}$/i.test(String(id));
  const arr = values => Array.isArray(values) ? values.filter(v => typeof v === 'string').slice(0,20) : [];
  const coverStyle = (work, index) => {
    const colors = ['ink','plum','moss','rose','slate','ochre'];
    let hash=0;
    for (const c of String(work.id || work.title || index)) hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
    return colors[(hash>>>0)%colors.length];
  };
  const cover = (work,index,large=false) => `<div class="wc-book wc-book--${coverStyle(work,index)}${large?' wc-book--large':''}" aria-hidden="true"><span class="wc-book-mark">✦</span></div>`;
  const isOpen = () => !root.hidden;
  function showStatus(message,kind='info') {
    refs.status.hidden=false;
    refs.status.dataset.kind=kind;
    refs.status.textContent=message;
  }
  function hideStatus() { refs.status.hidden=true; refs.status.textContent=''; }
  function announceMeta() {
    refs.meta.textContent=data.loading ? '작품을 불러오는 중…' : `${data.items.length}개 표시 중${data.hasMore?' · 더 보기 가능':''}`;
  }
  function pills() {
    const entries=[{value:'',count:0},...data.genres];
    refs.genres.innerHTML=entries.map(({value})=>`<button class="wc-genre${data.genre===value?' is-active':''}" type="button" data-wc-genre="${escapeHtml(value)}" aria-pressed="${data.genre===value}">${value?escapeHtml(value):'전체 작품'}</button>`).join('');
  }
  function tags() {
    const choices=[...new Set([...data.tags,...data.tagOptions.map(t=>t.value)])].slice(0,40);
    refs.tags.innerHTML=choices.length ? choices.map(tag=>`<button type="button" class="wc-tag${data.tags.includes(tag)?' is-active':''}" data-wc-tag="${escapeHtml(tag)}" aria-pressed="${data.tags.includes(tag)}">#${escapeHtml(tag)}</button>`).join('') : '<p class="wc-filter-hint">공개된 작품의 키워드가 아직 없어요.</p>';
    root.querySelectorAll('[data-wc-mode]').forEach(button=>{
      const selected=button.dataset.wcMode===data.tagMode;
      button.classList.toggle('is-active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  function activeFilters() {
    const entries=[];
    if (data.cp) entries.push(['cp',`CP ${data.cp}`]);
    if (data.genre) entries.push(['genre',data.genre]);
    for(const tag of data.tags) entries.push(['tag',`#${tag}`,tag]);
    if(data.completion) entries.push(['completion',statusLabel[data.completion]||data.completion]);
    if(data.subcouple) entries.push(['subcouple',`서브커플 ${coupleLabel[data.subcouple]||data.subcouple}`]);
    refs.active.hidden=!entries.length;
    refs.active.innerHTML=entries.map(([type,label,value])=>`<button type="button" data-wc-remove="${type}" data-wc-value="${escapeHtml(value||'')}" aria-label="${escapeHtml(label)} 필터 해제">${escapeHtml(label)} ×</button>`).join('');
    refs.filterBadge.textContent=entries.length?`${entries.length}`:'';
  }
  function updateFilters() {pills(); tags(); activeFilters();}
  function makeCard(work,index) {
    const title=escapeHtml(work.title || '제목 미상');
    const author=escapeHtml(work.author || '작가 미확인');
    const mainCp=arr(work.main_couples).map(escapeHtml).join(' · ');
    const genres=arr(work.genres).slice(0,2), tagLabels=arr(work.tags).slice(0,3);
    return `<article class="wc-card"><button type="button" class="wc-card-open" data-wc-open="${escapeHtml(work.id)}" aria-label="${title} 작품 정보 보기">
      ${cover(work,index)}<span class="wc-card-main"><span class="wc-card-heading">${title}</span><span class="wc-card-author">${author}</span>${mainCp?`<span class="wc-card-author">CP · ${mainCp}</span>`:''}
      <span class="wc-card-tags">${[...genres,...tagLabels.map(t=>'#'+t)].map(tag=>`<span>${escapeHtml(tag)}</span>`).join('') || '<span>분류 정보 미등록</span>'}</span>
      <span class="wc-card-bottom"><span>${escapeHtml(statusLabel[work.completion]||'미확인')}</span><span class="wc-card-arrow">↗</span></span></span></button></article>`;
  }
  function renderItems() {
    refs.cards.innerHTML=data.items.map(makeCard).join('');
    refs.more.hidden=!data.hasMore || data.loading;
    refs.moreButton.disabled=data.loading;
    announceMeta();
    if(!data.items.length && !data.loading && !refs.status.hidden) return;
    if(!data.items.length && !data.loading) {
      const filtered=Boolean(data.query||data.cp||data.genre||data.tags.length||data.completion||data.subcouple);
      showStatus(filtered?'검색 조건에 맞는 공개 작품이 없어요. 필터를 바꿔보세요.':'아직 공개된 작품 정보가 없어요. 위의 + 작품 등록 버튼으로 첫 작품을 기록해 보세요.','empty');
    }
  }
  function queryParams(page) {
    const params = new URLSearchParams({page:String(page),sort:data.sort});
    if(data.cp) params.set('cp',data.cp);
    if(data.query) params.set('q',data.query);
    if(data.genre) params.set('genre',data.genre);
    data.tags.forEach(tag=>params.append('tag',tag));
    if(data.tags.length) params.set('tag_mode',data.tagMode);
    if(data.completion) params.set('completion',data.completion);
    if(data.subcouple) params.set('subcouple',data.subcouple);
    return params;
  }
  async function loadItems({append=false}={}) {
    if(append && (!data.hasMore || data.loading)) return;
    data.abort?.abort();
    data.abort=new AbortController();
    const signal=data.abort.signal;
    const sequence=++data.seq;
    const page=append?data.nextPage:1;
    data.loading=true;
    if(!append) {data.items=[];refs.cards.innerHTML='';showStatus('작품을 불러오는 중…');}
    refs.moreButton.disabled=true;
    announceMeta();
    try {
      const response=await fetch(`/api/work-catalog?${queryParams(page)}`,{signal,credentials:'same-origin'});
      const json=await response.json();
      if(!response.ok || !Array.isArray(json.items)) throw new Error(json.error||'목록 조회 실패');
      if(sequence!==data.seq) return;
      const items=json.items.filter(work=>work&&validId(work.id));
      data.items=append?[...data.items,...items.filter(item=>!data.items.some(w=>w.id===item.id))]:items;
      data.nextPage=page+1;
      data.hasMore=Boolean(json.hasMore);
      data.loaded=true;
      hideStatus();
    } catch(error) {
      if(signal.aborted||sequence!==data.seq) return;
      if(!append) data.items=[];
      showStatus('작품 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.','error');
      data.loaded=false;
    } finally {
      if(sequence===data.seq) {data.loading=false;renderItems();}
    }
  }
  async function loadFilters() {
    if(data.filtersLoaded)return;
    try {
      const response=await fetch('/api/work-catalog/filters',{credentials:'same-origin'});
      const json=await response.json();
      if(!response.ok) throw Error();
      refs.cp.innerHTML='<option value="">전체</option>'+(Array.isArray(json.couples)?json.couples:[]).map(row=>`<option value="${escapeHtml(row.value)}">${escapeHtml(row.value)}</option>`).join('');
      refs.cp.value=data.cp;
      data.genres=Array.isArray(json.genres)?json.genres.filter(row=>row && typeof row.value==='string').slice(0,24):[];
      data.tagOptions=Array.isArray(json.tags)?json.tags.filter(row=>row&&typeof row.value==='string').slice(0,36):[];
      data.filtersLoaded=true;
      updateFilters();
    }catch(_error){
      refs.tags.innerHTML='<p class="wc-filter-hint">필터 목록을 불러오지 못했어요. 검색창으로도 작품을 찾을 수 있어요.</p>';
    }
  }
  function changed() {
    data.loaded=false;
    updateFilters();
    if(data.debounce)clearTimeout(data.debounce);
    data.debounce=setTimeout(()=>{data.debounce=null;if(isOpen())loadItems();},220);
  }
  function resetFilters() {
    data.cp='';refs.cp.value='';data.genre='';data.tags=[];data.tagMode='all';data.completion='';data.subcouple='';data.sort='recent';data.query='';
    refs.query.value='';refs.completion.value='';refs.subcouple.value='';refs.sort.value='recent';
    changed();
  }
  const recommendationLines=value=>String(value||'').split(/\n\s*\n|\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,12);
  const displayText = (value,fallback='정보 미등록') => value ? escapeHtml(value) : `<span class="wc-muted">${fallback}</span>`;
  function renderDetail(work) {
    closeMobileFilters();
    const genres=arr(work.genres),tagsList=arr(work.tags),recommendations=recommendationLines(work.recommendation);
    const heading=escapeHtml(work.title||'제목 미상');
    const tagRows=(list,prefix)=>list.map(label=>`<span class="wc-detail-tag">${prefix}${escapeHtml(label)}</span>`).join('');
    const alertText=String(work.warnings||'').trim(),subNote=String(work.subcouple_note||'').trim();
    const effectiveCompletion=work.completion==='unknown'?(work.source_completion||'unknown'):work.completion;
    const mappedCompletion=work.completion==='unknown'&&Boolean(work.source_completion);
    refs.detail.innerHTML=`<div class="wc-detail-top"><button type="button" class="wc-detail-back" data-wc-back>← 작품 목록으로</button><div id="wcOriginalLinks" class="wc-source-links" aria-live="polite"></div></div>
      <div class="wc-detail-hero">${cover(work,0,true)}<div class="wc-detail-heading"><h3 id="wcDetailHeading" tabindex="-1">${heading}</h3><p class="wc-detail-author">${escapeHtml(work.author||'작가 미확인')}</p>${work.original_title?`<p class="wc-detail-original">원제 · ${escapeHtml(work.original_title)}</p>`:''}
      <div class="wc-detail-properties">${arr(work.main_couples).map(cp=>`<span>CP · ${escapeHtml(cp)}</span>`).join('')}<span>${escapeHtml(statusLabel[effectiveCompletion]||'미확인')}</span></div>
      </div></div>
      <div class="wc-detail-grid"><div class="wc-detail-primary">
        <section class="wc-detail-section"><span class="wc-section-num">01 / THE STORY</span><div class="wc-section-title-row"><h4>작품 소개</h4><button type="button" class="wc-inline-edit" data-wc-edit="synopsis_set" aria-label="작품 소개 ${String(work.synopsis||'').trim()?'수정':'추가'}">${String(work.synopsis||'').trim()?'수정':'추가'}</button></div><div class="wc-story-text">${displayText(work.synopsis,'등록된 줄거리가 아직 없어요.')}</div></section>
        <section class="wc-detail-section"><span class="wc-section-num">02 / KEYWORDS</span><div class="wc-section-title-row"><h4>장르와 키워드</h4></div>
          <div class="wc-subsection-title-row"><span class="wc-detail-tag-label">장르</span><button type="button" class="wc-inline-edit" data-wc-edit="genre_add" aria-label="장르 추가">추가</button></div><div class="wc-detail-tagline">${genres.length?tagRows(genres,''):'<span class="wc-muted">장르 미등록</span>'}</div>
          <div class="wc-subsection-title-row"><span class="wc-detail-tag-label">취향 키워드</span><button type="button" class="wc-inline-edit" data-wc-edit="tag_add" aria-label="키워드 추가">추가</button></div><div class="wc-detail-tagline">${tagsList.length?tagRows(tagsList,'#'):'<span class="wc-muted">키워드 미등록</span>'}</div></section>
        <section class="wc-detail-section"><span class="wc-section-num">03 / FOR READERS</span><div class="wc-section-title-row"><h4>이런 독자에게 추천해요</h4><button type="button" class="wc-inline-edit" data-wc-edit="recommendation_add" aria-label="추천 문구 추가">추가</button></div>${recommendations.length?`<ul class="wc-recommendations">${recommendations.map(line=>`<li>${escapeHtml(line)}</li>`).join('')}</ul>`:'<p class="wc-muted">추천 대상 정보가 아직 없어요.</p>'}</section>
        <section class="wc-detail-section"><span class="wc-section-num">04 / QUOTES</span><div class="wc-section-title-row"><h4>작품 속 문장</h4></div><div id="wcWorkQuotes" aria-live="polite"></div></section>
      </div><aside class="wc-detail-side"><section class="wc-detail-facts"><span class="wc-section-num">INFORMATION</span><div class="wc-section-title-row"><h4>작품 기본 정보</h4></div>
        <dl><div class="wc-fact-row"><dt>메인 커플 (CP)</dt><dd>${displayText(arr(work.main_couples).join(' · '))}</dd></div><div class="wc-fact-row wc-fact-row-editable"><dt>연재 상태</dt><dd>${escapeHtml(statusLabel[effectiveCompletion]||'미확인')}${mappedCompletion?'<small class="wc-mapped-status">원본 분류 기준</small>':''}</dd><button type="button" class="wc-inline-edit" data-wc-edit="completion_set" aria-label="연재 상태 수정">수정</button></div></dl>
        <details class="wc-extra-facts"><summary>부가 정보 <span>서브커플 등</span></summary>
          <div class="wc-extra-facts-body"><div class="wc-extra-facts-row"><span>서브커플</span><strong>${escapeHtml(coupleLabel[work.subcouple]||'미확인')}</strong><button type="button" class="wc-inline-edit" data-wc-edit="subcouple_update" aria-label="서브커플 유무 및 설명 수정">수정</button></div>
            ${subNote?`<details class="wc-spoiler"><summary>상세 설명 보기 <span>스포일러 주의</span></summary><p>${escapeHtml(subNote)}</p></details>`:''}
          </div>
        </details>
        <details class="wc-spoiler wc-warnings"><summary>주의사항 · 호불호 요소 <span>${alertText?'펼쳐 보기':'정보 미등록'}</span></summary><div class="wc-warning-content"><div class="wc-subsection-title-row"><span class="wc-detail-tag-label">등록된 정보</span><button type="button" class="wc-inline-edit" data-wc-edit="warnings_set" aria-label="주의사항과 호불호 요소 ${alertText?'수정':'추가'}">${alertText?'수정':'추가'}</button></div><p>${displayText(alertText,'등록된 정보가 없어요.')}</p></div></details></section>
        <div class="wc-detail-note"><strong>함께 채워가는 도감</strong><p>읽은 작품의 정보를 함께 기록해요. 로그인 후 수정하면 승인 대기 없이 도감에 반영됩니다.</p><button type="button" class="wc-edit-entry" data-wc-edit-menu>+ 작품 정보 보완하기</button>
          <details class="wc-history"><summary>수정 이력 보기</summary><div class="wc-history-items" data-wc-history-items>펼치면 최근 이력을 불러와요.</div></details></div>
      </aside></div>`;
  }
  async function loadWorkHistory(details) {
    const el=details.querySelector('[data-wc-history-items]');
    const id=data.detailId;
    if(!el||!id||details.dataset.loaded===id)return;
    el.textContent='이력을 불러오는 중…';
    try {
      const response=await fetch('/api/work-catalog/history?id='+encodeURIComponent(id),{cache:'no-store'});
      const json=await response.json();
      if(!response.ok||!Array.isArray(json.items))throw Error();
      if(id!==data.detailId||!details.isConnected)return;
      details.dataset.loaded=id;
      el.innerHTML=json.items.length?json.items.map(item=>`<div class="wc-history-item"><span>${escapeHtml(item.label)}</span><time>${escapeHtml(new Date(item.created_at).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}))}</time></div>`).join(''):'<p class="wc-muted">표시할 최근 수정 이력이 없어요.</p>';
    }catch(error){if(id===data.detailId && details.isConnected)el.textContent='이력을 가져오지 못했어요. 다시 접어 펼쳐 주세요.';}
  }
  async function loadSourceLinks(workId) {
    const element=$('wcOriginalLinks');if(!element)return;
    element.textContent='';
    try {
      const response=await fetch(`/api/work-catalog/links?id=${encodeURIComponent(workId)}`,{credentials:'same-origin',cache:'no-store'});
      const json=await response.json();
      if(!response.ok || !Array.isArray(json.items))throw Error();
      if(workId!==data.detailId || element!==$('wcOriginalLinks'))return;
      const links=json.items.filter(v=>['drive','postype'].includes(v.source_type)&&typeof v.source_id==='string');
      element.innerHTML=links.length?links.map(v=>`<button type="button" class="wc-source-open" data-wc-source-type="${escapeHtml(v.source_type)}" data-wc-source-id="${escapeHtml(v.source_id)}">${links.length>1?(v.source_type==='drive'?'TXT로 보기 ↗':'POSTYPE 보기 ↗'):'보러가기 ↗'}</button>`).join(''):'';
    }catch(error){if(workId===data.detailId && element===$('wcOriginalLinks'))element.textContent='';}
  }
  function renderWorkQuotes(message='',error=false) {
    const box=$('wcWorkQuotes');if(!box)return;
    box.innerHTML=data.quoteItems.map(quote=>`<details class="wc-work-quote"><summary><span>${escapeHtml(String(quote.quote_text||'').replace(/\s+/g,' '))}</span></summary><p>${escapeHtml(quote.quote_text)}</p></details>`).join('')+
      (message?`<p class="wc-muted" ${error?'role="alert"':''}>${escapeHtml(message)}</p>`:'')+
      (!data.quoteItems.length&&!message?'<p class="wc-muted">아직 공개된 문장이 없습니다.</p>':'')+
      (data.quoteCursor||error?`<button class="wc-detail-back" type="button" data-wc-quotes-more ${data.quoteLoading?'disabled':''}>${error?'다시 시도':'문장 더 보기'}</button>`:'');
  }
  async function loadWorkQuotes({append=false}={}) {
    if(data.quoteLoading||!data.detailId)return;
    const id=data.detailId,sequence=data.detailSeq;
    data.quoteAbort?.abort();const controller=new AbortController();data.quoteAbort=controller;
    data.quoteLoading=true;renderWorkQuotes('공개 문장을 불러오는 중…');
    try {
      const params=new URLSearchParams({id});
      if(append&&data.quoteCursor)params.set('cursor',data.quoteCursor);
      const response=await fetch('/api/work-catalog/quotes?'+params,{signal:controller.signal,credentials:'same-origin',cache:'no-store'});
      const json=await response.json();
      if(!response.ok||!Array.isArray(json.items))throw Error('문장 조회 실패');
      if(sequence!==data.detailSeq||id!==data.detailId)return;
      data.quoteItems=append?[...data.quoteItems,...json.items.filter(q=>!data.quoteItems.some(old=>old.quote_id===q.quote_id))]:json.items;
      data.quoteCursor=json.nextCursor||null;data.quoteLoading=false;renderWorkQuotes();
    }catch(error){
      if(controller.signal.aborted||sequence!==data.detailSeq)return;
      data.quoteLoading=false;renderWorkQuotes('공개 문장을 불러오지 못했어요. 다시 시도해 주세요.',true);
    }
  }
  async function openDetail(id,{push=true}={}) {
    if(!validId(id))return;
    const active=root.querySelector(`[data-wc-open="${CSS.escape(id)}"]`);
    if(active)data.lastFocus=active;
    data.previousScroll=Math.max(0,window.scrollY||0);
    data.quoteAbort?.abort();data.quoteLoading=false;
    data.detailId=id;
    refs.browse.hidden=true;refs.detail.hidden=false;
    refs.detail.innerHTML='<p class="wc-catalog-status">작품 정보를 불러오는 중…</p>';
    window.scrollTo({top:0,behavior:'auto'});
    if(push&&!history.state?.rjsWorkCatalogDetailId)history.pushState({...history.state,rjsWorkCatalogDetailId:id},'',location.href);
    data.detailAbort?.abort();const controller=new AbortController();data.detailAbort=controller;
    const sequence=++data.detailSeq;
    try {
      const response=await fetch(`/api/work-catalog/${encodeURIComponent(id)}`,{signal:controller.signal,credentials:'same-origin'});
      const json=await response.json();
      if(!response.ok||!json.work)throw Error(json.error||'작품 상세 조회 실패');
      if(sequence!==data.detailSeq||!isOpen())return;
      data.currentWork=json.work;
      renderDetail(json.work);
      loadSourceLinks(json.work.id);
      data.quoteItems=[];data.quoteCursor=null;loadWorkQuotes();
      refs.detail.querySelector('#wcDetailHeading')?.focus({preventScroll:true});
    }catch(error){
      if(controller.signal.aborted||sequence!==data.detailSeq)return;
      refs.detail.innerHTML='<button class="wc-detail-back" data-wc-back type="button">← 작품 목록으로</button><p class="wc-catalog-status" role="alert">작품 정보를 불러오지 못했어요. 비공개로 변경되었거나 일시적인 오류가 발생했을 수 있어요.</p>';
    }
  }
  // Search the existing public site index first; never accept free-text registration.
  const createDialog=$('wcCreateDialog'),createForm=$('wcCreateForm');
  const createOpen=$('wcCreateOpen'),createSave=$('wcCreateSave'),createMessage=$('wcCreateMessage');
  const createName=$('wcCreateName'),createMatches=$('wcCreateMatches'),createSelected=$('wcCreateSelected');
  let createSaving=false,createRequestId='',selectedSource=null,sourceSeq=0,sourceController=null,sourceTimer=null;
  function clearSourceSelection() {
    selectedSource=null;createRequestId='';createSave.disabled=true;createSelected.hidden=true;
    createSelected.textContent='';
  }
  function stopSourceSearch() {
    sourceSeq++;sourceController?.abort();sourceController=null;
    if(sourceTimer)clearTimeout(sourceTimer);sourceTimer=null;
  }
  function closeCreate() {if(createDialog?.open&&!createSaving){stopSourceSearch();createDialog.close();}}
  function showSourceResults(items) {
    createMatches.hidden=false;
    createName.setAttribute('aria-expanded','true');
    createMatches.innerHTML=items.length?items.map((item,index)=>`<button type="button" role="option" data-wc-source-index="${index}">
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.author||'작가 미확인')}</small></span>
      <em>${item.source_type==='postype'?'POSTYPE':'TXT'}</em></button>`).join(''):
      '<p class="wc-create-empty">사이트에 등록된 검색 결과가 없어요.</p>';
    createMatches._results=items;
  }
  async function searchSources() {
    stopSourceSearch();clearSourceSelection();
    const q=createName.value.trim().slice(0,80);
    createMatches.hidden=true;createName.setAttribute('aria-expanded','false');
    if(!q){createMessage.textContent='작품명이나 작가를 입력하면 사이트에 있는 작품을 검색해요.';return;}
    const seq=sourceSeq;sourceController=new AbortController();
    createMessage.textContent='검색하는 중…';
    try {
      const response=await fetch(`/api/work-catalog/sources?q=${encodeURIComponent(q)}`,{credentials:'same-origin',cache:'no-store',signal:sourceController.signal});
      const json=await response.json();
      if(!response.ok||!Array.isArray(json.items))throw Error(json.error||'검색 오류');
      if(seq!==sourceSeq||!createDialog.open)return;
      showSourceResults(json.items);
      createMessage.textContent=json.items.length?'검색 결과에서 작품을 선택해 주세요.':'입력한 작품은 현재 사이트 목록에 없어요.';
    }catch(error){if(seq===sourceSeq&&!sourceController?.signal.aborted)createMessage.textContent='검색에 실패했어요. 다시 입력해 주세요.';}
  }
  createOpen?.addEventListener('click',()=>{
    stopSourceSearch();createForm.reset();clearSourceSelection();
    createMatches.hidden=true;createMatches.innerHTML='';createName.setAttribute('aria-expanded','false');
    createMessage.textContent='작품명이나 작가를 입력하면 사이트에 등록된 작품을 찾아드려요.';
    createDialog.showModal();createName.focus();
  });
  createDialog?.querySelectorAll('[data-wc-create-close]').forEach(button=>button.addEventListener('click',closeCreate));
  createDialog?.addEventListener('cancel',event=>{if(createSaving)event.preventDefault();else stopSourceSearch();});
  createName?.addEventListener('input',()=>{
    stopSourceSearch();clearSourceSelection();createMatches.hidden=true;createName.setAttribute('aria-expanded','false');
    sourceTimer=setTimeout(searchSources,220);
  });
  createMatches?.addEventListener('click',event=>{
    const button=event.target.closest('[data-wc-source-index]');if(!button)return;
    const source=createMatches._results?.[Number(button.dataset.wcSourceIndex)];if(!source)return;
    if(!['drive','postype'].includes(source.source_type)||!source.source_id)return;
    selectedSource={source_type:source.source_type,source_id:source.source_id};
    createRequestId='';createSave.disabled=false;
    createSelected.hidden=false;
    createSelected.innerHTML=`<strong>선택한 작품</strong><span>${escapeHtml(source.title)} · ${escapeHtml(source.author||'작가 미확인')} <small>${source.source_type==='postype'?'POSTYPE':'TXT'}</small></span>`;
    createMatches.hidden=true;createName.setAttribute('aria-expanded','false');
    createName.value=source.title;
    createMessage.textContent='선택한 작품만 등록할 수 있어요.';
  });
  createForm?.addEventListener('submit',async event=>{
    event.preventDefault();if(createSaving)return;
    if(!selectedSource){createMessage.textContent='아래 검색 결과에서 작품을 선택해 주세요.';createName.focus();return;}
    createSaving=true;createSave.disabled=true;createName.disabled=true;
    createMessage.textContent='작품을 등록하는 중…';
    try {
      if(!createRequestId)createRequestId=crypto.randomUUID();
      const response=await fetch('/api/work-catalog/create',{
        method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},
        body:JSON.stringify({...selectedSource,request_id:createRequestId})
      });
      const json=await response.json();
      if(!response.ok){
        if(response.status===401){createMessage.innerHTML='로그인이 필요해요. <button type="button" data-wc-create-login>로그인하기</button>';return;}
        if(response.status===409&&validId(json.existing_public_id)){
          createMessage.innerHTML=`이미 공개된 작품이에요. <button type="button" data-wc-create-existing="${escapeHtml(json.existing_public_id)}">기존 작품 보기</button>`;return;
        }
        throw Error(json.error||'등록하지 못했어요.');
      }
      if(!validId(json.work_id))throw Error('등록 응답을 확인할 수 없어요.');
      stopSourceSearch();createDialog.close();createRequestId='';
      data.filtersLoaded=false;data.loaded=false;
      data.query='';data.cp='';data.genre='';data.tags=[];data.tagMode='all';data.completion='';data.subcouple='';data.sort='recent';
      refs.query.value='';refs.cp.value='';refs.completion.value='';refs.subcouple.value='';refs.sort.value='recent';
      updateFilters();await openDetail(json.work_id);
    }catch(error){createMessage.textContent=error.message||'등록하지 못했어요. 다시 시도해 주세요.';}
    finally {createSaving=false;createSave.disabled=!selectedSource;createName.disabled=false;}
  });
  createDialog?.addEventListener('click',event=>{
    if(event.target.closest('[data-wc-create-login]')){closeCreate();document.getElementById('loginButton')?.click();}
    const open=event.target.closest('[data-wc-create-existing]');
    if(open&&validId(open.dataset.wcCreateExisting)){closeCreate();openDetail(open.dataset.wcCreateExisting);}
  });
  // v10.66: One friendly entry point, per-section shortcuts and short batch queues.
  const editor=$('wcEditDialog'),editForm=$('wcEditForm');
  const editOperation=$('wcEditOperation'),editValue=$('wcEditValue'),editChoice=$('wcEditChoice'),editCompletion=$('wcEditCompletion'),editSubNote=$('wcEditSubcoupleNote');
  const editMessage=$('wcEditMessage'),editSave=$('wcEditSave');
  const editArea=$('wcEditInputArea'),editBatch=$('wcEditBatch');
  const editQueued=$('wcEditQueued'),editAdd=$('wcEditAdd');
  const editLabels={tag_add:'키워드 추가',genre_add:'장르 추가',synopsis_set:'줄거리 수정',
    subcouple_update:'서브커플 정보',completion_set:'연재 상태',recommendation_add:'추천 문구 추가',warnings_set:'주의사항 · 호불호 요소'};
  let pendingEntries=[];
  const isMulti=op=>['tag_add','genre_add','recommendation_add'].includes(op);
  const keyForTag=v=>v.normalize('NFKC').replace(/^#+\s*/,'').trim().toLocaleLowerCase();
  function renderPending() {
    editQueued.innerHTML=pendingEntries.map((value,index)=>`<span class="wc-edit-pending-item"><span>${editOperation.value==='tag_add'?'#':''}${escapeHtml(value)}</span><button type="button" data-wc-remove-pending="${index}" aria-label="${escapeHtml(value)} 삭제">×</button></span>`).join('');
    editSave.disabled=!editOperation.value || (isMulti(editOperation.value) && !pendingEntries.length && !editValue.value.trim());
  }
  function addPending({announce=true}={}) {
    const op=editOperation.value;
    if(!isMulti(op))return false;
    let value=editValue.value.normalize('NFKC').trim();
    if(op==='tag_add'||op==='genre_add') value=value.replace(/^#+\s*/,'').trim();
    if(!value) {if(announce)editMessage.textContent='추가할 내용을 입력해 주세요.';return false;}
    if(pendingEntries.length>=5){editMessage.textContent='한 번에 최대 5개까지 추가할 수 있어요.';return false;}
    if(op==='tag_add'||op==='genre_add') {
      if(value.length>30){editMessage.textContent='장르·키워드는 30자 이내로 입력해 주세요.';return false;}
      const old=arr(op==='genre_add'?data.currentWork?.genres:data.currentWork?.tags).map(keyForTag);
      if(old.includes(keyForTag(value))||pendingEntries.some(v=>keyForTag(v)===keyForTag(value))){editMessage.textContent='이미 등록했거나 추가 목록에 있는 장르·키워드예요.';return false;}
      if(old.length+pendingEntries.length>=20){editMessage.textContent='한 작품의 장르·키워드는 종류별로 최대 20개예요.';return false;}
    } else {
      if(value.length>500){editMessage.textContent='추천 문구는 한 항목당 500자 이내로 작성해 주세요.';return false;}
      const existing=recommendationLines(data.currentWork?.recommendation);
      if(existing.includes(value)||pendingEntries.includes(value)){editMessage.textContent='이미 등록된 추천 문구예요.';return false;}
      const combined=[...existing,...pendingEntries,value].join('\n\n');
      if(combined.length>1500){editMessage.textContent='추천 문구 전체는 1,500자 이내여야 해요.';return false;}
    }
    pendingEntries.push(value);editValue.value='';editMessage.textContent='';renderPending();
    return true;
  }
  function updateEditFields(operation,focusInput=false) {
    if(!Object.hasOwn(editLabels,operation))return;
    editOperation.value=operation;
    pendingEntries=[];
    editArea.hidden=false;
    const select=operation==='subcouple_update';
    const completion=operation==='completion_set';
    $('wcEditChoiceField').hidden=!select;
    $('wcEditSubcoupleNoteField').hidden=!select;
    $('wcEditCompletionField').hidden=!completion;
    $('wcEditValueField').hidden=select||completion;
    editBatch.hidden=!isMulti(operation);
    editValue.required=!select && !completion && !isMulti(operation) && !(operation==='warnings_set' && String(data.currentWork?.warnings||'').trim());
    editValue.value=operation==='synopsis_set'?String(data.currentWork?.synopsis||''):
      operation==='warnings_set'?String(data.currentWork?.warnings||''):'';
    editChoice.value=data.currentWork?.subcouple||'unknown';
    editSubNote.value=String(data.currentWork?.subcouple_note||'');
    editCompletion.value=data.currentWork?.completion==='unknown'?(data.currentWork?.source_completion||'unknown'):(data.currentWork?.completion||'unknown');
    editValue.maxLength=operation==='synopsis_set'?3000:operation==='warnings_set'?1000:['tag_add','genre_add'].includes(operation)?30:500;
    editValue.rows=operation==='synopsis_set'?7:operation==='warnings_set'?5:operation==='recommendation_add'?3:1;
    $('wcEditValueField').firstChild.textContent=({tag_add:'새 키워드',genre_add:'새 장르',synopsis_set:'줄거리',recommendation_add:'추천하고 싶은 독자',warnings_set:'주의사항 · 호불호 요소'})[operation]||'내용';
    editValue.placeholder=operation==='tag_add'?'예: 능력여주':operation==='genre_add'?'예: 로맨스, 판타지':operation==='recommendation_add'?'이 작품을 좋아할 독자의 취향을 적어 주세요.':'';
    $('wcEditBatchHint').textContent=['tag_add','genre_add'].includes(operation)?'입력 후 Enter 또는 추가를 눌러 주세요.':'문구를 입력하고 목록에 추가해 주세요.';
    editor.querySelectorAll('[data-wc-edit-choice]').forEach(button=>{
      const active=button.dataset.wcEditChoice===operation;
      button.classList.toggle('is-selected',active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('wcEditTitle').textContent=editLabels[operation];
    editMessage.textContent=operation==='warnings_set' && String(data.currentWork?.warnings||'').trim() ? '기존 내용을 모두 지운 뒤 저장하면 주의사항이 삭제돼요.' : '';
    editSave.disabled=false;
    renderPending();
    if(focusInput) (select?editChoice:completion?editCompletion:editValue).focus();
  }
  function openEditor(operation='') {
    if(!data.currentWork || !editor)return;
    editOperation.value='';pendingEntries=[];editArea.hidden=true;
    editMessage.textContent='';editSave.disabled=true;
    $('wcEditTitle').textContent='어떤 정보를 채울까요?';
    editor.querySelectorAll('[data-wc-edit-choice]').forEach(button=>{
      button.classList.remove('is-selected');button.setAttribute('aria-pressed','false');
    });
    editor.showModal();
    if(operation && Object.hasOwn(editLabels,operation))updateEditFields(operation,true);
    else editor.querySelector('[data-wc-edit-choice]')?.focus();
  }
  function closeEditor() {if(editor?.open&&!data.editSaving)editor.close();}
  editor?.querySelectorAll('[data-wc-edit-choice]').forEach(button=>button.addEventListener('click',()=>{
    if(!data.editSaving)updateEditFields(button.dataset.wcEditChoice,true);
  }));
  editAdd?.addEventListener('click',()=>{if(!data.editSaving&&addPending())editValue.focus();});
  editQueued?.addEventListener('click',event=>{
    if(data.editSaving)return;
    const button=event.target.closest('[data-wc-remove-pending]');if(!button)return;
    pendingEntries.splice(Number(button.dataset.wcRemovePending),1);renderPending();editValue.focus();
  });
  editValue?.addEventListener('keydown',event=>{
    if(['tag_add','genre_add'].includes(editOperation.value)&&event.key==='Enter'&&!event.isComposing){event.preventDefault();if(!data.editSaving)addPending();}
  });
  editValue?.addEventListener('input',()=>{if(isMulti(editOperation.value))renderPending();});
  editor?.querySelectorAll('[data-wc-edit-close]').forEach(button=>button.addEventListener('click',closeEditor));
  editor?.addEventListener('cancel',event=>{if(data.editSaving)event.preventDefault();});
  editForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(data.editSaving||!data.currentWork)return;
    const op=editOperation.value;
    if(!Object.hasOwn(editLabels,op))return;
    let change;
    if(isMulti(op)) {
      if(editValue.value.trim() && !addPending())return;
      if(!pendingEntries.length){editMessage.textContent='추가할 내용을 입력해 주세요.';return;}
      change={values:[...pendingEntries]};
    } else {
      const value=(op==='subcouple_update'?editChoice.value:op==='completion_set'?editCompletion.value:editValue.value).trim();
      if(!value && !(op==='warnings_set' && String(data.currentWork?.warnings||'').trim())) {editMessage.textContent='내용을 입력해 주세요.';return;}
      change=op==='subcouple_update'?{value,note:editSubNote.value}: {value};
    }
    data.editSaving=true;editSave.disabled=true;editAdd.disabled=true;
    editor.querySelectorAll('[data-wc-edit-choice],[data-wc-remove-pending]').forEach(button=>button.disabled=true);
    editValue.disabled=true;editChoice.disabled=true;editCompletion.disabled=true;editSubNote.disabled=true;
    editMessage.textContent='저장하는 중…';
    try {
      const response=await fetch('/api/work-catalog/edit',{
        method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},
        body:JSON.stringify({work_id:data.currentWork.id,base_revision:data.currentWork.revision,
          request_id:crypto.randomUUID(),operation:op,change})
      });
      const json=await response.json();
      if(!response.ok) {
        if(response.status===401){editMessage.innerHTML='로그인이 필요해요. <button type="button" data-wc-login>로그인하기</button>';return;}
        if(response.status===409){editMessage.innerHTML='정보가 변경되었어요. <button type="button" data-wc-reload>최신 정보 확인</button>';return;}
        throw new Error(json.error||'저장하지 못했어요.');
      }
      const newWork=json.work || (await (await fetch(`/api/work-catalog/${encodeURIComponent(data.currentWork.id)}?updated=${Date.now()}`,{cache:'no-store'})).json()).work;
      if(newWork && data.detailId===newWork.id){
        const expanded={extra:Boolean(refs.detail.querySelector('.wc-extra-facts[open]')),warnings:Boolean(refs.detail.querySelector('.wc-warnings[open]'))};
        data.currentWork={...data.currentWork,...newWork};
        renderDetail(data.currentWork);
        if(expanded.extra)refs.detail.querySelector('.wc-extra-facts')?.setAttribute('open','');
        if(expanded.warnings)refs.detail.querySelector('.wc-warnings')?.setAttribute('open','');
        loadSourceLinks(data.currentWork.id);
        renderWorkQuotes();
        data.loaded=false;data.filtersLoaded=false;
      }
      editor.close();
    }catch(error){editMessage.textContent=error.message||'저장에 실패했어요. 다시 시도해 주세요.';}
    finally{
      data.editSaving=false;editSave.disabled=false;editAdd.disabled=false;
      editor.querySelectorAll('[data-wc-edit-choice],[data-wc-remove-pending]').forEach(button=>button.disabled=false);
      editValue.disabled=false;editChoice.disabled=false;editCompletion.disabled=false;editSubNote.disabled=false;
    }
  });
  editor?.addEventListener('click',event=>{
    if(event.target.closest('[data-wc-login]')){closeEditor();document.getElementById('loginButton')?.click();}
    if(event.target.closest('[data-wc-reload]')){closeEditor();if(data.detailId)openDetail(data.detailId,{push:false});}
  });
  function closeDetail({fromHistory=false,restoreScroll=true}={}) {
    if(!data.detailId)return;
    data.quoteAbort?.abort();data.quoteLoading=false;data.quoteItems=[];data.quoteCursor=null;
    data.detailId='';data.currentWork=null;data.detailSeq++;data.detailAbort?.abort();
    if(editor?.open)editor.close();
    refs.detail.hidden=true;refs.browse.hidden=false;refs.detail.innerHTML='';
    if(!fromHistory&&history.state?.rjsWorkCatalogDetailId) {
      const next={...history.state};delete next.rjsWorkCatalogDetailId;
      history.replaceState(next,'',location.href);
    }
    if(isOpen()&&restoreScroll&&!data.loaded) {loadItems();if(!data.filtersLoaded)loadFilters();}
    if(restoreScroll)requestAnimationFrame(()=>{window.scrollTo({top:data.previousScroll,behavior:'auto'});data.lastFocus?.focus({preventScroll:true});});
  }
  refs.form.addEventListener('submit',event=>{event.preventDefault();data.query=refs.query.value.trim().slice(0,80);changed();});
  let composing=false;
  refs.query.addEventListener('compositionstart',()=>{composing=true;});
  refs.query.addEventListener('compositionend',()=>{composing=false;data.query=refs.query.value.trim().slice(0,80);changed();});
  refs.query.addEventListener('input',()=>{if(composing)return;data.query=refs.query.value.trim().slice(0,80);changed();});
  refs.genres.addEventListener('click',event=>{const button=event.target.closest('[data-wc-genre]');if(!button)return;data.genre=button.dataset.wcGenre;changed();});
  refs.tags.addEventListener('click',event=>{
    const button=event.target.closest('[data-wc-tag]');if(!button)return;
    const tag=button.dataset.wcTag;
    if(data.tags.includes(tag))data.tags=data.tags.filter(v=>v!==tag);
    else if(data.tags.length<5)data.tags.push(tag);
    else {showStatus('키워드는 최대 5개까지 선택할 수 있어요.','info');return;}
    changed();
  });
  root.querySelectorAll('[data-wc-mode]').forEach(button=>button.addEventListener('click',()=>{data.tagMode=button.dataset.wcMode;changed();}));
  refs.cp.addEventListener('change',()=>{data.cp=refs.cp.value;changed();});
  refs.completion.addEventListener('change',()=>{data.completion=refs.completion.value;changed();});
  refs.subcouple.addEventListener('change',()=>{data.subcouple=refs.subcouple.value;changed();});
  refs.sort.addEventListener('change',()=>{data.sort=refs.sort.value;changed();});
  refs.reset.addEventListener('click',resetFilters);
  refs.active.addEventListener('click',event=>{
    const button=event.target.closest('[data-wc-remove]');if(!button)return;
    switch(button.dataset.wcRemove) {
      case 'cp':data.cp='';refs.cp.value='';break;
      case 'genre':data.genre='';break;
      case 'tag':data.tags=data.tags.filter(t=>t!==button.dataset.wcValue);break;
      case 'completion':data.completion='';refs.completion.value='';break;
      case 'subcouple':data.subcouple='';refs.subcouple.value='';break;
    }
    changed();
  });
  refs.moreButton.addEventListener('click',()=>loadItems({append:true}));
  refs.cards.addEventListener('click',event=>{const button=event.target.closest('[data-wc-open]');if(button)openDetail(button.dataset.wcOpen);});
  refs.detail.addEventListener('toggle',event=>{
    const panel=event.target.closest?.('.wc-history');
    if(panel&&panel.open)loadWorkHistory(panel);
  },true);
  refs.detail.addEventListener('click',event=>{
    const edit=event.target.closest('[data-wc-edit]');
    const editMenu=event.target.closest('[data-wc-edit-menu]');
    const source=event.target.closest('[data-wc-source-id]');
    if(edit)openEditor(edit.dataset.wcEdit);
    else if(editMenu)openEditor();
    else if(source){
      const ok=window.RJSOpenCatalogSource?.(source.dataset.wcSourceType,source.dataset.wcSourceId);
      if(!ok){const place=$('wcOriginalLinks');if(place)place.insertAdjacentHTML('beforeend','<span class="wc-source-note">목록을 불러오는 중이거나 원본을 찾지 못했어요. 잠시 후 다시 시도해 주세요.</span>');}
    }
    else if(event.target.closest('[data-wc-back]'))closeDetail();
    else if(event.target.closest('[data-wc-quotes-more]'))loadWorkQuotes({append:Boolean(data.quoteItems.length)});
  });
  const filterBackdrop=$('wcFilterBackdrop');
  function closeMobileFilters({restoreFocus=false}={}) {
    const wasOpen=refs.filter.classList.contains('is-mobile-open');
    refs.filter.classList.remove('is-mobile-open');
    refs.filterToggle.setAttribute('aria-expanded','false');
    filterBackdrop.hidden=true;
    document.body.classList.remove('wc-filter-sheet-open');
    refs.filter.removeAttribute('role');
    refs.filter.removeAttribute('aria-modal');
    if(wasOpen&&restoreFocus&&isOpen())refs.filterToggle.focus();
  }
  refs.filterToggle.addEventListener('click',()=>{
    if(refs.filter.classList.contains('is-mobile-open')){closeMobileFilters({restoreFocus:true});return;}
    refs.filter.classList.add('is-mobile-open');
    refs.filterToggle.setAttribute('aria-expanded','true');
    filterBackdrop.hidden=false;
    document.body.classList.add('wc-filter-sheet-open');
    refs.filter.setAttribute('role','dialog');
    refs.filter.setAttribute('aria-modal','true');
    $('wcFilterClose')?.focus();
  });
  $('wcFilterClose')?.addEventListener('click',()=>closeMobileFilters({restoreFocus:true}));
  filterBackdrop.addEventListener('click',()=>closeMobileFilters({restoreFocus:true}));
  $('wcFilterDone')?.addEventListener('click',()=>closeMobileFilters({restoreFocus:true}));
  document.addEventListener('keydown',event=>{
    if(!refs.filter.classList.contains('is-mobile-open'))return;
    if(event.key==='Escape'){event.preventDefault();closeMobileFilters({restoreFocus:true});return;}
    if(event.key==='Tab'){
      const focusable=[...refs.filter.querySelectorAll('button:not([disabled]),select:not([disabled])')]
        .filter(element=>element.getClientRects().length);
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && (document.activeElement===first || !refs.filter.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey && (document.activeElement===last || !refs.filter.contains(document.activeElement))){event.preventDefault();first.focus();}
    }
  });
  window.matchMedia('(min-width:641px)').addEventListener('change',event=>{if(event.matches)closeMobileFilters();});
  window.addEventListener('popstate',event=>{
    if(!isOpen())return;
    if(data.detailId&&!event.state?.rjsWorkCatalogDetailId)closeDetail({fromHistory:true});
  });
  window.RJSWorkCatalog={
    onShow(){
      if(data.detailId){closeDetail();return;}
      if(!data.loaded&&!data.loading)loadItems();
      if(!data.filtersLoaded)loadFilters();
      if(!data.loaded && validId(history.state?.rjsWorkCatalogDetailId)) {
        openDetail(history.state.rjsWorkCatalogDetailId,{push:false});
      }
    },
    onHide(){
      closeMobileFilters();
      if(data.debounce)clearTimeout(data.debounce);
      data.seq++;data.abort?.abort();data.loading=false;
      if(data.detailId)closeDetail({restoreScroll:false});
    }
  };
  updateFilters();
})();
