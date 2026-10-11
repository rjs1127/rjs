// Bounded pages; per-list keyset cursors survive deletion of earlier rows.
const USER_PAGE_SIZE = 500;
export const USER_PAGE_ORDER = {
  items: ["COALESCE(viewed_at, updated_at)", "file_id", "ASC", r => [r.viewed_at ?? r.updated_at, r.file_id]],
  likes: ["liked_at", "work_id", "ASC", r => [r.liked_at, r.work_id]],
  quotes: ["q.created_at", "q.id", "DESC", r => [r.created_at, r.id]],
  notes: ["created_at", "id", "DESC", r => [r.created_at, r.id]],
};
export function userPageOffset(request) {
  const raw = new URL(request.url).searchParams.get("offset") || "0";
  const offset = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(offset)) {
    const error = new Error("조회 위치가 올바르지 않습니다."); error.status = 400; throw error;
  }
  return offset;
}
export function userPageCursor(request) {
  const raw = new URL(request.url).searchParams.get("cursor");
  if (raw == null) return null;
  try {
    if (raw.length > 4000) throw new Error();
    const cursor = JSON.parse(raw);
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new Error();
    for (const [key, value] of Object.entries(cursor)) {
      if (!USER_PAGE_ORDER[key] || (value !== null && (!Array.isArray(value) || value.length !== 2 ||
          !Number.isSafeInteger(value[0]) || value[0] < 0 ||
          (key === "items" || key === "likes" ? typeof value[1] !== "string" || !value[1] || value[1].length > 300 : !Number.isSafeInteger(value[1]) || value[1] < 1)))) throw new Error();
    }
    return cursor;
  } catch {
    const error = new Error("조회 위치가 올바르지 않습니다."); error.status = 400; throw error;
  }
}
export function userPageQuery(key, cursor) {
  if (cursor == null) return { where: "", values: [] };
  const value = cursor[key];
  if (value == null) return { where: " AND 0", values: [] };
  const [time, id, direction] = USER_PAGE_ORDER[key];
  return { where: ` AND (${time} < ? OR (${time} = ? AND ${id} ${direction === "ASC" ? ">" : "<"} ?))`, values: [value[0], value[0], value[1]] };
}
export function userPage(lists, offset = 0) {
  const more = Object.values(lists).some(rows => rows.length > USER_PAGE_SIZE);
  const nextCursor = Object.fromEntries(Object.entries(lists).map(([key, rows]) => [key,
    rows.length > USER_PAGE_SIZE ? USER_PAGE_ORDER[key][3](rows[USER_PAGE_SIZE - 1]) : null]));
  return { ...Object.fromEntries(Object.entries(lists).map(([key, rows]) => [key, rows.slice(0, USER_PAGE_SIZE)])),
    pagination: { nextOffset: more ? offset + USER_PAGE_SIZE : null, nextCursor: more ? nextCursor : null } };
}
