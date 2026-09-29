import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";

const GITHUB_OWNER = "rjs1127";
const GITHUB_REPO = "rjs";
const GITHUB_BRANCH = "main";
const WORKFLOW_PATH = ".github/workflows/archive-auto-sync.yml";

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
    headers: { ...githubHeaders(token), ...(init.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!response.ok) {
    const error = new Error(data?.message || `GitHub API 오류 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function toBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function buildWorkflow(baseUrl) {
  const safeBase = String(baseUrl || "").replace(/\/$/, "");
  return `name: Archive auto sync

on:
  schedule:
    # GitHub cron is UTC. 14:00/14:10 UTC = 23:00/23:10 KST, 15:30 UTC = 00:30 KST.
    - cron: "0 14 * * *"
    - cron: "10 14 * * *"
    - cron: "30 15 * * *"
  workflow_dispatch:
    inputs:
      source:
        description: "Sync source"
        required: true
        default: "postype"
        type: choice
        options:
          - postype
          - drive
          - ops

permissions:
  contents: read

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Select source
        id: source
        shell: bash
        run: |
          if [ "\${{ github.event_name }}" = "workflow_dispatch" ]; then
            source="\${{ github.event.inputs.source }}"
          elif [ "\${{ github.event.schedule }}" = "0 14 * * *" ]; then
            source="postype"
          elif [ "\${{ github.event.schedule }}" = "10 14 * * *" ]; then
            source="drive"
          else
            source="ops"
          fi
          echo "source=$source" >> "$GITHUB_OUTPUT"

      - name: Run automatic sync
        shell: bash
        env:
          BASE_URL: "${safeBase}"
          AUTO_SYNC_TOKEN: "\${{ secrets.ARCHIVE_AUTO_SYNC_TOKEN }}"
          SOURCE: "\${{ steps.source.outputs.source }}"
        run: |
          set -euo pipefail
          if [ -z "$AUTO_SYNC_TOKEN" ]; then
            echo "ARCHIVE_AUTO_SYNC_TOKEN secret is not configured."
            exit 1
          fi

          if [ "$SOURCE" = "drive" ]; then
            curl --fail-with-body --silent --show-error \\
              -X POST "$BASE_URL/api/automation/sync" \\
              -H "content-type: application/json" \\
              -H "x-auto-sync-token: $AUTO_SYNC_TOKEN" \\
              --data '{"source":"drive"}'
            exit 0
          fi

          if [ "$SOURCE" = "ops" ]; then
            curl --fail-with-body --silent --show-error \\
              -X POST "$BASE_URL/api/automation/ops" \\
              -H "content-type: application/json" \\
              -H "x-auto-sync-token: $AUTO_SYNC_TOKEN" \\
              --data '{}'
            exit 0
          fi

          cursor=0
          for attempt in $(seq 1 40); do
            response=$(curl --fail-with-body --silent --show-error \\
              -X POST "$BASE_URL/api/automation/sync" \\
              -H "content-type: application/json" \\
              -H "x-auto-sync-token: $AUTO_SYNC_TOKEN" \\
              --data "{\\"source\\":\\"postype\\",\\"cursor\\":$cursor}")
            echo "$response"
            done_flag=$(printf '%s' "$response" | jq -r '.done // false')
            if [ "$done_flag" = "true" ]; then
              exit 0
            fi
            next_cursor=$(printf '%s' "$response" | jq -r '.nextCursor // empty')
            if [ -z "$next_cursor" ]; then
              echo "POSTYPE sync did not return nextCursor."
              exit 1
            fi
            cursor="$next_cursor"
            sleep 1
          done

          echo "POSTYPE auto sync exceeded batch safety limit."
          exit 1
`;
}

async function getWorkflowFile(token) {
  try {
    return await gh(
      token,
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${WORKFLOW_PATH}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
    );
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      return jsonResponse({
        ok: true,
        installed: false,
        canInstall: false,
        tokenConfigured: Boolean(context.env.AUTO_SYNC_TOKEN),
        error: "GITHUB_TOKEN이 설정되지 않았습니다.",
      }, 200, { "cache-control": "no-store" });
    }
    const file = await getWorkflowFile(token);
    return jsonResponse({
      ok: true,
      installed: Boolean(file?.sha),
      canInstall: true,
      tokenConfigured: Boolean(context.env.AUTO_SYNC_TOKEN),
      workflowPath: WORKFLOW_PATH,
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || "예약 설정 확인 실패" }, error?.status || 500);
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      return jsonResponse({ ok: false, error: "GITHUB_TOKEN이 설정되지 않았습니다." }, 503);
    }

    const existing = await getWorkflowFile(token);
    const workflow = buildWorkflow(new URL(context.request.url).origin);
    const payload = {
      message: "v8.91: add operations automation schedule",
      content: toBase64Utf8(workflow),
      branch: GITHUB_BRANCH,
    };
    if (existing?.sha) payload.sha = existing.sha;

    const result = await gh(
      token,
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${WORKFLOW_PATH}`,
      { method: "PUT", body: JSON.stringify(payload) }
    );

    return jsonResponse({
      ok: true,
      installed: true,
      workflowPath: WORKFLOW_PATH,
      commitSha: result?.commit?.sha || "",
      tokenConfigured: Boolean(context.env.AUTO_SYNC_TOKEN),
      needsGithubSecret: true,
      githubSecretName: "ARCHIVE_AUTO_SYNC_TOKEN",
      cloudflareSecretName: "AUTO_SYNC_TOKEN",
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { ok: false, error: error?.message || "자동동기화 예약 파일 설치에 실패했습니다." },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}
