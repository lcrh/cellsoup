import { assemble } from "./language.js";
import { PRESETS } from "./presets.js";
let engine,
  paused = false,
  speed = 1,
  selected = 0,
  outstanding = false,
  dirty = true,
  last = performance.now(),
  lastFrame = 0,
  accumulator = 0,
  ms = 0,
  ticksSinceFrame = 0;
let settings = {
  steps: 24,
  cap: 8192,
  mutation: 0,
  birthJitter: 12,
  food: 1,
  foodMemory: 20,
  foodWander: 0.22,
  foodVariation: 0.4,
  floor: 2048,
  arrivalRate: 8,
  drawEvery: 60,
  costs: [2, 0.0005, 12, 0.04, 0.5, 0.08, 0.08, 0.01, 0.72, 0.001, 0.01],
  archiveShare: 0.5,
  sampleMutation: 0.8,
};
function load(source) {
  const p = assemble(source);
  new Uint8Array(
    engine.memory.buffer,
    engine.upload_ptr(),
    p.buffer.byteLength,
  ).set(new Uint8Array(p.buffer));
  const g = engine.load_program(p.length);
  if (g < 0)
    throw Error(
      "Genome capacity reached. Reset the dish to load more programs.",
    );
  return g;
}
function config() {
  engine.configure_births(settings.birthJitter);
  settings.costs.forEach((cost, i) => engine.set_cost(i, cost));
  engine.configure_food(
    settings.foodMemory,
    settings.foodWander,
    settings.foodVariation,
  );
  engine.configure_arrivals(
    settings.floor,
    settings.archiveShare,
    settings.sampleMutation,
    settings.arrivalRate,
  );
  engine.configure(
    settings.steps,
    settings.cap,
    settings.mutation,
    settings.food,
  );
}
function reset(source, seed, scenario = "random") {
  engine.reset(seed);
  config();
  selected = 0;
  accumulator = 0;
  ticksSinceFrame = 0;
  if (scenario === "random") {
    engine.seed_random(Math.min(512, settings.cap));
  } else if (scenario === "ecosystem") {
    const colony = load(PRESETS.colony.source);
    engine.seed_cells(96, 560, 500, 230, colony);
    const grazer = load(PRESETS.grazer.source);
    engine.seed_cells(180, 1050, 500, 310, grazer);
    const predator = load(PRESETS.predator.source);
    engine.seed_cells(32, 850, 350, 160, predator);
    engine.add_food(560, 500, 20);
    engine.add_food(690, 460, 20);
    engine.add_food(470, 630, 20);
  } else {
    const g = load(source);
    engine.seed_cells(128, 800, 500, 300, g);
  }
  last = performance.now();
  frame(true);
}
function frame(force = false) {
  if (force) dirty = true;
  if (outstanding) return;
  dirty = false;
  ticksSinceFrame = 0;
  const n = engine.snapshot(),
    mem = engine.memory.buffer;
  const stats = new Float32Array(mem, engine.stats_ptr(), 24).slice();
  const lineages = new Float32Array(
    mem,
    engine.lineages_ptr(),
    stats[16] * 12,
  ).slice();
  const cells = new Float32Array(mem, engine.render_ptr(), n * 8).slice();
  const links = new Float32Array(mem, engine.lines_ptr(), stats[4] * 4).slice();
  const food = new Float32Array(mem, engine.food_ptr(), 128 * 80).slice();
  let body = new Float32Array(0);
  let detail = null,
    genome = null;
  const ptr = selected ? engine.inspect(selected) : 0;
  if (ptr) {
    detail = new Float32Array(mem, ptr, 32).slice();
    body = new Float32Array(mem, engine.organism_ptr(), detail[24] * 8).slice();
    genome = new Uint8Array(
      mem,
      engine.genome_ptr(detail[8]),
      engine.genome_len(detail[8]) * 16,
    ).slice().buffer;
  }
  outstanding = true;
  postMessage(
    {
      type: "frame",
      paused,
      speed,
      cells,
      links,
      food,
      stats,
      lineages,
      ms,
      detail,
      genome,
      body,
      selection: selected,
    },
    [
      cells.buffer,
      links.buffer,
      food.buffer,
      stats.buffer,
      lineages.buffer,
      body.buffer,
      ...(detail ? [detail.buffer, genome] : []),
    ],
  );
}
self.onmessage = ({ data: m }) => {
  try {
    if (!engine) return;
    switch (m.type) {
      case "ack":
        outstanding = false;
        if (dirty) frame();
        break;
      case "pause":
        paused = m.value;
        accumulator = 0;
        last = performance.now();
        frame(true);
        break;
      case "speed":
        speed =
          m.value === "max"
            ? "max"
            : Math.max(0.25, Math.min(8, Number(m.value) || 1));
        accumulator = 0;
        last = performance.now();
        break;
      case "step":
        if (paused) {
          engine.step(1);
          frame(true);
        }
        break;
      case "reset":
        reset(m.source, m.seed, m.scenario);
        break;
      case "config":
        Object.assign(settings, m.settings);
        config();
        frame(true);
        break;
      case "food":
        engine.add_food(m.x, m.y, 20);
        frame(true);
        break;
      case "seed": {
        const g = load(m.source);
        const n = engine.seed_cells(m.n ?? 32, m.x, m.y, 30, g);
        postMessage({ type: "notice", text: `Added ${n} cells.` });
        frame(true);
        break;
      }
      case "inspect":
        selected = m.id;
        frame(true);
        break;
    }
  } catch (error) {
    postMessage({ type: "error", text: error.message });
  }
};
try {
  const response = await fetch(new URL("./engine.wasm", import.meta.url));
  if (!response.ok) throw Error(`WASM request failed (${response.status}).`);
  const result = await WebAssembly.instantiate(
    await response.arrayBuffer(),
    {},
  );
  engine = result.instance.exports;
  reset(null, 42, "random");
  postMessage({ type: "ready" });
  setInterval(() => {
    const now = performance.now(),
      elapsed = Math.min(100, now - last);
    last = now;
    if (!paused) {
      const started = performance.now();
      let ticks = 0;
      if (speed === "max") {
        // Bounded batches let messages interrupt between passes. Physics stays at 60 Hz.
        do {
          engine.step(4);
          ticks += 4;
        } while (performance.now() - started < 12);
      } else {
        accumulator += elapsed * speed;
        ticks = Math.min(12, Math.floor(accumulator / (1000 / 60)));
        if (ticks) {
          engine.step(ticks);
          accumulator -= ticks * (1000 / 60);
          accumulator = Math.min(accumulator, 200);
        }
      }
      if (ticks) {
        ms = ms * 0.85 + ((performance.now() - started) / ticks) * 0.15;
        ticksSinceFrame += ticks;
      }
    }
    const drawEvery = Math.max(
      1,
      Math.min(3600, Number(settings.drawEvery) || 60),
    );
    if (
      !paused &&
      now - lastFrame > 33 &&
      (speed !== "max" || ticksSinceFrame >= drawEvery)
    ) {
      frame();
      lastFrame = now;
    }
  }, 8);
} catch (error) {
  postMessage({
    type: "error",
    text: `Unable to start simulation: ${error.message}`,
  });
}
