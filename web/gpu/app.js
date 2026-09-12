import { createLifeEngine, defaults } from "./engine.js";
import { TREE_SCHEMA } from "./trees.js";
import { createRenderer } from "./renderer.js";
import { GPU_OPS, GPU_SENSORS, GPU_FIELDS } from "./language.js";
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
const settingGroups = [
  [
    "Evolution",
    [
      ["seed", "Random seed", 0, 4294967295, 1],
      ["rate", "Newcomers / second", 0, 262144, 1],
      ["floor", "Population floor", 0, 262144, 1],
      ["share", "Archive share", 0, 1, 0.05],
      ["mutation", "Resampling mutation", 0, 1, 0.05],
      ["crossover", "Crossover (trees)", 0, 1, 0.05],
    ],
  ],
  [
    "Sunlight & clouds",
    [
      ["solarRate", "Peak photosynthesis / second", 0, 20, 0.5],
      ["sunContrast", "Bright peak rarity", 1, 8, 0.25],
      ["cloudCover", "Cloud coverage", 0, 1, 0.05],
      ["cloudOpacity", "Cloud opacity", 0, 1, 0.05],
      ["cloudScale", "Cloud size (units)", 64, 8192, 1],
      ["cloudSpeed", "Cloud drift (units / sec)", 0, 100, 1],
      ["cloudMorph", "Cloud morph time (sec)", 1, 3600, 1],
    ],
  ],
  [
    "Energy & reserves",
    [
      ["seedEnergy", "Newcomer energy", 1, 200, 1],
      ["seedStorage", "Newcomer storage", 0, 400, 1],
      ["upkeep", "Basic upkeep / sec", 0, 20, 0.05],
      ["energyDecay", "Energy decay / sec", 0, 1, 0.01],
      ["exchange", "Storage sharing / tick", 0, 0.25, 0.01],
      ["corpseLifetime", "Uneaten corpse lifetime (sec)", 1, 7200, 1],
      ["corpseEnergy", "Body material value", 0, 100, 1],
    ],
  ],
  [
    "Temperature",
    [
      ["ambientTemperature", "Ambient temperature (°C)", 0, 100, 1],
      ["sunlightHeating", "Sun heating (°C / sec)", 0, 10, 0.1],
      ["activityHeating", "Activity heat (°C / energy)", 0, 10, 0.01],
      ["cooling", "Cooling / sec", 0, 10, 0.01],
      ["thermalExchange", "Linked heat sharing / tick", 0, 0.25, 0.01],
      ["crowdInsulation", "Crowding insulation", 0, 20, 0.1],
      ["safeTemperature", "Overheating threshold (°C)", 0, 100, 1],
      ["heatDamage", "Overheating energy cost / °C / sec", 0, 20, 0.1],
    ],
  ],
  [
    "Actions & movement",
    [
      ["cpuCost", "Instruction cost", 0, 1, 0.00001],
      ["budget", "Instructions / tick", 0, 128, 1],
      ["divisionCost", "Division cost", 0, 150, 1],
      ["minimumBirthEnergy", "Minimum energy per daughter", 1, 100, 1],
      ["jitter", "Daughter heading jitter", 0, 180, 1],
      ["moveCost", "Movement cost", 0, 10, 0.001],
      ["turnCost", "Turn cost / degree", 0, 1, 0.0001],
      ["attackCost", "Attack base cost", 0, 10, 0.01],
      ["attackDamageCost", "Attack cost / damage", 0, 10, 0.05],
      ["eatCost", "Eating cost", 0, 10, 0.01],
      ["linkCost", "Link cost", 0, 20, 0.1],
      ["contractCost", "Contraction cost", 0, 10, 0.01],
      ["shieldUpkeep", "Shield upkeep / sec", 0, 20, 0.01],
      ["sendCost", "Message cost", 0, 10, 0.01],
      ["emitCost", "Signal cost", 0, 10, 0.01],
    ],
  ],
];
const numericSettings = [];
for (const [title, fields] of settingGroups) {
  const section = document.createElement("details"),
    summary = document.createElement("summary");
  summary.textContent = title;
  section.append(summary);
  section.open = title === "Sunlight & clouds";
  for (const [id, title, min, max, step] of fields) {
    numericSettings.push(id);
    const label = document.createElement("label"),
      input = document.createElement("input");
    label.textContent = title;
    input.id = id;
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = defaults[id];
    label.append(input);
    if (["mutation", "crossover"].includes(id)) {
      input.type = "range";
      const output = document.createElement("output");
      output.htmlFor = id;
      const update = () => {
        output.textContent = `${Math.round(Number(input.value) * 100)}%`;
      };
      input.addEventListener("input", update);
      update();
      label.append(output);
    }
    section.append(label);
  }
  $("settings-fields").append(section);
}
$("rate").value = 8;
$("floor").value = 512;

