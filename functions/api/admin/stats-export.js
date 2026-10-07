import { jsonResponse, requireKv, getJson, PUBLIC_ARCHIVE_INDEX_KEY } from '../../_shared.js';
import { requireUserDb } from '../../_user.js';
import { requireAdminSession } from '../../_admin_session.js';
import { adminPeriod } from '../../_admin_period.js';
import { buildReport } from '../../_admin_report.js';
import { getCommitHistory } from './history.js';
import siteVersion from '../../../public/version.json';

const MAX_ROWS = 10000;
const ALL_SECTIONS = ['visits','activity','content','sync','performance','history'];
function failure(message, status = 413) { return Object.assign(new Error(message), { status }); }
const results = value => value?.results || [];
async function pseudonymizer() {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const memo = new Map();
  return async (kind, value) => {
    if (value == null) return null;
    const key = kind + ':' + value;
    if (!memo.has(key)) memo.set(key, crypto.subtle.digest('SHA-256', new TextEncoder().encode(Array.from(salt).join(',') + key)).then(buffer => kind + '_' + Array.from(new Uint8Array(buffer)).map(n=>n.toString(16).padStart(2,'0')).join('')));
    return memo.get(key);
  };
}
export async function captureReport(context, options) {
  const cutoff = Date.now();
  if(!options||typeof options!=='object')throw failure('내보내기 요청이 올바르지 않습니다.',400);
  const selected = options.include ?? ALL_SECTIONS;
  if (!Array.isArray(selected) || !selected.length || selected.some(key => !ALL_SECTIONS.includes(key)) || new Set(selected).size !== selected.length) throw failure('포함 항목 선택이 올바르지 않습니다.',400);
  const db = requireUserDb(context.env);
  const hasVisits = selected.some(key=>['visits','performance','activity'].includes(key));
  const existing = new Set(results(await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).map(row=>row.name));
  if (hasVisits && !existing.has('analytics_sessions')) throw failure('방문 통계 테이블이 없습니다. 불완전한 보고서는 생성하지 않습니다.',503);
  let content=null, history=null;
  const syncSources=[];
  if(selected.includes('content')||selected.includes('sync')) {
    const kv=requireKv(context.env);
    if(selected.includes('content')) {
      content=await getJson(kv,PUBLIC_ARCHIVE_INDEX_KEY,null);
      if(content&&(!Array.isArray(content.items)||!Number.isFinite(Date.parse(content.indexUpdatedAt))))throw failure('공개 인덱스의 snapshot 시각/형식이 없어 정확한 내보내기를 할 수 없습니다.',409);
      if(content?.items?.length>MAX_ROWS)throw failure('공개 콘텐츠가 10,000행 한도를 넘습니다. 콘텐츠 항목을 제외해 주세요.');
      if(content&&Date.parse(content.indexUpdatedAt)>cutoff)throw failure('내보내기 도중 공개 인덱스가 갱신되었습니다. 다시 시도해 주세요.',409);
    }
    if(selected.includes('sync'))for(const [key,target]of [['archive:last-drive-sync:v1','Drive 수동 동기화'],['automation:auto-sync:drive:v1','Drive 자동 동기화'],['automation:auto-sync:postype:v1','POSTYPE 자동 동기화']]) {
      const r=await getJson(kv,key,null),at=Math.max(...[r?.finishedAt,r?.checkedAt,r?.startedAt].map(Date.parse).filter(Number.isFinite));
      if(r&&at>cutoff)throw failure('내보내기 도중 동기화 상태가 갱신되었습니다. 다시 시도해 주세요.',409);
      if(r&&Number.isFinite(at))syncSources.push({target,at,state:r.state||null,added:['error','running'].includes(r.state)?null:r.addedCount??null,updated:['error','running'].includes(r.state)?null:r.updatedCount??null,removed:['error','running'].includes(r.state)?null:r.removedCount??null,unchanged:['error','running'].includes(r.state)?null:r.unchangedCount??null,hasError:Boolean(r.error)||Number(r.failedSeries)>0});
    }
  }
  if(selected.includes('history')) {
    if(!context.env.GITHUB_TOKEN)throw failure('GitHub 이력 조회 설정이 없습니다. 배포/버전 이력을 제외하고 다시 시도해 주세요.',503);
    history=await getCommitHistory(context.env.GITHUB_TOKEN);
    if(history.truncated)throw failure('GitHub 이력이 기존 조회 한도 2000개를 넘을 수 있어 완전한 보고서를 생성할 수 없습니다.');
  }
  const beginnings=[];
  if(options.days==='all') {
    if(hasVisits)beginnings.push((await db.prepare('SELECT MIN(started_at) AS first FROM analytics_sessions WHERE started_at <= ?').bind(cutoff).first())?.first);
    if(selected.includes('activity')&&existing.has('users'))beginnings.push((await db.prepare('SELECT MIN(created_at) AS first FROM users WHERE created_at <= ?').bind(cutoff).first())?.first);
    beginnings.push(...syncSources.map(r=>r.at),...(history?.commits||[]).map(r=>Date.parse(r.date)));
  }
  const first=Math.min(cutoff,...beginnings.filter(n=>Number.isFinite(n)&&n>0));
  const period=adminPeriod(options.days,cutoff,first);
  if(hasVisits&&(await db.prepare('SELECT COUNT(*) AS count FROM analytics_sessions WHERE started_at >= ? AND started_at <= ?').bind(period.from,cutoff).first())?.count>MAX_ROWS)throw failure('선택 기간의 세션이 10,000행을 넘습니다. 기간을 줄여 주세요.');
  const statements = [], indexes = {};
  const add = (name, sql, ...args) => { indexes[name]=statements.length;statements.push(db.prepare(sql).bind(...args)); };
  if (hasVisits) {
    add('sessions',`SELECT session_id, visitor_id, user_id, started_at, last_seen_at, page_views, work_opens, searches, active_seconds, device_type, browser_name, source_type, app_version, ${selected.includes('performance')?'page_load_ms, archive_load_ms, reader_load_ms_sum, reader_load_count, reader_perf_json':'NULL AS page_load_ms, NULL AS archive_load_ms, NULL AS reader_load_ms_sum, NULL AS reader_load_count, NULL AS reader_perf_json'} FROM analytics_sessions WHERE started_at >= ? AND started_at <= ? ORDER BY started_at, session_id LIMIT ?`,period.from,cutoff,MAX_ROWS+1);
    add('visitors',`WITH period AS (SELECT DISTINCT visitor_id FROM analytics_sessions WHERE started_at >= ? AND started_at <= ?) SELECT s.visitor_id, COUNT(*) AS session_count, MIN(s.started_at) AS first_seen_at FROM analytics_sessions s JOIN period p ON p.visitor_id=s.visitor_id WHERE s.started_at <= ? GROUP BY s.visitor_id LIMIT ?`,period.from,cutoff,cutoff,MAX_ROWS+1);
    add('control',`WITH period AS (SELECT DISTINCT visitor_id FROM analytics_sessions WHERE started_at >= ? AND started_at <= ?), repeat_visitors AS (SELECT s.visitor_id FROM analytics_sessions s JOIN period p ON p.visitor_id=s.visitor_id WHERE s.started_at <= ? GROUP BY s.visitor_id HAVING COUNT(*)>=2) SELECT COUNT(*) AS sessions,COUNT(DISTINCT visitor_id) AS visitors,COALESCE(SUM(work_opens),0) AS work_opens,COALESCE(SUM(active_seconds),0) AS active_seconds,(SELECT COUNT(*) FROM repeat_visitors) AS returning_visitors FROM analytics_sessions WHERE started_at >= ? AND started_at <= ?`,period.from,cutoff,cutoff,period.from,cutoff);
    add('late',`SELECT COUNT(*) AS count FROM analytics_sessions WHERE started_at <= ? AND last_seen_at > ?`,cutoff,cutoff);
  }
  if(selected.includes('activity')) {
    if(existing.has('users')) add('users','SELECT user_id,created_at FROM users WHERE created_at <= ? ORDER BY created_at LIMIT ?',cutoff,MAX_ROWS+1);
    for(const [name,table,time,extra] of [['bookmarks','user_items','updated_at','bookmarked=1'],['recent','user_items','updated_at','viewed_at IS NOT NULL'],['reading','user_items','updated_at','progress_percent>0 AND read_at IS NULL'],['read','user_items','updated_at','read_at IS NOT NULL'],['quotes','user_quotes','created_at','1=1'],['notes','reader_notes','updated_at','1=1'],['shared','shared_quotes','shared_at','1=1']]) {
      if(existing.has(table)) add(name,`SELECT COUNT(*) AS count FROM ${table} WHERE ${time} <= ? AND ${extra}`,cutoff);
    }
    for(const [table,time] of [['user_items','updated_at'],['user_quotes','created_at'],['reader_notes','updated_at'],['shared_quotes','shared_at']])if(existing.has(table))add('late_'+table,`SELECT COUNT(*) AS count FROM ${table} WHERE ${time}>?`,cutoff);
  }
  const captured = statements.length ? await db.batch(statements) : [];
  const read = name => indexes[name]==null ? [] : results(captured[indexes[name]]);
  const sessions = read('sessions'), visitors = read('visitors'), users = read('users');
  if(sessions.length>MAX_ROWS||visitors.length>MAX_ROWS||users.length>MAX_ROWS)throw failure(`원본이 ${MAX_ROWS.toLocaleString('ko-KR')}행 한도를 넘습니다. 더 짧은 기간으로 내보내세요. 데이터는 잘라서 내보내지 않습니다.`);
  if(Object.keys(indexes).some(name=>name.startsWith('late')&&Number(read(name)[0]?.count)>0))throw failure('내보내기 시작 이후 원본이 갱신되었습니다. 동일 cutoff 보고서를 위해 다시 시도해 주세요.',409);
  if(sessions.reduce((n,r)=>n+String(r.reader_perf_json||'').length,0)>8*1024*1024)throw failure('성능 원본 크기가 한도를 넘습니다. 기간을 줄여 주세요.');
  const anon=await pseudonymizer();
  for(const row of visitors)row.visitor_id=await anon('browser',row.visitor_id);
  for(const row of sessions){row.session_id=await anon('session',row.session_id);row.visitor_id=await anon('browser',row.visitor_id);row.user_id=await anon('account',row.user_id);}
  const activity=selected.includes('activity')?{totalUsers:existing.has('users')?users.length:null,newUsers:existing.has('users')?users.filter(r=>r.created_at>=period.from).length:null,activeUsers:new Set(sessions.filter(r=>r.user_id!=null).map(r=>r.user_id)).size,...Object.fromEntries(['bookmarks','recent','reading','read','quotes','notes','shared'].map(name=>[name,read(name)[0]?.count??null]))}:null;
  const sync=syncSources.filter(r=>r.at>=period.from&&r.at<=cutoff);
  const commits=(history?.commits||[]).filter(r=>Date.parse(r.date)>=period.from&&Date.parse(r.date)<=cutoff);
  const mainCommit=/^[a-f0-9]{40}$/i.test(context.env.CF_PAGES_COMMIT_SHA||'')?context.env.CF_PAGES_COMMIT_SHA:(history?.commits||[]).find(r=>Date.parse(r.date)<=cutoff)?.sha||null;
  const report=buildReport({cutoff,period,selected,sessions,visitors,users,activity,content,sync,commits,control:read('control')[0]||{},version:siteVersion.version,siteName:context.env.SITE_NAME||'셩냥책',mainCommit,historyFetchedAt:history?.updatedAt});
  if(new TextEncoder().encode(JSON.stringify(report)).byteLength>12*1024*1024)throw failure('보고서 응답이 12MiB 한도를 넘습니다. 기간이나 포함 항목을 줄여 주세요.');
  return report;
}
export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    let options;try{options=await context.request.json();}catch{throw failure('JSON 요청이 올바르지 않습니다.',400);}
    const report=await captureReport(context,options);
    return jsonResponse({ok:true,...report},200,{'cache-control':'no-store'});
  } catch(error) {
    if(!error.status||error.status>=500)console.error('관리자 통계 내보내기 실패',error);
    return jsonResponse({error:error.message||'통계를 내보내지 못했습니다.'},error.status||500,{'cache-control':'no-store'});
  }
}
