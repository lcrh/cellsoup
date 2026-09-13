import test from "node:test";
import assert from "node:assert/strict";
import {
  capacityVictims,
  CAPACITY_ENERGY_FLOOR,
} from "../web/gpu/capacity-arrivals.js";
import { treeRng } from "../web/gpu/trees.js";
function world(lives, genes, g = 8, energies = []) {
  const words = new Uint32Array(lives.length * 52),
    stats = new Uint32Array(g * 4);
  const values = new Float32Array(words.buffer);
  lives.forEach((life, i) => {
    values[i * 52 + 4] = (energies[i] ?? 10) * 4096;
    words[i * 52 + 31] = life;
    words[i * 52 + 25] = genes[i];
    if (life === 1) stats[genes[i] * 4]++;
  });
  return { words, stats };
}
test("equal-energy turnover requires full occupancy and samples without replacement", () => {
  const { words, stats } = world([1, 1, 1, 1], [0, 0, 0, 0]);
  const before = words.slice(),
    prior = stats.slice();
  const counts = [0, 0, 0, 0];
  for (let seed = 0; seed < 4000; seed++) {
    const victims = capacityVictims(words, stats, 2, treeRng(seed));
    assert.equal(new Set(victims).size, 2);
    victims.forEach((i) => counts[i]++);
  }
  for (const count of counts)
    assert.ok(count > 1850 && count < 2150, `${counts}`);
  assert.deepEqual(words, before);
  assert.deepEqual(stats, prior);
  assert.deepEqual(capacityVictims(words, stats, 0), []);
  words[31] = 0;
  assert.deepEqual(capacityVictims(words, stats, 2), []);
  assert.throws(
    () => capacityVictims(new Uint32Array(128 * 52), stats, 65),
    /rate/,
  );
});
test("exhausted genomes allow singleton replacement, never deleting a larger lineage for space", () => {
  const full = world([1, 1, 1, 1], [0, 0, 1, 2], 3);
  for (let seed = 0; seed < 30; seed++)
    assert.deepEqual(
      capacityVictims(full.words, full.stats, 4, treeRng(seed)).sort(),
      [2, 3],
    );
  const shared = world([1, 1, 1, 1], [0, 0, 0, 0], 1);
  assert.deepEqual(capacityVictims(shared.words, shared.stats, 4), []);
});
test("full corpse worlds are reclaimed while mixed populations choose living victims", () => {
  const dead = world([2, 2, 2, 2], [0, 0, 0, 0], 2);
  assert.equal(capacityVictims(dead.words, dead.stats, 4).length, 2);
  const mixed = world([2, 1, 2, 1], [0, 0, 0, 1], 4);
  assert.deepEqual(capacityVictims(mixed.words, mixed.stats, 4).sort(), [1, 3]);
});

test("replacement probability is inverse usable energy, while high-energy cells remain eligible", () => {
  const { words, stats } = world([1, 1], [0, 0], 3, [1, 4]);
  const counts = [0, 0],
    rng = treeRng(11781),
    trials = 20000;
  for (let i = 0; i < trials; i++)
    counts[capacityVictims(words, stats, 1, rng)[0]]++;
  // Inverse weights 1 and 1/4 imply 80% versus 20%, not a deterministic cutoff.
  assert.ok(Math.abs(counts[0] / trials - 0.8) < 0.015, JSON.stringify(counts));
  assert.ok(Math.abs(counts[1] / trials - 0.2) < 0.015, JSON.stringify(counts));
  const reserved = words.slice(),
    f = new Float32Array(reserved.buffer);
  f[38] = 1e8;
  f[52 + 38] = 0;
  for (let seed = 0; seed < 100; seed++)
    assert.deepEqual(
      capacityVictims(reserved, stats, 1, treeRng(seed)),
      capacityVictims(words, stats, 1, treeRng(seed)),
    );
});

