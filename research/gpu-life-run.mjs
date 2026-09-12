import { create, globals } from "webgpu";
import { mkdir, writeFile } from "node:fs/promises";
import { createLifeEngine, describeGenome } from "../web/gpu/engine.js";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([a-z-]+)=(.+)$/.exec(a);
    if (!m) throw Error("Use --name=value");
    return [m[1], m[2]];
  }),
);
const allowed = [
  "capacity",
  "seconds",
  "sample",
  "seed",
  "out",
  "sources",
  "food-strength",
  "upkeep",
  "cpu-cost",
  "initial",
  "exchange",
  "specialization",
  "rate",
  "seed-energy",
];
for (const key of Object.keys(args))
  if (!allowed.includes(key)) throw Error("Unknown " + key);
const capacity = Number(args.capacity ?? 65536),
  seconds = Number(args.seconds ?? 600),
  sample = Number(args.sample ?? 60),
  seed = Number(args.seed ?? 42);
if (
  !Number.isInteger(seconds) ||
  seconds < 1 ||
  seconds > 86400 ||
  !Number.isInteger(sample) ||
  sample < 1
)
  throw Error("Invalid duration");
Object.assign(globalThis, globals);
globalThis.__lifeGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__lifeGPU.requestAdapter();
if (!adapter) throw Error("No GPU adapter");
const device = await adapter.requestDevice();
let gpuError;
device.addEventListener("uncapturederror", (e) => {
  gpuError = e.error;
  console.error(e.error.message);
});
const options = {
  capacity,
  genomeCapacity: Math.max(128, Math.floor(capacity / 4)),
  initial: Number(args.initial ?? Math.floor(capacity / 4)),
  side: Math.ceil(Math.sqrt(capacity / 2)),
  sources: Number(args.sources ?? Math.max(1, Math.ceil(capacity / 4096))),
  seed,
  rate: Number(args.rate ?? Math.max(1, Math.floor(capacity / 4096))),
  floor: Math.floor(capacity / 64),
};
for (const [flag, key] of [
  ["seed-energy", "seedEnergy"],
  ["food-strength", "foodStrength"],
  ["upkeep", "upkeep"],
  ["cpu-cost", "cpuCost"],
  ["exchange", "exchange"],
  ["specialization", "specialization"],
])
  if (flag in args) options[key] = Number(args[flag]);
const engine = await createLifeEngine(device, options),
  records = [],
  out = args.out ?? `research/runs/gpu-${seed}`;
await mkdir(out, { recursive: true });
function analyze(buffer) {
  const f = new Float32Array(buffer),
    u = new Uint32Array(buffer),
    parent = new Uint32Array(capacity),
    size = new Uint32Array(capacity),
    specialA = new Uint32Array(capacity),
    specialB = new Uint32Array(capacity);
  for (let i = 0; i < capacity; i++) parent[i] = i;
  const root = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < capacity; i++)
    if (u[i * 52 + 31])
      for (let k = 32; k < 36; k++) {
        const link = u[i * 52 + k];
        if (link) {
          const j = link - 1;
          if (j >= capacity || !u[j * 52 + 31]) throw Error("Dangling bond");
          if (![...u.subarray(j * 52 + 32, j * 52 + 36)].includes(i + 1))
            throw Error("Asymmetric bond");
          parent[root(i)] = root(j);
        }
      }
  let living = 0,
    energy = 0,
    reserves = 0,
    mature = 0,
    generation = 0,
    age = 0;
  const lineages = new Map();
  for (let i = 0; i < capacity; i++)
    if (u[i * 52 + 31]) {
      living++;
      const k = i * 52;
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
      specialA[r] += f[k + 37] > 0.8;
      specialB[r] += f[k + 37] < 0.2;
      energy += f[k + 4] / 4096;
      reserves += f[k + 38] + f[k + 39];
      mature += u[k + 28] >= 3600;
      age += u[k + 28] / 60;
      generation = Math.max(generation, u[k + 29]);
      lineages.set(u[k + 25], (lineages.get(u[k + 25]) ?? 0) + 1);
    }
  let bodies = 0,
    largestBody = 0,
    linkedCells = 0,
    mixedBodies = 0,
    mixedCells = 0;
  for (let i = 0; i < capacity; i++)
    if (size[i]) {
      bodies++;
      largestBody = Math.max(largestBody, size[i]);
      if (size[i] > 1) linkedCells += size[i];
      if (size[i] >= 4 && specialA[i] && specialB[i]) {
        mixedBodies++;
        mixedCells += size[i];
      }
    }
  return {
    living,
    energy,
    reserves,
    mature,
    meanAge: living ? age / living : 0,
    livingMaxGeneration: generation,
    bodies,
    largestBody,
    linkedCells,
    mixedBodies,
    mixedCells,
    variants: lineages.size,
    leaders: [...lineages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
}
let computeMs = 0;
for (let second = 0; second <= seconds; second++) {
  if (second % sample === 0 || second === seconds) {
    const counters = await engine.counters(),
      analysis = analyze(await engine.state());
    if (counters.living !== analysis.living)
      throw Error("Population counter mismatch");
    if (
      counters.living !==
      counters.randomArrivals +
        counters.sampledArrivals +
        counters.births -
        counters.deaths
    )
      throw Error("Population ledger mismatch");
    const record = { seconds: second, ...counters, ...analysis, computeMs };
    delete record.raw;
    records.push(record);
    console.log(JSON.stringify(record));
  }
  if (second < seconds) {
    const start = performance.now();
    await engine.step(60);
    computeMs += performance.now() - start;
    if (gpuError) throw gpuError;
  }
}
const genes = await engine.genes();
const finalState = new Uint32Array(await engine.state()),
  counts = new Uint32Array(options.genomeCapacity);
for (let i = 0; i < capacity; i++)
  if (finalState[i * 52 + 31]) counts[finalState[i * 52 + 25]]++;
for (let g = 0; g < counts.length; g++)
  if (counts[g] !== genes.stats[g * 4])
    throw Error(`Genome reference count mismatch at ${g}`);
const leaders = records
  .at(-1)
  .leaders.map(([slot, living]) => ({
    slot,
    living,
    ...describeGenome(genes.data, slot),
    recordedBirths: genes.stats[slot * 4 + 1],
    recordedHarvest: genes.stats[slot * 4 + 2] / 256,
  }));
const archive = await engine.archived(),
  archived = Array.from({ length: 128 }, (_, i) =>
    describeGenome(archive, i),
  ).filter(Boolean);
await writeFile(
  `${out}/run.json`,
  JSON.stringify(
    {
      config: engine.cfg,
      kernel: engine.fingerprint,
      records,
      leaders,
      archived,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  `${out}/leaders.md`,
  leaders
    .map(
      (g) =>
        `## Variant ${g.serial}: ${g.living} living, ${g.recordedBirths} births\n\nHarvest ${g.recordedHarvest}, depth ${g.depth}.\n\n\`\`\`asm\n${g.source}\n\`\`\``,
    )
    .join("\n\n") + "\n",
);
console.log(
  `Saved ${out}; ${computeMs.toFixed(1)} ms compute for ${seconds} simulated seconds`,
);
engine.destroy();
device.destroy();
delete globalThis.__lifeGPU;
