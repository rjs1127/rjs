const els = {
  loginCard: document.getElementById("loginCard"),
  loginForm: document.getElementById("loginForm"),
  passwordInput: document.getElementById("passwordInput"),
  loginError: document.getElementById("loginError"),
  adminContent: document.getElementById("adminContent"),
  statCount: document.getElementById("statCount"),
  statReview: document.getElementById("statReview"),
  statEdited: document.getElementById("statEdited"),
  statSync: document.getElementById("statSync"),
  syncButton: document.getElementById("syncButton"),
  syncMessage: document.getElementById("syncMessage"),
  settingsForm: document.getElementById("settingsForm"),
  eyebrowInput: document.getElementById("eyebrowInput"),
  titleInput: document.getElementById("titleInput"),
  subtitleInput: document.getElementById("subtitleInput"),
  settingsMessage: document.getElementById("settingsMessage"),
  reviewList: document.getElementById("reviewList"),
  reviewEmpty: document.getElementById("reviewEmpty"),
  reviewCount: document.getElementById("reviewCount"),
  zipInput: document.getElementById("zipInput"),
  zipDropZone: document.getElementById("zipDropZone"),
  commitMessageInput: document.getElementById("commitMessageInput"),
  deployPreview: document.getElementById("deployPreview"),
  deployFileSummary: document.getElementById("deployFileSummary"),
  allowedFileList: document.getElementById("allowedFileList"),
  blockedFileList: document.getElementById("blockedFileList"),
  deployButton: document.getElementById("deployButton"),
  deployMessage: document.getElementById("deployMessage"),
};

let password = sessionStorage.getItem("archiveAdminPassword") || "";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-admin-password": password,
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "요청에 실패했습니다.");
  return data;
}

function formatDate(value) {
  if (!value) return "아직 없음";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function loadAdmin() {
  const data = await api("/api/admin/data");

  els.loginCard.hidden = true;
  els.adminContent.hidden = false;

  els.statCount.textContent = `${data.count.toLocaleString("ko-KR")}개`;
  els.statReview.textContent = `${data.needsReview.length.toLocaleString("ko-KR")}개`;
  els.statEdited.textContent = `${data.editedCount.toLocaleString("ko-KR")}개`;
  els.statSync.textContent = formatDate(data.syncedAt);

  els.eyebrowInput.value = data.settings?.eyebrow || "";
  els.titleInput.value = data.settings?.title || "";
  els.subtitleInput.value = data.settings?.subtitle || "";

  renderReview(data.needsReview || []);
}

function renderReview(items) {
  els.reviewCount.textContent = `${items.length.toLocaleString("ko-KR")}개`;
  els.reviewEmpty.hidden = items.length !== 0;

  els.reviewList.innerHTML = items.map((item) => `
    <article class="review-item" data-id="${escapeHtml(item.id)}">
      <div class="review-top">
        <div>
          <div class="file-name">${escapeHtml(item.fileName)}</div>
          <div class="meta">${escapeHtml(item.combination)} · ${escapeHtml(item.lengthType)}</div>
        </div>
      </div>
      <form class="review-form">
        <label>
          <span>제목</span>
          <input name="title" value="${escapeHtml(item.title)}" required />
        </label>
        <label>
          <span>작성자</span>
          <input name="author" value="${escapeHtml(item.author === "작성자 미상" ? "" : item.author)}" placeholder="작성자 미상" />
        </label>
        <button type="submit">저장</button>
      </form>
    </article>
  `).join("");
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  password = els.passwordInput.value;
  els.loginError.hidden = true;

  try {
    await loadAdmin();
    sessionStorage.setItem("archiveAdminPassword", password);
  } catch (error) {
    els.loginError.textContent = error.message;
    els.loginError.hidden = false;
  }
});

els.syncButton.addEventListener("click", async () => {
  els.syncButton.disabled = true;
  els.syncMessage.hidden = false;
  els.syncMessage.textContent = "Google Drive를 다시 읽는 중입니다…";

  try {
    const data = await api("/api/admin/sync", {
      method: "POST",
      body: "{}",
    });
    const reconciled = Number(data.reconciledCount || 0);
    els.syncMessage.textContent =
      reconciled > 0
        ? `동기화 완료: ${data.count.toLocaleString("ko-KR")}개 · 정상 파일명으로 복원 ${reconciled.toLocaleString("ko-KR")}개`
        : `동기화 완료: ${data.count.toLocaleString("ko-KR")}개`;
    await loadAdmin();
  } catch (error) {
    els.syncMessage.textContent = error.message;
  } finally {
    els.syncButton.disabled = false;
  }
});

els.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.settingsMessage.hidden = false;
  els.settingsMessage.textContent = "저장 중…";

  try {
    await api("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({
        eyebrow: els.eyebrowInput.value,
        title: els.titleInput.value,
        subtitle: els.subtitleInput.value,
      }),
    });
    els.settingsMessage.textContent = "저장했습니다. 메인 화면 새로고침 시 반영됩니다.";
  } catch (error) {
    els.settingsMessage.textContent = error.message;
  }
});

els.reviewList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".review-form");
  if (!form) return;
  event.preventDefault();

  const item = form.closest(".review-item");
  const button = form.querySelector("button");
  const title = form.elements.title.value.trim();
  const author = form.elements.author.value.trim();

  button.disabled = true;
  button.textContent = "저장 중…";

  try {
    await api("/api/admin/item", {
      method: "POST",
      body: JSON.stringify({
        id: item.dataset.id,
        title,
        author,
      }),
    });

    item.remove();
    await loadAdmin();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = "저장";
  }
});

