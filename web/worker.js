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
  ms = 0;
let settings = { steps: 24, cap: 8192, mutation: 0.05, food: 1 };
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
  engine.configure(
    settings.steps,
    settings.cap,
    settings.mutation,
    settings.food,
  );
}
function reset(source, seed, ecosystem) {
  engine.reset(seed);
  config();
  selected = 0;
  accumulator = 0;
  if (ecosystem) {
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
  let detail = null,
    genome = null;
  const ptr = selected ? engine.inspect(selected) : 0;
  if (ptr) {
    detail = new Float32Array(mem, ptr, 24).slice();
    genome = new Uint8Array(
      mem,
      engine.genome_ptr(detail[8]),
      engine.genome_len(detail[8]) * 16,
    ).slice().buffer;
  }
  outstanding = true;
  postMessage(
    { type: "frame", cells, links, food, stats, lineages, ms, detail, genome },
    [
      cells.buffer,
      links.buffer,
      food.buffer,
      stats.buffer,
      lineages.buffer,
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
        speed = m.value;
        break;
      case "step":
        if (paused) {
          engine.step(1);
          frame(true);
        }
        break;
      case "reset":
        reset(m.source, m.seed, m.ecosystem);
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
  reset(PRESETS.colony.source, 42, true);
  postMessage({ type: "ready" });
  setInterval(() => {
    const now = performance.now(),
      elapsed = Math.min(100, now - last);
    last = now;
    if (!paused) {
      accumulator += elapsed * speed;
      const ticks = Math.min(12, Math.floor(accumulator / (1000 / 60)));
      if (ticks) {
        const t = performance.now();
        engine.step(ticks);
        ms = ms * 0.85 + ((performance.now() - t) / ticks) * 0.15;
        accumulator -= ticks * (1000 / 60);
        accumulator = Math.min(accumulator, 200);
      }
    }
    if (!paused && now - lastFrame > 33) {
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
