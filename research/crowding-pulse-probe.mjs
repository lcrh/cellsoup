// Isolate the observed controller's response to a crowding change. Two passive
// neighbors are positioned symmetrically outside contact-repulsion range.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree, compileTree } from "../web/gpu/trees.js";
import {
  withoutTemporalHistory,
  uploadFixtureCode,
} from "./temporal-ablation.mjs";
import { readCellActivity } from "./colony-activity.mjs";
const [input, output] = process.argv.slice(2);
if (!output) throw Error("Supply candidate and output JSON");
const candidate = JSON.parse(await readFile(input, "utf8")),
  tree = candidate.genome.tree,
  compiled = compileTree(tree);
Object.assign(globalThis, globals);
globalThis.__pulseGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__pulseGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const report = {
  candidate,
  scope:
    "Controlled 60-tick density pulse using two passive neighbors pinned 12 units to either side for ticks 13–36 and 80 units away otherwise. This produces crowding without contact repulsion (range 10). Neighbors track the subject position, fixing the cue independently of its motion. Normal costs, no sunlight or reproduction; three slots already occupied. A manipulated-input assay, not spontaneous behavior or a fitness test.",
  trials: [],
};
try {
  for (const treatment of ["intact", "all", "lag", "delta"]) {
    const slots = compiled.statefulSlots
      .filter((s) => s.op === treatment)
      .map((s) => s.slot);
    const code =
      treatment === "intact"
        ? { original: compiled, changed: compiled, replacements: [] }
        : withoutTemporalHistory(tree, treatment === "all" ? null : slots);
    const e = await createLifeEngine(device, {
      treePrograms: 1,
      capacity: 3,
      genomeCapacity: 2,
      initial: 0,
      floor: 0,
      rate: 0,
      side: 8,
      sources: 1,
      seed: 42,
      solarEnabled: 0,
      archiveEnabled: 0,
    });
    const trial = {
      treatment,
      config: e.cfg,
      kernel: e.fingerprint,
      originalSource: compiled.source,
      alteredSource: code.changed.source,
      replacements: code.replacements,
      rows: [],
    };
    try {
      await e.fixture({
        programs: [{ tree }, { tree: parseTree("(wait 1000)") }],
        cells: [
          { x: 128, y: 128, heading: 0, energy: 24 },
          { genome: 1, x: 128, y: 48, energy: 24 },
          { genome: 1, x: 128, y: 208, energy: 24 },
        ],
        sunlight: 0,
      });
      await uploadFixtureCode(device, e, 0, code.changed);
      for (let tick = 1; tick <= 60; tick++) {
        const state = await e.state(),
          f = new Float32Array(state),
          priorVelocity = f[2],
          near = tick >= 13 && tick <= 36,
          distance = near ? 12 : 80;
        for (let i = 1; i <= 2; i++)
          f.set([f[0], f[1] + (i === 1 ? -distance : distance), 0, 0], i * 52);
        device.queue.writeBuffer(e.currentState, 0, state);
        await e.step();
        const after = await e.state(),
          af = new Float32Array(after),
          au = new Uint32Array(after),
          memory = Array.from(await e.cellMemory(0)),
          activity = await readCellActivity(device, e);
        assert.equal(au[31], 1);
        assert.equal(af[5], 0);
        assert.ok(Math.abs(af[1] - 128) < 1e-5);
        const inferredImpulse = af[2] / Math.fround(0.94) - priorVelocity;
        assert.ok(Math.abs(af[49] - (near ? 2 / 3 : 0)) < 1e-5);
        trial.rows.push({
          tick,
          near,
          crowding: af[49],
          x: af[0],
          vx: af[2],
          inferredImpulse,
          lastThrustTick: activity[0],
          pc: au[26],
          memory,
        });
      }
      if (treatment === "all" || treatment === "delta")
        assert.ok(trial.rows.every((r) => r.vx === 0));
      else {
        assert.ok(trial.rows.some((r) => r.inferredImpulse > 1));
        assert.ok(trial.rows.some((r) => r.inferredImpulse < -1));
      }
      assert.deepEqual(errors, []);
      report.trials.push(trial);
      console.log(
        treatment,
        JSON.stringify(
          trial.rows
            .filter((r) => Math.abs(r.inferredImpulse) > 1e-4)
            .map(({ tick, inferredImpulse }) => ({ tick, inferredImpulse })),
        ),
      );
    } finally {
      e.destroy();
    }
  }
  report.complete = true;
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
} finally {
  device.destroy();
  delete globalThis.__pulseGPU;
}
