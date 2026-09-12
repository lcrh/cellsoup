import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { writeFile } from "node:fs/promises";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
import { createTraceSelector } from "../web/gpu/execution-traces.js";
const output = process.argv[2];
if (!output) throw Error("Supply output JSON");
Object.assign(globalThis, globals);
globalThis.__forkGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __forkGPU.requestAdapter(),
  device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 16,
  genomeCapacity: 16,
  initial: 0,
  rate: 0,
  floor: 0,
  side: 8,
  sources: 1,
  solarEnabled: 0,
  archiveEnabled: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  activityHeating: 0,
  sunlightHeating: 0,
};
const report = { checks: [] };
async function living(e) {
  const b = await e.state(),
    u = new Uint32Array(b);
  return Array.from({ length: e.cfg.capacity }, (_, slot) => ({
    slot,
    u: Array.from(u.slice(slot * 52, slot * 52 + 52)),
  })).filter((c) => c.u[31] === 1);
}
try {
  for (const treePrograms of [0, 1])
    for (const forkMutation of [0, 1])
      for (const linked of [false, true]) {
        const e = await createLifeEngine(device, {
          ...base,
          treePrograms,
          forkMutation,
        });
        try {
          const code = treePrograms
            ? {
                tree: parseTree(
                  `(seq (${linked ? "bud" : "split"}) (wait 1000))`,
                ),
              }
            : `${linked ? "bud" : "split"} r0\nwait 1000`;
          await e.fixture({
            programs: [code],
            cells: [{ x: 100, y: 100, energy: 120, memory: [7] }],
          });
          const before = await e.genome(0);
          await e.step(1);
          const born = await living(e);
          assert.equal(born.length, 2);
          const child = born.find((c) => c.u[30]);
          assert.ok(child);
          assert.equal(child.u[27], forkMutation ? 0xffffffff : 1);
          if (forkMutation) {
            const selector = await createTraceSelector(device, e);
            try {
              const selected = await selector.select(1);
              assert.ok(
                !Array.from({ length: 32 }, (_, i) => selected[i * 4]).includes(
                  child.slot,
                ),
              );
            } finally {
              selector.destroy();
            }
          }
          await e.step(15);
          const cells = await living(e),
            after = await e.genome(0),
            c = await e.counters();
          assert.equal(after.source, before.source);
          assert.equal(c.births, 1);
          assert.equal(c.mutations, 0);
          assert.equal(c.divisionMutations, forkMutation);
          const daughter = cells.find((c) => c.u[30]);
          assert.equal(daughter.u[25], forkMutation ? 1 : 0);
          assert.equal(Boolean(daughter.u.slice(32, 36).some(Boolean)), linked);
          if (forkMutation) {
            const g = await e.genome(1);
            assert.notEqual(g.source, before.source);
            assert.equal(g.parent, before.serial);
            assert.equal(g.founder, before.founder);
            assert.equal(g.depth, before.depth + 1);
            assert.equal(daughter.u[26], 0);
            assert.equal(daughter.u[27], 0);
            if (treePrograms) {
              const m = await e.cellMemory(daughter.slot);
              assert.deepEqual(Array.from(m.slice(0, 8)), Array(8).fill(0));
              assert.equal((await e.treeMemory())[daughter.slot * 12 + 8], 1);
            }
          }
          const genes = await e.genes();
          assert.equal(genes.stats[0], forkMutation ? 1 : 2);
          if (forkMutation) assert.equal(genes.stats[4], 1);
          await e.step(16);
          assert.ok((await e.counters()).living >= 1);
          report.checks.push({
            treePrograms,
            forkMutation,
            linked,
            counters: c,
          });
        } finally {
          e.destroy();
        }
      }
  for (const treePrograms of [0, 1]) {
    const e = await createLifeEngine(device, {
      ...base,
      treePrograms,
      forkMutation: 1,
      genomeCapacity: 1,
    });
    try {
      await e.fixture({
        programs: [
          treePrograms
            ? { tree: parseTree("(seq (bud) (wait 1000))") }
            : "bud r0\nwait 1000",
        ],
        cells: [{ x: 100, y: 100, energy: 120 }],
      });
      const source = (await e.genome(0)).source;
      await e.step(16);
      const cells = await living(e),
        c = await e.counters();
      assert.equal(cells.length, 2);
      assert.equal(c.divisionMutations, 0);
      assert.equal(c.skippedDivisionMutations, 1);
      assert.ok(cells.every((x) => x.u[25] === 0 && x.u[27] !== 0xffffffff));
      assert.equal((await e.genome(0)).source, source);
      report.checks.push({
        name: "genotype capacity fallback",
        treePrograms,
        counters: c,
      });
    } finally {
      e.destroy();
    }
  }
  // Chunk boundaries must not change when newborn genomes are assigned.
  const snapshots = [];
  for (const chunks of [[16], [1, 3, 5, 7]]) {
    const e = await createLifeEngine(device, {
      ...base,
      treePrograms: 1,
      forkMutation: 1,
    });
    try {
      await e.fixture({
        programs: [{ tree: parseTree("(seq (bud) (wait 1000))") }],
        cells: [{ x: 100, y: 100, energy: 120 }],
      });
      for (const ticks of chunks) await e.step(ticks);
      snapshots.push({
        state: Array.from(new Uint32Array(await e.state())),
        genes: Array.from(new Uint8Array((await e.genes()).data)),
        memory: Array.from(await e.treeMemory()),
        counters: await e.counters(),
      });
    } finally {
      e.destroy();
    }
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
  report.checks.push({
    name: "fixed mutation boundaries independent of step chunking",
  });
  // A stale request must not mutate a newer cell that reuses the same slot.
  const reuse = await createLifeEngine(device, {
    ...base,
    treePrograms: 1,
    forkMutation: 1,
    corpseEnergy: 0,
  });
  try {
    await reuse.fixture({
      programs: [
        { tree: parseTree("(seq (bud) (wait 1000))") },
        { tree: parseTree("(seq (wait 4) (bud) (wait 1000))") },
      ],
      cells: [
        { x: 60, y: 60, energy: 120, storage: 0 },
        { x: 180, y: 180, energy: 120, storage: 0, genome: 1 },
      ],
    });
    await reuse.step(1);
    const old = (await living(reuse)).find((c) => c.u[30]);
    assert.ok(old);
    const data = await reuse.state();
    new Float32Array(data)[old.slot * 52 + 4] = 0;
    device.queue.writeBuffer(reuse.currentState, 0, data);
    await reuse.step(15);
    const c = await reuse.counters();
    assert.equal(c.births, 2);
    assert.equal(c.deaths, 1);
    assert.equal(c.divisionMutations, 1);
    const child = (await living(reuse)).find((c) => c.u[30]);
    assert.ok(child);
    assert.notEqual(child.u[24], old.u[24]);
    assert.equal(
      (await reuse.genome(child.u[25])).parent,
      (await reuse.genome(1)).serial,
    );
    report.checks.push({
      name: "dead requests cannot mutate replacement cells",
      sameSlotReused: child.slot === old.slot,
      counters: c,
    });
    assert.equal(child.slot, old.slot);
  } finally {
    reuse.destroy();
  }

  assert.deepEqual(errors, []);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ checks: report.checks.length, output }));
} finally {
  device.destroy();
  delete globalThis.__forkGPU;
}
