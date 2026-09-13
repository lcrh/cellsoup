// A bounded diagnostic of the engine/typed-genome lifecycle. It intentionally
// excludes browser rendering and UI observers, which need separate browser QA.
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { worldSettingsForSeed } from "../web/gpu/random-world.js";
import { writeFile, readFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
const output = process.argv[2];
if (!output) throw Error("Supply output JSON");
const duration = Number(process.argv[3] ?? 180);
if (!Number.isInteger(duration) || duration < 10 || duration > 300)
  throw Error("Duration must be10–300seconds");
const files = [
  "web/gpu/engine.js",
  "web/gpu/shader.js",
  "web/gpu/trees.js",
  "web/gpu/body-archive.js",
  "web/gpu/capacity-arrivals.js",
  "web/gpu/random-world.js",
];
const hashes = Object.fromEntries(
  await Promise.all(
    files.map(async (p) => [
      p,
      createHash("sha256")
        .update(await readFile(p))
        .digest("hex"),
    ]),
  ),
);
Object.assign(globalThis, globals);
globalThis.__runtimeSoakGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __runtimeSoakGPU.requestAdapter();
if (!adapter) throw Error("NativeGPU unavailable");
const realDevice = await adapter.requestDevice(),
  errors = [];
let lost = null,
  intentionalDestroy = false;
realDevice.addEventListener("uncapturederror", (e) =>
  errors.push({
    message: e.error.message,
    name: e.error.constructor.name,
    time: Date.now(),
  }),
);
realDevice.lost.then((info) => {
  if (!intentionalDestroy)
    lost = { reason: info.reason, message: info.message };
});
const allocations = {
  created: 0,
  destroyed: 0,
  liveBytes: 0,
  peakBytes: 0,
  liveBuffers: 0,
  peakBuffers: 0,
};
const device = new Proxy(realDevice, {
  get(target, key) {
    if (key === "createBuffer")
      return (descriptor) => {
        const buffer = target.createBuffer(descriptor);
        allocations.created++;
        allocations.liveBytes += buffer.size;
        allocations.liveBuffers++;
        allocations.peakBytes = Math.max(
          allocations.peakBytes,
          allocations.liveBytes,
        );
        allocations.peakBuffers = Math.max(
          allocations.peakBuffers,
          allocations.liveBuffers,
        );
        let destroyed = false;
        const destroy = buffer.destroy.bind(buffer);
        buffer.destroy = () => {
          if (!destroyed) {
            destroyed = true;
            allocations.destroyed++;
            allocations.liveBytes -= buffer.size;
            allocations.liveBuffers--;
          }
          destroy();
        };
        return buffer;
      };
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
const cfg = {
  capacity: 32768,
  genomeCapacity: 8192,
  side: 128,
  sources: 1,
  treePrograms: 1,
  executionTrace: 1,
  ...worldSettingsForSeed(42, { capacity: 32768 }),
};
const report = {
  scope:
    "Engine-only bounded nativeMetal soak; browser renderer and UI observers are not exercised.",
  durationSeconds: duration,
  sourceHashes: hashes,
  requestedConfig: cfg,
  samples: [],
  success: false,
};
let engine;
const start = performance.now();
async function save() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2));
  await rename(output + ".tmp", output);
}
async function sample(label, collect = false) {
  const before = process.memoryUsage();
  if (collect && globalThis.gc) globalThis.gc();
  const memory = process.memoryUsage();
  const counters = await engine.counters();
  const body = engine.bodyStats();
  const item = {
    label,
    wallSeconds: (performance.now() - start) / 1000,
    tick: engine.tick,
    memory,
    beforeCollection: collect ? before : null,
    allocations: { ...allocations },
    counters,
    body,
    archiveTrees: engine.archivedTrees().length,
    errors: [...errors],
    lost,
  };
  report.samples.push(item);
  console.log(
    JSON.stringify({
      label,
      wall: Math.round(item.wallSeconds),
      simSeconds: item.tick / 60,
      living: counters.living,
      body: body.archived,
      archive: item.archiveTrees,
      rssMiB: memory.rss / 1048576,
      heapMiB: memory.heapUsed / 1048576,
      gpuLiveMiB: allocations.liveBytes / 1048576,
      gpuBuffers: allocations.liveBuffers,
      created: allocations.created,
      errors: errors.length,
      lost,
    }),
  );
  await save();
}
try {
  engine = await createLifeEngine(device, cfg);
  report.actualConfig = engine.cfg;
  await sample("initialized", true);
  const running = performance.now();
  let nextSample = 15,
    nextGC = 60;
  report.slowestSteps = [];
  while ((performance.now() - running) / 1000 < duration) {
    const stepStart = performance.now(),
      beginTick = engine.tick;
    await engine.step(120);
    report.slowestSteps.push({
      beginTick,
      elapsedMs: performance.now() - stepStart,
    });
    report.slowestSteps.sort((a, b) => b.elapsedMs - a.elapsedMs);
    report.slowestSteps.length = Math.min(10, report.slowestSteps.length);
    if (errors.length || lost) throw Error("GPU error duringsoak");
    const elapsed = (performance.now() - running) / 1000;
    if (elapsed >= nextSample) {
      const collect = elapsed >= nextGC;
      await sample(collect ? "periodic-after-gc" : "periodic", collect);
      nextSample = elapsed + 15;
      if (collect) nextGC = elapsed + 60;
    }
  }
  await sample("final-before-destroy", true);
  const buffer = await engine.state(),
    u = new Uint32Array(buffer),
    f = new Float32Array(buffer);
  let live = 0,
    dead = 0,
    invalid = 0;
  const refs = new Uint32Array(engine.cfg.genomeCapacity);
  const occupancy = new Uint32Array(engine.cfg.side ** 2);
  for (let i = 0; i < engine.cfg.capacity; i++) {
    const at = i * 52;
    if (u[at + 31] === 1) {
      live++;
      refs[u[at + 25]]++;
      occupancy[
        Math.floor(f[at + 1] / 32) * engine.cfg.side + Math.floor(f[at] / 32)
      ]++;
      for (const k of [
        0, 1, 2, 3, 4, 5, 6, 7, 36, 37, 38, 39, 44, 45, 46, 47, 48, 49, 50, 51,
      ])
        if (!Number.isFinite(f[at + k])) invalid++;
    } else if (u[at + 31] === 2) dead++;
  }
  const stats = (await engine.genes()).stats,
    c = await engine.counters();
  let refMismatch = 0;
  for (let i = 0; i < refs.length; i++)
    refMismatch += Number(refs[i] !== stats[i * 4]);
  report.finalAudit = {
    live,
    corpses: dead,
    invalid,
    maximumTileOccupancy: Math.max(...occupancy),
    refMismatch,
    ledger: c.randomArrivals + c.sampledArrivals + c.births - c.deaths,
  };
  if (
    live !== c.living ||
    dead !== c.corpses ||
    invalid ||
    refMismatch ||
    report.finalAudit.ledger !== live
  )
    throw Error("Final world auditfailed");
  report.success = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  if (engine) engine.destroy();
  await realDevice.queue.onSubmittedWorkDone().catch(() => {});
  if (globalThis.gc) globalThis.gc();
  report.afterEngineDestroy = {
    memory: process.memoryUsage(),
    allocations: { ...allocations },
  };
  intentionalDestroy = true;
  realDevice.destroy();
  delete globalThis.__runtimeSoakGPU;
  report.elapsedSeconds = (performance.now() - start) / 1000;
  report.errors = errors;
  report.lost = lost;
  await save();
  console.log(
    JSON.stringify({
      finished: true,
      success: report.success,
      elapsedSeconds: report.elapsedSeconds,
      afterEngineDestroy: report.afterEngineDestroy,
      error: report.error,
    }),
  );
}
