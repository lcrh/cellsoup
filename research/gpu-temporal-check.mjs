// Semantic checks for the isolated temporal-expression experiment. These authored
// controls never enter the evolutionary founder or archive populations.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree, compileTree } from "../web/gpu/trees.js";
const output = process.argv[2];
if (!output)
  throw Error("Usage: node research/gpu-temporal-check.mjs output.json");
Object.assign(globalThis, globals);
globalThis.__temporalGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__temporalGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const config = {
  treePrograms: 1,
  capacity: 4,
  genomeCapacity: 2,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  sources: 1,
  seed: 42,
  solarEnabled: 0,
  archiveEnabled: 0,
  budget: 128,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  moveCost: 0,
  turnCost: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
};
const report = {
  scope:
    "Controlled VM semantics: one history slot per temporal occurrence, zero initial history, single evaluation, lazy branches, nesting, bounded execution, inheritance and fresh archive state. Does not establish evolved use or ecological benefit.",
  checks: [],
};
async function setup(tree, extra = {}, cells = [{ energy: 70, tag: 2 }]) {
  const e = await createLifeEngine(device, { ...config, ...extra });
  await e.fixture({
    programs: [{ tree: typeof tree === "string" ? parseTree(tree) : tree }],
    cells,
  });
  return e;
}
async function cue(e, value) {
  const s = await e.state();
  new Float32Array(s)[6] = value;
  device.queue.writeBuffer(e.currentState, 0, s);
}
async function evaluate(source, cues, expected) {
  const e = await setup(source),
    compiled = compileTree(source),
    rows = [];
  try {
    for (let i = 0; i < cues.length; i++) {
      await cue(e, cues[i]);
      await e.step();
      const memory = Array.from(await e.cellMemory(0));
      assert.equal(memory[7], expected[i]);
      rows.push({ input: cues[i], output: memory[7], memory });
    }
    const r = {
      source,
      compiledSource: compiled.source,
      slots: compiled.statefulSlots,
      rows,
    };
    report.checks.push(r);
    return r;
  } finally {
    e.destroy();
  }
}
try {
  await evaluate("(set m7 (lag (tag)))", [2, 5, -1, 9], [0, 2, 5, -1]);
  await evaluate("(set m7 (delta (tag)))", [2, 5, -1, 9], [2, 3, -6, 10]);
  await evaluate("(set m7 (lag (lag (tag))))", [2, 5, -1, 9], [0, 0, 2, 5]);
  await evaluate(
    "(set m7 (smooth 0.25 (tag)))",
    [8, 8, 0, 0],
    [2, 3.5, 2.625, 1.96875],
  );
  await evaluate("(set m7 (smooth -2 (tag)))", [2, 5, -1], [0, 0, 0]);
  await evaluate("(set m7 (smooth 2 (tag)))", [2, 5, -1], [2, 5, -1]);
  await evaluate(
    "(set m7 (if (> (tag) 0) (lag (tag)) -99))",
    [2, -3, 5],
    [0, -99, 2],
  );
  const once = await evaluate(
    "(set m7 (lag (do (set m0 (+ (memory m0) 1)) (memory m0))))",
    [0, 0, 0],
    [0, 1, 2],
  );
  assert.deepEqual(
    once.rows.map((r) => r.memory[0]),
    [1, 2, 3],
  );
  console.log(
    "PASS lag, delta, smoothing, clamping, nesting, lazy branches and single input evaluation",
  );
  const shared = parseTree("(move (lag (tag)))").args[0];
  const alias = {
    op: "seq",
    args: [
      { op: "set", args: [{ op: "slot", args: [], value: 6 }, shared] },
      { op: "set", args: [{ op: "slot", args: [], value: 7 }, shared] },
    ],
  };
  const a = await setup(alias);
  try {
    await a.step();
    const m = await a.cellMemory(0);
    assert.equal(m[6], 0);
    assert.equal(m[7], 0);
    report.checks.push({
      name: "independent shared AST occurrences",
      memory: Array.from(m),
    });
  } finally {
    a.destroy();
  }
  const slow = await setup("(set m7 (lag (tag)))", { budget: 1 });
  try {
    for (let i = 0; i < 5; i++) {
      await cue(slow, 2 + i * 10);
      await slow.step();
    }
    const m = await slow.cellMemory(0);
    assert.equal(m[0], 2);
    assert.equal(m[7], 0);
    report.checks.push({
      name: "budget-one suspended evaluation retains captured input",
      memory: Array.from(m),
    });
  } finally {
    slow.destroy();
  }
  console.log("PASS unique histories and budget-limited suspended evaluation");
  const division = await setup(
    "(seq (set m7 (lag (tag))) (bud))",
    { capacity: 2 },
    [{ energy: 70, tag: 3 }],
  );
  try {
    await division.step();
    let m = await division.treeMemory();
    assert.equal(m[0], 3);
    assert.equal(m[12], 3);
    assert.equal(m[7], 0);
    assert.equal(m[19], 0);
    await division.step(4);
    m = await division.treeMemory();
    assert.equal(m[7], 3);
    assert.equal(m[19], 3);
    report.checks.push({
      name: "division inherits history",
      memory: Array.from(m),
      counters: await division.counters(),
    });
  } finally {
    division.destroy();
  }
  const archive = await setup(
    "(set m7 (lag (tag)))",
    {
      capacity: 8,
      genomeCapacity: 8,
      rate: 1,
      share: 1,
      mutation: 0,
      crossover: 0,
      archiveEnabled: 1,
      archiveAge: 0,
      archiveHarvest: 0,
      archiveOffspring: 0,
    },
    [{ energy: 70, tag: 3 }],
  );
  try {
    await archive.step(60);
    const u = new Uint32Array(await archive.state());
    let slot = -1;
    for (let i = 0; i < 8; i++)
      if (u[i * 52 + 31] === 1 && u[i * 52 + 25] !== 0) {
        slot = i;
        break;
      }
    assert.ok(slot > 0);
    assert.equal((await archive.cellMemory(0))[0], 3);
    assert.deepEqual(
      Array.from(await archive.cellMemory(slot)),
      Array(8).fill(0),
    );
    await archive.step();
    assert.equal((await archive.cellMemory(slot))[7], 0);
    report.checks.push({
      name: "archive arrival starts with fresh history",
      slot,
      memory: Array.from(await archive.cellMemory(slot)),
    });
  } finally {
    archive.destroy();
  }
  console.log("PASS inherited history and fresh archive arrivals");
  assert.deepEqual(errors, []);
  report.complete = true;
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
} finally {
  device.destroy();
  delete globalThis.__temporalGPU;
}
