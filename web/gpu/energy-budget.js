import { ENERGY_BUDGET_KEYS } from "./energy-ledger.js";

// These are flows into/out of usable energy. Gifts and reserve conversions move
// energy between pools; their presence on both charts is intentional.
export const ENERGY_INPUTS = [
  {
    key: "photosynthesis",
    label: "Sunlight",
    color: "#a4d76d",
    description:
      "Usable energy actually gained from photosynthesis, after intake losses.",
  },
  {
    key: "scavenging",
    label: "Scavenging",
    color: "#e6a365",
    description:
      "Usable energy actually gained by eating corpses, after intake losses.",
  },
  {
    key: "mobilized",
    label: "From reserves",
    color: "#69cbd6",
    description:
      "Stored reserves converted into usable energy; a transfer between pools.",
  },
  {
    key: "giftsReceived",
    label: "Gifts received",
    color: "#b797e3",
    description:
      "Usable energy received from other cells; the same transfer appears under gifts sent.",
  },
  {
    key: "arrivals",
    label: "New arrivals",
    color: "#e8cc79",
    description: "Usable energy introduced with founders and newcomers.",
  },
];
export const ENERGY_OUTPUTS = [
  {
    key: "movement",
    label: "Movement",
    color: "#65a9e3",
    description: "Energy spent on movement, turning, contraction and bracing.",
  },
  {
    key: "shields",
    label: "Barriers",
    color: "#b59be4",
    description: "Energy spent building and maintaining barriers.",
  },
  {
    key: "attacks",
    label: "Attacking",
    color: "#ed807b",
    description: "Energy the attacker spent on strikes.",
  },
  {
    key: "reproduction",
    label: "Division",
    color: "#c8b56b",
    description:
      "The energy cost of successful division; inherited energy is not counted as spending.",
  },
  {
    key: "storage",
    label: "Into reserves",
    color: "#65c2ae",
    description:
      "Usable energy debited when storing reserves; a transfer between pools, including conversion losses.",
  },
  {
    key: "upkeep",
    label: "Upkeep & heat",
    color: "#98a5ae",
    description:
      "Basal upkeep, energy decay, overheating and feeding action fees.",
  },
  {
    key: "computation",
    label: "Computation",
    color: "#8b97df",
    description: "Energy spent executing instructions.",
  },
  {
    key: "communication",
    label: "Signals & linking",
    color: "#d688b1",
    description: "Energy spent emitting, sending and forming links.",
  },
  {
    key: "giftsSent",
    label: "Gifts sent",
    color: "#b4cf8b",
    description:
      "Usable energy transferred to other cells; also recorded under gifts received.",
  },
  {
    key: "attackDamage",
    label: "Damage received",
    color: "#bd735b",
    description:
      "Victims’ usable energy lost to attacks, after barriers absorbed their share.",
  },
  {
    key: "turnover",
    label: "Other death losses",
    color: "#c3b5a9",
    description:
      "Remaining usable energy lost to old age. Stored reserves become corpse nutrients.",
  },
  {
    key: "populationPressure",
    label: "Population pressure",
    color: "#ab8ec6",
    description:
      "Usable energy lost to random penalties above the living population target.",
  },
];

/** Copy cumulative counters and compute interval-average flows per simulated minute.
 * The previous argument is the preceding history entry, with tick and energyBudget.
 * A first sample, clock reset, duplicate tick or decreased counter has no rate.
 * Missing optional fields are zero; an absent/invalid ledger is unavailable.
 */
export function budgetSnapshot(previous, counters) {
  const raw = counters.energyBudget;
  const energyBudget =
    raw && typeof raw === "object"
      ? Object.fromEntries(
          ENERGY_BUDGET_KEYS.map((key) => [key, raw[key] ?? 0]),
        )
      : null;
  const valid =
    energyBudget &&
    Object.values(energyBudget).every(
      (value) => Number.isFinite(value) && value >= 0,
    );
  const result = {
    energyBudget: valid ? energyBudget : null,
    energyRates: null,
    energyIntervalStart: null,
  };
  if (
    !valid ||
    !previous?.energyBudget ||
    !Number.isFinite(counters.tick) ||
    !Number.isFinite(previous.tick) ||
    counters.tick <= previous.tick
  )
    return result;
  const elapsed = counters.tick - previous.tick;
  const rates = {};
  for (const key of ENERGY_BUDGET_KEYS) {
    const before = previous.energyBudget[key] ?? 0;
    // The GPU ledger extends counters beyond u32. Never truncate deltas with >>>0.
    if (!Number.isFinite(before) || before < 0 || energyBudget[key] < before)
      return result;
    rates[key] = ((energyBudget[key] - before) * 3600) / elapsed;
    if (!Number.isFinite(rates[key])) return result;
  }
  result.energyRates = rates;
  result.energyIntervalStart = previous.tick;
  return result;
}

