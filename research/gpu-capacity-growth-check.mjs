import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__growthGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __growthGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 8,
  genomeCapacity: 8,
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
  solarRate: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  archiveEnabled: 0,
  energyFillScale: 0,
  storageFillScale: 0,
  divisionCost: 12,
  minimumBirthEnergy: 12,
  jitter: 0,
};
async function setup(programs, cells, options = {}) {
  const e = await createLifeEngine(device, { ...base, ...options });
  await e.fixture({ programs, cells, sunlight: 1 });
  return e;
}
async function state(e) {
  const b = await e.state();
  assert.equal(b.byteLength, e.cfg.capacity * 2 * 208);
  const f = new Float32Array(b),
    u = new Uint32Array(b);
  return Array.from({ length: b.byteLength / 208 }, (_, i) => ({
    energy: f[i * 52 + 4] / 4096,
    storage: f[i * 52 + 38] / 4096,
    heading: f[i * 52 + 5],
    life: u[i * 52 + 31],
    id: u[i * 52 + 24],
    gene: u[i * 52 + 25],
    sleep: u[i * 52 + 27],
    links: [...u.slice(i * 52 + 32, i * 52 + 36)],
  }));
}
async function validate(e) {
  const c = await state(e),
    counts = await e.counters(),
    stats = (await e.genes()).stats;
  assert.ok(counts.living <= e.cfg.capacity * 2);
  assert.ok(counts.corpses + counts.living <= e.cfg.capacity * 2);
  assert.ok(counts.corpses <= e.cfg.capacity);
  assert.equal(counts.corpses, c.filter((c) => c.life === 2).length);
  assert.equal(counts.living, c.filter((c) => c.life === 1).length);
  const refs = new Uint32Array(e.cfg.genomeCapacity);
  for (let i = 0; i < c.length; i++) {
    if (c[i].life !== 1) continue;
    refs[c[i].gene]++;
    for (const h of c[i].links) {
      if (!h) continue;
      assert.ok(h <= c.length && h !== i + 1);
      assert.equal(c[h - 1].life, 1);
      assert.ok(c[h - 1].links.includes(i + 1));
    }
  }
  for (let i = 0; i < refs.length; i++) assert.equal(stats[i * 4], refs[i]);
  const inputs = new Set([
    "photosynthesis",
    "scavenging",
    "mobilized",
    "giftsReceived",
    "arrivals",
  ]);
  let net = 0;
  for (const [k, v] of Object.entries(counts.energyBudget))
    net += inputs.has(k) ? v : -v;
  assert.equal(
    net,
    c.filter((c) => c.life === 1).reduce((s, c) => s + c.energy, 0),
  );
  return { c, counts };
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
try {
  await check(
    "division may exceed the soft target without killing parents or daughters",
    async () => {
      const e = await setup(
        ["bud r0\nwait 1000"],
        Array.from({ length: 8 }, (_, i) => ({
          x: 20 + i * 24,
          y: 100,
          energy: 100,
        })),
      );
      try {
        await e.step();
        const { c, counts } = await validate(e);
        assert.equal(counts.births, 8);
        assert.equal(counts.capacityDeaths, 0);
        assert.equal(counts.kills, 0);
        assert.equal(counts.energyBudget.reproduction, 96);
        assert.equal(counts.energyBudget.turnover, 0);
        assert.equal(c.length, 16);
        assert.equal(counts.living, 16);
        assert.equal(counts.corpses, 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "parent and daughter retain child modifiers and reciprocal links above the target",
    async () => {
      const e = await setup(
        [
          {
            tree: parseTree(
              "(seq (child-set m0 99) (seq (child-turn 45) (bud)))",
            ),
          },
        ],
        [{ energy: 100, memory: [41] }],
        { capacity: 1, genomeCapacity: 1, treePrograms: 1 },
      );
      try {
        await e.step();
        const { c, counts } = await validate(e);
        assert.equal(counts.births, 1);
        assert.equal(counts.capacityDeaths, 0);
        assert.equal(counts.living, 2);
        for (let slot = 0; slot < c.length; slot++) {
          const cell = c[slot],
            memory = await e.cellMemory(slot);
          assert.equal(cell.energy, 44);
          assert.ok(cell.links.includes(1 - slot + 1));
          assert.equal(memory[0], cell.id === 1 ? 41 : 99);
          assert.equal(cell.heading, cell.id === 1 ? 0 : 0.125);
        }
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "hard-ceiling division is refused without its energy fee",
    async () => {
      const e = await setup(
        ["bud r0\nwait 1000"],
        [{ energy: 100 }, { energy: 100 }],
        { capacity: 1, genomeCapacity: 1 },
      );
      try {
        await e.step();
        const { counts } = await validate(e);
        assert.equal(counts.births, 0);
        assert.equal(counts.living, 2);
        assert.equal(counts.deaths, 0);
        assert.equal(counts.energyBudget.reproduction, 0);
        assert.equal(counts.energyBudget.turnover, 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "old and newborn links remain reciprocal above the soft target",
    async () => {
      const cells = Array.from({ length: 8 }, (_, i) => ({
        x: 20 + i * 18,
        y: 100,
        energy: 100,
        links: [i ? i : 0, i < 7 ? i + 2 : 0, 0, 0],
      }));
      const e = await setup(["bud r0\nwait 1000"], cells);
      try {
        await e.step();
        await validate(e);
        await e.step(3);
        await validate(e);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "existing corpses do not consume the independent living-cell allowance",
    async () => {
      const e = await setup(
        ["bud r0\nwait 1000", "wait 1000"],
        [{ energy: 100 }, { energy: 20, corpse: true, genome: 1 }],
        { capacity: 2, genomeCapacity: 2 },
      );
      try {
        await e.step();
        const { counts } = await validate(e);
        assert.equal(counts.births, 1);
        assert.equal(counts.living, 2);
        assert.equal(counts.corpses, 1);
        assert.equal(counts.deaths, 0);
        assert.equal(counts.capacityDeaths, 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "new births retire the oldest corpse when physical room is needed",
    async () => {
      const e = await setup(
        ["bud r0\nwait 1000", "wait 1000"],
        [
          { slot: 0, energy: 100 },
          { slot: 1, energy: 100, genome: 1 },
          { slot: 2, corpse: true, energy: 20, age: 600, genome: 1 },
          { slot: 3, corpse: true, energy: 20, age: 300, genome: 1 },
        ],
        { capacity: 2, genomeCapacity: 2 },
      );
      try {
        await e.step();
        const { c, counts } = await validate(e);
        assert.equal(counts.living, 3);
        assert.equal(counts.corpses, 1);
        assert.equal(counts.births, 1);
        assert.equal(counts.deaths, 0);
        assert.equal(counts.capacityDeaths, 0);
        assert.ok(!c.some((cell) => cell.life === 2 && cell.id === 3));
        assert.ok(c.some((cell) => cell.life === 2 && cell.id === 4));
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "steady plus capacity-boost newcomers stop at the hard ceiling without resident deaths",
    async () => {
      const e = await setup(["wait 1000"], [{ energy: 100 }, { energy: 100 }], {
        capacity: 2,
        genomeCapacity: 8,
        rate: 1,
        capacityRate: 2,
        seedEnergy: 24,
        treePrograms: 1,
      });
      try {
        await e.step(60);
        const { counts } = await validate(e);
        assert.equal(counts.randomArrivals + counts.sampledArrivals, 4);
        assert.equal(counts.capacityDeaths, 0);
        assert.equal(counts.capacityArrivals, 2);
        assert.equal(counts.living, 4);
        assert.equal(counts.energyBudget.arrivals, 248);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "hard-ceiling births do not overflow the pending mutation queue",
    async () => {
      const e = await setup(
        [{ tree: parseTree("(seq (photosynthesize) (bud))") }],
        Array.from({ length: 8 }, (_, i) => ({
          x: 20 + i * 24,
          y: 100,
          energy: 100,
        })),
        {
          treePrograms: 1,
          genomeCapacity: 16,
          forkMutation: 1,
          divisionCost: 0,
          minimumBirthEnergy: 1,
          solarRate: 100,
          loopYield: 0,
        },
      );
      try {
        for (let k = 0; k < 15; k++) {
          await e.step();
          const { c, counts } = await validate(e);
          assert.equal(
            counts.raw[25],
            c.filter((c) => c.life === 1 && c.sleep === 0xffffffff).length,
          );
          assert.equal(counts.skippedDivisionMutations, 0);
        }
        await e.step();
        await validate(e);
        assert.ok((await e.counters()).divisionMutations > 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "a sunless corpse-only world refills the full living floor and refills again after natural deaths",
    async () => {
      const e = await setup(
        ["wait 1000"],
        Array.from({ length: 8 }, (_, i) => ({
          slot: i,
          x: 30 + i * 20,
          y: 100,
          corpse: true,
          energy: 20,
          age: 300,
        })),
        {
          treePrograms: 1,
          genomeCapacity: 16,
          floor: 5,
          rate: 0,
          capacityRate: 0,
          seedEnergy: 1 / 4096,
          seedStorage: 0,
          upkeep: 60,
          functionMask0: 0,
          functionMask1: 0,
          functionMask2: 0,
          functionMask3: 0,
        },
      );
      try {
        await e.step(59);
        let sample = await validate(e);
        assert.equal(sample.counts.living, 0);
        assert.equal(sample.counts.corpses, 8);
        await e.step();
        sample = await validate(e);
        assert.equal(
          sample.counts.living,
          5,
          "The full deficit is replenished in one arrival epoch",
        );
        assert.equal(
          sample.counts.corpses,
          8,
          "Corpses do not consume living population slots",
        );
        assert.equal(
          sample.counts.randomArrivals + sample.counts.sampledArrivals,
          5,
        );
        await e.step();
        sample = await validate(e);
        assert.equal(
          sample.counts.living,
          0,
          "Low-energy arrivals die naturally in the dark world",
        );
        assert.equal(sample.counts.deaths, 5);
        assert.equal(sample.counts.capacityDeaths, 0);
        assert.equal(
          sample.counts.corpses,
          8,
          "Natural deaths obey the separate corpse limit",
        );
        await e.step(59);
        sample = await validate(e);
        assert.equal(
          sample.counts.living,
          5,
          "The next scheduled epoch restores the full floor again",
        );
        assert.equal(
          sample.counts.randomArrivals + sample.counts.sampledArrivals,
          10,
        );
        assert.equal(sample.counts.deaths, 5);
        assert.equal(sample.counts.corpses, 8);
      } finally {
        e.destroy();
      }
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-capacity-growth-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
} finally {
  device.destroy();
  delete globalThis.__growthGPU;
}
