// Optional, read-only behavior recording alongside long ecological trials.
import assert from "node:assert/strict";
import { writeFile, rename } from "node:fs/promises";
import { createBehaviorSampler } from "../web/gpu/behavior-sampler.js";
import {
  estimateBehavior,
  shuffleBehavior,
  OBSERVER_VERSION,
  SAMPLE_TICKS,
  WINDOW,
} from "../web/gpu/epiplexity.js";
export async function createEvolutionBehaviorObserver(device, engine, out) {
  const sampler = await createBehaviorSampler(device, engine),
    frames = [];
  let nextTick = 0,
    samples = 0;
  const report = {
    complete: false,
    observer: OBSERVER_VERSION,
    sampleTicks: SAMPLE_TICKS,
    window: WINDOW,
    config: { ...engine.cfg },
    kernel: engine.fingerprint,
    genomeSampler: engine.genomeSampler,
    measurements: [],
    scope:
      "Observational, bounded whole-world MDL estimate. Random colors and genome identities excluded. A larger score does not establish adaptive behavior or cooperation. Rolling windows overlap and are not independent replicates.",
  };
  return {
    async observe() {
      if (engine.tick < nextTick) return;
      assert.equal(engine.tick, nextTick, "Skipped behavior sample");
      const sample = await sampler.sample();
      assert.equal(sample.tick, engine.tick);
      frames.push(sample.symbols);
      if (frames.length > WINDOW) frames.shift();
      samples++;
      nextTick += SAMPLE_TICKS;
      if (frames.length === WINDOW && (samples - WINDOW) % 8 === 0) {
        const estimate = estimateBehavior(frames),
          shuffled = estimateBehavior(shuffleBehavior(frames));
        report.measurements.push({
          tick: engine.tick,
          living: sample.living,
          estimate,
          shuffled,
        });
        // Keep only the last fitted window; older estimates retain all candidate scores.
        report.frames = frames.map((f) => Array.from(f));
        report.fromTick = engine.tick - (WINDOW - 1) * SAMPLE_TICKS;
        report.toTick = engine.tick;
      }
    },
    async checkpoint(complete = false) {
      report.complete = complete;
      report.sampledThroughTick = nextTick - SAMPLE_TICKS;
      report.samples = samples;
      await writeFile(
        out + "/behavior.tmp.json",
        JSON.stringify(report, null, 2) + "\n",
      );
      await rename(out + "/behavior.tmp.json", out + "/behavior.json");
    },
    destroy() {
      sampler.destroy();
    },
  };
}
