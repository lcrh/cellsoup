import { create, globals } from "webgpu";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { auditMemory } from "./tree-memory-audit.mjs";
import { observeColonies } from "./colony-observation.mjs";
import {
  readCellActivity,
  cellActivity,
  summarizeColonyActivity,
} from "./colony-activity.mjs";
import { createLifeEngine, describeGenome } from "../web/gpu/engine.js";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([a-z-]+)=(.+)$/.exec(a);
    if (!m) throw Error("Use --name=value");
    return [m[1], m[2]];
  }),
);
const allowed = [
  "substrate",
  "budget",
  "crossover",
  "mutation",
  "capacity",
  "seconds",
  "sample",
  "seed",
  "out",
  "upkeep",
  "heat-damage",
  "cpu-cost",
  "move-cost",
  "turn-cost",
  "initial",
  "floor",
  "close-at",
  "minimum-birth-energy",
  "exchange",
  "rate",
  "seed-energy",
  "seed-storage",
  "solar-rate",
  "sun-contrast",
  "cloud-cover",
  "cloud-opacity",
  "cloud-speed",
  "cloud-scale",
  "cloud-morph",
  "energy-decay",
  "corpse-lifetime",
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
if (args.substrate && !["assembly", "trees"].includes(args.substrate))
  throw Error("Invalid substrate");
const options = {
  treePrograms: Number(args.substrate !== "assembly"),
  capacity,
  genomeCapacity: Math.max(128, Math.floor(capacity / 4)),
  initial: Number(args.initial ?? Math.floor(capacity / 4)),
  side: Math.ceil(Math.sqrt(capacity / 2)),
  sources: 1,
  seed,
  rate: Number(args.rate ?? Math.max(1, Math.floor(capacity / 4096))),
  floor: Number(args.floor ?? Math.floor(capacity / 64)),
};
for (const [flag, key] of [
  ["budget", "budget"],
  ["crossover", "crossover"],
  ["mutation", "mutation"],
  ["minimum-birth-energy", "minimumBirthEnergy"],
  ["seed-energy", "seedEnergy"],
  ["seed-storage", "seedStorage"],
  ["solar-rate", "solarRate"],
  ["sun-contrast", "sunContrast"],
  ["cloud-cover", "cloudCover"],
  ["cloud-opacity", "cloudOpacity"],
  ["cloud-speed", "cloudSpeed"],
  ["cloud-scale", "cloudScale"],
  ["cloud-morph", "cloudMorph"],
  ["energy-decay", "energyDecay"],
  ["corpse-lifetime", "corpseLifetime"],
  ["upkeep", "upkeep"],
  ["heat-damage", "heatDamage"],
  ["cpu-cost", "cpuCost"],
  ["move-cost", "moveCost"],
  ["turn-cost", "turnCost"],
  ["exchange", "exchange"],
])
  if (flag in args) options[key] = Number(args[flag]);
const closeAt =
  args["close-at"] === undefined ? null : Number(args["close-at"]);
if (
  closeAt !== null &&
  (!Number.isInteger(closeAt) || closeAt < 0 || closeAt > seconds)
)
  throw Error("Invalid close-at");
const engine = await createLifeEngine(device, options),
  records = [],
  out = args.out ?? `research/runs/gpu-${seed}`;
await mkdir(out, { recursive: true });
function analyze(buffer) {
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
let computeMs = 0;
const initialConfig = { ...engine.cfg };
let closure = null;
for (let second = 0; second <= seconds; second++) {
  if (second === closeAt) {
    engine.setImmigration({ rate: 0, floor: 0 });
    const c = await engine.counters();
    closure = {
      second,
      arrivals: c.randomArrivals + c.sampledArrivals,
      births: c.births,
      living: c.living,
    };
  }
  if (second % sample === 0 || second === seconds) {
    const counters = await engine.counters(),
      stateBuffer = await engine.state(),
      analysis = analyze(stateBuffer),
      activity = await readCellActivity(device, engine),
      activityAnalysis = summarizeColonyActivity(
        stateBuffer,
        activity,
        engine.tick,
        engine.cfg.side * 32,
      );
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
    const record = {
      seconds: second,
      ...counters,
      ...analysis,
      ...activityAnalysis,
      computeMs,
    };
    delete record.raw;
    if (
      closure &&
      counters.randomArrivals + counters.sampledArrivals !== closure.arrivals
    )
      throw Error("Immigration continued after closure");
    records.push(record);
    console.log(JSON.stringify(record));
    // Preserve population observations even if a long GPU run stops early.
    const colonies = observeColonies(stateBuffer, engine.cfg.side * 32);
    const stateWords = new Uint32Array(stateBuffer);
    for (const body of colonies)
      for (const cell of body.cells ?? [])
        cell.activity = cellActivity(stateWords, activity, cell.slot);
    const slots = new Set(record.leaders.map(([slot]) => slot));
    for (const body of colonies)
      for (const cell of body.cells ?? []) slots.add(cell.genomeSlot);
    const genomes = [];
    for (const slot of slots)
      genomes.push({ slot, ...(await engine.genome(slot)) });
    if (engine.cfg.treePrograms && colonies.some((body) => body.cells)) {
      const memory = await engine.treeMemory();
      for (const body of colonies)
        for (const cell of body.cells ?? []) {
          cell.memory = [...memory.slice(cell.slot * 12, cell.slot * 12 + 8)];
          cell.birthResult = memory[cell.slot * 12 + 8];
          cell.initializedStateMask = memory[cell.slot * 12 + 9];
        }
    }
    await writeFile(
      `${out}/observation-${second}.json`,
      JSON.stringify(
        {
          seconds: second,
          world: engine.cfg.side * 32,
          colonies,
          genomes,
          note: "Observation for inspection, not an exact world-restart snapshot. External cells and message senders are not included.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${out}/progress.tmp.json`,
      JSON.stringify(
        {
          config: initialConfig,
          finalConfig: engine.cfg,
          closure,
          kernel: engine.fingerprint,
          genomeSampler: engine.genomeSampler,
          records,
          complete: false,
        },
        null,
        2,
      ) + "\n",
    );
    await rename(`${out}/progress.tmp.json`, `${out}/progress.json`);
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
  if (finalState[i * 52 + 31] === 1) counts[finalState[i * 52 + 25]]++;
for (let g = 0; g < counts.length; g++)
  if (counts[g] !== genes.stats[g * 4])
    throw Error(`Genome reference count mismatch at ${g}`);
const leaders = await Promise.all(
  records.at(-1).leaders.map(async ([slot, living]) => ({
    slot,
    living,
    ...(await engine.genome(slot)),
    recordedBirths: genes.stats[slot * 4 + 1],
    recordedHarvest: genes.stats[slot * 4 + 2] / 256,
  })),
);
// Audit every surviving genotype, rather than only the twelve leaders.
// This is static syntax evidence; it does not establish that reads execute.
const survivingTrees = [];
if (options.treePrograms) {
  for (let slot = 0; slot < counts.length; slot++) {
    if (!counts[slot]) continue;
    const gene = await engine.genome(slot);
    survivingTrees.push({
      slot,
      living: counts[slot],
      serial: gene.serial,
      founder: gene.founder,
      parent: gene.parent,
      secondParent: gene.secondParent,
      depth: gene.depth,
      bornTick: gene.bornTick,
      tree: gene.tree,
      memorySyntax: auditMemory(gene.tree),
    });
  }
}
const archive = await engine.archived(),
  archived = Array.from({ length: 128 }, (_, i) =>
    describeGenome(archive, i),
  ).filter(Boolean);
await writeFile(
  `${out}/run.json`,
  JSON.stringify(
    {
      config: initialConfig,
      finalConfig: engine.cfg,
      closure,
      kernel: engine.fingerprint,
      genomeSampler: engine.genomeSampler,
      records,
      leaders,
      archived,
      archivedTrees: engine.archivedTrees(),
      survivingTrees,
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
        `## Variant ${g.serial}: ${g.living} living, ${g.recordedBirths} births\n\nHarvest ${g.recordedHarvest}, depth ${g.depth}.\n\n\`\`\`${g.tree ? "lisp" : "asm"}\n${g.source}\n\`\`\``,
    )
    .join("\n\n") + "\n",
);
await writeFile(
  `${out}/progress.tmp.json`,
  JSON.stringify(
    {
      config: initialConfig,
      finalConfig: engine.cfg,
      closure,
      kernel: engine.fingerprint,
      genomeSampler: engine.genomeSampler,
      records,
      complete: true,
    },
    null,
    2,
  ) + "\n",
);
await rename(`${out}/progress.tmp.json`, `${out}/progress.json`);
console.log(
  `Saved ${out}; ${computeMs.toFixed(1)} ms compute for ${seconds} simulated seconds`,
);
engine.destroy();
device.destroy();
delete globalThis.__lifeGPU;
