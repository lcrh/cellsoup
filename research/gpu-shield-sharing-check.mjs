import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__shieldSharingGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __shieldSharingGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [],
  checks = [];
device.addEventListener("uncapturederror", (event) =>
  errors.push(event.error.message),
);
const Q = 4096;
const base = {
  capacity: 8,
  genomeCapacity: 2,
  initial: 0,
  side: 8,
  sources: 1,
  treePrograms: 0,
  rate: 0,
  capacityRate: 0,
  floor: 0,
  pressureStrength: 0,
  archiveEnabled: 0,
  forkMutation: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  energyFillScale: 0,
  storageFillScale: 0,
  exchange: 0,
  thermalExchange: 0,
  solarEnabled: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  springStiffness: 0,
  collisionStiffness: 0,
  linkBarrierStiffness: 0,
  linkBarrierDamping: 0,
  shieldCapacity: 20,
  shieldUpkeep: 0,
  shieldProtection: 1,
  shieldExchange: 0.12,
  attackCost: 0,
  attackDamageCost: 1,
  attackEfficiency: 1,
  attackAmountMax: 20,
};
function near(actual, expected, tolerance = 1e-4) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected}`,
  );
}
async function snapshot(e) {
  const buffer = await e.state(),
    f = new Float32Array(buffer),
    u = new Uint32Array(buffer);
  return {
    cells: Array.from({ length: u.length / 52 }, (_, i) => ({
      life: u[i * 52 + 31],
      energy: f[i * 52 + 4] / Q,
      shield: f[i * 52 + 7],
    })),
    counters: await e.counters(),
  };
}
async function fixture(cells, config, fn, programs = ["wait 1000"]) {
  const e = await createLifeEngine(device, { ...base, ...config });
  try {
    await e.fixture({ programs, cells });
    return await fn(e);
  } finally {
    e.destroy();
  }
}
async function check(name, fn) {
  await fn();
  assert.deepEqual(errors, []);
  checks.push(name);
  console.log("PASS", name);
}
const pair = [
  { x: 100, y: 100, energy: 70, shield: 20, links: [2, 0, 0, 0] },
  { x: 118, y: 100, energy: 70, shield: 0, links: [1, 0, 0, 0] },
];
function conserved(s, total) {
  const live = s.cells.filter((c) => c.life === 1);
  near(
    live.reduce((sum, c) => sum + c.shield, 0),
    total,
    0.001,
  );
  assert.ok(live.every((c) => c.shield >= -1e-5 && c.shield <= 20.00001));
}
try {
  await check(
    "Reciprocal linked shields diffuse conservatively at the configured rate",
    () =>
      fixture(pair, {}, async (e) => {
        await e.step();
        const s = await snapshot(e);
        near(s.cells[0].shield, 17.6);
        near(s.cells[1].shield, 2.4);
        conserved(s, 20);
        assert.equal(s.counters.energyBudget.shields, 0);
        assert.equal(s.cells[0].energy, 70);
        assert.equal(s.cells[1].energy, 70);
      }),
  );
  await check(
    "Shield transfer propagates gradually through multiple links",
    () =>
      fixture(
        [
          { ...pair[0] },
          { ...pair[1], links: [1, 3, 0, 0] },
          { x: 136, y: 100, energy: 70, shield: 0, links: [2, 0, 0, 0] },
        ],
        {},
        async (e) => {
          await e.step();
          let s = await snapshot(e);
          near(s.cells[0].shield, 17.6);
          near(s.cells[1].shield, 2.4);
          near(s.cells[2].shield, 0);
          conserved(s, 20);
          await e.step();
          s = await snapshot(e);
          near(s.cells[0].shield, 15.776);
          near(s.cells[1].shield, 3.936);
          near(s.cells[2].shield, 0.288);
          conserved(s, 20);
        },
      ),
  );
  await check(
    "Degree-four transfer at the maximum rate stays bounded and conserves barrier health",
    async () => {
      for (const centerFull of [false, true])
        await fixture(
          [
            {
              x: 100,
              y: 100,
              energy: 70,
              shield: centerFull ? 20 : 0,
              links: [2, 3, 4, 5],
            },
            ...Array.from({ length: 4 }, (_, i) => ({
              x: 100 + 18 * Math.cos((i * Math.PI) / 2),
              y: 100 + 18 * Math.sin((i * Math.PI) / 2),
              energy: 70,
              shield: centerFull ? 0 : 20,
              links: [1, 0, 0, 0],
            })),
          ],
          { shieldExchange: 0.25 },
          async (e) => {
            await e.step();
            let s = await snapshot(e);
            near(s.cells[0].shield, centerFull ? 0 : 20);
            for (let i = 1; i < 5; i++)
              near(s.cells[i].shield, centerFull ? 5 : 15);
            conserved(s, centerFull ? 20 : 80);
            for (let tick = 0; tick < 20; tick++) {
              await e.step();
              s = await snapshot(e);
              conserved(s, centerFull ? 20 : 80);
            }
          },
        );
    },
  );
  await check(
    "Disconnected, nonreciprocal and corpse links do not transfer shields",
    () =>
      fixture(
        [
          { x: 20, y: 20, energy: 70, shield: 20, links: [2, 0, 0, 0] },
          { x: 38, y: 20, energy: 70, shield: 0 },
          { x: 80, y: 20, energy: 70, shield: 20, links: [4, 0, 0, 0] },
          {
            x: 98,
            y: 20,
            corpse: true,
            energy: 20,
            shield: 0,
            links: [3, 0, 0, 0],
          },
          { x: 140, y: 20, energy: 70, shield: 20 },
          { x: 158, y: 20, energy: 70, shield: 0 },
        ],
        {},
        async (e) => {
          await e.step(3);
          const s = await snapshot(e);
          for (const [slot, value] of [
            [0, 20],
            [1, 0],
            [2, 20],
            [4, 20],
            [5, 0],
          ])
            near(s.cells[slot].shield, value);
          conserved(s, 60);
        },
      ),
  );
  await check("A zero sharing rate preserves each cell's own shield", () =>
    fixture(pair, { shieldExchange: 0 }, async (e) => {
      await e.step(3);
      const s = await snapshot(e);
      near(s.cells[0].shield, 20);
      near(s.cells[1].shield, 0);
      conserved(s, 20);
    }),
  );
  await check(
    "Transferred shield absorbs an attack in the same tick without spending recipient energy",
    () =>
      fixture(
        [
          { ...pair[0], x: 80 },
          { ...pair[1], x: 100 },
          { x: 112, y: 100, energy: 70, genome: 1 },
        ],
        {},
        async (e) => {
          await e.step();
          const s = await snapshot(e);
          near(s.cells[0].shield, 17.6);
          near(s.cells[1].shield, 0.4);
          assert.equal(s.cells[1].energy, 70);
          assert.equal(s.cells[2].energy, 68);
          assert.equal(s.counters.energyBudget.attacks, 2);
          assert.equal(s.counters.energyBudget.attackDamage, 0);
          assert.equal(s.counters.energyBudget.shields, 0);
          conserved(s, 18);
        },
        ["wait 1000", "attack 2 2\nwait 1000"],
      ),
  );
  await check(
    "Maintenance charges actual usable energy after sharing, while diffusion itself is free",
    () =>
      fixture(pair, { shieldUpkeep: 60 }, async (e) => {
        await e.step();
        const s = await snapshot(e);
        const donor = Math.round(0.88 * Q) / Q,
          recipient = Math.round(0.12 * Q) / Q;
        near(s.cells[0].energy, 70 - donor, 1 / Q);
        near(s.cells[1].energy, 70 - recipient, 1 / Q);
        assert.equal(s.counters.energyBudget.shields, donor + recipient);
        assert.equal(s.counters.energyBudget.arrivals, 140);
        assert.equal(s.counters.energyBudget.upkeep, 0);
        conserved(s, 20);
        assert.equal(
          s.cells[0].energy + s.cells[1].energy,
          140 - s.counters.energyBudget.shields,
        );
      }),
  );
  await device.queue.onSubmittedWorkDone();
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-shield-sharing-check.json",
    JSON.stringify({ complete: true, checks }, null, 2) + "\n",
  );
} finally {
  device.destroy();
  delete globalThis.__shieldSharingGPU;
}
