import test from "node:test";
import assert from "node:assert/strict";
import {
  BodyArchive,
  fragmentObservation,
  resampleBodyProgram,
} from "../web/gpu/body-archive.js";
import { parseTree, compileTree } from "../web/gpu/trees.js";
const rng = (seed) => () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const genotypes = [
  {
    slot: 0,
    serial: 10,
    id: 10,
    founder: 10,
    depth: 3,
    tree: parseTree("(seq (bud) (photosynthesize))"),
  },
  {
    slot: 1,
    serial: 20,
    id: 20,
    founder: 20,
    depth: 4,
    tree: parseTree("(seq (move 1) (wait 0))"),
  },
];
function fixture() {
  const buffer = new ArrayBuffer(6 * 52 * 4),
    u = new Uint32Array(buffer),
    f = new Float32Array(buffer);
  for (let i = 0; i < 6; i++) {
    const k = i * 52;
    f[k] = i === 0 ? 254 : 8 + (i - 1) * 10;
    f[k + 1] = 100;
    f[k + 5] = 0.25;
    f[k + 36] = 1;
    u[k + 25] = i > 2 ? 1 : 0;
    u[k + 28] = 3600;
    u[k + 31] = 1;
    f[k + 44] = 0.1;
    f[k + 45] = 0.6;
  }
  for (let i = 0; i < 6; i++) {
    if (i % 3 !== 0) u[i * 52 + 32] = i;
    if (i % 3 !== 2) u[i * 52 + 34] = i + 2;
  }
  return buffer;
}
function engine() {
  return {
    cfg: { side: 8, seedEnergy: 12, seedStorage: 3 },
    tick: 600,
    archivedGenomeSlots: () => genotypes.map((g) => ({ ...g })),
    archivedTrees: () => structuredClone(genotypes),
    genome: async (slot) => structuredClone(genotypes[slot]),
  };
}
test("fragment capture bounds reciprocal connected geometry and rejects malformed input", () => {
  const b = fixture(),
    before = b.slice(0),
    o = fragmentObservation(b, 256, 0, 2, genotypes);
  assert.deepEqual(
    o.colonies[0].cells.map((c) => c.slot),
    [0, 1],
  );
  assert.deepEqual(
    o.colonies[0].cells.map((c) => c.linkSlots),
    [
      [null, null, 1, null],
      [0, null, null, null],
    ],
  );
  assert.deepEqual(b, before);
  for (const max of [0, -1, 65, 1.2, NaN])
    assert.throws(
      () => fragmentObservation(b, 256, 0, max, genotypes),
      /Invalid/,
    );
  assert.throws(
    () => fragmentObservation(new ArrayBuffer(8), 256, 0, 2, genotypes),
    /Invalid/,
  );
  new Uint32Array(b)[52 + 32] = 0;
  assert.equal(
    fragmentObservation(b, 256, 0, 3, genotypes).colonies[0].cells.length,
    1,
  );
});
test("archive requires mature qualifying linked roots, is bounded per lineage, and retains immutable source", async () => {
  const b = fixture(),
    e = engine(),
    captures = [],
    archive = new BodyArchive({
      rng: rng(41),
      capacity: 1,
      captureBudget: 6,
      maxCells: 3,
      onCapture: (x) => captures.push(x),
    });
  assert.equal(await archive.capture(e, b), 2);
  assert.equal(archive.size, 1);
  assert.equal(captures.length, 2);
  const snapshot = archive.snapshot();
  snapshot[0].observation.genomes[0].tree.op = "nop";
  assert.notEqual(archive.snapshot()[0].observation.genomes[0].tree.op, "nop");
  const empty = new BodyArchive({ rng: rng(3) });
  assert.equal(
    await empty.capture({ ...e, archivedGenomeSlots: () => [] }, b),
    0,
  );
  const young = b.slice(0),
    u = new Uint32Array(young);
  for (let i = 0; i < 6; i++) u[i * 52 + 28] = 3599;
  assert.equal(await empty.capture(e, young), 0);
  for (let i = 0; i < 6; i++) u.fill(0, i * 52 + 32, i * 52 + 36);
  assert.equal(await empty.capture(e, young), 0);
});
test("paired plans change only links, share genotype edits across clones, and respect cell/energy/genome budgets", async () => {
  const e = engine(),
    archive = new BodyArchive({ rng: rng(91), maxCells: 3, captureBudget: 6 });
  await archive.capture(e, fixture());
  for (let seed = 1; seed <= 100; seed++) {
    const args = {
      budget: 8,
      freeCells: 8,
      freeGenes: 8,
      bodyShare: 1,
      mutation: 0.8,
      crossover: 0.8,
    };
    const a = archive.plan(e, { ...args, rng: rng(seed) }),
      b = archive.plan(e, { ...args, rng: rng(seed), connected: false });
    assert.equal(a.source, "body");
    assert.equal(a.cells.length, 8);
    assert.equal(a.programs.length, 6);
    assert.deepEqual(a.programs, b.programs);
    assert.deepEqual(
      a.cells.map(({ links, ...c }) => c),
      b.cells.map(({ links, ...c }) => c),
    );
    assert.deepEqual(
      a.cells.slice(0, 3).map((c) => c.genome),
      [0, 0, 0],
    );
    assert.ok(a.cells.some((c) => c.links?.some(Boolean)));
    assert.ok(b.cells.every((c) => !c.links?.some(Boolean)));
    assert.equal(
      a.cells.reduce((s, c) => s + c.energy, 0),
      96,
    );
    assert.equal(
      a.cells.reduce((s, c) => s + c.storage, 0),
      24,
    );
    for (const p of a.programs) compileTree(p.tree);
  }
  const scarce = archive.plan(e, {
    budget: 8,
    freeCells: 8,
    freeGenes: 1,
    bodyShare: 1,
    rng: rng(2),
  });
  assert.equal(scarce.cells.length, 3);
  assert.equal(scarce.programs.length, 1);
  const tight = archive.plan(e, {
    budget: 8,
    freeCells: 2,
    freeGenes: 1,
    bodyShare: 1,
    rng: rng(2),
  });
  assert.equal(tight.source, "individual");
  assert.equal(tight.cells.length, 1);
  assert.equal(
    archive.plan(e, { budget: 8, freeCells: 0, freeGenes: 5, rng: rng(2) })
      .cells.length,
    0,
  );
});
test("a zero structural share gives ordinary independent arrivals; empty archives still generate random genomes", () => {
  const e = engine(),
    archive = new BodyArchive({ rng: rng(1) });
  const p = archive.plan(
    { ...e, archivedTrees: () => [] },
    { budget: 8, freeCells: 10, freeGenes: 10, bodyShare: 0, rng: rng(3) },
  );
  assert.equal(p.cells.length, 8);
  assert.equal(p.programs.length, 8);
  assert.ok(p.programs.every((g) => !g.origin && !g.mutated));
});
test("exact resampling and crossover without mutation preserve independent provenance", () => {
  let crossovers = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const exact = resampleBodyProgram(genotypes[0], genotypes, {
      rng: rng(seed),
      mutation: 0,
      crossover: 0,
    });
    assert.deepEqual(exact.tree, genotypes[0].tree);
    assert.equal(exact.mutated, false);
    assert.equal(exact.secondOrigin, undefined);
    const crossed = resampleBodyProgram(genotypes[0], genotypes, {
      rng: rng(seed),
      mutation: 0,
      crossover: 1,
    });
    assert.equal(crossed.mutated, false);
    assert.equal(crossed.origin.serial, 10);
    if (crossed.secondOrigin) {
      assert.equal(crossed.secondOrigin.serial, 20);
      crossovers++;
    }
    compileTree(crossed.tree);
  }
  assert.ok(crossovers > 50);
});

