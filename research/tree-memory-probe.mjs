// Replay evolved programs as isolated cells. This tests behavioral dependence
// on user-memory reads, not ecological fitness or recurrent computation.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { compileTree, parseTree } from "../web/gpu/trees.js";
import { auditMemory } from "./tree-memory-audit.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw Error(
    "Usage: node research/tree-memory-probe.mjs run.json output.json",
  );
const run = JSON.parse(await readFile(input, "utf8"));
if (!run.survivingTrees) throw Error("Run must include every surviving tree");
const candidates = run.survivingTrees.filter(
  (g) => auditMemory(g.tree).memoryReads,
);
Object.assign(globalThis, globals);
globalThis.__memoryProbeGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__memoryProbeGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const config = {
  treePrograms: 1,
  capacity: 1,
  genomeCapacity: 1,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  sources: 1,
  seed: 813,
  solarEnabled: 0,
  archiveEnabled: 0,
};
function withoutReads(t) {
  return t.op === "memory"
    ? { op: "number", args: [], value: 0 }
    : { ...t, args: t.args.map(withoutReads) };
}
const fields = {
  x: 0,
  y: 1,
  vx: 2,
  vy: 3,
  energyQuanta: 4,
  heading: 5,
  tag: 6,
  shield: 7,
  storageQuanta: 38,
  temperature: 39,
  hue: 48,
};
let probeConfig, probeKernel;
async function replay(tree) {
  const engine = await createLifeEngine(device, config);
  probeConfig = engine.cfg;
  probeKernel = engine.fingerprint;
  try {
    await engine.fixture({
      programs: [{ tree }],
      cells: [{ energy: 70, storage: 24 }],
      sunlight: 0.6,
    });
    const trace = [];
    for (let tick = 0; tick < 600; tick++) {
      await engine.step();
      const state = await engine.state(),
        f = new Float32Array(state),
        u = new Uint32Array(state);
      const row = Object.fromEntries(
        Object.entries(fields).map(([name, i]) => [name, f[i]]),
      );
      row.alive = u[31];
      assert.ok(Object.values(row).every(Number.isFinite));
      trace.push(row);
    }
    return trace;
  } finally {
    engine.destroy();
  }
}
async function compare(tree) {
  const altered = withoutReads(tree);
  // Replacing mem_load by mov must retain instruction timing and all branches.
  const originalCode = compileTree(tree),
    alteredCode = compileTree(altered);
  assert.equal(originalCode.length, alteredCode.length);
  const expected = originalCode.source.replace(
    /mem_load (r\d+) [0-7](?=\n|$)/g,
    "mov $1 0",
  );
  assert.equal(alteredCode.source, expected);
  const original = await replay(tree),
    repeat = await replay(tree),
    zero = await replay(altered);
  assert.deepEqual(
    repeat,
    original,
    "Isolated replay must reproduce before attributing differences to memory",
  );
  const changed = new Set();
  let firstDifferenceTick = null;
  original.forEach((row, i) => {
    for (const key of Object.keys(row))
      if (row[key] !== zero[i][key]) {
        changed.add(key);
        firstDifferenceTick ??= i + 1;
      }
  });
  return {
    firstDifferenceTick,
    changedFields: [...changed],
    finalOriginal: original.at(-1),
    finalZeroReads: zero.at(-1),
  };
}
try {
  const positive = await compare(
    parseTree("(state ((sum 1)) (set! sum (+ sum 1)) (turn sum))"),
  );
  assert.ok(positive.changedFields.includes("heading"));
  const negative = await compare(parseTree("(seq (photosynthesize) (move 1))"));
  assert.equal(negative.firstDifferenceTick, null);
  const results = [];
  for (const gene of candidates) {
    const result = {
      serial: gene.serial,
      livingInSource: gene.living,
      ...(await compare(gene.tree)),
    };
    results.push(result);
    console.log(
      JSON.stringify({
        serial: result.serial,
        firstDifferenceTick: result.firstDifferenceTick,
        changedFields: result.changedFields,
      }),
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    output,
    JSON.stringify(
      {
        sourceRun: input,
        sourceKernel: run.kernel,
        sourceSampler: run.genomeSampler,
        scope:
          "Ten simulated seconds per isolated cell, constant sunlight 0.6, fresh state, no other cells or reproduction (capacity one). All eight user-memory reads replaced by zero with identical compiled instruction count; state initialization and birth-result retained. An original repeat must match exactly. This does not measure ecological fitness, inherited-state behavior, linked communication, or recurrent memory use.",
        config: probeConfig,
        probeKernel,
        controls: { positive, negative },
        results,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  device.destroy();
  delete globalThis.__memoryProbeGPU;
}
