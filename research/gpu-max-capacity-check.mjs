import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__maximumGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __maximumGPU.requestAdapter();
assert.ok(adapter);
const limit = Math.min(
  268435456,
  adapter.limits.maxStorageBufferBindingSize,
  adapter.limits.maxBufferSize,
);
assert.ok(
  limit >= 231735296,
  "Native adapter must support the largest tier's 221 MiB state binding",
);
const device = await adapter.requestDevice({
  requiredLimits: { maxStorageBufferBindingSize: limit, maxBufferSize: limit },
});
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
let engine;
const started = performance.now();
try {
  engine = await createLifeEngine(device, {
    capacity: 262144,
    genomeCapacity: 65536,
    initial: 0,
    floor: 0,
    rate: 0,
    capacityRate: 0,
    side: 5,
    sources: 1,
    treePrograms: 1,
    executionTrace: 1,
    forkMutation: 1,
    specializationStrength: 0.95,
    linkedRelay: 0.95,
    pressureStrength: 12,
  });
  assert.equal(engine.entityCapacity, 524288);
  assert.equal(engine.buffers.state[0].size, 231735296);
  for (const value of Object.values(engine.buffers))
    for (const buffer of Array.isArray(value) ? value : [value])
      assert.ok(buffer.size <= limit);
  await engine.step(1);
  const counts = await engine.counters();
  assert.equal(counts.tick, 1);
  assert.equal(counts.living, 0);
  assert.equal(counts.corpses, 0);
  assert.deepEqual(errors, []);
  const report = {
    pass: true,
    populationLimit: 262144,
    entityCapacity: engine.entityCapacity,
    stateBytes: engine.buffers.state[0].size,
    scratchBytes: engine.buffers.scratch.size,
    bindingLimit: limit,
    elapsedMs: performance.now() - started,
    counts,
    errors,
  };
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-max-capacity-check.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "PASS largest population tier initializes and steps with all optional GPU state enabled",
    JSON.stringify(report),
  );
} finally {
  engine?.destroy();
  device.destroy();
}
