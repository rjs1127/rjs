/* v10.77 · Shared encyclopedia: stable cursor pagination + existing reader features. */
(() => {
  'use strict';
  const root = document.getElementById('workCatalogPage');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const refs = {
    browse: $('wcCatalogBrowser'), detail: $('wcCatalogDetail'),
    form: $('wcSearchForm'), query: $('wcSearchInput'), genres: $('wcGenreChoices'),
    tags: $('wcTagChoices'), genreMore: $('wcGenreMore'), tagMore: $('wcTagMore'), filter: $('wcFilterPanel'), filterToggle: $('wcFilterToggle'),
    filterBadge: $('wcFilterBadge'), completion: $('wcCompletionFilter'),
    cp: $('wcCpFilter'), subcouple: $('wcSubcoupleFilter'), adultScene: $('wcAdultSceneFilter'), sort: $('wcSortSelect'),
    reset: $('wcResetFilters'), active: $('wcActiveFilters'),
    status: $('wcCatalogStatus'), cards: $('wcCatalogCards'),
    more: $('wcMoreWrap'), moreButton: $('wcMoreButton'), moreLabel: $('wcMoreLabel'), moreProgress: $('wcMoreProgress'), meta: $('wcResultsMeta')
  };
  const data = {
    query:'', cp:'', genre:'', tags:[], tagMode:'all', completion:'', subcouple:'', adultScene:'', sort:'recent',
    genres:[], tagOptions:[], items:[], nextCursor:null, hasMore:false,
    loaded:false, loading:false, seq:0, abort:null, filtersLoaded:false, detailId:'',
    quoteItems:[], quoteCursor:null, quoteAbort:null, quoteLoading:false,
    detailSeq:0, detailAbort:null, currentWork:null, editSaving:false, contributionFeedback:'', previousScroll:0, lastFocus:null, debounce:null
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const statusLabel = {unknown:'미확인',ongoing:'연재 중',completed:'완결',incomplete:'미완',hiatus:'휴재'};
  const coupleLabel = {unknown:'미확인',yes:'있음',no:'없음'};
  const validId = id => /^[0-9a-f-]{36}$/i.test(String(id));
  const arr = values => Array.isArray(values) ? values.filter(v => typeof v === 'string').slice(0,20) : [];
  const filterKey = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '');
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
    refs.moreLabel.textContent='더보기 20개';
    refs.moreProgress.textContent=`${data.items.length}개 표시 중`;
  }
  const choiceOpen = {genre:false,tag:false};
  function measureChoiceRows(container, button, rows, kind) {
    if (!container || !button || !isOpen()) return;
    // Re-measure in normal flow, including after mobile sheet becomes visible.
    if (!container.getClientRects().length) return;
    container.style.maxHeight='none';
    const items=[...container.querySelectorAll(kind==='genre' ? '[data-wc-genre]' : '[data-wc-tag]')];
    if (!items.length) { button.hidden=true; return; }
    const tops=[];
    for (const item of items) {
      const top=item.offsetTop;
      if (!tops.some(value=>Math.abs(value-top)<2)) tops.push(top);
    }
    const hasOverflow=tops.length>rows;
    button.hidden=!hasOverflow;
    button.setAttribute('aria-expanded',String(choiceOpen[kind] && hasOverflow));
    button.innerHTML=(choiceOpen[kind] && hasOverflow?'접기':'더보기')+' <span aria-hidden="true">'+(choiceOpen[kind] && hasOverflow?'⌃':'⌄')+'</span>';
    container.classList.toggle('wc-choices-collapsed',hasOverflow && !choiceOpen[kind]);
    if (hasOverflow && !choiceOpen[kind]) {
      // Stop just before row N+1. Keeps every chip of the last row fully visible.
      const limit=tops[rows]-tops[0];
      container.style.maxHeight=Math.max(0,limit-1)+'px';
    }
  }
  function updateChoiceHeights() {
    measureChoiceRows(refs.genres,refs.genreMore,2,'genre');
    measureChoiceRows(refs.tags,refs.tagMore,5,'tag');
  }
  let measureQueued=false;
  function queueChoiceHeights() {
    if (measureQueued) return;
    measureQueued=true;
    requestAnimationFrame(()=>{ measureQueued=false; updateChoiceHeights(); });
  }
  for (const [kind,button] of [['genre',refs.genreMore],['tag',refs.tagMore]]) {
    button.addEventListener('click',()=>{ choiceOpen[kind]=!choiceOpen[kind];queueChoiceHeights(); });
  }
  window.addEventListener('resize',queueChoiceHeights,{passive:true});
  function pills() {
    const entries=[{value:'',count:0},...data.genres];
    refs.genres.innerHTML=entries.map(({value})=>`<button class="wc-genre${data.genre===value?' is-active':''}" type="button" data-wc-genre="${escapeHtml(value)}" aria-pressed="${data.genre===value}">${value?escapeHtml(value):'전체 작품'}</button>`).join('');
    queueChoiceHeights();
  }
  function tags() {
    const choices=[...new Set([...data.tags,...data.tagOptions.map(t=>t.value)])].slice(0,40);
    refs.tags.innerHTML=choices.length ? choices.map(tag=>`<button type="button" class="wc-tag${data.tags.includes(tag)?' is-active':''}" data-wc-tag="${escapeHtml(tag)}" aria-pressed="${data.tags.includes(tag)}">#${escapeHtml(tag)}</button>`).join('') : '<p class="wc-filter-hint">공개된 작품의 키워드가 아직 없어요.</p>';
    queueChoiceHeights();
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
    if(data.adultScene) entries.push(['adult_scene',`성적 묘사 ${data.adultScene}`]);
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
    const fill=catalogFill(work);
    const fromSource=work.completion==='unknown' && Boolean(work.source_completion && work.source_completion!=='unknown');
    const displayCompletion=fromSource ? work.source_completion : work.completion;
    return `<article class="wc-card"><button type="button" class="wc-card-open" data-wc-open="${escapeHtml(work.id)}" aria-label="${title} 작품 정보 보기">
      ${cover(work,index)}<span class="wc-card-main"><span class="wc-card-heading-row"><span class="wc-card-heading">${title}</span><span class="wc-card-arrow" aria-hidden="true">↗</span></span><span class="wc-card-author">${author}</span>
      <span class="wc-card-meta">${mainCp?`<span class="wc-card-cp">CP · ${mainCp}</span>`:''}<span class="wc-card-status" ${fromSource?'title="연결된 원본의 연재 상태 (도감 정보는 미확인)"':''}>${escapeHtml(statusLabel[displayCompletion]||'미확인')}${fromSource?'<span class="wc-card-mapped"> · 원본 기준</span>':''}</span></span>
      <span class="wc-card-tags">${[...genres,...tagLabels.map(t=>'#'+t)].map(tag=>`<span>${escapeHtml(tag)}</span>`).join('') || '<span>분류 정보 미등록</span>'}</span>
      <span class="wc-card-fill"><span>정보 ${fill.count}/5</span><span class="wc-card-fill-track" aria-hidden="true"><i style="width:${fill.percent}%"></i></span><strong>${fill.percent}%</strong></span>
      </span></button></article>`;
  }
  function renderItems({append=false,addedItems=[]}={}) {
    // Keep existing card nodes (and the reader's scroll/focus) when extending a long list.
    if(append && refs.cards.childElementCount===data.items.length-addedItems.length) {
      if(addedItems.length)refs.cards.insertAdjacentHTML('beforeend',addedItems.map((work,index)=>makeCard(work,data.items.length-addedItems.length+index)).join(''));
    } else refs.cards.innerHTML=data.items.map(makeCard).join('');
    refs.more.hidden=!data.hasMore || data.loading;
    refs.moreButton.disabled=data.loading;
    announceMeta();
    if(!data.items.length && !data.loading && !refs.status.hidden) return;
    if(!data.items.length && !data.loading) {
      const filtered=Boolean(data.query||data.cp||data.genre||data.tags.length||data.completion||data.subcouple||data.adultScene);
      showStatus(filtered?'검색 조건에 맞는 공개 작품이 없어요. 필터를 바꿔보세요.':'아직 공개된 작품 정보가 없어요. 위의 + 작품 등록 버튼으로 첫 작품을 기록해 보세요.','empty');
    }
  }
  function queryParams(cursor=null) {
    const params = new URLSearchParams({mode:'cursor',sort:data.sort});
    if(cursor)params.set('cursor',cursor);
    if(data.cp) params.set('cp',data.cp);
    if(data.query) params.set('q',data.query);
    if(data.genre) params.set('genre',data.genre);
    data.tags.forEach(tag=>params.append('tag',tag));
    if(data.tags.length) params.set('tag_mode',data.tagMode);
    if(data.completion) params.set('completion',data.completion);
    if(data.subcouple) params.set('subcouple',data.subcouple);
    if(data.adultScene) params.set('adult_scene',data.adultScene);
    return params;
  }
  async function loadItems({append=false}={}) {
    if(append && (!data.hasMore || data.loading)) return;
    data.abort?.abort();
    data.abort=new AbortController();
    const signal=data.abort.signal;
    const sequence=++data.seq;
    const cursor=append?data.nextCursor:null;
    if(append&&!cursor)return;
    let addedItems=[];
    data.loading=true;
    if(!append) {data.items=[];data.nextCursor=null;data.hasMore=false;refs.cards.innerHTML='';showStatus('작품을 불러오는 중…');}
    refs.moreButton.disabled=true;
    announceMeta();
    try {
      const response=await fetch(`/api/work-catalog?${queryParams(cursor)}`,{signal,credentials:'same-origin'});
      const json=await response.json();
      if(!response.ok || !Array.isArray(json.items)) throw new Error(json.error||'목록 조회 실패');
      if(sequence!==data.seq) return;
      if(json.hasMore&&(typeof json.nextCursor!=='string'||!json.nextCursor))throw new Error('이어보기 응답 오류');
      const items=json.items.filter(work=>work&&validId(work.id));
      const seen=new Set(append?data.items.map(work=>work.id):[]);
      addedItems=append?items.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;}):items;
      data.items=append?[...data.items,...addedItems]:items;
      data.nextCursor=json.hasMore?json.nextCursor:null;
      data.hasMore=Boolean(data.nextCursor);
      data.loaded=true;
      hideStatus();
    } catch(error) {
      if(signal.aborted||sequence!==data.seq) return;
      if(!append) data.items=[];
      showStatus('작품 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.','error');
      if(!append)data.loaded=false;
    } finally {
      if(sequence===data.seq) {data.loading=false;renderItems({append,addedItems});}
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
    data.loaded=false;data.hasMore=false;data.nextCursor=null;
    data.seq++;data.abort?.abort();data.loading=false;
    refs.more.hidden=true;refs.moreButton.disabled=true;
    updateFilters();
    if(data.debounce)clearTimeout(data.debounce);
    data.debounce=setTimeout(()=>{data.debounce=null;if(isOpen())loadItems();},220);
  }
  function resetFilters() {
    data.cp='';refs.cp.value='';data.genre='';data.tags=[];data.tagMode='all';data.completion='';data.subcouple='';data.adultScene='';data.sort='recent';data.query='';
    refs.query.value='';refs.completion.value='';refs.subcouple.value='';refs.adultScene.value='';refs.sort.value='recent';
    changed();
  }
  const recommendationLines=value=>String(value||'').split(/\n\s*\n|\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,12);
  // One shared rule for the list and detail. Only confirmed catalog fields count;
  // a displayed source_completion hint is not a saved catalog value.
  const questDefinitions=[
    ['genre_add','장르 기록','이 작품은 어떤 장르인가요?'],
    ['tag_add','키워드 채우기','인물·소재·관계성을 남겨주세요.'],
    ['synopsis_set','줄거리 작성','스포일러 없는 작품 소개를 적어주세요.'],
    ['completion_set','연재 상태 확인','완결·미완·연재 중을 확인해 주세요.'],
    ['recommendation_add','추천 한 줄 남기기','어떤 취향의 독자에게 어울릴까요?']
  ];
  function catalogFill(work) {
    const found=[arr(work?.genres).length>0,arr(work?.tags).length>0,
      Boolean(String(work?.synopsis||'').trim()),
      Boolean(work?.completion && work.completion!=='unknown'),
      recommendationLines(work?.recommendation).length>0];
    const count=found.filter(Boolean).length;
    return {count,total:5,percent:count*20,found};
  }
  const questDialog=$('wcQuestDialog');
  function closeQuest() {if(questDialog?.open)questDialog.close();}
  function questContent(work) {
    const fill=catalogFill(work);
    const rows=questDefinitions.map(([op,label,help],i)=>`<div class="wc-quest-task${fill.found[i]?' is-complete':''}">
      <span class="wc-quest-check" aria-hidden="true">${fill.found[i]?'✓':'○'}</span>
      <div class="wc-quest-task-copy"><strong>${label}</strong><small>${fill.found[i]?'정보가 기록되어 있어요':help}</small></div>
      ${fill.found[i]?'<span class="wc-quest-done">기록됨</span>':`<button type="button" class="wc-quest-write" data-wc-quest-edit="${op}" aria-label="${label} 작성하기">채우기 ↗</button>`}
    </div>`).join('');
    return `<div class="wc-quest-handle" aria-hidden="true"></div>
      <div class="wc-quest-head"><div><span class="wc-section-num">TOGETHER WE RECORD</span><h3 id="wcQuestTitle">도감 채우기</h3><p>알고 있는 정보 한 가지만 보태도 좋아요.</p></div>
      <button type="button" class="wc-quest-close" data-wc-quest-close aria-label="퀘스트 창 닫기">×</button></div>
      <div class="wc-quest-summary"><span>기본 정보 <strong>${fill.count}/${fill.total}</strong> 기록</span><strong>${fill.percent}%</strong></div>
      <div class="wc-quest-track" aria-hidden="true"><span style="width:${fill.percent}%"></span></div>
      <div class="wc-quest-tasks">${rows}</div>
      <div class="wc-quest-foot">${fill.count===5?'기본 정보가 모두 채워졌어요! 새로운 정보도 계속 보탤 수 있어요.':`아직 ${fill.total-fill.count}가지 정보를 함께 채울 수 있어요.`}
        ${fill.count===5?'<button type="button" data-wc-quest-edit="recommendation_add">추천 한 줄 더 남기기 ↗</button>':''}</div>`;
  }
  function openQuest() {
    if(!data.currentWork||!questDialog)return;
    questDialog.innerHTML=questContent(data.currentWork);
    questDialog.showModal();
    questDialog.querySelector('[data-wc-quest-close]')?.focus({preventScroll:true});
  }
  questDialog?.addEventListener('click',event=>{
    if(event.target===questDialog||event.target.closest('[data-wc-quest-close]')){closeQuest();return;}
    const button=event.target.closest('[data-wc-quest-edit]');
    if(button){const op=button.dataset.wcQuestEdit;closeQuest();openEditor(op);}
  });
  const displayText = (value,fallback='정보 미등록') => value ? escapeHtml(value) : `<span class="wc-muted">${fallback}</span>`;
  const inlineActions = (...items) => `<span class="wc-inline-actions">${items.filter(Boolean).join('')}</span>`;
  function renderDetail(work) {
    closeMobileFilters();
    const genres=arr(work.genres),tagsList=arr(work.tags),recommendations=recommendationLines(work.recommendation);
    const heading=escapeHtml(work.title||'제목 미상');
    const tagRows=(list,prefix)=>list.map(label=>`<span class="wc-detail-tag">${prefix}${escapeHtml(label)}</span>`).join('');
    const alertText=String(work.warnings||'').trim(),subNote=String(work.subcouple_note||'').trim();
    const effectiveCompletion=work.completion==='unknown'?(work.source_completion||'unknown'):work.completion;
    const mappedCompletion=work.completion==='unknown'&&Boolean(work.source_completion);
    const fill=catalogFill(work);
    const successNotice=data.contributionFeedback?`<div class="wc-contribution-success" role="status"><span aria-hidden="true">✓</span><span>${escapeHtml(data.contributionFeedback)}</span></div>`:'';
    refs.detail.innerHTML=`<div class="wc-detail-top"><button type="button" class="wc-detail-back" data-wc-back>← 작품 목록으로</button><div id="wcOriginalLinks" class="wc-source-links" aria-live="polite"></div></div>
      <div class="wc-detail-hero">${cover(work,0,true)}<div class="wc-detail-heading"><h3 id="wcDetailHeading" tabindex="-1">${heading}</h3><p class="wc-detail-author">${escapeHtml(work.author||'작가 미확인')}</p>${work.original_title?`<p class="wc-detail-original">원제 · ${escapeHtml(work.original_title)}</p>`:''}
      <div class="wc-detail-properties">${arr(work.main_couples).map(cp=>`<span>CP · ${escapeHtml(cp)}</span>`).join('')}<span>${escapeHtml(statusLabel[effectiveCompletion]||'미확인')}</span></div>
      </div></div>
      ${successNotice}
      <button type="button" class="wc-quest-trigger" data-wc-quest-open aria-haspopup="dialog" aria-controls="wcQuestDialog" aria-label="도감 정보 채움률 ${fill.percent}퍼센트, 퀘스트 보기">
        <span class="wc-quest-trigger-icon" aria-hidden="true">▤</span>
        <span class="wc-quest-trigger-label">도감 채움률 <strong>${fill.percent}%</strong></span>
        <span class="wc-quest-trigger-track" aria-hidden="true"><i style="width:${fill.percent}%"></i></span>
        <span class="wc-quest-trigger-next">${fill.count===5?'기본 정보 완료':`${5-fill.count}개 남음`}</span>
        <span class="wc-quest-trigger-arrow" aria-hidden="true">⌃</span>
      </button>
      <div class="wc-detail-grid"><div class="wc-detail-primary">
        <section class="wc-detail-section"><span class="wc-section-num">01 / THE STORY</span><div class="wc-section-title-row"><h4>작품 소개</h4>${inlineActions(`<button type="button" class="wc-inline-edit" data-wc-edit="synopsis_set" aria-label="작품 소개 ${String(work.synopsis||'').trim()?'수정':'추가'}">${String(work.synopsis||'').trim()?'수정':'추가'}</button>`)}</div><div class="wc-story-text">${displayText(work.synopsis,'아직 소개가 없어요. 기억나는 줄거리를 짧게 남겨주세요.')}</div></section>
        <section class="wc-detail-section"><span class="wc-section-num">02 / KEYWORDS</span><div class="wc-section-title-row"><h4>장르와 키워드</h4></div>
          <div class="wc-subsection-title-row"><span class="wc-detail-tag-label">장르</span>${inlineActions(`<button type="button" class="wc-inline-edit" data-wc-edit="genre_add" aria-label="장르 추가">추가</button>`, genres.length?'<button type="button" class="wc-inline-edit" data-wc-edit="genre_manage" aria-label="기존 장르 수정·삭제">관리</button>':'')}</div><div class="wc-detail-tagline">${genres.length?tagRows(genres,''):'<span class="wc-muted">어떤 장르의 소설인지 알려주세요.</span>'}</div>
          <div class="wc-subsection-title-row"><span class="wc-detail-tag-label">취향 키워드</span>${inlineActions(`<button type="button" class="wc-inline-edit" data-wc-edit="tag_add" aria-label="키워드 추가">추가</button>`, tagsList.length?'<button type="button" class="wc-inline-edit" data-wc-edit="tag_manage" aria-label="기존 키워드 수정·삭제">관리</button>':'')}</div><div class="wc-detail-tagline">${tagsList.length?tagRows(tagsList,'#'):'<span class="wc-muted">기억나는 소재나 관계성을 추가해 주세요.</span>'}</div></section>
        <section class="wc-detail-section"><span class="wc-section-num">03 / FOR READERS</span><div class="wc-section-title-row"><h4>이런 독자에게 추천해요</h4>${inlineActions(`<button type="button" class="wc-inline-edit" data-wc-edit="recommendation_add" aria-label="추천 문구 추가">추가</button>`, recommendations.length?'<button type="button" class="wc-inline-edit" data-wc-edit="recommendation_manage" aria-label="기존 추천 문구 수정·삭제">관리</button>':'')}</div>${recommendations.length?`<ul class="wc-recommendations">${recommendations.map(line=>`<li>${escapeHtml(line)}</li>`).join('')}</ul>`:'<p class="wc-muted">어떤 취향의 독자에게 추천하고 싶나요?</p>'}</section>
        <section class="wc-detail-section"><span class="wc-section-num">04 / QUOTES</span><div class="wc-section-title-row"><h4>작품 속 문장</h4></div><details class="wc-quotes-spoiler"><summary><span>문장 펼쳐보기</span><small>스포일러 주의 · 기본 숨김</small></summary><div id="wcWorkQuotes" aria-live="polite"></div></details></section>
      </div><aside class="wc-detail-side"><section class="wc-detail-facts"><span class="wc-section-num">INFORMATION</span><div class="wc-section-title-row"><h4>작품 기본 정보</h4></div>
        <dl><div class="wc-fact-row"><dt>메인 커플 (CP)</dt><dd>${displayText(arr(work.main_couples).join(' · '))}</dd></div><div class="wc-fact-row wc-fact-row-editable"><dt>연재 상태</dt><dd>${escapeHtml(statusLabel[effectiveCompletion]||'미확인')}${mappedCompletion?'<small class="wc-mapped-status">원본 분류 기준</small>':''}</dd><button type="button" class="wc-inline-edit" data-wc-edit="completion_set" aria-label="연재 상태 수정">수정</button></div></dl>
        <details class="wc-extra-facts"><summary>부가 정보 <span>서브커플 등</span></summary>
          <div class="wc-extra-facts-body"><div class="wc-extra-facts-row"><span>서브커플</span><strong>${escapeHtml(coupleLabel[work.subcouple]||'미확인')}</strong><button type="button" class="wc-inline-edit" data-wc-edit="subcouple_update" aria-label="서브커플 유무 및 설명 수정">수정</button></div>
            ${subNote?`<details class="wc-spoiler"><summary>상세 설명 보기 <span>스포일러 주의</span></summary><p>${escapeHtml(subNote)}</p></details>`:''}
          </div>
        </details>
        <details class="wc-spoiler wc-warnings"><summary>주의사항 · 호불호 요소 <span>${alertText?'스포일러 주의 · 펼쳐 보기':work.adult_scene_status&&work.adult_scene_status!=='미확인'?'성적 묘사 정보 · 펼쳐 보기':'정보 확인 · 펼쳐 보기'}</span></summary><div class="wc-warning-content"><div class="wc-adult-scene-row"><span>성적 묘사 여부</span><strong>${escapeHtml(work.adult_scene_status||'미확인')}</strong><button type="button" class="wc-inline-edit" data-wc-edit="adult_scene_set">정보 제안</button></div><div class="wc-subsection-title-row"><span class="wc-detail-tag-label">등록된 정보</span><button type="button" class="wc-inline-edit" data-wc-edit="warnings_set" aria-label="주의사항과 호불호 요소 ${alertText?'수정':'추가'}">${alertText?'수정':'추가'}</button></div><p>${displayText(alertText,'등록된 정보가 없어요.')}</p></div></details></section>
        <div class="wc-detail-note wc-history-note"><strong>함께 기록한 변경 내용</strong><p>누가 무엇을 입력했는지 대신, 어떤 정보가 언제 바뀌었는지 확인할 수 있어요.</p>
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
      data.quoteCursor=json.nextCursor||null;data.quoteLoading=false;data.quoteLoaded=true;renderWorkQuotes();
    }catch(error){
      if(controller.signal.aborted||sequence!==data.detailSeq)return;
      data.quoteLoading=false;renderWorkQuotes('공개 문장을 불러오지 못했어요. 다시 시도해 주세요.',true);
    }
  }
  async function openDetail(id,{push=true}={}) {
    if(!validId(id))return;
    closeQuest();
    const active=root.querySelector(`[data-wc-open="${CSS.escape(id)}"]`);
    if(active)data.lastFocus=active;
    data.previousScroll=Math.max(0,window.scrollY||0);
    data.quoteAbort?.abort();data.quoteLoading=false;
    data.detailId=id;
    data.contributionFeedback='';
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
      // The quote section is spoiler-collapsed by default. Query only after
      // the visitor explicitly opens it (and once per detail visit).
      data.quoteItems=[];data.quoteCursor=null;data.quoteLoaded=false;
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
      data.query='';data.cp='';data.genre='';data.tags=[];data.tagMode='all';data.completion='';data.subcouple='';data.adultScene='';data.sort='recent';
      refs.query.value='';refs.cp.value='';refs.completion.value='';refs.subcouple.value='';refs.adultScene.value='';refs.sort.value='recent';
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
  const editOperation=$('wcEditOperation'),editValue=$('wcEditValue'),editChoice=$('wcEditChoice'),editCompletion=$('wcEditCompletion'),editAdult=$('wcEditAdultScene'),editSubNote=$('wcEditSubcoupleNote');
  const editMessage=$('wcEditMessage'),editSave=$('wcEditSave');
  const editArea=$('wcEditInputArea'),editBatch=$('wcEditBatch');
  const editQueued=$('wcEditQueued'),editAdd=$('wcEditAdd');
  const managePanel=$('wcEditManage'),manageList=$('wcEditManageList'),manageBack=$('wcEditManageBack');
  const editChoices=editor?.querySelector('.wc-edit-choices');
  const editLabels={tag_add:'키워드 추가',genre_add:'장르 추가',synopsis_set:'줄거리 작성·수정',
    subcouple_update:'서브커플 정보',completion_set:'연재 상태',recommendation_add:'추천 문구 추가',warnings_set:'주의사항 · 호불호 요소',adult_scene_set:'성적 묘사 여부 제안',
    genre_manage:'기존 장르 관리',tag_manage:'기존 키워드 관리',recommendation_manage:'기존 추천 문구 관리',
    genre_edit:'장르 수정',tag_edit:'키워드 수정',recommendation_edit:'추천 문구 수정',
    genre_remove:'장르 삭제',tag_remove:'키워드 삭제',recommendation_remove:'추천 문구 삭제'};
  const editGuides={
    tag_add:'작품에서 기억나는 소재·인물 특성·관계성을 하나씩 입력하세요. #은 자동으로 표시돼요.',
    genre_add:'장르를 하나씩 입력하고 추가해 주세요. 여러 장르는 각각 목록에 담으면 돼요.',
    synopsis_set:'처음 읽는 사람도 이해할 수 있도록 작품의 배경과 주요 사건을 직접 요약해 주세요. 중요한 반전은 피해 주세요.',
    recommendation_add:'이 작품과 잘 맞는 독자의 취향을 한 문장씩 적어 주세요. 여러 문구를 모아서 저장할 수 있어요.',
    warnings_set:'독자가 읽기 전에 알아두면 좋은 소재나 호불호 요소를 적어 주세요. 중요한 결말은 직접 밝히지 않는 편이 좋아요.',
    adult_scene_set:'구체적으로 묘사된 성적 장면의 유무를 제안해 주세요. 미확인은 관리자 검수 기본값이므로 이용자 제안에서는 선택하지 않습니다. 승인 전 공개 정보는 변하지 않아요.',
    subcouple_update:'확인한 유무만 선택해 주세요. 설명은 선택사항이고, 스포일러가 있다면 주의해 주세요.',
    completion_set:'작품의 실제 연재 상태를 확인한 경우에만 변경해 주세요. 모르면 미확인을 유지할 수 있어요.',
    genre_edit:'기존 장르 한 개만 정확히 고쳐요. 다른 장르들은 유지돼요.',
    tag_edit:'잘못 입력한 키워드 하나만 고쳐요. 다른 키워드는 그대로예요.',
    recommendation_edit:'선택한 추천 문구 하나만 수정해요. 다른 문구는 유지돼요.'
  };
  let pendingEntries=[];
  let manageKind='',editOld='';
  const managedValues=kind=>kind==='tag'?arr(data.currentWork?.tags):kind==='genre'?arr(data.currentWork?.genres):
    String(data.currentWork?.recommendation||'').split(/\n\s*\n/).map(v=>v.trim()).filter(Boolean);
  function showManage(kind){
    manageKind=kind;editOld='';editOperation.value=kind+'_manage';
    editArea.hidden=true;managePanel.hidden=false;editChoices.hidden=true;editSave.hidden=true;editSave.disabled=true;
    editSave.textContent='저장하기';manageBack.hidden=true;
    const values=managedValues(kind);
    manageList.innerHTML=values.length?values.map((value,index)=>`<div class="wc-edit-manage-row"><span>${kind==='tag'?'#':''}${escapeHtml(value)}</span><div><button type="button" data-wc-manage-action="edit" data-wc-manage-index="${index}" aria-label="${escapeHtml(value)} 수정">수정</button><button type="button" data-wc-manage-action="remove" data-wc-manage-index="${index}" aria-label="${escapeHtml(value)} 삭제">삭제</button></div></div>`).join(''):'<p class="wc-muted">등록된 정보가 없어요.</p>';
    $('wcEditTitle').textContent=editLabels[kind+'_manage'];editMessage.textContent='';
    editor.querySelectorAll('[data-wc-edit-choice]').forEach(button=>{button.classList.remove('is-selected');button.setAttribute('aria-pressed','false');});
    manageList.querySelector('button')?.focus();
  }
  // Keep unsaved input only for this dialog/work session (never localStorage).
  const editDrafts=new Map();
  let editAttempt=null;
  function rememberEditDraft() {
    const op=editOperation.value;
    if(!Object.hasOwn(editLabels,op))return;
    editDrafts.set(op,{
      value:editValue.value,choice:editChoice.value,completion:editCompletion.value,adult:editAdult.value,
      note:editSubNote.value,pending:[...pendingEntries]
    });
  }
  const isMulti=op=>['tag_add','genre_add','recommendation_add'].includes(op);
  const keyForTag=v=>filterKey(v).replace(/^#+/,'').toLocaleLowerCase();
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
    if(operation.endsWith('_manage')){showManage(operation.replace('_manage',''));return;}
    const correction=operation.endsWith('_edit')||operation.endsWith('_remove');
    const removing=operation.endsWith('_remove');
    managePanel.hidden=true;editChoices.hidden=Boolean(correction&&manageKind);editSave.hidden=false;
    manageBack.hidden=!(correction&&manageKind);
    editOperation.value=operation;
    const draft=editDrafts.get(operation);
    pendingEntries=draft?[...draft.pending]:[];
    editArea.hidden=false;
    const select=operation==='subcouple_update';
    const completion=operation==='completion_set';
    const adult=operation==='adult_scene_set';
    $('wcEditChoiceField').hidden=!select;
    $('wcEditSubcoupleNoteField').hidden=!select;
    $('wcEditCompletionField').hidden=!completion;
    $('wcEditAdultSceneField').hidden=!adult;
    $('wcEditValueField').hidden=select||completion||adult||removing;
    editBatch.hidden=!isMulti(operation);
    editValue.required=!select && !completion && !adult && !removing && !isMulti(operation) && !(operation==='warnings_set' && String(data.currentWork?.warnings||'').trim());
    editValue.value=operation==='synopsis_set'?String(data.currentWork?.synopsis||''):
      operation==='warnings_set'?String(data.currentWork?.warnings||''):correction&&!removing?editOld:'';
    editChoice.value=data.currentWork?.subcouple||'unknown';
    editSubNote.value=String(data.currentWork?.subcouple_note||'');
    editAdult.value=['있음','없음','확인 필요'].includes(data.currentWork?.adult_scene_status)?data.currentWork.adult_scene_status:'확인 필요';
    editCompletion.value=data.currentWork?.completion==='unknown'?(data.currentWork?.source_completion||'unknown'):(data.currentWork?.completion||'unknown');
    if(draft){
      editValue.value=draft.value;editChoice.value=draft.choice;
      editCompletion.value=draft.completion;editAdult.value=draft.adult;editSubNote.value=draft.note;
    }
    editValue.maxLength=operation==='synopsis_set'?3000:operation==='warnings_set'?1000:operation.startsWith('tag_')||operation.startsWith('genre_')?30:500;
    editValue.rows=operation==='synopsis_set'?7:operation==='warnings_set'?5:operation.startsWith('recommendation_')?3:1;
    $('wcEditValueField').firstChild.textContent=({tag_add:'새 키워드',genre_add:'새 장르',synopsis_set:'줄거리',recommendation_add:'추천하고 싶은 독자',warnings_set:'주의사항 · 호불호 요소',tag_edit:'수정할 키워드',genre_edit:'수정할 장르',recommendation_edit:'수정할 추천 문구'})[operation]||'내용';
    editValue.placeholder=operation==='tag_add'?'예: 능력여주':operation==='genre_add'?'예: 로맨스':operation==='recommendation_add'?'예: 가족 서사를 좋아하는 독자에게 추천해요.':'';
    $('wcEditFieldHint').textContent=editGuides[operation]||'';
    const current=operation==='tag_add'?arr(data.currentWork?.tags):operation==='genre_add'?arr(data.currentWork?.genres):[];
    const context=correction?`${removing?'삭제':'수정'} 대상: ${editOld}`:
      operation==='recommendation_add'?`이미 등록된 추천 문구 ${recommendationLines(data.currentWork?.recommendation).length}개`:
      current.length?`현재 등록된 ${operation==='tag_add'?'키워드':'장르'}: ${current.slice(0,8).map(v=>(operation==='tag_add'?'#':'')+v).join(', ')}${current.length>8?' 외':''}`:'';
    const contextEl=$('wcEditExistingInfo');contextEl.hidden=!context;contextEl.textContent=context;
    $('wcEditBatchHint').textContent=['tag_add','genre_add'].includes(operation)?'입력 후 Enter 또는 추가를 눌러 주세요.':'문구를 입력하고 목록에 추가해 주세요.';
    editor.querySelectorAll('[data-wc-edit-choice]').forEach(button=>{
      const active=button.dataset.wcEditChoice===operation;
      button.classList.toggle('is-selected',active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('wcEditTitle').textContent=editLabels[operation];
    editMessage.textContent=removing?'선택한 내용만 삭제돼요. 다른 정보는 유지되고 수정 이력이 남아요.':
      operation==='warnings_set' && String(data.currentWork?.warnings||'').trim() ? '기존 내용을 모두 지운 뒤 저장하면 주의사항이 삭제돼요.' : operation==='adult_scene_set'?'이 항목은 관리자 확인 후 공개되며 즉시 변경되지 않습니다.':'';
    editSave.textContent=removing?'선택 항목 삭제':'저장하기';
    editSave.disabled=false;
    renderPending();
    if(focusInput) (select?editChoice:completion?editCompletion:adult?editAdult:removing?editSave:editValue).focus();
  }
  function openEditor(operation='') {
    if(!data.currentWork || !editor)return;
    // Reuse the site's existing login modal instead of letting guests write and fail on save.
    if(!document.getElementById('loginButton')?.classList.contains('logged-in')){
      document.getElementById('loginButton')?.click();
      return;
    }
    editDrafts.clear();editAttempt=null;manageKind='';editOld='';
    managePanel.hidden=true;manageBack.hidden=true;editChoices.hidden=false;editSave.hidden=false;
    editOperation.value='';pendingEntries=[];editArea.hidden=true;
    editMessage.textContent='';editSave.disabled=true;
    $('wcEditTitle').textContent='어떤 정보를 채울까요?';
    $('wcEditFieldHint').textContent='';
    $('wcEditExistingInfo').textContent='';$('wcEditExistingInfo').hidden=true;
    editor.querySelectorAll('[data-wc-edit-choice]').forEach(button=>{
      button.classList.remove('is-selected');button.setAttribute('aria-pressed','false');
    });
    editor.showModal();
    if(operation && Object.hasOwn(editLabels,operation))updateEditFields(operation,true);
    else editor.querySelector('[data-wc-edit-choice]')?.focus();
  }
  function closeEditor() {if(editor?.open&&!data.editSaving)editor.close();}
  editor?.addEventListener('close',()=>{
    editDrafts.clear();editAttempt=null;pendingEntries=[];manageKind='';editOld='';
  });
  editor?.querySelectorAll('[data-wc-edit-choice]').forEach(button=>button.addEventListener('click',()=>{
    if(!data.editSaving){rememberEditDraft();manageKind='';editOld='';updateEditFields(button.dataset.wcEditChoice,true);}
  }));
  manageList?.addEventListener('click',event=>{
    if(data.editSaving)return;
    const button=event.target.closest('[data-wc-manage-action]');if(!button)return;
    const values=managedValues(manageKind),old=values[Number(button.dataset.wcManageIndex)];
    if(!old)return;
    editOld=old;const op=manageKind+'_'+button.dataset.wcManageAction;
    editDrafts.delete(op);editAttempt=null;updateEditFields(op,true);
  });
  manageBack?.addEventListener('click',()=>{
    if(data.editSaving||!manageKind)return;
    rememberEditDraft();showManage(manageKind);
  });
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
    if(!Object.hasOwn(editLabels,op)||op.endsWith('_manage'))return;
    let change;
    if(isMulti(op)) {
      if(editValue.value.trim() && !addPending())return;
      if(!pendingEntries.length){editMessage.textContent='추가할 내용을 입력해 주세요.';return;}
      change={values:[...pendingEntries]};
    } else {
      const removing=op.endsWith('_remove');
      const value=(removing?op==='recommendation_remove'?'':editOld:
        op==='subcouple_update'?editChoice.value:op==='completion_set'?editCompletion.value:op==='adult_scene_set'?editAdult.value:editValue.value).trim();
      if(!value && !removing && !(op==='warnings_set' && String(data.currentWork?.warnings||'').trim())) {editMessage.textContent='내용을 입력해 주세요.';return;}
      change=op==='subcouple_update'?{value,note:editSubNote.value}:
        ['tag_edit','genre_edit','recommendation_edit','recommendation_remove'].includes(op)?{value,old:editOld}:{value};
    }
    rememberEditDraft();
    const signature=JSON.stringify({work_id:data.currentWork.id,
      base_revision:data.currentWork.revision,operation:op,change});
    // A lost response can follow a successful DB commit. Reuse the exact same
    // request ID for an unchanged retry; changing content/revision creates a new ID.
    if(!editAttempt || editAttempt.signature!==signature){
      editAttempt={signature,requestId:crypto.randomUUID()};
    }
    const payload={...JSON.parse(signature),request_id:editAttempt.requestId};
    data.editSaving=true;editSave.disabled=true;editAdd.disabled=true;
    editor.querySelectorAll('[data-wc-edit-choice],[data-wc-remove-pending],[data-wc-manage-action]').forEach(button=>button.disabled=true);
    manageBack.disabled=true;
    editValue.disabled=true;editChoice.disabled=true;editCompletion.disabled=true;editAdult.disabled=true;editSubNote.disabled=true;
    editMessage.textContent='저장하는 중…';
    try {
      const isAdultProposal=op==='adult_scene_set';
      if(isAdultProposal){payload.kind='edit';payload.format=2;}
      const response=await fetch(isAdultProposal?'/api/work-catalog/proposals':'/api/work-catalog/edit',{
        method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},
        body:JSON.stringify(payload)
      });
      const json=await response.json();
      if(!response.ok) {
        if(response.status===401){editMessage.innerHTML='로그인이 필요해요. <button type="button" data-wc-login>로그인하기</button>';return;}
        if(response.status===409){editMessage.innerHTML='다른 수정이 먼저 반영되었거나 내용이 중복되었어요. 작성한 내용은 유지돼요. <button type="button" data-wc-reload>현재 정보 비교하기</button>';return;}
        throw new Error(json.error||'저장하지 못했어요.');
      }
      if(isAdultProposal){
        data.contributionFeedback='성적 묘사 여부 제안이 접수됐어요. 관리자 검토 전에는 공개 상태가 변경되지 않습니다.';
        renderDetail(data.currentWork);editor.close();return;
      }
      const newWork=json.work || (await (await fetch(`/api/work-catalog/${encodeURIComponent(data.currentWork.id)}?updated=${Date.now()}`,{cache:'no-store'})).json()).work;
      if(newWork && data.detailId===newWork.id){
        const additions=Array.isArray(change.values)?change.values.length:1;
        const beforeFill=catalogFill(data.currentWork);
        const afterFill=catalogFill({...data.currentWork,...newWork});
        data.contributionFeedback=afterFill.percent>beforeFill.percent
          ?`기록이 반영됐어요! 도감 채움률 ${beforeFill.percent}% → ${afterFill.percent}%`
          :op.endsWith('_remove')?'잘못 등록된 정보가 삭제됐어요. 수정 이력에도 남겼어요.':
          op.endsWith('_edit')?'정보가 수정됐어요. 정정 내용이 도감에 반영됐어요.':
          additions>1?`고마워요! ${additions}개의 정보가 도감에 더해졌어요.`:'고마워요! 작품 정보가 더 풍성해졌어요.';
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
      editor.querySelectorAll('[data-wc-edit-choice],[data-wc-remove-pending],[data-wc-manage-action]').forEach(button=>button.disabled=false);
      manageBack.disabled=false;
      editValue.disabled=false;editChoice.disabled=false;editCompletion.disabled=false;editAdult.disabled=false;editSubNote.disabled=false;
    }
  });
  editor?.addEventListener('click',async event=>{
    if(event.target.closest('[data-wc-login]')){closeEditor();document.getElementById('loginButton')?.click();}
    if(event.target.closest('[data-wc-reload]') && !data.editSaving && data.currentWork){
      const workId=data.currentWork.id, op=editOperation.value;
      rememberEditDraft();editMessage.textContent='최신 정보를 확인하는 중…';
      try {
        const response=await fetch(`/api/work-catalog/${encodeURIComponent(workId)}?updated=${Date.now()}`,
          {credentials:'same-origin',cache:'no-store'});
        const json=await response.json();
        if(!response.ok||!json.work||json.work.id!==workId||data.detailId!==workId)throw Error(json.error||'정보 확인 실패');
        data.currentWork={...data.currentWork,...json.work};
        renderDetail(data.currentWork);
        // Preserve the user's draft; the next save is a NEW revision/request.
        editAttempt=null;
        const current=op==='synopsis_set'?data.currentWork.synopsis:
          op==='warnings_set'?data.currentWork.warnings:
          op==='recommendation_add'?data.currentWork.recommendation:
          op==='genre_add'?arr(data.currentWork.genres).join(', '):
          op==='tag_add'?arr(data.currentWork.tags).join(', '):
          op==='completion_set'?statusLabel[data.currentWork.completion]:
          op==='adult_scene_set'?data.currentWork.adult_scene_status:
          op==='subcouple_update'?`${coupleLabel[data.currentWork.subcouple]||'미확인'} · ${data.currentWork.subcouple_note||''}`:
          op.startsWith('tag_')?arr(data.currentWork.tags).join(', '):
          op.startsWith('genre_')?arr(data.currentWork.genres).join(', '):
          op.startsWith('recommendation_')?data.currentWork.recommendation:'';
        const comparison=$('wcEditExistingInfo');
        comparison.hidden=false;
        comparison.textContent=`현재 등록 정보: ${String(current||'정보 미등록').slice(0,240)}`;
        editMessage.textContent='최신 정보를 확인했어요. 작성 내용은 그대로예요. 선택한 기존 항목이 바뀌었다면 「기존 정보 목록으로」 돌아가 다시 선택해 주세요.';
      }catch(error){editMessage.textContent=error.message||'최신 정보를 불러오지 못했어요. 초안은 유지돼요.';}
    }
  });
  function closeDetail({fromHistory=false,restoreScroll=true}={}) {
    closeQuest();
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
  refs.adultScene.addEventListener('change',()=>{data.adultScene=refs.adultScene.value;changed();});
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
      case 'adult_scene':data.adultScene='';refs.adultScene.value='';break;
    }
    changed();
  });
  refs.moreButton.addEventListener('click',()=>loadItems({append:true}));
  refs.cards.addEventListener('click',event=>{const button=event.target.closest('[data-wc-open]');if(button)openDetail(button.dataset.wcOpen);});
  refs.detail.addEventListener('toggle',event=>{
    const panel=event.target.closest?.('.wc-history');
    if(panel&&panel.open)loadWorkHistory(panel);
  },true);
  refs.detail.addEventListener('toggle',event=>{
    if(event.target?.matches?.('.wc-quotes-spoiler') && event.target.open &&
       !data.quoteLoaded && !data.quoteLoading)loadWorkQuotes();
  },true);
  refs.detail.addEventListener('click',event=>{
    if(event.target.closest('[data-wc-quest-open]')) {openQuest();return;}
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
    queueChoiceHeights();
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
      closeQuest();
      closeMobileFilters();
      if(data.debounce)clearTimeout(data.debounce);
      data.seq++;data.abort?.abort();data.loading=false;
      if(data.detailId)closeDetail({restoreScroll:false});
    }
  };
  updateFilters();
})();
