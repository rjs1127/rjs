import {
  jsonResponse,
  requireAdmin,
} from "../../_shared.js";

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

  if (!(normalized.startsWith("public/") || normalized.startsWith("functions/"))) {
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

export async function onRequestPost(context) {
  try {
    requireAdmin(context);

    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("Cloudflare Secret 'GITHUB_TOKEN'이 설정되지 않았습니다.");
    }

    const body = await context.request.json();
    const commitMessage =
      String(body?.message || "").trim() || "Archive site update";
    const incoming = Array.isArray(body?.files) ? body.files : [];

    if (!incoming.length) {
      return jsonResponse({ error: "배포할 파일이 없습니다." }, 400);
    }

    if (incoming.length > 100) {
      return jsonResponse(
        { error: "한 번에 최대 100개 파일까지 배포할 수 있습니다." },
        400
      );
    }

    const files = [];
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

      // About 6 MB decoded max per file.
      if (contentBase64.length > 8_500_000) {
        blocked.push({ path: check.path, reason: "파일 크기 제한 초과" });
        continue;
      }

      files.push({
        path: check.path,
        contentBase64,
      });
    }

    if (!files.length) {
      return jsonResponse(
        {
          error: "허용된 배포 파일이 없습니다.",
          blocked,
        },
        400
      );
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

    const treeEntries = [];

    for (const file of files) {
      const blob = await gh(
        token,
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
        {
          method: "POST",
          body: JSON.stringify({
            content: file.contentBase64,
            encoding: "base64",
          }),
        }
      );

      treeEntries.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    const newTree = await gh(
      token,
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
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
        body: JSON.stringify({
          sha: newCommit.sha,
          force: false,
        }),
      }
    );

    return jsonResponse({
      ok: true,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      commitSha: newCommit.sha,
      commitUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${newCommit.sha}`,
      deployedFiles: files.map((file) => file.path),
      blocked,
      message:
        "GitHub 커밋이 생성되었습니다. Cloudflare Pages 자동 배포가 곧 시작됩니다.",
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        error: error?.message || "GitHub 배포에 실패했습니다.",
      },
      error?.status && error.status >= 400 && error.status < 600
        ? error.status
        : 500
    );
  }
}
