import { createDeviceSession, describeGpuFailure } from "./device-session.js";
import { worldConfigFromUrl, worldUrlForConfig } from "./world-url.js";
import { protectCoreFunctionMasks } from "./core-language.js";
import {
  SETTING_GROUPS as settingGroups,
  WORLD_CAPACITIES,
} from "./world-controls.js";
import { createLifeEngine, defaults } from "./engine.js";
import { randomWorldSettings, describeWorld } from "./random-world.js";
import { TREE_SCHEMA, TREE_SURFACE_FORMS, functionEnabled } from "./trees.js";
import { FUNCTION_REFERENCE } from "./function-reference.js";
import { specializationSummary, ENERGY_PATHWAYS } from "./specialization.js";
const functionMasks = Object.fromEntries(
  [0, 1, 2, 3].map((i) => ["functionMask" + i, 4294967295]),
);
import { createRenderer } from "./renderer.js";
import { createExecutionMeter } from "./trace-meter.js";
import { createBehaviorMeter } from "./behavior-meter.js";
import { appendEventSample, drawEventChart } from "./event-history.js";
import {
  ENERGY_INPUTS,
  ENERGY_OUTPUTS,
  budgetLegend,
  drawEnergyBudget,
} from "./energy-budget.js";

import {
  snapshot,
  bodyAt,
  largestBody,
  movingBody,
  bodyMotion,
  bodyBounds,
  nearest,
  stride,
} from "./observe.js";

const $ = (id) => document.getElementById(id);
const canvas = $("world"),
  camera = { x: 4096, y: 4096, width: 8192, height: 8192 };
