import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { ENERGY_BUDGET_KEYS } from "../web/gpu/energy-ledger.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__ledgerGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __ledgerGPU.requestAdapter();
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
  solarRate: 60,
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
  eatCost: 0,
};
const inputKeys = new Set([
  "photosynthesis",
  "scavenging",
  "mobilized",
  "giftsReceived",
  "arrivals",
]);
async function setup(programs, cells, options = {}) {
  const e = await createLifeEngine(device, { ...base, ...options });
  await e.fixture({ programs, cells, sunlight: 1 });
  return e;
}
async function budget(e) {
  const { energyBudget: b } = await e.counters(),
    data = await e.state(),
    f = new Float32Array(data),
    u = new Uint32Array(data);
  let actual = 0;
  for (let i = 0; i < e.cfg.capacity; i++)
    if (u[i * 52 + 31] === 1) actual += f[i * 52 + 4] / 4096;
  const net = Object.entries(b).reduce(
    (sum, [key, value]) => sum + (inputKeys.has(key) ? value : -value),
    0,
  );
  assert.equal(
    net,
    actual,
    `usable-energy conservation: ${JSON.stringify(b)}, net=${net}, actual=${actual}`,
  );
  assert.deepEqual(Object.keys(b), ENERGY_BUDGET_KEYS);
  assert.ok(Object.values(b).every((v) => Number.isFinite(v) && v >= 0));
  return b;
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
try {
  await check(
    "actual nonlinear intake and conversion debits close the usable-energy balance",
    async () => {
      const e = await setup(
        [
          "photosynthesize r0\nstore r1 10\nmobilize r2 5\neat r3\nwait 1000",
          "wait 1000",
        ],
        [
          { x: 100, y: 100, energy: 100, storage: 40 },
          { x: 101, y: 100, energy: 20, corpse: true, genome: 1 },
        ],
        { energyFillScale: 100, storageFillScale: 100 },
      );
      try {
        await e.step();
        const b = await budget(e),
          c = await e.counters();
        assert.equal(b.arrivals, 100);
        assert.equal(b.storage, 10);
        assert.ok(b.mobilized > 0 && b.mobilized < 5);
        assert.equal(b.photosynthesis, c.photosynthesis);
        assert.equal(b.scavenging, c.eaten);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "movement shields maintenance communication and CPU count successful actual charges once",
    async () => {
      const e = await setup(
        ["move 1\nturn 10\ncontract 1\nshield 2\nemit 0 1\nwait 0"],
        [{ energy: 100, shield: 4 }],
        {
          moveCost: 0.5,
          turnCost: 0.01,
          contractCost: 0.25,
          emitCost: 0.125,
          cpuCost: 1 / 4096,
          upkeep: 60,
          shieldUpkeep: 6,
        },
      );
      try {
        await e.step();
        const b = await budget(e);
        assert.equal(b.movement, 0.75 + Math.round(0.1 * 4096) / 4096);
        assert.equal(b.shields, 2 + Math.round(0.02 * 4096) / 4096);
        assert.equal(b.communication, 0.125);
        assert.equal(b.upkeep, 1);
        assert.equal(b.computation, 6 / 4096);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "unaffordable actions do not manufacture recorded spending",
    async () => {
      const e = await setup(
        ["move 1\nshield 10\nattack 2 3\nwait 1000", "wait 1000"],
        [
          { x: 100, y: 100, energy: 0.25 },
          { x: 101, y: 100, energy: 10, genome: 1 },
        ],
        { moveCost: 1 },
      );
      try {
        await e.step();
        const b = await budget(e);
        assert.equal(b.movement, 0);
        assert.equal(b.attacks, 0);
        assert.equal(b.shields, 0.25 - 1 / 4096);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "attack cost and victim energy damage are distinct; absorbed shield damage is excluded",
    async () => {
      for (const shield of [0, 5]) {
        const e = await setup(
          ["attack 2 3\nwait 1000", "wait 1000"],
          [
            { x: 100, y: 100, energy: 100 },
            { x: 101, y: 100, energy: 2, shield, genome: 1 },
          ],
          { attackCost: 0.5 },
        );
        try {
          await e.step();
          const b = await budget(e);
          assert.equal(b.attacks, 3.5);
          assert.equal(b.attackDamage, shield ? 0 : 2);
        } finally {
          e.destroy();
        }
      }
    },
  );
  await check(
    "both gift paths record final donor debit and actual recipient credit",
    async () => {
      for (const scale of [0, 100]) {
        const e = await setup(
          ["give 2 1\nwait 1000", "wait 1000"],
          [
            { x: 100, y: 100, energy: 100 },
            { x: 101, y: 100, energy: 195, genome: 1 },
          ],
          { energyCapacity: 200, energyFillScale: scale },
        );
        try {
          await e.step();
          const b = await budget(e);
          if (scale === 0) {
            assert.equal(b.giftsSent, 5);
            assert.equal(b.giftsReceived, 5);
          } else {
            assert.equal(b.giftsSent, 100 - 1 / 4096);
            assert.ok(b.giftsReceived <= 5);
          }
          assert.equal(b.arrivals, 295);
        } finally {
          e.destroy();
        }
      }
    },
  );
  await check(
    "division records its fee and does not count daughter allocation as new intake",
    async () => {
      const e = await setup(["bud r0\nwait 1000"], [{ energy: 100 }]);
      try {
        await e.step();
        const b = await budget(e);
        assert.equal(b.reproduction, e.cfg.divisionCost);
        assert.equal(b.arrivals, 100);
        assert.equal((await e.counters()).births, 1);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "senescence records remaining usable energy; overheating records only actual loss",
    async () => {
      for (const options of [{ maximumAge: 1 / 60 }, { heatDamage: 100 }]) {
        const e = await setup(
          ["wait 1000"],
          [{ energy: 10, temperature: 100 }],
          options,
        );
        try {
          await e.step();
          const b = await budget(e);
          assert.equal(options.maximumAge ? b.turnover : b.upkeep, 10);
          assert.equal(options.maximumAge ? b.upkeep : b.turnover, 0);
        } finally {
          e.destroy();
        }
      }
    },
  );
  await check(
    "persistent resistance cost is charged in life phase once per tick",
    async () => {
      const e = await setup(
        [{ tree: parseTree("(seq (resist 1) (wait 1000))") }],
        [{ energy: 100 }],
        { treePrograms: 1, resistCost: 6 },
      );
      try {
        await e.step(3);
        const b = await budget(e);
        assert.equal(b.movement, (3 * Math.round(0.1 * 4096)) / 4096);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "filter computation records actual nested fees without double counting",
    async () => {
      const e = await setup(
        [
          {
            tree: parseTree(
              "(seq (set m0 (neighbor-count 80 (where (> (target-energy (candidate)) 2)))) (wait 1000))",
            ),
          },
        ],
        [
          { x: 100, y: 100, energy: 100 },
          { x: 101, y: 100, energy: 100 },
        ],
        { treePrograms: 1, cpuCost: 1 / 4096 },
      );
      try {
        await e.step();
        const b = await budget(e);
        assert.ok(b.computation > 10 / 4096);
        assert.equal(b.movement, 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "host body admissions and at-capacity replacements record seeding and removed energy",
    async () => {
      const e = await createLifeEngine(device, {
        ...base,
        capacity: 2,
        genomeCapacity: 2,
        treePrograms: 1,
        capacityRate: 1,
        seedEnergy: 24,
      });
      try {
        const admitted = await e.admitBody({
          programs: [{ tree: parseTree("(wait 1000)") }],
          cells: [
            { x: 100, y: 100, energy: 40 },
            { x: 110, y: 100, energy: 40 },
          ],
        });
        assert.equal(admitted.admitted, 2);
        let b = await budget(e);
        assert.equal(b.arrivals, 80);
        await e.step(60);
        b = await budget(e);
        assert.equal(b.arrivals, 104);
        assert.equal(b.turnover, 40);
        assert.equal((await e.counters()).capacityArrivals, 1);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "odd scalar-only and optional-vector scratch layouts expose the same ledger",
    async () => {
      for (const options of [
        {},
        { treePrograms: 1 },
        { specializationStrength: 0.1 },
        { forkMutation: 0.01 },
      ]) {
        const e = await setup(
          ["photosynthesize r0\nwait 1000"],
          [{ energy: 10 }],
          { capacity: 3, genomeCapacity: 3, ...options },
        );
        try {
          await e.step();
          const b = await budget(e);
          assert.equal(b.arrivals, 10);
          assert.ok(b.photosynthesis > 0);
        } finally {
          e.destroy();
        }
      }
    },
  );
  await check(
    "GPU initial seeding safely carries cumulative quanta beyond uint32",
    async () => {
      const e = await createLifeEngine(device, {
        ...base,
        capacity: 512,
        genomeCapacity: 512,
        initial: 300,
        seedEnergy: 3895,
      });
      try {
        const b = await budget(e);
        assert.equal(b.arrivals, 300 * 3895);
        assert.ok(b.arrivals * 4096 > 4294967296);
      } finally {
        e.destroy();
      }
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-energy-ledger-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
} finally {
  device.destroy();
  delete globalThis.__ledgerGPU;
}
