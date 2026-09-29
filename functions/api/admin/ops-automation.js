import { jsonResponse } from "../../_shared.js";
import { requireAdminSession } from "../../_admin_session.js";
import { getOpsAutomationStatus, runOpsAutomation } from "../../_ops_automation.js";

export async function onRequestGet(context) {
  try {
    await requireAdminSession(context);
    return jsonResponse({ ok: true, ...(await getOpsAutomationStatus(context.env)) }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || "운영 자동화 상태를 불러오지 못했습니다." }, error?.status || 500);
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdminSession(context);
    const status = await runOpsAutomation(context.env, "manual");
    return jsonResponse({ ok: true, status }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || "운영 자동 점검에 실패했습니다." }, error?.status || 500);
  }
}
