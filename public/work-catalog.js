/* v10.55 · Read-only public work encyclopedia. No personal file/quote data is used here. */
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
    subcouple: $('wcSubcoupleFilter'), sort: $('wcSortSelect'),
    reset: $('wcResetFilters'), active: $('wcActiveFilters'),
    status: $('wcCatalogStatus'), cards: $('wcCatalogCards'),
    more: $('wcMoreWrap'), moreButton: $('wcMoreButton'), meta: $('wcResultsMeta')
  };
  const data = {
    query:'', genre:'', tags:[], tagMode:'all', completion:'', subcouple:'', sort:'recent',
    genres:[], tagOptions:[], items:[], nextPage:1, hasMore:false,
    loaded:false, loading:false, seq:0, abort:null, filtersLoaded:false, detailId:'',
    detailSeq:0, detailAbort:null, previousScroll:0, lastFocus:null, debounce:null
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const statusLabel = {unknown:'미확인',ongoing:'연재 중',completed:'완결',hiatus:'휴재'};
  const coupleLabel = {unknown:'미확인',yes:'있음',no:'없음'};
  const validId = id => /^[0-9a-f-]{36}$/i.test(String(id));
  const arr = values => Array.isArray(values) ? values.filter(v => typeof v === 'string').slice(0,20) : [];
  const coverStyle = (work, index) => {
    const colors = ['ink','plum','moss','rose','slate','ochre'];
    let hash=0;
    for (const c of String(work.id || work.title || index)) hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
    return colors[(hash>>>0)%colors.length];
  };
  const cover = (work,index,large=false) => `<div class="wc-book wc-book--${coverStyle(work,index)}${large?' wc-book--large':''}" aria-hidden="true"><span class="wc-book-top">RRR / STORY ARCHIVE</span><span class="wc-book-mark">✦</span><span class="wc-book-bottom">WORK<br>INDEX</span></div>`;
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
    const genres=arr(work.genres).slice(0,2), tagLabels=arr(work.tags).slice(0,3);
    return `<article class="wc-card"><button type="button" class="wc-card-open" data-wc-open="${escapeHtml(work.id)}" aria-label="${title} 작품 정보 보기">
      ${cover(work,index)}<span class="wc-card-main"><span class="wc-card-heading">${title}</span><span class="wc-card-author">${author}</span>
      <span class="wc-card-tags">${[...genres,...tagLabels.map(t=>'#'+t)].map(tag=>`<span>${escapeHtml(tag)}</span>`).join('') || '<span>분류 정보 미등록</span>'}</span>
      <span class="wc-card-bottom"><span>${escapeHtml(statusLabel[work.completion]||'미확인')} · 서브커플 ${escapeHtml(coupleLabel[work.subcouple]||'미확인')}</span><span class="wc-card-arrow">↗</span></span></span></button></article>`;
  }
  function renderItems() {
    refs.cards.innerHTML=data.items.map(makeCard).join('');
    refs.more.hidden=!data.hasMore || data.loading;
    refs.moreButton.disabled=data.loading;
    announceMeta();
    if(!data.items.length && !data.loading && !refs.status.hidden) return;
    if(!data.items.length && !data.loading) {
      const filtered=Boolean(data.query||data.genre||data.tags.length||data.completion||data.subcouple);
      showStatus(filtered?'검색 조건에 맞는 공개 작품이 없어요. 필터를 바꿔보세요.':'아직 공개된 작품 정보가 없어요. 작품 정보는 관리자 공개 후 이곳에 표시돼요.','empty');
    }
  }
  function queryParams(page) {
    const params = new URLSearchParams({page:String(page),sort:data.sort});
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
    data.genre='';data.tags=[];data.tagMode='all';data.completion='';data.subcouple='';data.sort='recent';data.query='';
    refs.query.value='';refs.completion.value='';refs.subcouple.value='';refs.sort.value='recent';
    changed();
  }
  const recommendationLines=value=>String(value||'').split(/\n\s*\n|\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,12);
  const displayText = (value,fallback='정보 미등록') => value ? escapeHtml(value) : `<span class="wc-muted">${fallback}</span>`;
  function renderDetail(work) {
    const genres=arr(work.genres),tagsList=arr(work.tags),recommendations=recommendationLines(work.recommendation);
    const heading=escapeHtml(work.title||'제목 미상');
    const tagRows=(list,prefix)=>list.map(label=>`<span class="wc-detail-tag">${prefix}${escapeHtml(label)}</span>`).join('');
    const alertText=String(work.warnings||'').trim(),subNote=String(work.subcouple_note||'').trim();
    refs.detail.innerHTML=`<div class="wc-detail-top"><button type="button" class="wc-detail-back" data-wc-back>← 작품 목록으로</button><span class="wc-detail-subtitle">WORK ENCYCLOPEDIA / INFORMATION</span></div>
      <div class="wc-detail-hero">${cover(work,0,true)}<div class="wc-detail-heading"><p class="wc-results-kicker">THE STORY AT A GLANCE</p><h3 id="wcDetailHeading" tabindex="-1">${heading}</h3><p class="wc-detail-author">${escapeHtml(work.author||'작가 미확인')}</p>${work.original_title?`<p class="wc-detail-original">원제 · ${escapeHtml(work.original_title)}</p>`:''}
      <div class="wc-detail-properties"><span>${escapeHtml(statusLabel[work.completion]||'미확인')}</span><span>서브커플 ${escapeHtml(coupleLabel[work.subcouple]||'미확인')}</span></div></div></div>
      <div class="wc-detail-grid"><div class="wc-detail-primary">
        <section class="wc-detail-section"><span class="wc-section-num">01 / THE STORY</span><h4>작품 소개</h4><div class="wc-story-text">${displayText(work.synopsis,'등록된 줄거리가 아직 없어요.')}</div></section>
        <section class="wc-detail-section"><span class="wc-section-num">02 / KEYWORDS</span><h4>장르와 키워드</h4><div class="wc-detail-tag-label">장르</div><div class="wc-detail-tagline">${genres.length?tagRows(genres,''):'<span class="wc-muted">장르 미등록</span>'}</div>
        <div class="wc-detail-tag-label">취향 키워드</div><div class="wc-detail-tagline">${tagsList.length?tagRows(tagsList,'#'):'<span class="wc-muted">키워드 미등록</span>'}</div></section>
        <section class="wc-detail-section"><span class="wc-section-num">03 / FOR READERS</span><h4>이런 독자에게 추천해요</h4>${recommendations.length?`<ul class="wc-recommendations">${recommendations.map(line=>`<li>${escapeHtml(line)}</li>`).join('')}</ul>`:'<p class="wc-muted">추천 대상 정보가 아직 없어요.</p>'}</section>
      </div><aside class="wc-detail-side"><section class="wc-detail-facts"><span class="wc-section-num">INFORMATION</span><h4>한눈에 보는 작품</h4>
        <dl><div><dt>연재 상태</dt><dd>${escapeHtml(statusLabel[work.completion]||'미확인')}</dd></div><div><dt>서브커플</dt><dd>${escapeHtml(coupleLabel[work.subcouple]||'미확인')}</dd></div></dl>
        ${subNote?`<details class="wc-spoiler"><summary>서브커플 설명 보기 <span>스포일러 주의</span></summary><p>${escapeHtml(subNote)}</p></details>`:''}
        ${alertText?`<details class="wc-spoiler"><summary>주의 요소 보기 <span>내용 포함</span></summary><p>${escapeHtml(alertText)}</p></details>`:''}</section>
        <div class="wc-detail-note"><strong>함께 채워가는 도감</strong><p>이 정보는 공개 승인된 작품 데이터예요. 정보 추가·수정 제안 기능은 다음 업데이트에서 제공할 예정이에요.</p></div>
      </aside></div>`;
  }
  async function openDetail(id,{push=true}={}) {
    if(!validId(id))return;
    const active=root.querySelector(`[data-wc-open="${CSS.escape(id)}"]`);
    if(active)data.lastFocus=active;
    data.previousScroll=Math.max(0,window.scrollY||0);
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
      renderDetail(json.work);
      refs.detail.querySelector('#wcDetailHeading')?.focus({preventScroll:true});
    }catch(error){
      if(controller.signal.aborted||sequence!==data.detailSeq)return;
      refs.detail.innerHTML='<button class="wc-detail-back" data-wc-back type="button">← 작품 목록으로</button><p class="wc-catalog-status" role="alert">작품 정보를 불러오지 못했어요. 비공개로 변경되었거나 일시적인 오류가 발생했을 수 있어요.</p>';
    }
  }
  function closeDetail({fromHistory=false,restoreScroll=true}={}) {
    if(!data.detailId)return;
    data.detailId='';data.detailSeq++;data.detailAbort?.abort();
    refs.detail.hidden=true;refs.browse.hidden=false;refs.detail.innerHTML='';
    if(!fromHistory&&history.state?.rjsWorkCatalogDetailId) {
      const next={...history.state};delete next.rjsWorkCatalogDetailId;
      history.replaceState(next,'',location.href);
    }
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
  refs.completion.addEventListener('change',()=>{data.completion=refs.completion.value;changed();});
  refs.subcouple.addEventListener('change',()=>{data.subcouple=refs.subcouple.value;changed();});
  refs.sort.addEventListener('change',()=>{data.sort=refs.sort.value;changed();});
  refs.reset.addEventListener('click',resetFilters);
  refs.active.addEventListener('click',event=>{
    const button=event.target.closest('[data-wc-remove]');if(!button)return;
    switch(button.dataset.wcRemove) {
      case 'genre':data.genre='';break;
      case 'tag':data.tags=data.tags.filter(t=>t!==button.dataset.wcValue);break;
      case 'completion':data.completion='';refs.completion.value='';break;
      case 'subcouple':data.subcouple='';refs.subcouple.value='';break;
    }
    changed();
  });
  refs.moreButton.addEventListener('click',()=>loadItems({append:true}));
  refs.cards.addEventListener('click',event=>{const button=event.target.closest('[data-wc-open]');if(button)openDetail(button.dataset.wcOpen);});
  refs.detail.addEventListener('click',event=>{if(event.target.closest('[data-wc-back]'))closeDetail();});
  refs.filterToggle.addEventListener('click',()=>{
    const expanded=refs.filter.classList.toggle('is-mobile-open');
    refs.filterToggle.setAttribute('aria-expanded',String(expanded));
  });
  window.addEventListener('popstate',event=>{
    if(!isOpen())return;
    if(data.detailId&&!event.state?.rjsWorkCatalogDetailId)closeDetail({fromHistory:true});
  });
  window.RJSWorkCatalog={
    onShow(){
      if(data.detailId){closeDetail();return;}
      if(!data.loaded&&!data.loading)loadItems();
      if(!data.filtersLoaded)loadFilters();
    },
    onHide(){
      if(data.debounce)clearTimeout(data.debounce);
      data.seq++;data.abort?.abort();data.loading=false;
      if(data.detailId)closeDetail({restoreScroll:false});
    }
  };
  updateFilters();
})();
