// Display-Wachhalter (Screen Wake Lock API): verhindert, dass sich das Handy
// während des Trainings automatisch sperrt. Ist das Display gesperrt, friert
// iOS/Android die Web-App ein – deshalb ist "gar nicht erst sperren lassen"
// der zuverlässigste Weg, damit Timer, Ton und Popup pünktlich kommen.
//
// Unterstützt von Safari/iOS ab 16.4 (als Homescreen-App ab iOS 18.4
// zuverlässig) und Chrome/Android. Wo es fehlt, passiert einfach nichts.

const PREF_KEY = "tt_keep_awake";
let sentinel = null;
let wanted = false;

export const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

export function getKeepAwakePref() {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === null ? true : v === "1"; // Standard: an
  } catch {
    return true;
  }
}

export function setKeepAwakePref(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* privater Modus o. ä. – egal */
  }
}

async function acquire() {
  if (!wakeLockSupported || !wanted || sentinel || document.visibilityState !== "visible") return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    sentinel = null; // z. B. Energiesparmodus aktiv – kein Problem
  }
}

async function release() {
  const s = sentinel;
  sentinel = null;
  try {
    await s?.release();
  } catch {
    /* schon freigegeben */
  }
}

// true = Display wachhalten, false = normal sperren lassen
export function keepAwake(on) {
  wanted = !!on;
  if (wanted) acquire();
  else release();
}

// Das System gibt den Lock beim Wechsel in den Hintergrund automatisch frei –
// sobald die App wieder sichtbar ist, holen wir ihn uns zurück.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wanted) acquire();
});

// Manche Browser verlangen eine Nutzer-Geste für den ersten Request:
// beim nächsten Tippen irgendwo einfach nochmal versuchen.
document.addEventListener(
  "pointerdown",
  () => {
    if (wanted && !sentinel) acquire();
  },
  { passive: true }
);
