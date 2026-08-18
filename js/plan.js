import { topBar, loadingSpinner, emptyState, escapeHtml, showErrorToast } from "./ui.js";

const MAX_TRAINING_DAYS = 7;

// ============================================================================
// PLÄNE
// ============================================================================
export async function renderPlansView(root, params, helpers) {
  root.innerHTML = topBar("Meine Trainingspläne", "", { showLogout: true }) + loadingSpinner();

  const { supabase } = helpers;
  const { data: plans, error } = await supabase
    .from("plans")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) return showErrorToast(helpers, error);

  drawPlans(root, plans || [], helpers);
}

function drawPlans(root, plans, helpers) {
  const { supabase } = helpers;

  const listHtml = plans.length
    ? plans
        .map(
          (p, i) => `
      <div class="list-item">
        <div class="grow card-tap" data-open="${p.id}" style="cursor:pointer;">
          <div>
            <div class="card-title">${escapeHtml(p.name)}</div>
            <div class="card-meta">Trainingsblöcke ansehen</div>
          </div>
          <div class="chevron">›</div>
        </div>
        <div class="reorder-btns">
          <button data-up="${p.id}" ${i === 0 ? "disabled" : ""}>▲</button>
          <button data-down="${p.id}" ${i === plans.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <button class="icon-btn" data-rename="${p.id}" data-name="${escapeHtml(p.name)}">✎</button>
        <button class="icon-btn" data-delete="${p.id}">🗑</button>
      </div>`
        )
        .join("")
    : emptyState("📋", "Noch kein Trainingsplan angelegt. Leg deinen ersten Plan an!");

  root.innerHTML =
    topBar("Meine Trainingspläne", "", { showLogout: true }) +
    `<div id="plans-list">${listHtml}</div>
     <div class="spacer"></div>
     <button class="btn btn-primary" id="add-plan">+ Neuer Trainingsplan</button>`;

  root.querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => {
      const plan = plans.find((p) => p.id === el.dataset.open);
      helpers.push({ name: "blocks", params: { planId: plan.id, planName: plan.name } });
    })
  );

  root.querySelectorAll("[data-up]").forEach((el) =>
    el.addEventListener("click", () => reorder(plans, el.dataset.up, -1, "plans", helpers, () => renderPlansView(root, {}, helpers)))
  );
  root.querySelectorAll("[data-down]").forEach((el) =>
    el.addEventListener("click", () => reorder(plans, el.dataset.down, 1, "plans", helpers, () => renderPlansView(root, {}, helpers)))
  );

  root.querySelectorAll("[data-rename]").forEach((el) =>
    el.addEventListener("click", async () => {
      const newName = prompt("Name des Trainingsplans:", el.dataset.name);
      if (!newName || !newName.trim()) return;
      const { error } = await supabase.from("plans").update({ name: newName.trim() }).eq("id", el.dataset.rename);
      if (error) return showErrorToast(helpers, error);
      renderPlansView(root, {}, helpers);
    })
  );

  root.querySelectorAll("[data-delete]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm("Plan inkl. aller Blöcke, Trainingstage und Übungen wirklich löschen?")) return;
      const { error } = await supabase.from("plans").delete().eq("id", el.dataset.delete);
      if (error) return showErrorToast(helpers, error);
      helpers.toast("Plan gelöscht");
      renderPlansView(root, {}, helpers);
    })
  );

  document.getElementById("add-plan").addEventListener("click", async () => {
    const name = prompt("Name des neuen Trainingsplans:", "Mein Trainingsplan");
    if (!name || !name.trim()) return;
    const { error } = await supabase.from("plans").insert({ name: name.trim(), order_index: plans.length });
    if (error) return showErrorToast(helpers, error);
    renderPlansView(root, {}, helpers);
  });
}

// ============================================================================
// TRAININGSBLÖCKE (Mesozyklen)
// ============================================================================
export async function renderBlocksView(root, { planId, planName }, helpers) {
  root.innerHTML = topBar(planName || "Plan", "Trainingsblöcke", { showBack: true, showLogout: true }) + loadingSpinner();

  const { supabase } = helpers;
  const { data: blocks, error } = await supabase
    .from("blocks")
    .select("*")
    .eq("plan_id", planId)
    .order("order_index", { ascending: true });

  if (error) return showErrorToast(helpers, error);

  drawBlocks(root, blocks || [], { planId, planName }, helpers);
}

