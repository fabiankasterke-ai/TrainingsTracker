// Einfacher Service Worker: cached nur die statische App-Hülle (HTML/CSS/JS/Icons),
// damit die App installierbar ist und schnell startet. Supabase-Anfragen (Login,
// Datenbank) laufen immer live über das Netzwerk.

const CACHE_NAME = "trainingstracker-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/supabaseClient.js",
  "./js/auth.js",
  "./js/plan.js",
  "./js/workout.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Niemals API-/Supabase-Aufrufe cachen – die müssen immer live sein.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("./index.html"));
    })
  );
});
