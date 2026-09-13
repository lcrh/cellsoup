import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__combatGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __combatGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacityRate: 0,
  capacity: 32,
  genomeCapacity: 8,
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
  attackDamageCost: 1,
  attackEfficiency: 1,
  attackAmountMax: 20,
  shieldUpkeep: 0,
  archiveEnabled: 0,
  jitter: 0,
  loopYield: 0,
  budget: 128,
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
async function run(programs, cells, { ticks = 1, ...options } = {}) {
  const e = await setup(programs, cells, options);
  try {
    await e.step(ticks);
    return await snapshot(e);
  } finally {
    e.destroy();
  }
}
const tree = (source) => ({ tree: parseTree(source) });
function near(a, b, tol = 1 / 4096) {
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
}
try {
  let s = await run(
    ["attack 2 2\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 70 },
      { x: 112, y: 100, energy: 70, genome: 1 },
    ],
    { attackDamageCost: 0.5, attackEfficiency: 3, attackCost: 0.25 },
  );
  near(s.f[4] / 4096, 68.75);
  near(s.f[56] / 4096, 67);
  near(s.counters.attackDamage, 3);
  checks.push(
    "attack damage scales with actual variable energy input, overhead creates no damage",
  );
  for (const settings of [{ attackDamageCost: 0 }, { attackEfficiency: 0 }]) {
    s = await run(
      ["attack 2 20\nwait 1000", "wait 1000"],
      [
        { x: 100, y: 100, energy: 70 },
        { x: 112, y: 100, energy: 70, genome: 1 },
      ],
      settings,
    );
    near(s.f[4] / 4096, 70);
    near(s.f[56] / 4096, 70);
  }
  s = await run(
    ["attack 2 -3\nattack 2 0\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 70 },
      { x: 112, y: 100, energy: 70, genome: 1 },
    ],
    { attackCost: 1 },
  );
  near(s.f[4] / 4096, 70);
  near(s.f[56] / 4096, 70);
  checks.push(
    "zero input/efficiency and nonpositive attacks cannot create free damage",
  );
  s = await run(
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 3 },
      { x: 112, y: 100, energy: 70, genome: 1 },
    ],
  );
  near(s.f[4] / 4096, 3);
  near(s.f[56] / 4096, 70);
  checks.push("unaffordable strike is a no-op");
  s = await run(
    ["shield 3\nshield 5\nshield 0\nshield -2\nwait 1000"],
    [{ energy: 70 }],
    { shieldBuildEfficiency: 2, shieldCapacity: 10, ticks: 10 },
  );
  near(s.f[4] / 4096, 65);
  near(s.f[7], 10);
  checks.push(
    "shield spends only fill cost, persists, and zero/negative does not remove or mint barrier",
  );
  s = await run(["shield 10\nwait 1000"], [{ energy: 1 }], {
    shieldBuildEfficiency: 2,
  });
  near(s.f[4] / 4096, 1 / 4096);
  near(s.f[7], (1 - 1 / 4096) * 2);
  checks.push("shield construction preserves minimum energy reserve");
  for (const settings of [
    { shieldCapacity: 0 },
    { shieldBuildEfficiency: 0 },
  ]) {
    s = await run(["shield 10\nwait 1000"], [{ energy: 70 }], settings);
    near(s.f[4] / 4096, 70);
    near(s.f[7], 0);
  }
  checks.push(
    "disabled construction capacity or efficiency does not consume energy",
  );
  s = await run(
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 70 },
      { x: 112, y: 100, energy: 70, shield: 5, genome: 1 },
    ],
    { shieldProtection: 0.8 },
  );
  near(s.f[56] / 4096, 70);
  near(s.f[59], 1.25);
  near(s.counters.attackDamage, 3);
  checks.push("barrier loses health before cell energy, scaled by toughness");
  s = await run(
    ["attack 2 8\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 70 },
      { x: 112, y: 100, energy: 70, shield: 5, genome: 1 },
    ],
    { shieldProtection: 0.8 },
  );
  near(s.f[56] / 4096, 66);
  near(s.f[59], 0);
  checks.push("strike penetrates only after remaining barrier is exhausted");
  s = await run(
    ["attack 1 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 2, shield: 5, genome: 1 },
      ...Array.from({ length: 12 }, () => ({ x: 112, y: 100, energy: 70 })),
    ],
    { shieldProtection: 0.8, corpseEnergy: 0 },
  );
  assert.ok(s.f[4] / 4096 >= 0 && s.f[4] / 4096 < 0.01);
  near(s.f[7], 0);
  for (let i = 1; i <= 12; i++) near(s.f[i * 52 + 4] / 4096, 67);
  assert.ok(s.counters.attackDamage <= 6 && s.counters.attackDamage > 5.99);
  checks.push(
    "many attackers share one finite barrier and energy balance without duplicate absorption",
  );
  s = await run(
    ["attack 2 8\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 70 },
      { x: 112, y: 100, energy: 2, storage: 100, shield: 5, genome: 1 },
    ],
    { shieldProtection: 0.8, corpseEnergy: 8 },
  );
  assert.equal(s.u[83], 2);
  near(s.f[56] / 4096, 108);
  near(s.f[59], 0);
  assert.equal(s.counters.kills, 1);
  checks.push("lethal damage leaves ordinary body-plus-storage corpse value");
  s = await run(["wait 1000"], [{ energy: 1 / 4096, shield: 20 }], {
    shieldUpkeep: 1,
    shieldBuildEfficiency: 1,
  });
  near(s.f[4] / 4096, 1 / 4096);
  assert.ok(s.f[7] < 20 && s.f[7] > 19.9);
  checks.push("unfunded upkeep gradually erodes physical health");
  s = await run(["split r0\nwait 1000"], [{ energy: 120, shield: 10 }]);
  const children = Array.from({ length: 32 }, (_, i) => i).filter(
    (i) => s.u[i * 52 + 30],
  );
  assert.equal(children.length, 1);
  near(s.f[7], 5);
  near(s.f[children[0] * 52 + 7], 5);
  checks.push("division conserves barrier health");
  const brace = await setup(
    [tree("(seq (resist 1) (contract .55) (wait 1000))"), tree("(wait 1000)")],
    [
      { x: 100, y: 100, energy: 70, links: [2, 0, 0, 0] },
      { x: 130, y: 100, energy: 70, genome: 1, links: [1, 0, 0, 0] },
    ],
    { treePrograms: 1, resistCost: 0, resistStrength: 120 },
  );
  try {
    await brace.step(30);
    s = await snapshot(brace);
    assert.equal(await brace.cellResistance(0), 1);
    assert.ok(s.f[52] < 127);
    assert.ok(Math.abs(s.f[0] - 100) < Math.abs(s.f[52] - 130) * 0.25);
    checks.push(
      "braced cell holds while contraction pulls its linked neighbor",
    );
  } finally {
    brace.destroy();
  }
  const fee = await setup(
    [tree("(seq (resist 1) (resist 1) (wait 1000))")],
    [{ energy: 70 }],
    { treePrograms: 1, resistCost: 0.6 },
  );
  try {
    await fee.step(60);
    s = await snapshot(fee);
    near(70 - s.f[4] / 4096, (60 * Math.round((0.6 / 60) * 4096)) / 4096);
    assert.equal(await fee.cellResistance(0), 1);
    checks.push("persistent bracing pays once per tick, not once per command");
  } finally {
    fee.destroy();
  }
  const release = await setup(
    [tree("(seq (resist 1) (wait 0) (resist 0) (wait 1000))")],
    [{ energy: 70 }],
    { treePrograms: 1, resistCost: 0.6 },
  );
  try {
    await release.step(2);
    s = await snapshot(release);
    near(70 - s.f[4] / 4096, Math.round((0.6 / 60) * 4096) / 4096);
    assert.equal(await release.cellResistance(0), 0);
    checks.push("resist zero releases the brace and stops its cost");
  } finally {
    release.destroy();
  }
  const poor = await setup(
    [tree("(seq (resist 1) (wait 1000))")],
    [{ energy: 1 / 4096 }],
    { treePrograms: 1, resistCost: 1 },
  );
  try {
    await poor.step();
    s = await snapshot(poor);
    near(s.f[4] / 4096, 1 / 4096);
    assert.equal(await poor.cellResistance(0), 0);
    checks.push("unaffordable resistance disables without exhausting the cell");
  } finally {
    poor.destroy();
  }
  s = await run(
    ["attack 2 3\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 70 },
      { x: 112, y: 100, energy: 70, shield: 5, genome: 1 },
    ],
    { shieldProtection: 0 },
  );
  near(s.f[56] / 4096, 67);
  assert.ok(Number.isFinite(s.f[59]));
  checks.push(
    "zero toughness cannot block damage or introduce nonfinite health",
  );
  const inheritance = await setup(
    [tree("(seq (resist 1) (split) (wait 1000))")],
    [{ energy: 120 }],
    { treePrograms: 1, resistCost: 0 },
  );
  try {
    await inheritance.step();
    s = await snapshot(inheritance);
    const child = Array.from({ length: 32 }, (_, i) => i).find(
      (i) => s.u[i * 52 + 30],
    );
    assert.ok(child !== undefined);
    assert.equal(await inheritance.cellResistance(child), 1);
    const admitted = await inheritance.admitBody({
      programs: [tree("(wait 1000)")],
      cells: [{ x: 160, y: 160, energy: 20 }],
    });
    assert.equal(await inheritance.cellResistance(admitted.cellSlots[0]), 0);
    checks.push(
      "daughter inherits resistance while fresh body admissions reset it",
    );
  } finally {
    inheritance.destroy();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-combat-resist-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ checks }));
} finally {
  device.destroy();
  delete globalThis.__combatGPU;
}
