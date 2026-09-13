import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__specializationGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __specializationGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 8,
  genomeCapacity: 4,
  initial: 0,
  side: 8,
  sources: 1,
  treePrograms: 0,
  forkMutation: 0,
  rate: 0,
  floor: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  exchange: 0,
  solarEnabled: 0,
  solarRate: 6,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  eatCost: 0,
  specializationTime: 60,
};
async function run(
  source,
  cells,
  { ticks = 1, sunlight = 1, ...settings } = {},
) {
  const e = await createLifeEngine(device, { ...base, ...settings });
  try {
    await e.fixture({ programs: [source], cells, sunlight });
    await e.step(ticks);
    const b = await e.state(),
      f = new Float32Array(b),
      u = new Uint32Array(b);
    return {
      cells: cells.map((_, i) => ({
        energy: f[i * 52 + 4] / 4096,
        storage: f[i * 52 + 38] / 4096,
        life: u[i * 52 + 31],
        register: f[i * 52 + 8],
      })),
      histories: await Promise.all(
        cells.map((_, i) => e.cellSpecialization(i)),
      ),
      counters: await e.counters(),
      allState: [...u],
    };
  } finally {
    e.destroy();
  }
}
try {
  for (const pathway of ["photosynthesize r0", "eat r0", "mobilize r0 3"]) {
    const cells = [
      { x: 100, y: 100, energy: 20, storage: 12 },
      ...(pathway === "eat r0"
        ? [{ x: 108, y: 100, corpse: true, energy: 30 }]
        : []),
    ];
    const a = await run(pathway + "\nwait 1000", cells, {
      specializationStrength: 0,
    });
    const b = await run(pathway + "\nwait 1000", cells, {
      specializationStrength: 0.6,
    });
    const idx = pathway.startsWith("photo")
      ? 0
      : pathway.startsWith("eat")
        ? 1
        : 2;
    assert.ok(a.cells[0].register > 0);
    assert.ok(
      Math.abs(b.cells[0].register - a.cells[0].register * 0.4) < 1 / 4096,
    );
    assert.ok(Math.abs(b.histories[0][idx] - a.cells[0].register) < 1 / 4096);
    assert.equal(
      b.histories[0].filter((_, i) => i !== idx).reduce((s, x) => s + x, 0),
      0,
    );
    if (idx === 1) assert.equal(b.cells[1].energy, a.cells[1].energy);
    if (idx === 2) assert.equal(b.cells[0].storage, a.cells[0].storage);
    checks.push({ pathway, baseline: a, specialized: b });
  }
  // A specialist's second intake pays no mixture penalty; a new source does.
  const photo = await run(
    "photosynthesize r0\nwait 0\nphotosynthesize r0\nwait 1000",
    [{ energy: 20 }],
    { specializationStrength: 0.6, ticks: 2 },
  );
  assert.ok(
    Math.abs(photo.cells[0].register - Math.floor((6 / 60) * 4096) / 4096) <
      1 / 4096,
  );
  const mixed = await run(
    "photosynthesize r0\nmobilize r1 .1\nwait 0\nphotosynthesize r0\nwait 1000",
    [{ energy: 20, storage: 12 }],
    { specializationStrength: 0.6, ticks: 2 },
  );
  assert.ok(mixed.cells[0].register < photo.cells[0].register);
  // Storage round trips dissipate or conserve; never manufacture energy.
  const cycle = await run(
    "loop: store r0 3\nmobilize r0 3\njmp loop",
    [{ energy: 70, storage: 12 }],
    { specializationStrength: 0.6, ticks: 10 },
  );
  assert.ok(cycle.cells[0].energy + cycle.cells[0].storage <= 82);
  // Division inherits the parent's learned intake distribution.
  const division = await createLifeEngine(device, {
    ...base,
    specializationStrength: 0.6,
  });
  try {
    await division.fixture({
      programs: ["photosynthesize r0\nsplit r1\nwait 1000"],
      cells: [{ energy: 80 }],
      sunlight: 1,
    });
    await division.step(1);
    assert.equal((await division.counters()).living, 2);
    const parent = await division.cellSpecialization(0),
      child = await division.cellSpecialization(1);
    assert.ok(parent[0] > 0);
    assert.deepEqual(child, parent);
    checks.push({
      name: "division inherits recent pathway history",
      parent,
      child,
    });
  } finally {
    division.destroy();
  }
  // A recycled slot admitted from the archive starts physiologically fresh.
  const reused = await createLifeEngine(device, {
    ...base,
    treePrograms: 1,
    specializationStrength: 0.6,
    corpseEnergy: 0,
    seedStorage: 0,
    upkeep: 60,
  });
  try {
    await reused.fixture({
      programs: [{ tree: parseTree("(seq (photosynthesize) (wait 1000))") }],
      cells: [{ energy: 3, storage: 0 }],
      sunlight: 1,
    });
    await reused.step(1);
    assert.ok((await reused.cellSpecialization(0))[0] > 0);
    await reused.step(3);
    assert.equal((await reused.counters()).living, 0);
    const admitted = await reused.admitBody({
      programs: [{ tree: parseTree("(wait 1000)") }],
      cells: [{ x: 100, y: 100, energy: 24, storage: 0 }],
    });
    assert.deepEqual(admitted.cellSlots, [0]);
    assert.deepEqual(await reused.cellSpecialization(0), [0, 0, 0]);
    checks.push({
      name: "archive admission clears reused specialization history",
    });
  } finally {
    reused.destroy();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-specialization-check.json",
    JSON.stringify({ complete: true, checks, photo, mixed, cycle }, null, 2),
  );
  console.log(
    "PASS three pathway credits, actual debits, adaptation, mixed penalty no profitable storage cycling, inheritance and recycled-state reset",
  );
} finally {
  device.destroy();
  delete globalThis.__specializationGPU;
}
