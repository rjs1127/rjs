import { jsonResponse } from "../../_shared.js";
import { runOpsAutomation } from "../../_ops_automation.js";

function verifyToken(context) {
  const configured = context.env.AUTO_SYNC_TOKEN;
  if (!configured) {
    const error = new Error("AUTO_SYNC_TOKEN이 설정되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  if ((context.request.headers.get("x-auto-sync-token") || "") !== configured) {
    const error = new Error("자동화 토큰이 올바르지 않습니다.");
    error.status = 401;
    throw error;
  }
}

export async function onRequestPost(context) {
  try {
    verifyToken(context);
    const data = await runOpsAutomation(context.env, "schedule");
    return jsonResponse({ ok: true, ...data }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || "운영 자동 점검에 실패했습니다." }, error?.status || 500);
  }
}
