import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__pressureGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __pressureGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [],
  checks = [],
  measurements = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 100,
  genomeCapacity: 1,
  initial: 0,
  side: 16,
  sources: 1,
  treePrograms: 0,
  forkMutation: 0,
  rate: 0,
  capacityRate: 0,
  floor: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  exchange: 0,
  solarEnabled: 0,
  solarRate: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  archiveEnabled: 0,
  energyFillScale: 0,
  storageFillScale: 0,
  jitter: 0,
  pressureStrength: 12,
  pressureFrequency: 20,
};
const inputs = new Set([
  "photosynthesis",
  "scavenging",
  "mobilized",
  "giftsReceived",
  "arrivals",
]);
const cells = (count, energy = 100, linked = false) =>
  Array.from({ length: count }, (_, i) => ({
    x: 30 + (i % 10) * 25,
    y: 30 + Math.floor(i / 10) * 25,
    energy,
    storage: i % 2 ? 5 : 25,
    links: linked ? [i % 2 === 0 ? i + 2 : i, 0, 0, 0] : [0, 0, 0, 0],
  }));
async function setup(count, options = {}, seeds = cells(count)) {
  const e = await createLifeEngine(device, { ...base, ...options });
  await e.fixture({ programs: ["wait 10000"], cells: seeds });
  return e;
}
async function snapshot(e) {
  const data = await e.state(),
    f = new Float32Array(data),
    u = new Uint32Array(data),
    counts = await e.counters();
  const rows = Array.from({ length: data.byteLength / 208 }, (_, i) => ({
    id: u[i * 52 + 24],
    life: u[i * 52 + 31],
    energy: f[i * 52 + 4] / 4096,
    storage: f[i * 52 + 38] / 4096,
  }));
  const living = rows.filter((c) => c.life === 1);
  assert.equal(counts.living, living.length);
  assert.equal(counts.corpses, rows.filter((c) => c.life === 2).length);
  const net = Object.entries(counts.energyBudget).reduce(
    (s, [k, v]) => s + (inputs.has(k) ? v : -v),
    0,
  );
  assert.equal(
    net,
    living.reduce((s, c) => s + c.energy, 0),
    "actual usable-energy ledger must balance",
  );
  return { rows, living, counts };
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
try {
  await check(
    "population pressure is zero below and exactly at the target",
    async () => {
      for (const n of [90, 100]) {
        const e = await setup(n);
        try {
          await e.step(4);
          const { living, counts } = await snapshot(e);
          assert.equal(living.length, n);
          assert.ok(living.every((c) => c.energy === 100));
          assert.equal(counts.energyBudget.populationPressure, 0);
        } finally {
          e.destroy();
        }
      }
    },
  );
  await check(
    "disabled pressure permits population above the soft target",
    async () => {
      const e = await setup(120, { pressureStrength: 0 });
      try {
        await e.step(4);
        const { living, counts } = await snapshot(e);
        assert.equal(living.length, 120);
        assert.ok(living.every((c) => c.energy === 100));
        assert.equal(counts.capacityDeaths, 0);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "doubling overshoot quadruples the penalty on each pressure event",
    async () => {
      const losses = [];
      for (const n of [110, 120]) {
        const e = await setup(n);
        try {
          await e.step();
          const { living, counts } = await snapshot(e);
          assert.equal(living.length, n);
          const hits = living.map((c) => 100 - c.energy).filter((x) => x > 0),
            loss = hits[0];
          assert.ok(hits.length > 0 && hits.length < n);
          assert.ok(hits.every((x) => x === loss));
          assert.ok(Math.abs(loss - (n === 110 ? 0.6 : 2.4)) <= 1 / 4096);
          assert.equal(
            counts.energyBudget.populationPressure,
            loss * hits.length,
          );
          losses.push(loss);
        } finally {
          e.destroy();
        }
      }
      assert.ok(Math.abs(losses[1] / losses[0] - 4) < 0.005);
      measurements.push({ quadraticLosses: losses });
    },
  );
  await check(
    "frequency changes burst size and incidence while preserving mean pressure",
    async () => {
      const stats = [];
      for (const frequency of [2, 20]) {
        const e = await setup(
          120,
          { pressureFrequency: frequency },
          cells(120, 3000),
        );
        try {
          await e.step();
          const first = await snapshot(e),
            losses = first.living.map((c) => 3000 - c.energy),
            hits = losses.filter((x) => x > 0);
          assert.ok(hits.length > 0 && hits.length < 120);
          const expectedBurst = 48 / frequency;
          assert.ok(hits.every((x) => Math.abs(x - expectedBurst) <= 1 / 4096));
          await e.step(239);
          const final = await snapshot(e);
          assert.equal(final.living.length, 120);
          const mean = final.counts.energyBudget.populationPressure / 120;
          assert.ok(
            Math.abs(mean - 192) < 192 * 0.15,
            `frequency${frequency}: mean${mean}`,
          );
          stats.push({
            frequency,
            mean,
            firstTickHits: hits.length,
            burst: hits[0],
          });
        } finally {
          e.destroy();
        }
      }
      assert.ok(stats[0].firstTickHits < stats[1].firstTickHits);
      assert.ok(stats[0].burst > stats[1].burst * 9.99);
      assert.ok(Math.abs(stats[0].mean - stats[1].mean) < 192 * 0.2);
      measurements.push({ frequency: stats });
    },
  );
  await check(
    "lethal pressure records actual energy loss and produces corpses without attack credit",
    async () => {
      const e = await setup(20, { capacity: 10 }, cells(20, 1));
      try {
        await e.step();
        const { rows, counts } = await snapshot(e);
        const deaths = 20 - counts.living;
        assert.ok(deaths > 0 && deaths < 20);
        assert.equal(counts.corpses, Math.min(deaths, 10));
        assert.equal(counts.capacityDeaths, deaths);
        assert.equal(counts.kills, 0);
        assert.equal(counts.energyBudget.populationPressure, deaths);
        assert.equal(counts.energyBudget.turnover, 0);
        assert.equal(counts.energyBudget.attackDamage, 0);
        assert.equal(counts.deaths, deaths);
        assert.ok(rows.filter((c) => c.life === 2).every((c) => c.energy > 0));
        const refs = (await e.genes()).stats;
        assert.equal(refs[0], counts.living);
      } finally {
        e.destroy();
      }
    },
  );
  await check(
    "direct links do not alter pressure events or usable-energy penalties",
    async () => {
      const results = [];
      for (const linked of [false, true]) {
        const e = await setup(
          120,
          { pressureFrequency: 2 },
          cells(120, 100, linked),
        );
        try {
          await e.step(15);
          const r = await snapshot(e);
          results.push(
            r.living
              .map(({ id, energy, storage }) => ({ id, energy, storage }))
              .sort((a, b) => a.id - b.id),
          );
        } finally {
          e.destroy();
        }
      }
      assert.deepEqual(results[0], results[1]);
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-population-pressure-check.json",
    JSON.stringify({ complete: true, checks, measurements }, null, 2),
  );
} finally {
  device.destroy();
  delete globalThis.__pressureGPU;
}
