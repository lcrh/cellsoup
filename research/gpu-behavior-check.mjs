import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import {
  createBehaviorSampler,
  BEHAVIOR_GRID,
} from "../web/gpu/behavior-sampler.js";
Object.assign(globalThis, globals);
globalThis.__behaviorGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__behaviorGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const e = await createLifeEngine(device, {
  treePrograms: 0,
  capacity: 64,
  genomeCapacity: 1,
  initial: 0,
  side: 5,
  rate: 0,
  floor: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  solarEnabled: 0,
});
let sampler;
try {
  await e.fixture({
    programs: ["wait 1000"],
    cells: [
      { x: 12, y: 12, energy: 70, storage: 24, links: [2, 0, 0, 0] },
      { x: 13, y: 12, energy: 70, storage: 24, links: [1, 0, 0, 0] },
      { x: 12, y: 12, corpse: true, energy: 90 },
      { x: 152, y: 152, energy: 10 },
    ],
  });
  sampler = await createBehaviorSampler(device, e);
  let before = await e.state();
  const first = await sampler.sample();
  assert.equal(first.living, 3);
  assert.deepEqual(await e.state(), before, "Sampler modified cell state");
  const tile = 2 * BEHAVIOR_GRID + 2;
  assert.equal(first.symbols[tile * 6], 2); // Two live cells; corpse is excluded.
  assert.equal(first.symbols[tile * 6 + 1], 4); // Both have reciprocal live links.
  assert.equal(first.symbols[tile * 6 + 3], 0);
  console.log(
    "PASS behavior bins count living cells and reciprocal links without modifying the simulation",
  );
  await e.step();
  before = await e.state();
  const words = new Uint32Array(before);
  const events = new Uint32Array(64 * 8);
  events.set([e.tick, 0, words[24], 0], 0); // Valid thrust.
  events.set([0, e.tick, words[52 + 24] + 100, 0], 8); // Stale attacker slot.
  events.set([0, e.tick, words[2 * 52 + 24], e.tick], 16); // Corpse must not contribute.
  device.queue.writeBuffer(e.buffers.activity, 0, events);
  const second = await sampler.sample();
  assert.equal(second.living, 3);
  assert.equal(second.symbols[tile * 6 + 3], 1);
  assert.deepEqual(await e.state(), before);
  console.log(
    "PASS activity rejects stale incarnations and dead cells across state-buffer parity changes",
  );
  const colored = new Float32Array(before.slice(0));
  colored[48] = 222;
  colored[52 + 48] = 359;
  device.queue.writeBuffer(e.currentState, 0, colored);
  assert.deepEqual((await sampler.sample()).symbols, second.symbols);
  console.log(
    "PASS arbitrary biological hue cannot increase the behavioral estimate",
  );
  assert.deepEqual(errors, []);
} finally {
  sampler?.destroy();
  e.destroy();
  device.destroy();
  delete globalThis.__behaviorGPU;
}
