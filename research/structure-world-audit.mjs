import { create, globals } from "webgpu";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { snapshot, bodyAt } from "../web/gpu/observe.js";
import {
  readCellActivity,
  summarizeColonyActivity,
} from "./colony-activity.mjs";
import { observeColonies } from "./colony-observation.mjs";
const args = Object.fromEntries(
  process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")),
);
for (const key of Object.keys(args))
  if (!["mode", "seeds", "seconds", "out", "engine", "settings"].includes(key))
    throw Error(`Unknown option ${key}`);
const mode = args.mode ?? "baseline",
  seeds = (args.seeds ?? "42,97,321").split(",").map(Number),
  seconds = Number(args.seconds ?? 1200);
if (
  !["baseline", "cadence", "founders", "balanced", "production"].includes(mode)
)
  throw Error("Unknown mode");
if (!Number.isInteger(seconds) || seconds < 10 || seconds % 10)
  throw Error("Duration must be a positive multiple of ten seconds");
if (
  !seeds.length ||
  new Set(seeds).size !== seeds.length ||
  seeds.some((seed) => !Number.isInteger(seed) || seed < 0 || seed > 4294967295)
)
  throw Error("Seeds must be distinct unsigned integers");
const out = args.out ?? `/private/tmp/cellsoup-structure-${mode}`;
const { createLifeEngine } = await import(
  pathToFileURL(resolve(args.engine ?? "web/gpu/engine.js"))
);
const { worldSettingsForSeed } = await import(
  pathToFileURL(resolve(args.settings ?? "web/gpu/random-world.js"))
);
await mkdir(out, { recursive: true });
Object.assign(globalThis, globals);
globalThis.__structureGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __structureGPU.requestAdapter();
if (!adapter) throw Error("No GPU adapter");
const device = await adapter.requestDevice();
let failure;
device.addEventListener("uncapturederror", (e) => {
  failure = e.error;
});
function analyze(buffer, world) {
  const s = snapshot(buffer, world),
    seen = new Uint8Array(s.count),
    genes = new Map();
  const r = {
    living: 0,
    linkedCells: 0,
    cellsIn4: 0,
    cellsIn16: 0,
    branches: 0,
    largestBody: 0,
    establishedGenomeSlots: 0,
  };
  for (let i = 0; i < s.count; i++) {
    if (s.u[i * 52 + 31] !== 1) continue;
    for (const field of [0, 1, 2, 3, 4, 5, 38, 39]) {
      if (!Number.isFinite(s.f[i * 52 + field]))
        throw Error("Nonfinite living cell");
    }
    const g = s.u[i * 52 + 25];
    genes.set(g, (genes.get(g) ?? 0) + 1);
    if (seen[i]) continue;
    const body = bodyAt(s, i);
    r.living += body.length;
    r.largestBody = Math.max(r.largestBody, body.length);
    if (body.length > 1) r.linkedCells += body.length;
    if (body.length >= 4) r.cellsIn4 += body.length;
    if (body.length >= 16) r.cellsIn16 += body.length;
    for (const j of body) {
      seen[j] = 1;
      let degree = 0;
      for (let k = 32; k < 36; k++) {
        const handle = s.u[j * 52 + k];
        if (!handle) continue;
        const other = handle - 1;
        if (
          other >= s.count ||
          s.u[other * 52 + 31] !== 1 ||
          !s.u.subarray(other * 52 + 32, other * 52 + 36).includes(j + 1)
        )
          throw Error("Invalid reciprocal bond");
        degree++;
      }
      if (degree >= 3) r.branches++;
    }
  }
  r.establishedGenomeSlots = [...genes.values()].filter((n) => n >= 16).length;
  return r;
}
for (const seed of seeds) {
  const config = {
    ...worldSettingsForSeed(seed),
    capacity: 32768,
    genomeCapacity: 8192,
    side: 128,
    treePrograms: 1,
  };
  if (mode === "founders" || mode === "balanced") {
    config.founderActions = 6;
    config.generationDepth = 6;
  }
  if (mode === "balanced" && config.solarEnabled) {
    const threshold = config.divisionCost + 2 * config.minimumBirthEnergy;
    const required =
      (config.upkeep + config.energyDecay * threshold + 0.5) /
      (0.7 *
        config.photoEfficiency *
        Math.exp(-threshold / config.energyFillScale));
    config.solarRate = Math.ceil(Math.max(config.solarRate, required) * 2) / 2;
  }
  const engine = await createLifeEngine(device, config),
    records = [];
  const start = performance.now();
  try {
    for (let second = 0; second <= seconds; second += 10) {
      if (second % 120 === 0 || second === seconds) {
        const buffer = await engine.state(),
          activity = await readCellActivity(device, engine),
          counters = await engine.counters();
        delete counters.raw;
        const record = {
          second,
          ...counters,
          ...analyze(buffer, 4096),
          ...summarizeColonyActivity(buffer, activity, engine.tick, 4096),
          wallSeconds: (performance.now() - start) / 1000,
        };
        if (
          record.living !== counters.living ||
          record.living !==
            counters.randomArrivals +
              counters.sampledArrivals +
              counters.births -
              counters.deaths
        )
          throw Error("Population ledger mismatch");
        records.push(record);
        await writeFile(
          `${out}/${seed}.json`,
          JSON.stringify(
            {
              mode,
              config: engine.cfg,
              kernel: engine.fingerprint,
              records,
              complete: second === seconds,
            },
            null,
            2,
          ),
        );
        await writeFile(
          `${out}/${seed}-colonies-${second}.json`,
          JSON.stringify({
            world: 4096,
            colonies: observeColonies(buffer, 4096, 4096),
          }),
        );
        console.log(JSON.stringify({ mode, seed, ...record }));
      }
      if (second < seconds) await engine.step(600);
      if (failure) throw failure;
    }
  } finally {
    engine.destroy();
  }
}
device.destroy();
delete globalThis.__structureGPU;
