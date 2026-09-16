import { topBar, escapeHtml, showErrorToast } from "./ui.js";

// ============================================================================
// PLAN-IMPORT: liest eine JSON-Datei (oder eingefügten JSON-Text) ein und legt
// daraus einen kompletten neuen Trainingsplan (inkl. Block, Trainingstagen und
// Übungen) direkt im Profil des eingeloggten Nutzers an.
//
// Erwartetes JSON-Format:
// {
//   "planName": "Mein Trainingsplan",
//   "blockName": "Block 1",              // optional, Default "Block 1"
//   "blockNotes": "...",                  // optional
//   "days": [
//     {
//       "name": "Tag 1 – ...",
//       "exercises": [
//         {
//           "section_name": "Rücken",     // optional, Default "Hauptteil"
//           "name": "Übungsname",
//           "target_sets": 4,              // optional, Default 3
//           "target_reps": "8-12",         // optional, Default "8-12"
//           "notes": "z. B. Dropset am Ende", // optional
//           "rest_seconds": 60             // optional, Default 60 (für den Pausen-Timer)
//         }
//       ]
//     }
//   ]
// }
// ============================================================================

export function renderImportView(root, params, helpers) {
  root.innerHTML =
    topBar("Plan importieren", "JSON-Datei einlesen oder einfügen", { showBack: true, showLogout: true }) +
    `
    <div class="card">
      <div class="field">
        <label>JSON-Datei auswählen</label>
        <input type="file" id="import-file" accept=".json,application/json" />
      </div>
      <div class="field">
        <label>…oder JSON-Text einfügen</label>
        <textarea id="import-json" rows="10" placeholder='{"planName": "...", "days": [...]}' style="font-family:ui-monospace,monospace;font-size:12.5px;"></textarea>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:14px;">
        <input type="checkbox" id="import-activate" checked style="width:auto;" />
        Direkt als aktiven Plan auf der Startseite setzen
      </label>
      <div id="import-preview" class="muted" style="font-size:13px;margin-bottom:10px;min-height:16px;"></div>
      <button class="btn btn-primary" id="import-btn">⬆️ Plan importieren</button>
    </div>
    <p class="muted" style="font-size:12px;text-align:center;margin-top:10px;">Der Import legt einen komplett neuen Plan mit Block, Trainingstagen und Übungen an. Bestehende Pläne bleiben unangetastet.</p>
  `;

  const fileInput = document.getElementById("import-file");
  const textArea = document.getElementById("import-json");
  const preview = document.getElementById("import-preview");
  const importBtn = document.getElementById("import-btn");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      textArea.value = await file.text();
    } catch (err) {
      helpers.toast("⚠️ Datei konnte nicht gelesen werden");
    }
    updatePreview();
  });

  textArea.addEventListener("input", updatePreview);

  function updatePreview() {
    const text = textArea.value.trim();
    if (!text) {
      preview.textContent = "";
      return;
    }
    const parsed = tryParse(text);
    if (!parsed.ok) {
      preview.textContent = "⚠️ " + parsed.error;
      preview.style.color = "var(--danger)";
      return;
    }
    const dayCount = parsed.data.days.length;
    const exCount = parsed.data.days.reduce((sum, d) => sum + (d.exercises?.length || 0), 0);
    preview.textContent = `✓ „${parsed.data.planName}“ · ${dayCount} Trainingstag(e) · ${exCount} Übung(en)`;
    preview.style.color = "var(--success)";
  }

  importBtn.addEventListener("click", async () => {
    const parsed = tryParse(textArea.value.trim());
    if (!parsed.ok) {
      helpers.toast("⚠️ " + parsed.error);
      return;
    }

    const data = parsed.data;
    if (!confirm(`Plan „${data.planName}“ mit ${data.days.length} Trainingstagen jetzt importieren?`)) return;

    importBtn.disabled = true;
    importBtn.textContent = "Importiert …";

    try {
      await performImport(helpers.supabase, data, document.getElementById("import-activate").checked);
      helpers.toast(`✅ „${data.planName}“ importiert`);
      helpers.back();
    } catch (err) {
      showErrorToast(helpers, err);
      importBtn.disabled = false;
      importBtn.textContent = "⬆️ Plan importieren";
    }
  });
}

function tryParse(text) {
  if (!text) return { ok: false, error: "Bitte JSON-Datei wählen oder Text einfügen" };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Kein gültiges JSON" };
  }
  if (!data.planName || typeof data.planName !== "string") {
    return { ok: false, error: "Feld „planName“ fehlt" };
  }
  if (!Array.isArray(data.days) || data.days.length === 0) {
    return { ok: false, error: "Feld „days“ fehlt oder ist leer" };
  }
  for (const day of data.days) {
    if (!day.name || typeof day.name !== "string") {
      return { ok: false, error: "Jeder Trainingstag braucht einen „name“" };
    }
    if (day.exercises && !Array.isArray(day.exercises)) {
      return { ok: false, error: `„exercises“ bei Tag „${escapeHtml(day.name)}“ muss eine Liste sein` };
    }
    for (const ex of day.exercises || []) {
      if (!ex.name || typeof ex.name !== "string") {
        return { ok: false, error: `Eine Übung bei Tag „${escapeHtml(day.name)}“ hat keinen „name“` };
      }
    }
  }
  return { ok: true, data };
}

async function performImport(supabase, data, makeActive) {
  if (makeActive) {
    const { error: eDeact } = await supabase.from("plans").update({ is_active: false });
    if (eDeact) throw eDeact;
  }

  const { data: planRow, error: ePlan } = await supabase
    .from("plans")
    .insert({ name: data.planName, is_active: !!makeActive })
    .select()
    .single();
  if (ePlan) throw ePlan;

  const { data: blockRow, error: eBlock } = await supabase
    .from("blocks")
    .insert({ plan_id: planRow.id, name: data.blockName || "Block 1", notes: data.blockNotes || null, order_index: 0 })
    .select()
    .single();
  if (eBlock) throw eBlock;

  for (let i = 0; i < data.days.length; i++) {
    const day = data.days[i];

    const { data: dayRow, error: eDay } = await supabase
      .from("training_days")
      .insert({ block_id: blockRow.id, name: day.name, order_index: i })
      .select()
      .single();
    if (eDay) throw eDay;

    const exercisesPayload = (day.exercises || []).map((ex, idx) => ({
      training_day_id: dayRow.id,
      section_name: ex.section_name || "Hauptteil",
      name: ex.name,
      target_sets: ex.target_sets ?? 3,
      target_reps: ex.target_reps || "8-12",
      rest_seconds: ex.rest_seconds ?? 60,
      notes: ex.notes || null,
      order_index: idx,
    }));

    if (exercisesPayload.length) {
      const { error: eEx } = await supabase.from("exercises").insert(exercisesPayload);
      if (eEx) throw eEx;
    }
  }

  return planRow;
}
