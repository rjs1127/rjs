export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export function kstDateKey(timestamp) {
  return new Date(Number(timestamp) + KST_OFFSET_MS).toISOString().slice(0, 10);
}
export function adminPeriod(value, cutoff = Date.now(), first = cutoff) {
  const days = value === 'all' ? 'all' : Number(value || 14);
  if (days !== 'all' && ![14, 30, 90].includes(days)) throw Object.assign(new Error('기간은 14·30·90일 또는 전체만 선택할 수 있습니다.'), { status: 400 });
  const today = Math.floor((cutoff + KST_OFFSET_MS) / 86400000) * 86400000 - KST_OFFSET_MS;
  const from = days === 'all' ? Math.floor((Math.min(first || cutoff, cutoff) + KST_OFFSET_MS) / 86400000) * 86400000 - KST_OFFSET_MS : today - (days - 1) * 86400000;
  const count = Math.round((today - from) / 86400000) + 1;
  if (count > 36600) throw Object.assign(new Error('조회 기간이 지원 범위를 넘습니다.'), { status: 413 });
  return { days, from, cutoff, fromDate: kstDateKey(from), toDate: kstDateKey(cutoff), dateKeys: Array.from({ length: count }, (_, i) => ({ key: kstDateKey(from + i * 86400000), start: from + i * 86400000 })) };
}
