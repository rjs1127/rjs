const DRIVE_ROOT_FOLDER_ID = "13F9JJxO2fayYeD9K6-wwjWrVOTQC7-AJ";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const ARCHIVE_CACHE_KEY = "archive:data:v3";
const OVERRIDES_KEY = "archive:overrides:v1";
const SETTINGS_KEY = "archive:settings:v1";

const DEFAULT_SETTINGS = {
  siteName: "RJS BOOK",
  faviconUrl: "",
  eyebrow: "GOOGLE DRIVE ARCHIVE",
  title: "내 콘텐츠를\n한곳에서 찾아보세요."
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function requireKv(env) {
  if (!env.ARCHIVE_KV) {
    throw new Error(
      "Cloudflare KV binding 'ARCHIVE_KV'가 설정되지 않았습니다."
    );
  }
  return env.ARCHIVE_KV;
}

function requireAdmin(context) {
  const configured = context.env.ADMIN_PASSWORD;
  if (!configured) {
    throw new Error("Cloudflare Secret 'ADMIN_PASSWORD'가 설정되지 않았습니다.");
  }

  const supplied = context.request.headers.get("x-admin-password") || "";
  if (supplied !== configured) {
    const error = new Error("관리자 비밀번호가 올바르지 않습니다.");
    error.status = 401;
    throw error;
  }
}

function base64UrlEncode(input) {
  let bytes;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else bytes = new Uint8Array(input);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getServiceAccount(env) {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Cloudflare Secret 'GOOGLE_SERVICE_ACCOUNT_JSON'이 설정되지 않았습니다."
    );
  }

  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON 값이 올바른 JSON이 아닙니다.");
  }

  if (!account.client_email || !account.private_key) {
    throw new Error("서비스 계정 JSON에 client_email 또는 private_key가 없습니다.");
  }

  return account;
}

async function getAccessToken(env) {
  const account = getServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  if (account.private_key_id) header.kid = account.private_key_id;

  const claims = {
    iss: account.client_email,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken =
    `${base64UrlEncode(JSON.stringify(header))}.` +
    `${base64UrlEncode(JSON.stringify(claims))}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const assertion = `${unsignedToken}.${base64UrlEncode(signature)}`;

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(
      tokenData?.error_description ||
      tokenData?.error ||
      "Google OAuth 토큰 발급에 실패했습니다."
    );
  }

  return tokenData.access_token;
}

async function driveFetch(accessToken, path, init = {}) {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Google Drive API 오류 (${response.status})`;
    try {
      const data = await response.json();
      message = data?.error?.message || message;
    } catch {}
    throw new Error(message);
  }

  return response;
}

async function listFolder(accessToken, folderId) {
  const allFiles = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,parents,shortcutDetails(targetId,targetMimeType))",
      pageSize: "1000",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });

    if (pageToken) params.set("pageToken", pageToken);

    const response = await driveFetch(accessToken, `/files?${params.toString()}`);
    const data = await response.json();

    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return allFiles;
}

async function getFileMeta(accessToken, fileId) {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,createdTime,modifiedTime,size,parents,shortcutDetails(targetId,targetMimeType)",
    supportsAllDrives: "true",
  });

  const response = await driveFetch(
    accessToken,
    `/files/${encodeURIComponent(fileId)}?${params.toString()}`
  );

  return response.json();
}

async function verifyFileInsideArchive(accessToken, fileId) {
  const file = await getFileMeta(accessToken, fileId);

  if (!file.name?.toLowerCase().endsWith(".txt")) {
    throw new Error("허용되지 않은 파일 형식입니다.");
  }

  const lengthFolderId = file.parents?.[0];
  if (!lengthFolderId) throw new Error("파일의 상위 폴더를 확인할 수 없습니다.");

  const lengthFolder = await getFileMeta(accessToken, lengthFolderId);

  if (
    lengthFolder.mimeType !== FOLDER_MIME ||
    !["단편", "장편"].includes(lengthFolder.name)
  ) {
    throw new Error("아카이브 구조에 포함되지 않은 파일입니다.");
  }

  const combinationFolderId = lengthFolder.parents?.[0];
  if (!combinationFolderId) throw new Error("인물조합 폴더를 확인할 수 없습니다.");

  const combinationFolder = await getFileMeta(accessToken, combinationFolderId);

  if (combinationFolder.mimeType !== FOLDER_MIME) {
    throw new Error("아카이브 구조가 올바르지 않습니다.");
  }

  if (combinationFolder.parents?.[0] !== DRIVE_ROOT_FOLDER_ID) {
    throw new Error("메인 아카이브 폴더 외부의 파일입니다.");
  }

  return {
    file,
    combination: combinationFolder.name,
    lengthType: lengthFolder.name,
  };
}

