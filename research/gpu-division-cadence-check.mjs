import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__cadenceGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __cadenceGPU.requestAdapter();
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
  pressureStrength: 0,
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
  divisionCost: 12,
  minimumBirthEnergy: 12,
};
async function setup(programs, cells, options = {}) {
  const e = await createLifeEngine(device, { ...base, ...options });
  await e.fixture({ programs, cells, sunlight: 1 });
  return e;
}
async function state(e) {
  const b = await e.state(),
    f = new Float32Array(b),
    u = new Uint32Array(b);
  return Array.from({ length: e.entityCapacity }, (_, i) => ({
    energy: f[i * 52 + 4] / 4096,
    life: u[i * 52 + 31],
    r: [...f.slice(i * 52 + 8, i * 52 + 16)],
    links: [...u.slice(i * 52 + 32, i * 52 + 36)],
  }));
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
try {
  await check(
    "unaffordable split and bud retain failure return and continue same tick",
    async () => {
      for (const op of ["split", "bud"]) {
        const e = await setup(
          [`${op} r0\nadd r1 7\nwait 0`],
          [{ energy: 36 - 1 / 4096 }],
        );
        try {
          await e.step();
          const [c] = await state(e);
          assert.equal(c.r[0], -1);
          assert.equal(c.r[1], 7);
          assert.equal(c.energy, 36 - 1 / 4096);
          assert.equal((await e.counters()).births, 0);
        } finally {
          e.destroy();
        }
      }
    },
  );
  await check(
    "ordinary instruction CPU fee still applies to an impossible division",
    async () => {
      const e = await setup(["bud r0\nadd r1 7\nwait 0"], [{ energy: 10 }], {
        cpuCost: 1 / 4096,
      });
      try {
        await e.step();
        const [c] = await state(e);
        assert.equal(c.r[1], 7);
        assert.equal(c.energy, 10 - 3 / 4096);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "full linked parent skips bud but can still split an unlinked child",
    async () => {
      const seeds = [
        { x: 100, y: 100, energy: 120, links: [2, 3, 4, 5] },
        ...Array.from({ length: 4 }, (_, k) => ({
          x: 100 + Math.cos((k * Math.PI) / 2) * 18,
          y: 100 + Math.sin((k * Math.PI) / 2) * 18,
          energy: 20,
          links: [1, 0, 0, 0],
          genome: 1,
        })),
      ];
      for (const op of ["bud", "split"]) {
        const e = await setup(
          [`${op} r0\nadd r1 7\nwait 0`, "wait 1000"],
          seeds,
        );
        try {
          await e.step();
          const [c] = await state(e);
          assert.equal(c.r[1], op === "bud" ? 7 : 0);
          assert.equal((await e.counters()).births, op === "bud" ? 0 : 1);
          assert.equal(c.links.filter(Boolean).length, 4);
        } finally {
          e.destroy();
        }
      }
    },
  );
  await check(
    "exact-threshold successful division still yields and conserves paid energy",
    async () => {
      const e = await setup(["bud r0\nadd r1 7\nwait 0"], [{ energy: 36 }]);
      try {
        await e.step();
        const c = await state(e);
        assert.equal((await e.counters()).births, 1);
        assert.equal(c[0].r[1], 0);
        assert.equal(c[1].r[1], 0);
        assert.equal(c[0].energy + c[1].energy, 24);
        assert.equal(c[0].links[0], 2);
        assert.equal(c[1].links[0], 1);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "typed photo-bud loop harvests every tick while saving for division",
    async () => {
      const e = await setup(
        [{ tree: parseTree("(seq (photosynthesize) (bud))") }],
        [{ energy: 10 }],
        { treePrograms: 1, loopYield: 1 },
      );
      try {
        await e.step(6);
        const [c] = await state(e);
        assert.equal(c.energy, 16);
        assert.equal((await e.counters()).photosynthesis, 6);
        assert.equal((await e.counters()).births, 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "failed attempt does not remain queued after later energy acquisition",
    async () => {
      const e = await setup(
        ["bud r0\nphotosynthesize r1\nwait 0"],
        [{ energy: 35.5 }],
      );
      try {
        await e.step();
        const [c] = await state(e);
        assert.equal(c.energy, 36.5);
        assert.equal(c.r[0], -1);
        assert.equal((await e.counters()).births, 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "crossing the soft target preserves every birth with available physical headroom",
    async () => {
      const e = await setup(
        ["bud r0\nadd r1 7\nwait 0"],
        [{ energy: 100 }, { energy: 100 }],
        { capacity: 3, genomeCapacity: 3 },
      );
      try {
        await e.step();
        const c = await state(e);
        assert.equal((await e.counters()).births, 2);
        assert.equal((await e.counters()).capacityDeaths, 0);
        assert.equal(
          c.filter((c) => c.life === 1).reduce((sum, c) => sum + c.energy, 0),
          176,
        );
        assert.equal(c[0].r[1], 0);
        assert.equal(c[1].r[1], 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "the soft target permits feasible division without an immediate death",
    async () => {
      const e = await setup(
        [
          { tree: parseTree("(seq (photosynthesize) (bud))") },
          { tree: parseTree("(wait 1000)") },
        ],
        [{ energy: 100 }, { energy: 100, genome: 1 }],
        { capacity: 2, genomeCapacity: 2, treePrograms: 1, loopYield: 1 },
      );
      try {
        await e.step();
        const counts = await e.counters();
        assert.equal(counts.photosynthesis, 1);
        assert.equal(counts.births, 1);
        assert.equal(counts.capacityDeaths, 0);
        assert.equal(counts.living, 3);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "immigration and valid division both enter available physical headroom",
    async () => {
      const e = await setup(
        ["photosynthesize r0\nbud r1\nadd r2 7\nwait 0"],
        [{ energy: 100, sleep: 59 }],
        { capacity: 2, genomeCapacity: 2, rate: 1 },
      );
      try {
        await e.step(60);
        const [c] = await state(e),
          counts = await e.counters();
        assert.equal(c.r[2], 0);
        assert.equal(counts.births, 1);
        assert.equal(counts.capacityDeaths, 0);
        assert.equal(counts.energyBudget.turnover, 0);
        assert.equal(counts.living, 3);
      } finally {
        e.destroy();
      }
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-division-cadence-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
} finally {
  device.destroy();
  delete globalThis.__cadenceGPU;
}
