// Real-device loss/reconnection without restarting the process. This intentionally
// destroys only this test's GPU device, never another tab's simulation.
import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { createDeviceSession } from "../web/gpu/device-session.js";
Object.assign(globalThis, globals);
let gpu = create(process.platform === "darwin" ? ["backend=metal"] : []);
const failures = [];
let session = createDeviceSession(gpu, (error) => failures.push(error));
let engine;
try {
  const first = await session.connect();
  const options = {
    capacity: 64,
    genomeCapacity: 16,
    initial: 16,
    side: 8,
    floor: 0,
    rate: 0,
    capacityRate: 0,
    treePrograms: 1,
    seed: 42,
  };
  engine = await createLifeEngine(first, options);
  await engine.step(24);
  first.destroy();
  await first.lost;
  assert.equal(failures.at(-1).name, "GPUDeviceLostError");
  assert.throws(() => session.check(), /connection was lost/);
  engine.destroy();
  engine = null;
  session.dispose();
  const second = await session.connect();
  assert.notEqual(first, second);
  engine = await createLifeEngine(second, options);
  await engine.step(60);
  assert.equal(engine.tick, 60);
  session.check();
  console.log(
    JSON.stringify({
      passed: true,
      resumedTick: engine.tick,
      intentionalLosses: failures.length,
    }),
  );
} finally {
  engine?.destroy();
  session.dispose();
  engine = null;
  session = null;
  gpu = null;
}
