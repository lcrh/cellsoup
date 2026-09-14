import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createBehaviorSampler } from "../web/gpu/behavior-sampler.js";
import { createTraceSelector } from "../web/gpu/execution-traces.js";
Object.assign(globalThis, globals);
globalThis.__observerGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __observerGPU.requestAdapter(),
  device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const P = 262144,
  N = 2 * P,
  slot = N - 1;
const storage = (size) =>
  device.createBuffer({
    size,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.COPY_SRC,
  });
const state = storage(N * 208),
  activity = storage(N * 32);
const engine = {
  cfg: { capacity: P, side: 8 },
  entityCapacity: N,
  tick: 10,
  buffers: { state: [state], activity },
  currentState: state,
};
let behavior, trace;
try {
  const packet = new ArrayBuffer(208),
    u = new Uint32Array(packet),
    f = new Float32Array(packet);
  f[0] = 12;
  f[1] = 12;
  f[2] = 8;
  f[4] = 70 * 4096;
  u[24] = 123456;
  u[25] = 7;
  u[31] = 1;
  device.queue.writeBuffer(state, slot * 208, packet);
  const marks = new Uint32Array([10, 0, 123456, 0, 0, 0, 0, 0]);
  device.queue.writeBuffer(activity, slot * 32, marks);
  const corpse = packet.slice(0);
  new Uint32Array(corpse)[31] = 2;
  device.queue.writeBuffer(state, 0, corpse);
  behavior = await createBehaviorSampler(device, engine);
  trace = await createTraceSelector(device, engine);
  const selected = await trace.select(42),
    valid = [];
  for (let i = 0; i < 32; i++)
    if (selected[i * 4] !== 0xffffffff)
      valid.push([...selected.slice(i * 4, i * 4 + 4)]);
  assert.deepEqual(valid, [[slot, 123456, 7, 0]]);
  checks.push(
    "trace selector preserves highest 19-bit entity slot and identity while excluding corpses",
  );
  const sample = await behavior.sample();
  assert.equal(sample.living, 1);
  assert.equal(sample.symbols[(1 * 32 + 1) * 6], 1);
  assert.equal(sample.symbols[(1 * 32 + 1) * 6 + 3], 1);
  checks.push(
    "behavior observer includes living entities above the public living cap and their activity",
  );
  new Uint32Array(packet)[31] = 2;
  device.queue.writeBuffer(state, slot * 208, packet);
  assert.equal((await behavior.sample()).living, 0);
  assert.ok([...(await trace.select(97))].every((x) => x === 0xffffffff));
  checks.push(
    "both observers exclude corpses throughout the expanded entity pool",
  );
  assert.deepEqual(errors, []);
  for (const name of checks) console.log("PASS", name);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-observer-capacity-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
} finally {
  behavior?.destroy();
  trace?.destroy();
  state.destroy();
  activity.destroy();
  device.destroy();
  delete globalThis.__observerGPU;
}
