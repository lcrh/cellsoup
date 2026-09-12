// Stress an observed reading with a linked publisher; do not count changing
// temporary registers as a change in cellular behavior.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree, compileTree, formatTree } from "../web/gpu/trees.js";
import { linkedSignalDevice } from "./linked-signal-intervention.mjs";
const [input, output] = process.argv.slice(2);
if (!output) throw Error("Supply completed source run and output JSON");
const packed = await readFile(input),
  raw = input.endsWith(".gz") ? gunzipSync(packed) : packed,
  run = JSON.parse(raw),
  genome = run.survivingTrees.find((g) => g.serial === 33540);
assert.ok(genome);
assert.equal(run.config.seed, 901);
assert.equal(run.records.at(-1).seconds, 3600);
assert.equal(genome.tree.op, "seq");
const source = formatTree(genome.tree),
  compiled = compileTree(genome.tree).source;
Object.assign(globalThis, globals);
globalThis.__noopGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__noopGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const report = {
  sourceRun: input,
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  genome,
  source,
  compiled,
  scope:
    "Selected natural program in a 120-tick assay with one linked cell constantly publishing 100 on channel 3. The program unlinks because no corpse is present, so ordinary and zeroed readings are identical. A further constant-100 intervention forces nonzero input despite the missing link. Normal costs, no sunlight, two occupied slots, fresh memory and local/stored energy. Compare all cell-state words except temporary VM registers, plus lifecycle counters. This checks an unused gift amount under strong input, not broad ecological fitness or evolved coordination.",
  trials: [],
};
try {
  for (const treatment of ["intact", "zero", "constant"]) {
    const wrapped =
      treatment !== "intact"
        ? linkedSignalDevice(device, { mode: treatment, value: 100 })
        : null;
    const e = await createLifeEngine(wrapped?.device ?? device, {
      treePrograms: 1,
      capacity: 2,
      genomeCapacity: 2,
      initial: 0,
      floor: 0,
      rate: 0,
      side: 8,
      sources: 1,
      archiveEnabled: 0,
      solarEnabled: 0,
      seed: 901,
    });
    try {
      await e.fixture({
        programs: [{ tree: genome.tree }, { tree: parseTree("(emit c3 100)") }],
        cells: [
          { x: 100, y: 100, energy: 24, storage: 24, links: [2, 0, 0, 0] },
          {
            genome: 1,
            x: 118,
            y: 100,
            energy: 24,
            storage: 24,
            links: [1, 0, 0, 0],
          },
        ],
      });
      const rows = [];
      for (let tick = 1; tick <= 120; tick++) {
        await e.step();
        const state = new Uint32Array(await e.state()),
          registers = Array.from(state.slice(8, 16));
        for (let i = 0; i < 2; i++) state.fill(0, i * 52 + 8, i * 52 + 16);
        const counters = await e.counters();
        delete counters.raw;
        rows.push({ tick, registers, state: Array.from(state), counters });
      }
      report.trials.push({
        treatment,
        config: e.cfg,
        kernel: e.fingerprint,
        actualShaderSha256: wrapped?.actualSha256 ?? e.fingerprint,
        rows,
      });
    } finally {
      e.destroy();
    }
  }
  let registerDifferentTicks = 0;
  for (let i = 0; i < 120; i++) {
    const ordinary = report.trials[0].rows[i],
      a = report.trials[2].rows[i],
      b = report.trials[1].rows[i];
    assert.deepEqual(ordinary, b);
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(a.counters, b.counters);
    if (JSON.stringify(a.registers) !== JSON.stringify(b.registers))
      registerDifferentTicks++;
  }
  assert.ok(registerDifferentTicks > 0);
  assert.deepEqual(errors, []);
  report.registerDifferentTicks = registerDifferentTicks;
  report.linkSlotsAtTick2 = report.trials[0].rows[1].state.slice(32, 36);
  assert.deepEqual(report.linkSlotsAtTick2, [0, 0, 0, 0]);
  report.complete = true;
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "PASS unlink explains zero natural input; forced nonzero input changes registers but not cellular state or lifecycle counters",
    registerDifferentTicks,
  );
} finally {
  device.destroy();
  delete globalThis.__noopGPU;
}
