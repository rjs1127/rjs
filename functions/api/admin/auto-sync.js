import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";
import {
  getAutoSyncStatus,
  runDriveAutoSync,
  runPostypeAutoSyncBatch,
  autoSyncErrorResponse,
} from "../../_auto_sync.js";

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    const data = await getAutoSyncStatus(context.env);
    return jsonResponse({ ok: true, ...data }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error(error);
    return autoSyncErrorResponse(error);
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const body = await context.request.json().catch(() => ({}));
    const source = String(body?.source || "").toLowerCase();

    if (source === "drive") {
      const data = await runDriveAutoSync(context.env, "manual");
      return jsonResponse(data, 200, { "cache-control": "no-store" });
    }

    if (source === "postype") {
      const data = await runPostypeAutoSyncBatch(context.env, {
        cursor: Number(body?.cursor || 0),
        trigger: "manual",
      });
      return jsonResponse(data, 200, { "cache-control": "no-store" });
    }

    return jsonResponse({ ok: false, error: "source는 postype 또는 drive여야 합니다." }, 400);
  } catch (error) {
    console.error(error);
    return autoSyncErrorResponse(error);
  }
}
