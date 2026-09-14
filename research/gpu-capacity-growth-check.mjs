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
  assert.equal(b.byteLength, e.cfg.capacity * 208);
  const f = new Float32Array(b),
    u = new Uint32Array(b);
  return Array.from({ length: e.cfg.capacity }, (_, i) => ({
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
  assert.ok(counts.living + counts.corpses <= e.cfg.capacity);
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
    "every valid full-capacity division happens, then exactly excess entities are culled",
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
        assert.equal(counts.capacityDeaths, 8);
        assert.equal(counts.kills, 0);
        assert.equal(counts.energyBudget.reproduction, 96);
        assert.equal(counts.energyBudget.turnover, 352);
        assert.equal(c.length, 8);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "either parent or daughter may survive; child modifiers and orphan links remain correct",
    async () => {
      let parents = 0,
        daughters = 0;
      for (let seed = 0; seed < 32; seed++) {
        const e = await setup(
          [
            {
              tree: parseTree(
                "(seq (child-set m0 99) (seq (child-turn 45) (bud)))",
              ),
            },
          ],
          [{ energy: 100, memory: [41] }],
          { capacity: 1, genomeCapacity: 1, treePrograms: 1, seed },
        );
        try {
          await e.step();
          const { c, counts } = await validate(e),
            memory = await e.cellMemory(0);
          assert.equal(counts.births, 1);
          assert.equal(counts.capacityDeaths, 1);
          assert.equal(c[0].energy, 44);
          assert.deepEqual(c[0].links, [0, 0, 0, 0]);
          if (c[0].id === 1) {
            parents++;
            assert.equal(memory[0], 41);
            assert.equal(c[0].heading, 0);
          } else {
            daughters++;
            assert.equal(memory[0], 99);
            assert.equal(c[0].heading, 0.125);
          }
        } finally {
          e.destroy();
        }
      }
      assert.ok(parents > 4 && daughters > 4);
    },
  );
  await check(
    "retained old and newborn links are reciprocal after parent or neighbor replacement",
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
    "corpses can be reclaimed without manufacturing an additional living death",
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
        assert.equal(counts.living + counts.corpses, 2);
        assert.equal(counts.deaths, counts.capacityDeaths);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "steady plus capacity-boost newcomers enter the same full-capacity competition",
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
        assert.equal(counts.randomArrivals + counts.sampledArrivals, 5);
        assert.equal(counts.capacityDeaths, 3);
        assert.equal(counts.capacityArrivals, 3);
        assert.equal(counts.living, 2);
        assert.equal(counts.energyBudget.arrivals, 272);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "culled pending daughters are removed from the mutation queue before it can saturate",
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
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-capacity-growth-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
} finally {
  device.destroy();
  delete globalThis.__growthGPU;
}
