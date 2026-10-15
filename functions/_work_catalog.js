// v10.51 Works encyclopedia: isolated D1 schema. Existing user/library/quote tables untouched.
const MAX_BODY = 18000;
let schemaPromise;
export async function ensureWorkCatalogSchema(db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_works (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '', original_title TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '', completion TEXT NOT NULL DEFAULT 'unknown',
      genre_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]',
      synopsis TEXT NOT NULL DEFAULT '', subcouple TEXT NOT NULL DEFAULT 'unknown',
      subcouple_note TEXT NOT NULL DEFAULT '', recommendation TEXT NOT NULL DEFAULT '', warnings TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      revision INTEGER NOT NULL DEFAULT 1,
      last_mutation_token TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_works_status_recent ON catalog_works(status,updated_at DESC,id DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_works_name ON catalog_works(title,author)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_source_links (
      source_type TEXT NOT NULL CHECK(source_type IN ('drive','postype')),
      source_id TEXT NOT NULL, work_id TEXT NOT NULL REFERENCES catalog_works(id),
      created_at INTEGER NOT NULL, PRIMARY KEY(source_type,source_id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_source_work ON catalog_source_links(work_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_proposals (
      id TEXT PRIMARY KEY, work_id TEXT REFERENCES catalog_works(id),
      user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('create','edit')),
      payload_json TEXT NOT NULL, base_updated_at INTEGER, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      admin_note TEXT NOT NULL DEFAULT '', request_id TEXT, fingerprint TEXT, review_token TEXT,
      created_at INTEGER NOT NULL, reviewed_at INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_proposals_queue ON catalog_proposals(status,created_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_proposals_user ON catalog_proposals(user_id,created_at DESC)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, work_id TEXT, action TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_audit_work_recent ON catalog_audit(work_id,id DESC)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_direct_edits (
      request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, work_id TEXT NOT NULL,
      operation TEXT NOT NULL, request_json TEXT NOT NULL, created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_direct_edits_user_time
      ON catalog_direct_edits(user_id,created_at DESC)`),
    ]);
    // Additive migration: never rebuild or drop existing v10.53 tables.
    const addColumn = async (table, column, declaration) => {
      const info = await db.prepare(`PRAGMA table_info(${table})`).all();
      if ((info.results || []).some(r => r.name === column)) return;
      try { await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`).run(); }
      catch (error) { if (!/duplicate column/i.test(String(error?.message || ''))) throw error; }
    };
    await addColumn('catalog_works', 'revision', 'INTEGER NOT NULL DEFAULT 1');
    await addColumn('catalog_works', 'last_mutation_token', 'TEXT');
    for (const column of ['review_token','request_id','fingerprint']) {
      await addColumn('catalog_proposals', column, 'TEXT');
    }
    await db.batch([
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_request_once ON catalog_proposals(user_id,request_id) WHERE request_id IS NOT NULL"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_pending_fingerprint ON catalog_proposals(user_id,fingerprint) WHERE status='pending' AND fingerprint IS NOT NULL"),
      // Blocks older deployed review handlers from marking v2 proposals completed without a token.
      db.prepare(`CREATE TRIGGER IF NOT EXISTS catalog_v2_review_guard
        BEFORE UPDATE OF status ON catalog_proposals
        WHEN OLD.status='pending' AND NEW.status!='pending'
          AND json_valid(OLD.payload_json)
          AND json_extract(OLD.payload_json,'$.format')=2
          AND (NEW.review_token IS NULL OR NEW.review_token='')
        BEGIN SELECT RAISE(ABORT,'v2 review token required'); END`),
    ]);
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

export function catalogError(message, status = 400) {
  const error = new Error(message); error.status = status; return error;
}
export async function catalogBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw catalogError('요청 본문 크기 제한을 초과했습니다.', 413);
  try { const obj = JSON.parse(text); if (!obj || Array.isArray(obj) || typeof obj !== 'object') throw Error(); return obj; }
  catch { throw catalogError('JSON 본문 형식이 올바르지 않습니다.'); }
}
const bounded = (v, n, field, required = false) => {
  if (v != null && typeof v !== 'string') throw catalogError(`${field} 형식이 올바르지 않습니다.`);
  const value = String(v ?? '').trim();
  if (value.length > n) throw catalogError(`${field}는 ${n}자 이내로 입력해 주세요.`);
  if (required && !value) throw catalogError(`${field}를 입력해 주세요.`);
  return value;
};
const enumValue = (v, values, field, fallback) => {
  const value = v == null ? fallback : String(v);
  if (!values.includes(value)) throw catalogError(`${field} 값이 올바르지 않습니다.`);
  return value;
};
const safeTags = (v, field) => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 20 || v.some(x => typeof x !== 'string')) throw catalogError(`${field}는 최대 20개의 태그로 입력해 주세요.`);
  const tags = [...new Set(v.map(x => x.normalize('NFKC').trim()).filter(Boolean))];
  if (tags.some(x => x.length > 30)) throw catalogError(`${field} 태그는 30자 이내여야 합니다.`);
  return tags;
};
export function catalogFields(input) {
  return {
    title: bounded(input.title, 180, '작품명', true),
    author: bounded(input.author, 120, '작가'),
    original_title: bounded(input.original_title, 180, '원제'),
    country: bounded(input.country, 50, '국가'),
    completion: enumValue(input.completion, ['unknown','ongoing','completed','incomplete','hiatus','auto','manual_unknown'], '연재 상태', 'unknown'),
    genre_json: JSON.stringify(safeTags(input.genres, '장르')),
    tags_json: JSON.stringify(safeTags(input.tags, '키워드')),
    synopsis: bounded(input.synopsis, 3000, '줄거리'),
    subcouple: enumValue(input.subcouple, ['unknown','yes','no'], '서브커플', 'unknown'),
    subcouple_note: bounded(input.subcouple_note, 700, '서브커플 설명'),
    recommendation: bounded(input.recommendation, 1500, '추천 대상'),
    warnings: bounded(input.warnings, 1000, '주의 요소'),
  };
}
export function publicCatalogWork(row) {
  if (!row) return null;
  const { id,title,author,original_title,country,completion,genre_json,tags_json,synopsis,subcouple,subcouple_note,recommendation,warnings,updated_at,revision } = row;
  return { id,title,author,original_title,country,completion:completion==='auto'||completion==='manual_unknown'?'unknown':completion,
    completion_mode:completion==='auto'||completion==='unknown'?'auto':'manual',
    genres: JSON.parse(genre_json || '[]'),tags: JSON.parse(tags_json || '[]'),
    synopsis,subcouple,subcouple_note,recommendation,warnings,updated_at,revision: Number(revision || 1) };
}
export function allCatalogWork(row) { return { ...publicCatalogWork(row),status: row.status,created_at: row.created_at }; }
export function fieldsParams(f) {
  return [f.title,f.author,f.original_title,f.country,f.completion,f.genre_json,f.tags_json,f.synopsis,f.subcouple,f.subcouple_note,f.recommendation,f.warnings];
}
export const WORK_FIELDS = 'title,author,original_title,country,completion,genre_json,tags_json,synopsis,subcouple,subcouple_note,recommendation,warnings';


