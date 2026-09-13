import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { create, globals } from "webgpu";
import { createLifeEngine, defaults } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
if (!process.argv[2])
  throw Error(
    "Supply an exported baseline shader module; see research/gpu-work-limits.md",
  );
const before = (await import(pathToFileURL(process.argv[2]))).simulationShader;
Object.assign(globalThis, globals);
globalThis.__limitsGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __limitsGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 32,
  genomeCapacity: 4,
  initial: 0,
  side: 16,
  sources: 1,
  treePrograms: 1,
  forkMutation: 0,
  rate: 0,
  floor: 0,
  capacityRate: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  exchange: 0,
  solarEnabled: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  archiveEnabled: 0,
  loopYield: 0,
  budget: 128,
  queryBudget: 128,
};
async function run(original, program, cells, config = {}, ticks = 4) {
  const cfg = { ...base, ...config };
  const chosen = original
    ? new Proxy(device, {
        get(target, key) {
          if (key === "createShaderModule")
            return (descriptor) =>
              target.createShaderModule({
                ...descriptor,
                code: before({ ...defaults, ...cfg }),
              });
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      })
    : device;
  const e = await createLifeEngine(chosen, cfg);
  try {
    await e.fixture({ programs: [{ tree: parseTree(program) }], cells });
    const start = performance.now();
    await e.step(ticks);
    const elapsed = performance.now() - start,
      data = await e.state(),
      f = new Float32Array(data),
      u = new Uint32Array(data),
      c = await e.counters();
    for (let i = 0; i < cells.length; i++)
      for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 36, 37, 38, 39, 48, 49, 50, 51])
        assert.ok(Number.isFinite(f[i * 52 + k]));
    return {
      elapsed,
      f: [...f],
      u: [...u],
      memory: [...(await e.treeMemory())],
      counters: c,
    };
  } finally {
    e.destroy();
  }
}
try {
  const program =
    "(seq (set m0 (+ 7 (count living 80))) (set m1 (orientation (centroid living 80))) (wait 1000))";
  const sparse = Array.from({ length: 16 }, (_, i) => ({
    x: 50 + (i % 4) * 25,
    y: 50 + Math.floor(i / 4) * 25,
    energy: 70,
  }));
  const a = await run(true, program, sparse),
    b = await run(false, program, sparse);
  assert.deepEqual(b.u, a.u);
  assert.deepEqual(b.memory, a.memory);
  assert.ok(b.memory[0] > 7);
  assert.equal(b.counters.queryBudgetLimits, 0);
  assert.equal(b.counters.denseScanLimits, 0);
  checks.push(
    "sparse multi-cell state and memory exactly match the original shader",
  );
  const pair = [
    { x: 100, y: 100, links: [2, 0, 0, 0] },
    { x: 120, y: 100, links: [1, 0, 0, 0] },
  ];
  const x = await run(true, "(seq (move .5) (wait 1000))", pair),
    y = await run(false, "(seq (move .5) (wait 1000))", pair);
  assert.deepEqual(y.u, x.u);
  checks.push(
    "ordinary linked forces and motion exactly match original shader",
  );
  const dense = [];
  for (const n of [256, 1024, 4096]) {
    const cells = Array.from({ length: n }, () => ({
      x: 200,
      y: 200,
      energy: 70,
    }));
    const old = await run(true, "(wait 1000)", cells, { capacity: n }, 3),
      guarded = await run(false, "(wait 1000)", cells, { capacity: n }, 3);
    if (n > 512) assert.ok(guarded.counters.denseScanLimits > 0);
    else assert.equal(guarded.counters.denseScanLimits, 0);
    assert.equal(guarded.counters.living, n);
    dense.push({
      cells: n,
      originalMilliseconds: old.elapsed,
      boundedMilliseconds: guarded.elapsed,
      denseScanLimits: guarded.counters.denseScanLimits,
    });
  }
  checks.push(
    "concentrated 256/1024/4096-cell physics remains finite and reports capped contacts",
  );
  const predicate =
    "(seq (set m0 (count (where (> (+ (energy candidate) (* (memory m1) (memory m2))) 0)) 80)) (wait 0))";
  const cells = Array.from({ length: 1024 }, () => ({
    x: 200,
    y: 200,
    energy: 70,
  }));
  const queries = await run(false, predicate, cells, { capacity: 1024 }, 4);
  assert.ok(queries.counters.queryBudgetLimits > 0);
  checks.push(
    "shared predicate fuel bounds repeated expensive filters and reports limits",
  );
  const repeated = await run(
    false,
    "(seq (set m0 (target-energy (nearest-cell))) (set m1 (listen c0)) (wait 0))",
    cells,
    { capacity: 1024 },
    4,
  );
  assert.ok(repeated.counters.queryBudgetLimits > 0);
  checks.push(
    "legacy nearest and listening scans share a per-cell visit budget",
  );
  const cyclicCells = Array.from({ length: 4096 }, (_, i) => ({
    x: 200,
    y: 200,
    energy: 70,
    links: [((i + 1) % 4096) + 1, ((i + 4095) % 4096) + 1, 0, 0],
  }));
  const colony = await run(
    false,
    "(seq (set m0 (colony-size)) (wait 1000))",
    cyclicCells,
    { capacity: 4096 },
    1,
  );
  for (let i = 0; i < 4096; i++) assert.equal(colony.memory[i * 12], 4096);
  checks.push(
    "exact colony size survives a4096-cell cycle with compressed root traversal",
  );
  const crowdedPair = Array.from({ length: 1024 }, (_, i) => ({
    x: i === 1 ? 230 : 200,
    y: 200,
    energy: 70,
    links: i === 0 ? [2, 0, 0, 0] : i === 1 ? [1, 0, 0, 0] : [0, 0, 0, 0],
  }));
  const springs = await run(
    false,
    "(wait 1000)",
    crowdedPair,
    { capacity: 1024 },
    1,
  );
  assert.ok(springs.counters.denseScanLimits > 0);
  assert.ok(springs.f[2] > 0);
  checks.push(
    "direct spring forces still execute after crowded contact budgets are exhausted",
  );
  assert.deepEqual(errors, []);
  const report = {
    complete: true,
    checks,
    dense,
    largeColony: { cells: 4096, milliseconds: colony.elapsed },
    predicate: {
      milliseconds: queries.elapsed,
      limitedCellTicks: queries.counters.queryBudgetLimits,
    },
    limits: {
      spatialVisitsPerScan: 512,
      vmVisitsPerTick: 1024,
      predicateStepsPerTick: 1024,
    },
    scope:
      "Finite reproducible synthetic stress and unchanged sparse fixtures; not reproduction of the reported browser device loss.",
  };
  await writeFile(
    process.argv[3] ?? "/private/tmp/cellsoup-work-limits-check.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  device.destroy();
  delete globalThis.__limitsGPU;
}