function parseFileName(fileName) {
  let base = fileName.replace(/\.txt$/i, "").trim();
  const bracketPrefix = base.match(/^\[([^\]]+)\]\s*/);
  if (bracketPrefix) base = base.slice(bracketPrefix[0].length).trim();

  const splitAt = base.lastIndexOf("_");

  if (splitAt <= 0 || splitAt === base.length - 1) {
    return {
      title: base || "제목 미상",
      author: "작성자 미상",
      parseFailed: true,
    };
  }

  const title = base.slice(0, splitAt).trim() || base;
  const author = base.slice(splitAt + 1).trim();

  return {
    title,
    author: author || "작성자 미상",
    parseFailed: !author,
  };
}

function decodeTextSmart(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {}

  try {
    return new TextDecoder("euc-kr").decode(bytes);
  } catch {}

  return new TextDecoder("utf-8").decode(bytes);
}

async function getJson(kv, key, fallback) {
  const value = await kv.get(key, "json");
  return value ?? fallback;
}

async function buildArchiveFromDrive(env) {
  const accessToken = await getAccessToken(env);
  const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

  function isFolderLike(entry) {
    if (!entry) return false;
    if (entry.mimeType === FOLDER_MIME) return true;

    return (
      entry.mimeType === SHORTCUT_MIME &&
      entry.shortcutDetails?.targetMimeType === FOLDER_MIME &&
      entry.shortcutDetails?.targetId
    );
  }

  function folderTargetId(entry) {
    if (entry.mimeType === SHORTCUT_MIME) {
      return entry.shortcutDetails?.targetId || null;
    }
    return entry.id;
  }

  const rootEntries = await listFolder(accessToken, DRIVE_ROOT_FOLDER_ID);
  const combinationEntries = rootEntries.filter(isFolderLike);

  const diagnostics = [];
  const allItems = [];

  // Each combination is isolated so one inaccessible folder does not abort the whole sync.
  await Promise.all(
    combinationEntries.map(async (combinationEntry) => {
      const combination = combinationEntry.name;
      const combinationId = folderTargetId(combinationEntry);

      const diag = {
        combination,
        sourceType:
          combinationEntry.mimeType === SHORTCUT_MIME ? "바로가기" : "폴더",
        combinationId,
        lengthFolders: [],
        contentCount: 0,
        error: null,
      };

      try {
        if (!combinationId) {
          throw new Error("폴더 대상 ID를 확인할 수 없습니다.");
        }

        const lengthEntries = (await listFolder(accessToken, combinationId))
          .filter(isFolderLike)
          .filter((entry) => ["단편", "장편"].includes(entry.name));

        if (!lengthEntries.length) {
          diag.error = "단편/장편 폴더를 찾지 못했습니다.";
          diagnostics.push(diag);
          return;
        }

        await Promise.all(
          lengthEntries.map(async (lengthEntry) => {
            const lengthType = lengthEntry.name;
            const lengthId = folderTargetId(lengthEntry);

            const lengthDiag = {
              name: lengthType,
              sourceType:
                lengthEntry.mimeType === SHORTCUT_MIME ? "바로가기" : "폴더",
              count: 0,
              error: null,
            };

            diag.lengthFolders.push(lengthDiag);

            try {
              if (!lengthId) {
                throw new Error("폴더 대상 ID를 확인할 수 없습니다.");
              }

              const childEntries = await listFolder(accessToken, lengthId);
              const txtFiles = childEntries.filter(
                (file) =>
                  file.mimeType !== FOLDER_MIME &&
                  file.mimeType !== SHORTCUT_MIME &&
                  file.name?.toLowerCase().endsWith(".txt")
              );

              lengthDiag.count = txtFiles.length;
              diag.contentCount += txtFiles.length;

              for (const file of txtFiles) {
                const parsed = parseFileName(file.name);

                allItems.push({
                  id: file.id,
                  combination,
                  lengthType,
                  title: parsed.title,
                  author: parsed.author,
                  fileName: file.name,
                  parseFailed: parsed.parseFailed,
                  createdTime: file.createdTime || null,
                  modifiedTime: file.modifiedTime || null,
                  size: file.size ? Number(file.size) : null,
                });
              }
            } catch (error) {
              lengthDiag.error = error?.message || "폴더 조회 실패";
            }
          })
        );
      } catch (error) {
        diag.error = error?.message || "인물조합 폴더 조회 실패";
      }

      diagnostics.push(diag);
    })
  );

  allItems.sort((a, b) => {
    const aTime = a.modifiedTime ? Date.parse(a.modifiedTime) : 0;
    const bTime = b.modifiedTime ? Date.parse(b.modifiedTime) : 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.title.localeCompare(b.title, "ko");
  });

  diagnostics.sort((a, b) => a.combination.localeCompare(b.combination, "ko"));

  const combinations = diagnostics
    .map((diag) => diag.combination)
    .sort((a, b) => a.localeCompare(b, "ko"));

  return {
    rootFolderId: DRIVE_ROOT_FOLDER_ID,
    combinations,
    items: allItems,
    count: allItems.length,
    diagnostics,
    syncedAt: new Date().toISOString(),
  };
}

