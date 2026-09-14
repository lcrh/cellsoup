import { budgetSnapshot } from "./energy-budget.js";
// GPU event counters are cumulative u32 values; rates use simulation time,
// never wall time, so changing playback speed cannot manufacture activity.
export function appendEventSample(history, counters, limit = 480) {
  if (history.at(-1)?.tick === counters.tick) return false;
  if (history.at(-1)?.tick > counters.tick) history.length = 0;
  const previous = history.at(-1);
  const sample = {
    tick: counters.tick,
    living: counters.living,
    ...budgetSnapshot(previous, counters),
  };
  for (const key of ["attacks", "kills"]) {
    sample[key] = counters[key];
    sample[`${key}Rate`] = previous
      ? (((counters[key] - previous[key]) >>> 0) * 3600) /
        (counters.tick - previous.tick)
      : null;
  }
  history.push(sample);
  if (history.length > limit) history.shift();
  return true;
}

export function drawEventChart(canvas, history, key, mode, color) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const field = mode === "rate" ? `${key}Rate` : key;
  const values = history.map((p) => p[field]).filter((v) => v !== null);
  ctx.font = "10px system-ui";
  ctx.fillStyle = "#88a2a0";
  if (!values.length) {
    ctx.fillText("Collecting activity…", 8, 28);
    return;
  }
  const max = Math.max(1, ...values) * 1.1;
  const left = 48,
    right = Math.max(left + 1, r.width - 8);
  const top = 12,
    bottom = Math.max(top + 1, r.height - 12);
  const first = history[0].tick;
  const span = Math.max(1, history.at(-1).tick - first);
  const x = (tick) => left + ((tick - first) / span) * (right - left);
  const y = (value) => bottom - (value / max) * (bottom - top);
  ctx.textAlign = "right";
  for (const level of [0, max]) {
    ctx.fillText(
      level.toLocaleString(undefined, {
        maximumFractionDigits: 1,
        notation: "compact",
      }),
      left - 6,
      y(level) + 3,
    );
    ctx.beginPath();
    ctx.moveTo(left, y(level));
    ctx.lineTo(right, y(level));
    ctx.strokeStyle = "#273b3e";
    ctx.stroke();
  }
  ctx.beginPath();
  let started = false;
  history.forEach((point, i) => {
    const value = point[field];
    if (value === null) return;
    // Each rate is the average across the preceding sampling interval.
    const start = mode === "rate" && i > 0 ? history[i - 1].tick : point.tick;
    if (!started) ctx.moveTo(x(start), y(value));
    else ctx.lineTo(x(start), y(value));
    ctx.lineTo(x(point.tick), y(value));
    started = true;
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
