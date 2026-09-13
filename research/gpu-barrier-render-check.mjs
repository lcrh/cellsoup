import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { createRenderer } from "../web/gpu/renderer.js";
Object.assign(globalThis, globals);
globalThis.devicePixelRatio = 1;
const gpu = create(process.platform === "darwin" ? ["backend=metal"] : []);
const adapter = await gpu.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (event) =>
  errors.push(event.error.message),
);
const engine = await createLifeEngine(device, {
  treePrograms: 0,
  capacity: 64,
  genomeCapacity: 1,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  solarEnabled: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  energyCapacity: 300,
  storageCapacity: 600,
  shieldCapacity: 20,
});
const texture = device.createTexture({
  size: [128, 128],
  format: "rgba8unorm",
  usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
});
const context = {
  configure() {},
  unconfigure() {},
  getCurrentTexture: () => texture,
};
const canvas = {
  width: 128,
  height: 128,
  getContext: () => context,
  getBoundingClientRect: () => ({ width: 128, height: 128 }),
};
const renderer = await createRenderer(device, canvas, engine, "rgba8unorm");
async function pixels(color = 0) {
  renderer.draw({ x: 100, y: 100, width: 24 }, { color });
  const buffer = device.createBuffer({
    size: 128 * 128 * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture },
    { buffer, bytesPerRow: 512 },
    [128, 128],
  );
  device.queue.submit([encoder.finish()]);
  await buffer.mapAsync(GPUMapMode.READ);
  const result = new Uint8Array(buffer.getMappedRange()).slice();
  buffer.unmap();
  buffer.destroy();
  return result;
}
const center = (p) =>
  Array.from(p.slice((64 * 128 + 64) * 4, (64 * 128 + 64) * 4 + 3));
const purpleCount = (p) => {
  let count = 0;
  for (let i = 0; i < p.length; i += 4)
    if (p[i] > 100 && p[i + 2] > 150 && p[i + 2] > p[i] * 1.1) count++;
  return count;
};
const set = (index, value) =>
  device.queue.writeBuffer(
    engine.currentState,
    index * 4,
    new Float32Array([value]),
  );
try {
  await engine.fixture({
    programs: ["wait 1000"],
    cells: [{ x: 100, y: 100 }],
  });
  set(48, 120);
  set(7, 0);
  assert.equal(purpleCount(await pixels()), 0);
  set(7, 20);
  assert.ok(
    purpleCount(await pixels()) > 40,
    "A full barrier should have a visible purple rim",
  );
  const fullBarrier = center(await pixels(5));
  set(7, 0);
  const noBarrier = center(await pixels(5));
  assert.ok(
    fullBarrier[2] > noBarrier[2] + 100,
    "Barrier view should distinguish full and absent shields",
  );
  set(4, 300 * 4096);
  const fullEnergy = center(await pixels(2));
  set(4, 150 * 4096);
  const halfEnergy = center(await pixels(2));
  assert.ok(
    fullEnergy[1] > halfEnergy[1] + 50,
    "Energy view must use configured 300-point capacity, not a hardcoded cap",
  );
  set(38, 600 * 4096);
  const fullStorage = center(await pixels(1));
  set(38, 300 * 4096);
  const halfStorage = center(await pixels(1));
  assert.ok(
    fullStorage[1] > halfStorage[1] + 50,
    "Storage view must use configured 600-point capacity",
  );
  await device.queue.onSubmittedWorkDone();
  assert.deepEqual(errors, []);
  console.log(
    "PASS visible barrier rim, barrier color view, and configured energy/storage color scales",
  );
} finally {
  renderer.destroy();
  texture.destroy();
  engine.destroy();
  device.destroy();
}