function drawBlocks(root, blocks, { planId, planName }, helpers) {
  const { supabase } = helpers;

  const listHtml = blocks.length
    ? blocks
        .map(
          (b, i) => `
      <div class="list-item">
        <div class="grow card-tap" data-open="${b.id}" style="cursor:pointer;">
          <div>
            <div class="card-title">${escapeHtml(b.name)}</div>
            ${b.notes ? `<div class="card-meta">${escapeHtml(b.notes)}</div>` : `<div class="card-meta">Trainingstage ansehen</div>`}
          </div>
          <div class="chevron">›</div>
        </div>
        <div class="reorder-btns">
          <button data-up="${b.id}" ${i === 0 ? "disabled" : ""}>▲</button>
          <button data-down="${b.id}" ${i === blocks.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <button class="icon-btn" data-rename="${b.id}" data-name="${escapeHtml(b.name)}">✎</button>
        <button class="icon-btn" data-delete="${b.id}">🗑</button>
      </div>`
        )
        .join("")
    : emptyState("📦", "Noch kein Trainingsblock in diesem Plan. Ein Block ist z. B. eine 4-wöchige Trainingsphase.");

  root.innerHTML =
    topBar(planName || "Plan", "Trainingsblöcke", { showBack: true, showLogout: true }) +
    `<div id="blocks-list">${listHtml}</div>
     <div class="spacer"></div>
     <button class="btn btn-primary" id="add-block">+ Neuer Trainingsblock</button>`;

  root.querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => {
      const block = blocks.find((b) => b.id === el.dataset.open);
      helpers.push({ name: "days", params: { blockId: block.id, blockName: block.name, planId, planName } });
    })
  );

  root.querySelectorAll("[data-up]").forEach((el) =>
    el.addEventListener("click", () => reorder(blocks, el.dataset.up, -1, "blocks", helpers, () => renderBlocksView(root, { planId, planName }, helpers)))
  );
  root.querySelectorAll("[data-down]").forEach((el) =>
    el.addEventListener("click", () => reorder(blocks, el.dataset.down, 1, "blocks", helpers, () => renderBlocksView(root, { planId, planName }, helpers)))
  );

  root.querySelectorAll("[data-rename]").forEach((el) =>
    el.addEventListener("click", async () => {
      const newName = prompt("Name des Trainingsblocks:", el.dataset.name);
      if (!newName || !newName.trim()) return;
      const { error } = await supabase.from("blocks").update({ name: newName.trim() }).eq("id", el.dataset.rename);
      if (error) return showErrorToast(helpers, error);
      renderBlocksView(root, { planId, planName }, helpers);
    })
  );

  root.querySelectorAll("[data-delete]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm("Block inkl. aller Trainingstage und Übungen wirklich löschen?")) return;
      const { error } = await supabase.from("blocks").delete().eq("id", el.dataset.delete);
      if (error) return showErrorToast(helpers, error);
      helpers.toast("Block gelöscht");
      renderBlocksView(root, { planId, planName }, helpers);
    })
  );

  document.getElementById("add-block").addEventListener("click", async () => {
    const name = prompt("Name des neuen Blocks (z. B. 'Block 1 – Kraftaufbau'):", `Block ${blocks.length + 1}`);
    if (!name || !name.trim()) return;
    const { error } = await supabase.from("blocks").insert({ plan_id: planId, name: name.trim(), order_index: blocks.length });
    if (error) return showErrorToast(helpers, error);
    renderBlocksView(root, { planId, planName }, helpers);
  });
}

// ============================================================================
// TRAININGSTAGE (1–7 pro Block)
// ============================================================================
export async function renderDaysView(root, { blockId, blockName, planId, planName }, helpers) {
  root.innerHTML = topBar(blockName || "Block", "Trainingstage", { showBack: true, showLogout: true }) + loadingSpinner();

  const { supabase } = helpers;
  const { data: days, error } = await supabase
    .from("training_days")
    .select("*")
    .eq("block_id", blockId)
    .order("order_index", { ascending: true });

  if (error) return showErrorToast(helpers, error);

  drawDays(root, days || [], { blockId, blockName, planId, planName }, helpers);
}

