import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__queryGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __queryGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 16,
  genomeCapacity: 8,
  initial: 0,
  side: 8,
  sources: 1,
  treePrograms: 1,
  forkMutation: 0,
  rate: 0,
  floor: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  exchange: 0,
  solarEnabled: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  jitter: 0,
  loopYield: 0,
  budget: 128,
  queryBudget: 128,
};
async function run(programs, cells, { ticks = 1, ...cfg } = {}) {
  const e = await createLifeEngine(device, { ...base, ...cfg });
  try {
    await e.fixture({
      programs: programs.map((source) => ({ tree: parseTree(source) })),
      cells,
    });
    await e.step(ticks);
    const state = await e.state(),
      f = new Float32Array(state),
      u = new Uint32Array(state),
      mem = await e.treeMemory();
    assert.ok([...f].every(Number.isFinite));
    return {
      f: [...f],
      u: [...u],
      mem: [...mem],
      counters: await e.counters(),
    };
  } finally {
    e.destroy();
  }
}
const idle = "(wait 1000)";
function near(a, b, tol = 1e-3) {
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
}
try {
  let result = await run(
    [
      "(seq (set m0 (+ 7 (count living 80))) (set m1 (distance (nearest corpse 100))) (wait 1000))",
      idle,
    ],
    [
      { x: 100, y: 100 },
      { x: 120, y: 100, genome: 1 },
      { x: 180, y: 100, genome: 1, corpse: true },
    ],
  );
  near(result.mem[0], 8);
  near(result.mem[1], 80);
  checks.push(
    "pure predicate isolation, live/dead selection, target reads beyond60",
  );
  result = await run(
    [
      "(seq (set m0 (count (and living (where (> (storage candidate) (memory m2)))) 80)) (wait 1000))",
      idle,
    ],
    [
      { x: 100, y: 100, memory: [0, 0, 4] },
      { x: 120, y: 100, genome: 1, storage: 9 },
      { x: 100, y: 120, genome: 1, storage: 2 },
    ],
  );
  near(result.mem[0], 1);
  checks.push("short-circuit filter and own memory");
  result = await run(
    [
      "(seq (set m0 (orientation (centroid living 100))) (set m1 (distance (centroid living 100))) (set m2 (alignment living 100)) (wait 1000))",
      idle,
    ],
    [
      { x: 250, y: 100, heading: 0.25 },
      { x: 10, y: 100, heading: 0.5, genome: 1 },
      { x: 26, y: 100, heading: 0.5, genome: 1 },
    ],
  );
  near(result.mem[0], -90);
  near(result.mem[1], 24);
  near(result.mem[2], 90);
  checks.push("wrapped centroid, relative alignment");
  result = await run(
    ["(seq (set m0 (count living 128)) (wait 1000))", idle],
    Array.from({ length: 12 }, (_, i) => ({
      x: 100 + i,
      y: 100,
      genome: i ? 1 : 0,
    })),
    { queryBudget: 3 },
  );
  assert.ok(result.mem[0] <= 3);
  checks.push("candidate cap");
  const sender =
    "(seq (send-linked c2 7 (where (> (storage candidate) 4))) (wait 1000))";
  result = await run(
    [sender, "(seq (wait 1) (set m0 (receive c2 living)) (wait 1000))"],
    [
      { x: 100, y: 100, links: [2, 3, 0, 0] },
      { x: 114, y: 100, genome: 1, storage: 10, links: [1, 0, 0, 0] },
      { x: 100, y: 114, genome: 1, storage: 1, links: [1, 0, 0, 0] },
    ],
    { ticks: 4 },
  );
  near(result.mem[12], 7);
  near(result.mem[24], 0);
  checks.push("filtered recipient mask and channel delivery");
  for (const mutation of [0, 1]) {
    result = await run(
      ["(seq (child-set m0 7) (child-turn 90) (bud) (wait 1000))"],
      [{ x: 100, y: 100, energy: 120, memory: [3] }],
      { forkMutation: mutation, ticks: 16 },
    );
    const child = Array.from({ length: 16 }, (_, i) => i).find(
      (i) => result.u[i * 52 + 30],
    );
    assert.ok(child !== undefined);
    near(result.mem[0], 3);
    near(result.mem[child * 12], 7);
    assert.ok((result.mem[child * 12 + 9] & 1) !== 0);
    near(result.f[child * 52 + 5], 0.25, 0.04);
    checks.push(`daughter state and heading with mutation${mutation}`);
  }
  // A long cyclic organism is not approximated by a fixed message-hop radius.
  const count = 256,
    cells = Array.from({ length: count }, (_, i) => ({
      x: 100,
      y: 100,
      links: [((i + 1) % count) + 1, ((i + count - 1) % count) + 1, 0, 0],
    }));
  result = await run(["(seq (set m0 (colony-size)) (wait 1000))"], cells, {
    capacity: 512,
  });
  for (let i = 0; i < count; i++) near(result.mem[i * 12], count);
  checks.push("exact256-cell cyclic colony");
  result = await run(
    ["(seq (set m0 (colony-size)) (wait 1000))"],
    [
      { x: 250, y: 100, links: [2, 0, 0, 0] },
      { x: 8, y: 100, links: [1, 0, 0, 0] },
      { x: 100, y: 100, links: [1, 0, 0, 0] },
      { x: 110, y: 100, corpse: true, links: [3, 0, 0, 0] },
    ],
  );
  near(result.mem[0], 2);
  near(result.mem[12], 2);
  near(result.mem[24], 1);
  checks.push("colony seam, disconnected and unilateral/corpse exclusions");
  result = await run(
    [
      "(seq (child-set m0 9) (child-turn 90) (bud) (mobilize 60) (bud) (wait 1000))",
    ],
    [{ x: 100, y: 100, energy: 20, storage: 80, memory: [3] }],
    { ticks: 2 },
  );
  let child = Array.from({ length: 16 }, (_, i) => i).find(
    (i) => result.u[i * 52 + 30],
  );
  assert.ok(child !== undefined);
  near(result.mem[child * 12], 9);
  near(result.f[child * 52 + 5], 0.25, 0.04);
  checks.push("failed division retains daughter modifiers");
  result = await run(
    ["(seq (child-set m0 7) (split) (split) (wait 1000))"],
    [{ x: 100, y: 100, energy: 160, memory: [3] }],
    { ticks: 2 },
  );
  const children = Array.from({ length: 16 }, (_, i) => i).filter(
    (i) => result.u[i * 52 + 30],
  );
  assert.equal(children.length, 2);
  assert.deepEqual(children.map((i) => result.mem[i * 12]).sort(), [3, 7]);
  checks.push("daughter modifier is one-shot");
  result = await run(
    ["(seq (set m0 (count living 128)) (wait 1000))", idle],
    [
      { x: 80, y: 80 },
      { x: 90, y: 80, genome: 1 },
    ],
    { side: 5 },
  );
  near(result.mem[0], 1);
  checks.push("small wrapped habitats do not duplicate candidates");
  result = await run(
    [
      "(seq (set m0 (sin 1.57079632679)) (set m1 (cos 0)) (set m2 (time)) (set m3 (swish -2)) (set m4 (relu -2)) (wait 1000))",
    ],
    [{ energy: 70 }],
  );
  near(result.mem[0], 1);
  near(result.mem[1], 1);
  near(result.mem[2], 1 / 60);
  near(result.mem[3], -2 / (1 + Math.exp(2)));
  near(result.mem[4], 0);
  checks.push("radian sin/cos, simulated time, swish and zero gate");
  const costly = "(seq (set m0 (count living 80)) (wait 1000))";
  const alone = await run([costly, idle], [{ x: 100, y: 100, energy: 70 }], {
    cpuCost: 0.01,
  });
  const neighbor = await run(
    [costly, idle],
    [
      { x: 100, y: 100, energy: 70 },
      { x: 120, y: 100, genome: 1 },
    ],
    { cpuCost: 0.01 },
  );
  assert.ok(neighbor.f[4] < alone.f[4]);
  checks.push("predicate instructions pay configured CPU energy");
  result = await run(
    [
      "(seq (set m0 (sin 999999)) (set m1 (cos -999999)) (set m2 (swish -999999)) (set m3 (count (where (> (sin (time)) 0)) 80)) (wait 1000))",
      idle,
    ],
    [
      { x: 100, y: 100 },
      { x: 120, y: 100, genome: 1 },
    ],
  );
  assert.ok(Math.abs(result.mem[0]) <= 1);
  assert.ok(Math.abs(result.mem[1]) <= 1);
  near(result.mem[2], 0);
  near(result.mem[3], 1);
  checks.push("finite extreme activation inputs and pure trigonometric filter");
  result = await run(
    [
      "(seq (send-linked c1 5 living) (wait 1000))",
      "(seq (wait 1) (set m0 (receive c1 corpse)) (set m1 (receive c1 living)) (wait 1000))",
    ],
    [
      { x: 100, y: 100, links: [2, 0, 0, 0] },
      { x: 114, y: 100, links: [1, 0, 0, 0], genome: 1 },
    ],
    { ticks: 4 },
  );
  near(result.mem[12], 0);
  near(result.mem[13], 5);
  checks.push("unmatched receive preserves mailbox for matching filter");
  let seed = 771;
  const rng = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const shuffled = Array.from({ length: 512 }, (_, i) => i);
  for (let i = 511; i > 0; i--) {
    let j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const graph = Array.from({ length: 512 }, () => ({
    x: 100,
    y: 100,
    links: [],
  }));
  for (let group = 0; group < 2; group++) {
    let order = shuffled.slice(group * 256, (group + 1) * 256);
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 256; i++) {
        graph[order[i]].links.push(
          order[(i + 1) % 256] + 1,
          order[(i + 255) % 256] + 1,
        );
      }
      order = order.slice().sort(() => rng() - 0.5);
    }
  }
  result = await run(["(seq (set m0 (colony-size)) (wait 1000))"], graph, {
    capacity: 1024,
  });
  for (let i = 0; i < 512; i++) near(result.mem[i * 12], 256);
  checks.push(
    "concurrent union with shuffled roots, cycles and two disconnected256-cell colonies",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-neighborhood-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ checks }));
} finally {
  device.destroy();
  delete globalThis.__queryGPU;
}
