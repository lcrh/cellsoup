import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { mkdir, writeFile, rename, readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createGzip, gzipSync } from "node:zlib";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { createLifeEngine } from "../web/gpu/engine.js";
import { BodyArchive } from "./body-archive.mjs";
import { analyzeLifeState } from "./life-state-analysis.mjs";
import { observeColonies } from "./colony-observation.mjs";
import {
  readCellActivity,
  summarizeColonyActivity,
} from "./colony-activity.mjs";
import { auditMemory } from "./tree-memory-audit.mjs";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([a-z-]+)=(.+)$/.exec(a);
    if (!m) throw Error("Use --name=value");
    return [m[1], m[2]];
  }),
);
for (const k of Object.keys(args))
  if (
    ![
      "out",
      "seed",
      "seconds",
      "capacity",
      "initial",
      "connected",
      "sample",
      "close-at",
    ].includes(k)
  )
    throw Error("Unknown " + k);
const seed = Number(args.seed ?? 42),
  seconds = Number(args.seconds ?? 3600),
  capacity = Number(args.capacity ?? 32768),
  initial = Number(args.initial ?? capacity / 4),
  sample = Number(args.sample ?? 300),
  connected = args.connected !== "0",
  closeAt = Number(args["close-at"] ?? seconds),
  out = args.out;
if (
  !out ||
  ![seed, seconds, capacity, initial, sample, closeAt].every(
    Number.isInteger,
  ) ||
  seconds < 1 ||
  seconds > 86400 ||
  sample < 1 ||
  closeAt < 0 ||
  closeAt > seconds ||
  (args.connected !== undefined && !["0", "1"].includes(args.connected))
)
  throw Error("Invalid trial arguments");
const rng = (seed) => () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
await mkdir(dirname(out), { recursive: true });
// Never overwrite a partial or completed experiment when resuming work.
await mkdir(out);
async function compressed(name, data) {
  await writeFile(
    `${out}/${name}.json.gz`,
    gzipSync(JSON.stringify(data) + "\n"),
  );
}
function journal(name) {
  const gzip = createGzip(),
    done = pipeline(gzip, createWriteStream(`${out}/${name}.jsonl.gz`));
  return {
    async add(data) {
      if (!gzip.write(JSON.stringify(data) + "\n")) await once(gzip, "drain");
    },
    async close() {
      gzip.end();
      await done;
    },
  };
}
const arrivals = journal("arrivals"),
  captures = journal("captures");
Object.assign(globalThis, globals);
globalThis.__bodyWorldGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__bodyWorldGPU.requestAdapter(),
  device = await adapter.requestDevice();
let gpuError;
device.addEventListener("uncapturederror", (e) => {
  gpuError = e.error;
});
const e = await createLifeEngine(device, {
  treePrograms: 1,
  manualArrivals: 1,
  capacity,
  genomeCapacity: Math.max(128, capacity / 4),
  initial,
  side: Math.ceil(Math.sqrt(capacity / 2)),
  sources: 1,
  seed,
  rate: 8,
  floor: 0,
});
const policy = {
  maxCells: 8,
  capacity: 128,
  captureBudget: 4,
  minimumAge: 60,
  captureSeconds: 5,
  bodyShare: 0.5,
  archiveShare: 0.5,
  mutation: e.cfg.mutation,
  crossover: e.cfg.crossover,
  connected,
  closeAt,
};
const archive = new BodyArchive({
    ...policy,
    rng: rng(seed ^ 0x87153431),
    onCapture: (entry) => captures.add(entry),
  }),
  records = [],
  initialConfig = { ...e.cfg };
const sourceHashes = {};
for (const name of [
  "web/gpu/engine.js",
  "web/gpu/trees.js",
  "web/gpu/shader.js",
  "research/body-archive.mjs",
  "research/body-world-run.mjs",
  "research/life-state-analysis.mjs",
  "research/colony-propagule.mjs",
  "research/colony-observation.mjs",
  "research/colony-activity.mjs",
  "web/gpu/observe.js",
])
  sourceHashes[name] = createHash("sha256")
    .update(await readFile(name))
    .digest("hex");
