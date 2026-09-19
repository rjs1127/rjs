import {
  jsonResponse,
  getAccessToken,
  driveFetch,
  verifyFileInsideArchive,
} from "../_shared.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const fileId = url.searchParams.get("id");

  if (!fileId) {
    return jsonResponse({ error: "파일 ID가 없습니다." }, 400);
  }

  try {
    const accessToken = await getAccessToken(context.env);
    const verified = await verifyFileInsideArchive(accessToken, fileId);

    const response = await driveFetch(
      accessToken,
      `/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
    );

    const content = await response.text();

    return jsonResponse(
      {
        id: verified.file.id,
        fileName: verified.file.name,
        combination: verified.combination,
        lengthType: verified.lengthType,
        content,
      },
      200,
      {
        "cache-control": "private, max-age=60",
      }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        error: error?.message || "본문을 불러오지 못했습니다.",
      },
      500,
      {
        "cache-control": "no-store",
      }
    );
  }
}
