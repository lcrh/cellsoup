import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
import { BodyArchive } from "./body-archive.mjs";
const output = process.argv[2];
if (!output) throw Error("Supply output JSON");
Object.assign(globalThis, globals);
globalThis.__archiveGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__archiveGPU.requestAdapter(),
  device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacityRate: 0,
  treePrograms: 1,
  manualArrivals: 1,
  capacity: 4,
  genomeCapacity: 8,
  initial: 0,
  floor: 0,
  rate: 2,
  side: 8,
  sources: 1,
  solarEnabled: 0,
  archiveEnabled: 1,
  archiveAge: 0,
  archiveHarvest: 0,
  archiveOffspring: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
};
const report = {
  scope:
    "Manual immigration reservations, crossovers, shared mutation ancestry, and automatic capture/admission; authored fixtures validate mechanisms only and never seed evolution.",
  checks: [],
};
try {
  for (const rate of [2, 0]) {
    const e = await createLifeEngine(device, { ...base, rate });
    try {
      await e.fixture({
        programs: [{ tree: parseTree("(wait 1000)") }],
        cells: [{ x: 40, y: 40, energy: 40 }],
      });
      await e.step(59);
      await e.admitBody({
        programs: [{ tree: parseTree("(seq (bud) (wait 1000))") }],
        cells: [{ x: 160, y: 160, energy: 120 }],
      });
      await e.step();
      const before = await e.counters();
      assert.equal(before.living, rate === 2 ? 2 : 3);
      assert.equal(before.births, rate === 2 ? 0 : 1);
      assert.equal(before.randomArrivals, 2);
      assert.ok(e.archivedTrees().length);
      assert.ok(e.archivedGenomeSlots().length);
      if (rate === 2) {
        const admitted = await e.admitBody({
          programs: [{ tree: parseTree("(wait 1000)") }],
          cells: [
            { x: 80, y: 80, energy: 12 },
            { x: 95, y: 80, energy: 12 },
          ],
        });
        assert.equal(admitted.admitted, 2);
        assert.equal((await e.counters()).living, 4);
      }
      report.checks.push({
        name: "arrival reservation at birth boundary",
        rate,
        before,
        after: await e.counters(),
      });
    } finally {
      e.destroy();
    }
  }
  const e = await createLifeEngine(device, { ...base, capacity: 12, rate: 0 });
  try {
    const first = parseTree("(seq (move 1) (wait 0))"),
      second = parseTree("(seq (photosynthesize) (wait 0))");
    await e.fixture({
      programs: [{ tree: first }, { tree: second }],
      cells: [
        { x: 40, y: 40, energy: 50 },
        { x: 58, y: 40, energy: 50, genome: 1 },
      ],
    });
    await e.step(60);
    const origin = await e.genome(0),
      secondOrigin = await e.genome(1);
    const admitted = await e.admitBody({
      programs: [
        { tree: second, origin, secondOrigin, mutated: false },
        { tree: first, origin, secondOrigin, mutated: true },
      ],
      cells: [
        { x: 100, y: 100, genome: 0, energy: 12, links: [2, 0, 0, 0] },
        { x: 118, y: 100, genome: 0, energy: 12, links: [1, 0, 0, 0] },
        { x: 130, y: 130, genome: 1, energy: 12 },
      ],
    });
    assert.equal(admitted.mutations, 1);
    assert.equal(admitted.crossovers, 2);
    for (let i = 0; i < 2; i++) {
      const g = await e.genome(admitted.genomeSlots[i]);
      assert.equal(g.parent, origin.serial);
      assert.equal(g.secondParent, secondOrigin.serial);
      assert.equal(g.depth, origin.depth + i);
    }
    const c = await e.counters();
    assert.equal(c.mutations, 1);
    assert.equal(c.crossovers, 2);
    assert.equal(c.sampledArrivals, 3);
    assert.equal((await e.genes()).stats[admitted.genomeSlots[0] * 4], 2);
    const stable = await e.state();
    await assert.rejects(
      e.admitBody({
        programs: [{ tree: first, secondOrigin }],
        cells: [{ x: 100, y: 100 }],
      }),
      /provenance/,
    );
    await assert.rejects(
      e.admitBody({
        programs: [{ tree: first, origin, secondOrigin: origin }],
        cells: [{ x: 100, y: 100 }],
      }),
      /distinct/,
    );
    assert.deepEqual(await e.state(), stable);
    await e.step(60);
    const archive = new BodyArchive({
      rng: () => 0,
      minimumAge: 0,
      captureBudget: 12,
      maxCells: 2,
    });
    assert.ok(await archive.capture(e, await e.state()));
    const plan = archive.plan(e, {
      budget: 2,
      freeCells: 7,
      freeGenes: 4,
      bodyShare: 1,
      mutation: 0,
      crossover: 0,
      rng: () => 0,
    });
    assert.equal(plan.cells.length, 2);
    assert.ok(plan.cells.every((x) => x.links.some(Boolean)));
    const inserted = await e.admitBody(plan);
    assert.equal(inserted.admitted, 2);
    assert.equal(inserted.mutations, 0);
    await e.step(2);
    report.checks.push({
      name: "crossover/mutation provenance and automatic structural archive",
      admitted,
      inserted,
      archive: archive.snapshot(),
      counters: await e.counters(),
    });
  } finally {
    e.destroy();
  }
  assert.deepEqual(errors, []);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ checks: report.checks.length, output }));
} finally {
  device.destroy();
  delete globalThis.__archiveGPU;
}
