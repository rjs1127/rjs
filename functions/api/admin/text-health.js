import {
  ARCHIVE_CACHE_KEY,
  jsonResponse,
  requireKv,
  getJson,
  getAccessToken,
  driveFetch,
  decodeTextSmart,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const TEXT_HEALTH_KEY = "archive:text-health:v1";
const MAX_BATCH = 12;

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function encodingInfo(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "UTF-8 BOM";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "UTF-16LE";
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "UTF-16BE";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "UTF-8";
  } catch {
    return "EUC-KR/CP949 추정";
  }
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function findFirstSuspiciousIndex(text) {
  const patterns = [
    /\uFFFD/,
    /□/,
    /\?{2,}/,
    /(?:[가-힣][?□�]|[?□�][가-힣])/,
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/,
    /(?:Ã.|Â.|ì.|ë.|ê.|í.){2,}/,
  ];
  let index = -1;
  for (const pattern of patterns) {
    const found = text.search(pattern);
    if (found >= 0 && (index < 0 || found < index)) index = found;
  }
  return index;
}

function makeSample(text, index) {
  if (!text) return "";
  const target = index >= 0 ? index : 0;
  const start = Math.max(0, target - 90);
  const end = Math.min(text.length, target + 180);
  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function analyzeText(textValue) {
  const text = normalizeText(textValue);
  const length = Math.max(1, text.length);
  const replacementCount = countMatches(text, /\uFFFD/g);
  const squareCount = countMatches(text, /□/g);
  const questionRunCount = countMatches(text, /\?{2,}/g);
  const questionCount = countMatches(text, /\?/g);
  const controlCount = countMatches(text, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
  const latinMojibakeCount = countMatches(text, /(?:Ã.|Â.|ì.|ë.|ê.|í.)/g);
  const koreanCount = countMatches(text, /[가-힣]/g);
  const hanCount = countMatches(text, /[\u3400-\u4DBF\u4E00-\u9FFF]/g);

  let score = 0;
  const reasons = [];

  if (replacementCount > 0) {
    score += 80 + Math.min(20, replacementCount * 2);
    reasons.push(`대체문자(�) ${replacementCount}개`);
  }

  if (controlCount > 0) {
    score += 70 + Math.min(20, controlCount);
    reasons.push(`비정상 제어문자 ${controlCount}개`);
  }

  if (squareCount >= 2) {
    score += squareCount >= 10 ? 45 : 25;
    reasons.push(`빈 사각형(□) ${squareCount}개`);
  }

  const questionRatio = questionCount / length;
  if (questionRunCount >= 2 || (questionCount >= 12 && questionRatio >= 0.003)) {
    score += questionRunCount >= 8 || questionRatio >= 0.01 ? 45 : 25;
    reasons.push(`물음표 깨짐 패턴 ${questionCount}개`);
  }

  if (latinMojibakeCount >= 4) {
    score += latinMojibakeCount >= 12 ? 55 : 35;
    reasons.push(`UTF-8 오해석 의심 문자 ${latinMojibakeCount}개`);
  }

  if (
    koreanCount >= 20 &&
    hanCount >= 10 &&
    (questionRunCount >= 2 || squareCount >= 2 || replacementCount > 0) &&
    hanCount / Math.max(1, koreanCount + hanCount) >= 0.12
  ) {
    score += 20;
    reasons.push("한글 문맥에 비정상 한자 혼입");
  }

  score = Math.min(100, score);
  const status = score >= 60 ? "severe" : score >= 25 ? "suspect" : "normal";
  const firstIndex = findFirstSuspiciousIndex(text);

  return {
    status,
    score,
    reasons,
    sample: status === "normal" ? "" : makeSample(text, firstIndex),
    chars: text.length,
    counts: {
      replacement: replacementCount,
      square: squareCount,
      question: questionCount,
      questionRuns: questionRunCount,
      controls: controlCount,
    },
  };
}

function summarize(archive, records) {
  const items = Array.isArray(archive?.items) ? archive.items : [];
  const validIds = new Set(items.map((item) => String(item.id || "")));
  const itemById = new Map(items.map((item) => [String(item.id || ""), item]));
  const activeRecords = Object.values(records || {}).filter((record) => {
    const item = itemById.get(String(record?.id || ""));
    return item && String(record.modifiedTime || "") === String(item.modifiedTime || "");
  });
  const severe = activeRecords.filter((record) => record.status === "severe").length;
  const suspect = activeRecords.filter((record) => record.status === "suspect").length;
  const normal = activeRecords.filter((record) => record.status === "normal").length;
  const stale = items.filter((item) => {
    const record = records?.[item.id];
    return !record || String(record.modifiedTime || "") !== String(item.modifiedTime || "");
  }).length;

  return {
    total: items.length,
    checked: activeRecords.length,
    normal,
    suspect,
    severe,
    pending: stale,
    lastCheckedAt: activeRecords.reduce((latest, record) => {
      const value = String(record.checkedAt || "");
      return value > latest ? value : latest;
    }, "") || null,
  };
}

function suspiciousItems(archive, records) {
  const byId = new Map((archive?.items || []).map((item) => [String(item.id || ""), item]));
  return Object.values(records || {})
    .filter((record) => record && record.status !== "normal" && byId.has(String(record.id || "")))
    .map((record) => {
      const item = byId.get(String(record.id || "")) || {};
      return {
        id: record.id,
        title: item.title || record.title || "",
        author: item.author || record.author || "",
        fileName: item.fileName || record.fileName || "",
        combination: item.combination || record.combination || "",
        lengthType: item.lengthType || record.lengthType || "",
        modifiedTime: item.modifiedTime || record.modifiedTime || null,
        status: record.status,
        score: Number(record.score || 0),
        reasons: Array.isArray(record.reasons) ? record.reasons : [],
        sample: record.sample || "",
        encoding: record.encoding || "",
        checkedAt: record.checkedAt || null,
      };
    })
    .sort((a, b) => {
      const rank = { severe: 2, suspect: 1 };
      const diff = (rank[b.status] || 0) - (rank[a.status] || 0);
      if (diff) return diff;
      if (b.score !== a.score) return b.score - a.score;
      return String(a.title).localeCompare(String(b.title), "ko");
    });
}


export async function onRequestPatch(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) return jsonResponse({ error: "파일 ID가 없습니다." }, 400);

    const [archive, stored] = await Promise.all([
      getJson(kv, ARCHIVE_CACHE_KEY, null),
      getJson(kv, TEXT_HEALTH_KEY, { records: {} }),
    ]);
    if (!archive) {
      return jsonResponse({ error: "Drive 캐시가 없습니다. 먼저 Drive 다시 읽기를 실행해 주세요." }, 400);
    }

    const item = (Array.isArray(archive.items) ? archive.items : []).find((entry) => String(entry?.id || "") === id);
    if (!item) return jsonResponse({ error: "현재 Drive 목록에서 해당 TXT를 찾을 수 없습니다." }, 404);
    if (body?.modifiedTime && String(body.modifiedTime) !== String(item.modifiedTime || "")) {
      return jsonResponse({ error: "파일이 목록 표시 후 변경되었습니다. 검사 결과를 새로고침해 주세요." }, 409);
    }

    const records = { ...(stored?.records || {}) };
    const existing = records[id];
    if (!existing || String(existing.modifiedTime || "") !== String(item.modifiedTime || "")) {
      return jsonResponse({ error: "파일이 검사 후 변경되었습니다. 다시 검사한 뒤 정상 여부를 확인해 주세요." }, 409);
    }

    const now = new Date().toISOString();
    records[id] = {
      ...existing,
      detectedStatus: existing.detectedStatus || existing.status || "suspect",
      detectedScore: Number(existing.detectedScore ?? existing.score ?? 0),
      detectedReasons: Array.isArray(existing.detectedReasons) ? existing.detectedReasons : (Array.isArray(existing.reasons) ? existing.reasons : []),
      detectedSample: existing.detectedSample ?? existing.sample ?? "",
      status: "normal",
      score: 0,
      reasons: [],
      sample: "",
      manuallyConfirmed: true,
      confirmedAt: now,
      confirmedModifiedTime: item.modifiedTime || null,
    };

    await kv.put(TEXT_HEALTH_KEY, JSON.stringify({ version: 1, records, updatedAt: now }));
    return jsonResponse({
      ok: true,
      summary: summarize(archive, records),
      items: suspiciousItems(archive, records),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "정상 확인 상태를 저장하지 못했습니다." }, error?.status || 500);
  }
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const [archive, stored] = await Promise.all([
      getJson(kv, ARCHIVE_CACHE_KEY, null),
      getJson(kv, TEXT_HEALTH_KEY, { records: {} }),
    ]);

    if (!archive) {
      return jsonResponse({ error: "Drive 캐시가 없습니다. 먼저 Drive 다시 읽기를 실행해 주세요." }, 400);
    }

    const records = stored?.records || {};
    return jsonResponse({
      ok: true,
      summary: summarize(archive, records),
      items: suspiciousItems(archive, records),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "텍스트 건강검사 결과를 불러오지 못했습니다." }, error?.status || 500);
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const kv = requireKv(context.env);
    const body = await context.request.json().catch(() => ({}));
    const force = Boolean(body?.force);
    const requestedLimit = Number(body?.limit || MAX_BATCH);
    const limit = Math.max(1, Math.min(MAX_BATCH, Number.isFinite(requestedLimit) ? requestedLimit : MAX_BATCH));

    const [archive, stored] = await Promise.all([
      getJson(kv, ARCHIVE_CACHE_KEY, null),
      getJson(kv, TEXT_HEALTH_KEY, { records: {} }),
    ]);
    if (!archive) {
      return jsonResponse({ error: "Drive 캐시가 없습니다. 먼저 Drive 다시 읽기를 실행해 주세요." }, 400);
    }

    const records = { ...(stored?.records || {}) };
    const items = Array.isArray(archive.items) ? archive.items : [];
    const validIds = new Set(items.map((item) => String(item.id || "")));
    for (const id of Object.keys(records)) {
      if (!validIds.has(String(id))) delete records[id];
    }

    const queue = items.filter((item) => {
      if (force) return true;
      const record = records[item.id];
      return !record || String(record.modifiedTime || "") !== String(item.modifiedTime || "");
    });
    const batch = queue.slice(0, limit);

    if (!batch.length) {
      const summary = summarize(archive, records);
      return jsonResponse({ ok: true, done: true, processed: 0, remaining: 0, summary, items: suspiciousItems(archive, records) });
    }

    const accessToken = await getAccessToken(context.env);
    const now = new Date().toISOString();

    for (const item of batch) {
      try {
        const cacheKey = `body:${item.id}:${item.modifiedTime || "unknown"}`;
        let text = await kv.get(cacheKey);
        let encoding = "캐시된 UTF-8";

        if (text === null) {
          const response = await driveFetch(
            accessToken,
            `/files/${encodeURIComponent(item.id)}?alt=media&supportsAllDrives=true`
          );
          const buffer = await response.arrayBuffer();
          encoding = encodingInfo(buffer);
          text = decodeTextSmart(buffer);
        }

        const analysis = analyzeText(text);
        records[item.id] = {
          id: item.id,
          title: item.title || "",
          author: item.author || "",
          fileName: item.fileName || "",
          combination: item.combination || "",
          lengthType: item.lengthType || "",
          modifiedTime: item.modifiedTime || null,
          encoding,
          checkedAt: now,
          ...analysis,
        };
      } catch (error) {
        records[item.id] = {
          id: item.id,
          title: item.title || "",
          author: item.author || "",
          fileName: item.fileName || "",
          combination: item.combination || "",
          lengthType: item.lengthType || "",
          modifiedTime: item.modifiedTime || null,
          encoding: "확인 실패",
          checkedAt: now,
          status: "severe",
          score: 100,
          reasons: [`파일 검사 실패: ${error?.message || "알 수 없는 오류"}`],
          sample: "",
          chars: 0,
          counts: {},
        };
      }
    }

    await kv.put(TEXT_HEALTH_KEY, JSON.stringify({ version: 1, records, updatedAt: now }));
    const summary = summarize(archive, records);
    const remaining = force
      ? Math.max(0, queue.length - batch.length)
      : summary.pending;

    return jsonResponse({
      ok: true,
      done: remaining === 0,
      processed: batch.length,
      remaining,
      summary,
      items: suspiciousItems(archive, records),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error?.message || "텍스트 건강검사에 실패했습니다." }, error?.status || 500);
  }
}