function drawDays(root, days, ctx, helpers) {
  const { supabase } = helpers;
  const { blockId, blockName, planId, planName } = ctx;

  const listHtml = days.length
    ? days
        .map(
          (d, i) => `
      <div class="list-item">
        <div class="grow card-tap" data-train="${d.id}" style="cursor:pointer;">
          <div>
            <div class="card-title">${escapeHtml(d.name)}</div>
            <div class="card-meta">Antippen zum Trainieren</div>
          </div>
          <div class="chevron">▶</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin:-4px 0 10px 4px;">
        <button class="icon-btn" data-edit="${d.id}" data-name="${escapeHtml(d.name)}" style="font-size:12px;">✎ Übungen bearbeiten</button>
        <div class="reorder-btns">
          <button data-up="${d.id}" ${i === 0 ? "disabled" : ""}>▲</button>
          <button data-down="${d.id}" ${i === days.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <button class="icon-btn" data-rename="${d.id}" data-name="${escapeHtml(d.name)}">✎</button>
        <button class="icon-btn" data-delete="${d.id}">🗑</button>
      </div>`
        )
        .join("")
    : emptyState("🗓️", "Noch kein Trainingstag in diesem Block.");

  const canAdd = days.length < MAX_TRAINING_DAYS;

  root.innerHTML =
    topBar(blockName || "Block", `Trainingstage (${days.length}/${MAX_TRAINING_DAYS})`, { showBack: true, showLogout: true }) +
    `<div id="days-list">${listHtml}</div>
     <div class="spacer"></div>
     <button class="btn btn-primary" id="add-day" ${canAdd ? "" : "disabled"}>+ Neuer Trainingstag</button>
     ${!canAdd ? `<p class="muted" style="text-align:center;font-size:12px;margin-top:8px;">Maximal ${MAX_TRAINING_DAYS} Trainingstage pro Block</p>` : ""}`;

  root.querySelectorAll("[data-train]").forEach((el) =>
    el.addEventListener("click", () => {
      const day = days.find((d) => d.id === el.dataset.train);
      helpers.push({ name: "log", params: { dayId: day.id, dayName: day.name, blockId, blockName, planId, planName } });
    })
  );

  root.querySelectorAll("[data-edit]").forEach((el) =>
    el.addEventListener("click", () => {
      helpers.push({
        name: "exercisesEdit",
        params: { dayId: el.dataset.edit, dayName: el.dataset.name, blockId, blockName, planId, planName },
      });
    })
  );

  root.querySelectorAll("[data-up]").forEach((el) =>
    el.addEventListener("click", () => reorder(days, el.dataset.up, -1, "training_days", helpers, () => renderDaysView(root, ctx, helpers)))
  );
  root.querySelectorAll("[data-down]").forEach((el) =>
    el.addEventListener("click", () => reorder(days, el.dataset.down, 1, "training_days", helpers, () => renderDaysView(root, ctx, helpers)))
  );

  root.querySelectorAll("[data-rename]").forEach((el) =>
    el.addEventListener("click", async () => {
      const newName = prompt("Name des Trainingstages:", el.dataset.name);
      if (!newName || !newName.trim()) return;
      const { error } = await supabase.from("training_days").update({ name: newName.trim() }).eq("id", el.dataset.rename);
      if (error) return showErrorToast(helpers, error);
      renderDaysView(root, ctx, helpers);
    })
  );

  root.querySelectorAll("[data-delete]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm("Trainingstag inkl. aller Übungen und gespeicherten Werte wirklich löschen?")) return;
      const { error } = await supabase.from("training_days").delete().eq("id", el.dataset.delete);
      if (error) return showErrorToast(helpers, error);
      helpers.toast("Trainingstag gelöscht");
      renderDaysView(root, ctx, helpers);
    })
  );

  document.getElementById("add-day")?.addEventListener("click", async () => {
    if (!canAdd) return;
    const name = prompt("Name des neuen Trainingstages (z. B. 'Tag 1 – Push'):", `Tag ${days.length + 1}`);
    if (!name || !name.trim()) return;
    const { error } = await supabase.from("training_days").insert({ block_id: blockId, name: name.trim(), order_index: days.length });
    if (error) return showErrorToast(helpers, error);
    renderDaysView(root, ctx, helpers);
  });
}

