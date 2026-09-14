import test from "node:test";
import assert from "node:assert/strict";
import { capacitySelection } from "../web/gpu/capacity-selection.js";
import { WORLD_CAPACITIES } from "../web/gpu/world-controls.js";

test("living and corpse pools plus birth staging fit the negotiated 256 MiB storage binding limit", () => {
  for (const capacity of WORLD_CAPACITIES) {
    const selection = capacitySelection({
      capacity,
      entityCapacity: 2 * capacity,
      genomeCapacity: capacity / 4,
      policy: "living",
    });
    assert.equal(selection.candidates, capacity * 4 + capacity / 4);
    assert.ok(selection.candidates * 208 <= 256 * 1024 ** 2);
    assert.ok(selection.byteLength > selection.candidates * 8);
    if (capacity === 262144)
      assert.ok(selection.candidates * 208 > 128 * 1024 ** 2);
  }
});
test("legacy entity selection and small genotype pools retain their dimensions", () => {
  assert.equal(
    capacitySelection({ capacity: 8, genomeCapacity: 2 }).candidates,
    80,
  );
  assert.equal(
    capacitySelection({ capacity: 8, entityCapacity: 16, genomeCapacity: 2 })
      .candidates,
    96,
  );
});
test("independent cohort passes share scratch storage but have unique entry points", () => {
  const args = { capacity: 8, entityCapacity: 16, genomeCapacity: 2 };
  const living = capacitySelection({ ...args, policy: "living" }),
    corpses = capacitySelection({
      ...args,
      policy: "corpses",
      prefix: "corpse",
    });
  assert.equal(living.declarations, corpses.declarations);
  assert.equal(living.byteLength, corpses.byteLength);
  assert.equal(living.stages.length, 18);
  assert.equal(corpses.stages.length, 18);
  const names = [...living.stages, ...corpses.stages].map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
});
test("selector rejects invalid pool dimensions and policies", () => {
  for (const override of [
    { capacity: 0 },
    { capacity: 262145 },
    { genomeCapacity: 0 },
    { genomeCapacity: 65537 },
    { entityCapacity: 3 },
    { entityCapacity: 524289 },
    { entityCapacity: 8.5 },
    { policy: "youngest" },
    { prefix: "bad-name" },
    { prefix: "0name" },
  ])
    assert.throws(
      () => capacitySelection({ capacity: 4, genomeCapacity: 1, ...override }),
      /dimensions/,
    );
});
