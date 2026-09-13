import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { energyFillGain } from "../web/gpu/energy-fill.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__fillGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __fillGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const Q = 4096;
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
  solarRate: 60,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  eatCost: 0,
  shieldUpkeep: 0,
  attackCost: 0,
  archiveEnabled: 0,
  jitter: 0,
  collisionStiffness: 0,
  energyFillScale: 50,
  storageFillScale: 100,
};
async function setup(programs, cells, options = {}) {
  const e = await createLifeEngine(device, { ...base, ...options });
  await e.fixture({ programs, cells, sunlight: 1 });
  return e;
}
async function state(e) {
  const data = await e.state(),
    f = new Float32Array(data),
    u = new Uint32Array(data);
  return Array.from({ length: e.cfg.capacity }, (_, i) => ({
    energy: f[i * 52 + 4] / Q,
    storage: f[i * 52 + 38] / Q,
    life: u[i * 52 + 31],
    r: [...f.slice(i * 52 + 8, i * 52 + 16)],
    shield: f[i * 52 + 7],
  }));
}
function near(a, b, tolerance = 2 / Q) {
  assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
try {
  await check(
    "photosynthesis integrates diminishing returns and reports actual credit once",
    async () => {
      const e = await setup(
        ["photosynthesize r0\nwait 1000"],
        [{ energy: 100 }],
      );
      try {
        await e.step();
        const [c] = await state(e);
        near(c.energy, 100 + energyFillGain(100, 1, 50));
        near(c.r[0], c.energy - 100);
        near((await e.counters()).photosynthesis, c.r[0]);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "storage and mobilization have independent scales, debit full input, and cannot create energy",
    async () => {
      const e = await setup(
        ["store r0 10\nmobilize r1 5\nwait 1000"],
        [{ energy: 100, storage: 40 }],
      );
      try {
        await e.step();
        const [c] = await state(e);
        const reserveGain = Math.floor(energyFillGain(40, 10, 100) * Q) / Q;
        const energyGain = Math.floor(energyFillGain(90, 5, 50) * Q) / Q;
        near(c.storage, 40 + reserveGain - 5);
        near(c.energy, 90 + energyGain);
        near(c.r[0], reserveGain);
        near(c.r[1], energyGain);
        assert.ok(c.energy + c.storage < 140);
      } finally {
        e.destroy();
      }
      const cycle = await setup(
        ["loop: store r0 1\nmobilize r1 1\njmp loop"],
        [{ energy: 100, storage: 100 }],
      );
      try {
        await cycle.step(100);
        const [c] = await state(cycle);
        assert.ok(c.energy + c.storage <= 200);
        assert.ok(Number.isFinite(c.energy));
      } finally {
        cycle.destroy();
      }
    },
  );
  await check(
    "specialization attenuates raw intake once before nonlinear filling",
    async () => {
      const e = await setup(
        ["photosynthesize r0\nwait 1000"],
        [{ energy: 100 }],
        { specializationStrength: 0.5, photoEfficiency: 0.8 },
      );
      try {
        await e.step();
        const [c] = await state(e);
        near(c.energy, 100 + energyFillGain(100, Math.floor(0.4 * Q) / Q, 50));
        near((await e.cellSpecialization(0))[0], 1);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "gifts aggregate once after outgoing debit and charge every donor full input",
    async () => {
      const e = await setup(
        ["give 3 .5\nwait 1000", "give 1 .1\nwait 1000"],
        [
          { x: 100, y: 100, energy: 20 },
          { x: 101, y: 100, energy: 20 },
          { x: 102, y: 100, energy: 100, genome: 1 },
        ],
      );
      try {
        await e.step();
        const c = await state(e);
        near(c[0].energy, 10 + energyFillGain(10, 10, 50));
        near(c[1].energy, 10);
        near(c[2].energy, 90 + energyFillGain(90, 20, 50));
        assert.ok(c.slice(0, 3).reduce((s, c) => s + c.energy, 0) < 140);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "wide gift aggregation cannot overflow under hundreds of full-energy donors",
    async () => {
      const cells = Array.from({ length: 512 }, (_, i) => ({
        x: 100,
        y: 100,
        energy: i ? 3895 : 1,
        genome: i ? 0 : 1,
      }));
      const e = await setup(["give 1 1\nwait 1000", "wait 1000"], cells, {
        capacity: 512,
      });
      try {
        await e.step();
        const c = await state(e),
          input = 511 * (3895 - 1 / Q);
        assert.ok(input * Q > 4294967296);
        near(c[0].energy, 1 + energyFillGain(1, input, 50), 4 / Q);
        for (const donor of c.slice(1)) assert.equal(donor.energy, 1 / Q);
        assert.ok(c[0].energy <= e.cfg.energyCapacity);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "corpse depletion stays raw while return and harvest counters report credited energy",
    async () => {
      const e = await setup(
        ["eat r0\nwait 1000", "wait 1000"],
        [
          { x: 100, y: 100, energy: 100 },
          { x: 101, y: 100, energy: 20, corpse: true, genome: 1 },
        ],
        { corpseLifetime: 86400 },
      );
      try {
        await e.step();
        const c = await state(e);
        near(c[0].energy, 100 + energyFillGain(100, 3, 50));
        near(c[0].r[0], c[0].energy - 100);
        near(c[1].energy, 17);
        near((await e.counters()).eaten, c[0].r[0]);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "one-quantum photon inputs accumulate instead of vanishing each tick",
    async () => {
      const e = await setup(
        ["loop: photosynthesize r0\nwait 0\njmp loop"],
        [{ energy: 100 }],
        { solarRate: 60 / Q },
      );
      try {
        await e.step(600);
        const [c] = await state(e);
        near(c.energy, 100 + energyFillGain(100, 600 / Q, 50));
        assert.ok(c.energy > 100 + 50 / Q);
        const r = await e.cellFillRemainders(0);
        assert.ok(r[0] >= 0 && r[0] < 1);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "division splits accrued fractional credits without duplicating them",
    async () => {
      const e = await setup(
        ["photosynthesize r0\nstore r1 .000244140625\nsplit r2\nwait 1000"],
        [{ energy: 100, storage: 40 }],
      );
      try {
        await e.step();
        const c = await state(e),
          a = await e.cellFillRemainders(0),
          b = await e.cellFillRemainders(1);
        assert.equal((await e.counters()).living, 2);
        assert.deepEqual(a, b);
        assert.ok(a[0] > 0 && a[1] > 0);
        const expected = Math.floor(energyFillGain(100, 1, 50) * Q) / Q;
        near(
          c[0].energy + c[1].energy,
          100 + expected - 1 / Q - e.cfg.divisionCost,
        );
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "reused body admission clears both fractional fill histories",
    async () => {
      const e = await setup(
        [
          {
            tree: parseTree(
              "(seq (photosynthesize) (store 0.000244140625) (wait 1000))",
            ),
          },
        ],
        [{ energy: 3 }],
        { treePrograms: 1, upkeep: 60, corpseEnergy: 0, seedStorage: 0 },
      );
      try {
        await e.step();
        assert.ok((await e.cellFillRemainders(0))[0] > 0);
        await e.step(6);
        assert.equal((await e.counters()).living, 0);
        const result = await e.admitBody({
          programs: [{ tree: parseTree("(wait 1000)") }],
          cells: [{ x: 100, y: 100, energy: 24, storage: 0 }],
        });
        assert.deepEqual(result.cellSlots, [0]);
        assert.deepEqual(await e.cellFillRemainders(0), [0, 0]);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "linked reserve diffusion remains conservative and bypasses acquisition loss",
    async () => {
      const e = await setup(
        ["wait 1000"],
        [
          { energy: 100, storage: 100, links: [2, 0, 0, 0] },
          { energy: 100, storage: 0, links: [1, 0, 0, 0] },
        ],
        { exchange: 0.25 },
      );
      try {
        await e.step();
        const c = await state(e);
        assert.equal(c[0].storage, 75);
        assert.equal(c[1].storage, 25);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "explicit hard caps and maximum corpse/barrier balances remain finite and exact",
    async () => {
      const e = await setup(
        ["photosynthesize r0\nstore r1 20\nwait 1000"],
        [{ energy: 49, storage: 9 }],
        {
          energyCapacity: 50,
          storageCapacity: 10,
          seedStorage: 0,
          energyFillScale: 1,
          storageFillScale: 1,
        },
      );
      try {
        await e.step();
        const [c] = await state(e);
        assert.ok(c.energy <= 50 && c.storage <= 10);
        assert.ok(c.energy >= 0);
      } finally {
        e.destroy();
      }
      const corpse = await setup(
        ["wait 1000"],
        [{ energy: 3895, storage: 3895 }],
        { maximumAge: 1 / 60, corpseEnergy: 200 },
      );
      try {
        await corpse.step();
        const [c] = await state(corpse);
        assert.equal(c.life, 2);
        assert.equal(c.energy, 4095);
      } finally {
        corpse.destroy();
      }
      const combat = await setup(
        ["attack 2 20\nwait 1000", "wait 1000"],
        [
          { x: 100, y: 100, energy: 100, vx: 100 },
          { x: 101, y: 100, energy: 3895, shield: 200, vx: -100, genome: 1 },
        ],
        {
          shieldCapacity: 200,
          shieldProtection: 1,
          attackDamageCost: 1,
          attackEfficiency: 20,
          attackAmountMax: 20,
          attackSpeedBonus: 1,
        },
      );
      try {
        await combat.step();
        const c = await state(combat);
        assert.equal(c[1].life, 2);
        assert.ok(Number.isFinite(c[1].energy));
        assert.equal(c[1].shield, 0);
      } finally {
        combat.destroy();
      }
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-energy-fill-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
} finally {
  device.destroy();
  delete globalThis.__fillGPU;
}
