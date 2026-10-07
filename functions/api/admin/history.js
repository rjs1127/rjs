import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const GITHUB_OWNER = "rjs1127";
const GITHUB_REPO = "rjs";
const GITHUB_BRANCH = "main";

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rjs-archive-admin",
  };
}

async function fetchCommitDays(token) {
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?sha=${encodeURIComponent(GITHUB_BRANCH)}&per_page=100&page=${page}`,
      { headers: githubHeaders(token) }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || `GitHub commit history 조회 오류 (${response.status})`);
    }
    const pageRows = await response.json();
    if (!Array.isArray(pageRows)) throw new Error("GitHub commit history 응답 형식이 올바르지 않습니다.");
    if (!pageRows.length) break;
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }

  const commits = rows.map(row => ({ sha: row.sha, date: row?.commit?.committer?.date || row?.commit?.author?.date, message: String(row?.commit?.message || '').split('\n')[0] }));
  const grouped = new Map();
  for (const row of rows) {
    const rawDate = row?.commit?.committer?.date || row?.commit?.author?.date || "";
    if (!rawDate) continue;
    const shifted = new Date(new Date(rawDate).getTime() + (9 * 60 * 60 * 1000)).toISOString();
    const date = shifted.slice(0, 10);
    const time = shifted.slice(11, 16);
    const message = String(row?.commit?.message || "변경사항 기록").split("\n")[0].replace(/\s+/g, " ").trim();
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push({ time, message });
  }

  const days = [...grouped.entries()]
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const datesAsc = days.map((day) => day.date).sort();
  return {
    days,
    commits,
    truncated: rows.length === 2000,
    summary: {
      firstDate: datesAsc[0] || "",
      lastDate: datesAsc[datesAsc.length - 1] || "",
      commitCount: rows.length,
      activeDays: days.length,
    },
  };
}

// Cache successful reads per isolate; never bypass authentication or cache failures.
const HISTORY_CACHE_MS = 5 * 60 * 1000;
let historyCache = null;
let historyInFlight = null;

export async function getCommitHistory(token) {
  if (historyCache?.token === token && historyCache.expiresAt > Date.now()) {
    return historyCache.data;
  }
  if (historyInFlight?.token === token) return historyInFlight.promise;

  const pending = { token };
  pending.promise = fetchCommitDays(token).then((history) => {
    const data = {
      ok: true,
      ...history,
      source: "github-main",
      updatedAt: new Date().toISOString(),
    };
    historyCache = { token, data, expiresAt: Date.now() + HISTORY_CACHE_MS };
    return data;
  }).finally(() => {
    if (historyInFlight === pending) historyInFlight = null;
  });
  historyInFlight = pending;
  return pending.promise;
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const token = context.env.GITHUB_TOKEN;
    if (!token) throw new Error("Cloudflare Secret 'GITHUB_TOKEN'이 설정되지 않았습니다.");

    const { commits, ...data } = await getCommitHistory(token);
    return jsonResponse(data, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "프로젝트 히스토리를 불러오지 못했습니다." },
      error?.status && error.status >= 400 && error.status < 600 ? error.status : 500
    );
  }
}
