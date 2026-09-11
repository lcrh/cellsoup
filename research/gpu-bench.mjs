import { create, globals } from "webgpu";
import { createExperiment } from "./gpu-kernel.mjs";
Object.assign(globalThis, globals);
const gpu = create(process.platform === "darwin" ? ["backend=metal"] : []),
  adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
globalThis.__headlessGPU = gpu;
if (!adapter)
  throw Error(
    "GPU unavailable. On macOS sandboxed commands may require GPU access.",
  );
const device = await adapter.requestDevice({
  requiredLimits: {
    maxStorageBufferBindingSize: 128 * 1024 * 1024,
    maxBufferSize: 256 * 1024 * 1024,
  },
});
device.addEventListener("uncapturederror", (e) => {
  throw e.error;
});
for (const count of [8192, 32768, 131072, 524288, 1048576]) {
  const experiment = await createExperiment(device, count);
  await experiment.run(64);
  const measurements = [];
  for (let rep = 0; rep < 5; rep++) {
    const start = performance.now();
    await experiment.run(256);
    measurements.push((performance.now() - start) / 256);
  }
  const output = await experiment.read(),
    f = new Float32Array(output);
  let maxspeed = 0;
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 16; k++)
      if (!Number.isFinite(f[i * 20 + k])) throw Error("Nonfinite state");
    maxspeed = Math.max(maxspeed, Math.hypot(f[i * 20 + 2], f[i * 20 + 3]));
  }
  measurements.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      count,
      msPerTick: measurements[2],
      cellTicksPerSecond: (count * 1000) / measurements[2],
      relativeToRealtime: 1000 / (60 * measurements[2]),
      measurements,
      maxspeed,
    }),
  );
  experiment.destroy();
}
device.destroy();
delete globalThis.__headlessGPU;
