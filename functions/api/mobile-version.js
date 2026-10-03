import { jsonResponse } from "../_shared.js";

export async function onRequestGet() {
  return jsonResponse(
    {"enabled":true,"version":"1.5","build":6,"message":"자동 업데이트 기능 테스트 버전입니다.","downloadUrl":"https://rjs-cj6.pages.dev/downloads/syungbook-v1.5.apk"},
    200,
    { "cache-control": "no-store" }
  );
}