const totals = {
  admitted: 0,
  bodyBatches: 0,
  bodyCells: 0,
  individualCells: 0,
  capacityMisses: 0,
  energy: 0,
  storage: 0,
  captures: 0,
  computeMs: 0,
  samplingMs: 0,
};
let closure = null;
async function checkpoint(complete = false) {
  const data = {
    config: initialConfig,
    policy,
    kernel: e.fingerprint,
    sourceHashes,
    records,
    totals,
    closure,
    complete,
  };
  await writeFile(
    `${out}/progress.tmp.json`,
    JSON.stringify(data, null, 2) + "\n",
  );
  await rename(`${out}/progress.tmp.json`, `${out}/progress.json`);
}
async function census(second, state, genes, counters) {
  const analysis = analyzeLifeState(state, e),
    u = new Uint32Array(state),
    counts = new Uint32Array(e.cfg.genomeCapacity);
  for (let i = 0; i < capacity; i++)
    if (u[i * 52 + 31] === 1) counts[u[i * 52 + 25]]++;
  for (let g = 0; g < counts.length; g++)
    assert.equal(counts[g], genes.stats[g * 4], `Genome ref ${g}`);
  assert.equal(counters.living, analysis.living);
  assert.equal(
    counters.living,
    counters.randomArrivals +
      counters.sampledArrivals +
      counters.births -
      counters.deaths,
  );
  assert.equal(
    counters.randomArrivals + counters.sampledArrivals,
    initial + totals.admitted,
    "Manual arrival ledger",
  );
  if (closure)
    assert.equal(
      counters.randomArrivals + counters.sampledArrivals,
      closure.arrivals,
    );
  const activity = await readCellActivity(device, e),
    motion = summarizeColonyActivity(state, activity, e.tick, e.cfg.side * 32);
  const record = {
    seconds: second,
    ...counters,
    ...analysis,
    ...motion,
    bodyArchive: archive.size,
    totals: { ...totals },
  };
  delete record.raw;
  records.push(record);
  const colonies = observeColonies(state, e.cfg.side * 32),
    slots = new Set(record.leaders.map(([slot]) => slot));
  for (const body of colonies)
    for (const cell of body.cells ?? []) slots.add(cell.genomeSlot);
  const genomes = await Promise.all(
    [...slots].map(async (slot) => ({ slot, ...(await e.genome(slot)) })),
  );
  await compressed(`observation-${second}`, {
    seconds: second,
    world: e.cfg.side * 32,
    colonies,
    genomes,
  });
  await checkpoint();
  console.log(
    JSON.stringify({
      seconds: second,
      living: record.living,
      bornInWorld: record.bornInWorld,
      moving: record.movingBodyCellsWithRecentThrust,
      archive: archive.size,
      bodyCells: totals.bodyCells,
      computeSeconds: totals.computeMs / 1000,
      samplingSeconds: totals.samplingMs / 1000,
    }),
  );
  return { counts, record };
}
try {
  await census(0, await e.state(), await e.genes(), await e.counters());
  for (let second = 1; second <= seconds; second++) {
    if (second > closeAt && e.cfg.rate) {
      const c = await e.counters();
      closure = {
        second: second - 1,
        arrivals: c.randomArrivals + c.sampledArrivals,
        living: c.living,
        births: c.births,
      };
      e.setImmigration({ rate: 0, floor: 0 });
    }
    let start = performance.now();
    await e.step(60);
    totals.computeMs += performance.now() - start;
    if (gpuError) throw gpuError;
    start = performance.now();
    let state = await e.state(),
      genes = await e.genes(),
      counters = await e.counters();
    if (second <= closeAt) {
      if (second % policy.captureSeconds === 0)
        totals.captures += await archive.capture(e, state);
      const u = new Uint32Array(state);
      let freeCells = 0,
        freeGenes = 0;
      for (let i = 0; i < capacity; i++) freeCells += u[i * 52 + 31] === 0;
      for (let g = 0; g < e.cfg.genomeCapacity; g++)
        freeGenes += genes.stats[g * 4] === 0;
      const plan = archive.plan(e, {
        budget: e.cfg.rate,
        freeCells,
        freeGenes,
        connected,
        rng: rng((seed ^ Math.imul(second, 0x9e3779b9)) >>> 0),
        ...policy,
      });
      let result = { admitted: 0, reason: "capacity" };
      if (plan.cells.length) result = await e.admitBody(plan);
      const bodyCells =
        plan.source === "body" ? plan.provenance.sourceSlots.length : 0;
      if (result.admitted) {
        assert.equal(result.admitted, plan.cells.length);
        totals.admitted += result.admitted;
        totals.bodyBatches += Number(bodyCells > 0);
        totals.bodyCells += bodyCells;
        totals.individualCells += result.admitted - bodyCells;
        totals.energy += plan.cells.reduce((sum, c) => sum + c.energy, 0);
        totals.storage += plan.cells.reduce((sum, c) => sum + c.storage, 0);
      }
      totals.capacityMisses += e.cfg.rate - result.admitted;
      await arrivals.add({ second, freeCells, freeGenes, plan, result });
      assert.equal(
        totals.admitted + totals.capacityMisses,
        second * initialConfig.rate,
      );
      assert.equal(totals.energy, totals.admitted * e.cfg.seedEnergy);
      assert.equal(totals.storage, totals.admitted * e.cfg.seedStorage);
    }
    totals.samplingMs += performance.now() - start;
    if (second % sample === 0 || second === seconds)
      await census(
        second,
        await e.state(),
        await e.genes(),
        await e.counters(),
      );
  }
  const state = await e.state(),
    genes = await e.genes(),
    u = new Uint32Array(state),
    counts = new Uint32Array(e.cfg.genomeCapacity);
  for (let i = 0; i < capacity; i++)
    if (u[i * 52 + 31] === 1) counts[u[i * 52 + 25]]++;
  const survivingTrees = [];
  for (let slot = 0; slot < counts.length; slot++)
    if (counts[slot]) {
      const g = await e.genome(slot);
      survivingTrees.push({
        slot,
        living: counts[slot],
        ...g,
        memorySyntax: auditMemory(g.tree),
        recordedBirths: genes.stats[slot * 4 + 1],
        recordedHarvest: genes.stats[slot * 4 + 2] / 256,
      });
    }
  await compressed("run", {
    config: initialConfig,
    finalConfig: e.cfg,
    policy,
    kernel: e.fingerprint,
    sourceHashes,
    records,
    totals,
    closure,
    survivingTrees,
    archivedTrees: e.archivedTrees(),
    bodyArchive: archive.snapshot(),
  });
  await writeFile(`${out}/final-state.bin.gz`, gzipSync(new Uint8Array(state)));
  await arrivals.close();
  await captures.close();
  await checkpoint(true);
} finally {
  e.destroy();
  device.destroy();
  delete globalThis.__bodyWorldGPU;
}
