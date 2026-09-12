import assert from "node:assert/strict";
import { writeFile, rename } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { createBehaviorSampler } from "../web/gpu/behavior-sampler.js";
import { estimateBehavior, shuffleBehavior } from "../web/gpu/epiplexity.js";
const [output, secondsArg = "180", seedArg = "42"] = process.argv.slice(2),
  seconds = Number(secondsArg),
  seed = Number(seedArg);
assert.ok(
  output &&
    Number.isInteger(seconds) &&
    seconds >= 64 &&
    seconds <= 3600 &&
    seconds % 2 === 0,
);
Object.assign(globalThis, globals);
globalThis.__behaviorRunGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__behaviorRunGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const engine = await createLifeEngine(device, {
  capacity: 32768,
  genomeCapacity: 8192,
  initial: 8192,
  side: 128,
  sources: 1,
  seed,
  rate: 8,
  floor: 512,
});
let sampler;
const report = {
  complete: false,
  config: engine.cfg,
  kernel: engine.fingerprint,
  scope:
    "Fixed 120-tick coarse whole-world recording; rolling 32-frame estimates with distinct training, selection and final-test blocks. This is an observational run, not evidence that a larger score improves fitness or cooperation.",
  measurements: [],
  captureMs: 0,
  computeMs: 0,
  analysisMs: 0,
};
async function save() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(output + ".tmp", output);
}
try {
  sampler = await createBehaviorSampler(device, engine);
  const frames = [];
  for (let tick = 0; tick <= seconds * 60; tick += 120) {
    if (tick) {
      const start = performance.now();
      await engine.step(120);
      report.computeMs += performance.now() - start;
    }
    const start = performance.now(),
      sample = await sampler.sample();
    report.captureMs += performance.now() - start;
    assert.equal(sample.tick, tick);
    frames.push(sample.symbols);
    if (frames.length > 32) frames.shift();
    if (frames.length === 32 && (tick / 120 - 31) % 8 === 0) {
      const begin = performance.now(),
        estimate = estimateBehavior(frames),
        shuffled = estimateBehavior(shuffleBehavior(frames));
      report.analysisMs += performance.now() - begin;
      const counters = await engine.counters();
      assert.equal(sample.living, counters.living);
      report.measurements.push({
        tick,
        living: sample.living,
        estimate,
        shuffled,
      });
      report.frames = frames.map((f) => Array.from(f));
      report.fromTick = tick - 31 * 120;
      report.toTick = tick;
      await save();
      console.log(
        JSON.stringify({
          tick,
          living: sample.living,
          bits: estimate.epiplexityBits,
          noise: estimate.unpredictedBitsPerToken,
          shuffled: shuffled.epiplexityBits,
          model: estimate.selected.id,
        }),
      );
    }
    assert.deepEqual(errors, []);
  }
  report.complete = true;
  await save();
} finally {
  sampler?.destroy();
  engine.destroy();
  device.destroy();
  delete globalThis.__behaviorRunGPU;
}
