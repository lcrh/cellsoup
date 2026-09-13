import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__ageGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __ageGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacityRate: 0,
  energyFillScale: 0,
  storageFillScale: 0,
  energyCapacity: 200,
  storageCapacity: 400,
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
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  attackCost: 0,
  attackDamageCost: 0,
  archiveEnabled: 0,
  jitter: 0,
};
async function setup(programs, cells, options = {}) {
  const e = await createLifeEngine(device, { ...base, ...options });
  await e.fixture({ programs, cells, sunlight: 1 });
  return e;
}
async function snapshot(e) {
  const data = await e.state();
  return {
    f: new Float32Array(data),
    u: new Uint32Array(data),
    counters: await e.counters(),
  };
}
try {
  const e = await setup(
    ["loop: add r0 1\nwait 0\njmp loop"],
    [{ energy: 70, storage: 24 }],
    { maximumAge: 3 / 60 },
  );
  try {
    await e.step(2);
    let before = await snapshot(e);
    assert.equal(before.u[31], 1);
    assert.equal(before.f[8], 2);
    await e.step();
    let after = await snapshot(e);
    assert.equal(after.u[31], 2);
    assert.equal(after.u[28], 0);
    assert.equal(after.f[8], 2);
    assert.equal(after.f[4] / 4096, 32);
    assert.equal(after.f[38] / 4096, 32);
    assert.equal(after.counters.living, 0);
    assert.equal(after.counters.deaths, 1);
    assert.equal(after.counters.kills, 0);
    await e.step(60);
    after = await snapshot(e);
    assert.equal(after.counters.deaths, 1);
    assert.equal(after.u[28], 60);
    assert.ok(after.f[4] < 32 * 4096);
    checks.push(
      "dies exactly at configured age before program execution, preserves normal corpse value and decays once",
    );
  } finally {
    e.destroy();
  }
  const off = await setup(["wait 1000"], [{ energy: 70, storage: 24 }], {
    maximumAge: 0,
  });
  try {
    await off.step(600);
    const result = await snapshot(off);
    assert.equal(result.u[31], 1);
    assert.equal(result.u[28], 600);
    assert.equal(result.f[4] / 4096, 70);
    checks.push("zero disables old-age death");
  } finally {
    off.destroy();
  }
  const daughter = await setup(
    ["bud r0\nwait 1000"],
    [{ x: 100, y: 100, energy: 120, age: 1 }],
    { maximumAge: 3 / 60 },
  );
  try {
    await daughter.step();
    let result = await snapshot(daughter);
    const child = Array.from({ length: 8 }, (_, i) => i).find(
      (i) => result.u[i * 52 + 30],
    );
    assert.ok(child !== undefined);
    assert.equal(result.u[child * 52 + 28], 0);
    await daughter.step();
    result = await snapshot(daughter);
    assert.equal(result.u[31], 2);
    assert.equal(result.u[child * 52 + 31], 1);
    assert.equal(result.u[child * 52 + 28], 1);
    await daughter.step(2);
    result = await snapshot(daughter);
    assert.equal(result.u[child * 52 + 31], 2);
    assert.equal(result.counters.deaths, 2);
    checks.push(
      "daughter starts at age zero and receives a full independent lifespan",
    );
  } finally {
    daughter.destroy();
  }
  const transfers = await setup(
    ["wait 1000", "give 1 .5\nwait 1000", "attack 1 3\nwait 1000"],
    [
      { x: 100, y: 100, energy: 70, storage: 24, age: 2 },
      { x: 112, y: 100, energy: 70, genome: 1 },
      { x: 100, y: 112, energy: 70, genome: 2 },
    ],
    { maximumAge: 3 / 60 },
  );
  try {
    await transfers.step();
    const result = await snapshot(transfers);
    assert.equal(result.u[31], 2);
    assert.equal(result.f[4] / 4096, 32);
    assert.equal(result.f[56] / 4096, 70);
    assert.equal(result.counters.kills, 0);
    checks.push(
      "gifts cannot rescue expired cells and coincident attacks do not count as kills",
    );
  } finally {
    transfers.destroy();
  }
  const storage = await setup(
    ["wait 1000"],
    [
      { x: 100, y: 100, energy: 70, storage: 100, age: 2, links: [2, 0, 0, 0] },
      { x: 114, y: 100, energy: 70, storage: 0, links: [1, 0, 0, 0] },
    ],
    { maximumAge: 3 / 60, exchange: 0.12 },
  );
  try {
    await storage.step();
    const result = await snapshot(storage);
    assert.equal(result.u[31], 2);
    assert.equal((result.f[4] + result.f[90]) / 4096, 108);
    assert.equal(result.u[84], 0);
    checks.push(
      "linked storage exchange remains conservative on the death tick and links are pruned",
    );
  } finally {
    storage.destroy();
  }
  await assert.rejects(
    createLifeEngine(device, { ...base, maximumAge: 86401 }),
    /Unsupported/,
  );
  await assert.rejects(
    createLifeEngine(device, { ...base, maximumAge: -1 }),
    /Invalid maximumAge/,
  );
  checks.push("invalid lifespan limits rejected");
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-age-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ checks }));
} finally {
  device.destroy();
  delete globalThis.__ageGPU;
}