test("automatic body capture sanitizes duplicate and self links before replay", async () => {
  const buffer = fixture(),
    u = new Uint32Array(buffer),
    f = new Float32Array(buffer);
  // The GPU snapshot can contain repeated/self handles; stageBody deliberately
  // rejects both under its reciprocal-local-handles contract.
  u.set([2, 2, 1, 6], 32);
  u.set([1, 1, 2, 3], 52 + 32);
  f.set([0.1, 0.2, 0.3, 0.4], 44);
  f.set([0.5, 0.6, 0.7, 0.8], 52 + 44);
  const before = buffer.slice(0),
    observation = fragmentObservation(buffer, 256, 0, 3, genotypes);
  assert.deepEqual(
    observation.colonies[0].cells.map((c) => c.linkSlots),
    [
      [1, null, null, null],
      [0, null, null, 2],
      [1, null, null, null],
    ],
  );
  for (const cell of observation.colonies[0].cells)
    cell.linkSlots.forEach((neighbor, edge) => {
      if (neighbor === null) assert.equal(cell.anchors[edge], 0);
    });
  assert.equal(observation.colonies[0].cells[0].anchors[0], f[44]);
  assert.equal(observation.colonies[0].cells[1].anchors[3], f[52 + 47]);
  assert.deepEqual(buffer, before);
  const e = engine(),
    archive = new BodyArchive({ rng: () => 0, maxCells: 3, captureBudget: 1 });
  assert.equal(await archive.capture(e, buffer), 1);
  const captured = archive.snapshot();
  for (let seed = 0; seed < 64; seed++) {
    const plan = archive.plan(e, {
      budget: 3,
      freeCells: 3,
      freeGenes: 1,
      bodyShare: 1,
      archiveShare: 0,
      mutation: 0,
      crossover: 0,
      rng: rng(seed),
    });
    assert.equal(plan.source, "body");
    assert.equal(plan.cells.length, 3);
    for (const [i, c] of plan.cells.entries()) {
      const neighbors = c.links.filter(Boolean);
      assert.equal(new Set(neighbors).size, neighbors.length);
      assert.ok(!neighbors.includes(i + 1));
      for (const handle of neighbors)
        assert.ok(plan.cells[handle - 1].links.includes(i + 1));
    }
    plan.cells[0].links.fill(0);
  }
  assert.deepEqual(archive.snapshot(), captured);
});

test("self-only cells never qualify as a connected structural archive entry", async () => {
  const buffer = fixture(),
    u = new Uint32Array(buffer);
  for (let i = 0; i < 6; i++) u.set([i + 1, 0, 0, 0], i * 52 + 32);
  const observation = fragmentObservation(buffer, 256, 0, 3, genotypes);
  assert.equal(observation.colonies[0].cells.length, 1);
  assert.deepEqual(observation.colonies[0].cells[0].linkSlots, [
    null,
    null,
    null,
    null,
  ]);
  const archive = new BodyArchive({ rng: rng(7), captureBudget: 6 });
  assert.equal(await archive.capture(engine(), buffer), 0);
  assert.equal(archive.size, 0);
});
