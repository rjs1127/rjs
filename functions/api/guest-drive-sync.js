// Delegated, Drive-only manual sync. No admin session or automation token is exposed.
import { jsonResponse, requireKv, getJson } from "../_shared.js";
import { runDriveAutoSync, AUTO_SYNC_STATUS_KEYS } from "../_auto_sync.js";
import {
  checkGuestDriveSyncRequest,
  recordGuestDriveSyncFailure,
} from "../_abuse_guard.js";

const RUNNING_STALE_MS = 15 * 60 * 1000;
const GUEST_COOLDOWN_MS = 5 * 60 * 1000;
let runningHere = false;

function result(data, status = 200, headers = {}) {
  return jsonResponse(data, status, {
    "cache-control": "no-store, private",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...headers,
  });
}

async function codesMatch(configured, supplied) {
  const encoder = new TextEncoder();
  const [expected, entered] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(configured)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(expected);
  const b = new Uint8Array(entered);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

function recentTime(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) && time > 0 ? time : 0;
}

export async function onRequestPost(context) {
  const request = context.request;
  try {
    // Same-origin requests only. No cross-site HTML form/opaque body allowed.
    const origin = new URL(request.url).origin;
    const sourceOrigin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if ((sourceOrigin && sourceOrigin !== origin) || (fetchSite && !["same-origin", "none"].includes(fetchSite))) {
      return result({ ok: false, error: "접속한 사이트에서만 동기화할 수 있습니다." }, 403);
    }
    if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") || "") ||
        Number(request.headers.get("content-length") || 0) > 256) {
      return result({ ok: false, error: "요청 형식이 올바르지 않습니다." }, 415);
    }

    const configured = String(context.env.DRIVE_GUEST_SYNC_PIN || "").trim();
    if (!configured) {
      return result({ ok: false, error: "동기화 암호가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요." }, 503);
    }

    const limited = checkGuestDriveSyncRequest(request);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const supplied = typeof body?.code === "string" && body.code.length <= 64 ? body.code.trim() : "";
    if (!supplied || !(await codesMatch(configured, supplied))) {
      recordGuestDriveSyncFailure(request);
      return result({ ok: false, error: "암호가 올바르지 않습니다." }, 401);
    }

    if (runningHere) return result({ ok: false, error: "이미 동기화 중입니다. 잠시 후 다시 확인해 주세요." }, 409);
    runningHere = true;
    try {
      const kv = requireKv(context.env);
      const status = await getJson(kv, AUTO_SYNC_STATUS_KEYS.drive, null);
      const now = Date.now();
      const runningAt = recentTime(status?.startedAt || status?.checkedAt);
      if (status?.state === "running" && runningAt && now - runningAt < RUNNING_STALE_MS) {
        return result({ ok: false, error: "다른 동기화가 진행 중입니다. 완료 후 다시 시도해 주세요." }, 409);
      }
      const finishedAt = recentTime(status?.finishedAt);
      if (status?.trigger === "guest" && finishedAt && now - finishedAt < GUEST_COOLDOWN_MS) {
        const seconds = Math.max(1, Math.ceil((GUEST_COOLDOWN_MS - (now - finishedAt)) / 1000));
        return result({ ok: false, error: "방금 동기화했어요. 잠시 후 다시 시도해 주세요.", retryAfter: seconds }, 429, { "retry-after": String(seconds) });
      }

      // The existing auto/manual safety rails remain active. No override flags are accepted.
      const data = await runDriveAutoSync(context.env, "guest");
      return result({
        ok: true,
        blocked: Boolean(data.blocked),
        changed: Boolean(data.changed),
        warning: String(data.warning || data.cachePurgeWarning || ""),
        addedCount: Number(data.addedCount || 0),
        updatedCount: Number(data.updatedCount || 0),
        removedCount: Number(data.removedCount || 0),
        count: Number(data.count || 0),
        checkedAt: data.checkedAt || new Date().toISOString(),
      });
    } finally {
      runningHere = false;
    }
  } catch (error) {
    console.error("Guest Drive sync failed:", error?.name || "Error");
    return result({ ok: false, error: "Drive 동기화 중 오류가 발생했습니다. 관리자에게 알려 주세요." }, 500);
  }
}
