// Validate runtime fragment admission independently of any selection scheme.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
import { readCellActivity } from "./colony-activity.mjs";
const output = process.argv[2];
if (!output) throw Error("Supply output JSON");
Object.assign(globalThis, globals);
globalThis.__bodyGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__bodyGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const cfg = {
  treePrograms: 1,
  capacity: 8,
  genomeCapacity: 4,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  sources: 1,
  solarEnabled: 0,
  archiveEnabled: 0,
};
const report = {
  scope:
    "Runtime admission mechanics only: no group archive, fitness selection or changed immigration rate. Existing residents and corpses must not be overwritten; incomplete admissions must be side-effect free. New cells retain supplied geometry/links but start fresh physiology and VM state.",
  checks: [],
};
async function snapshot(e) {
  return {
    state: Array.from(new Uint32Array(await e.state())),
    counters: await e.counters(),
    genes: Array.from((await e.genes()).stats),
    memory: Array.from(await e.treeMemory()),
  };
}
try {
  const e = await createLifeEngine(device, cfg);
  try {
    const tree = parseTree("(seq (set m0 (+ (memory m0) 1)) (wait 0))");
    await e.fixture({
      programs: [{ tree }],
      cells: [
        {
          slot: 3,
          x: 100,
          y: 100,
          energy: 50,
          storage: 20,
          memory: [5],
          age: 100,
          generation: 3,
          temperature: 30,
        },
        { slot: 0, x: 200, y: 200, corpse: true, energy: 10 },
      ],
    });
    await e.step(3);
    const origin = await e.genome(0),
      before = await snapshot(e);
    const body = {
      programs: [
        { tree, origin },
        { tree: parseTree("(wait 1000)"), origin },
      ],
      cells: [
        {
          genome: 0,
          x: 255,
          y: 100,
          heading: -0.1,
          energy: 24,
          storage: 12,
          links: [0, 0, 2, 0],
          anchors: [0, 0, 0.25, 0],
        },
        {
          genome: 1,
          x: 273,
          y: 100,
          heading: 1.1,
          energy: 24,
          storage: 12,
          links: [1, 0, 0, 0],
          anchors: [0.75, 0, 0, 0],
        },
      ],
    };
    const admission = await e.admitBody(body),
      after = await snapshot(e),
      f = new Float32Array(new Uint32Array(after.state).buffer);
    assert.deepEqual(admission.cellSlots, [1, 2]);
    assert.deepEqual(admission.genomeSlots, [1, 2]);
    assert.equal(admission.mutations, 1);
    assert.deepEqual(after.state.slice(0, 52), before.state.slice(0, 52));
    assert.deepEqual(after.state.slice(156, 208), before.state.slice(156, 208));
    assert.deepEqual(after.state.slice(52 + 32, 52 + 36), [0, 0, 3, 0]);
    assert.deepEqual(after.state.slice(104 + 32, 104 + 36), [2, 0, 0, 0]);
    assert.equal(f[52], 255);
    assert.equal(f[104], 17);
    assert.equal(f[52 + 46], 0.25);
    assert.equal(f[104 + 44], 0.75);
    for (const slot of admission.cellSlots) {
      const k = slot * 52;
      assert.equal(after.state[k + 31], 1);
      assert.deepEqual(after.state.slice(k + 26, k + 31), [0, 0, 0, 0, 0]);
      assert.deepEqual(
        after.memory.slice(slot * 12, slot * 12 + 12),
        Array(12).fill(0),
      );
      assert.equal(f[k + 4] / 4096, 24);
      assert.equal(f[k + 38] / 4096, 12);
      assert.equal(f[k + 39], 20);
    }
    const activity = await readCellActivity(device, e);
    for (const slot of admission.cellSlots)
      assert.deepEqual(
        Array.from(activity.slice(slot * 8, slot * 8 + 8)),
        Array(8).fill(0),
      );
    assert.equal(after.counters.living, before.counters.living + 2);
    assert.equal(after.counters.sampledArrivals, 2);
    assert.equal(after.counters.births, before.counters.births);
    assert.equal(after.counters.randomArrivals, before.counters.randomArrivals);
    for (let j = 0; j < 2; j++) {
      const gene = await e.genome(admission.genomeSlots[j]);
      assert.equal(gene.parent, origin.serial);
      assert.equal(gene.founder, origin.founder);
      assert.equal(gene.depth, origin.depth + j);
      assert.equal(gene.bornTick, 3);
      assert.equal(after.genes[admission.genomeSlots[j] * 4], 1);
    }
    await e.step(2);
    assert.ok((await e.cellMemory(1))[0] > 0);
    assert.equal((await e.cellMemory(2))[0], 0);
    report.checks.push({
      name: "preserved links, seam geometry, shared ancestry, mutation count and fresh state",
      config: e.cfg,
      kernel: e.fingerprint,
      admission,
      before,
      after,
    });
    const stable = await snapshot(e);
    await assert.rejects(
      e.admitBody({
        ...body,
        cells: [
          { ...body.cells[0], links: [2, 0, 0, 0] },
          { ...body.cells[1], links: [0, 0, 0, 0] },
        ],
      }),
      /reciprocal/,
    );
    await assert.rejects(
      e.admitBody({
        ...body,
        cells: [{ ...body.cells[0], memory: [4] }, body.cells[1]],
      }),
      /reset/,
    );
    await assert.rejects(
      e.admitBody({
        ...body,
        programs: [{ tree, origin: { ...origin, serial: 0 } }, { tree }],
      }),
      /ancestry/,
    );
    assert.deepEqual(await snapshot(e), stable);
    const tooLarge = {
      programs: [{ tree }],
      cells: Array.from({ length: 8 }, () => ({ x: 80, y: 80 })),
    };
    assert.equal((await e.admitBody(tooLarge)).admitted, 0);
    assert.deepEqual(await snapshot(e), stable);
    const stepping = e.step(1);
    await assert.rejects(e.admitBody(body), /already in progress/);
    await stepping;
    report.checks.push({
      name: "validation/capacity failure is atomic; admission cannot interleave with stepping",
    });
  } finally {
    e.destroy();
  }
  const recycled = await createLifeEngine(device, {
    ...cfg,
    archiveEnabled: 1,
    archiveAge: 0,
    archiveHarvest: 0,
    archiveOffspring: 0,
    share: 1,
    mutation: 0,
    crossover: 0,
  });
  try {
    const original = parseTree("(wait 1000)");
    await recycled.fixture({
      programs: [{ tree: original }],
      cells: [{ x: 40, y: 40 }],
    });
    await recycled.step(60);
    const archived = recycled.archivedTrees();
    assert.ok(archived.some((g) => g.id === 1));
    const data = await recycled.state();
    new Float32Array(data)[4] = 0;
    device.queue.writeBuffer(recycled.currentState, 0, data);
    await recycled.step();
    const admitted = await recycled.admitBody({
      programs: [{ tree: parseTree("(photosynthesize)") }],
      cells: [{ x: 160, y: 160 }],
    });
    assert.equal(admitted.genomeSlots[0], 0);
    recycled.setImmigration({ rate: 1, floor: 0 });
    await recycled.step(59);
    assert.deepEqual(
      recycled.archivedTrees().find((g) => g.id === 1).tree,
      original,
    );
    const counters = await recycled.counters();
    assert.equal(
      counters.living,
      counters.randomArrivals +
        counters.sampledArrivals +
        counters.births -
        counters.deaths,
    );
    report.checks.push({
      name: "archived typed source survives runtime genotype-slot recycling and subsequent ordinary arrivals",
      admitted,
      counters,
    });
  } finally {
    recycled.destroy();
  }
  const limited = await createLifeEngine(device, { ...cfg, genomeCapacity: 1 });
  try {
    const tree = parseTree("(wait 1000)");
    await limited.fixture({ programs: [{ tree }], cells: [{ x: 50, y: 50 }] });
    await limited.step();
    const before = await snapshot(limited);
    const result = await limited.admitBody({
      programs: [{ tree }],
      cells: [{ x: 100, y: 100 }],
    });
    assert.equal(result.admitted, 0);
    assert.deepEqual(await snapshot(limited), before);
    report.checks.push({
      name: "genome capacity shortage cannot create a partial body",
      result,
    });
  } finally {
    limited.destroy();
  }
  assert.deepEqual(errors, []);
  report.complete = true;
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "PASS body admission, ancestry, fresh state, capacity, failure atomicity and operation serialization",
  );
} finally {
  device.destroy();
  delete globalThis.__bodyGPU;
}
