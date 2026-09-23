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

function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
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
    if (!Array.isArray(pageRows) || !pageRows.length) break;
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }

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
    summary: {
      firstDate: datesAsc[0] || "",
      lastDate: datesAsc[datesAsc.length - 1] || "",
      commitCount: rows.length,
      activeDays: days.length,
    },
  };
}

function parseHistoryMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const days = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const dateMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      current = { date: dateMatch[1], entries: [] };
      days.push(current);
      continue;
    }

    if (!current) continue;
    const entryMatch = line.match(/^-\s+(\d{2}:\d{2})\s+·\s+(.+)$/);
    if (!entryMatch) continue;
    current.entries.push({ time: entryMatch[1], message: entryMatch[2].trim() });
  }

  const sorted = days
    .filter((day) => day.entries.length)
    .sort((a, b) => b.date.localeCompare(a.date));
  const commitCount = sorted.reduce((sum, day) => sum + day.entries.length, 0);
  const datesAsc = sorted.map((day) => day.date).sort();

  return {
    days: sorted,
    summary: {
      firstDate: datesAsc[0] || "",
      lastDate: datesAsc[datesAsc.length - 1] || "",
      commitCount,
      activeDays: sorted.length,
    },
  };
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const token = context.env.GITHUB_TOKEN;
    if (!token) throw new Error("Cloudflare Secret 'GITHUB_TOKEN'이 설정되지 않았습니다.");

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/HISTORY.md?ref=${encodeURIComponent(GITHUB_BRANCH)}`,
      { headers: githubHeaders(token) }
    );

    if (!response.ok) {
      if (response.status === 404) {
        const fallback = await fetchCommitDays(token);
        return jsonResponse({
          ok: true,
          ...fallback,
          source: "github-fallback",
          historyFilePending: true,
          updatedAt: new Date().toISOString(),
        }, 200, { "cache-control": "no-store" });
      }
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || `GitHub HISTORY.md 조회 오류 (${response.status})`);
    }

    const data = await response.json();
    const markdown = decodeBase64Utf8(data?.content || "");
    const parsed = parseHistoryMarkdown(markdown);

    return jsonResponse({
      ok: true,
      ...parsed,
      source: "HISTORY.md",
      updatedAt: new Date().toISOString(),
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "프로젝트 히스토리를 불러오지 못했습니다." },
      error?.status && error.status >= 400 && error.status < 600 ? error.status : 500
    );
  }
}
