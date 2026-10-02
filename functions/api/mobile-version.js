import { jsonResponse } from "../_shared.js";

export async function onRequestGet() {
  return jsonResponse(
    {
      enabled: true,
      version: "1.1",
      build: 2,
      message: "오프라인 저장과 앱 사용성을 개선했어요.",
      downloadUrl: "https://github.com/rjs1127/rjs/releases"
    },
    200,
    {
      "cache-control": "no-store"
    }
  );
}
