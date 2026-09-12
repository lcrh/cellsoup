// Calibrate a history intervention on observable computations before applying it
// to evolved controllers. Authored predictors are assays, never founders.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree, TREE_VM_OPS } from "../web/gpu/trees.js";
import { assemble } from "../web/language.js";
import { GPU_SENSORS, GPU_FIELDS } from "../web/gpu/language.js";
import {
  withoutTemporalHistory,
  uploadFixtureCode,
} from "./temporal-ablation.mjs";
const output = process.argv[2];
if (!output) throw Error("Supply output JSON path");
Object.assign(globalThis, globals);
globalThis.__ablationGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__ablationGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const config = {
  treePrograms: 1,
  capacity: 2,
  genomeCapacity: 2,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  sources: 1,
  seed: 42,
  archiveEnabled: 0,
  solarEnabled: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
};
async function run(source, cues) {
  const tree = parseTree(source),
    code = withoutTemporalHistory(tree),
    e = await createLifeEngine(device, config),
    rows = [];
  try {
    await e.fixture({
      programs: [{ tree }, { tree }],
      cells: [
        { x: 40, y: 40, energy: 70 },
        { genome: 1, x: 180, y: 180, energy: 70 },
      ],
    });
    await uploadFixtureCode(device, e, 1, code.changed);
    for (const cue of cues) {
      const state = await e.state(),
        f = new Float32Array(state);
      f[6] = cue;
      f[58] = cue;
      device.queue.writeBuffer(e.currentState, 0, state);
      await e.step();
      const memory = await e.treeMemory();
      rows.push({ cue, intact: memory[7], instantaneous: memory[19] });
    }
    const readback = assemble(
      (await e.genome(1)).bytecode,
      TREE_VM_OPS,
      GPU_SENSORS,
      GPU_FIELDS,
    );
    assert.deepEqual(
      new Uint8Array(readback.buffer),
      new Uint8Array(code.changed.buffer),
    );
    return {
      source,
      config: e.cfg,
      kernel: e.fingerprint,
      original: code.original.source,
      changed: code.changed.source,
      replacements: code.replacements,
      rows,
    };
  } finally {
    e.destroy();
  }
}
const report = {
  scope:
    "The history intervention retains input reads, explicit memory, instruction count and CPU cost. Two past cue sequences end at the same current cue. Controls isolate computational memory from body inertia and ecological effects. The linear predictor is an authored calibration, not evolved intelligence.",
  checks: [],
};
try {
  for (const [expression, stateful] of [
    ["(tag)", false],
    ["(lag (tag))", true],
    ["(delta (tag))", true],
    ["(smooth 0.25 (tag))", true],
  ]) {
    const source = `(set m7 ${expression})`,
      positive = await run(source, [2, 2, 2, 0]),
      negative = await run(source, [-2, -2, -2, 0]);
    assert.equal(positive.rows.at(-1).instantaneous, 0);
    assert.equal(negative.rows.at(-1).instantaneous, 0);
    if (stateful)
      assert.notEqual(positive.rows.at(-1).intact, negative.rows.at(-1).intact);
    else assert.equal(positive.rows.at(-1).intact, negative.rows.at(-1).intact);
    report.checks.push({ expression, stateful, positive, negative });
  }
  const prediction = await run(
    "(set m7 (- (* 2 (tag)) (lag (tag))))",
    [0, 1, 2, 3, 4, 5],
  );
  const mse = (key) =>
    prediction.rows
      .slice(1, -1)
      .reduce(
        (sum, r, i) => sum + (r[key] - prediction.rows[i + 2].cue) ** 2,
        0,
      ) / 4;
  prediction.mse = {
    intact: mse("intact"),
    instantaneous: mse("instantaneous"),
  };
  assert.equal(prediction.mse.intact, 0);
  assert.equal(prediction.mse.instantaneous, 1);
  report.prediction = prediction;
  assert.deepEqual(errors, []);
  report.complete = true;
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "PASS matched history intervention, equal-current/different-past controls and linear-prediction benefit",
  );
} finally {
  device.destroy();
  delete globalThis.__ablationGPU;
}