const numericSettings = [];
for (const [title, fields] of settingGroups) {
  const section = document.createElement("details"),
    summary = document.createElement("summary");
  summary.textContent = title;
  section.append(summary);
  if (title === "Evolution") {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Newcomers keep arriving when the world is full. The extra rate adds more pressure at capacity; set it to 0 to keep only the ordinary influx. Valid divisions happen first, then excess cells are removed with a bias toward low usable energy. Parents and newborns both compete. Capacity removal recycles the slot rather than leaving a corpse.";
    section.append(hint);
  }
  if (title === "Physics & reach") {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Movement force and movement energy cost independently control propulsion per energy spent. Drag, cell spacing and spring barriers shape bodies; links pull toward the chosen rest distance.";
    section.append(hint);
  }
  if (title === "Energy & reserves") {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Fill scales make intake less efficient as a pool grows; 0 disables this effect. Higher scales support larger pools. Linked sharing conserves existing reserves. Each pathway’s efficiency also multiplies its specialization multiplier. Converted or eaten material is spent even when some energy is lost. Lifespan 0 means unlimited age; reaching a finite lifespan leaves a normal edible corpse. Closing-speed attacks multiply damage by 1 + bonus × relative approach speed (world units/sec).";
    section.append(hint);
  }
  if (title === "Mutation styles") {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Weights are normalized together. Failed bounded edits fall back to subtree mutation; all-zero weights also use subtree mutation.";
    section.append(hint);
  }
  if (title === "Specialization") {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Recent photosynthesis, scavenging and mobilization compete. One source is efficient; an even mix pays the full penalty. Zero switches specialization off.";
    section.append(hint);
  }
  if (title === "Computation & broadcasts") {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Sampling weights shape random programs. Broadcasts use c0–c3. Relay 0 reads direct neighbors; higher values mix in earlier neighbor broadcasts, spreading farther with attenuation and delay.";
    section.append(hint);
  }
  for (const [id, title, min, max, step] of fields) {
    numericSettings.push(id);
    const label = document.createElement("label"),
      name = document.createElement("span"),
      input = document.createElement("input");
    label.className = "setting-control";
    name.textContent = title;
    name.id = id + "-label";
    input.id = id;
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = defaults[id];
    input.setAttribute("aria-label", title + " exact value");
    label.append(name);
    if (id !== "seed") {
      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = id + "-range";
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = input.value;
      slider.setAttribute("aria-label", title);
      slider.addEventListener("input", () => {
        input.value = slider.value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      input.addEventListener("input", () => {
        slider.value = input.value;
      });
      label.append(slider);
    }
    label.append(input);
    section.append(label);
  }
  $("settings-fields").append(section);
}
$("rate").value = 8;
$("floor").value = 512;

let device,
  engine,
  renderer,
  behaviorMeter,
  executionMeter,
  paused = false,
  busy = true,
  failed = false;
const gpuSession = createDeviceSession(navigator.gpu, fail);
let pendingReset = false,
  pendingStep = false,
  pendingFind = false,
  pendingPick = null;
let selection = null,
  selectedGenome = null,
  snap = null,
  members = [],
  lastSnapshot = 0,
  lastMetrics = 0;
let previousTime = performance.now(),
  carry = 0,
  speedTick = 0,
  speedTime = 0,
  history = [];
const formatNumber = (n) => Math.round(n).toLocaleString();
const time = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").hidden = !message;
  $("notice").classList.toggle("error", error);
}
function fail(error) {
  try {
    gpuSession.check();
  } catch (gpuError) {
    error = gpuError;
  }
  failed = true;
  paused = true;
  busy = false;
  const world = engine
    ? {
        seed: engine.cfg.seed,
        tick: engine.tick,
        capacity: engine.cfg.capacity,
      }
    : null;
  console.error("Cell Soup stopped", { error, world });
  notice(describeGpuFailure(error, world), true);
  controls(false);
  $("restart").textContent = "Restart soup";
  $("restart").disabled = false;
  $("random-world").disabled = false;
}
function controls(enabled) {
  for (const id of [
    "pause",
    "step",
    "find",
    "find-moving",
    "fit",
    "restart",
    "random-world",
  ])
    $(id).disabled = !enabled;
  $("step").disabled = !enabled || !paused;
  $("pause").textContent = paused ? "Resume" : "Pause";
  if (enabled) $("restart").textContent = "Use these settings";
}
function options() {
  if (!$("habitat-size").checkValidity())
    throw Error("Habitat width must be 160–16,384 units, in steps of 32.");
  const capacity = Number($("capacity").value);
  const cfg = {
    capacity,
    genomeCapacity: capacity / 4,
    treePrograms: 1,
    initial: capacity / 4,
    side: Number($("habitat-size").value) / 32,
    sources: 1,
    executionTrace: 1,
  };
  for (const id of numericSettings) {
    const input = $(id);
    if (!input.checkValidity())
      throw Error(
        `Check the value for ${input.parentElement.firstChild.textContent.trim()}.`,
      );
    cfg[id] = Number(input.value);
  }
  if (cfg.ambientTemperature > cfg.safeTemperature)
    throw Error(
      "The overheating threshold must be at least the ambient temperature.",
    );
  if (cfg.divisionCost + 2 * cfg.minimumBirthEnergy > cfg.energyCapacity)
    throw Error(
      "Division cost plus both daughters’ minimum energy must fit within the usable energy capacity.",
    );
  if (cfg.seedEnergy > cfg.energyCapacity)
    throw Error("Newcomer energy must fit within the usable energy capacity.");
  if (cfg.seedStorage > cfg.storageCapacity)
    throw Error("Newcomer storage must fit within the storage capacity.");
  if (cfg.initial > cfg.genomeCapacity)
    throw Error(
      "Initial founders must fit within one quarter of entity capacity.",
    );
  if (cfg.capacityRate > 1024)
    throw Error(
      "Extra newcomers at capacity must not exceed 1,024 per second.",
    );
  if (
    cfg.floor > capacity ||
    cfg.rate > capacity ||
    cfg.capacityRate > capacity
  )
    throw Error(
      "Population floor and both newcomer rates must not exceed capacity.",
    );
  Object.assign(cfg, functionMasks);
  return cfg;
}
function fitWorld() {
  camera.x = engine.cfg.side * 16;
  camera.y = camera.x;
  camera.width = engine.cfg.side * 32;
  camera.overview = true;
  $("follow").checked = false;
}
function releaseWorld() {
  executionMeter?.destroy();
  executionMeter = null;
  behaviorMeter?.destroy();
  behaviorMeter = null;
  renderer?.destroy();
  renderer = null;
  engine?.destroy();
  engine = null;
}
async function start() {
  // Validate before discarding an existing habitat.
  const cfg = options();
  busy = true;
  controls(false);
  notice("Preparing the GPU habitat…");
  // Release the old world's buffers and workers before requesting replacements.
  releaseWorld();
  if (failed) gpuSession.dispose();
  failed = false;
  try {
    device = await gpuSession.connect();
    engine = await createLifeEngine(device, cfg);
    gpuSession.check();
    renderer = await createRenderer(
      device,
      canvas,
      engine,
      navigator.gpu.getPreferredCanvasFormat(),
    );
    behaviorMeter = await createBehaviorMeter(device, engine);
    executionMeter = await createExecutionMeter(device, engine);
    gpuSession.check();
  } catch (error) {
    // Also reclaim resources from constructors that failed before returning.
    releaseWorld();
    gpuSession.dispose();
    device = null;
    throw error;
  }
  $("world-description").textContent = describeWorld(engine.cfg);
  $("genome-kind").textContent = "Random typed-tree genomes";
  renderReference();
  failed = false;
  paused = false;
  selection = null;
  selectedGenome = null;
  snap = null;
  members = [];
  history = [];
  $("history-range").textContent = "";
  $("attacks").textContent = "0";
  $("kills").textContent = "0";
  drawHistory();
  carry = 0;
  pendingPick = null;
  pendingFind = false;
  pendingStep = false;
  $("selection").hidden = true;
  $("selection-hint").textContent =
    "Find colony zooms into the largest connected body. Colonies emerge as cells divide and connect.";
  fitWorld();
  $("follow").checked = true;
  lastMetrics = 0;
  lastSnapshot = 0;
  speedTime = performance.now();
  speedTick = 0;
  previousTime = speedTime;
  busy = false;
  controls(true);
  notice("");
  window.history.replaceState(
    null,
    "",
    worldUrlForConfig(location.href, engine.cfg),
  );
}
function selectSlot(slot, fit = false) {
  if (slot < 0) {
    notice("No cell at that point. Zoom in or use Find colony.");
    return;
  }
  const k = slot * stride;
  selection = { slot, identity: snap.u[k + 24] };
  camera.overview = false;
  selectedGenome = null;
  $("export").disabled = true;
  $("source").textContent = "Reading genome…";
  $("selection").hidden = false;
  $("selection-hint").textContent =
    "Live observation; connected cells may divide, separate or die.";
  $("follow").checked = true;
  updateSelection(fit);
  notice("");
}
function updateSelection(fit = false) {
  if (!selection || !snap) return;
  if (
    snap.u[selection.slot * stride + 31] !== 1 ||
    snap.u[selection.slot * stride + 24] !== selection.identity
  ) {
    const survivor = members.find(
      (m) =>
        snap.u[m.slot * stride + 31] === 1 &&
        snap.u[m.slot * stride + 24] === m.identity,
    );
    if (survivor) {
      selection = survivor;
      selectedGenome = null;
      $("source").textContent = "Reading descendant genome…";
      $("export").disabled = true;
    } else {
      selection = null;
      members = [];
      selectedGenome = null;
      $("selection").hidden = true;
      $("selection-hint").textContent =
        "The observed cells died. Find colony to follow another body.";
      return;
    }
  }
  const { slot } = selection,
    k = slot * stride,
    body = bodyAt(snap, slot),
    bounds = bodyBounds(snap, body);
  members = body.map((slot) => ({
    slot,
    identity: snap.u[slot * stride + 24],
  }));
  if ($("follow").checked && bounds) {
    camera.x = bounds.x;
    camera.y = bounds.y;
    if (fit) {
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      camera.width = Math.max(
        160,
        bounds.width * 1.5,
        bounds.height * aspect * 1.5,
      );
    }
  }
  $("body-size").textContent = body.length;
  $("cell-energy").textContent = (snap.f[k + 4] / 4096).toFixed(1);
  $("cell-age").textContent = time(snap.u[k + 28] / 60);
  $("cell-storage").textContent = (snap.f[k + 38] / 4096).toFixed(1);
  for (const [id, amount, scale, capacity] of [
    [
      "cell-energy",
      snap.f[k + 4] / 4096,
      engine.cfg.energyFillScale,
      engine.cfg.energyCapacity,
    ],
    [
      "cell-storage",
      snap.f[k + 38] / 4096,
      engine.cfg.storageFillScale,
      engine.cfg.storageCapacity,
    ],
  ]) {
    $(id).title =
      scale > 0
        ? `Fill scale ${scale}; marginal intake efficiency ${(100 * Math.exp(-amount / scale)).toFixed(1)}% before pathway efficiency. Safety limit ${capacity}.`
        : `Diminishing intake disabled. Safety limit ${capacity}.`;
  }
  $("body-motion").textContent = bodyMotion(snap, body).toFixed(1);
  $("cell-light").textContent = `${Math.round(snap.f[k + 37] * 100)}%`;
  $("cell-barrier").textContent =
    `${snap.f[k + 7].toFixed(1)} / ${engine.cfg.shieldCapacity}`;
  $("cell-temperature").textContent = `${snap.f[k + 39].toFixed(1)} °C`;
  $("cell-detail").textContent =
    `Cell ${selection.identity} · generation ${snap.u[k + 29]} · instruction ${snap.u[k + 26] + 1}`;
  $("light-fill").style.width = `${snap.f[k + 37] * 100}%`;
}
async function readSelectedGenome() {
  if (!selection) return;
  const slot = snap.u[selection.slot * stride + 25];
  if (selectedGenome?.slot === slot) return;
  const gene = await engine.genome(slot);
  if (!gene) return;
  selectedGenome = { ...gene, slot };
  $("genome-name").textContent = `Genome ${gene.serial}`;
  $("genome-detail").textContent = gene.tree
    ? `${gene.nodes} nodes · ${gene.parent ? `Parents ${gene.parent}${gene.secondParent ? " + " + gene.secondParent : ""}` : "Random founder"} · ${gene.depth} mutations along primary ancestry`
    : `Founder ${gene.founder} · ${gene.depth} resampling mutations along ancestry · ${gene.length} instructions`;
  $("source").textContent = gene.source;
  $("export").disabled = false;
}
async function observe(now) {
  const needSnapshot =
    pendingFind || pendingPick || (selection && now - lastSnapshot > 1000);
  if (needSnapshot) {
    snap = snapshot(await engine.state(), engine.cfg.side * 32);
    lastSnapshot = now;
  }
  if (pendingFind) {
    const moving = pendingFind === "moving";
    pendingFind = false;
    const body = moving ? movingBody(snap) : largestBody(snap);
    if (body.length) {
      selectSlot(body[0], true);
      if (body.length === 1)
        notice(
          "No connected colony yet. Following a living cell; try again after divisions.",
        );
    } else
      notice(
        moving
          ? "No connected body of 4+ cells is currently traveling above 2 units/sec."
          : "No living cells yet. Newcomers arrive once per simulated second.",
      );
  }
  if (pendingPick) {
    const { x, y, radius } = pendingPick;
    pendingPick = null;
    selectSlot(nearest(snap, x, y, radius));
  }
  if (needSnapshot) {
    updateSelection();
    await readSelectedGenome();
    $("memory-panel").hidden = !selection || !engine.cfg.treePrograms;
    if (selection && engine.cfg.treePrograms) {
      const memory = await engine.cellMemory(selection.slot);
      const intake = await engine.cellSpecialization(selection.slot);
      const specialization = specializationSummary(
        intake,
        engine.cfg.specializationStrength,
      );
      const intakeDescription =
        intake.reduce((sum, value) => sum + value, 0) > 1e-12
          ? `Recent intake: ${specialization.shares.map((share, i) => `${Math.round(share * 100)}% ${ENERGY_PATHWAYS[i].toLowerCase()}`).join(" · ")}.`
          : "No recent intake yet.";
      $("cell-specialization").textContent =
        engine.cfg.specializationStrength > 0
          ? `${intakeDescription} Specialization multiplier ${Math.round(specialization.efficiency * 100)}%.`
          : "Specialization is off in this world.";
      $("cell-memory").replaceChildren(
        ...[...memory].map((value, i) => {
          const item = document.createElement("div"),
            name = document.createElement("span"),
            amount = document.createElement("b");
          name.textContent = `state${i}`;
          amount.textContent = Number(value.toPrecision(5)).toLocaleString();
          item.append(name, amount);
          return item;
        }),
      );
    }
  }
  if (now - lastMetrics > 1000) {
    const c = await engine.counters();
    $("living").textContent = formatNumber(c.living);
    $("elapsed").textContent = time(engine.tick / 60);
    $("births").textContent = formatNumber(c.births);
    $("corpses").textContent = formatNumber(c.corpses);
    $("attacks").textContent = formatNumber(c.attacks);
    $("kills").textContent = formatNumber(c.kills);
    $("eaten").textContent = formatNumber(c.eaten);
    $("capacity-arrivals").textContent = formatNumber(c.capacityArrivals ?? 0);
    $("capacity-deaths").textContent = formatNumber(c.capacityDeaths ?? 0);
    $("mutations").textContent = formatNumber(c.mutations);
    $("division-mutations").textContent = formatNumber(c.divisionMutations);
    $("crossovers").textContent = formatNumber(c.crossovers);
    $("archive").textContent = c.archive;
    const actual = (engine.tick - speedTick) / 60 / ((now - speedTime) / 1000);
    $("throughput").textContent = paused ? "Paused" : `${actual.toFixed(1)}×`;
    speedTime = now;
    speedTick = engine.tick;
    lastMetrics = now;
    appendEventSample(history, c);
    drawHistory();
  }
}
function drawHistory() {
  drawPredationHistory();
  drawEnergyHistory();
  const canvas = $("history"),
    r = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  if (history.length < 2) return;
  const max = Math.max(1, ...history.map((p) => p.living)) * 1.2,
    first = history[0].tick,
    span = Math.max(1, history.at(-1).tick - first);
  ctx.beginPath();
  history.forEach((p, i) => {
    const x = ((p.tick - first) / span) * r.width,
      y = r.height - 4 - (p.living / max) * (r.height - 18);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "#9abf91";
  ctx.lineWidth = 1.3;
  ctx.stroke();
  $("history-range").textContent =
    `· ${time(first / 60)}–${time(history.at(-1).tick / 60)}`;
}
function drawPredationHistory() {
  $("predation-history-range").textContent = historyRange();
  const mode = $("predation-history-mode").value;
  const last = history.at(-1);
  for (const [key, color] of [
    ["attacks", "#ecad71"],
    ["kills", "#ec797c"],
    ["capacityDeaths", "#a8a4d6"],
  ]) {
    const value = last?.[mode === "rate" ? `${key}Rate` : key];
    const label =
      value == null
        ? "—"
        : value.toLocaleString(undefined, {
            maximumFractionDigits: mode === "rate" ? 1 : 0,
          });
    $(`${key}-history-value`).textContent =
      `${label}${mode === "rate" ? " / min" : " total"}`;
    const chart = $(`${key}-history`);
    chart.setAttribute(
      "aria-label",
      `${key === "kills" ? "Confirmed attack kills" : key === "capacityDeaths" ? "Capacity deaths" : "Attacks"} over simulated time; latest ${label}${mode === "rate" ? " per simulated minute" : " total"}`,
    );
    drawEventChart(chart, history, key, mode, color);
  }
}
$("predation-history-mode").addEventListener("change", drawPredationHistory);
function historyRange() {
  return history.length < 2
    ? ""
    : `· ${time(history[0].tick / 60)}–${time(history.at(-1).tick / 60)}`;
}
function drawEnergyHistory() {
  const mode = $("energy-history-mode").value;
  $("energy-history-range").textContent = historyRange();
  const number = (value) =>
    value == null
      ? "—"
      : value.toLocaleString(undefined, {
          maximumFractionDigits: 1,
          notation: "compact",
        });
  for (const [side, categories] of [
    ["in", ENERGY_INPUTS],
    ["out", ENERGY_OUTPUTS],
  ]) {
    const { items, total } = budgetLegend(history.at(-1), categories, mode);
    const unit = mode === "rate" ? " / min" : " total";
    $(`energy-${side}-total`).textContent = `${number(total)}${unit}`;
    $(`energy-${side}-legend`).replaceChildren(
      ...items.map(({ label, color, value, description }) => {
        const item = document.createElement("div");
        const swatch = document.createElement("i");
        const name = document.createElement("span");
        const amount = document.createElement("strong");
        swatch.style.backgroundColor = color;
        name.textContent = label;
        amount.textContent = number(value);
        item.title = `${description || label}${value == null ? "" : ` — ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} energy${unit}`}`;
        item.append(swatch, name, amount);
        return item;
      }),
    );
    const chart = $(`energy-${side}-history`);
    chart.setAttribute(
      "aria-label",
      `Usable energy ${side} over simulated time. ${items.map(({ label, value }) => `${label}: ${number(value)}${unit}`).join("; ")}`,
    );
    drawEnergyBudget(chart, history, categories, mode);
  }
}
$("energy-history-mode").addEventListener("change", drawEnergyHistory);
async function frame(now) {
  try {
    if (pendingReset) {
      pendingReset = false;
      try {
        await start();
      } catch (error) {
        if (engine && renderer && !failed) {
          busy = false;
          controls(true);
          notice(error.message, true);
        } else throw error;
      }
    }
    if (engine && renderer && !busy && !failed) {
      const dt = Math.min(0.2, (now - previousTime) / 1000);
      previousTime = now;
      let ticks = 0;
      if (pendingStep) {
        pendingStep = false;
        ticks = 1;
      } else if (!paused) {
        if ($("speed").value === "max") ticks = 24;
        else {
          carry += dt * 60 * Number($("speed").value);
          ticks = Math.min(24, Math.floor(carry));
          carry -= ticks;
          carry = Math.min(carry, 24);
        }
      }
      await behaviorMeter?.observe();
      await executionMeter?.observe();
      while (ticks > 0) {
        const batch = Math.min(
          behaviorMeter?.limitStep(ticks) ?? ticks,
          executionMeter?.limitStep(ticks) ?? ticks,
        );
        await engine.step(batch);
        gpuSession.check();
        ticks -= batch;
        await behaviorMeter?.observe();
        await executionMeter?.observe();
      }
      await observe(performance.now());
      gpuSession.check();
      renderer.draw(camera, {
        food: $("food").checked,
        activity: $("activity").checked,
        links: $("links").checked,
        color: Number($("color").value),
        slot: selection?.slot,
        identity: selection?.identity,
      });
      // Do not let browser animation frames outrun GPU completion. Max speed
      // still batches simulation ticks, but at most one rendered frame is queued.
      await device.queue.onSubmittedWorkDone();
      gpuSession.check();
      $("scale").textContent = `${formatNumber(camera.width)} units across`;
    } else previousTime = now;
  } catch (error) {
    fail(error);
  }
  requestAnimationFrame(frame);
}
$("pause").onclick = () => {
  paused = !paused;
  carry = 0;
  controls(true);
  speedTime = performance.now();
  speedTick = engine.tick;
  $("throughput").textContent = paused ? "Paused" : "—";
};
$("step").onclick = () => {
  if (paused) pendingStep = true;
};
$("restart").onclick = () => {
  pendingReset = true;
};
function applySettings(settings) {
  for (const [id, value] of Object.entries(settings)) {
    if (id in functionMasks) {
      functionMasks[id] = value >>> 0;
      continue;
    }
    if (!numericSettings.includes(id)) continue;
    $(id).value = value;
    $(id).dispatchEvent(new Event("input", { bubbles: true }));
  }
  Object.assign(
    functionMasks,
    protectCoreFunctionMasks(functionMasks, TREE_SCHEMA),
  );
  renderReference();
}
function rollWorld() {
  applySettings(
    randomWorldSettings({
      capacity: Number($("capacity").value),
      previousSeed: Number($("seed").value),
    }),
  );
}
$("random-world").onclick = () => {
  rollWorld();
  controls(false);
  pendingReset = true;
};
$("save-world").onclick = () => {
  try {
    const setup = { model: "cellsoup-feature-world-1", config: options() };
    $("export-data").value = JSON.stringify(setup, null, 2);
    $("export-title").textContent = "Save world setup";
    if (exportURL) URL.revokeObjectURL(exportURL);
    exportURL = URL.createObjectURL(
      new Blob([$("export-data").value], { type: "application/json" }),
    );
    $("download-export").href = exportURL;
    $("download-export").download = `cellsoup-world-${setup.config.seed}.json`;
    $("export-status").textContent = "";
    $("export-dialog").showModal();
  } catch (error) {
    notice(error.message, true);
  }
};
$("load-world").onclick = () => $("world-file").click();
$("world-file").onchange = async () => {
  try {
    const file = $("world-file").files[0];
    if (!file) return;
    if (file.size > 1000000) throw Error("World setup is too large.");
    const data = JSON.parse(await file.text()),
      cfg = data.config;
    if (data.model !== "cellsoup-feature-world-1")
      throw Error("This is not a saved world setup.");
    if (!cfg || typeof cfg !== "object")
      throw Error("This file has no world settings.");
    for (const [key, value] of Object.entries(cfg))
      if (
        !(key in defaults) ||
        !Number.isFinite(value) ||
        value < 0 ||
        (key in functionMasks &&
          (!Number.isInteger(value) || value > 4294967295))
      )
        throw Error("Invalid world setting: " + key);
    if (!WORLD_CAPACITIES.includes(cfg.capacity))
      throw Error("Unsupported world capacity.");
    if (cfg.treePrograms !== 1)
      throw Error("This setup does not use typed Lisp trees.");
    if (!Number.isInteger(cfg.side) || cfg.side < 5 || cfg.side > 512)
      throw Error("Invalid habitat size.");
    const previous = {
      capacity: $("capacity").value,
      size: $("habitat-size").value,
      settings: Object.fromEntries(
        numericSettings.map((id) => [id, Number($(id).value)]),
      ),
      masks: { ...functionMasks },
    };
    try {
      $("capacity").value = cfg.capacity;
      syncPopulationLimits();
      $("habitat-size").value = cfg.side * 32;
      $("habitat-size").dispatchEvent(new Event("input"));
      applySettings({ ...defaults, ...cfg });
      options();
      controls(false);
      pendingReset = true;
    } catch (error) {
      $("capacity").value = previous.capacity;
      syncPopulationLimits();
      $("habitat-size").value = previous.size;
      $("habitat-size").dispatchEvent(new Event("input"));
      applySettings({ ...previous.settings, ...previous.masks });
      throw error;
    }
  } catch (error) {
    notice(error.message);
  } finally {
    $("world-file").value = "";
  }
};
$("find").onclick = () => {
  pendingFind = true;
};
$("find-moving").onclick = () => {
  pendingFind = "moving";
};
$("fit").onclick = () => {
  fitWorld();
  notice("");
};
$("speed").onchange = () => {
  carry = 0;
  $("render-note").textContent =
    $("speed").value === "max"
      ? "Max advances 24 ticks between drawings."
      : "Every physics tick is simulated.";
};
function syncPopulationLimits() {
  const capacity = Number($("capacity").value);
  for (const [id, max] of [
    ["initial", capacity / 4],
    ["rate", capacity],
    ["capacityRate", Math.min(capacity, 1024)],
    ["floor", capacity],
  ]) {
    $(id).max = max;
    $(id + "-range").max = max;
  }
}
syncPopulationLimits();
$("capacity").onchange = () => {
  syncPopulationLimits();
  const n = Number($("capacity").value);
  $("rate").value = Math.max(1, n / 4096);
  $("capacityRate").value = Math.min(1024, Math.max(1, n / 512));
  $("floor").value = n / 64;
  $("initial").value = n / 4;
  for (const id of ["rate", "capacityRate", "floor", "initial"])
    $(id).dispatchEvent(new Event("input"));
};
let exportURL = null;
$("export").onclick = () => {
  if (!selectedGenome) return;
  $("export-title").textContent = "Save genome";
  const { slot, ...genome } = selectedGenome;
  const json = JSON.stringify(
    {
      model: "cellsoup-thermal-1",
      observedTick: engine.tick,
      config: engine.cfg,
      kernel: engine.fingerprint,
      genome,
    },
    null,
    2,
  );
  if (exportURL) URL.revokeObjectURL(exportURL);
  exportURL = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  $("export-data").value = json;
  $("download-export").href = exportURL;
  $("download-export").download = `cellsoup-genome-${genome.serial}.json`;
  $("export-status").textContent = "";
  $("export-dialog").showModal();
};
$("close-export").onclick = () => $("export-dialog").close();
$("export-dialog").addEventListener("close", () => {
  if (exportURL) URL.revokeObjectURL(exportURL);
  exportURL = null;
});
$("copy-export").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("export-data").value);
    $("export-status").textContent = "Copied.";
  } catch {
    $("export-data").focus();
    $("export-data").select();
    $("export-status").textContent =
      "Text selected. Use your browser’s Copy command.";
  }
};

