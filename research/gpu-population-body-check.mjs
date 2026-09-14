// Body arrivals are candidates: admission counts every staged cell, then a
// shared population limit can remove residents and newcomers alike.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree } from "../web/gpu/trees.js";

Object.assign(globalThis, globals);
globalThis.__populationBodyGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __populationBodyGPU.requestAdapter();
assert.ok(adapter, "Native GPU adapter required");
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (event) =>
  errors.push(event.error.message),
);
const Q = 4096;
const base = {
  capacity: 8,
  genomeCapacity: 2,
  initial: 0,
  side: 8,
  treePrograms: 1,
  solarEnabled: 0,
  archiveEnabled: 0,
  floor: 0,
  rate: 0,
  capacityRate: 0,
  forkMutation: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  heatDamage: 0,
  activityHeating: 0,
  sunlightHeating: 0,
  cooling: 0,
  exchange: 0,
  thermalExchange: 0,
  shieldUpkeep: 0,
  springStiffness: 0,
  collisionStiffness: 0,
  linkBarrierStiffness: 0,
  linkBarrierDamping: 0,
  motorImpulse: 0,
  resistCost: 0,
  seedStorage: 0,
  mutation: 0,
  crossover: 0,
};
const idle = parseTree("(wait 1000)");
const inputKeys = [
  "photosynthesis",
  "scavenging",
  "mobilized",
  "giftsReceived",
  "arrivals",
];
const outputKeys = [
  "movement",
  "shields",
  "attacks",
  "reproduction",
  "storage",
  "upkeep",
  "computation",
  "communication",
  "giftsSent",
  "attackDamage",
  "turnover",
];
function chain(size, energy) {
  return Array.from({ length: size }, (_, i) => ({
    x: 32 + (i % 8) * 18,
    y: 32 + Math.floor(i / 8) * 18,
    energy: typeof energy === "function" ? energy(i) : energy,
    storage: 0,
    links: [i ? i : 0, i + 1 < size ? i + 2 : 0, 0, 0],
    anchors: [i ? 0.2 : 0, i + 1 < size ? 0.7 : 0, 0, 0],
  }));
}
async function inspect(engine) {
  const buffer = await engine.state();
  return {
    u: new Uint32Array(buffer),
    f: new Float32Array(buffer),
    counters: await engine.counters(),
    refs: (await engine.genes()).stats,
  };
}
function audit(engine, state) {
  const refs = new Uint32Array(engine.cfg.genomeCapacity);
  let living = 0,
    corpses = 0,
    energy = 0;
  const identities = new Set();
  for (let slot = 0; slot < engine.cfg.capacity; slot++) {
    const k = slot * 52;
    if (state.u[k + 31] === 2) corpses++;
    if (state.u[k + 31] !== 1) continue;
    living++;
    energy += state.f[k + 4] / Q;
    assert.ok(!identities.has(state.u[k + 24]), "Living identities are unique");
    identities.add(state.u[k + 24]);
    refs[state.u[k + 25]]++;
    for (const handle of state.u.slice(k + 32, k + 36)) {
      if (!handle) continue;
      assert.ok(
        handle <= engine.cfg.capacity,
        "No candidate-tail links survive materialization",
      );
      assert.equal(state.u[(handle - 1) * 52 + 31], 1);
      assert.ok(
        state.u
          .slice((handle - 1) * 52 + 32, (handle - 1) * 52 + 36)
          .includes(slot + 1),
        "Surviving links remain reciprocal",
      );
    }
  }
  assert.ok(living + corpses <= engine.cfg.capacity);
  assert.equal(living, state.counters.living);
  assert.equal(corpses, state.counters.corpses);
  assert.equal(
    living,
    state.counters.randomArrivals +
      state.counters.sampledArrivals +
      state.counters.births -
      state.counters.deaths,
  );
  for (let gene = 0; gene < refs.length; gene++)
    assert.equal(refs[gene], state.refs[gene * 4], `Genome ${gene} references`);
  const budget = state.counters.energyBudget;
  const balance =
    inputKeys.reduce((sum, key) => sum + budget[key], 0) -
    outputKeys.reduce((sum, key) => sum + budget[key], 0);
  assert.ok(
    Math.abs(balance - energy) <= 1 / Q,
    `Usable energy balance ${balance} matches population ${energy}`,
  );
  return { living, corpses, energy, identities: [...identities] };
}
async function check(name, fn) {
  const detail = await fn();
  checks.push({ name, ...detail });
  assert.deepEqual(errors, []);
  console.log("PASS", name);
}
async function withEngine(config, fn) {
  const engine = await createLifeEngine(device, { ...base, ...config });
  try {
    return await fn(engine);
  } finally {
    engine.destroy();
  }
}
try {
  await check(
    "A low-energy newcomer is staged, counted and culled without immunity",
    () =>
      withEngine({}, async (engine) => {
        await engine.fixture({
          programs: [{ tree: idle }],
          cells: chain(8, 1000),
        });
        const before = await inspect(engine);
        const result = await engine.admitBody({
          programs: [{ tree: idle }],
          cells: [{ x: 100, y: 100, energy: 1 / Q, storage: 0 }],
        });
        const after = await inspect(engine);
        audit(engine, after);
        assert.equal(result.admitted, 1);
        assert.equal(result.survived, 0);
        assert.deepEqual(result.cellSlots, []);
        assert.equal(
          after.counters.randomArrivals - before.counters.randomArrivals,
          1,
        );
        assert.equal(after.counters.deaths - before.counters.deaths, 1);
        assert.equal(
          after.counters.energyBudget.arrivals -
            before.counters.energyBudget.arrivals,
          1 / Q,
        );
        assert.equal(
          after.counters.energyBudget.turnover -
            before.counters.energyBudget.turnover,
          1 / Q,
        );
        assert.deepEqual(
          after.u,
          before.u,
          "Residents survive unchanged when the low-energy newcomer loses",
        );
        return { result, counters: after.counters };
      }),
  );
  await check(
    "A high-energy newcomer can displace a resident at full capacity",
    () =>
      withEngine({}, async (engine) => {
        await engine.fixture({
          programs: [{ tree: idle }],
          cells: chain(8, 1 / Q),
        });
        const result = await engine.admitBody({
          programs: [{ tree: idle }],
          cells: [{ x: 100, y: 100, energy: 1000, storage: 0 }],
        });
        const after = await inspect(engine);
        const summary = audit(engine, after);
        assert.equal(result.admitted, 1);
        assert.equal(result.survived, 1);
        assert.ok(summary.identities.includes(result.identities[0]));
        assert.equal(summary.identities.filter((id) => id <= 8).length, 7);
        assert.equal(after.counters.deaths, 1);
        return { result, counters: after.counters };
      }),
  );
  await check(
    "64-cell body fits N8/G2 staging, counts culled candidates, remaps links and starts fresh",
    () =>
      withEngine({}, async (engine) => {
        const dirty = parseTree("(seq (resist 1) (set m0 7) (wait 1000))");
        await engine.fixture({
          programs: [{ tree: dirty }],
          cells: chain(8, 1 / Q).map((cell) => ({
            ...cell,
            memory: [17, 18, 19],
            registers: Array(8).fill(13),
            age: 100,
            generation: 3,
            shield: 4,
            temperature: 30,
          })),
        });
        await engine.step(1);
        assert.equal(
          await engine.cellResistance(0),
          1,
          "Resident resistance is dirty before reuse",
        );
        for (let slot = 0; slot < 8; slot++) {
          device.queue.writeBuffer(
            engine.currentState,
            (slot * 52 + 16) * 4,
            new Float32Array(8).fill(91),
          );
          device.queue.writeBuffer(
            engine.currentState,
            (slot * 52 + 40) * 4,
            new Uint32Array(4).fill(1),
          );
        }
        const before = await inspect(engine);
        const result = await engine.admitBody({
          programs: [{ tree: idle }],
          cells: chain(64, (i) => (i < 8 ? 1000 : 1 / Q)),
        });
        assert.equal(result.admitted, 64);
        assert.equal(result.candidateSlots.length, 64);
        assert.equal(result.survived, 8);
        const after = await inspect(engine);
        const summary = audit(engine, after);
        assert.equal(
          after.counters.randomArrivals - before.counters.randomArrivals,
          64,
        );
        assert.equal(after.counters.deaths - before.counters.deaths, 64);
        assert.equal(
          after.counters.energyBudget.arrivals -
            before.counters.energyBudget.arrivals,
          8000 + 56 / Q,
        );
        assert.equal(
          after.counters.energyBudget.turnover -
            before.counters.energyBudget.turnover,
          64 / Q,
        );
        assert.deepEqual(
          new Set(summary.identities),
          new Set(result.identities.slice(0, 8)),
        );
        const memory = await engine.treeMemory();
        const byIdentity = new Map(
          result.cellSlots.map((slot) => [after.u[slot * 52 + 24], slot]),
        );
        for (let index = 0; index < 8; index++) {
          const slot = byIdentity.get(result.identities[index]);
          const k = slot * 52;
          const expectedLinks = [
            index ? byIdentity.get(result.identities[index - 1]) + 1 : 0,
            index < 7 ? byIdentity.get(result.identities[index + 1]) + 1 : 0,
            0,
            0,
          ];
          assert.deepEqual([...after.u.slice(k + 32, k + 36)], expectedLinks);
          assert.deepEqual(
            [...after.f.slice(k + 8, k + 24)],
            Array(16).fill(0),
            "Registers, broadcasts and mailbox are fresh",
          );
          assert.deepEqual(
            [...after.u.slice(k + 40, k + 44)],
            Array(4).fill(0),
            "Sender identities are fresh",
          );
          assert.deepEqual(
            [...memory.slice(slot * 12, slot * 12 + 12)],
            Array(12).fill(0),
            "User memory and initialization flags are fresh",
          );
          assert.deepEqual(
            [...after.u.slice(k + 26, k + 31)],
            Array(5).fill(0),
            "PC, sleep, age, generation and parent are fresh",
          );
          assert.equal(after.f[k + 7], 0);
          assert.equal(after.f[k + 39], engine.cfg.ambientTemperature);
          assert.equal(await engine.cellResistance(slot), 0);
        }
        await engine.step(1);
        audit(engine, await inspect(engine));
        return { result, counters: after.counters };
      }),
  );
  await check(
    "Automatic bodies process ordinary plus at-capacity arrivals beyond a small staging tail",
    () =>
      withEngine(
        {
          bodyShare: 1,
          bodyPreserveLinks: 1,
          bodyMaxCells: 8,
          bodyCaptureSeconds: 1,
          archiveEnabled: 1,
          archiveAge: 0,
          archiveHarvest: 0,
          archiveOffspring: 0,
          rate: 8,
          capacityRate: 128,
          seedEnergy: 1 / Q,
          share: 1,
        },
        async (engine) => {
          await engine.fixture({
            programs: [{ tree: idle }],
            cells: chain(8, 1000),
          });
          const samples = [];
          for (let second = 1; second <= 2; second++) {
            await engine.step(60);
            const after = await inspect(engine);
            audit(engine, after);
            const stats = engine.bodyStats();
            assert.ok(
              stats.archived > 0,
              "A reciprocal resident body was archived",
            );
            assert.equal(
              stats.admitted,
              136 * second,
              "All ordinary8 + at-capacity128 cells per second are staged despite tail64 and G2",
            );
            assert.equal(stats.bodyCells, 136 * second);
            assert.equal(after.counters.sampledArrivals, 136 * second);
            assert.equal(after.counters.randomArrivals, 8);
            assert.equal(after.counters.deaths, 136 * second);
            assert.equal(
              after.counters.energyBudget.arrivals,
              8000 + (136 * second) / Q,
            );
            assert.equal(
              after.counters.energyBudget.turnover,
              (136 * second) / Q,
            );
            samples.push({ second, stats, counters: after.counters });
          }
          return { samples };
        },
      ),
  );
  await check(
    "Genome exhaustion limits admission without silently removing residents",
    () =>
      withEngine(
        {
          genomeCapacity: 1,
          bodyShare: 1,
          bodyMaxCells: 8,
          bodyCaptureSeconds: 1,
          archiveEnabled: 1,
          archiveAge: 0,
          archiveHarvest: 0,
          archiveOffspring: 0,
          rate: 8,
          capacityRate: 128,
          seedEnergy: 1 / Q,
          share: 1,
        },
        async (engine) => {
          await engine.fixture({
            programs: [{ tree: idle }],
            cells: chain(8, 1000),
          });
          await engine.step(60);
          const after = await inspect(engine);
          audit(engine, after);
          assert.equal(engine.bodyStats().admitted, 0);
          assert.equal(after.counters.living, 8);
          assert.equal(after.counters.deaths, 0);
          assert.equal(after.counters.energyBudget.arrivals, 8000);
          assert.equal(after.counters.energyBudget.turnover, 0);
          const result = await engine.admitBody({
            programs: [{ tree: idle }],
            cells: chain(8, 10),
          });
          assert.equal(result.admitted, 0);
          assert.equal(result.reason, "genome capacity");
          return {
            result,
            stats: engine.bodyStats(),
            counters: after.counters,
          };
        },
      ),
  );
  await device.queue.onSubmittedWorkDone();
  assert.deepEqual(errors, []);
  const output = process.argv[2];
  if (output)
    await writeFile(
      output,
      JSON.stringify(
        {
          complete: true,
          scope:
            "Mechanics fixtures, not ecological performance or evolutionary fitness evidence.",
          checks,
        },
        null,
        2,
      ) + "\n",
    );
} finally {
  device.destroy();
  delete globalThis.__populationBodyGPU;
}
