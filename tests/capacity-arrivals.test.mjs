import test from "node:test";
import assert from "node:assert/strict";
import { capacityVictims } from "../web/gpu/capacity-arrivals.js";
import { treeRng } from "../web/gpu/trees.js";
function world(lives, genes, g = 8) {
  const words = new Uint32Array(lives.length * 52),
    stats = new Uint32Array(g * 4);
  lives.forEach((life, i) => {
    words[i * 52 + 31] = life;
    words[i * 52 + 25] = genes[i];
    if (life === 1) stats[genes[i] * 4]++;
  });
  return { words, stats };
}
test("capacity turnover requires full occupancy and uniformly samples live victims without replacement", () => {
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
