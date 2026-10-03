import { jsonResponse } from "../_shared.js";

export async function onRequestGet() {
  return jsonResponse(
    {"enabled":true,"version":"1.2","build":3,"message":"오프라인 저장과 앱 사용성을 개선했어요.","downloadUrl":"https://rjs-cj6.pages.dev/downloads/syungbook-v1.2.apk"},
    200,
    {
      "cache-control": "no-store"
    }
  );
}