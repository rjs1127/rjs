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
  statusNormalCount: document.getElementById("statusNormalCount"),
  statusEditedCount: document.getElementById("statusEditedCount"),
  statusReviewCount: document.getElementById("statusReviewCount"),
  driveDiagnostics: document.getElementById("driveDiagnostics"),
  diagnosticsEmpty: document.getElementById("diagnosticsEmpty"),
  zipInput: document.getElementById("zipInput"),
  zipDropZone: document.getElementById("zipDropZone"),
  commitMessageInput: document.getElementById("commitMessageInput"),
  deployPreview: document.getElementById("deployPreview"),
  deployFileSummary: document.getElementById("deployFileSummary"),
  allowedFileList: document.getElementById("allowedFileList"),
  blockedFileList: document.getElementById("blockedFileList"),
  deployButton: document.getElementById("deployButton"),
  deployMessage: document.getElementById("deployMessage"),
  dashboardTotalUsers: document.getElementById("dashboardTotalUsers"),
  dashboardTodaySignups: document.getElementById("dashboardTodaySignups"),
  dashboardTodayVisits: document.getElementById("dashboardTodayVisits"),
  dashboardTotalVisits: document.getElementById("dashboardTotalVisits"),
  dashboardChart: document.getElementById("dashboardChart"),
  dashboardDailyList: document.getElementById("dashboardDailyList"),
  dashboardRefreshButton: document.getElementById("dashboardRefreshButton"),
  userCountBadge: document.getElementById("userCountBadge"),
  userSearchInput: document.getElementById("userSearchInput"),
  userRefreshButton: document.getElementById("userRefreshButton"),
  userTableBody: document.getElementById("userTableBody"),
  userEmpty: document.getElementById("userEmpty"),
  userMessage: document.getElementById("userMessage"),
  tabs: Array.from(document.querySelectorAll("[data-tab-target]")),
  panels: Array.from(document.querySelectorAll("[data-tab-panel]")),
};

let password = sessionStorage.getItem("archiveAdminPassword") || "";
let deployFiles = [];
let deployBlocked = [];
let userAdminData = {
  summary: {},
  daily: [],
  users: [],
};

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

function setActiveTab(name) {
  els.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tabTarget === name);
  });

  els.panels.forEach((panel) => {
    const active = panel.dataset.tabPanel === name;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });

  sessionStorage.setItem("archiveAdminTab", name);
}

