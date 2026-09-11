import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createExperiment } from "./gpu-kernel.mjs";
Object.assign(globalThis, globals);
globalThis.__headlessGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__headlessGPU.requestAdapter();
if (!adapter) throw Error("No GPU adapter");
const device = await adapter.requestDevice();
device.addEventListener("uncapturederror", (e) => {
  throw e.error;
});
function cpuTick(buffer, code, width, budget) {
  const src = new Float32Array(buffer),
    su = new Uint32Array(buffer),
    out = buffer.slice(0),
    dst = new Float32Array(out),
    u = new Uint32Array(out),
    n = src.length / 20;
  const delta = (a, b) => {
    const d = a - b;
    return d - Math.round(d / width) * width;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wrap = (v) => ((v % width) + width) % width;
  for (let i = 0; i < n; i++) {
    const k = i * 20;
    let fx = 0,
      fy = 0,
      nearest = 0xffffffff,
      closest = 900;
    for (let j = 0; j < n; j++)
      if (j !== i) {
        const x = delta(src[k], src[j * 20]),
          y = delta(src[k + 1], src[j * 20 + 1]),
          q = x * x + y * y;
        if (q < closest || (q === closest && j < nearest)) {
          closest = q;
          nearest = j;
        }
        if (q < 100 && q > 0.000001) {
          const dist = Math.sqrt(q),
            f = ((10 - dist) * 55) / dist;
          fx += x * f;
          fy += y * f;
        }
      }
    for (const j of [su[k + 18], su[k + 19]])
      if (j !== 0xffffffff) {
        const x = delta(src[j * 20], src[k]),
          y = delta(src[j * 20 + 1], src[k + 1]),
          dist = Math.hypot(x, y);
        if (dist > 0.00001) {
          const f = ((dist - 18) * 24) / dist;
          fx += x * f;
          fy += y * f;
        }
      }
    const value = (x) =>
      x <= -1000000 ? dst[k + 8 + ((-x - 1000000) % 8)] : x;
    if (u[k + 17] > 0) u[k + 17]--;
    else
      for (let step = 0; step < budget; step++) {
        const p = ((Math.floor(i / 8) % 4096) * 32 + (u[k + 16] % 32)) * 4,
          op = code[p],
          d = (Math.max(0, -code[p + 1] - 1000000) % 8) + k + 8,
          a = value(code[p + 1]),
          b = value(code[p + 2]),
          v = value(code[p + 3]);
        u[k + 16] = (u[k + 16] + 1) % 32;
        switch (op) {
          case 1:
            dst[d] = b;
            break;
          case 2:
            dst[d] += b;
            break;
          case 3:
            dst[d] -= b;
            break;
          case 4:
            dst[d] *= b;
            break;
          case 5:
            dst[d] = b === 0 ? 0 : dst[d] / b;
            break;
          case 8:
            u[k + 16] = Math.max(0, a) % 32;
            break;
          case 9:
            if (a === 0) u[k + 16] = Math.max(0, b) % 32;
            break;
          case 10:
            if (a !== 0) u[k + 16] = Math.max(0, b) % 32;
            break;
          case 11:
            if (a > b) u[k + 16] = Math.max(0, v) % 32;
            break;
          case 12:
            if (a < b) u[k + 16] = Math.max(0, v) % 32;
            break;
          case 14:
            u[k + 17] = clamp(a, 0, 36000);
            step = budget;
            break;
          case 15: {
            const x = delta(src[k], width * 0.5),
              y = delta(src[k + 1], width * 0.5);
            dst[d] =
              code[p + 2] === 1
                ? Math.exp(-(x * x + y * y) / (width * width * 0.02))
                : dst[k + 5];
            break;
          }
          case 16:
            dst[d] = nearest === 0xffffffff ? 0 : nearest + 1;
            break;
          case 20:
            dst[k + 4] =
              (((dst[k + 4] + clamp(a, -360, 360) / 360) % 1) + 1) % 1;
            break;
          case 21:
            dst[k + 2] +=
              Math.cos(dst[k + 4] * Math.PI * 2) * clamp(a, -1, 1) * 5;
            dst[k + 3] +=
              Math.sin(dst[k + 4] * Math.PI * 2) * clamp(a, -1, 1) * 5;
            break;
          case 32:
            dst[d] = Math.abs(b);
            break;
          case 33:
            dst[d] = Math.min(dst[d], b);
            break;
          case 34:
            dst[d] = Math.max(dst[d], b);
            break;
        }
        for (let r = 0; r < 8; r++)
          dst[k + 8 + r] = clamp(dst[k + 8 + r], -999999, 999999);
      }
    dst[k + 2] = clamp((dst[k + 2] + fx / 60) * 0.94, -100, 100);
    dst[k + 3] = clamp((dst[k + 3] + fy / 60) * 0.94, -100, 100);
    dst[k] = wrap(dst[k] + dst[k + 2] / 60);
    dst[k + 1] = wrap(dst[k + 1] + dst[k + 3] / 60);
  }
  return out;
}
for (const budget of [0, 24, 64]) {
  const experiment = await createExperiment(device, 64, budget);
  let expected = experiment.data.bytes;
  for (let t = 0; t < 3; t++)
    expected = cpuTick(
      expected,
      experiment.data.code,
      experiment.data.width,
      budget,
    );
  await experiment.run(3);
  const actual = await experiment.read(),
    a = new Float32Array(actual),
    e = new Float32Array(expected),
    u = new Uint32Array(actual),
    eu = new Uint32Array(expected);
  let maxError = 0;
  for (let i = 0; i < 64; i++) {
    for (let k = 0; k < 16; k++) {
      const error = Math.abs(a[i * 20 + k] - e[i * 20 + k]);
      maxError = Math.max(maxError, error);
      assert.ok(
        error < 0.003,
        `budget ${budget}, cell ${i}, field ${k}: ${a[i * 20 + k]} vs ${e[i * 20 + k]}`,
      );
    }
    for (let k = 16; k < 20; k++) assert.equal(u[i * 20 + k], eu[i * 20 + k]);
  }
  console.log(JSON.stringify({ budget, passed: true, maxError }));
  experiment.destroy();
}
device.destroy();
delete globalThis.__headlessGPU;
