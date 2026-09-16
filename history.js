import { topBar, loadingSpinner, emptyState, escapeHtml, showErrorToast } from "./ui.js";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTH_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

// ============================================================================
// ÜBUNGS-HISTORIE (Verlauf + Graph)
// ============================================================================
export async function renderExerciseHistoryView(root, ctx, helpers) {
  const { exerciseId, exerciseName } = ctx;
  root.innerHTML = topBar(exerciseName || "Verlauf", "Trainingshistorie", { showBack: true, showLogout: true }) + loadingSpinner();

  const { supabase } = helpers;
  const { data: logs, error } = await supabase
    .from("logs")
    .select("*")
    .eq("exercise_id", exerciseId)
    .order("workout_date", { ascending: false })
    .order("set_index", { ascending: true })
    .limit(1000);

  if (error) return showErrorToast(helpers, error);

  if (!logs || logs.length === 0) {
    root.innerHTML =
      topBar(exerciseName || "Verlauf", "Trainingshistorie", { showBack: true, showLogout: true }) +
      emptyState("📈", "Für diese Übung wurden noch keine Werte erfasst. Nach dem ersten Training siehst du hier deinen Verlauf.");
    return;
  }

  drawHistory(root, logs, exerciseName, helpers);
}

function groupByDate(logs) {
  const byDate = new Map();
  for (const l of logs) {
    if (!byDate.has(l.workout_date)) byDate.set(l.workout_date, []);
    byDate.get(l.workout_date).push(l);
  }
  // Explizit nach Datum absteigend sortieren (ISO-Format "YYYY-MM-DD" sortiert
  // lexikografisch korrekt) – verlässt sich nicht auf die Reihenfolge der Query.
  return [...byDate.entries()]
    .map(([date, sets]) => ({ date, sets: sets.sort((a, b) => a.set_index - b.set_index) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function drawHistory(root, logs, exerciseName, helpers) {
  const byDateDesc = groupByDate(logs); // neueste zuerst, für die Liste

  // Chart-Datenpunkte: höchstes Gewicht je Trainingstag, chronologisch aufsteigend
  const chartPoints = byDateDesc
    .filter((d) => d.sets.some((s) => s.weight !== null && s.weight !== undefined))
    .map((d) => ({
      date: d.date,
      value: Math.max(...d.sets.filter((s) => s.weight !== null && s.weight !== undefined).map((s) => s.weight)),
    }))
    .reverse();

  let chartWidget = "";
  if (chartPoints.length >= 2) {
    chartWidget = `
      <div class="widget">
        <div class="widget-label">Gewichtsverlauf (höchster Satz je Training)</div>
        ${buildLineChartSVG(chartPoints)}
        <div class="chart-detail" id="chart-detail">${formatDateLabel(chartPoints[chartPoints.length - 1].date)}: <strong>${chartPoints[chartPoints.length - 1].value} kg</strong></div>
      </div>
    `;
  } else if (chartPoints.length === 1) {
    chartWidget = `
      <div class="widget">
        <div class="widget-label">Gewichtsverlauf</div>
        <p class="muted" style="margin-top:4px;">Noch zu wenige Trainings für einen Verlauf – nach dem zweiten Mal siehst du hier eine Kurve.</p>
      </div>
    `;
  }

  const listHtml = byDateDesc
    .map(
      (d) => `
    <div class="history-entry">
      <div class="history-date">${formatDateLabel(d.date)}</div>
      <div class="history-sets">
        ${d.sets
          .map(
            (s) =>
              `<span class="history-set-pill">Satz ${s.set_index}: ${s.weight ?? "–"} kg${s.reps !== null && s.reps !== undefined ? ` × ${s.reps}` : ""}</span>`
          )
          .join("")}
      </div>
    </div>`
    )
    .join("");

  root.innerHTML =
    topBar(exerciseName || "Verlauf", "Trainingshistorie", { showBack: true, showLogout: true }) +
    `
    ${chartWidget}
    <div class="section-header"><h2>Alle Einträge</h2></div>
    ${listHtml}
    <div class="spacer"></div>
  `;

  if (chartPoints.length >= 2) {
    root.querySelectorAll(".chart-hit").forEach((el) =>
      el.addEventListener("click", () => {
        const i = parseInt(el.dataset.i, 10);
        const p = chartPoints[i];
        const detail = document.getElementById("chart-detail");
        if (detail) detail.innerHTML = `${formatDateLabel(p.date)}: <strong>${p.value} kg</strong>`;
      })
    );
  }
}

// ============================================================================
// Kleines, abhängigkeitsfreies SVG-Liniendiagramm
// ============================================================================
function chooseNiceStep(rough) {
  if (rough <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  let step;
  if (residual <= 1) step = 1;
  else if (residual <= 2) step = 2;
  else if (residual <= 5) step = 5;
  else step = 10;
  return step * magnitude;
}

function buildLineChartSVG(points) {
  const W = 320;
  const H = 168;
  const padL = 34;
  const padR = 12;
  const padT = 18;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 5;
    max += 5;
  }
  const yPad = (max - min) * 0.2;
  min -= yPad;
  max += yPad;
  const step = chooseNiceStep((max - min) / 3);
  const yMin = Math.floor(min / step) * step;
  const yMax = Math.ceil(max / step) * step;

  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xAt = (i) => padL + i * xStep;
  const yAt = (v) => padT + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const linePoints = points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
  const baseline = (padT + innerH).toFixed(1);
  const areaPoints = `${xAt(0).toFixed(1)},${baseline} ${linePoints} ${xAt(points.length - 1).toFixed(1)},${baseline}`;

  const gridVals = [yMin, (yMin + yMax) / 2, yMax];
  const gridLines = gridVals
    .map(
      (v) => `
    <line x1="${padL}" y1="${yAt(v).toFixed(1)}" x2="${W - padR}" y2="${yAt(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>
    <text x="${padL - 6}" y="${(yAt(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${Math.round(v)}</text>
  `
    )
    .join("");

  // x-Achsen-Beschriftung: erster, letzter, und ggf. mittlerer Punkt (nie überlappend bei vielen Punkten)
  const xLabelIdxs = points.length <= 4 ? points.map((_, i) => i) : [0, Math.round((points.length - 1) / 2), points.length - 1];
  const xLabels = xLabelIdxs
    .map(
      (i) => `
    <text x="${xAt(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}" font-size="9" fill="var(--text-muted)">${formatDateShort(points[i].date)}</text>
  `
    )
    .join("");

  const dots = points
    .map(
      (p, i) => `
    <circle class="chart-hit" data-i="${i}" cx="${xAt(i).toFixed(1)}" cy="${yAt(p.value).toFixed(1)}" r="14" fill="transparent" style="cursor:pointer;"/>
    <circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.value).toFixed(1)}" r="4" fill="var(--accent-light)" stroke="var(--bg-card)" stroke-width="2" style="pointer-events:none;"/>
  `
    )
    .join("");

  const last = points[points.length - 1];
  const lastLabel = `<text x="${xAt(points.length - 1).toFixed(1)}" y="${(yAt(last.value) - 10).toFixed(1)}" text-anchor="end" font-size="11" font-weight="700" fill="var(--text)">${last.value} kg</text>`;

  return `
    <svg viewBox="0 0 ${W} ${H}" class="history-chart-svg" role="img" aria-label="Gewichtsverlauf für ${points.length} Trainings">
      ${gridLines}
      <polygon points="${areaPoints}" fill="var(--accent-light)" opacity="0.12"/>
      <polyline points="${linePoints}" fill="none" stroke="var(--accent-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${lastLabel}
      ${xLabels}
    </svg>
  `;
}
