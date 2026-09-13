import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__capacityGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __capacityGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const output = process.argv[2];
if (!output) throw Error("Supply report JSON");
const base = {
  capacity: 4,
  genomeCapacity: 4,
  initial: 0,
  rate: 0,
  floor: 0,
  capacityRate: 2,
  side: 8,
  sources: 1,
  treePrograms: 1,
  solarEnabled: 0,
  archiveEnabled: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  activityHeating: 0,
  sunlightHeating: 0,
  heatDamage: 0,
  cooling: 0,
  springStiffness: 0,
  collisionStiffness: 0,
  linkBarrierStiffness: 0,
  linkBarrierDamping: 0,
  resistCost: 0,
  share: 0,
  functionMask0: 0,
  functionMask1: 0,
  functionMask2: 0,
  functionMask3: 0,
};
const report = { checks: [] };
async function inspect(e) {
  const buffer = await e.state();
  return {
    u: new Uint32Array(buffer),
    f: new Float32Array(buffer),
    c: await e.counters(),
    genes: await e.genes(),
    memory: await e.treeMemory(),
  };
}
async function audit(e, s) {
  const refs = new Uint32Array(e.cfg.genomeCapacity);
  let alive = 0,
    corpses = 0;
  for (let i = 0; i < e.cfg.capacity; i++) {
    const at = i * 52;
    if (s.u[at + 31] === 1) {
      alive++;
      refs[s.u[at + 25]]++;
      for (let k = 0; k < 4; k++) {
        const h = s.u[at + 32 + k];
        if (h) {
          assert.equal(s.u[(h - 1) * 52 + 31], 1);
          assert.ok(
            [...s.u.slice((h - 1) * 52 + 32, (h - 1) * 52 + 36)].includes(
              i + 1,
            ),
          );
        }
      }
    } else if (s.u[at + 31] === 2) corpses++;
  }
  assert.equal(alive, s.c.living);
  assert.equal(corpses, s.c.corpses);
  assert.equal(
    alive,
    s.c.randomArrivals + s.c.sampledArrivals + s.c.births - s.c.deaths,
  );
  for (let g = 0; g < refs.length; g++)
    assert.equal(refs[g], s.genes.stats[g * 4]);
}
async function fixture(
  e,
  { count = 4, shared = false, corpse = false, linked = false } = {},
) {
  await e.fixture({
    programs: Array.from({ length: shared ? 1 : 4 }, () => ({
      tree: parseTree("(seq (resist 1) (wait 1000))"),
    })),
    cells: Array.from({ length: count }, (_, i) => ({
      x: 100 + (i % 2) * 14,
      y: 100 + Math.floor(i / 2) * 14,
      genome: shared ? 0 : i,
      corpse,
      energy: 70,
      storage: 20,
      memory: [7],
      links: linked
        ? [((i + 1) % 4) + 1, ((i + 3) % 4) + 1, 0, 0]
        : [0, 0, 0, 0],
    })),
  });
}
async function run(name, fn) {
  await fn();
  report.checks.push(name);
  console.log("PASS", name);
}
try {
  await run(
    "full living population replaces independent random genomes, cleans physiology/links/mail and preserves ledgers",
    async () => {
      const e = await createLifeEngine(device, {
        ...base,
        linkedRelay: 0.5,
        specializationStrength: 0.5,
      });
      try {
        await fixture(e, { linked: true });
        await e.step(59);
        const before = await inspect(e);
        for (let i = 0; i < 4; i++) {
          device.queue.writeBuffer(
            e.currentState,
            (i * 52 + 40) * 4,
            new Uint32Array([((i + 1) % 4) + 1, 0, 0, 0]),
          );
          device.queue.writeBuffer(
            e.currentState,
            (i * 52 + 20) * 4,
            new Float32Array([91, 0, 0, 0]),
          );
        }
        await e.step();
        const after = await inspect(e),
          newcomers = [];
        for (let i = 0; i < 4; i++)
          if (before.u[i * 52 + 24] !== after.u[i * 52 + 24]) newcomers.push(i);
        assert.equal(newcomers.length, 2);
        assert.equal(after.c.capacityArrivals, 2);
        assert.equal(after.c.deaths, 2);
        assert.equal(after.c.kills, 0);
        assert.equal(after.c.randomArrivals, 6);
        for (const i of newcomers) {
          assert.equal(after.u[i * 52 + 31], 1);
          assert.deepEqual(
            [...after.u.slice(i * 52 + 8, i * 52 + 24)],
            Array(16).fill(0),
          );
          assert.deepEqual(
            [...after.u.slice(i * 52 + 32, i * 52 + 36)],
            Array(4).fill(0),
          );
          assert.deepEqual([...(await e.cellMemory(i))], Array(8).fill(0));
          assert.deepEqual(await e.cellSpecialization(i), [0, 0, 0]);
          assert.equal(await e.cellResistance(i), 0);
          assert.equal(after.f[i * 52 + 4], e.cfg.seedEnergy * 4096);
          assert.equal(after.f[i * 52 + 38], e.cfg.seedStorage * 4096);
        }
        for (let i = 0; i < 4; i++)
          for (let ch = 0; ch < 4; ch++) {
            assert.ok(!newcomers.includes(after.u[i * 52 + 32 + ch] - 1));
            assert.ok(!newcomers.includes(after.u[i * 52 + 40 + ch] - 1));
          }
        await audit(e, after);
        await e.step(60);
        assert.equal((await e.counters()).capacityArrivals, 4);
        await audit(e, await inspect(e));
      } finally {
        e.destroy();
      }
    },
  );
  for (const [name, options, setup] of [
    ["zero rate", { capacityRate: 0 }, {}],
    ["manual arrivals", { manualArrivals: 1 }, {}],
    ["below capacity", {}, { count: 2 }],
  ])
    await run(name + " leaves residents intact", async () => {
      const e = await createLifeEngine(device, { ...base, ...options });
      try {
        await fixture(e, setup);
        const before = await inspect(e);
        await e.step(60);
        const after = await inspect(e);
        assert.equal(after.c.capacityArrivals, 0);
        for (let i = 0; i < 4; i++)
          assert.equal(after.u[i * 52 + 24], before.u[i * 52 + 24]);
        await audit(e, after);
      } finally {
        e.destroy();
      }
    });
  await run(
    "full corpse world reclaims remains without inventing deaths or attack kills",
    async () => {
      const e = await createLifeEngine(device, base);
      try {
        await fixture(e, { corpse: true });
        await e.step(60);
        const s = await inspect(e);
        assert.equal(s.c.capacityArrivals, 2);
        assert.equal(s.c.living, 2);
        assert.equal(s.c.corpses, 2);
        assert.equal(s.c.deaths, 0);
        assert.equal(s.c.kills, 0);
        await audit(e, s);
      } finally {
        e.destroy();
      }
    },
  );
  await run(
    "unavailable genome allocation is atomic: no victims or source changes",
    async () => {
      const engines = await Promise.all([
        createLifeEngine(device, {
          ...base,
          genomeCapacity: 1,
          capacityRate: 0,
        }),
        createLifeEngine(device, { ...base, genomeCapacity: 1 }),
      ]);
      try {
        for (const e of engines) {
          await fixture(e, { shared: true });
          await e.step(60);
        }
        const a = await inspect(engines[0]),
          b = await inspect(engines[1]);
        assert.deepEqual(b.u, a.u);
        assert.deepEqual(b.genes.stats, a.genes.stats);
        assert.deepEqual(
          new Uint8Array(b.genes.data),
          new Uint8Array(a.genes.data),
        );
        assert.deepEqual(b.c, a.c);
        assert.deepEqual(b.memory, a.memory);
        await audit(engines[1], b);
      } finally {
        engines.forEach((e) => e.destroy());
      }
    },
  );
  await run(
    "archive resampling and body sampler coexist with full-capacity turnover",
    async () => {
      const e = await createLifeEngine(device, {
        ...base,
        archiveEnabled: 1,
        archiveAge: 0,
        archiveHarvest: 0,
        archiveOffspring: 0,
        share: 1,
        mutation: 0,
        crossover: 0,
        bodyShare: 0.5,
      });
      try {
        await fixture(e);
        await e.step(60);
        const s = await inspect(e);
        assert.equal(s.c.capacityArrivals, 2);
        assert.equal(s.c.sampledArrivals, 2);
        assert.equal(s.c.randomArrivals, 4);
        assert.equal(s.c.mutations, 0);
        for (let i = 0; i < 4; i++)
          if (s.u[i * 52 + 24] > 4) {
            const g = await e.genome(s.u[i * 52 + 25]);
            assert.ok(g.parent >= 1 && g.parent <= 4);
            assert.equal(g.founder, g.parent);
            assert.equal(g.depth, 0);
            assert.equal(g.bornTick, 60);
          }
        await audit(e, s);
      } finally {
        e.destroy();
      }
    },
  );
  await run(
    "body admissions fill free slots before capacity turnover in the same second",
    async () => {
      const e = await createLifeEngine(device, {
        ...base,
        capacity: 8,
        genomeCapacity: 8,
        rate: 4,
        archiveEnabled: 1,
        archiveAge: 0,
        archiveHarvest: 0,
        archiveOffspring: 0,
        share: 1,
        mutation: 0,
        crossover: 0,
        bodyShare: 1,
        bodyPreserveLinks: 1,
        bodyMaxCells: 4,
        bodyCaptureSeconds: 1,
      });
      try {
        await fixture(e, { linked: true });
        await e.step(60);
        const s = await inspect(e);
        assert.equal(e.bodyStats().admitted, 4);
        assert.equal(s.c.capacityArrivals, 2);
        assert.equal(s.c.sampledArrivals, 6);
        assert.equal(s.c.living, 8);
        await audit(e, s);
      } finally {
        e.destroy();
      }
    },
  );
  await run(
    "capacity archive mutation uses the configured mutation rate and ancestry",
    async () => {
      const e = await createLifeEngine(device, {
        ...base,
        archiveEnabled: 1,
        archiveAge: 0,
        archiveHarvest: 0,
        archiveOffspring: 0,
        share: 1,
        mutation: 1,
        crossover: 0,
      });
      try {
        await fixture(e);
        await e.step(60);
        const s = await inspect(e);
        assert.equal(s.c.sampledArrivals, 2);
        assert.equal(s.c.mutations, 2);
        for (let i = 0; i < 4; i++)
          if (s.u[i * 52 + 24] > 4) {
            const gene = await e.genome(s.u[i * 52 + 25]);
            assert.equal(gene.depth, 1);
            assert.ok(gene.parent >= 1 && gene.parent <= 4);
            assert.notDeepEqual(
              gene.tree,
              parseTree("(seq (resist 1) (wait 1000))"),
            );
          }
        await audit(e, s);
      } finally {
        e.destroy();
      }
    },
  );
  await run(
    "invalid and excessively large turnover rates are rejected",
    async () => {
      for (const capacityRate of [-1, 0.5, 5, 65])
        await assert.rejects(
          createLifeEngine(device, { ...base, capacityRate }),
          /capacityRate/,
        );
    },
  );
  await device.queue.onSubmittedWorkDone();
  assert.deepEqual(errors, []);
  report.success = true;
  await writeFile(output, JSON.stringify(report, null, 2));
} finally {
  device.destroy();
  delete globalThis.__capacityGPU;
}
