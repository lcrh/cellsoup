import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__lifeGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__lifeGPU.requestAdapter();
if (!adapter) throw Error("No GPU");
const device = await adapter.requestDevice();
device.addEventListener("uncapturederror", (event) => {
  console.error(event.error);
  process.exitCode = 1;
});
const engine = await createLifeEngine(device, {
  capacity: 4096,
  genomeCapacity: 1024,
  initial: 1024,
  side: 64,
  sources: 4,
  floor: 128,
  rate: 8,
});
console.log(await engine.counters());
const start = performance.now();
for (let i = 0; i < 10; i++) await engine.step(60);
console.log(await engine.counters());
console.log({ milliseconds: performance.now() - start });
engine.destroy();
device.destroy();
delete globalThis.__lifeGPU;
