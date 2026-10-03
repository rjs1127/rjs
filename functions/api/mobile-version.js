import { jsonResponse } from "../_shared.js";

export async function onRequestGet() {
  return jsonResponse(
    {"enabled":true,"version":"1.6","build":7,"message":"업데이트 정리","downloadUrl":"https://rjs-cj6.pages.dev/downloads/syungbook-v1.6.apk"},
    200,
    { "cache-control": "no-store" }
  );
}
