// Same census definitions as gpu-life-run.mjs, shared by structural archive trials.
export function analyzeLifeState(buffer, engine) {
  const capacity = engine.cfg.capacity;
  const f = new Float32Array(buffer),
    u = new Uint32Array(buffer),
    parent = new Uint32Array(capacity),
    size = new Uint32Array(capacity),
    speedX = new Float64Array(capacity),
    speedY = new Float64Array(capacity);
  for (let i = 0; i < capacity; i++) parent[i] = i;
  const root = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < capacity; i++)
    if (u[i * 52 + 31] === 1)
      for (let k = 32; k < 36; k++) {
        const link = u[i * 52 + k];
        if (link) {
          const j = link - 1;
          if (j >= capacity || u[j * 52 + 31] !== 1)
            throw Error("Dangling bond");
          if (![...u.subarray(j * 52 + 32, j * 52 + 36)].includes(i + 1))
            throw Error("Asymmetric bond");
          parent[root(i)] = root(j);
        }
      }
  let living = 0,
    bornInWorld = 0,
    energy = 0,
    reserves = 0,
    temperature = 0,
    maxTemperature = 0,
    overheated = 0,
    mature = 0,
    generation = 0,
    age = 0;
  const lineages = new Map();
  for (let i = 0; i < capacity; i++)
    if (u[i * 52 + 31] === 1) {
      living++;
      const k = i * 52;
      bornInWorld += Number(u[k + 30] !== 0);
      for (let q = 0; q < 52; q++)
        if (
          (q < 24 || (q >= 36 && q < 40) || q >= 44) &&
          !Number.isFinite(f[k + q])
        )
          throw Error("Nonfinite cell");
      if (
        f[k + 4] < 0 ||
        f[k + 4] > 819200 ||
        f[k + 38] < -0.001 ||
        f[k + 39] < -0.001
      )
        throw Error("Invalid energy/reserve");
      const r = root(i);
      size[r]++;
      speedX[r] += f[k + 2];
      speedY[r] += f[k + 3];
      energy += f[k + 4] / 4096;
      reserves += f[k + 38] / 4096;
      temperature += f[k + 39];
      maxTemperature = Math.max(maxTemperature, f[k + 39]);
      overheated += f[k + 39] > engine.cfg.safeTemperature;
      mature += u[k + 28] >= 3600;
      age += u[k + 28] / 60;
      generation = Math.max(generation, u[k + 29]);
      lineages.set(u[k + 25], (lineages.get(u[k + 25]) ?? 0) + 1);
    }
  let bodies = 0,
    largestBody = 0,
    linkedCells = 0,
    movingBodies = 0,
    movingBodyCells = 0,
    largestMovingBody = 0;
  for (let i = 0; i < capacity; i++)
    if (size[i]) {
      bodies++;
      largestBody = Math.max(largestBody, size[i]);
      if (size[i] > 1) linkedCells += size[i];
      if (size[i] >= 4 && Math.hypot(speedX[i], speedY[i]) / size[i] > 2) {
        movingBodies++;
        movingBodyCells += size[i];
        largestMovingBody = Math.max(largestMovingBody, size[i]);
      }
    }
  return {
    living,
    bornInWorld,
    livingArrivals: living - bornInWorld,
    energy,
    reserves,
    mature,
    meanTemperature: living ? temperature / living : 0,
    maxTemperature,
    overheated,
    meanAge: living ? age / living : 0,
    livingMaxGeneration: generation,
    bodies,
    largestBody,
    linkedCells,
    movingBodies,
    movingBodyCells,
    largestMovingBody,
    variants: lineages.size,
    leaders: [...lineages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
}