let device,
  engine,
  renderer,
  paused = false,
  busy = true,
  failed = false;
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
  failed = true;
  paused = true;
  busy = false;
  console.error(error);
  notice(
    `${error.message || error} Open the classic laboratory using the link above.`,
    true,
  );
  $("pause").disabled = true;
  $("step").disabled = true;
  $("find").disabled = true;
  $("restart").disabled = false;
}
function controls(enabled) {
  for (const id of ["pause", "step", "find", "find-moving", "fit", "restart"])
    $(id).disabled = !enabled;
  $("step").disabled = !enabled || !paused;
  $("pause").textContent = paused ? "Resume" : "Pause";
}
function options() {
  const capacity = Number($("capacity").value);
  const cfg = {
    capacity,
    genomeCapacity: capacity / 4,
    treePrograms: Number($("substrate").value === "trees"),
    initial: capacity / 4,
    side: Math.ceil(Math.sqrt(capacity / 2)),
    sources: 1,
  };
  for (const id of numericSettings) {
    const input = $(id);
    if (!input.checkValidity())
      throw Error(
        `Check the value for ${input.parentElement.firstChild.textContent.trim()}.`,
      );
    cfg[id] = Number(input.value);
  }
  if (cfg.floor > capacity || cfg.rate > capacity)
    throw Error("Population floor and newcomer rate must not exceed capacity.");
  return cfg;
}
function fitWorld() {
  camera.x = engine.cfg.side * 16;
  camera.y = camera.x;
  camera.width = engine.cfg.side * 32;
  camera.overview = true;
  $("follow").checked = false;
}
async function start() {
  // Validate before discarding an existing habitat.
  const cfg = options();
  busy = true;
  controls(false);
  notice("Preparing the GPU habitat…");
  if (!device || failed) {
    if (!navigator.gpu) throw Error("WebGPU is unavailable in this browser.");
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) throw Error("No WebGPU adapter is available.");
    device = await adapter.requestDevice();
    const activeDevice = device;
    device.addEventListener("uncapturederror", (event) => {
      if (device === activeDevice) fail(event.error);
    });
    device.lost.then((info) => {
      if (device === activeDevice && info.reason !== "destroyed")
        fail(
          Error("The GPU connection was lost. Start a new soup to reconnect."),
        );
    });
  }
  renderer?.destroy();
  engine?.destroy();
  renderer = null;
  engine = null;
  engine = await createLifeEngine(device, cfg);
  renderer = await createRenderer(
    device,
    canvas,
    engine,
    navigator.gpu.getPreferredCanvasFormat(),
  );
  $("genome-kind").textContent = cfg.treePrograms
    ? "Random typed-tree genomes"
    : "Random assembly genomes";
  renderReference(Boolean(cfg.treePrograms));
  failed = false;
  paused = false;
  selection = null;
  selectedGenome = null;
  snap = null;
  members = [];
  history = [];
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
  $("body-motion").textContent = bodyMotion(snap, body).toFixed(1);
  $("cell-light").textContent = `${Math.round(snap.f[k + 37] * 100)}%`;
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
    $("mutations").textContent = formatNumber(c.mutations);
    $("crossovers").textContent = formatNumber(c.crossovers);
    $("archive").textContent = c.archive;
    const actual = (engine.tick - speedTick) / 60 / ((now - speedTime) / 1000);
    $("throughput").textContent = paused ? "Paused" : `${actual.toFixed(1)}×`;
    speedTime = now;
    speedTick = engine.tick;
    lastMetrics = now;
    if (history.at(-1)?.tick !== engine.tick) {
      history.push({ tick: engine.tick, living: c.living });
      if (history.length > 480) history.shift();
    }
    drawHistory();
  }
}
function drawHistory() {
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
      if (ticks) await engine.step(ticks);
      await observe(performance.now());
      renderer.draw(camera, {
        food: $("food").checked,
        activity: $("activity").checked,
        links: $("links").checked,
        color: Number($("color").value),
        slot: selection?.slot,
        identity: selection?.identity,
      });
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
$("capacity").onchange = () => {
  const n = Number($("capacity").value);
  $("rate").value = Math.max(1, n / 4096);
  $("floor").value = n / 64;
};
let exportURL = null;
$("export").onclick = () => {
  if (!selectedGenome) return;
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
canvas.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !$("pause").disabled) {
    event.preventDefault();
    $("pause").click();
  }
});
// The classic grammar shares opcodes, but the GPU model has distinct costs/limits.
const overrides = {
  split:
    "Detached division: 0 parent, 1 child, −1 failure. Requires division cost plus twice the minimum daughter energy. Division yields this tick.",
  bud: "Connected division, with the same return values and energy threshold as split. Four links maximum.",
  link: "Try to link to a target within 24 units; four links maximum. A paid attempt may lose under contention.",
  bond: "Read linked neighbor handle in slot 0–3; 0 if empty. Use peek to inspect its storage.",
  give: "Give a fraction 0–1 of remaining energy to a target within 18. Keeps one energy quantum; transfers respect recipient capacity.",
  sense: `Read a sensor: ${GPU_SENSORS.join(", ")}.`,
  peek: `Read a nearby living cell or corpse field: ${GPU_FIELDS.join(", ")}.`,
};
function renderReference(trees) {
  $("reference-title").textContent = trees
    ? "Typed-tree reference"
    : "Assembly reference";
  $("reference-note").textContent = trees
    ? "Up to 32 typed nodes. Numbers feed arithmetic, conditions and actions; cell references select targets. Memory m0–m7 persists between evaluations. Division copies the tree and memory; birth-result is 0 for the parent, 1 for its daughter, or −1 on failure. New arrivals may cross compatible subtrees and then mutate."
    : "Eight registers, relative sensing and motion, at most 64 instructions per genome. Division copies code exactly. Archive resampling is the mutation source.";
  const dl = document.createElement("dl");
  if (trees) {
    for (const node of TREE_SCHEMA) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = node.name;
      dd.textContent = `${node.args.join(", ") || "No inputs"} → ${node.result === "Any" ? "matching branch type" : node.result}`;
      dl.append(dt, dd);
    }
  } else
    for (const [op, args, description] of GPU_OPS) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = `${op} ${args}`;
      dd.textContent = overrides[op] || description;
      dl.append(dt, dd);
    }
  $("reference").replaceChildren(dl);
}
function substrateSettings() {
  const trees = $("substrate").value === "trees";
  $("crossover").disabled = !trees;
  $("substrate-note").textContent = trees
    ? "Random typed trees. Archived arrivals can combine two parents, then mutate independently. Division always copies the genome."
    : "Division copies genomes exactly. New arrivals mix random founders and archived lineages.";
}
if (new URLSearchParams(location.search).get("substrate") === "trees")
  $("substrate").value = "trees";
$("substrate").addEventListener("change", substrateSettings);
substrateSettings();
try {
  await start();
} catch (error) {
  fail(error);
}
requestAnimationFrame(frame);
