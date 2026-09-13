import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__impactGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __impactGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 8,
  genomeCapacity: 2,
  initial: 0,
  side: 8,
  sources: 1,
  treePrograms: 0,
  forkMutation: 0,
  rate: 0,
  floor: 0,
  capacityRate: 0,
  energyFillScale: 0,
  storageFillScale: 0,
  energyCapacity: 200,
  storageCapacity: 400,
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
  shieldProtection: 1,
  archiveEnabled: 0,
  attackSpeedBonus: 0.1,
};
async function run(attacker = {}, target = {}, options = {}) {
  const e = await createLifeEngine(device, { ...base, ...options });
  try {
    await e.fixture({
      programs: ["attack 2 2\nwait 1000", "wait 1000"],
      cells: [
        { x: 100, y: 100, energy: 70, ...attacker },
        { x: 112, y: 100, energy: 70, genome: 1, ...target },
      ],
    });
    await e.step();
    const f = new Float32Array(await e.state());
    for (const i of [0, 1])
      for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 36, 37, 38, 39])
        assert.ok(Number.isFinite(f[i * 52 + k]));
    return {
      attackerEnergy: f[4] / 4096,
      targetEnergy: f[56] / 4096,
      targetBarrier: f[59],
      counters: await e.counters(),
    };
  } finally {
    e.destroy();
  }
}
function near(a, b, tol = 1 / 4096) {
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
}
try {
  const stationary = await run(),
    common = await run({ vx: 10, vy: 7 }, { vx: 10, vy: 7 }),
    retreat = await run({ vx: -10 }),
    sideways = await run({ vy: 10 });
  for (const s of [stationary, common, retreat, sideways]) {
    near(s.attackerEnergy, 68);
    near(s.targetEnergy, 68);
  }
  checks.push(
    "stationary, common motion, retreat and tangential motion give no bonus",
  );
  const closing = await run({ vx: 10 }),
    bothClosing = await run({ vx: 10 }, { vx: -10 });
  near(closing.targetEnergy, 66);
  near(bothClosing.targetEnergy, 64);
  near(closing.attackerEnergy, 68);
  near(bothClosing.attackerEnergy, 68);
  checks.push(
    "relative closing speed scales damage without an additional attack energy fee",
  );
  const off = await run({ vx: 10 }, {}, { attackSpeedBonus: 0 });
  near(off.targetEnergy, 68);
  near(off.attackerEnergy, 68);
  checks.push("zero setting restores baseline attack damage");
  const overlap = await run({ x: 100, vx: 10 }, { x: 100 });
  near(overlap.targetEnergy, 68);
  checks.push("coincident positions have finite baseline damage");
  const shield = await run({ vx: 10 }, { shield: 10 }),
    shieldBaseline = await run({}, { shield: 10 });
  near(shield.targetEnergy, 70);
  near(shield.targetBarrier, 6);
  near(shieldBaseline.targetBarrier, 8);
  checks.push(
    "same impact multiplier wears down physical barrier before energy",
  );
  const seam = await run({ x: 250, vx: 10 }, { x: 6 }),
    rotated = await run({ x: 100, y: 100, vy: 10 }, { x: 100, y: 112 });
  near(seam.targetEnergy, 66);
  near(rotated.targetEnergy, 66);
  checks.push(
    "impact projection respects periodic seams and has no compass preference",
  );
  const bounded = await run({ vx: 100 }, { vx: -100 }, { attackSpeedBonus: 1 });
  assert.equal(bounded.counters.kills, 1);
  assert.ok(bounded.counters.attackDamage <= 70);
  checks.push("maximum impact remains bounded by finite target resources");
  await assert.rejects(
    createLifeEngine(device, { ...base, attackSpeedBonus: 1.01 }),
    /Invalid attack speed bonus/,
  );
  await assert.rejects(
    createLifeEngine(device, { ...base, attackSpeedBonus: -1 }),
    /Invalid attackSpeedBonus/,
  );
  checks.push("invalid bonuses rejected");
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-impact-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ checks }));
} finally {
  device.destroy();
  delete globalThis.__impactGPU;
}
