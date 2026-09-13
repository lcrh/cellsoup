import test from "node:test";
import assert from "node:assert/strict";
import {
  energyFillGain,
  MAX_ENERGY_CAPACITY,
  MAX_STORAGE_CAPACITY,
  MAX_FILL_SCALE,
} from "../web/gpu/energy-fill.js";
const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`,
  );

test("logarithmic fill is nearly linear near empty and marginal efficiency follows exp(-E/K)", () => {
  for (const scale of [1, 40, 100, 256]) {
    const tiny = scale * 1e-6;
    for (const multiple of [0, 1, 2, 3, 10]) {
      const gain = energyFillGain(scale * multiple, tiny, scale);
      close(gain / tiny, Math.exp(-multiple), 1e-6);
    }
  }
});
test("a single intake and many chunks agree when no costs or redistribution intervene", () => {
  for (const scale of [1, 40, 100, 256])
    for (const start of [0, 10, 200, 1000])
      for (const incoming of [0.001, 1, 200, 5000]) {
        const once = start + energyFillGain(start, incoming, scale);
        let split = start;
        for (let i = 0; i < 1000; i++)
          split += energyFillGain(split, incoming / 1000, scale);
        close(split, once, 2e-11);
      }
});
test("larger pools receive less credit, larger K softens the penalty, and credit never creates energy", () => {
  for (const incoming of [0, 0.0001, 1, 500, 1e9]) {
    for (const scale of [1, 20, 100, MAX_FILL_SCALE]) {
      let previous = Infinity;
      for (const energy of [0, 1, 20, 100, 500, MAX_ENERGY_CAPACITY]) {
        const gain = energyFillGain(energy, incoming, scale);
        assert.ok(Number.isFinite(gain) && gain >= 0 && gain <= incoming);
        assert.ok(gain <= previous);
        assert.ok(
          gain <=
            energyFillGain(
              energy,
              incoming,
              Math.min(MAX_FILL_SCALE, 2 * scale),
            ),
        );
        previous = gain;
      }
    }
  }
});
test("store/mobilize and donor/recipient conversion chains cannot increase total energy", () => {
  for (const scale of [20, 100, 256]) {
    let energy = 150,
      storage = 25;
    for (let i = 0; i < 100; i++) {
      const total = energy + storage;
      const spend = Math.min(3, energy);
      energy -= spend;
      storage += energyFillGain(storage, spend, scale);
      const withdraw = Math.min(3, storage);
      storage -= withdraw;
      energy += energyFillGain(energy, withdraw, scale);
      assert.ok(energy + storage <= total + 1e-12);
    }
  }
});
test("linear mode, empty inputs and invalid values are explicit", () => {
  assert.equal(energyFillGain(1000, 50, 0), 50);
  assert.equal(energyFillGain(100, 0, 100), 0);
  for (const scale of [0.5, 257])
    assert.throws(() => energyFillGain(1, 1, scale));
  for (const value of [-1, NaN, Infinity, -Infinity]) {
    assert.throws(() => energyFillGain(value, 1, 100));
    assert.throws(() => energyFillGain(1, value, 100));
    assert.throws(() => energyFillGain(1, 1, value));
  }
});
test("numeric balance ceilings reserve exact Float32 quanta for the largest barrier and corpse", () => {
  const exactQuantaLimit = 2 ** 24;
  assert.ok((MAX_ENERGY_CAPACITY + 200) * 4096 < exactQuantaLimit);
  assert.ok((MAX_STORAGE_CAPACITY + 200) * 4096 < exactQuantaLimit);
  assert.ok(MAX_ENERGY_CAPACITY > 15 * MAX_FILL_SCALE);
  assert.ok(MAX_STORAGE_CAPACITY > 15 * MAX_FILL_SCALE);
});