/** Legend values share the same source and units as the plotted bands. */
export function budgetLegend(sample, categories, mode = "rate") {
  const data = mode === "rate" ? sample?.energyRates : sample?.energyBudget;
  const items = categories.map((category) => ({
    ...category,
    value:
      data &&
      Number.isFinite(data[category.key] ?? 0) &&
      (data[category.key] ?? 0) >= 0
        ? (data[category.key] ?? 0)
        : null,
  }));
  return {
    items,
    total: items.every((item) => item.value !== null)
      ? items.reduce((sum, item) => sum + item.value, 0)
      : null,
  };
}

/** A rate sample covers its actual preceding interval, clipped to the retained
 * history window. Cumulative samples are points; the chart linearly joins their
 * observed totals. Both charts share the population history's time endpoints.
 */
export function energyBudgetSeries(history, categories, mode = "rate") {
  const samples = [];
  const firstTick = history[0]?.tick ?? null;
  const lastTick = history.at(-1)?.tick ?? null;
  for (const sample of history) {
    const legend = budgetLegend(sample, categories, mode);
    const start =
      mode === "rate"
        ? Number.isFinite(sample.energyIntervalStart)
          ? Math.max(firstTick, sample.energyIntervalStart)
          : null
        : sample.tick;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(sample.tick) ||
      legend.total === null ||
      start > sample.tick ||
      (mode === "rate" && start === sample.tick)
    )
      continue;
    if (samples.length && start < samples.at(-1).end) continue;
    samples.push({
      start,
      end: sample.tick,
      values: legend.items.map((item) => item.value),
      total: legend.total,
    });
  }
  return {
    samples,
    firstTick,
    lastTick,
    maxTotal: samples.reduce((max, sample) => Math.max(max, sample.total), 0),
  };
}

function niceMaximum(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) *
    magnitude
  );
}
function elapsedLabel(tick) {
  const seconds = Math.max(0, Math.floor(tick / 60));
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Draw stacked contributions, with interval-constant rates and cumulative totals.
 * Returns plot statistics for accessible labels/tests; the DOM legend is owned
 * by the caller. Zero flows draw an honest baseline, not a fabricated band.
 */
export function drawEnergyBudget(canvas, history, categories, mode = "rate") {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width),
    height = Math.max(1, rect.height);
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext("2d");
  const series = energyBudgetSeries(history, categories, mode);
  if (!ctx) return series;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.font = "10px system-ui";
  ctx.fillStyle = "#91aaa5";
  ctx.textAlign = "left";
  ctx.fillText(
    mode === "rate" ? "energy / simulated minute" : "cumulative usable energy",
    8,
    14,
  );
  if (!series.samples.length) {
    ctx.fillText("Collecting energy flows…", 8, Math.max(32, height / 2));
    return series;
  }
  const left = width < 220 ? 42 : 58,
    right = Math.max(left + 1, width - 12);
  const top = 28,
    bottom = Math.max(top + 1, height - 28);
  const maximum = niceMaximum(series.maxTotal * 1.04);
  const duration = Math.max(1, series.lastTick - series.firstTick);
  const x = (tick) =>
    left + ((tick - series.firstTick) / duration) * (right - left);
  const y = (value) => bottom - (value / maximum) * (bottom - top);
  const groups = [];
  for (const sample of series.samples) {
    if (
      !groups.length ||
      (mode === "rate" && sample.start > groups.at(-1).at(-1).end)
    )
      groups.push([]);
    groups.at(-1).push(sample);
  }
  for (let band = 0; band < categories.length; band++) {
    ctx.fillStyle = categories[band].color;
    for (const group of groups) {
      const upper = [],
        lower = [];
      for (const sample of group) {
        const base = sample.values
          .slice(0, band)
          .reduce((sum, value) => sum + value, 0);
        if (mode === "rate") {
          upper.push([x(sample.start), y(base + sample.values[band])]);
          lower.push([x(sample.start), y(base)]);
        }
        upper.push([x(sample.end), y(base + sample.values[band])]);
        lower.push([x(sample.end), y(base)]);
      }
      ctx.beginPath();
      ctx.moveTo(...upper[0]);
      for (const point of upper.slice(1)) ctx.lineTo(...point);
      for (const point of lower.reverse()) ctx.lineTo(...point);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.fillStyle = "#91aaa5";
  for (const value of [0, maximum / 2, maximum]) {
    ctx.strokeStyle = "#334b48";
    ctx.beginPath();
    ctx.moveTo(left, y(value));
    ctx.lineTo(right, y(value));
    ctx.stroke();
    ctx.fillText(
      value.toLocaleString(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
      left - 7,
      y(value) + 3,
    );
  }
  ctx.textAlign = "left";
  ctx.fillText(elapsedLabel(series.firstTick), left, height - 8);
  ctx.textAlign = "right";
  ctx.fillText(elapsedLabel(series.lastTick), right, height - 8);
  if (right - left > 200) {
    ctx.textAlign = "center";
    ctx.fillText("simulation time", (left + right) / 2, height - 8);
  }
  return { ...series, maximum };
}
