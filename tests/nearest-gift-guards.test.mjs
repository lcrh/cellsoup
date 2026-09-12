import test from "node:test";
import assert from "node:assert/strict";
import { parseTree, printTree } from "../web/gpu/trees.js";
import { nearestGiftGuards } from "../research/nearest-gift-guards.mjs";
const gift = "(give (nearest-cell) (if (not true) (crowding) (bonds)))";
test("alive and kin gift controls differ by one sensed field and preserve source", () => {
  const tree = parseTree(`(seq (photosynthesize) ${gift} (bud))`),
    before = structuredClone(tree);
  const g = nearestGiftGuards(tree);
  assert.deepEqual(tree, before);
  assert.deepEqual(
    g.kin,
    parseTree(
      "(seq (photosynthesize) (give (nearest-cell) (if (kin (nearest-cell)) (bonds) 0)) (bud))",
    ),
  );
  assert.equal(g.kinSource, g.aliveSource.replace(/ alive\n/, " kin\n"));
});
test("assay fails closed if source gift pattern is absent or ambiguous", () => {
  assert.throws(() => nearestGiftGuards(parseTree("(bud)")), /exactly one/);
  assert.throws(
    () => nearestGiftGuards(parseTree(`(seq ${gift} ${gift})`)),
    /exactly one/,
  );
});
