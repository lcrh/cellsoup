// Host-side, bounded turnover when every entity slot is occupied. No cell is
// retired here: the engine checks and commits the complete admission atomically.
export function capacityVictims(words, stats, rate, rng = Math.random) {
  const n = words.length / 52;
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(stats.length / 4) ||
    !Number.isInteger(rate) ||
    rate < 0 ||
    rate > Math.min(n, 64)
  )
    throw Error("Invalid capacity-arrival dimensions or rate");
  if (!rate) return [];
  const living = [],
    corpses = [];
  for (let i = 0; i < n; i++) {
    const life = words[i * 52 + 31];
    if (life === 0) return [];
    if (life === 1) living.push(i);
    else if (life === 2) corpses.push(i);
    else throw Error("Invalid entity state");
  }
  let freeGenes = 0;
  for (let i = 0; i < stats.length; i += 4) freeGenes += Number(stats[i] === 0);
  const pool = living.length ? living : corpses;
  // Fisher–Yates ordering makes unconstrained victims a uniform sample. When
  // genomes are exhausted, a singleton can release its own genome slot; other
  // lineages are not removed merely to make an allocation fit.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const selected = [],
    limit = Math.min(rate, 64, pool.length);
  for (const slot of pool) {
    const gene = words[slot * 52 + 25];
    const releasesGene = living.length > 0 && stats[gene * 4] === 1;
    if (!freeGenes && !releasesGene) continue;
    selected.push(slot);
    freeGenes += Number(releasesGene) - 1;
    if (selected.length === limit) break;
  }
  return selected;
}