function renderDiagnostics(items = []) {
  els.diagnosticsEmpty.hidden = items.length !== 0;
  els.driveDiagnostics.innerHTML = items.map((item) => {
    const lengths = Array.isArray(item.lengthFolders) ? item.lengthFolders : [];

    return `
      <article class="diagnostic-card">
        <div class="diagnostic-head">
          <strong>${escapeHtml(item.combination || "-")}</strong>
          <span class="diagnostic-type">${escapeHtml(item.sourceType || "폴더")}</span>
        </div>
        <div class="diagnostic-lengths">
          ${
            lengths.length
              ? lengths.map((length) => `
                  <div class="diagnostic-row">
                    <span>${escapeHtml(length.name || "-")}${length.sourceType === "바로가기" ? " · 바로가기" : ""}</span>
                    <strong>${Number(length.count || 0).toLocaleString("ko-KR")}개</strong>
                  </div>
                  ${length.error ? `<div class="diagnostic-error">${escapeHtml(length.error)}</div>` : ""}
                `).join("")
              : `<div class="diagnostic-row"><span>단편/장편</span><strong>0개</strong></div>`
          }
        </div>
        <div class="diagnostic-total">
          <span>총 콘텐츠</span>
          <strong>${Number(item.contentCount || 0).toLocaleString("ko-KR")}개</strong>
        </div>
        ${item.error ? `<div class="diagnostic-error">${escapeHtml(item.error)}</div>` : ""}
      </article>
    `;
  }).join("");
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


function formatShortDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function formatDashboardDate(value) {
  const date = new Date(`${value}T00:00:00+09:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function renderDashboard(data = userAdminData) {
  const summary = data.summary || {};
  const daily = Array.isArray(data.daily) ? data.daily : [];

  els.dashboardTotalUsers.textContent =
    Number(summary.totalUsers || 0).toLocaleString("ko-KR");
  els.dashboardTodaySignups.textContent =
    Number(summary.todaySignups || 0).toLocaleString("ko-KR");
  els.dashboardTodayVisits.textContent =
    Number(summary.todayVisits || 0).toLocaleString("ko-KR");
  els.dashboardTotalVisits.textContent =
    Number(summary.totalVisits || 0).toLocaleString("ko-KR");

  const maxValue = Math.max(
    1,
    ...daily.flatMap((row) => [
      Number(row.signups || 0),
      Number(row.visits || 0),
    ])
  );

  els.dashboardChart.innerHTML = daily.map((row) => {
    const signupHeight = Math.max(
      row.signups ? 4 : 2,
      (Number(row.signups || 0) / maxValue) * 140
    );
    const visitHeight = Math.max(
      row.visits ? 4 : 2,
      (Number(row.visits || 0) / maxValue) * 140
    );

    return `
      <div class="dashboard-day" title="${escapeHtml(row.date)} · 가입 ${Number(row.signups || 0)} · 방문 ${Number(row.visits || 0)}">
        <div class="dashboard-day-value">${Number(row.signups || 0)}/${Number(row.visits || 0)}</div>
        <div class="dashboard-bars">
          <span class="dashboard-bar signups" style="height:${signupHeight}px"></span>
          <span class="dashboard-bar visits" style="height:${visitHeight}px"></span>
        </div>
        <span class="dashboard-day-label">${escapeHtml(formatDashboardDate(row.date))}</span>
      </div>
    `;
  }).join("");

  els.dashboardDailyList.innerHTML = [...daily]
    .reverse()
    .map((row) => `
      <div class="dashboard-daily-row">
        <strong>${escapeHtml(row.date)}</strong>
        <span>가입 <strong>${Number(row.signups || 0).toLocaleString("ko-KR")}</strong></span>
        <span>방문 <strong>${Number(row.visits || 0).toLocaleString("ko-KR")}</strong></span>
      </div>
    `)
    .join("");
}

function getFilteredAdminUsers() {
  const query = String(els.userSearchInput?.value || "")
    .trim()
    .toLowerCase();

  if (!query) return userAdminData.users || [];

  return (userAdminData.users || []).filter((user) =>
    String(user.userId || "").toLowerCase().includes(query)
  );
}

function renderAdminUsers() {
  const users = getFilteredAdminUsers();
  const total = (userAdminData.users || []).length;

  els.userCountBadge.textContent = `${total.toLocaleString("ko-KR")}명`;
  els.userEmpty.hidden = users.length !== 0;

  els.userTableBody.innerHTML = users.map((user) => `
    <tr data-user-id="${escapeHtml(user.userId)}">
      <td class="user-id-cell">${escapeHtml(user.userId)}</td>
      <td>${escapeHtml(formatShortDate(user.createdAt))}</td>
      <td>${escapeHtml(user.lastActivityAt ? formatDate(user.lastActivityAt) : "-")}</td>
      <td>${Number(user.visitCount || 0).toLocaleString("ko-KR")}</td>
      <td>${Number(user.bookmarkCount || 0).toLocaleString("ko-KR")}</td>
      <td>${Number(user.recentCount || 0).toLocaleString("ko-KR")}</td>
      <td>${Number(user.readCount || 0).toLocaleString("ko-KR")}</td>
      <td>
        <div class="user-actions">
          <button class="user-action-button" type="button" data-user-action="reset_sessions">세션 초기화</button>
          <button class="user-action-button danger" type="button" data-user-action="delete_user">계정 삭제</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function loadUserAdminData(showMessage = false) {
  const data = await api("/api/admin/users?days=14");

  userAdminData = {
    summary: data.summary || {},
    daily: data.daily || [],
    users: data.users || [],
  };

  renderDashboard(userAdminData);
  renderAdminUsers();

  if (showMessage && els.userMessage) {
    els.userMessage.hidden = false;
    els.userMessage.textContent = "유저 정보를 새로 불러왔습니다.";
  }
}

async function loadAdmin() {
  const data = await api("/api/admin/data");

  els.loginCard.hidden = true;
  els.adminContent.hidden = false;

  const reviewCount = Array.isArray(data.needsReview) ? data.needsReview.length : 0;
  const editedCount = Number(data.editedCount || 0);
  const totalCount = Number(data.count || 0);
  const normalCount = Math.max(0, totalCount - reviewCount - editedCount);

  els.statCount.textContent = `${totalCount.toLocaleString("ko-KR")}개`;
  els.statReview.textContent = `${reviewCount.toLocaleString("ko-KR")}개`;
  els.statEdited.textContent = `${editedCount.toLocaleString("ko-KR")}개`;
  els.statSync.textContent = formatDate(data.syncedAt);

  els.statusNormalCount.textContent = `${normalCount.toLocaleString("ko-KR")}개`;
  els.statusEditedCount.textContent = `${editedCount.toLocaleString("ko-KR")}개`;
  els.statusReviewCount.textContent = `${reviewCount.toLocaleString("ko-KR")}개`;

  els.eyebrowInput.value = data.settings?.eyebrow || "";
  els.titleInput.value = data.settings?.title || "";
  els.subtitleInput.value = data.settings?.subtitle || "";

  renderReview(data.needsReview || []);
  renderDiagnostics(data.diagnostics || []);

  try {
    await loadUserAdminData();
  } catch (error) {
    console.warn("유저 대시보드 로딩 실패", error);
  }

  setActiveTab(sessionStorage.getItem("archiveAdminTab") || "dashboard");
}

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

  if (!(normalized.startsWith("public/") || normalized.startsWith("functions/") || normalized === "README.md")) {
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


function buildCommitMessageFromReadme(
  readmeText,
  fallbackFileCount = 0,
  zipFileName = ""
) {
  const text = String(readmeText || "").replace(/\r\n/g, "\n");

  const versionMatch = text.match(/^##\s+(v[0-9]+(?:\.[0-9]+)*)\s*$/m);
  const version = versionMatch ? versionMatch[1].trim() : "";

  let section = text;

  if (versionMatch) {
    const start = versionMatch.index + versionMatch[0].length;
    const tail = text.slice(start);
    const nextVersionMatch = tail.match(/^##\s+v[0-9]+(?:\.[0-9]+)*\s*$/m);

    section = nextVersionMatch
      ? tail.slice(0, nextVersionMatch.index)
      : tail;
  }

  const bulletLines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, "")
        .replace(/`/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.!。]+$/g, "")
        .trim()
    )
    .filter(Boolean);

  let summary = bulletLines.slice(0, 2).join(" / ");

  if (summary.length > 78) {
    summary = summary.slice(0, 75).trimEnd() + "…";
  }

  if (version && summary) return `${version}: ${summary}`;
  if (version) return `${version}: Archive site update`;

  const zipVersion = String(zipFileName || "").match(/v[0-9]+(?:[_\.][0-9]+)*/i);
  const normalizedZipVersion = zipVersion
    ? zipVersion[0].replaceAll("_", ".").toLowerCase()
    : "";

  if (summary) {
    return normalizedZipVersion
      ? `${normalizedZipVersion}: ${summary}`
      : `Archive update: ${summary}`;
  }

  if (normalizedZipVersion) {
    return `${normalizedZipVersion}: Archive site update`;
  }

  return `Archive update (${fallbackFileCount} files)`;
}

async function inspectZip(file) {
  if (!window.JSZip) {
    throw new Error("ZIP 처리 라이브러리를 불러오지 못했습니다.");
  }

  const zip = await JSZip.loadAsync(file);
  const allowed = [];
  const blocked = [];
  const entries = Object.values(zip.files);
  let readmeText = "";

  for (const entry of entries) {
    const normalizedEntryPath = normalizeZipPath(entry.name);

    if (!entry.dir && normalizedEntryPath === "README.md") {
      try {
        readmeText = await entry.async("string");
      } catch {
        readmeText = "";
      }
    }
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

  const autoMessage = buildCommitMessageFromReadme(
    readmeText,
    allowed.length,
    file.name
  );

  if (els.commitMessageInput) {
    els.commitMessageInput.value = autoMessage;
    els.commitMessageInput.dataset.autoGenerated = "true";
    els.commitMessageInput.title = readmeText
      ? "README.md 최신 버전 변경사항으로 자동 생성됨"
      : "README.md를 찾지 못해 ZIP 이름/파일 수 기준으로 자동 생성됨";
  }

  renderDeployPreview();

  if (els.deployMessage) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = readmeText
      ? `커밋 메시지 자동 생성 완료: ${autoMessage}`
      : `README.md를 찾지 못해 기본 커밋 메시지를 생성했습니다: ${autoMessage}`;
  }
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
  } catch (error) {
    els.deployMessage.hidden = false;
    els.deployMessage.textContent = error.message;
  }
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tabTarget));
});


els.dashboardRefreshButton?.addEventListener("click", async () => {
  els.dashboardRefreshButton.disabled = true;
  try {
    await loadUserAdminData(false);
  } catch (error) {
    window.alert(error.message || "대시보드를 불러오지 못했습니다.");
  } finally {
    els.dashboardRefreshButton.disabled = false;
  }
});

els.userRefreshButton?.addEventListener("click", async () => {
  els.userRefreshButton.disabled = true;
  try {
    await loadUserAdminData(true);
  } catch (error) {
    els.userMessage.hidden = false;
    els.userMessage.textContent =
      error.message || "유저 정보를 불러오지 못했습니다.";
  } finally {
    els.userRefreshButton.disabled = false;
  }
});

els.userSearchInput?.addEventListener("input", renderAdminUsers);

els.userTableBody?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-user-action]");
  if (!button) return;

  const row = button.closest("[data-user-id]");
  const userId = row?.dataset.userId;
  const action = button.dataset.userAction;

  if (!userId || !action) return;

  const confirmed = window.confirm(
    action === "delete_user"
      ? `${userId} 계정을 삭제할까요?\n이어보기, 북마크, 최근 조회, 방문 기록과 로그인 세션이 모두 삭제됩니다.`
      : `${userId} 계정의 모든 로그인 세션을 초기화할까요?\n현재 로그인된 기기들은 다시 로그인해야 합니다.`
  );

  if (!confirmed) return;

  button.disabled = true;

  try {
    await api("/api/admin/user-action", {
      method: "POST",
      body: JSON.stringify({ action, userId }),
    });

    await loadUserAdminData(false);

    els.userMessage.hidden = false;
    els.userMessage.textContent =
      action === "delete_user"
        ? `${userId} 계정을 삭제했습니다.`
        : `${userId} 계정의 로그인 세션을 초기화했습니다.`;
  } catch (error) {
    els.userMessage.hidden = false;
    els.userMessage.textContent = error.message || "작업에 실패했습니다.";
  } finally {
    button.disabled = false;
  }
});

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
    renderDiagnostics(data.diagnostics || []);
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

    await loadAdmin();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = "저장";
  }
});

els.commitMessageInput?.addEventListener("input", () => {
  els.commitMessageInput.dataset.autoGenerated = "false";
  els.commitMessageInput.title = "직접 수정한 커밋 메시지";
});

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

  const message = els.commitMessageInput.value.trim() || "Archive site update";

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

if (password) {
  loadAdmin().catch(() => {
    sessionStorage.removeItem("archiveAdminPassword");
    password = "";
    els.loginCard.hidden = false;
    els.adminContent.hidden = true;
  });
}
