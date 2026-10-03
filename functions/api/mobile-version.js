import { jsonResponse } from "../_shared.js";

export async function onRequestGet() {
  return jsonResponse(
    {"enabled":true,"version":"1.3","build":4,"message":"앱 업데이트 설치 방식을 개선했어요.","downloadUrl":"https://rjs-cj6.pages.dev/downloads/syungbook-v1.3.apk"},
    200,
    {
      "cache-control": "no-store"
    }
  );
}