// ============================================================================
// ÜBUNGEN BEARBEITEN (pro Trainingstag, gruppiert nach Abschnitt)
// ============================================================================
export async function renderExercisesEditView(root, ctx, helpers) {
  const { dayId, dayName } = ctx;
  root.innerHTML = topBar(dayName || "Trainingstag", "Übungen bearbeiten", { showBack: true, showLogout: true }) + loadingSpinner();

  const { supabase } = helpers;
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("training_day_id", dayId)
    .order("order_index", { ascending: true });

  if (error) return showErrorToast(helpers, error);

  drawExercisesEdit(root, exercises || [], ctx, helpers, null);
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

function drawExercisesEdit(root, exercises, ctx, helpers, editingExercise) {
  const { supabase } = helpers;
  const { dayId, dayName } = ctx;
  const groups = groupBySection(exercises);
  const knownSections = [...new Set(exercises.map((e) => e.section_name || "Hauptteil"))];

  const groupsHtml = groups.length
    ? groups
        .map(
          (g) => `
      <div class="section-pill">${escapeHtml(g.section)}</div>
      ${g.items
        .map(
          (ex) => `
        <div class="list-item">
          <div class="grow">
            <div class="card-title">${escapeHtml(ex.name)}</div>
            <div class="card-meta">${ex.target_sets} × ${escapeHtml(ex.target_reps)}${ex.notes ? " · " + escapeHtml(ex.notes) : ""}</div>
          </div>
          <button class="icon-btn" data-edit-ex="${ex.id}">✎</button>
          <button class="icon-btn" data-delete-ex="${ex.id}">🗑</button>
        </div>`
        )
        .join("")}`
        )
        .join("")
    : emptyState("💪", "Noch keine Übungen für diesen Trainingstag. Füge deine erste Übung hinzu!");

  const formVisible = editingExercise !== null;
  const ex = editingExercise && editingExercise !== "new" ? exercises.find((e) => e.id === editingExercise) : null;

  const formHtml = formVisible
    ? `
    <div class="card" id="exercise-form">
      <h3 style="margin-bottom:12px;">${ex ? "Übung bearbeiten" : "Neue Übung"}</h3>
      <div class="field">
        <label>Abschnitt</label>
        <input list="section-options" id="f-section" value="${escapeHtml(ex?.section_name || knownSections[knownSections.length - 1] || "Hauptteil")}" />
        <datalist id="section-options">
          ${knownSections.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("")}
        </datalist>
      </div>
      <div class="field">
        <label>Übungsname</label>
        <input id="f-name" value="${escapeHtml(ex?.name || "")}" placeholder="z. B. Bankdrücken" />
      </div>
      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;">
          <label>Sätze</label>
          <input id="f-sets" type="number" min="1" max="20" value="${ex?.target_sets ?? 3}" />
        </div>
        <div class="field" style="flex:1;">
          <label>Wiederholungen</label>
          <input id="f-reps" value="${escapeHtml(ex?.target_reps ?? "8-12")}" placeholder="z. B. 8-12" />
        </div>
      </div>
      <div class="field">
        <label>Notizen (optional)</label>
        <textarea id="f-notes" placeholder="z. B. Ausführungshinweise, Pausenzeit">${escapeHtml(ex?.notes || "")}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" id="cancel-ex">Abbrechen</button>
        <button class="btn btn-primary" id="save-ex">Speichern</button>
      </div>
    </div>
  `
    : "";

  root.innerHTML =
    topBar(dayName || "Trainingstag", "Übungen bearbeiten", { showBack: true, showLogout: true }) +
    `<div id="ex-list">${groupsHtml}</div>
     <div class="spacer"></div>
     ${!formVisible ? `<button class="btn btn-primary" id="add-ex">+ Neue Übung</button>` : ""}
     ${formHtml}`;

  root.querySelectorAll("[data-edit-ex]").forEach((el) =>
    el.addEventListener("click", () => drawExercisesEdit(root, exercises, ctx, helpers, el.dataset.editEx))
  );

  root.querySelectorAll("[data-delete-ex]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm("Übung wirklich löschen? Gespeicherte Trainingswerte dazu gehen verloren.")) return;
      const { error } = await supabase.from("exercises").delete().eq("id", el.dataset.deleteEx);
      if (error) return showErrorToast(helpers, error);
      helpers.toast("Übung gelöscht");
      renderExercisesEditView(root, ctx, helpers);
    })
  );

  document.getElementById("add-ex")?.addEventListener("click", () => drawExercisesEdit(root, exercises, ctx, helpers, "new"));
  document.getElementById("cancel-ex")?.addEventListener("click", () => drawExercisesEdit(root, exercises, ctx, helpers, null));

  document.getElementById("save-ex")?.addEventListener("click", async () => {
    const section_name = document.getElementById("f-section").value.trim() || "Hauptteil";
    const name = document.getElementById("f-name").value.trim();
    const target_sets = parseInt(document.getElementById("f-sets").value, 10) || 1;
    const target_reps = document.getElementById("f-reps").value.trim() || "8-12";
    const notes = document.getElementById("f-notes").value.trim();

    if (!name) {
      helpers.toast("⚠️ Bitte einen Übungsnamen eingeben");
      return;
    }

    if (ex) {
      const { error } = await supabase
        .from("exercises")
        .update({ section_name, name, target_sets, target_reps, notes })
        .eq("id", ex.id);
      if (error) return showErrorToast(helpers, error);
      helpers.toast("Übung aktualisiert");
    } else {
      const { error } = await supabase.from("exercises").insert({
        training_day_id: dayId,
        section_name,
        name,
        target_sets,
        target_reps,
        notes,
        order_index: exercises.length,
      });
      if (error) return showErrorToast(helpers, error);
      helpers.toast("Übung hinzugefügt");
    }
    renderExercisesEditView(root, ctx, helpers);
  });
}

// ============================================================================
// Gemeinsame Reorder-Hilfsfunktion (tauscht order_index mit Nachbar)
// ============================================================================
async function reorder(list, id, direction, table, helpers, onDone) {
  const idx = list.findIndex((item) => item.id === id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];
  const { supabase } = helpers;

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from(table).update({ order_index: b.order_index }).eq("id", a.id),
    supabase.from(table).update({ order_index: a.order_index }).eq("id", b.id),
  ]);

  if (e1 || e2) return showErrorToast(helpers, e1 || e2);
  onDone();
}
