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

// Formatiert eine Pausenzeit in Sekunden als kurzen, lesbaren Text,
// z. B. 60 -> "1 min", 90 -> "1:30 min", 45 -> "45 Sek."
export function formatRest(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} Sek.`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m} min` : `${m}:${String(rem).padStart(2, "0")} min`;
}