// v10.54: field-scoped proposal contract. Existing v1 whole-work payloads remain readable.
const OPERATION_FIELDS = Object.freeze({
  tag_add: 'tags_json', tag_remove: 'tags_json', tag_edit: 'tags_json',
  genre_add: 'genre_json', genre_remove: 'genre_json', genre_edit: 'genre_json',
  title_set: 'title', author_set: 'author', original_title_set: 'original_title',
  completion_set: 'completion', subcouple_set: 'subcouple',
  subcouple_note_set: 'subcouple_note', synopsis_set: 'synopsis',
  warnings_set: 'warnings', recommendation_add: 'recommendation',
  recommendation_remove: 'recommendation', recommendation_edit: 'recommendation'
});
export const CATALOG_OPERATIONS = Object.keys(OPERATION_FIELDS);
const asLines = text => String(text || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
const asWorkInput = row => ({
  title:row.title, author:row.author, original_title:row.original_title,
  country:row.country, completion:row.completion,
  genres:JSON.parse(row.genre_json || '[]'),tags:JSON.parse(row.tags_json || '[]'),
  synopsis:row.synopsis, subcouple:row.subcouple,subcouple_note:row.subcouple_note,
  recommendation:row.recommendation,warnings:row.warnings
});
export function catalogOperation(row, operation, change) {
  const column = OPERATION_FIELDS[operation];
  if (!column) throw catalogError('지원하지 않는 정보 제안 항목입니다.');
  if (!change || Array.isArray(change) || typeof change !== 'object') throw catalogError('변경 정보가 올바르지 않습니다.');
  const obj = asWorkInput(row);
  const item = bounded(change.value, ['synopsis_set'].includes(operation) ? 3000 : 1500, '제안 값');
  let before;
  if (operation.startsWith('tag_') || operation.startsWith('genre_')) {
    const type=operation.startsWith('tag_')?'tags':'genres';
    const token=item.normalize('NFKC').replace(/^#+\s*/, '').trim();
    if (!token || token.length>30) throw catalogError('키워드는 1~30자 이내여야 합니다.');
    const current=obj[type];
    before=[...current];
    const oldToken=operation.endsWith('_edit')
      ? bounded(change.old, 30, '수정할 기존 항목', true).normalize('NFKC').replace(/^#+\s*/, '').trim()
      : token;
    const idx=current.findIndex(x=>x.normalize('NFKC').toLocaleLowerCase()===oldToken.toLocaleLowerCase());
    if (operation.endsWith('_add')) {
      if (idx>=0) throw catalogError('이미 등록된 키워드입니다.',409);
      current.push(token);
    } else if (operation.endsWith('_edit')) {
      if (idx<0) throw catalogError('수정할 기존 항목이 변경되었습니다.',409);
      if (current.some((x,i)=>i!==idx && x.normalize('NFKC').toLocaleLowerCase()===token.toLocaleLowerCase()))
        throw catalogError('같은 장르·키워드가 이미 등록되어 있어요.',409);
      current[idx]=token;
    } else {
      if (idx<0) throw catalogError('삭제할 키워드가 없습니다.',409);
      current.splice(idx,1);
    }
  } else if (operation.startsWith('recommendation_')) {
    const lines=asLines(obj.recommendation);
    before=obj.recommendation;
    if (operation==='recommendation_add') {
      if (!item) throw catalogError('추천 내용을 입력해 주세요.');
      if (lines.includes(item)) throw catalogError('같은 추천 문구가 있습니다.',409);
      lines.push(item);
    } else {
      const old=bounded(change.old,1500,'기존 추천');
      const idx=lines.indexOf(old);
      if (idx<0) throw catalogError('수정할 추천 문구가 변경되었습니다.',409);
      if (operation==='recommendation_remove') lines.splice(idx,1);
      else {
        if (!item) throw catalogError('새 추천 내용을 입력해 주세요.');
        if (lines.some((line,i)=>i!==idx&&line===item)) throw catalogError('같은 추천 문구가 이미 등록되어 있어요.',409);
        lines[idx]=item;
      }
    }
    obj.recommendation=lines.join('\n\n');
  } else {
    const prop=column;
    before=obj[prop];
    obj[prop]=item;
  }
  const fields=catalogFields(obj);
  const after=fields[column];
  if (JSON.stringify(after)===JSON.stringify(row[column])) throw catalogError('기존 정보와 변경 내용이 같습니다.',409);
  return { column, before, after, normalized: operation.endsWith('_add') || operation.endsWith('_remove') ? item : item };
}
export async function catalogFingerprint(payload) {
  const serialized=JSON.stringify(payload);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
