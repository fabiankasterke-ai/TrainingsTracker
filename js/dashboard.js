import { topBar, loadingSpinner, escapeHtml, showErrorToast } from "./ui.js";
import { setActivePlan } from "./data.js";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function todayStr() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0, 10);
}

// ============================================================================
// HOME / DASHBOARD
// ============================================================================
export async function renderHomeView(root, params, helpers) {
  root.innerHTML = topBar("TrainingsTracker", "", { showLogout: true }) + loadingSpinner("Lädt dein Dashboard …");

  const { supabase } = helpers;
  const { data: plans, error } = await supabase.from("plans").select("*").order("order_index", { ascending: true });
  if (error) return showErrorToast(helpers, error);

  if (!plans || plans.length === 0) {
    drawEmptyOnboarding(root, helpers);
    return;
  }

  let activePlan = plans.find((p) => p.is_active);
  if (!activePlan) {
    activePlan = plans[0];
    setActivePlan(supabase, activePlan.id).catch(() => {}); // im Hintergrund reparieren
  }

  const { data: blocksRaw } = await supabase
    .from("blocks")
    .select("*")
    .eq("plan_id", activePlan.id)
    .order("order_index", { ascending: true });
  const blockList = blocksRaw || [];
  const blockOrderMap = new Map(blockList.map((b) => [b.id, b.order_index]));
  const blockById = new Map(blockList.map((b) => [b.id, b]));
  const blockIds = blockList.map((b) => b.id);

  let dayList = [];
  if (blockIds.length) {
    const { data: daysRaw } = await supabase.from("training_days").select("*").in("block_id", blockIds);
    dayList = (daysRaw || [])
      .slice()
      .sort(
        (a, b) =>
          (blockOrderMap.get(a.block_id) ?? 0) - (blockOrderMap.get(b.block_id) ?? 0) ||
          a.order_index - b.order_index
      );
  }
  const dayIds = dayList.map((d) => d.id);

  let exList = [];
  if (dayIds.length) {
    const { data: exRaw } = await supabase.from("exercises").select("*").in("training_day_id", dayIds);
    exList = exRaw || [];
  }
  const exIds = exList.map((e) => e.id);

  let logList = [];
  if (exIds.length) {
    const { data: logsRaw } = await supabase
      .from("logs")
      .select("*")
      .in("exercise_id", exIds)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    logList = logsRaw || [];
  }

  const state = { switcherOpen: false, calendarMonthOffset: 0 };

  draw();

  function draw() {
    const nextDay = computeNextDay(dayList, exList, logList);
    const pr = computePersonalRecord(exList, logList);

    const now = new Date();
    const displayMonth = new Date(now.getFullYear(), now.getMonth() + state.calendarMonthOffset, 1);
    const monthCount = countTrainingDaysInMonth(logList, now);
    const weeks = buildCalendarWeeks(displayMonth, new Set(logList.map((l) => l.workout_date)));
    const monthLabel = `${MONTH_NAMES[displayMonth.getMonth()]} ${displayMonth.getFullYear()}`;

    root.innerHTML =
      topBar("TrainingsTracker", "", { showLogout: true }) +
      `
      <div class="widget plan-switcher">
        <div class="plan-switcher-row" id="ps-toggle-row">
          <div>
            <div class="widget-label">Aktueller Trainingsplan</div>
            <div class="plan-switcher-name">${escapeHtml(activePlan.name)}</div>
          </div>
          <div class="chevron">${state.switcherOpen ? "▲" : "▾"}</div>
        </div>
        ${
          state.switcherOpen
            ? `
          <div class="plan-switcher-list">
            ${plans
              .map(
                (p) => `
              <div class="plan-switcher-item" data-activate="${p.id}">
                <span class="star">${p.id === activePlan.id ? "★" : "☆"}</span>
                <span class="grow">${escapeHtml(p.name)}</span>
              </div>`
              )
              .join("")}
            <div class="plan-switcher-item action" id="ps-new-plan">
              <span class="star">+</span><span>Neuer Trainingsplan</span>
            </div>
            <div class="plan-switcher-item action" id="ps-manage">
              <span class="star">⚙</span><span>Alle Pläne verwalten</span>
            </div>
          </div>`
            : ""
        }
      </div>

      ${
        nextDay
          ? `
        <div class="widget next-training" id="next-training-cta">
          <div class="widget-label">Nächstes Training</div>
          <div class="nt-day">${escapeHtml(nextDay.name)}</div>
          <div class="nt-meta">${escapeHtml(blockById.get(nextDay.block_id)?.name || "")}</div>
          <div class="nt-cta">▶ Jetzt starten</div>
        </div>`
          : `
        <div class="widget">
          <div class="widget-label">Nächstes Training</div>
          <p class="muted" style="margin-top:6px;">Noch keine Trainingstage im aktuellen Plan angelegt.</p>
          <div class="spacer"></div>
          <button class="btn btn-secondary btn-sm" id="goto-structure">Plan bearbeiten</button>
        </div>`
      }

      <div class="stat-row">
        <div class="stat-tile">
          <div class="stat-icon">🏆</div>
          <div class="widget-label">Personal Record</div>
          ${
            pr
              ? `<div class="stat-value">${escapeHtml(pr.name)}</div><div class="stat-sub">${pr.weight} kg${pr.reps ? ` × ${pr.reps}` : ""}</div>`
              : `<div class="stat-sub">Noch kein Wert erfasst</div>`
          }
        </div>
        <div class="stat-tile">
          <div class="stat-icon">📅</div>
          <div class="widget-label">Diesen Monat</div>
          <div class="stat-value">${monthCount}×</div>
          <div class="stat-sub">trainiert</div>
        </div>
      </div>

      <div class="widget">
        <div class="widget-label">Trainings-Kalender</div>
        <div class="calendar-nav">
          <button id="cal-prev" aria-label="Vorheriger Monat">‹</button>
          <div class="calendar-month-label">${monthLabel}</div>
          <button id="cal-next" aria-label="Nächster Monat">›</button>
        </div>
        <div class="calendar-grid">
          ${WEEKDAY_LABELS.map((d) => `<div class="calendar-weekday">${d}</div>`).join("")}
          ${weeks
            .flat()
            .map((cell) =>
              cell
                ? `<div class="calendar-cell in-month${cell.isToday ? " today" : ""}${cell.trained ? " trained" : ""}">${cell.day}</div>`
                : `<div class="calendar-cell"></div>`
            )
            .join("")}
        </div>
      </div>

      <div class="widget-link-row">
        <button class="btn btn-secondary" id="goto-structure2">📋 Trainingsplan bearbeiten</button>
      </div>
    `;

    document.getElementById("ps-toggle-row").addEventListener("click", () => {
      state.switcherOpen = !state.switcherOpen;
      draw();
    });

    root.querySelectorAll("[data-activate]").forEach((el) =>
      el.addEventListener("click", async () => {
        const id = el.dataset.activate;
        if (id === activePlan.id) {
          state.switcherOpen = false;
          draw();
          return;
        }
        const { error } = await setActivePlan(supabase, id);
        if (error) return showErrorToast(helpers, error);
        helpers.toast("Plan gewechselt");
        renderHomeView(root, {}, helpers);
      })
    );

    document.getElementById("ps-new-plan")?.addEventListener("click", async () => {
      const name = prompt("Name des neuen Trainingsplans:", "Neuer Trainingsplan");
      if (!name || !name.trim()) return;
      const { error: e1 } = await supabase.from("plans").update({ is_active: false });
      if (e1) return showErrorToast(helpers, e1);
      const { error: e2 } = await supabase
        .from("plans")
        .insert({ name: name.trim(), order_index: plans.length, is_active: true });
      if (e2) return showErrorToast(helpers, e2);
      helpers.toast("Plan erstellt");
      renderHomeView(root, {}, helpers);
    });

    document.getElementById("ps-manage")?.addEventListener("click", () => helpers.push({ name: "plans" }));

    document.getElementById("next-training-cta")?.addEventListener("click", () => {
      helpers.push({
        name: "log",
        params: {
          dayId: nextDay.id,
          dayName: nextDay.name,
          blockId: nextDay.block_id,
          blockName: blockById.get(nextDay.block_id)?.name,
          planId: activePlan.id,
          planName: activePlan.name,
        },
      });
    });

    document.getElementById("goto-structure")?.addEventListener("click", () =>
      helpers.push({ name: "blocks", params: { planId: activePlan.id, planName: activePlan.name } })
    );
    document.getElementById("goto-structure2")?.addEventListener("click", () =>
      helpers.push({ name: "blocks", params: { planId: activePlan.id, planName: activePlan.name } })
    );

    document.getElementById("cal-prev").addEventListener("click", () => {
      state.calendarMonthOffset -= 1;
      draw();
    });
    document.getElementById("cal-next").addEventListener("click", () => {
      state.calendarMonthOffset += 1;
      draw();
    });
  }
}

