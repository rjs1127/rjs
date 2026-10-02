const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "www", "app.js");
let app = fs.readFileSync(appPath, "utf8");

function replaceBetween(startMarker, endMarker, replacement) {
  const start = app.indexOf(startMarker);
  if (start < 0) {
    throw new Error("시작 위치 못 찾음: " + startMarker);
  }

  const end = app.indexOf(endMarker, start);
  if (end < 0) {
    throw new Error("끝 위치 못 찾음: " + endMarker);
  }

  app = app.slice(0, start) + replacement + "\n" + app.slice(end);
}

const helperMarker = "function downloadReaderShareBlob(blob, filename) {";

if (!app.includes(helperMarker)) {
  throw new Error("downloadReaderShareBlob 위치를 찾지 못했습니다.");
}

if (!app.includes("RJS NATIVE SHARE V3")) {
  const helpers = `
// ===== RJS NATIVE SHARE V3 =====
function isRjsNativeApp() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

function rjsBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("blob_to_data_url_failed"));
    reader.readAsDataURL(blob);
  });
}

function rjsSafeImageFilename(filename) {
  return String(filename || "quote-card.png")
    .replace(/[\\\\/:*?"<>|]+/g, "_")
    .trim() || "quote-card.png";
}

async function rjsSaveImageToGallery(blob, filename) {
  const Media = window.Capacitor?.Plugins?.Media;

  if (!Media?.savePhoto) {
    throw new Error("native_media_unavailable");
  }

  const albumName = "셩냥책";
  let result = await Media.getAlbums();
  let albums = result?.albums || [];

  let album = albums.find((entry) => entry?.name === albumName);

  if (!album) {
    try {
      await Media.createAlbum({ name: albumName });
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("exist")) throw error;
    }

    result = await Media.getAlbums();
    albums = result?.albums || [];
    album = albums.find((entry) => entry?.name === albumName);
  }

  if (!album?.identifier) {
    throw new Error("native_album_unavailable");
  }

  const dataUrl = await rjsBlobToDataUrl(blob);

  await Media.savePhoto({
    path: dataUrl,
    albumIdentifier: album.identifier,
    fileName: rjsSafeImageFilename(filename).replace(/\\.png$/i, ""),
  });
}

async function rjsCopyImageNative(blob) {
  const Clipboard = window.Capacitor?.Plugins?.Clipboard;

  if (!Clipboard?.write) {
    throw new Error("native_clipboard_unavailable");
  }

  const dataUrl = await rjsBlobToDataUrl(blob);

  await Clipboard.write({
    image: dataUrl,
    label: "셩냥책 문장 이미지",
  });
}

async function rjsWriteShareTempFile(blob, filename) {
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;

  if (!Filesystem?.writeFile) {
    throw new Error("native_filesystem_unavailable");
  }

  const dataUrl = await rjsBlobToDataUrl(blob);
  const base64 = dataUrl.split(",")[1] || "";

  if (!base64) {
    throw new Error("invalid_share_image");
  }

  const result = await Filesystem.writeFile({
    path: \`share/\${Date.now()}-\${rjsSafeImageFilename(filename)}\`,
    data: base64,
    directory: "CACHE",
    recursive: true,
  });

  return result.uri;
}

async function rjsShareImageNative(blob, filename) {
  const Share = window.Capacitor?.Plugins?.Share;

  if (!Share?.share) {
    throw new Error("native_share_unavailable");
  }

  const uri = await rjsWriteShareTempFile(blob, filename);

  await Share.share({
    files: [uri],
    title: filename,
    text: getReaderShareSourceItem().title || "문장 이미지",
    dialogTitle: "이미지 공유",
  });
}
// ===== /RJS NATIVE SHARE V3 =====

`;

  app = app.replace(helperMarker, helpers + helperMarker);
}

replaceBetween(
  "function copyReaderShareImageToClipboard() {",
  "function setReaderShareBusy(isBusy) {",
`function copyReaderShareImageToClipboard() {
  const blob = getPreparedReaderShareBlob();

  if (!blob) {
    scheduleReaderShareBlobPreparation(0);
    throw new Error("clipboard_image_preparing");
  }

  if (isRjsNativeApp()) {
    return rjsCopyImageNative(blob);
  }

  if (!window.isSecureContext || !navigator.clipboard?.write || !window.ClipboardItem) {
    throw new Error("clipboard_image_unsupported");
  }

  if (
    typeof ClipboardItem.supports === "function" &&
    !ClipboardItem.supports("image/png")
  ) {
    throw new Error("clipboard_image_unsupported");
  }

  let item;

  try {
    item = new ClipboardItem({ "image/png": blob });
  } catch (error) {
    throw new Error("clipboard_image_unsupported", { cause: error });
  }

  return navigator.clipboard.write([item]);
}`
);

replaceBetween(
  "async function handleReaderShareExport(mode) {",
  "// v8.15:",
`async function handleReaderShareExport(mode) {
  ensureReaderShareUi();

  if (!String(state.readerShareText || "").trim()) {
    window.alert("공유할 문구가 없습니다.");
    return;
  }

  setReaderShareBusy(true);

  try {
    const blob =
      getPreparedReaderShareBlob() ||
      await createReaderShareBlobPromise();

    if (
      !readerSharePreparedBlob ||
      readerSharePreparedBlobKey !== getReaderShareBlobKey()
    ) {
      readerSharePreparedBlob = blob;
      readerSharePreparedBlobKey = getReaderShareBlobKey();
    }

    const filename = getReaderShareFilename();

    if (isRjsNativeApp()) {
      if (mode === "save") {
        await rjsSaveImageToGallery(blob, filename);
        window.alert("이미지를 갤러리에 저장했어요.");
        return;
      }

      await rjsShareImageNative(blob, filename);
      return;
    }

    if (mode === "save") {
      downloadReaderShareBlob(blob, filename);
      return;
    }

    const file = new File([blob], filename, {
      type: "image/png",
    });

    if (
      navigator.share &&
      (!navigator.canShare ||
        navigator.canShare({ files: [file] }))
    ) {
      await navigator.share({
        files: [file],
        title: filename,
        text: getReaderShareSourceItem().title || "문장 이미지",
      });
      return;
    }

    downloadReaderShareBlob(blob, filename);
    window.alert(
      "이 기기에서는 시스템 공유를 지원하지 않아 이미지 파일을 저장했어요."
    );
  } catch (error) {
    if (error?.name === "AbortError") return;

    console.error("reader native image action failed", error);

    window.alert(
      "이미지 처리에 실패했습니다. 다시 시도해 주세요."
    );
  } finally {
    setReaderShareBusy(false);
  }
}`
);

fs.writeFileSync(appPath, app, "utf8");

console.log("네이티브 저장/복사/공유 V3 패치 완료");
