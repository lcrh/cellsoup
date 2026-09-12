import test from "node:test";
import assert from "node:assert/strict";
import { colonyPropagule } from "../research/colony-propagule.mjs";
const fixture = () => ({
  world: 100,
  seconds: 60,
  genomes: [{ slot: 7, tree: { op: "bud", args: [] } }],
  colonies: [
    {
      cells: [
        {
          slot: 10,
          x: 98,
          y: 50,
          heading: 0.1,
          rest: 1,
          genomeSlot: 7,
          linkSlots: [null, null, 20, null],
          anchors: [0, 0, 0.2, 0],
          memory: [42],
        },
        {
          slot: 20,
          x: 8,
          y: 50,
          heading: 0.1,
          rest: 0.9,
          genomeSlot: 7,
          linkSlots: [10, null, null, 30],
          anchors: [0.7, 0, 0, 0.2],
        },
        {
          slot: 30,
          x: 18,
          y: 50,
          heading: 0.1,
          rest: 1,
          genomeSlot: 7,
          linkSlots: [null, 20, null, null],
          anchors: [0, 0.7, 0, 0],
        },
      ],
    },
  ],
});
test("propagules preserve positional links and rotate wrapped geometry with headings", () => {
  const observation = fixture(),
    before = structuredClone(observation);
  const result = colonyPropagule(observation, { maxCells: 3, rotation: 0.35 });
  assert.deepEqual(
    result.cells.map((c) => c.links),
    [
      [0, 0, 2, 0],
      [1, 0, 0, 3],
      [0, 2, 0, 0],
    ],
  );
  assert.equal(result.cells[0].energy, 32);
  assert.ok(Math.abs(result.cells[1].x - 1024) < 1e-6);
  assert.ok(Math.abs(result.cells[1].y - 1034) < 1e-6);
  assert.ok(Math.abs(result.cells[1].heading - 0.35) < 1e-6);
  assert.equal(result.cells[1].rest, 0.9);
  assert.equal(result.cells[0].memory, undefined);
  assert.deepEqual(observation, before);
  result.programs[0].tree.op = "nop";
  assert.equal(observation.genomes[0].tree.op, "bud");
});
test("fragment cuts keep link-slot holes; disconnected control differs only in links", () => {
  const a = colonyPropagule(fixture(), { maxCells: 2 }),
    b = colonyPropagule(fixture(), { maxCells: 2, connected: false });
  assert.deepEqual(
    a.cells.map((c) => c.links),
    [
      [0, 0, 2, 0],
      [1, 0, 0, 0],
    ],
  );
  assert.deepEqual(a.provenance.sourceSlots, [10, 20]);
  assert.equal(
    a.cells.reduce((sum, c) => sum + c.energy, 0),
    96,
  );
  assert.deepEqual(
    a.cells.map(({ links, ...c }) => c),
    b.cells.map(({ links, ...c }) => c),
  );
  assert.ok(b.cells.every((c) => c.links.every((n) => n === 0)));
});
test("legacy adjacency and inconsistent observations fail instead of inventing topology", () => {
  const old = fixture();
  delete old.colonies[0].cells[0].linkSlots;
  assert.throws(() => colonyPropagule(old), /Positional/);
  const broken = fixture();
  broken.colonies[0].cells[1].linkSlots[0] = null;
  assert.throws(() => colonyPropagule(broken), /reciprocal/);
  const missing = fixture();
  missing.genomes = [];
  assert.throws(() => colonyPropagule(missing), /genome/);
  assert.throws(() => colonyPropagule(fixture(), { rootSlot: 99 }), /outside/);
  assert.throws(
    () => colonyPropagule(fixture(), { maxCells: 1, totalEnergy: 201 }),
    /capacity/,
  );
});

test("fragments unwrap along links and reject a winding cycle", () => {
  const o = fixture();
  o.colonies[0].cells = Array.from({ length: 4 }, (_, i) => ({
    slot: i,
    x: i * 25,
    y: 0,
    heading: 0,
    rest: 1,
    genomeSlot: 7,
    linkSlots: [(i + 1) % 4, (i + 3) % 4, null, null],
    anchors: [0, 0, 0, 0],
  }));
  assert.throws(() => colonyPropagule(o, { maxCells: 4 }), /winds/);
  const partial = colonyPropagule(o, { maxCells: 3 });
  assert.deepEqual(
    partial.cells.map((c) => c.x),
    [1024, 1049, 999],
  );
});
