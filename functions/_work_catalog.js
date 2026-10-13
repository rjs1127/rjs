// v10.51 Works encyclopedia: isolated D1 schema. Existing user/library/quote tables untouched.
const MAX_BODY = 18000;
let schemaPromise;
export async function ensureWorkCatalogSchema(db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_works (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '', original_title TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '', completion TEXT NOT NULL DEFAULT 'unknown',
      genre_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]',
      synopsis TEXT NOT NULL DEFAULT '', subcouple TEXT NOT NULL DEFAULT 'unknown',
      subcouple_note TEXT NOT NULL DEFAULT '', recommendation TEXT NOT NULL DEFAULT '', warnings TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
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
      admin_note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, reviewed_at INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_proposals_queue ON catalog_proposals(status,created_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_proposals_user ON catalog_proposals(user_id,created_at DESC)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, work_id TEXT, action TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
    )`),
  ]).catch(error => { schemaPromise = null; throw error; });
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
    completion: enumValue(input.completion, ['unknown','ongoing','completed','hiatus'], '연재 상태', 'unknown'),
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
  const { id,title,author,original_title,country,completion,genre_json,tags_json,synopsis,subcouple,subcouple_note,recommendation,warnings,updated_at } = row;
  return { id,title,author,original_title,country,completion,
    genres: JSON.parse(genre_json || '[]'),tags: JSON.parse(tags_json || '[]'),
    synopsis,subcouple,subcouple_note,recommendation,warnings,updated_at };
}
export function allCatalogWork(row) { return { ...publicCatalogWork(row),status: row.status,created_at: row.created_at }; }
export function fieldsParams(f) {
  return [f.title,f.author,f.original_title,f.country,f.completion,f.genre_json,f.tags_json,f.synopsis,f.subcouple,f.subcouple_note,f.recommendation,f.warnings];
}
export const WORK_FIELDS = 'title,author,original_title,country,completion,genre_json,tags_json,synopsis,subcouple,subcouple_note,recommendation,warnings';