test("multiple weighted victims follow sequential sampling without replacement", () => {
  const { words, stats } = world([1, 1, 1], [0, 0, 0], 4, [1, 2, 4]);
  const counts = new Map(),
    rng = treeRng(4129),
    trials = 30000,
    weights = [1, 0.5, 0.25],
    sum = 1.75;
  for (let i = 0; i < trials; i++) {
    const pair = capacityVictims(words, stats, 2, rng);
    assert.notEqual(pair[0], pair[1]);
    const key = pair.join(",");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (let first = 0; first < 3; first++)
    for (let second = 0; second < 3; second++)
      if (first !== second) {
        const expected =
          ((weights[first] / sum) * weights[second]) / (sum - weights[first]);
        const observed = (counts.get([first, second].join(",")) || 0) / trials;
        assert.ok(
          Math.abs(observed - expected) < 0.012,
          `${first},${second}: ${observed} versus ${expected}`,
        );
      }
});

test("bounded reservoirs match complete weighted races under genome-allocation constraints", () => {
  function reference(words, stats, rate, rng) {
    const f = new Float32Array(words.buffer, words.byteOffset, words.length),
      free = [...stats].filter((x, i) => i % 4 === 0 && x === 0).length;
    const ranked = [];
    let available = free;
    for (let slot = 0; slot < words.length / 52; slot++) {
      const singleton = stats[words[slot * 52 + 25] * 4] === 1;
      if (!free && !singleton) continue;
      ranked.push({
        slot,
        singleton,
        key:
          -Math.log1p(-rng()) *
          Math.max(f[slot * 52 + 4] / 4096, CAPACITY_ENERGY_FLOOR),
      });
    }
    ranked.sort((a, b) => a.key - b.key || a.slot - b.slot);
    const picked = [];
    for (const item of ranked) {
      if (!available && !item.singleton) continue;
      picked.push(item.slot);
      available -= Number(!item.singleton);
      if (picked.length === rate) break;
    }
    return picked;
  }
  const n = 257,
    lives = Array(n).fill(1),
    genes = lives.map((_, i) =>
      i < 128 ? i : 128 + Math.floor((i - 128) / 4),
    ),
    energies = lives.map((_, i) => (i % 13 === 0 ? 0 : 2 ** (i % 9)));
  for (const extraGenes of [0, 1, 7, 64]) {
    const { words, stats } = world(
      lives,
      genes,
      Math.max(...genes) + 1 + extraGenes,
      energies,
    );
    for (const rate of [1, 2, 16, 64])
      for (let seed = 0; seed < 20; seed++)
        assert.deepEqual(
          capacityVictims(words, stats, rate, treeRng(seed)),
          reference(words, stats, rate, treeRng(seed)),
        );
  }
});

test("zero energy, subarray views and malformed energy are handled safely", () => {
  const { words, stats } = world([1, 1, 1], [0, 0, 0], 4, [
    0,
    CAPACITY_ENERGY_FLOOR / 2,
    4,
  ]);
  const rng = treeRng(331),
    counts = [0, 0, 0];
  for (let i = 0; i < 10000; i++)
    counts[capacityVictims(words, stats, 1, rng)[0]]++;
  assert.ok(Math.abs(counts[0] - counts[1]) < 350, JSON.stringify(counts));
  const padded = new Uint32Array(words.length + 26);
  padded.set(words, 13);
  const view = padded.subarray(13, 13 + words.length);
  for (let seed = 0; seed < 50; seed++)
    assert.deepEqual(
      capacityVictims(view, stats, 2, treeRng(seed)),
      capacityVictims(words, stats, 2, treeRng(seed)),
    );
  assert.deepEqual(
    capacityVictims(words, stats, 3, () => 0),
    [0, 1, 2],
  );
  for (const value of [-1, Infinity, NaN]) {
    const bad = words.slice();
    new Float32Array(bad.buffer)[4] = value;
    assert.throws(() => capacityVictims(bad, stats, 1), /victim energy/);
  }
  for (const value of [-0.1, 1, NaN])
    assert.throws(
      () => capacityVictims(words, stats, 1, () => value),
      /random sample/,
    );
  const invalidReference = words.slice();
  invalidReference[25] = 100;
  assert.throws(
    () => capacityVictims(invalidReference, stats, 1),
    /genome reference/,
  );
});

test("corpses-only reclamation stays uniform despite different nutrient values", () => {
  const { words, stats } = world([2, 2], [0, 0], 2, [1, 1000]),
    counts = [0, 0],
    rng = treeRng(821);
  for (let i = 0; i < 10000; i++)
    counts[capacityVictims(words, stats, 1, rng)[0]]++;
  assert.ok(Math.abs(counts[0] - counts[1]) < 350, JSON.stringify(counts));
});
