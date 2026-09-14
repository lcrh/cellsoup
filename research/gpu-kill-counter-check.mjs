import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__killGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __killGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [],
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
  capacityRate: 0,
  floor: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  exchange: 0,
  solarEnabled: 0,
  solarRate: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  archiveEnabled: 0,
  energyFillScale: 0,
  storageFillScale: 0,
  attackCost: 0,
  attackDamageCost: 1,
  attackEfficiency: 1,
  shieldUpkeep: 0,
  shieldProtection: 1,
  corpseEnergy: 8,
};
async function run(name, programs, cells, options, expected) {
  const e = await createLifeEngine(device, { ...base, ...options });
  try {
    await e.fixture({ programs, cells });
    await e.step();
    const first = await e.counters();
    await e.step(6);
    const later = await e.counters();
    checks.push({
      name,
      kills: first.kills,
      deaths: first.deaths,
      laterKills: later.kills,
      expected,
      pass: first.kills === expected && later.kills === expected,
    });
  } finally {
    e.destroy();
  }
}
try {
  await run(
    "lethal attack counts one victim once",
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 101, y: 100, energy: 2, storage: 20, genome: 1 },
    ],
    {},
    1,
  );
  await run(
    "two simultaneous lethal contributors count one victim",
    ["attack 3 1\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 100, y: 101, energy: 100 },
      { x: 101, y: 100, energy: 2, genome: 1 },
    ],
    {},
    1,
  );
  await run(
    "nonlethal attack is not a kill",
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 101, y: 100, energy: 10, genome: 1 },
    ],
    {},
    0,
  );
  await run(
    "shield-only hit is not a kill",
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 101, y: 100, energy: 10, shield: 10, genome: 1 },
    ],
    {},
    0,
  );
  await run(
    "old-age death plus an attack is not a kill",
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 101, y: 100, energy: 10, shield: 10, age: 1, genome: 1 },
    ],
    { maximumAge: 2 / 60 },
    0,
  );
  await run(
    "starvation alone is not a kill",
    ["wait 1000"],
    [{ energy: 0.5 }],
    { upkeep: 60 },
    0,
  );
  await run(
    "starvation plus shield-only hit is not an attack-caused death",
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 101, y: 100, energy: 0.5, shield: 10, genome: 1 },
    ],
    { upkeep: 60 },
    0,
  );
  await run(
    "overheating plus shield-only hit is not an attack-caused death",
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 101, y: 100, energy: 0.5, shield: 10, temperature: 100, genome: 1 },
    ],
    { heatDamage: 100 },
    0,
  );
  await run(
    "scavenging a corpse is not a kill",
    ["eat r0\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 100 },
      { x: 101, y: 100, energy: 2, corpse: true, genome: 1 },
    ],
    { eatCost: 0 },
    0,
  );
  assert.deepEqual(errors, []);
  const report = { complete: checks.every((c) => c.pass), checks };
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-kill-counter-check.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.complete, "Kill attribution checks failed");
} finally {
  device.destroy();
  delete globalThis.__killGPU;
}
