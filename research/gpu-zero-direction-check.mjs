import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__zeroGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__zeroGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const config = {
  forkMutation: 0,
  capacity: 2,
  genomeCapacity: 2,
  initial: 0,
  rate: 0,
  floor: 0,
  side: 8,
  sources: 1,
  solarEnabled: 0,
  archiveEnabled: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
};
function finite(buffer) {
  const f = new Float32Array(buffer),
    u = new Uint32Array(buffer);
  for (let i = 0; i < 2; i++)
    if (u[i * 52 + 31] === 1)
      for (let q = 0; q < 52; q++)
        if (q < 24 || (q >= 36 && q < 40) || q >= 44)
          assert.ok(Number.isFinite(f[i * 52 + q]), `slot ${i} field ${q}`);
  return { f, u };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
try {
  for (const heading of [0, 0.25, 0.73]) {
    const e = await createLifeEngine(device, { ...config, treePrograms: 0 });
    try {
      await e.fixture({
        programs: [
          "peek r0 1 bearing\ngradient r1 r2\nstorage_gradient r3 r4 -1\nwait 1000",
        ],
        cells: [{ x: 100, y: 100, energy: 100, heading }],
        sunlight: 0.5,
      });
      await e.step(1);
      const { f } = finite(await e.state());
      assert.deepEqual([...f.slice(8, 13)], [0, 0, 0, 0, 0]);
      close(f[5], heading);
      checks.push({
        name: "zero relative sensors",
        heading,
        registers: [...f.slice(8, 13)],
      });
    } finally {
      e.destroy();
    }
  }
  for (const heading of [0, 0.25, 0.73]) {
    const e = await createLifeEngine(device, { ...config, treePrograms: 1 });
    try {
      await e.fixture({
        programs: [{ tree: parseTree("(link (nearest-cell))") }],
        cells: [
          { x: 100, y: 100, energy: 100, heading },
          { x: 100, y: 100, energy: 100, heading: (heading + 0.2) % 1 },
        ],
        sunlight: 0.5,
      });
      await e.step(1);
      const start = finite(await e.state());
      assert.equal(start.u[32], 2);
      assert.equal(start.u[84], 1);
      close(start.f[44], 0);
      close(start.f[96], 0.3);
      for (let i = 0; i < 120; i++) {
        await e.step(1);
        finite(await e.state());
      }
      const { f, u } = finite(await e.state());
      assert.equal(u[31], 1);
      assert.equal(u[83], 1);
      const separation = Math.hypot(f[0] - f[52], f[1] - f[53]);
      assert.ok(separation > 1);
      checks.push({
        name: "coincident link stays finite and separates",
        heading,
        anchors: [start.f[44], start.f[96]],
        separation,
      });
    } finally {
      e.destroy();
    }
  }
  // Nonzero geometry still uses the actual bearing, including across a seam.
  for (const [x, y, heading, expected] of [
    [110, 100, 0, 0],
    [100, 110, 0, 90],
    [100, 110, 0.25, 0],
    [254, 100, 0, -180],
  ]) {
    const e = await createLifeEngine(device, { ...config, treePrograms: 0 });
    try {
      await e.fixture({
        programs: ["peek r0 2 bearing\nwait 1000", "wait 1000"],
        cells: [
          { x: x === 254 ? 2 : 100, y: 100, energy: 100, heading },
          { x, y, energy: 100, genome: 1 },
        ],
        sunlight: 0.5,
      });
      await e.step(1);
      const { f } = finite(await e.state());
      assert.ok(Math.abs(f[8] - expected) < 0.001);
      checks.push({
        name: "nonzero target bearing",
        x,
        y,
        heading,
        bearing: f[8],
      });
    } finally {
      e.destroy();
    }
  }
  for (const [axis, heading, expected] of [
    [0, 0, 0],
    [1, 0, 90],
    [0, 0.25, -90],
  ]) {
    const e = await createLifeEngine(device, { ...config, treePrograms: 0 });
    try {
      await e.fixture({
        programs: ["gradient r0 r1\nwait 1000"],
        cells: [{ x: 100, y: 100, energy: 100, heading }],
        sunlight: 0.5,
      });
      const values = new Float32Array(8 * 8 * 4);
      for (let phase = 0; phase < 2; phase++)
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++)
            values[(phase * 64 + y * 8 + x) * 2] = (axis === 0 ? x : y) / 8;
      device.queue.writeBuffer(e.buffers.food, 0, values);
      await e.step(1);
      const { f } = finite(await e.state());
      assert.ok(Math.abs(f[8] - expected) < 0.001);
      assert.ok(f[9] > 0);
      checks.push({
        name: "nonzero relative sunlight gradient",
        axis,
        heading,
        bearing: f[8],
        strength: f[9],
      });
    } finally {
      e.destroy();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/tmp/zero-directions.json",
    JSON.stringify({ checks }, null, 2) + "\n",
  );
  console.log(`${checks.length} zero-direction GPU checks passed`);
} finally {
  device.destroy();
  delete globalThis.__zeroGPU;
}
