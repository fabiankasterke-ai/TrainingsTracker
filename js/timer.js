// Pausen-Timer: eine schwebende Leiste am unteren Bildschirmrand, die unabhängig
// vom aktuellen View-Rendering läuft (an document.body gehängt, nicht an #app,
// damit sie beim Neuzeichnen des Trainings-Logs nicht verschwindet/zurückgesetzt wird).

let state = null; // { remaining, total, label, intervalId, paused }
let barEl = null;

function ensureBar() {
  if (barEl) return barEl;

  barEl = document.createElement("div");
  barEl.id = "rest-timer-bar";
  barEl.className = "rest-timer-bar hidden";
  barEl.innerHTML = `
    <div class="rt-info">
      <div class="rt-label" id="rt-label">Pause</div>
      <div class="rt-time" id="rt-time">00:00</div>
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

function adjust(delta) {
  if (!state) return;
  state.remaining = Math.max(0, state.remaining + delta);
  state.total = Math.max(state.total, state.remaining);
  if (state.remaining > 0 && !state.intervalId && !state.paused) {
    state.intervalId = setInterval(tick, 1000);
  }
  barEl.classList.remove("rt-finished");
  render();
}

function togglePause() {
  if (!state) return;
  state.paused = !state.paused;
  const btn = barEl.querySelector("#rt-pause");
  if (state.paused) {
    btn.textContent = "▶";
    clearInterval(state.intervalId);
    state.intervalId = null;
  } else {
    btn.textContent = "⏸";
    if (state.remaining > 0) state.intervalId = setInterval(tick, 1000);
  }
}

function render() {
  if (!state) return;
  const m = Math.floor(state.remaining / 60);
  const s = state.remaining % 60;
  barEl.querySelector("#rt-time").textContent = `${m}:${String(s).padStart(2, "0")}`;
  barEl.querySelector("#rt-label").textContent = state.label;
  const pct = state.total > 0 ? Math.min(100, (1 - state.remaining / state.total) * 100) : 100;
  barEl.querySelector("#rt-progress-fill").style.width = `${pct}%`;
}

function tick() {
  if (!state || state.paused) return;
  state.remaining -= 1;
  if (state.remaining <= 0) {
    state.remaining = 0;
    render();
    onFinished();
    return;
  }
  render();
}

function onFinished() {
  playBeep();
  vibrate();
  if (barEl) barEl.classList.add("rt-finished");
  if (state?.intervalId) clearInterval(state.intervalId);
  if (state) state.intervalId = null;
  setTimeout(() => {
    if (state && state.remaining === 0) stopTimer();
  }, 4000);
}

// Startet (oder ersetzt) die laufende Pause mit einer neuen Dauer in Sekunden
// und einem Label (z. B. Übungsname + Satznummer).
export function startRestTimer(seconds, label) {
  const el = ensureBar();
  if (state?.intervalId) clearInterval(state.intervalId);

  const total = Math.max(1, Math.round(seconds) || 60);
  state = { remaining: total, total, label: label || "Pause", paused: false, intervalId: null };

  el.classList.remove("hidden", "rt-finished");
  el.querySelector("#rt-pause").textContent = "⏸";
  render();
  state.intervalId = setInterval(tick, 1000);
}

function stopTimer() {
  if (state?.intervalId) clearInterval(state.intervalId);
  state = null;
  if (barEl) barEl.classList.add("hidden");
}

function vibrate() {
  if (navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // Vibration evtl. nicht erlaubt – kein Problem, Ton übernimmt
    }
  }
}

// Erzeugt zwei kurze Pieptöne per Web Audio API, ganz ohne externe Audiodatei
// (funktioniert damit auch offline / im installierten PWA-Cache).
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    beepTone(ctx, 880, 0, 0.5);
    beepTone(ctx, 1040, 0.55, 0.4);
  } catch {
    // Audio evtl. durch Autoplay-Policy blockiert – Vibration reicht als Fallback
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
