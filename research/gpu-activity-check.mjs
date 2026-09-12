import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import {
  readCellActivity,
  summarizeColonyActivity,
} from "./colony-activity.mjs";
Object.assign(globalThis, globals);
globalThis.__activityGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__activityGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
try {
  for (const [program, motors] of [
    ["move 1\nwait 1000", 4],
    ["move 0\nwait 1000", 0],
    ["wait 1000", 0],
  ]) {
    const engine = await createLifeEngine(device, {
      treePrograms: 0,
      capacity: 4,
      genomeCapacity: 1,
      initial: 0,
      floor: 0,
      rate: 0,
      side: 8,
      sources: 1,
      solarEnabled: 0,
    });
    try {
      const cells = Array.from({ length: 4 }, (_, i) => ({
        x: 100 + i * 14,
        y: 100,
        vx: 10,
        heading: 0,
        energy: 70,
        links: [i < 3 ? i + 2 : 0, i > 0 ? i : 0, 0, 0],
      }));
      await engine.fixture({ programs: [program], cells });
      await engine.step();
      const state = await engine.state(),
        activity = await readCellActivity(device, engine);
      const r = summarizeColonyActivity(state, activity, engine.tick, 256);
      assert.equal(r.recentThrustCells, motors);
      assert.equal(r.movingBodiesWithRecentThrust, Number(motors > 0));
      assert.equal(r.movingBodiesWithoutRecentThrust, Number(motors === 0));
      console.log("PASS", program.split("\n")[0], JSON.stringify(r));
    } finally {
      engine.destroy();
    }
  }
  assert.deepEqual(errors, []);
} finally {
  device.destroy();
  delete globalThis.__activityGPU;
}
