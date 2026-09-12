import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { createRenderer } from "../web/gpu/renderer.js";

Object.assign(globalThis, globals);
globalThis.devicePixelRatio = 1;
globalThis.__renderGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__renderGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const engine = await createLifeEngine(device, {
  treePrograms: 0,
  capacity: 64,
  genomeCapacity: 2,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 8,
  sources: 1,
  solarEnabled: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
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
async function greenPixels(activity) {
  renderer.draw({ x: 107, y: 100, width: 40 }, { activity });
  const output = device.createBuffer({
    size: 128 * 128 * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture },
    { buffer: output, bytesPerRow: 512 },
    [128, 128],
  );
  device.queue.submit([encoder.finish()]);
  await output.mapAsync(GPUMapMode.READ);
  const pixels = new Uint8Array(output.getMappedRange());
  let green = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (
      pixels[i] >= 80 &&
      pixels[i] < 220 &&
      pixels[i + 1] > 180 &&
      pixels[i + 2] < 150
    )
      green++;
  output.unmap();
  output.destroy();
  return green;
}
try {
  await engine.fixture({
    programs: ["give 2 0.5\nwait 1000", "wait 1000"],
    cells: [
      { x: 100, y: 100 },
      { genome: 1, x: 114, y: 100 },
    ],
  });
  await engine.step();
  assert.equal(await greenPixels(false), 0);
  assert.ok(
    (await greenPixels(true)) > 0,
    "Completed gift should produce a green arrow",
  );
  console.log(
    "PASS completed energy gifts render, and the Activity toggle hides them",
  );
  const previous = engine.buffers.state.find((b) => b !== engine.currentState);
  device.queue.writeBuffer(previous, 208 + 24 * 4, new Uint32Array([999]));
  assert.equal(await greenPixels(true), 0);
  console.log("PASS recipient slot reuse does not inherit an energy arrow");
  device.queue.writeBuffer(previous, 208 + 24 * 4, new Uint32Array([2]));
  device.queue.writeBuffer(previous, 24 * 4, new Uint32Array([999]));
  assert.equal(await greenPixels(true), 0);
  console.log("PASS donor slot reuse does not inherit an energy arrow");
  await device.queue.onSubmittedWorkDone();
  assert.deepEqual(errors, []);
} finally {
  renderer.destroy();
  texture.destroy();
  engine.destroy();
  device.destroy();
  delete globalThis.__renderGPU;
}
