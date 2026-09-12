// Calibration only. Authored circuits are never inserted into evolving worlds.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree, compileTree, TREE_VM_OPS } from "../web/gpu/trees.js";
import { assemble } from "../web/language.js";
import { GPU_SENSORS, GPU_FIELDS } from "../web/gpu/language.js";
import { uploadFixtureCode } from "./temporal-ablation.mjs";
const output = process.argv[2];
if (!output) throw Error("Supply output JSON");
Object.assign(globalThis, globals);
globalThis.__linkedGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__linkedGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  treePrograms: 1,
  capacity: 4,
  genomeCapacity: 4,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  sources: 1,
  archiveEnabled: 0,
  solarEnabled: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  emitCost: 0,
};
const report = {
  scope:
    "Native GPU checks of previous-tick reciprocal-neighbor averaging and paid publication, followed by an authored recurrent ReLU circuit. This establishes computational opportunity, not evolved coordination or fitness.",
  checks: [],
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
async function fixture(source, cells, signals, config = {}, alter = false) {
  const tree = parseTree(source),
    code = compileTree(tree),
    e = await createLifeEngine(device, { ...base, ...config });
  await e.fixture({
    programs: [{ tree }, { tree: parseTree("(wait 1000)") }],
    cells,
  });
  const state = await e.state(),
    f = new Float32Array(state);
  for (let i = 0; i < signals.length; i++) f.set(signals[i], i * 52 + 16);
  device.queue.writeBuffer(e.currentState, 0, state);
  if (alter) {
    const source = code.source.replace(
      /^linked_listen (r[0-7]) \d+$/gm,
      "mov $1 0",
    );
    assert.notEqual(source, code.source);
    const changed = assemble(source, TREE_VM_OPS, GPU_SENSORS, GPU_FIELDS);
    assert.equal(changed.length, code.length);
    await uploadFixtureCode(device, e, 0, changed);
    const readback = assemble(
      (await e.genome(0)).bytecode,
      TREE_VM_OPS,
      GPU_SENSORS,
      GPU_FIELDS,
    );
    assert.deepEqual(
      new Uint8Array(readback.buffer),
      new Uint8Array(changed.buffer),
    );
  }
  return e;
}
async function sample(e) {
  const f = new Float32Array(await e.state()),
    memory = await e.treeMemory();
  return {
    tick: e.tick,
    cells: Array.from({ length: e.cfg.capacity }, (_, i) => ({
      signal: Array.from(f.slice(i * 52 + 16, i * 52 + 20)),
      energy: f[i * 52 + 4] / 4096,
      tag: f[i * 52 + 6],
      memory: Array.from(memory.slice(i * 12, i * 12 + 8)),
    })),
  };
}
async function check(name, source, cells, signals, expect, config = {}) {
  const e = await fixture(source, cells, signals, config);
  try {
    await e.step();
    const state = await sample(e);
    expect(state);
    assert.deepEqual(errors, []);
    report.checks.push({
      name,
      config: e.cfg,
      kernel: e.fingerprint,
      source,
      state,
    });
    console.log("PASS", name);
  } finally {
    e.destroy();
  }
}
try {
  const cells = [
    { x: 100, y: 100, links: [2, 3, 0, 0] },
    { x: 82, y: 100, genome: 1, links: [1, 0, 0, 0] },
    { x: 118, y: 100, genome: 1, links: [1, 0, 0, 0] },
    { x: 100, y: 118, genome: 1 },
  ];
  const signals = [
    [9, 0, 0, 0],
    [2, 7, 0, 0],
    [6, -1, 0, 0],
    [99, 99, 0, 0],
  ];
  await check(
    "average includes both reciprocal senders, excludes self and nearby unlinked cell",
    "(set m0 (linked-signal c0))",
    cells,
    signals,
    (s) => close(s.cells[0].memory[0], 4),
  );
  await check(
    "channel isolation and repeated reads do not consume",
    "(seq (set m0 (linked-signal c1)) (set m1 (linked-signal c1)))",
    cells,
    signals,
    (s) => {
      close(s.cells[0].memory[0], 3);
      close(s.cells[0].memory[1], 3);
    },
  );
  await check(
    "unilateral link is excluded",
    "(set m0 (linked-signal c0))",
    [
      { ...cells[0], links: [2, 0, 0, 0] },
      { ...cells[1], links: [0, 0, 0, 0] },
    ],
    signals.slice(0, 2),
    (s) => close(s.cells[0].memory[0], 0),
  );
  await check(
    "no neighbors returns zero",
    "(set m0 (linked-signal c0))",
    [{ x: 100, y: 100 }],
    [[9, 0, 0, 0]],
    (s) => close(s.cells[0].memory[0], 0),
  );
  await check(
    "couple publishes and reads previous neighbor state",
    "(set m0 (couple c0 200))",
    cells,
    signals,
    (s) => {
      close(s.cells[0].signal[0], 100);
      close(s.cells[0].memory[0], 4);
    },
  );
  await check(
    "publication keeps ordinary emit energy cost",
    "(set m0 (couple c0 2))",
    cells,
    signals,
    (s) => close(s.cells[0].energy, 70 - Math.round(0.01 * 4096) / 4096),
    { emitCost: 0.01 },
  );
  await check(
    "unaffordable publication preserves reserve but still reads",
    "(set m0 (couple c0 2))",
    [{ ...cells[0], energy: 0.1 }, ...cells.slice(1)],
    signals,
    (s) => {
      close(s.cells[0].energy, Math.round(0.1 * 4096) / 4096);
      close(s.cells[0].signal[0], Math.fround(9 * Math.fround(0.97)));
      close(s.cells[0].memory[0], 4);
    },
    { emitCost: 1 },
  );
  await check(
    "input effects execute once",
    "(set m0 (couple c0 (do (tag-set (+ (tag) 1)) (tag))))",
    cells,
    signals,
    (s) => {
      close(s.cells[0].tag, 1);
      close(s.cells[0].signal[0], 1);
    },
  );
  await check(
    "lazy branch does not publish",
    "(set m0 (if false (couple c0 100) 3))",
    cells,
    signals,
    (s) => {
      close(s.cells[0].memory[0], 3);
      close(s.cells[0].signal[0], Math.fround(9 * Math.fround(0.97)));
    },
  );
  const source =
    "(seq (set m7 (+ (memory m7) 1)) (emit c0 (max 0 (+ (tag) (* 0.5 (linked-signal c0))))))";
  const circuitCells = [
    { x: 82, y: 100, tag: 2, links: [2, 0, 0, 0] },
    { x: 100, y: 100, tag: -0.1, links: [1, 3, 0, 0] },
    { x: 118, y: 100, tag: -0.1, links: [2, 0, 0, 0] },
  ];
  const circuits = [];
  for (const altered of [false, true]) {
    const e = await fixture(
        source,
        circuitCells,
        [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        {},
        altered,
      ),
      rows = [await sample(e)];
    try {
      for (let tick = 1; tick <= 30; tick++) {
        await e.step();
        const row = await sample(e),
          previous = rows.at(-1);
        for (let i = 0; i < 3; i++) {
          const updated = row.cells[i].memory[7] > previous.cells[i].memory[7];
          const neighbors = i === 1 ? [0, 2] : [1];
          const input = altered
            ? 0
            : neighbors.reduce((n, j) => n + previous.cells[j].signal[0], 0) /
              neighbors.length;
          const expected = updated
            ? Math.max(0, Math.fround(circuitCells[i].tag) + 0.5 * input)
            : previous.cells[i].signal[0] * Math.fround(0.97);
          close(row.cells[i].signal[0], expected);
        }
        rows.push(row);
      }
      if (altered) assert.equal(rows.at(-1).cells[2].signal[0], 0);
      else assert.ok(rows.at(-1).cells[2].signal[0] > 0.05);
      circuits.push({ altered, config: e.cfg, kernel: e.fingerprint, rows });
    } finally {
      e.destroy();
    }
  }
  report.checks.push({
    name: "recurrent ReLU signals propagate across two links; matched zero-input control blocks propagation",
    source,
    circuitCells,
    circuits,
  });
  assert.deepEqual(errors, []);
  report.complete = true;
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log("PASS recurrent circuit and matched intervention");
} finally {
  device.destroy();
  delete globalThis.__linkedGPU;
}