function drawEmptyOnboarding(root, helpers) {
  const { supabase } = helpers;
  root.innerHTML =
    topBar("TrainingsTracker", "", { showLogout: true }) +
    `
    <div class="widget" style="text-align:center;padding:36px 20px;">
      <div style="font-size:42px;margin-bottom:10px;">🏋️</div>
      <h3>Willkommen!</h3>
      <p class="muted" style="margin:8px 0 22px 0;">Leg deinen ersten Trainingsplan an, um loszulegen.</p>
      <button class="btn btn-primary" id="create-first-plan">+ Ersten Trainingsplan anlegen</button>
    </div>
  `;

  document.getElementById("create-first-plan").addEventListener("click", async () => {
    const name = prompt("Name deines Trainingsplans:", "Mein Trainingsplan");
    if (!name || !name.trim()) return;
    const { error } = await supabase.from("plans").insert({ name: name.trim(), order_index: 0, is_active: true });
    if (error) return showErrorToast(helpers, error);
    renderHomeView(root, {}, helpers);
  });
}

// ============================================================================
// Berechnungen
// ============================================================================

// Nächster Trainingstag in der Rotation: der Tag nach dem zuletzt trainierten.
// Wurde noch nie trainiert -> erster Tag im Plan. Kein passender Tag mehr
// vorhanden (z. B. gelöscht) -> ebenfalls erster Tag als Fallback.
function computeNextDay(dayList, exList, logList) {
  if (!dayList.length) return null;
  if (!logList.length) return dayList[0];

  const exToDay = new Map(exList.map((e) => [e.id, e.training_day_id]));
  const lastLog = logList[0]; // logList ist bereits nach Datum/Erstellzeit absteigend sortiert
  const lastDayId = exToDay.get(lastLog.exercise_id);
  const idx = dayList.findIndex((d) => d.id === lastDayId);
  if (idx === -1) return dayList[0];
  return dayList[(idx + 1) % dayList.length];
}

function computePersonalRecord(exList, logList) {
  const withWeight = logList.filter((l) => l.weight !== null && l.weight !== undefined);
  if (!withWeight.length) return null;

  let best = withWeight[0];
  for (const l of withWeight) {
    if (l.weight > best.weight) best = l;
  }
  const ex = exList.find((e) => e.id === best.exercise_id);
  return { name: ex?.name || "Übung", weight: best.weight, reps: best.reps, date: best.workout_date };
}

function countTrainingDaysInMonth(logList, refDate) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const dates = new Set();
  for (const l of logList) {
    const d = new Date(l.workout_date + "T00:00:00");
    if (d.getFullYear() === y && d.getMonth() === m) dates.add(l.workout_date);
  }
  return dates.size;
}

function buildCalendarWeeks(monthDate, trainedDatesSet) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // Montag = 0
  const today = todayStr();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, dateStr, trained: trainedDatesSet.has(dateStr), isToday: dateStr === today });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