if (password) {
  loadAdmin().catch(() => {
    sessionStorage.removeItem("archiveAdminPassword");
    password = "";
    els.loginCard.hidden = false;
    els.adminContent.hidden = true;
  });
}


let deployFiles = [];
let deployBlocked = [];

function normalizeZipPath(path) {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/^google-drive-archive-site[^/]*\//, "");
}

function checkDeployPath(path) {
  const normalized = normalizeZipPath(path);

  if (!normalized || normalized.endsWith("/")) {
    return { allowed: false, path: normalized, reason: "폴더" };
  }

  const protectedExact = new Set([
    "wrangler.toml",
    ".gitignore",
    ".env",
    ".dev.vars",
    "README.md",
  ]);

  if (protectedExact.has(normalized)) {
    return { allowed: false, path: normalized, reason: "보호된 설정 파일" };
  }

  if (
    normalized.startsWith(".git/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("credentials/") ||
    normalized.startsWith("secrets/")
  ) {
    return { allowed: false, path: normalized, reason: "보호된 경로" };
  }

  if (
    /(^|\/)(service[-_]?account|credentials|secret|secrets)(\.|\/|$)/i.test(normalized)
  ) {
    return { allowed: false, path: normalized, reason: "민감정보 가능 파일" };
  }

  if (!(normalized.startsWith("public/") || normalized.startsWith("functions/"))) {
    return { allowed: false, path: normalized, reason: "허용된 소스 경로가 아님" };
  }

  return { allowed: true, path: normalized };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}

async function inspectZip(file) {
  if (!window.JSZip) {
    throw new Error("ZIP 처리 라이브러리를 불러오지 못했습니다.");
  }

  const zip = await JSZip.loadAsync(file);
  const allowed = [];
  const blocked = [];

  const entries = Object.values(zip.files);

  for (const entry of entries) {
    if (entry.dir) continue;

    const check = checkDeployPath(entry.name);

    if (!check.allowed) {
      blocked.push({
        path: check.path || entry.name,
        reason: check.reason,
      });
      continue;
    }

    const bytes = await entry.async("uint8array");

    if (bytes.byteLength > 6 * 1024 * 1024) {
      blocked.push({
        path: check.path,
        reason: "파일 크기 제한 초과",
      });
      continue;
    }

    allowed.push({
      path: check.path,
      contentBase64: bytesToBase64(bytes),
      size: bytes.byteLength,
    });
  }

  deployFiles = allowed;
  deployBlocked = blocked;
  renderDeployPreview();
}

function renderDeployPreview() {
  els.deployPreview.hidden = false;
  els.deployFileSummary.textContent =
    `배포 ${deployFiles.length.toLocaleString("ko-KR")}개 · 제외 ${deployBlocked.length.toLocaleString("ko-KR")}개`;

  els.allowedFileList.innerHTML = deployFiles.length
    ? deployFiles
        .map(
          (file) =>
            `<li>✓ ${escapeHtml(file.path)} <span class="meta">(${Math.ceil(file.size / 1024)} KB)</span></li>`
        )
        .join("")
    : "<li>배포 가능한 파일이 없습니다.</li>";

  els.blockedFileList.innerHTML = deployBlocked.length
    ? deployBlocked
        .map(
          (file) =>
            `<li>! ${escapeHtml(file.path)} — ${escapeHtml(file.reason)}</li>`
        )
        .join("")
    : "<li>제외된 파일이 없습니다.</li>";

  els.deployButton.disabled = deployFiles.length === 0;
}

async function handleZipFile(file) {
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".zip")) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = "ZIP 파일만 업로드할 수 있습니다.";
    return;
  }

  els.deployMessage.hidden = false;
  els.deployMessage.textContent = "ZIP 내용을 확인하는 중…";
  els.deployPreview.hidden = true;

  try {
    await inspectZip(file);
    els.deployMessage.hidden = true;
  } catch (error) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = error.message;
  }
}

els.zipInput.addEventListener("change", (event) => {
  handleZipFile(event.target.files?.[0]);
});

els.zipDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.zipDropZone.classList.add("dragover");
});

els.zipDropZone.addEventListener("dragleave", () => {
  els.zipDropZone.classList.remove("dragover");
});

els.zipDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.zipDropZone.classList.remove("dragover");
  handleZipFile(event.dataTransfer.files?.[0]);
});

els.deployButton.addEventListener("click", async () => {
  if (!deployFiles.length) return;

  const message =
    els.commitMessageInput.value.trim() || "Archive site update";

  els.deployButton.disabled = true;
  els.deployButton.textContent = "GitHub 커밋 중…";
  els.deployMessage.hidden = false;
  els.deployMessage.textContent = "GitHub에 변경사항을 커밋하고 있습니다…";

  try {
    const result = await api("/api/admin/deploy", {
      method: "POST",
      body: JSON.stringify({
        message,
        files: deployFiles.map(({ path, contentBase64 }) => ({
          path,
          contentBase64,
        })),
      }),
    });

    els.deployMessage.innerHTML =
      `배포 요청 완료 · ${result.deployedFiles.length.toLocaleString("ko-KR")}개 파일 커밋<br>` +
      `<a href="${escapeHtml(result.commitUrl)}" target="_blank" rel="noopener">GitHub 커밋 확인 ↗</a><br>` +
      `Cloudflare Pages 자동 배포가 곧 시작됩니다.`;

    deployFiles = [];
    deployBlocked = [];
    els.deployPreview.hidden = true;
    els.zipInput.value = "";
  } catch (error) {
    els.deployMessage.textContent = error.message;
  } finally {
    els.deployButton.disabled = false;
    els.deployButton.textContent = "GitHub에 배포";
  }
});
