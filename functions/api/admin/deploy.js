import {
  jsonResponse,
} from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const GITHUB_OWNER = "rjs1127";
const GITHUB_REPO = "rjs";
const GITHUB_BRANCH = "main";

const PROTECTED_EXACT = new Set([
  "wrangler.toml",
  ".gitignore",
  ".env",
  ".dev.vars",
]);

const PROTECTED_PREFIXES = [
  ".git/",
  "node_modules/",
  "credentials/",
  "secrets/",
];

function isAllowedPath(path) {
  const normalized = String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^google-drive-archive-site[^/]*\//, "");

  if (!normalized || normalized.endsWith("/")) return { allowed: false, path: normalized };
  if (normalized.includes("..")) return { allowed: false, path: normalized };

  if (PROTECTED_EXACT.has(normalized)) {
    return { allowed: false, path: normalized, reason: "보호된 설정 파일" };
  }

  if (PROTECTED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return { allowed: false, path: normalized, reason: "보호된 경로" };
  }

  if (
    /(^|\/)(service[-_]?account|credentials|secret|secrets)(\.|\/|$)/i.test(normalized)
  ) {
    return { allowed: false, path: normalized, reason: "민감정보 가능 파일" };
  }

  if (!(normalized.startsWith("public/") || normalized.startsWith("functions/") || normalized === "README.md")) {
    return { allowed: false, path: normalized, reason: "허용된 소스 경로가 아님" };
  }

  return { allowed: true, path: normalized };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rjs-archive-admin",
    "content-type": "application/json",
  };
}

async function gh(token, path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...githubHeaders(token),
      ...(init.headers || {}),
    },
  });

  let data = null;
  const text = await response.text();

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data?.message || `GitHub API 오류 (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

function toBase64FromBytes(bytes) {
  let binary = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}


function decodeBase64Utf8(value) {
  try {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function getLatestReadmeVersionSectionServer(readmeText) {
  const text = String(readmeText || "").replace(/\r\n/g, "\n");
  const headingPattern = /^##\s+(v(\d+)(?:\.(\d+))?(?:\.(\d+))?)(?:\s+.*)?$/gm;
  const matches = [];
  let match;

  while ((match = headingPattern.exec(text))) {
    matches.push({
      version: match[1],
      parts: [
        Number(match[2] || 0),
        Number(match[3] || 0),
        Number(match[4] || 0),
      ],
      index: match.index,
      headingLength: match[0].length,
    });
  }

  if (!matches.length) return { version: "", section: text };

  matches.sort((a, b) => {
    for (let i = 0; i < 3; i += 1) {
      if (a.parts[i] !== b.parts[i]) return b.parts[i] - a.parts[i];
    }
    return b.index - a.index;
  });

  const latest = matches[0];
  const sectionStart = latest.index + latest.headingLength;
  const after = text.slice(sectionStart);
  const nextHeading = after.match(/^##\s+v\d+(?:\.\d+)*(?:\s+.*)?$/m);
  const section = nextHeading ? after.slice(0, nextHeading.index) : after;

  return { version: latest.version, section };
}

function buildCommitMessageFromReadmeServer(readmeText, fileCount = 0) {
  const { version, section } = getLatestReadmeVersionSectionServer(readmeText);

  let summary = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, "")
        .replace(/`/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.!。]+$/g, "")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 2)
    .join(" / ");

  if (summary.length > 78) {
    summary = summary.slice(0, 75).trimEnd() + "…";
  }

  if (version && summary) return `${version}: ${summary}`;
  if (version) return `${version}: Archive site update`;
  if (summary) return `Archive update: ${summary}`;
  return `Archive update (${fileCount} files)`;
}

function normalizeCheckState(check) {
  const status = String(check?.status || "").toLowerCase();
  const conclusion = String(check?.conclusion || "").toLowerCase();

  if (status && status !== "completed") return "building";
  if (["success", "neutral", "skipped"].includes(conclusion)) return "success";
  if (["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"].includes(conclusion)) return "failure";
  return "waiting";
}

function looksLikeCloudflare(value) {
  return /cloudflare|pages/i.test(String(value || ""));
}

