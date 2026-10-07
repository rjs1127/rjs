import { checkLoginRequest, recordLoginFailure, recordLoginSuccess } from '../../_abuse_guard.js';
import { jsonResponse } from "../../_shared.js";
import {
  createAdminSessionToken,
  buildAdminCookie,
  buildClearAdminCookie,
} from "../../_admin_session.js";

export async function onRequestPost(context) {
  try {
    const configured = context.env.ADMIN_PASSWORD;

    if (!configured) {
      return jsonResponse(
        { error: "Cloudflare Secret 'ADMIN_PASSWORD'가 설정되지 않았습니다." },
        503
      );
    }

    const rejected = checkLoginRequest(context.request, true);
    if (rejected) return rejected;
    const body = await context.request.json();
    const supplied = String(body?.password || "");

    if (!supplied || supplied !== configured) {
      recordLoginFailure(context.request, "", true);
      return jsonResponse(
        { error: "관리자 비밀번호가 올바르지 않습니다." },
        401,
        { "cache-control": "no-store" }
      );
    }

    const token = await createAdminSessionToken(context.env);
    recordLoginSuccess(context.request, "", true);

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "set-cookie": buildAdminCookie(token),
        },
      }
    );
  } catch (error) {
    if (error instanceof SyntaxError) recordLoginFailure(context.request, "", true);
    console.error(error);
    return jsonResponse(
      { error: error?.message || "관리자 로그인에 실패했습니다." },
      error?.status || 500,
      { "cache-control": "no-store" }
    );
  }
}

export async function onRequestDelete() {
  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "set-cookie": buildClearAdminCookie(),
      },
    }
  );
}
