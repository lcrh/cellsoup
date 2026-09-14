import test from "node:test";
import assert from "node:assert/strict";
import { capacitySelection } from "../web/gpu/capacity-selection.js";
import { WORLD_CAPACITIES } from "../web/gpu/world-controls.js";

test("temporary birth space supports every public capacity within the default storage binding limit", () => {
  for (const capacity of WORLD_CAPACITIES) {
    const selection = capacitySelection({
      capacity,
      genomeCapacity: capacity / 4,
    });
    // One daughter per resident plus a genotype-sized newcomer batch.
    assert.equal(selection.candidates, capacity * 2 + capacity / 4);
    assert.ok(selection.candidates * 208 <= 128 * 1024 ** 2);
    assert.ok(selection.byteLength > selection.candidates * 8);
  }
});

test("small genotype pools can still stage a complete 64-cell body", () => {
  const selection = capacitySelection({ capacity: 8, genomeCapacity: 2 });
  assert.equal(selection.candidates - 16, 64);
  for (const [capacity, genomeCapacity] of [
    [0, 1],
    [262145, 1],
    [1, 0],
    [1, 65537],
  ])
    assert.throws(
      () => capacitySelection({ capacity, genomeCapacity }),
      /dimensions/,
    );
});
