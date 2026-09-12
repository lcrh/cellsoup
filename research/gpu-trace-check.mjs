import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import {
  createTraceSelector,
  unpackExecutionTrace,
} from "../web/gpu/execution-traces.js";
Object.assign(globalThis, globals);
globalThis.__traceTestGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__traceTestGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const config = {
  capacity: 1,
  genomeCapacity: 1,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  sources: 1,
  treePrograms: 0,
  solarEnabled: 0,
  archiveEnabled: 0,
  upkeep: 0,
  cpuCost: 0,
  energyDecay: 0,
  heatDamage: 0,
  budget: 8,
};
async function start(extra = {}) {
  const e = await createLifeEngine(device, { ...config, ...extra });
  await e.fixture({
    programs: ["mov r0 0\nloop: add r0 1\njnz r0 loop"],
    cells: [{ energy: 70, storage: 0 }],
    sunlight: 0,
  });
  return e;
}
try {
  const plain = await start(),
    traced = await start({ executionTrace: 1 }),
    selector = await createTraceSelector(device, traced);
  const selected = await selector.select(92);
  assert.equal(
    Array.from({ length: 32 }, (_, i) => selected[i * 4]).filter(
      (x) => x !== 0xffffffff,
    ).length,
    1,
  );
  const window = traced.armExecutionTrace(selected, 92);
  assert.equal(window.collectTick, 256);
  await plain.step(256);
  await traced.step(256);
  assert.deepEqual(
    new Uint8Array(await plain.state()),
    new Uint8Array(await traced.state()),
    "Tracing changed cell state",
  );
  assert.deepEqual(
    await plain.counters(),
    await traced.counters(),
    "Tracing changed lifecycle counters",
  );
  const trace = unpackExecutionTrace(await traced.executionTrace());
  assert.equal(trace.cells.length, 1);
  assert.equal(trace.cells[0].frames.length, 256);
  assert.ok(trace.cells[0].frames.every((f) => f.length === 8));
  const first = Array.from(trace.cells[0].frames[0]);
  assert.deepEqual(
    first.slice(0, 5).map((x) => x & 255),
    [1, 2, 10, 2, 10],
  );
  assert.deepEqual(
    first.slice(0, 5).map((x) => (x >>> 8) & 255),
    [0, 1, 2, 1, 2],
  );
  assert.ok(first.every((x) => x & 0x1000000));
  const frozen = await traced.executionTrace();
  await traced.step(4);
  assert.deepEqual(
    await traced.executionTrace(),
    frozen,
    "Trace continued beyond window",
  );
  selector.destroy();
  plain.destroy();
  traced.destroy();
  console.log(
    "PASS actual PC/opcode order, fixed window and unchanged simulation state",
  );
  const poor = await start({ executionTrace: 1, cpuCost: 100 }),
    poorSelector = await createTraceSelector(device, poor);
  poor.armExecutionTrace(await poorSelector.select(4), 4);
  await poor.step(256);
  const poorTrace = unpackExecutionTrace(await poor.executionTrace());
  assert.ok(poorTrace.cells[0].frames.every((f) => f.length === 8));
  assert.ok(
    poorTrace.cells[0].frames.every((f) =>
      Array.from(f).every((x) => (x & 0x1000000) === 0),
    ),
  );
  poorSelector.destroy();
  poor.destroy();
  console.log(
    "PASS unaffordable instructions are distinguished from executed instructions",
  );
  const reused = await start({ executionTrace: 1 }),
    reuseSelector = await createTraceSelector(device, reused);
  reused.armExecutionTrace(await reuseSelector.select(5), 5);
  await reused.step(1);
  const state = await reused.state();
  new Uint32Array(state)[24] = 999;
  device.queue.writeBuffer(reused.currentState, 0, state);
  await reused.step(255);
  const reuseTrace = unpackExecutionTrace(await reused.executionTrace());
  assert.equal(reuseTrace.cells[0].frames[0].length, 8);
  assert.ok(reuseTrace.cells[0].frames.slice(1).every((f) => f.length === 0));
  reuseSelector.destroy();
  reused.destroy();
  console.log("PASS recycled slot cannot contribute to an older cell trace");
  assert.deepEqual(errors, []);
} finally {
  device.destroy();
  delete globalThis.__traceTestGPU;
}