let pointer = null;
canvas.addEventListener("pointerdown", (event) => {
  if (!engine || busy) return;
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointer || event.pointerId !== pointer.id) return;
  const dx = event.clientX - pointer.x,
    dy = event.clientY - pointer.y;
  if (
    Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >
    4
  )
    pointer.moved = true;
  if (pointer.moved) {
    camera.overview = false;
    camera.x -= (dx * camera.width) / canvas.clientWidth;
    camera.y -= (dy * camera.width) / canvas.clientWidth;
    $("follow").checked = false;
  }
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});
canvas.addEventListener("pointerup", (event) => {
  if (!pointer || event.pointerId !== pointer.id) return;
  if (!pointer.moved) {
    const r = canvas.getBoundingClientRect();
    pendingPick = {
      x:
        camera.x +
        ((event.clientX - r.left - r.width / 2) * camera.width) / r.width,
      y:
        camera.y +
        ((event.clientY - r.top - r.height / 2) * camera.width) / r.width,
      radius: Math.max(8, (camera.width / r.width) * 12),
    };
  }
  pointer = null;
});
canvas.addEventListener("pointercancel", () => {
  pointer = null;
});
canvas.addEventListener(
  "wheel",
  (event) => {
    if (!engine || busy) return;
    event.preventDefault();
    const r = canvas.getBoundingClientRect(),
      old = camera.width;
    camera.overview = false;
    camera.width = Math.min(
      engine.cfg.side *
        32 *
        Math.max(1, canvas.clientWidth / canvas.clientHeight),
      Math.max(80, old * Math.exp(event.deltaY * 0.0015)),
    );
    if (!$("follow").checked) {
      camera.x +=
        ((event.clientX - r.left - r.width / 2) / r.width) *
        (old - camera.width);
      camera.y +=
        ((event.clientY - r.top - r.height / 2) / r.width) *
        (old - camera.width);
    }
  },
  { passive: false },
);
document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    document.querySelector("dialog[open]") ||
    event.target.closest('input,select,textarea,[contenteditable="true"]')
  )
    return;
  if (event.code === "KeyR" && !$("random-world").disabled) {
    event.preventDefault();
    $("random-world").click();
  }
  if (event.code === "Space" && !$("pause").disabled) {
    event.preventDefault();
    $("pause").click();
  }
});
function renderReference() {
  $("reference-title").textContent = "Functions & evolution palette";
  $("reference-note").textContent =
    "Choose which primitives can appear in new random trees and mutations. Changes apply to the next world. The core toolkit—basic math, comparisons, memory, energy, movement and division—stays enabled. Optional features can be switched off or varied by Random new world. Existing code can still execute disabled forms. Sampling weights further control memory, communication, neighborhood queries and daughter modifiers.";
  const container = document.createElement("div");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Find a function…";
  search.setAttribute("aria-label", "Search functions");
  container.append(search);
  const rows = [];
  const vocabularyTitle = document.createElement("h2");
  vocabularyTitle.textContent = "A vocabulary for the world";
  container.append(vocabularyTitle);
  for (const form of TREE_SURFACE_FORMS) {
    const row = document.createElement("article");
    row.className = "function-entry surface-form";
    const name = document.createElement("code");
    name.textContent = form.signature;
    const description = document.createElement("p");
    description.textContent = form.description;
    const example = document.createElement("pre");
    example.textContent = form.example;
    const palette = document.createElement("small");
    palette.textContent =
      "Uses palette primitives: " + form.canonicalNames.join(", ");
    row.append(name, description, example, palette);
    container.append(row);
    rows.push(row);
  }
  const paletteTitle = document.createElement("h2");
  paletteTitle.textContent = "Evolution switches";
  container.append(paletteTitle);
  for (const fn of FUNCTION_REFERENCE) {
    const row = document.createElement("article");
    row.className = "function-entry";
    const label = document.createElement("label"),
      toggle = document.createElement("input"),
      title = document.createElement("code");
    toggle.type = "checkbox";
    toggle.checked = functionEnabled(fn.name, functionMasks);
    toggle.disabled = fn.essential;
    toggle.setAttribute("aria-label", "Allow " + fn.name + " in evolution");
    toggle.onchange = () => {
      const id = TREE_SCHEMA.findIndex((s) => s.name === fn.name),
        key = "functionMask" + Math.floor(id / 32),
        bit = 1 << (id % 32);
      functionMasks[key] =
        (toggle.checked
          ? functionMasks[key] | bit
          : functionMasks[key] & ~bit) >>> 0;
    };
    title.textContent = fn.name;
    label.append(toggle, title);
    row.append(label);
    const signature = document.createElement("small");
    signature.textContent = `${fn.args.join(", ") || "No inputs"} → ${fn.result === "Any" ? "branch/body type" : fn.result}${fn.essential ? " · core toolkit · always enabled" : ""}`;
    const description = document.createElement("p");
    description.textContent = fn.description;
    const example = document.createElement("pre");
    example.textContent = fn.example;
    row.append(signature, description, example);
    container.append(row);
    rows.push(row);
  }
  search.oninput = () => {
    const query = search.value.toLowerCase();
    for (const row of rows)
      row.hidden = !row.textContent.toLowerCase().includes(query);
  };
  $("reference").replaceChildren(container);
}
$("habitat-size-range").oninput = () => {
  $("habitat-size").value = $("habitat-size-range").value;
};
$("habitat-size").oninput = () => {
  $("habitat-size-range").value = $("habitat-size").value;
};
try {
  const linkedWorld = worldConfigFromUrl(location.href);
  if (linkedWorld) {
    $("capacity").value = linkedWorld.capacity;
    $("habitat-size").value = linkedWorld.side * 32;
    $("habitat-size").dispatchEvent(new Event("input"));
    syncPopulationLimits();
    applySettings(linkedWorld);
  } else rollWorld();
  await start();
} catch (error) {
  fail(error);
}
requestAnimationFrame(frame);
