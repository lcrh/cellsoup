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
  solarEnabled: 0,
  solarRate: 0,
  energyDecay: 0,
  attackDamageCost: 0,
  eatCost: 0,
  upkeep: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  cooling: 0,
  thermalExchange: 0,
  heatDamage: 0,
  exchange: 0,
  cpuCost: 0,
  moveCost: 0,
  turnCost: 0,
  linkCost: 0,
  contractCost: 0,
  attackCost: 0,
  emitCost: 0,
  sendCost: 0,
  shieldUpkeep: 0,
  corpseEnergy: 0,
  archiveEnabled: 0,
};
async function setup(programs, cells, config = {}, sunlight = 0) {
  const e = await createLifeEngine(device, { ...options, ...config });
  await e.fixture({ programs, cells, sunlight });
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
    sunlight: f[i * 52 + 37],
    storage: f[i * 52 + 38] / 4096,
    temperature: f[i * 52 + 39],
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
await test("fractional target IDs are rejected, not converted into nearest-neighbor attack", async () => {
  const e = await setup(
    ["attack 0.5 3\ngive 1.5 1\nlink 0.5\nwait 1000", "wait 1000"],
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
await test("competing attackers cannot overdraw a victim", async () => {
  const e = await setup(
    ["attack 1 3\nwait 1000", "wait 1000"],
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
  assert.equal(gains, 0);
  assert.ok(stolen > 1.99);
  e.destroy();
});
await test("a single predator can kill, and deaths update genome and population counts", async () => {
  const e = await setup(
    ["attack 1 3\nwait 1000", "wait 1000"],
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
  assert.equal(c[1].energy, 70);
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
await test("photosynthesis is explicit, light-limited and bounded per tick", async () => {
  const e = await setup(
    ["photosynthesize r0\nphotosynthesize r1\nwait 100", "wait 100"],
    [{}, { genome: 1, x: 170 }],
    { solarRate: 6 },
    0.5,
  );
  const light = [...(await e.field())];
  await e.step();
  const c = await state(e);
  const gain = Math.floor(0.05 * 4096) / 4096;
  assert.equal(c[0].energy, 70 + gain);
  assert.equal(c[0].r[0], gain);
  assert.equal(c[0].r[1], 0);
  assert.equal(c[1].energy, 70);
  assert.deepEqual([...(await e.field())], light);
  e.destroy();
});
await test("storage conversion conserves energy and requires explicit mobilization", async () => {
  const e = await setup(
    ["store r0 20\nwait 0\nmobilize r1 7\nwait 100"],
    [{ energy: 70, storage: 10 }],
  );
  await e.step();
  let c = (await state(e))[0];
  assert.equal(c.energy, 50);
  assert.equal(c.storage, 30);
  assert.equal(c.r[0], 20);
  await e.step();
  c = (await state(e))[0];
  assert.equal(c.energy, 57);
  assert.equal(c.storage, 23);
  assert.equal(c.r[1], 7);
  e.destroy();
});
await test("linked storage diffuses conservatively while usable energy remains local", async () => {
  const e = await setup(
    ["sense r0 storage\nsense r1 linked_storage\npeek r2 2 storage\nwait 100"],
    [
      { x: 100, y: 100, energy: 70, storage: 100, links: [2, 0, 0, 0] },
      {
        x: 118,
        y: 100,
        energy: 30,
        storage: 0,
        links: [1, 0, 0, 0],
        anchors: [0.5, 0, 0, 0],
      },
    ],
    { exchange: 0.12 },
  );
  await e.step();
  const c = await state(e);
  assert.equal(c[0].energy, 70);
  assert.equal(c[1].energy, 30);
  assert.equal(c[0].storage + c[1].storage, 100);
  assert.ok(Math.abs(c[0].storage - 88) < 0.001);
  assert.ok(Math.abs(c[1].storage - 12) < 0.001);
  assert.equal(c[0].r[1], 0);
  assert.equal(c[1].r[1], 100);
  e.destroy();
});
await test("zero energy kills despite stored reserves and a queued mobilize instruction", async () => {
  const e = await setup(
    ["mobilize r0 100\nphotosynthesize r1"],
    [{ energy: 1, storage: 100 }],
    { upkeep: 60, solarRate: 6, corpseEnergy: 8 },
    1,
  );
  await e.step();
  const c = (await state(e))[0],
    n = await e.counters();
  assert.equal(c.alive, 2);
  assert.equal(c.energy, 108);
  assert.equal(n.living, 0);
  assert.equal(n.corpses, 1);
  e.destroy();
});
await test("paid attacks leave storage-rich corpses, with eating as a separate action", async () => {
  const e = await setup(
    ["wait 100", "attack 1 3\nwait 0\neat r0\nwait 100"],
    [
      { x: 100, y: 100, energy: 2, storage: 100 },
      { genome: 1, x: 114, y: 100, energy: 70 },
    ],
    { corpseEnergy: 8, attackCost: 0.08, attackDamageCost: 0.2 },
  );
  await e.step();
  let c = await state(e);
  assert.equal(c[0].alive, 2);
  assert.equal(c[0].energy, 108);
  assert.equal(c[1].energy, 70 - Math.round(0.68 * 4096) / 4096);
  assert.equal((await e.counters()).kills, 1);
  await e.step();
  c = await state(e);
  assert.equal(c[1].r[0], 3);
  assert.equal(c[1].energy, 73 - Math.round(0.68 * 4096) / 4096);
  assert.ok(c[0].energy < 105 && c[0].energy > 104.98);
  e.destroy();
});
await test("eaters cannot duplicate a contested corpse's nutrients", async () => {
  const e = await setup(
    ["eat r0\nwait 100", "wait 100"],
    [
      { genome: 1, x: 100, y: 100, energy: 2, corpse: true },
      ...Array.from({ length: 30 }, () => ({ x: 110, y: 100, energy: 70 })),
    ],
  );
  await e.step();
  const c = await state(e),
    gain = c.slice(1, 31).reduce((n, c) => n + c.energy - 70, 0);
  assert.ok(gain <= 2 && gain > 1.98);
  assert.ok(c[0].energy >= 0);
  assert.ok(Math.abs(gain + c[0].energy - 2) < 0.00001);
  e.destroy();
});
await test("corpse sensing distinguishes status and storage-gradient direction", async () => {
  const e = await setup(
    [
      "storage_gradient r0 r1 1\nscan_corpse r2 360\npeek r3 r2 alive\npeek r4 r2 storage\nstorage_gradient r5 r6 0\nwait 100",
      "wait 100",
    ],
    [
      { x: 100, y: 100, heading: 0, energy: 70 },
      { genome: 1, x: 140, y: 100, energy: 20, corpse: true },
      { genome: 1, x: 100, y: 140, energy: 70, storage: 100 },
    ],
  );
  await e.step();
  const c = (await state(e))[0];
  assert.ok(Math.abs(c.r[0]) < 0.001);
  assert.ok(c.r[1] > 0);
  assert.equal(c.r[2], 2);
  assert.equal(c.r[3], 0);
  assert.equal(c.r[4], 20);
  assert.ok(Math.abs(c.r[5] - 90) < 0.001);
  e.destroy();
});
await test("uneaten corpses decay and eventually release their slots", async () => {
  const e = await setup(["wait 100"], [{ energy: 8, corpse: true }], {
    corpseLifetime: 1,
  });
  await e.step(61);
  const c = (await state(e))[0];
  assert.equal(c.alive, 0);
  assert.equal((await e.counters()).corpses, 0);
  e.destroy();
});
await test("small corpses retain fractional decay over the configured lifetime", async () => {
  const e = await setup(["wait 100"], [{ energy: 1, corpse: true }], {
    corpseLifetime: 900,
  });
  await e.step(600);
  const c = (await state(e))[0];
  assert.equal(c.alive, 2);
  assert.ok(
    Math.abs(c.energy - (1 - Math.floor(4096 / 90) / 4096)) <= 1 / 4096,
  );
  e.destroy();
  const last = await setup(
    ["wait 100"],
    [{ energy: 1 / 4096, corpse: true, age: 53999 }],
    { corpseLifetime: 900 },
  );
  await last.step();
  assert.equal((await state(last))[0].alive, 0);
  last.destroy();
});
await test("untargeted eating samples corpses around the cell without slot or heading preference", async () => {
  const seeds = [];
  for (let i = 0; i < 64; i++) {
    const x = 64 + (i % 8) * 96,
      y = 64 + Math.floor(i / 8) * 96;
    seeds.push({ x, y, energy: 70, heading: i / 64 });
    for (const [dx, dy] of [
      [-12, 0],
      [0, 12],
      [12, 0],
      [0, -12],
    ])
      seeds.push({ x: x + dx, y: y + dy, energy: 10, corpse: true });
  }
  const e = await setup(["eat r0\nwait 100"], seeds, {
    capacity: 512,
    side: 32,
  });
  await e.step();
  const c = await state(e),
    selected = [0, 0, 0, 0];
  for (let i = 0; i < 64; i++) {
    assert.equal(c[i * 5].r[0], 3);
    assert.equal(c[i * 5].energy, 73);
    const eaten = c
      .slice(i * 5 + 1, i * 5 + 5)
      .map((n, j) => (n.energy < 8 ? j : -1))
      .filter((j) => j >= 0);
    assert.equal(eaten.length, 1);
    selected[eaten[0]]++;
  }
  assert.ok(
    selected.every((n) => n >= 4),
    JSON.stringify(selected),
  );
  e.destroy();
});
await test("eating ignores living cells and distant remains, respects costs and wraps at edges", async () => {
  const e = await setup(
    ["eat r0\nwait 100", "wait 100"],
    [
      { x: 1, y: 100 },
      { x: 255, y: 100, corpse: true, energy: 10 },
      { x: 21, y: 100, corpse: true, energy: 10 },
      { x: 2, y: 100, genome: 1 },
    ],
    { eatCost: 0.04 },
  );
  await e.step();
  const c = await state(e);
  assert.equal(c[0].energy, 73 - Math.round(0.04 * 4096) / 4096);
  assert.ok(c[1].energy < 8);
  assert.ok(c[2].energy > 9.99);
  assert.equal(c[3].energy, 70);
  e.destroy();
  const poor = await setup(
    ["eat r0\nwait 100"],
    [
      { x: 100, y: 100, energy: 0.04 },
      { x: 112, y: 100, energy: 10, corpse: true },
    ],
    { eatCost: 0.04 },
  );
  await poor.step();
  assert.equal((await state(poor))[0].r[0], 0);
  assert.equal((await poor.counters()).eaten, 0);
  poor.destroy();
});
await test("linked heat exchange conserves temperature sum and exposes local and neighbor readings", async () => {
  const e = await setup(
    [
      "sense r0 temperature\nsense r1 linked_temperature\npeek r2 2 temperature\nwait 100",
      "wait 100",
    ],
    [
      { x: 100, y: 100, temperature: 40, links: [2, 0, 0, 0] },
      { x: 118, y: 100, temperature: 20, genome: 1, links: [1, 0, 0, 0] },
      { x: 200, y: 200, temperature: 80, genome: 1 },
    ],
    { thermalExchange: 0.25 },
  );
  await e.step();
  const c = await state(e);
  assert.equal(c[0].temperature, 35);
  assert.equal(c[1].temperature, 25);
  assert.equal(c[2].temperature, 80);
  assert.deepEqual(c[0].r.slice(0, 3), [35, 20, 20]);
  assert.equal(c[0].energy + c[1].energy, 140);
  e.destroy();
});
await test("sunlight heats idle cells and energy expenditure generates heat", async () => {
  const sunny = await setup(["wait 1000"], [{}], { sunlightHeating: 1 }, 1);
  await sunny.step(60);
  const c = (await state(sunny))[0];
  assert.ok(Math.abs(c.temperature - 21) < 0.001);
  assert.equal(c.energy, 70);
  sunny.destroy();
  const active = await setup(["nop\nwait 100"], [{}], {
    cpuCost: 1,
    activityHeating: 0.5,
    budget: 2,
  });
  await active.step();
  assert.equal((await state(active))[0].temperature, 21);
  assert.equal((await state(active))[0].energy, 68);
  active.destroy();
});
await test("crowds reduce cooling without a direct crowding energy penalty", async () => {
  const e = await setup(
    ["wait 1000"],
    [
      { x: 40, y: 40, temperature: 40 },
      { x: 160, y: 160, temperature: 40 },
      { x: 172, y: 160, temperature: 40 },
      { x: 148, y: 160, temperature: 40 },
      { x: 160, y: 172, temperature: 40 },
    ],
    { cooling: 0.2, crowdInsulation: 1 },
  );
  await e.step(60);
  const c = await state(e);
  assert.ok(Math.abs(c[0].temperature - (20 + 20 * Math.exp(-0.2))) < 0.001);
  assert.ok(c[1].temperature > c[0].temperature + 1);
  assert.equal(
    c.slice(0, 5).reduce((sum, n) => sum + n.energy, 0),
    350,
  );
  e.destroy();
});
await test("overheating can kill despite stored reserves and division inherits temperature", async () => {
  const hot = await setup(
    ["wait 1000"],
    [{ energy: 5, storage: 100, temperature: 40 }],
    { heatDamage: 1, safeTemperature: 28, corpseEnergy: 8 },
  );
  await hot.step(60);
  const c = (await state(hot))[0];
  assert.equal(c.alive, 2);
  assert.ok(c.energy > 107 && c.energy <= 108);
  assert.equal((await hot.counters()).deaths, 1);
  hot.destroy();
  const split = await setup(
    ["split r0\nwait 100"],
    [{ energy: 100, temperature: 37 }],
    { divisionCost: 0 },
  );
  await split.step();
  const family = (await state(split)).filter((c) => c.alive === 1);
  assert.equal(family.length, 2);
  assert.ok(family.every((c) => c.temperature === 37));
  split.destroy();
});
await test("configurable daughter energy gates division and conserves the remainder", async () => {
  const e = await setup(["split r0\nwait 100"], [{ energy: 36 }], {
    divisionCost: 12,
    minimumBirthEnergy: 12,
  });
  await e.step();
  const family = (await state(e)).filter((c) => c.alive === 1);
  assert.equal(family.length, 2);
  assert.ok(family.every((c) => c.energy === 12));
  e.destroy();
  const short = await setup(
    ["split r0\nwait 100"],
    [{ energy: 36 - 1 / 4096 }],
    { divisionCost: 12, minimumBirthEnergy: 12 },
  );
  await short.step();
  assert.equal((await short.counters()).births, 0);
  assert.equal((await state(short))[0].energy, 36 - 1 / 4096);
  short.destroy();
});
await test("closing immigration disables both the steady rate and low-population replenishment", async () => {
  const e = await createLifeEngine(device, { ...options, rate: 4, floor: 10 });
  await e.step(60);
  const arrivals = (await e.counters()).randomArrivals;
  assert.ok(arrivals >= 4);
  assert.throws(() => e.setImmigration({ rate: 65 }), /Invalid rate/);
  assert.equal(e.cfg.rate, 4);
  e.setImmigration({ rate: 0, floor: 0 });
  await e.step(120);
  const c = await e.counters();
  assert.equal(c.randomArrivals, arrivals);
  assert.equal(c.sampledArrivals, 0);
  e.destroy();
});
await test("newcomers retain free slots when divisions compete near capacity", async () => {
  const e = await setup(
    ["wait 58\nsplit r0\nwait 100"],
    Array.from({ length: 60 }, (_, i) => ({
      energy: 100,
      x: 32 + (i % 8) * 24,
      y: 32 + Math.floor(i / 8) * 24,
    })),
    { rate: 2 },
  );
  await e.step(60);
  const c = await e.counters();
  assert.equal(c.births, 2);
  assert.equal(c.randomArrivals, 62);
  assert.equal(c.living, 64);
  e.destroy();
});
await test("cloud shadows change smoothly and light stays bounded", async () => {
  const e = await setup(["wait 100"], [{}], {
    solarEnabled: 1,
    cloudScale: 128,
    cloudSpeed: 12,
    cloudMorph: 180,
  });
  await e.step();
  const a = await e.field();
  await e.step();
  const b = await e.field();
  let change = 0;
  for (let i = 0; i < a.length; i += 2) {
    assert.ok(a[i] >= 0 && a[i] <= 1);
    change = Math.max(change, Math.abs(a[i] - b[i]));
  }
  assert.ok(change > 0 && change < 0.03, change);
  e.destroy();
});
await test("a motor cell pulls its linked body through springs", async () => {
  const e = await setup(
    ["move 1", "wait 1000"],
    [
      { x: 100, y: 100, heading: 0, links: [2, 0, 0, 0] },
      {
        genome: 1,
        x: 118,
        y: 100,
        heading: 0,
        links: [1, 0, 0, 0],
        anchors: [0.5, 0, 0, 0],
      },
    ],
    { budget: 1 },
  );
  await e.step(120);
  const c = await state(e);
  assert.ok(c[1].x > 125);
  assert.ok(c[0].links[0] === 2 && c[1].links[0] === 1);
  e.destroy();
});
await test("successful archive resampling creates a mutated genome, not division mutations", async () => {
  const e = await setup(["bud r0\nwait 1000"], [{}], {
    rate: 1,
    share: 1,
    mutation: 1,
    archiveEnabled: 1,
    archiveAge: 0,
    archiveHarvest: 0,
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
