// Pausen-Timer: Leiste oben am Bildschirm, unabhängig vom aktuellen View
// (an document.body gehängt, damit sie Re-Renders des Trainings-Logs überlebt).
//
// WICHTIG – warum der Timer jetzt "durchläuft", auch wenn das Handy gesperrt ist:
// Früher wurde jede Sekunde 1 abgezogen (setInterval). Bei gesperrtem Display
// friert das Handy die Web-App aber ein → es wurde nicht weitergezählt.
// Jetzt merken wir uns den festen END-ZEITPUNKT (Uhrzeit) und rechnen die
// Restzeit bei jedem Tick (und sofort beim Entsperren) daraus neu aus.
// Dadurch stimmt die Anzeige nach dem Entsperren immer, und ist die Pause
// inzwischen um, erscheint direkt das Popup "Satzpause ist um".
// Der Zustand liegt zusätzlich in localStorage – selbst wenn iOS die App im
// Hintergrund komplett beendet, wird der Timer beim Öffnen wiederhergestellt.

const STORE_KEY = "tt_rest_timer";
const SHOW_MISSED_UP_TO_MS = 15 * 60 * 1000; // ältere verpasste Pausen nicht mehr anzeigen

let state = null; // { endAt, total, label, paused, pausedRemaining }
let barEl = null;
let overlayEl = null;
let tickId = null;
let audioCtx = null;
let finishHandled = false;

// ---------------------------------------------------------------------------
// Persistenz
// ---------------------------------------------------------------------------
function save() {
  try {
    if (state) localStorage.setItem(STORE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* localStorage evtl. nicht verfügbar – Timer läuft trotzdem */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Zeitberechnung
// ---------------------------------------------------------------------------
function remainingMs() {
  if (!state) return 0;
  if (state.paused) return state.pausedRemaining;
  return Math.max(0, state.endAt - Date.now());
}

function remainingSec() {
  return Math.ceil(remainingMs() / 1000);
}

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// UI: Leiste
// ---------------------------------------------------------------------------
function ensureBar() {
  if (barEl) return barEl;

  barEl = document.createElement("div");
  barEl.id = "rest-timer-bar";
  barEl.className = "rest-timer-bar hidden";
  barEl.innerHTML = `
    <div class="rt-info">
      <div class="rt-label" id="rt-label">Pause</div>
      <div class="rt-time" id="rt-time">0:00</div>
    </div>
    <div class="rt-controls">
      <button type="button" id="rt-minus" class="rt-btn">−15</button>
      <button type="button" id="rt-pause" class="rt-btn rt-btn-main">⏸</button>
      <button type="button" id="rt-plus" class="rt-btn">+15</button>
      <button type="button" id="rt-close" class="rt-btn rt-btn-close" aria-label="Timer schließen">✕</button>
    </div>
    <div class="rt-progress"><div class="rt-progress-fill" id="rt-progress-fill"></div></div>
  `;
  document.body.appendChild(barEl);

  barEl.querySelector("#rt-minus").addEventListener("click", () => adjust(-15));
  barEl.querySelector("#rt-plus").addEventListener("click", () => adjust(15));
  barEl.querySelector("#rt-pause").addEventListener("click", togglePause);
  barEl.querySelector("#rt-close").addEventListener("click", stopTimer);

  return barEl;
}

function render() {
  if (!state || !barEl) return;
  const sec = remainingSec();
  barEl.querySelector("#rt-time").textContent = fmt(sec);
  barEl.querySelector("#rt-label").textContent = state.label;
  barEl.querySelector("#rt-pause").textContent = state.paused ? "▶" : "⏸";
  const totalMs = state.total * 1000;
  const pct = totalMs > 0 ? Math.min(100, (1 - remainingMs() / totalMs) * 100) : 100;
  barEl.querySelector("#rt-progress-fill").style.width = `${pct}%`;
}

// ---------------------------------------------------------------------------
// UI: Popup "Satzpause ist um"
// ---------------------------------------------------------------------------
function ensureOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement("div");
  overlayEl.id = "rest-done-overlay";
  overlayEl.className = "rest-done-overlay hidden";
  overlayEl.setAttribute("role", "alertdialog");
  overlayEl.setAttribute("aria-labelledby", "rd-title");
  overlayEl.innerHTML = `
    <div class="rest-done-card">
      <img src="img/ares-mark.png" alt="" />
      <span class="eyebrow" id="rd-label">Pause</span>
      <div class="rd-title" id="rd-title">Satzpause ist um</div>
      <div class="rd-sub" id="rd-sub">Weiter geht's mit dem nächsten Satz.</div>
      <button type="button" class="btn btn-primary" id="rd-continue">Weiter trainieren 💪</button>
    </div>
  `;
  document.body.appendChild(overlayEl);
  const close = () => overlayEl.classList.add("hidden");
  overlayEl.querySelector("#rd-continue").addEventListener("click", close);
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) close();
  });
  return overlayEl;
}

