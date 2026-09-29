import {
  autoSyncErrorResponse,
  runDriveAutoSync,
  runPostypeAutoSyncBatch,
} from "../../_auto_sync.js";
import { jsonResponse } from "../../_shared.js";

function safeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ""));
  const b = new TextEncoder().encode(String(right || ""));
  if (a.length !== b.length || !a.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

function requireAutomationToken(context) {
  const configured = String(context.env.AUTO_SYNC_TOKEN || "").trim();
  if (!configured) {
    const error = new Error("AUTO_SYNC_TOKEN이 설정되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  const supplied = context.request.headers.get("x-auto-sync-token") || "";
  if (!safeEqual(configured, supplied)) {
    const error = new Error("자동 동기화 인증에 실패했습니다.");
    error.status = 401;
    throw error;
  }
}

export async function onRequestPost(context) {
  try {
    requireAutomationToken(context);
    const body = await context.request.json().catch(() => ({}));
    const source = String(body?.source || "").toLowerCase();

    if (source === "drive") {
      const data = await runDriveAutoSync(context.env, "schedule");
      return jsonResponse(data, 200, { "cache-control": "no-store" });
    }

    if (source === "postype") {
      const data = await runPostypeAutoSyncBatch(context.env, {
        cursor: Number(body?.cursor || 0),
        trigger: "schedule",
      });
      return jsonResponse(data, 200, { "cache-control": "no-store" });
    }

    return jsonResponse({ ok: false, error: "source는 postype 또는 drive여야 합니다." }, 400);
  } catch (error) {
    console.error(error);
    return autoSyncErrorResponse(error);
  }
}
