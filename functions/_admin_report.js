import { kstDateKey } from './_admin_period.js';
import { aggregateReaderPerf } from './api/admin/analytics.js';

export const REPORT_SHEETS = ['00_내보내기정보','01_통합요약','02_방문통계','03_일별방문','04_월별방문','05_세션원본','06_사용자활동','07_콘텐츠현황','08_동기화이력','09_성능통계','10_배포버전','11_검증','12_지표정의','13_운영점검'];
const fields = ['sessions','visitors','newVisitors','returningVisitors','returnRate','loggedSessions','guestSessions','workOpens','workOpensPerSession','activeSeconds','activeSecondsPerSession'];
const labels = ['세션','순방문자','신규 방문자','재방문자','재방문율','로그인 세션','비로그인 세션','작품 열기','세션당 작품 열기','활성시간(초)','평균 활성시간(초)'];
const dt = value => value ? { value: new Date(value).toISOString(), type: 'datetime' } : null;
const table = (name, columns, rows) => ({ name, columns: columns.map(c => typeof c === 'string' ? { label: c } : c), rows });
const na = (name, reason) => table(name, ['상태','설명'], [['N/A', reason]]);
const sum = (rows, key) => rows.reduce((n, row) => n + Number(row[key] || 0), 0);

export function summarizeSessions(rows, lifetime, from) {
  const visitors = new Set(rows.map(row => row.visitor_id));
  const sessions = rows.length, workOpens = sum(rows, 'work_opens'), activeSeconds = sum(rows, 'active_seconds');
  const returningVisitors = [...visitors].filter(id => Number(lifetime.get(id)?.session_count) >= 2).length;
  return { sessions, visitors: visitors.size, newVisitors: [...visitors].filter(id => Number(lifetime.get(id)?.first_seen_at) >= from).length,
    returningVisitors, returnRate: visitors.size ? returningVisitors / visitors.size : null,
    loggedSessions: rows.filter(row => row.user_id != null).length, guestSessions: rows.filter(row => row.user_id == null).length,
    workOpens, workOpensPerSession: sessions ? workOpens / sessions : null, activeSeconds, activeSecondsPerSession: sessions ? activeSeconds / sessions : null };
}
function safePerf(value) {
  let input = {}; try { input = JSON.parse(value || '{}'); } catch {}
  if(!input||typeof input!=='object') input={};
  const number = x => Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : 0;
  const pair = p => ({ sum: number(p?.sum), count: number(p?.count) });
  const output = {};
  for (const key of ['total','response','download','render','layout']) output[key] = pair(input[key]);
  const groups = { cache: ['hit','miss','unknown'], size: ['small','medium','large'], mode: ['scroll','page'], missServer: ['kvRead','token','verify','driveRequest','driveDownload','decode','kvWrite','total'], renderDetail: ['domSetup','textInsert','settle','overlay','overlayFrameWait','overlayTransition','overlayRemove','modeSetup','paintWait','offsetRestore'] };
  for (const [group, keys] of Object.entries(groups)) output[group] = Object.fromEntries(keys.map(key => [key, pair(input[group]?.[key])]));
  output.histogram = Object.fromEntries(['under1','oneTo2','twoTo4','fourTo8','over8'].map(key => [key, number(input.histogram?.[key])]));
  return JSON.stringify(output);
}

