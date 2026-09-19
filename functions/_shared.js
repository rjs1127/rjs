const DRIVE_ROOT_FOLDER_ID = "13F9JJxO2fayYeD9K6-wwjWrVOTQC7-AJ";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function base64UrlEncode(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }

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

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

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
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON 값을 JSON 파일 전체 내용으로 설정해주세요."
    );
  }

  if (!account.client_email || !account.private_key) {
    throw new Error(
      "서비스 계정 JSON에 client_email 또는 private_key가 없습니다."
    );
  }

  return account;
}

async function getAccessToken(env) {
  const account = getServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  if (account.private_key_id) {
    header.kid = account.private_key_id;
  }

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
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
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
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    const detail =
      tokenData?.error_description ||
      tokenData?.error ||
      "Google OAuth 토큰 발급에 실패했습니다.";
    throw new Error(detail);
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
    } catch {
      // ignore JSON parse errors
    }

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
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)",
      pageSize: "1000",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });

    if (pageToken) params.set("pageToken", pageToken);

    const response = await driveFetch(
      accessToken,
      `/files?${params.toString()}`
    );
    const data = await response.json();

    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return allFiles;
}

async function getFileMeta(accessToken, fileId) {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,modifiedTime,size,parents",
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
  if (!combinationFolderId) {
    throw new Error("인물조합 폴더를 확인할 수 없습니다.");
  }

  const combinationFolder = await getFileMeta(
    accessToken,
    combinationFolderId
  );

  if (combinationFolder.mimeType !== FOLDER_MIME) {
    throw new Error("아카이브 구조가 올바르지 않습니다.");
  }

  const rootId = combinationFolder.parents?.[0];

  if (rootId !== DRIVE_ROOT_FOLDER_ID) {
    throw new Error("메인 아카이브 폴더 외부의 파일입니다.");
  }

  return {
    file,
    combination: combinationFolder.name,
    lengthType: lengthFolder.name,
  };
}

function parseFileName(fileName, combination) {
  let base = fileName.replace(/\.txt$/i, "").trim();

  const bracketPrefix = base.match(/^\[([^\]]+)\]\s*/);
  if (bracketPrefix) {
    base = base.slice(bracketPrefix[0].length).trim();
  }

  const splitAt = base.lastIndexOf("_");

  if (splitAt <= 0 || splitAt === base.length - 1) {
    return {
      title: "파일명 불명",
      author: "파일명 불명",
      parseFailed: true,
    };
  }

  const title = base.slice(0, splitAt).trim();
  const author = base.slice(splitAt + 1).trim();

  if (!title || !author) {
    return {
      title: "파일명 불명",
      author: "파일명 불명",
      parseFailed: true,
    };
  }

  return {
    title,
    author,
    parseFailed: false,
  };
}

export {
  DRIVE_ROOT_FOLDER_ID,
  FOLDER_MIME,
  jsonResponse,
  getAccessToken,
  driveFetch,
  listFolder,
  getFileMeta,
  verifyFileInsideArchive,
  parseFileName,
};
