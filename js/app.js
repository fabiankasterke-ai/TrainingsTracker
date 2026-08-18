import { supabase, isConfigured } from "./supabaseClient.js";
import { renderAuthScreen, signOut } from "./auth.js";
import { renderPlansView, renderBlocksView, renderDaysView, renderExercisesEditView } from "./plan.js";
import { renderLogView } from "./workout.js";

const appRoot = document.getElementById("app");

let viewStack = [{ name: "auth", params: { mode: "login" } }];
let currentUser = null;

const registry = {
  auth: (root, params) => renderAuthScreen(root, helpers, params?.mode || "login"),
  plans: (root, params) => renderPlansView(root, params, helpers),
  blocks: (root, params) => renderBlocksView(root, params, helpers),
  days: (root, params) => renderDaysView(root, params, helpers),
  exercisesEdit: (root, params) => renderExercisesEditView(root, params, helpers),
  log: (root, params) => renderLogView(root, params, helpers),
};

const helpers = {
  supabase,
  push(view) {
    viewStack.push(view);
    render();
  },
  back() {
    if (viewStack.length > 1) {
      viewStack.pop();
      render();
    }
  },
  home() {
    viewStack = [{ name: "plans" }];
    render();
  },
  toast(msg) {
    showToast(msg);
  },
  getUser: () => currentUser,
  onAuthSuccess: initAfterAuth,
};

function render() {
  const view = viewStack[viewStack.length - 1];
  const fn = registry[view.name];
  if (!fn) {
    console.error("Unbekannte View:", view.name);
    return;
  }
  fn(appRoot, view.params || {});
  // globale Aktionen (Zurück/Abmelden) nach jedem Render neu verdrahten,
  // da innerHTML komplett ersetzt wird. Kleiner Timeout, damit die View
  // ihr eigenes innerHTML zuerst gesetzt hat (render-Funktionen sind teils async).
  setTimeout(wireGlobalActions, 0);
}

function wireGlobalActions() {
  appRoot.querySelectorAll("[data-nav-back]").forEach((el) => {
    el.onclick = () => helpers.back();
  });
  appRoot.querySelectorAll("[data-nav-logout]").forEach((el) => {
    el.onclick = async () => {
      if (confirm("Wirklich abmelden?")) {
        await signOut();
      }
    };
  });
}

// Da renderXView-Funktionen asynchron nachladen (erst Spinner, dann Daten),
// verdrahten wir globale Aktionen bei jeder DOM-Änderung neu.
const observer = new MutationObserver(() => wireGlobalActions());
observer.observe(appRoot, { childList: true, subtree: false });

async function initAfterAuth() {
  const { data } = await supabase.auth.getUser();
  currentUser = data.user;
  viewStack = [{ name: "plans" }];
  render();
}

function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2000);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ms)),
  ]);
}

async function boot() {
  // Wenn Supabase noch nicht konfiguriert ist (siehe js/config.js), erst gar
  // keinen Netzwerk-Aufruf versuchen -> direkt den Hinweis-Screen zeigen.
  if (!isConfigured) {
    viewStack = [{ name: "auth", params: { mode: "login" } }];
    render();
    return;
  }

  try {
    const result = await withTimeout(supabase.auth.getSession(), 8000);
    currentUser = result?.timedOut ? null : result?.data?.session?.user || null;
  } catch (err) {
    console.error("Fehler beim Laden der Session:", err);
    currentUser = null;
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      viewStack = [{ name: "auth", params: { mode: "login" } }];
      render();
    }
  });

  viewStack = currentUser ? [{ name: "plans" }] : [{ name: "auth", params: { mode: "login" } }];
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

boot();