export function buildReport(snapshot) {
  const { period, cutoff, selected, sessions, visitors, users, activity, content, sync, commits, version, mainCommit } = snapshot;
  const included = key => selected.includes(key);
  const lifetime = new Map(visitors.map(row => [row.visitor_id, row]));
  const stats = summarizeSessions(sessions, lifetime, period.from);
  const statsColumns = fields.map((key, i) => ({ label: labels[i], type: key === 'returnRate' ? 'percent' : 'number' }));
  const statsRow = stat => fields.map(key => stat[key]);
  const enabledVisits = included('visits');
  const groups = prefix => {
    const grouped = new Map();
    for (const row of sessions) { const key = kstDateKey(row.started_at).slice(0, prefix); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(row); }
    for (const { key: day } of period.dateKeys) { const key = day.slice(0, prefix); if (!grouped.has(key)) grouped.set(key, []); }
    return [...grouped].sort(([a],[b]) => a.localeCompare(b)).map(([key, rows]) => [
      { value: `${key}${prefix === 7 ? '-01' : ''}T00:00:00+09:00`, type: prefix === 7 ? 'month' : 'date' }, ...statsRow(summarizeSessions(rows, lifetime, Math.max(period.from, Date.parse(key + (prefix === 7 ? '-01' : '') + 'T00:00:00+09:00')))),
    ]);
  };
  const daily = groups(10), monthly = groups(7);
  const checks = [];
  const check = (name, expected, actual) => checks.push([name, expected, actual, expected == null || actual == null ? null : actual - expected, expected == null || actual == null ? 'N/A' : expected === actual ? 'PASS' : 'FAIL']);
  if (enabledVisits || included('performance')) {
    check('세션 원본 vs SQL 세션', snapshot.control.sessions, sessions.length);
    check('일별 세션 합계', stats.sessions, daily.reduce((n,r) => n + r[1],0));
    check('월별 세션 합계', stats.sessions, monthly.reduce((n,r) => n + r[1],0));
    check('로그인+비로그인 세션', stats.sessions, stats.loggedSessions + stats.guestSessions);
    check('순방문자 vs SQL distinct', snapshot.control.visitors, stats.visitors);
    check('재방문자 vs SQL 누적 세션', snapshot.control.returning_visitors, stats.returningVisitors);
    check('작품 열기 vs SQL 합계', snapshot.control.work_opens, stats.workOpens);
    check('일별 작품 열기 합계', stats.workOpens, daily.reduce((n,r) => n + r[8],0));
    check('활성시간 vs SQL 합계', snapshot.control.active_seconds, stats.activeSeconds);
  } else check('방문 통계 미선택', null, null);
  const sourceCounts = content?.items ? content.items.reduce((m,r) => { const key=r.source || 'drive';m[key]=(m[key]||0)+1;return m; }, {}) : null;
  if (included('content')) check('콘텐츠 출처 합계', content?.items?.length ?? null, sourceCounts ? Object.values(sourceCounts).reduce((n,v)=>n+v,0) : null);
  if (included('activity')) check('신규 가입 vs 회원 생성 시각', activity?.newUsers ?? null, users.filter(u=>u.created_at>=period.from).length);
  const summary = [];
  if (enabledVisits) fields.forEach((key,i)=>summary.push([labels[i], key==='returnRate' ? { value:stats[key],type:'percent' } : stats[key]]));
  if (included('activity')) summary.push(['현재 회원',activity?.totalUsers ?? 'N/A'],['기간 신규 가입',activity?.newUsers ?? null],['기간 로그인 활동 사용자',activity?.activeUsers ?? null]);
  if (enabledVisits) summary.push(['로그인 세션 비율',stats.sessions?{value:stats.loggedSessions/stats.sessions,type:'percent'}:null],['비로그인 세션 비율',stats.sessions?{value:stats.guestSessions/stats.sessions,type:'percent'}:null]);
  if (included('content')) summary.push(['현재 콘텐츠',content?.items?.length ?? null]);
  summary.push(['사이트 버전',version]);
  const raw = sessions.map(row=>[row.session_id,row.visitor_id,row.user_id,dt(row.started_at),dt(row.last_seen_at),row.user_id==null?0:1,row.page_views,row.work_opens,row.searches,row.active_seconds,row.device_type,row.browser_name,row.source_type,row.app_version,row.reader_load_ms_sum,row.reader_load_count,row.page_load_ms,row.archive_load_ms,Number(lifetime.get(row.visitor_id)?.session_count||0),dt(lifetime.get(row.visitor_id)?.first_seen_at),included('performance')?safePerf(row.reader_perf_json):null]);
  const perf = [];
  if (included('performance')) {
    for (const scope of ['전체',...new Set(sessions.map(r=>r.app_version).filter(Boolean))]) {
      const rows = scope==='전체' ? sessions : sessions.filter(r=>r.app_version===scope);
      const numericMean = key => {const values=rows.map(r=>r[key]).filter(x=>Number(x)>0);return [values.length,values.length?values.reduce((n,x)=>n+Number(x),0)/values.length:null];};
      for(const [key,label] of [['page_load_ms','초기 로딩'],['archive_load_ms','목록 로딩']]) perf.push([scope,label,...numericMean(key),null,null]);
      const count=sum(rows,'reader_load_count');perf.push([scope,'뷰어 로딩',count,count?sum(rows,'reader_load_ms_sum')/count:null,null,null]);
      const detail=aggregateReaderPerf(rows.map(r=>({...r,reader_perf_json:safePerf(r.reader_perf_json)})));
      perf.push([scope,'뷰어 histogram P50',Object.values(detail.histogram).reduce((n,v)=>n+v,0),null,detail.p50OpenEnded?null:detail.p50ApproxMs,detail.p50OpenEnded?'>8000ms':'구간 상한 근사값']);
      perf.push([scope,'뷰어 histogram P95',Object.values(detail.histogram).reduce((n,v)=>n+v,0),null,detail.p95OpenEnded?null:detail.p95ApproxMs,detail.p95OpenEnded?'>8000ms':'구간 상한 근사값']);
      for(const group of ['cache','size','mode','missServer','renderDetail'])for(const [key,value]of Object.entries(detail[group]))perf.push([scope,`${group}.${key}`,value.count,value.averageMs,null,null]);
      for(const [key,value]of Object.entries(detail.phases)) { const count = rows.reduce((n,r)=>n+JSON.parse(safePerf(r.reader_perf_json))[key.replace(/Ms$/, '')].count,0); perf.push([scope,key,count,count?value:null,null,null]); }
    }
  }
  const definitions = [];
  const def=(label,key,formula,source,periodRule,distinct='',notes='')=>definitions.push([label,key,formula,source,periodRule,distinct,'Asia/Seoul','cutoff 이후 생성/수정 세션 제외; 포함영역 미선택 제외',notes]);
  const periodRule='started_at >= 조회 시작 KST 00:00 AND started_at/last_seen_at <= cutoff';
  fields.forEach((key,i)=>def(labels[i],key,[
    'COUNT session_id','COUNT DISTINCT visitor_id','기간 방문 ID 중 전체 보존 이력 MIN(started_at) >= 해당 기간 시작','기간 방문 ID 중 전체 보존 이력 COUNT >= 2','재방문자 / 순방문자; 분모 0이면 빈 값','user_id IS NOT NULL인 세션','user_id IS NULL인 세션','SUM(work_opens)','SUM(work_opens) / 세션; 분모 0이면 빈 값','SUM(active_seconds)','SUM(active_seconds) / 세션; 분모 0이면 빈 값',
  ][i],'analytics_sessions',periodRule,key.includes('Visitor')||key==='visitors'?'visitor_id(브라우저 ID)':'', '로그인 계정 ID와 브라우저 ID를 합치지 않음; 재방문은 각 일/월도 export cutoff까지 누적 이력 기준'));
  const activityDefs={totalUsers:['현재 회원','COUNT(*)','users.created_at'],newUsers:['기간 신규 가입','COUNT(*) WHERE created_at >= from','users.created_at'],activeUsers:['기간 로그인 활동 사용자','COUNT DISTINCT user_id WHERE user_id IS NOT NULL','analytics_sessions.user_id'],bookmarks:['북마크','COUNT(*) WHERE bookmarked=1','user_items.updated_at/bookmarked'],recent:['최근 읽기','COUNT(*) WHERE viewed_at IS NOT NULL','user_items.updated_at/viewed_at'],reading:['읽는 중','COUNT(*) WHERE progress_percent>0 AND read_at IS NULL','user_items.updated_at/progress_percent/read_at'],read:['읽음','COUNT(*) WHERE read_at IS NOT NULL','user_items.updated_at/read_at'],quotes:['저장 문장','COUNT(*)','user_quotes.created_at'],notes:['메모','COUNT(*)','reader_notes.updated_at'],shared:['공유 문장','COUNT(*)','shared_quotes.shared_at']};
  for(const key of Object.keys(activity||{})){const [label,formula,source]=activityDefs[key];def(label,key,formula,source,key==='newUsers'?'from <= created_at <= cutoff':key==='activeUsers'?periodRule:'현재 보존 행 중 해당 시각 <= cutoff',key==='activeUsers'?'익명 계정 ID':'','현재 상태는 과거 상태/기간 증가량이 아님; 삭제 전 이력 복원 불가');}
  for(const [label,key,formula]of [['페이지뷰','page_views','저장된 누적 페이지뷰'],['검색','searches','저장된 누적 검색 횟수'],['뷰어 로딩 합','reader_load_ms_sum','세션의 측정 ms 합'],['뷰어 로딩 표본','reader_load_count','세션의 측정 count'],['최초 로딩','page_load_ms','세션에 저장된 측정 ms'],['목록 로딩','archive_load_ms','세션에 저장된 측정 ms']])def(label,key,formula,'analytics_sessions.'+key,periodRule);
  def('콘텐츠','content','공개 인덱스 items의 실제 행 수/출처별 COUNT','archive:public-index:v1','cutoff 이하 indexUpdatedAt 현재 snapshot','','과거 기간별 증감/중복 의심 판정은 산출 불가');
  def('동기화','sync','저장된 마지막 실행만 표시','archive:last-drive-sync:v1; automation:auto-sync:*','저장 실행 시각 from~cutoff','','없음은 성공 0건이 아님; 과거 누적 성공/실패 횟수 산출 불가');
  def('성능','performance','page/archive AVG(>0); reader SUM(ms)/SUM(count); histogram 누적 구간 상한 P50/P95','analytics_sessions.reader_*; page_load_ms; archive_load_ms',periodRule,'','정확한 percentile 아님; >8초 마지막 구간은 열린 구간. 세션별 집계만 저장되어 개별 로딩 원본 없음');
  def('Git 커밋','commits','GitHub main의 실제 sha/date/message','GitHub commits API(기존 5분 캐시)','committer date from~cutoff','','커밋은 Pages 배포 성공 횟수가 아님; Pages 배포 횟수 별도 조회하지 않음');
  const operations=[['집계 검산',checks.some(r=>r[4]==='FAIL')?'CHECK':'OK',checks.filter(r=>r[4]==='PASS').length,'11 검산 불일치 유무','11_검증'],['방문 원본 존재',enabledVisits?(sessions.length?'OK':'CHECK'):'N/A',enabledVisits?sessions.length:null,'해당 기간 보존 세션 존재 여부','05_세션원본'],['성능 표본 존재',included('performance')?(sum(sessions,'reader_load_count')?'OK':'CHECK'):'N/A',included('performance')?sum(sessions,'reader_load_count'):null,'뷰어 로딩 측정 count 합계','09_성능통계'],['일별 데이터 연속성',enabledVisits?'OK':'N/A',enabledVisits?daily.length:null,'행은 0세션 날짜를 포함; 수집 중단인지 무방문인지 구분 불가','03_일별방문'],['버전 정보',version?'OK':'CHECK',version||null,'현재 version.json','00_내보내기정보']];
  for(const row of sync||[])operations.push([row.target+' 마지막 동기화',row.state==='success'?'OK':row.state?'CHECK':'N/A',row.state,'저장된 마지막 상태; 과거 모든 실행의 상태는 아님','08_동기화이력']);
  const sheets=[
    table(REPORT_SHEETS[0],['항목','값'],[['사이트명',snapshot.siteName],['사이트 버전',version],['export_schema_version',1],['조회 시작일',{value:period.from,type:'date'}],['조회 종료일',{value:cutoff,type:'date'}],['export_cutoff_at',dt(cutoff)],['파일 생성 시각',dt(Date.now())],['기준 시간대','Asia/Seoul'],['생성 방식','관리자 인증 후 D1 read batch + KV/GitHub 보존 snapshot; 브라우저 OOXML'],['포함 영역',selected.join(', ')],['제외 영역',['visits','activity','content','sync','performance','history'].filter(k=>!included(k)).join(', ')||'없음'],['개인정보/Secret','계정명/브라우저 원본 ID는 파일별 익명화; 인증정보·메모/문장 원문·본문 제외'],['source tables','analytics_sessions, users, user_items, user_quotes, reader_notes, shared_quotes'],['main commit hash',mainCommit||'N/A'],['가변 원본 제한','과거 시점 상태 복원 불가. cutoff 이후 수정된 원본 감지 시 export 실패. 보존 원본의 cutoff snapshot만 사용.'],['KV/GitHub 제한','KV는 현재 보존 snapshot만 사용; GitHub는 기존 캐시의 조회시각도 기록. 없는 이력은 N/A.'],['Git 조회 시각',dt(snapshot.historyFetchedAt)],['완전성','선택 영역은 제한 초과/조회 실패 시 전체 export 실패; 저장되지 않은 지표는 N/A']]),
    table(REPORT_SHEETS[1],['지표','값'],summary),
    enabledVisits?table(REPORT_SHEETS[2],statsColumns,[statsRow(stats)]):na(REPORT_SHEETS[2],'방문 통계 미선택'),
    enabledVisits?table(REPORT_SHEETS[3],[{label:'날짜',type:'date'},...statsColumns],daily):na(REPORT_SHEETS[3],'방문 통계 미선택'),
    enabledVisits?table(REPORT_SHEETS[4],[{label:'월',type:'month'},...statsColumns],monthly):na(REPORT_SHEETS[4],'방문 통계 미선택'),
    enabledVisits||included('performance')?table(REPORT_SHEETS[5],['익명 세션 ID','익명 브라우저 ID','익명 계정 ID',{label:'시작',type:'datetime'},{label:'최종 갱신',type:'datetime'},'로그인(1/0)','페이지뷰','작품 열기','검색','활성초','기기','브라우저','유입','버전','뷰어 ms 합','뷰어 표본수','페이지 로딩 ms','목록 로딩 ms','브라우저 누적 세션수',{label:'브라우저 최초 세션',type:'datetime'},'성능 집계 JSON(허용 숫자 필드만)'],raw):na(REPORT_SHEETS[5],'방문/성능 미선택'),
    included('activity')?table(REPORT_SHEETS[6],['지표','값','기준'],Object.entries(activity).map(([k,v])=>[activityDefs[k][0],v ?? 'N/A',k==='newUsers'?'기간 신규 가입':k==='activeUsers'?'기간 로그인 세션 user_id distinct':'현재 보존 상태(기간 증가량 아님)'])):na(REPORT_SHEETS[6],'사용자 활동 미선택'),
    included('content')&&content?table(REPORT_SHEETS[7],['출처','상태','구분','작가','바이트','작품 ID'],content.items.map(r=>[r.source||'drive',r.status||null,r.contentType||r.publishType||null,r.author||null,r.size==null?null:Number(r.size),r.id])):na(REPORT_SHEETS[7],included('content')?'공개 인덱스 snapshot 없음':'콘텐츠 미선택'),
    included('sync')&&sync.length?table(REPORT_SHEETS[8],[{label:'시각',type:'datetime'},'대상','상태','추가','수정','삭제','변경없음','오류 존재','저장 범위'],sync.map(r=>[dt(r.at),r.target,r.state,r.added,r.updated,r.removed,r.unchanged,r.hasError?1:0,'대상별 마지막 실행만 보존'])):na(REPORT_SHEETS[8],included('sync')?'선택 기간에 보존된 마지막 실행 없음; 과거 이력 산출 불가':'동기화 미선택'),
    included('performance')?table(REPORT_SHEETS[9],['버전 범위','지표','표본수','평균(ms)','분위 구간 상한(ms)','비고'],perf):na(REPORT_SHEETS[9],'성능 미선택'),
    included('history')?table(REPORT_SHEETS[10],['버전','commit hash','메시지',{label:'커밋 시각',type:'datetime'},'구분'],[...commits.map(r=>[(r.message.match(/^v([\d.]+)[:\s]/)||[])[1]||null,r.sha,r.message,dt(r.date),'GitHub main 커밋']),[null,null,'Pages/관리자 배포 횟수는 별도 Cloudflare 리소스 지표이며 이 보고서에서 조회하지 않음',null,'N/A']]):na(REPORT_SHEETS[10],'버전 이력 미선택'),
    table(REPORT_SHEETS[11],['검증명','기준값','비교값','차이','결과'],checks),
    table(REPORT_SHEETS[12],['지표명','내부 key','계산식/정의','원본 테이블/필드','기간 적용','distinct 기준','시간대','제외 조건','비고'],definitions),
    table(REPORT_SHEETS[13],['점검 항목','상태','현재 값','기준/설명','참고 시트'],operations),
  ];
  return { exportSchemaVersion:1, cutoff, from:period.from, timezone:'Asia/Seoul', sheets, validationFailed:checks.some(r=>r[4]==='FAIL'), filename:`${snapshot.siteName}_관리자통계_${period.fromDate}_${period.toDate}.xlsx` };
}