function showDonePopup(label, overdueMs) {
  const el = ensureOverlay();
  el.querySelector("#rd-label").textContent = label || "Pause";
  const overdueSec = Math.floor(overdueMs / 1000);
  el.querySelector("#rd-sub").textContent =
    overdueSec >= 5 ? `Die Pause ist seit ${fmt(overdueSec)} min vorbei.` : "Weiter geht's mit dem nächsten Satz.";
  el.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Steuerung
// ---------------------------------------------------------------------------
function startTicking() {
  stopTicking();
  // 4× pro Sekunde neu berechnen: billig, und die Anzeige springt nie.
  tickId = setInterval(tick, 250);
}

function stopTicking() {
  if (tickId) clearInterval(tickId);
  tickId = null;
}

function tick() {
  if (!state) return stopTicking();
  if (state.paused) return render();
  if (remainingMs() <= 0) {
    render();
    onFinished();
    return;
  }
  render();
}

function adjust(deltaSec) {
  if (!state) return;
  const deltaMs = deltaSec * 1000;
  if (state.paused) {
    state.pausedRemaining = Math.max(0, state.pausedRemaining + deltaMs);
  } else {
    state.endAt = Math.max(Date.now(), state.endAt + deltaMs);
  }
  state.total = Math.max(state.total, remainingSec());
  finishHandled = false;
  barEl.classList.remove("rt-finished");
  save();
  if (!tickId) startTicking();
  render();
}

function togglePause() {
  if (!state) return;
  if (state.paused) {
    state.paused = false;
    state.endAt = Date.now() + state.pausedRemaining;
    state.pausedRemaining = 0;
  } else {
    state.pausedRemaining = remainingMs();
    state.paused = true;
  }
  save();
  render();
}

function onFinished() {
  if (finishHandled) return;
  finishHandled = true;
  stopTicking();

  const overdue = state ? Date.now() - state.endAt : 0;
  const label = state?.label;

  playBeep();
  vibrate();
  showDonePopup(label, overdue);

  if (barEl) {
    barEl.classList.add("rt-finished");
    const labelEl = barEl.querySelector("#rt-label");
    if (labelEl) labelEl.textContent = "Fertig! 💪";
  }
  state = null;
  save();
  setTimeout(() => {
    if (!state && barEl) barEl.classList.add("hidden");
  }, 1500);
}

// Startet (oder ersetzt) die laufende Pause mit einer neuen Dauer in Sekunden
// und einem Label (z. B. Übungsname + Satznummer).
export function startRestTimer(seconds, label) {
  unlockAudio(); // wird aus einem Tap heraus aufgerufen → Ton später erlaubt
  const el = ensureBar();
  overlayEl?.classList.add("hidden");

  const total = Math.max(1, Math.round(seconds) || 60);
  state = { endAt: Date.now() + total * 1000, total, label: label || "Pause", paused: false, pausedRemaining: 0 };
  finishHandled = false;
  save();

  el.classList.remove("hidden", "rt-finished");
  render();
  startTicking();
}

function stopTimer() {
  stopTicking();
  state = null;
  save();
  if (barEl) barEl.classList.add("hidden");
}

// Beim Entsperren / Zurückwechseln in die App sofort neu rechnen
// (statt auf den nächsten Tick zu warten) – inkl. Popup, falls die Pause
// in der Zwischenzeit abgelaufen ist.
function resync() {
  if (!state) return;
  if (audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  if (!state.paused && remainingMs() <= 0) {
    render();
    onFinished();
  } else {
    render();
    if (!tickId) startTicking();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resync();
});
window.addEventListener("pageshow", resync);
window.addEventListener("focus", resync);

// Wiederherstellen nach Neustart der App (iOS beendet Web-Apps im Hintergrund
// manchmal komplett).
function restore() {
  const saved = load();
  if (!saved || typeof saved.endAt !== "number") return;
  state = saved;
  if (!state.paused && remainingMs() <= 0) {
    const overdue = Date.now() - state.endAt;
    const label = state.label;
    state = null;
    save();
    if (overdue < SHOW_MISSED_UP_TO_MS) {
      vibrate();
      showDonePopup(label, overdue);
    }
    return;
  }
  ensureBar().classList.remove("hidden");
  render();
  startTicking();
}

restore();

// ---------------------------------------------------------------------------
// Ton & Vibration
// ---------------------------------------------------------------------------
function vibrate() {
  if (navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // Vibration evtl. nicht erlaubt – kein Problem, Ton übernimmt
    }
  }
}

// iOS spielt Web-Audio nur ab, wenn der AudioContext einmal durch einen Tap
// "freigeschaltet" wurde. Deshalb legen wir ihn beim Abhaken eines Satzes an
// und benutzen ihn danach wieder (statt bei Ablauf einen neuen zu erzeugen).
function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state !== "running") audioCtx.resume().catch(() => {});
    // ganz kurzer, unhörbarer Ton zum Freischalten
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.02);
  } catch {
    /* kein Audio – egal */
  }
}

// Zwei kurze Pieptöne per Web Audio API, ganz ohne externe Audiodatei
// (funktioniert damit auch offline / im installierten PWA-Cache).
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && AudioCtx) audioCtx = new AudioCtx();
    if (!audioCtx) return;
    const go = () => {
      beepTone(audioCtx, 880, 0, 0.5);
      beepTone(audioCtx, 1040, 0.55, 0.4);
    };
    if (audioCtx.state !== "running") audioCtx.resume().then(go).catch(() => {});
    else go();
  } catch {
    // Audio evtl. blockiert – Vibration + Popup reichen als Fallback
  }
}

function beepTone(ctx, freq, delaySec, durationSec) {
  const start = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(0.3, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + durationSec + 0.02);
}
