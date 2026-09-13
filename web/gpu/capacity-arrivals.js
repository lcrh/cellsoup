// Host-side, bounded turnover when every entity slot is occupied. No cell is
// retired here: the engine checks and commits the complete admission atomically.
export const CAPACITY_ENERGY_FLOOR = 1 / 4096;

// Keep the smallest exponential-race keys in a max heap. A race with rate
// 1 / energy gives inverse-energy sampling without replacement, and avoids
// sorting (or retaining) the entire population for a batch of at most 64 cells.
function compare(a, b) {
  return a.key - b.key || a.slot - b.slot;
}
function retain(heap, limit, slot, key) {
  if (!limit) return;
  if (heap.length === limit) {
    const worst = heap[0];
    if (key > worst.key || (key === worst.key && slot >= worst.slot)) return;
    heap[0] = { slot, key };
    let i = 0;
    while (i * 2 + 1 < heap.length) {
      let child = i * 2 + 1;
      if (child + 1 < heap.length && compare(heap[child + 1], heap[child]) > 0)
        child++;
      if (compare(heap[i], heap[child]) >= 0) break;
      [heap[i], heap[child]] = [heap[child], heap[i]];
      i = child;
    }
  } else {
    heap.push({ slot, key });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (compare(heap[parent], heap[i]) >= 0) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }
}
export function capacityVictims(words, stats, rate, rng = Math.random) {
  const n = words.length / 52;
  if (
    !(words instanceof Uint32Array) ||
    !Number.isInteger(n) ||
    !Number.isInteger(stats.length / 4) ||
    !Number.isInteger(rate) ||
    rate < 0 ||
    rate > Math.min(n, 64)
  )
    throw Error("Invalid capacity-arrival dimensions or rate");
  if (!rate) return [];
  let living = 0;
  for (let i = 0; i < n; i++) {
    const life = words[i * 52 + 31];
    if (life === 0) return [];
    if (life === 1) living++;
    else if (life !== 2) throw Error("Invalid entity state");
  }
  let freeGenes = 0;
  for (let i = 0; i < stats.length; i += 4) freeGenes += Number(stats[i] === 0);
  const values = new Float32Array(words.buffer, words.byteOffset, words.length);
  const singletons = [],
    ordinary = [],
    ordinaryLimit = Math.min(rate, freeGenes);
  for (let slot = 0; slot < n; slot++) {
    if (words[slot * 52 + 31] !== (living ? 1 : 2)) continue;
    const energy = values[slot * 52 + 4] / 4096;
    if (!Number.isFinite(energy) || energy < 0)
      throw Error("Invalid victim energy");
    const gene = words[slot * 52 + 25];
    if (living && (gene * 4 >= stats.length || stats[gene * 4] === 0))
      throw Error("Invalid victim genome reference");
    const singleton = living > 0 && stats[gene * 4] === 1;
    const limit = singleton ? rate : ordinaryLimit;
    if (!limit) continue;
    const draw = rng();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1)
      throw Error("Invalid capacity random sample");
    // Stored reserves never enter the weight. Corpses have no usable energy,
    // so a corpse-only world retains uniform reclamation of its remains.
    const key =
      -Math.log1p(-draw) *
      (living ? Math.max(energy, CAPACITY_ENERGY_FLOOR) : 1);
    retain(singleton ? singletons : ordinary, limit, slot, key);
  }
  // A singleton releases the genome slot it consumes. At most freeGenes other
  // victims can be admitted. Keeping each category's best bounded reservoir
  // is equivalent to scanning a complete weighted permutation with that rule.
  return [...singletons, ...ordinary]
    .sort(compare)
    .slice(0, rate)
    .map(({ slot }) => slot);
}
