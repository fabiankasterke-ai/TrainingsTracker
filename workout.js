import { topBar, loadingSpinner, emptyState, escapeHtml, showErrorToast, formatRest } from "./ui.js";
import { startRestTimer } from "./timer.js";

const DEFAULT_REST_SECONDS = 60;

function todayStr() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0, 10);
}

function groupBySection(exercises) {
  const groups = [];
  const bySection = new Map();
  for (const ex of exercises) {
    const key = ex.section_name || "Hauptteil";
    if (!bySection.has(key)) {
      const g = { section: key, items: [] };
      bySection.set(key, g);
      groups.push(g);
    }
    bySection.get(key).items.push(ex);
  }
  return groups;
}

export async function renderLogView(root, ctx, helpers) {
  const { dayId, dayName } = ctx;
  root.innerHTML = topBar(dayName || "Training", "Wird geladen …", { showBack: true, showLogout: true }) + loadingSpinner();

  const { supabase } = helpers;

  const { data: exercises, error: exError } = await supabase
    .from("exercises")
    .select("*")
    .eq("training_day_id", dayId)
    .order("order_index", { ascending: true });

  if (exError) return showErrorToast(helpers, exError);

  if (!exercises || exercises.length === 0) {
    root.innerHTML =
      topBar(dayName || "Training", "Training", { showBack: true, showLogout: true }) +
      emptyState("🏋️", "Für diesen Trainingstag sind noch keine Übungen hinterlegt. Füge sie zuerst über 'Übungen bearbeiten' hinzu.");
    return;
  }

  const exerciseIds = exercises.map((e) => e.id);
  const { data: logs, error: logError } = await supabase
    .from("logs")
    .select("*")
    .in("exercise_id", exerciseIds)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (logError) return showErrorToast(helpers, logError);

  // letzten (aktuellsten) Wert je Übung + Satz ermitteln
  const lastMap = {}; // lastMap[exerciseId][setIndex] = {weight, reps}
  for (const log of logs || []) {
    if (!lastMap[log.exercise_id]) lastMap[log.exercise_id] = {};
    if (!lastMap[log.exercise_id][log.set_index]) {
      lastMap[log.exercise_id][log.set_index] = { weight: log.weight, reps: log.reps };
    }
  }

  const state = {
    date: todayStr(),
    extraSets: {}, // exerciseId -> Anzahl zusätzlicher Sätze über target_sets hinaus
    doneSets: new Set(), // "exId_setIdx" -> als erledigt markiert (für Pausen-Timer-Haken)
  };

  // hält bereits eingetippte (noch nicht gespeicherte) Werte beim Neuzeichnen (z.B. nach "+ Satz")
  const pendingInputs = {};

  function captureInputs() {
    root.querySelectorAll("[data-weight]").forEach((el) => {
      pendingInputs[`${el.dataset.ex}_${el.dataset.set}_weight`] = el.value;
    });
    root.querySelectorAll("[data-reps]").forEach((el) => {
      pendingInputs[`${el.dataset.ex}_${el.dataset.set}_reps`] = el.value;
    });
  }

  function getInputValue(exId, setIndex, field) {
    return pendingInputs[`${exId}_${setIndex}_${field}`] ?? "";
  }

  function setCountFor(ex) {
    return ex.target_sets + (state.extraSets[ex.id] || 0);
  }

  function draw() {
    const groups = groupBySection(exercises);

    const groupsHtml = groups
      .map(
        (g) => `
      <div class="section-pill">${escapeHtml(g.section)}</div>
      ${g.items
        .map((ex) => {
          const setCount = setCountFor(ex);
          const restSeconds = ex.rest_seconds ?? DEFAULT_REST_SECONDS;
          const rows = [];
          for (let s = 1; s <= setCount; s++) {
            const last = lastMap[ex.id]?.[s];
            const lastWeightText = last && last.weight !== null && last.weight !== undefined ? `zuletzt ${last.weight} kg` : "—";
            const lastRepsText = last && last.reps !== null && last.reps !== undefined ? `zuletzt ${last.reps}` : "—";
            const isDone = state.doneSets.has(`${ex.id}_${s}`);
            rows.push(`
              <div class="set-row">
                <div class="set-num">${s}</div>
                <div>
                  <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="kg"
                    data-weight data-ex="${ex.id}" data-set="${s}" value="${getInputValue(ex.id, s, "weight")}" />
                  <div class="last-value" data-hint-weight="${ex.id}-${s}">${lastWeightText}</div>
                </div>
                <div>
                  <input type="number" inputmode="numeric" step="1" min="0" placeholder="Wdh."
                    data-reps data-ex="${ex.id}" data-set="${s}" value="${getInputValue(ex.id, s, "reps")}" />
                  <div class="last-value" data-hint-reps="${ex.id}-${s}">${lastRepsText}</div>
                </div>
                <button type="button" class="check-btn${isDone ? " done" : ""}" data-check
                  data-ex="${ex.id}" data-set="${s}" data-rest="${restSeconds}"
                  data-exname="${escapeHtml(ex.name)}" aria-label="Satz ${s} erledigt, Pause starten">✓</button>
              </div>
            `);
          }
          return `
            <div class="exercise-block">
              <div class="exercise-name-row">
                <div>
                  <div class="exercise-name">${escapeHtml(ex.name)}</div>
                  <div class="exercise-target">Ziel: ${ex.target_sets} × ${escapeHtml(ex.target_reps)} · Pause ${formatRest(restSeconds)}${ex.notes ? " · " + escapeHtml(ex.notes) : ""}</div>
                </div>
                <button class="btn-ghost btn-sm" data-history="${ex.id}" data-history-name="${escapeHtml(ex.name)}">📈 Verlauf</button>
              </div>
              <div class="col-labels"><div></div><div>Gewicht (kg)</div><div>Wdh.</div><div></div></div>
              ${rows.join("")}
              <button class="btn btn-secondary btn-sm" data-add-set="${ex.id}">+ Satz</button>
            </div>
          `;
        })
        .join("")}
    `
      )
      .join("");

    root.innerHTML =
      topBar(dayName || "Training", "Heutiges Training", { showBack: true, showLogout: true }) +
      `
      <div class="field">
        <label>Datum</label>
        <input type="date" id="workout-date" value="${state.date}" />
      </div>
      ${groupsHtml}
      <div class="spacer"></div>
      <button class="btn btn-primary" id="save-workout">💾 Training speichern</button>
      <p class="muted" style="text-align:center;font-size:11.5px;margin-top:10px;">Jeder Satz wird automatisch gespeichert, sobald du das Feld verlässt. Tippe auf ✓, um die Pause zu starten.</p>
      <div class="spacer"></div>
    `;

    document.getElementById("workout-date").addEventListener("change", (e) => {
      state.date = e.target.value;
    });

    root.querySelectorAll("[data-add-set]").forEach((btn) =>
      btn.addEventListener("click", () => {
        captureInputs();
        state.extraSets[btn.dataset.addSet] = (state.extraSets[btn.dataset.addSet] || 0) + 1;
        draw();
      })
    );

    root.querySelectorAll("[data-history]").forEach((btn) =>
      btn.addEventListener("click", () => {
        captureInputs();
        helpers.push({
          name: "exerciseHistory",
          params: { exerciseId: btn.dataset.history, exerciseName: btn.dataset.historyName },
        });
      })
    );

    // Pausen-Timer: Haken hinter einem Satz antippen -> Satz als erledigt markieren
    // und sofort den Timer mit der für die Übung hinterlegten Pausenzeit starten.
    root.querySelectorAll("[data-check]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const key = `${btn.dataset.ex}_${btn.dataset.set}`;
        const nowDone = !state.doneSets.has(key);
        if (nowDone) {
          state.doneSets.add(key);
          btn.classList.add("done");
          const rest = parseInt(btn.dataset.rest, 10) || DEFAULT_REST_SECONDS;
          startRestTimer(rest, `${btn.dataset.exname} · Satz ${btn.dataset.set}`);
        } else {
          state.doneSets.delete(key);
          btn.classList.remove("done");
        }
      })
    );

    // Auto-Save: sobald ein Gewicht- oder Wdh.-Feld verlassen wird, wird genau
    // dieser Satz sofort gespeichert (Upsert) – so gehen bei einem 2h-Training
    // keine Daten verloren, falls die App zwischendurch geschlossen wird.
    root.querySelectorAll(".set-row").forEach((row) => attachAutoSave(row));

    document.getElementById("save-workout").addEventListener("click", saveWorkout);
  }

  function attachAutoSave(row) {
    const weightEl = row.querySelector("[data-weight]");
    const repsEl = row.querySelector("[data-reps]");

    const saveRow = async () => {
      const weight = weightEl.value === "" ? null : parseFloat(weightEl.value);
      const reps = repsEl.value === "" ? null : parseInt(repsEl.value, 10);
      if (weight === null && reps === null) return; // noch nichts einzutragen

      const exId = weightEl.dataset.ex;
      const setIdx = parseInt(weightEl.dataset.set, 10);

      const { error } = await supabase
        .from("logs")
        .upsert([{ exercise_id: exId, workout_date: state.date, set_index: setIdx, weight, reps }], {
          onConflict: "exercise_id,workout_date,set_index",
        });

      if (!error) flashSaved(exId, setIdx);
    };

    weightEl.addEventListener("blur", saveRow);
    repsEl.addEventListener("blur", saveRow);
  }

  function flashSaved(exId, setIdx) {
    const wHint = root.querySelector(`[data-hint-weight="${exId}-${setIdx}"]`);
    const rHint = root.querySelector(`[data-hint-reps="${exId}-${setIdx}"]`);
    [wHint, rHint].forEach((el) => {
      if (!el) return;
      const original = el.dataset.original ?? el.textContent;
      el.dataset.original = original;
      el.textContent = "✓ gespeichert";
      el.style.color = "var(--success)";
      clearTimeout(el._flashTimer);
      el._flashTimer = setTimeout(() => {
        el.textContent = el.dataset.original;
        el.style.color = "";
      }, 1600);
    });
  }

  async function saveWorkout() {
    const payload = [];
    root.querySelectorAll(".set-row").forEach((row) => {
      const weightEl = row.querySelector("[data-weight]");
      const repsEl = row.querySelector("[data-reps]");
      const weight = weightEl.value === "" ? null : parseFloat(weightEl.value);
      const reps = repsEl.value === "" ? null : parseInt(repsEl.value, 10);
      if (weight === null && reps === null) return; // leere Sätze überspringen

      payload.push({
        exercise_id: weightEl.dataset.ex,
        workout_date: state.date,
        set_index: parseInt(weightEl.dataset.set, 10),
        weight,
        reps,
      });
    });

    if (payload.length === 0) {
      helpers.toast("Bitte trage mindestens einen Wert ein");
      return;
    }

    const saveBtn = document.getElementById("save-workout");
    saveBtn.disabled = true;
    saveBtn.textContent = "Speichert …";

    const { error } = await supabase
      .from("logs")
      .upsert(payload, { onConflict: "exercise_id,workout_date,set_index" });

    if (error) {
      showErrorToast(helpers, error);
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Training speichern";
      return;
    }

    helpers.toast("💪 Training gespeichert!");
    renderLogView(root, ctx, helpers);
  }

  draw();
}