function applyOverrides(archive, overrides = {}) {
  const items = (archive?.items || []).map((item) => {
    const override = overrides[item.id];

    // 정상 파일명은 항상 Google Drive의 현재 파싱 결과가 최우선.
    // KV에 오래된 수동 수정값이 남아 있어도 사용자 화면에는 적용하지 않는다.
    if (!item.parseFailed) {
      return {
        ...item,
        status: "정상",
        manuallyEdited: false,
      };
    }

    if (!override) {
      return {
        ...item,
        status: "확인 필요",
      };
    }

    return {
      ...item,
      title: override.title?.trim() || item.title,
      author: override.author?.trim() || item.author,
      status: "수정됨",
      manuallyEdited: true,
    };
  });

  return {
    ...archive,
    items,
    count: items.length,
  };
}


function reconcileOverridesWithArchive(archive, overrides = {}, previousArchive = null) {
  const nextOverrides = { ...overrides };
  const reconciled = [];
  const previousById = new Map(
    (previousArchive?.items || []).map((item) => [item.id, item])
  );

  for (const item of archive?.items || []) {
    const override = nextOverrides[item.id];
    if (!override) continue;

    // 현재 Drive 파일명이 정상 형식으로 파싱되면 Drive가 최우선이다.
    if (!item.parseFailed) {
      const previous = previousById.get(item.id);
      const filenameChanged =
        previous ? previous.fileName !== item.fileName : null;

      const overrideTitle = String(override.title || "").trim();
      const overrideAuthor = String(override.author || "").trim();
      const driveTitle = String(item.title || "").trim();
      const driveAuthor = String(item.author || "").trim();

      delete nextOverrides[item.id];

      reconciled.push({
        id: item.id,
        previousFileName: previous?.fileName || null,
        fileName: item.fileName,
        filenameChanged,
        previousOverride: {
          title: overrideTitle,
          author: overrideAuthor,
        },
        driveValue: {
          title: driveTitle,
          author: driveAuthor,
        },
        removedOverride: true,
        differedFromPreviousOverride:
          overrideTitle !== driveTitle || overrideAuthor !== driveAuthor,
      });
    }
  }

  return {
    overrides: nextOverrides,
    reconciled,
  };
}

async function readSettings(kv) {
  const saved = await getJson(kv, SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export {
  DRIVE_ROOT_FOLDER_ID,
  FOLDER_MIME,
  ARCHIVE_CACHE_KEY,
  OVERRIDES_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  jsonResponse,
  requireKv,
  requireAdmin,
  getAccessToken,
  driveFetch,
  listFolder,
  getFileMeta,
  verifyFileInsideArchive,
  parseFileName,
  decodeTextSmart,
  getJson,
  buildArchiveFromDrive,
  applyOverrides,
  reconcileOverridesWithArchive,
  readSettings,
};
