import {
  DRIVE_ROOT_FOLDER_ID,
  FOLDER_MIME,
  jsonResponse,
  getAccessToken,
  listFolder,
  parseFileName,
} from "../_shared.js";

export async function onRequestGet(context) {
  try {
    const accessToken = await getAccessToken(context.env);
    const items = [];
    const combinations = [];

    const combinationFolders = await listFolder(
      accessToken,
      DRIVE_ROOT_FOLDER_ID
    );

    for (const combinationFolder of combinationFolders) {
      if (combinationFolder.mimeType !== FOLDER_MIME) continue;

      const combination = combinationFolder.name;
      combinations.push(combination);

      const lengthFolders = await listFolder(
        accessToken,
        combinationFolder.id
      );

      for (const lengthFolder of lengthFolders) {
        if (lengthFolder.mimeType !== FOLDER_MIME) continue;
        if (!["단편", "장편"].includes(lengthFolder.name)) continue;

        const files = await listFolder(accessToken, lengthFolder.id);

        for (const file of files) {
          if (file.mimeType === FOLDER_MIME) continue;
          if (!file.name?.toLowerCase().endsWith(".txt")) continue;

          const parsed = parseFileName(file.name, combination);

          items.push({
            id: file.id,
            combination,
            lengthType: lengthFolder.name,
            title: parsed.title,
            author: parsed.author,
            fileName: file.name,
            parseFailed: parsed.parseFailed,
            modifiedTime: file.modifiedTime || null,
            size: file.size ? Number(file.size) : null,
          });
        }
      }
    }

    items.sort((a, b) => {
      const aTime = a.modifiedTime ? Date.parse(a.modifiedTime) : 0;
      const bTime = b.modifiedTime ? Date.parse(b.modifiedTime) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.title.localeCompare(b.title, "ko");
    });

    combinations.sort((a, b) => a.localeCompare(b, "ko"));

    return jsonResponse(
      {
        rootFolderId: DRIVE_ROOT_FOLDER_ID,
        combinations,
        count: items.length,
        items,
      },
      200,
      {
        "cache-control": "public, max-age=60, s-maxage=60",
      }
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        error:
          error?.message ||
          "Google Drive에서 콘텐츠 목록을 불러오지 못했습니다.",
      },
      500,
      {
        "cache-control": "no-store",
      }
    );
  }
}
