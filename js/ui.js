export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function topBar(title, subtitle, { showBack = false, showLogout = false } = {}) {
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        ${showBack ? `<button class="icon-btn" data-nav-back aria-label="Zurück">←</button>` : ""}
        <div style="min-width:0;">
          <div class="title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
        </div>
      </div>
      ${showLogout ? `<button class="icon-btn" data-nav-logout aria-label="Abmelden">⎋</button>` : ""}
    </div>
  `;
}

export function loadingSpinner(label = "Lädt …") {
  return `<div class="loading-spinner">${escapeHtml(label)}</div>`;
}

export function emptyState(emoji, text) {
  return `<div class="empty-state"><div class="emoji">${emoji}</div><p>${escapeHtml(text)}</p></div>`;
}

export function showErrorToast(helpers, err) {
  console.error(err);
  helpers.toast("⚠️ " + (err?.message || "Fehler beim Speichern"));
}
