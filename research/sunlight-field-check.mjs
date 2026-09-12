import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__lightGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__lightGPU.requestAdapter();
const device = await adapter.requestDevice();
const results = [];
for (const seed of [42, 97, 321]) {
  const engine = await createLifeEngine(device, {
    capacity: 64,
    genomeCapacity: 32,
    initial: 0,
    floor: 0,
    rate: 0,
    side: 128,
    seed,
  });
  await engine.step();
  const field = await engine.field();
  const values = Array.from(
    { length: field.length / 2 },
    (_, i) => field[i * 2],
  ).sort((a, b) => a - b);
  const row = {
    seed,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: values[values.length / 2],
    peak: values.at(-1),
    nearPeakShare: values.filter((v) => v > 0.9).length / values.length,
  };
  assert.ok(values[0] >= 0 && values.at(-1) <= 1);
  assert.ok(
    row.nearPeakShare < 0.15,
    "Near-maximum sunlight should occupy little of the habitat",
  );
  assert.ok(
    row.median < 0.5,
    "Most of the habitat should have moderate or weak light",
  );
  results.push(row);
  engine.destroy();
}
console.log(JSON.stringify(results, null, 2));
device.destroy();
delete globalThis.__lightGPU;