function findCloudflareCheck(checkRuns = [], contexts = []) {
  const check = checkRuns.find((item) =>
    looksLikeCloudflare(item?.name) ||
    looksLikeCloudflare(item?.app?.name) ||
    looksLikeCloudflare(item?.details_url)
  );

  if (check) {
    return {
      name: check.name || check.app?.name || "Cloudflare Pages",
      state: normalizeCheckState(check),
      status: check.status || "",
      conclusion: check.conclusion || "",
      detailsUrl: check.details_url || "",
    };
  }

  const context = contexts.find((item) =>
    looksLikeCloudflare(item?.context) ||
    looksLikeCloudflare(item?.description) ||
    looksLikeCloudflare(item?.target_url)
  );

  if (context) {
    const rawState = String(context.state || "").toLowerCase();

    return {
      name: context.context || "Cloudflare Pages",
      state:
        rawState === "success" ? "success" :
        ["failure", "error"].includes(rawState) ? "failure" :
        rawState === "pending" ? "building" :
        "waiting",
      status: rawState,
      conclusion: rawState,
      detailsUrl: context.target_url || "",
    };
  }

  return {
    name: "Cloudflare Pages",
    state: "waiting",
    status: "",
    conclusion: "",
    detailsUrl: "",
  };
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);

    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("Cloudflare Secret 'GITHUB_TOKEN'이 설정되지 않았습니다.");
    }

    const url = new URL(context.request.url);
    const sha = String(url.searchParams.get("sha") || "").trim();

    if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
      return jsonResponse({ error: "확인할 GitHub commit SHA가 올바르지 않습니다." }, 400);
    }

    const [checkData, combinedStatus] = await Promise.all([
      gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`,
        { headers: { Accept: "application/vnd.github+json" } }
      ).catch(() => ({ check_runs: [] })),
      gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${encodeURIComponent(sha)}/status`
      ).catch(() => ({ statuses: [], state: "pending" })),
    ]);

    const checkRuns = Array.isArray(checkData?.check_runs)
      ? checkData.check_runs
      : [];
    const contexts = Array.isArray(combinedStatus?.statuses)
      ? combinedStatus.statuses
      : [];

    const cloudflare = findCloudflareCheck(checkRuns, contexts);

    return jsonResponse(
      {
        ok: true,
        commitSha: sha,
        commitUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${sha}`,
        githubState: combinedStatus?.state || "pending",
        cloudflare,
        checkedAt: new Date().toISOString(),
      },
      200,
      { "cache-control": "no-store" }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      { error: error?.message || "배포 상태를 확인하지 못했습니다." },
      error?.status && error.status >= 400 && error.status < 600
        ? error.status
        : 500
    );
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);

    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("Cloudflare Secret 'GITHUB_TOKEN'이 설정되지 않았습니다.");
    }

    const body = await context.request.json();
    const mode = String(body?.mode || "legacy").trim().toLowerCase();
    let commitMessage = String(body?.message || "").trim();

    // v7.69: Free Workers는 외부 subrequest가 invocation당 50회이므로
    // 파일 blob 생성과 최종 commit을 여러 요청으로 나눠 처리한다.
    if (mode === "blobs") {
      const incoming = Array.isArray(body?.files) ? body.files : [];
      if (!incoming.length) {
        return jsonResponse({ error: "배포할 파일이 없습니다." }, 400);
      }
      if (incoming.length > 35) {
        return jsonResponse({ error: "한 번에 최대 35개 파일 blob을 생성할 수 있습니다." }, 400);
      }

      const entries = [];
      const blocked = [];

      for (const file of incoming) {
        const check = isAllowedPath(file?.path);
        if (!check.allowed) {
          blocked.push({
            path: check.path || String(file?.path || ""),
            reason: check.reason || "허용되지 않은 파일",
          });
          continue;
        }

        const contentBase64 = String(file?.contentBase64 || "");
        if (!contentBase64) {
          blocked.push({ path: check.path, reason: "파일 내용 없음" });
          continue;
        }
        if (contentBase64.length > 8_500_000) {
          blocked.push({ path: check.path, reason: "파일 크기 제한 초과" });
          continue;
        }

        const blob = await gh(
          token,
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
          {
            method: "POST",
            body: JSON.stringify({
              content: contentBase64,
              encoding: "base64",
            }),
          }
        );

        entries.push({
          path: check.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }

      return jsonResponse({ ok: true, entries, blocked });
    }

    if (mode === "commit") {
      const incomingEntries = Array.isArray(body?.entries) ? body.entries : [];
      if (!incomingEntries.length) {
        return jsonResponse({ error: "커밋할 파일 정보가 없습니다." }, 400);
      }
      if (incomingEntries.length > 100) {
        return jsonResponse({ error: "한 번에 최대 100개 파일까지 커밋할 수 있습니다." }, 400);
      }

      const treeEntries = [];
      for (const entry of incomingEntries) {
        const check = isAllowedPath(entry?.path);
        const sha = String(entry?.sha || "").trim();
        if (!check.allowed || !/^[0-9a-f]{40}$/i.test(sha)) {
          return jsonResponse({ error: `올바르지 않은 파일 정보입니다: ${check.path || entry?.path || ""}` }, 400);
        }
        treeEntries.push({
          path: check.path,
          mode: "100644",
          type: "blob",
          sha,
        });
      }

      if (!commitMessage || commitMessage === "Archive site update") {
        commitMessage = `Archive update (${treeEntries.length} files)`;
      }

      const ref = await gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}`
      );
      const parentCommitSha = ref.object.sha;

      const parentCommit = await gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${parentCommitSha}`
      );
      const baseTreeSha = parentCommit.tree.sha;

      const newTree = await gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
        {
          method: "POST",
          body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
        }
      );

      const newCommit = await gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
        {
          method: "POST",
          body: JSON.stringify({
            message: commitMessage,
            tree: newTree.sha,
            parents: [parentCommitSha],
          }),
        }
      );

      await gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${encodeURIComponent(GITHUB_BRANCH)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ sha: newCommit.sha, force: false }),
        }
      );

      return jsonResponse({
        ok: true,
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        branch: GITHUB_BRANCH,
        commitSha: newCommit.sha,
        commitMessage,
        commitUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${newCommit.sha}`,
        deployedFiles: treeEntries.map((entry) => entry.path),
        blocked: [],
        message: "GitHub 커밋이 생성되었습니다. Cloudflare Pages 자동 배포가 곧 시작됩니다.",
      });
    }

    // 구버전 관리자 화면과의 호환용 단일 요청 방식.
    // Free Workers의 50 subrequest 한도를 넘지 않도록 작은 패치만 허용한다.
    const incoming = Array.isArray(body?.files) ? body.files : [];
    if (!incoming.length) {
      return jsonResponse({ error: "배포할 파일이 없습니다." }, 400);
    }
    if (incoming.length > 40) {
      return jsonResponse(
        { error: "파일 수가 많아 단일 요청 배포 한도를 초과합니다. 관리자 화면을 최신 버전으로 갱신한 뒤 다시 시도해주세요." },
        400
      );
    }

    const files = [];
    const blocked = [];
    for (const file of incoming) {
      const check = isAllowedPath(file?.path);
      if (!check.allowed) {
        blocked.push({ path: check.path || String(file?.path || ""), reason: check.reason || "허용되지 않은 파일" });
        continue;
      }
      const contentBase64 = String(file?.contentBase64 || "");
      if (!contentBase64) {
        blocked.push({ path: check.path, reason: "파일 내용 없음" });
        continue;
      }
      if (contentBase64.length > 8_500_000) {
        blocked.push({ path: check.path, reason: "파일 크기 제한 초과" });
        continue;
      }
      files.push({ path: check.path, contentBase64 });
    }

    if (!files.length) {
      return jsonResponse({ error: "허용된 배포 파일이 없습니다.", blocked }, 400);
    }

    const readmeFile = files.find((file) => file.path === "README.md");
    if (!commitMessage || commitMessage === "Archive site update") {
      const readmeText = readmeFile ? decodeBase64Utf8(readmeFile.contentBase64) : "";
      commitMessage = buildCommitMessageFromReadmeServer(readmeText, files.length);
    }

    const ref = await gh(token, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}`);
    const parentCommitSha = ref.object.sha;
    const parentCommit = await gh(token, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${parentCommitSha}`);
    const baseTreeSha = parentCommit.tree.sha;
    const treeEntries = [];

    for (const file of files) {
      const blob = await gh(token, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: file.contentBase64, encoding: "base64" }),
      });
      treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const newTree = await gh(token, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    });
    const newCommit = await gh(token, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: commitMessage, tree: newTree.sha, parents: [parentCommitSha] }),
    });
    await gh(token, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${encodeURIComponent(GITHUB_BRANCH)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });

    return jsonResponse({
      ok: true,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      commitSha: newCommit.sha,
      commitMessage,
      commitUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${newCommit.sha}`,
      deployedFiles: files.map((file) => file.path),
      blocked,
      message: "GitHub 커밋이 생성되었습니다. Cloudflare Pages 자동 배포가 곧 시작됩니다.",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error?.message || "GitHub 배포에 실패했습니다." },
      error?.status && error.status >= 400 && error.status < 600 ? error.status : 500
    );
  }
}
