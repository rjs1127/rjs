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
    els.syncMessage.textContent = `동기화 완료: ${data.count.toLocaleString("ko-KR")}개`;
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
