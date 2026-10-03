import { jsonResponse } from "../_shared.js";

export async function onRequestGet() {
  return jsonResponse(
    {"enabled":true,"version":"1.4","build":5,"message":"앱 업데이트와 배포 방식을 개선했어요.","downloadUrl":"https://rjs-cj6.pages.dev/downloads/syungbook-v1.4.apk"},
    200,
    { "cache-control": "no-store" }
  );
}
