import { supabase, isConfigured } from "./supabaseClient.js";

export function renderAuthScreen(root, helpers, mode = "login") {
  const isLogin = mode === "login";

  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">🏋️</div>
      <div class="auth-title">TrainingsTracker</div>
      <div class="auth-subtitle">${isLogin ? "Melde dich an, um deinen Trainingsplan zu sehen" : "Erstelle einen Account für deinen eigenen Trainingsplan"}</div>

      ${!isConfigured ? `
        <div class="card" style="border-color:#ef4444;margin-bottom:16px;">
          <strong>⚠️ Noch nicht eingerichtet</strong>
          <p class="muted" style="margin-top:6px;font-size:13px;">
            Trage deine Supabase-Zugangsdaten in <code>js/config.js</code> ein
            (siehe README.md), bevor du dich anmelden kannst.
          </p>
        </div>
      ` : ""}

      <form id="auth-form">
        ${!isLogin ? `
          <div class="field">
            <label for="display-name">Dein Name</label>
            <input id="display-name" type="text" autocomplete="name" placeholder="z.B. Fabian" required />
          </div>
        ` : ""}
        <div class="field">
          <label for="email">E-Mail</label>
          <input id="email" type="email" autocomplete="email" placeholder="du@beispiel.de" required />
        </div>
        <div class="field">
          <label for="password">Passwort</label>
          <input id="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="Mindestens 6 Zeichen" minlength="6" required />
        </div>
        <button type="submit" class="btn btn-primary" id="auth-submit">
          ${isLogin ? "Anmelden" : "Account erstellen"}
        </button>
        <div class="error-msg" id="auth-error"></div>
      </form>

      <div class="auth-switch">
        ${isLogin ? `Noch keinen Account? <a href="#" id="switch-mode">Registrieren</a>` : `Schon einen Account? <a href="#" id="switch-mode">Anmelden</a>`}
      </div>
    </div>
  `;

  root.querySelector("#switch-mode").addEventListener("click", (e) => {
    e.preventDefault();
    renderAuthScreen(root, helpers, isLogin ? "signup" : "login");
  });

  root.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = root.querySelector("#auth-error");
    const submitBtn = root.querySelector("#auth-submit");
    errorEl.textContent = "";

    const email = root.querySelector("#email").value.trim();
    const password = root.querySelector("#password").value;

    if (!isConfigured) {
      errorEl.textContent = "Bitte zuerst Supabase in js/config.js konfigurieren.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Bitte warten …";

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const displayName = root.querySelector("#display-name").value.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
      }
      await helpers.onAuthSuccess();
    } catch (err) {
      errorEl.textContent = translateAuthError(err);
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? "Anmelden" : "Account erstellen";
    }
  });
}

function translateAuthError(err) {
  const msg = err?.message || "Unbekannter Fehler";
  if (msg.includes("Invalid login credentials")) return "E-Mail oder Passwort ist falsch.";
  if (msg.includes("User already registered")) return "Für diese E-Mail existiert bereits ein Account.";
  if (msg.includes("Password should be at least")) return "Das Passwort muss mindestens 6 Zeichen haben.";
  if (msg.includes("Email not confirmed")) return "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Mail, die du erhalten hast).";
  return msg;
}

export async function signOut() {
  await supabase.auth.signOut();
}
