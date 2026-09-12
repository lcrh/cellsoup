import assert from "node:assert/strict";
import { create, globals } from "webgpu";
import { createLifeEngine, describeGenome } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__lifeGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__lifeGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice();
let errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const options = {
  capacity: 64,
  genomeCapacity: 32,
  initial: 0,
  side: 8,
  sources: 1,
  floor: 0,
  rate: 0,
  foodRate: 0,
  upkeep: 0,
  uptakeRate: 0,
  exchange: 0,
  cpuCost: 0,
  moveCost: 0,
  turnCost: 0,
  linkCost: 0,
  contractCost: 0,
  stealCost: 0,
  emitCost: 0,
  sendCost: 0,
  shieldUpkeep: 0,
  corpseRecycle: 0,
  archiveEnabled: 0,
};
async function setup(programs, cells, config = {}, foodValue = [0, 0]) {
  const e = await createLifeEngine(device, { ...options, ...config });
  await e.fixture({ programs, cells, foodValue });
  return e;
}
async function state(e) {
  const buffer = await e.state(),
    f = new Float32Array(buffer),
    u = new Uint32Array(buffer);
  return Array.from({ length: e.cfg.capacity }, (_, i) => ({
    alive: u[i * 52 + 31],
    energy: f[i * 52 + 4] / 4096,
    x: f[i * 52],
    y: f[i * 52 + 1],
    heading: f[i * 52 + 5],
    shield: f[i * 52 + 7],
    r: [...f.slice(i * 52 + 8, i * 52 + 16)],
    links: [...u.slice(i * 52 + 32, i * 52 + 36)],
    a: f[i * 52 + 38],
    b: f[i * 52 + 39],
    enzyme: f[i * 52 + 37],
    genome: u[i * 52 + 25],
  }));
}
let passed = 0;
async function test(name, run) {
  await run();
  assert.deepEqual(errors, []);
  console.log("PASS " + name);
  passed++;
}
await test("fractional gifts conserve energy and retain a reserve", async () => {
  const e = await setup(
    ["give 2 0.25\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100 },
      { genome: 1, x: 114, y: 100 },
    ],
  );
  await e.step();
  const c = await state(e);
  assert.equal(c[0].energy, 52.5);
  assert.equal(c[1].energy, 87.5);
  e.destroy();
});
await test("oversubscribed gifts respect recipient capacity exactly", async () => {
  const seeds = [
    { genome: 1, energy: 199, x: 100, y: 100 },
    ...Array.from({ length: 30 }, () => ({ x: 110, y: 100 })),
  ];
  const e = await setup(["give 1 1\nwait 1000", "wait 1000"], seeds);
  await e.step();
  const c = (await state(e)).filter((c) => c.alive);
  assert.equal(c.length, 31);
  assert.ok(c[0].energy <= 200 && c[0].energy > 199.99);
  assert.equal(
    c.reduce((n, c) => n + c.energy, 0),
    2299,
  );
  e.destroy();
});
await test("a full gift cannot directly kill its donor", async () => {
  const e = await setup(
    ["give 2 1\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100 },
      { genome: 1, x: 114, y: 100 },
    ],
  );
  await e.step();
  const c = await state(e);
  assert.equal(c[0].energy, 1 / 4096);
  assert.equal(c[0].alive, 1);
  assert.equal(c[0].energy + c[1].energy, 140);
  e.destroy();
});
await test("fractional target IDs are rejected, not converted into nearest-neighbor theft", async () => {
  const e = await setup(
    ["steal 0.5 3\ngive 1.5 1\nlink 0.5\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100 },
      { genome: 1, x: 114, y: 100 },
    ],
  );
  await e.step();
  const c = await state(e);
  assert.equal(c[0].energy, 70);
  assert.equal(c[1].energy, 70);
  assert.deepEqual(c[0].links, [0, 0, 0, 0]);
  e.destroy();
});
await test("competing thieves cannot overdraw a victim", async () => {
  const e = await setup(
    ["steal 1 3\nwait 1000", "wait 1000"],
    [
      { genome: 1, x: 100, y: 100, energy: 2 },
      ...Array.from({ length: 30 }, () => ({ x: 110, y: 100 })),
    ],
  );
  await e.step();
  const c = await state(e);
  assert.ok(c[0].energy >= 0 && c[0].energy < 0.01);
  assert.ok(c.every((c) => c.energy >= 0 && c.energy <= 200));
  const stolen = 2 - c[0].energy;
  const gains = c.slice(1, 31).reduce((sum, c) => sum + c.energy - 70, 0);
  assert.ok(gains <= stolen * 0.75 && gains > stolen * 0.74);
  e.destroy();
});
await test("a single predator can kill, and deaths update genome and population counts", async () => {
  const e = await setup(
    ["steal 1 3\nwait 1000", "wait 1000"],
    [
      { genome: 1, x: 100, y: 100, energy: 2 },
      { x: 114, y: 100 },
    ],
  );
  await e.step();
  const c = await state(e),
    stats = await e.counters(),
    genes = await e.genes();
  assert.equal(c[0].alive, 0);
  assert.equal(c[1].energy, 71.5);
  assert.equal(stats.deaths, 1);
  assert.equal(stats.living, 1);
  assert.equal(genes.stats[4], 0);
  e.destroy();
});
await test("division allocates one child and conserves energy after its cost", async () => {
  const e = await setup(["bud r0\nmov r1 99\nwait 1000"], [{ energy: 70 }]);
  await e.step();
  let c = (await state(e)).filter((c) => c.alive);
  assert.equal(c.length, 2);
  assert.equal(
    c.reduce((n, c) => n + c.energy, 0),
    58,
  );
  assert.deepEqual(c.map((c) => c.r[0]).sort(), [0, 1]);
  assert.ok(c.every((c) => c.r[1] === 0 && c.links.some(Boolean)));
  await e.step(2);
  c = (await state(e)).filter((c) => c.alive);
  assert.ok(c.every((c) => c.r[1] === 99));
  assert.equal((await e.counters()).births, 1);
  e.destroy();
});
await test("simultaneous divisions respect capacity without charging failed births", async () => {
  const e = await setup(
    ["split r0"],
    Array.from({ length: 40 }, (_, i) => ({
      x: 10 + (i % 8) * 30,
      y: 10 + Math.floor(i / 8) * 30,
    })),
  );
  await e.step();
  const c = (await state(e)).filter((c) => c.alive),
    stats = await e.counters();
  assert.equal(c.length, 64);
  assert.equal(stats.births, 24);
  assert.equal(
    c.reduce((n, c) => n + c.energy, 0),
    40 * 70 - 24 * 12,
  );
  e.destroy();
});
await test("links are reciprocal under contention and unlink removes both ends", async () => {
  let e = await setup(
    ["link 1\nwait 1000", "wait 1000"],
    [
      { genome: 1, x: 100, y: 100 },
      ...Array.from({ length: 8 }, () => ({ x: 115, y: 100 })),
    ],
  );
  await e.step();
  let c = await state(e);
  assert.equal(
    c.reduce((n, c) => n + c.links.filter(Boolean).length, 0),
    2,
  );
  for (let i = 0; i < c.length; i++)
    for (const link of c[i].links)
      if (link) assert.ok(c[link - 1].links.includes(i + 1));
  e.destroy();
  e = await setup(
    ["unlink 0\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, links: [2, 0, 0, 0] },
      {
        genome: 1,
        x: 118,
        y: 100,
        links: [1, 0, 0, 0],
        anchors: [0.5, 0, 0, 0],
      },
    ],
  );
  await e.step();
  c = await state(e);
  assert.ok(c.every((c) => c.links.every((l) => l === 0)));
  e.destroy();
});
await test("linked zero-valued messages arrive next tick with sender identity", async () => {
  const e = await setup(
    ["send 0 0 0\nwait 1000", "loop: receive r0 r1 0\nwait 0\njmp loop"],
    [
      { x: 100, y: 100, links: [2, 0, 0, 0] },
      {
        genome: 1,
        x: 118,
        y: 100,
        links: [1, 0, 0, 0],
        anchors: [0.5, 0, 0, 0],
      },
    ],
  );
  await e.step();
  assert.equal((await state(e))[1].r[1], 0);
  await e.step();
  const c = await state(e);
  assert.equal(c[1].r[0], 0);
  assert.equal(c[1].r[1], 1);
  e.destroy();
});
await test("unaffordable movement and shields do not exhaust a cell", async () => {
  const e = await setup(["move 1\nshield 1\nwait 1000"], [{ energy: 1 }], {
    moveCost: 1,
    shieldUpkeep: 60,
  });
  await e.step();
  const c = await state(e);
  assert.equal(c[0].energy, 1);
  assert.equal(c[0].shield, 0);
  e.destroy();
});
await test("food competition conserves food plus reserves plus stored energy", async () => {
  const e = await setup(
    ["wait 1000"],
    Array.from({ length: 12 }, () => ({ x: 100, y: 100, energy: 60 })),
    { uptakeRate: 4 },
    [0.01, 0.01],
  );
  const before = [...(await e.field())].reduce((a, b) => a + b, 0) + 720;
  await e.step();
  const c = await state(e);
  const after =
    [...(await e.field())].reduce((a, b) => a + b, 0) +
    c.filter((c) => c.alive).reduce((a, c) => a + c.energy + c.a + c.b, 0);
  assert.ok(Math.abs(before - after) < 0.0001, `${before} vs ${after}`);
  assert.ok(c.every((c) => c.a >= 0 && c.b >= 0));
  e.destroy();
});
await test("linked complementary specialists metabolize resources that isolated specialists cannot", async () => {
  const energies = [];
  for (const linked of [false, true]) {
    const e = await setup(
      ["wait 1000"],
      [
        {
          x: 100,
          y: 100,
          enzyme: 1,
          links: linked ? [2, 0, 0, 0] : [0, 0, 0, 0],
        },
        {
          x: 118,
          y: 100,
          enzyme: 0,
          links: linked ? [1, 0, 0, 0] : [0, 0, 0, 0],
          anchors: [0.5, 0, 0, 0],
        },
      ],
      { uptakeRate: 4, exchange: 0.12 },
      [10, 10],
    );
    await e.step(3);
    energies.push(
      (await state(e)).filter((c) => c.alive).reduce((n, c) => n + c.energy, 0),
    );
    e.destroy();
  }
  assert.equal(energies[0], 140);
  assert.ok(energies[1] > 140.05, energies.join(" / "));
});
await test("enzyme allocation changes gradually and is readable by programs", async () => {
  const e = await setup(["enzyme 1\nsense r0 enzyme"], [{}]);
  await e.step(2);
  const c = await state(e);
  assert.ok(c[0].enzyme > 0.5 && c[0].enzyme < 0.51);
  assert.ok(c[0].r[0] > 0.5 && c[0].r[0] < 0.51);
  e.destroy();
});
await test("successful archive resampling creates a mutated genome, not division mutations", async () => {
  const e = await setup(["bud r0\nwait 1000"], [{}], {
    rate: 1,
    share: 1,
    mutation: 1,
    archiveEnabled: 1,
    archiveAge: 0,
    archiveFood: 0,
    archiveOffspring: 1,
  });
  await e.step(60);
  const stats = await e.counters();
  assert.equal(stats.archive, 1);
  assert.equal(stats.sampledArrivals, 1);
  assert.equal(stats.mutations, 1);
  assert.equal(stats.births, 1);
  const genes = await e.genes(),
    live = (await state(e)).filter((c) => c.alive);
  const ids = [...new Set(live.map((c) => c.genome))];
  assert.equal(ids.length, 2);
  const p = ids.map((i) => describeGenome(genes.data, i));
  assert.notEqual(p[0].source, p[1].source);
  e.destroy();
});
await test("three linked cells execute a weighted ReLU relay", async () => {
  const e = await setup(
    [
      "send 2 0 4\nwait 1000",
      "loop: receive r0 r1 0\njz r1 rest\nmul r0 .75\nsub r0 .2\nmax r0 0\nsend 3 1 r0\nrest: wait 0\njmp loop",
      "loop: receive r0 r1 1\njnz r1 done\nwait 0\njmp loop\ndone: wait 1000",
    ],
    [
      { x: 90, y: 100, links: [2, 0, 0, 0] },
      {
        genome: 1,
        x: 108,
        y: 100,
        links: [1, 3, 0, 0],
        anchors: [0.5, 0, 0, 0],
      },
      {
        genome: 2,
        x: 126,
        y: 100,
        links: [2, 0, 0, 0],
        anchors: [0.5, 0, 0, 0],
      },
    ],
  );
  await e.step(5);
  const c = await state(e);
  assert.ok(Math.abs(c[2].r[0] - 2.8) < 0.00001);
  assert.equal(c[2].r[1], 2);
  e.destroy();
});
await test("gift demand safely exceeds 32-bit capacity under massive contention", async () => {
  const donors = 18000;
  const e = await setup(
    ["give 1 1\nwait 1000", "wait 1000"],
    [
      { genome: 1, energy: 0, x: 100, y: 100 },
      ...Array.from({ length: donors }, () => ({
        energy: 200,
        x: 114,
        y: 100,
      })),
    ],
    { capacity: 32768, genomeCapacity: 8, side: 128 },
  );
  const result = await e.previewTransfers();
  assert.ok(result.giftDemands[1] > 0);
  assert.equal(
    result.giftDemands[0] + result.giftDemands[1] * 4294967296,
    donors * (200 * 4096 - 1),
  );
  let total = 0;
  for (let i = 0; i <= donors; i++) {
    const energy = result.intents[i * 32 + 18];
    assert.ok(energy <= 200 * 4096);
    total += energy;
  }
  assert.equal(total, donors * 200 * 4096);
  assert.ok(result.intents[18] > 190 * 4096);
  e.destroy();
});
console.log(`${passed} GPU lifecycle checks passed`);
device.destroy();
delete globalThis.__lifeGPU;
