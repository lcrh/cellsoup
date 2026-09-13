import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree, mutateTree, treeRng } from "../web/gpu/trees.js";
Object.assign(globalThis, globals);
globalThis.__modelGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __modelGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacityRate: 0,
  capacity: 16,
  genomeCapacity: 8,
  initial: 0,
  side: 8,
  sources: 1,
  treePrograms: 0,
  forkMutation: 0,
  rate: 0,
  floor: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  exchange: 0,
  solarEnabled: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  solarRate: 6,
  eatCost: 0,
  attackCost: 0,
  attackDamageCost: 1,
  attackEfficiency: 1,
  shieldUpkeep: 0,
  linkCost: 0,
  jitter: 0,
};
async function run(programs, cells, { ticks = 1, sunlight = 1, ...cfg } = {}) {
  const e = await createLifeEngine(device, { ...base, ...cfg });
  try {
    await e.fixture({ programs, cells, sunlight });
    await e.step(ticks);
    const state = await e.state(),
      f = new Float32Array(state),
      u = new Uint32Array(state);
    return { f: [...f], u: [...u], counters: await e.counters() };
  } finally {
    e.destroy();
  }
}
function near(a, b, tol = 1 / 4096) {
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
}
try {
  const paid = await run(["loop: add r0 1\njmp loop"], [{ energy: 70 }], {
    ticks: 100,
    cpuCost: 0.00005,
    budget: 24,
  });
  near(paid.f[8], 1200);
  near(70 - paid.f[4] / 4096, 2400 * 0.00005);
  checks.push(
    "default subquantum CPU fee accumulates across2400instructions without minimum-charge inflation",
  );
  const unpaid = await run(
    ["loop: add r0 1\njmp loop"],
    [{ energy: 1 / 4096 }],
    { ticks: 100, cpuCost: 0.00005, budget: 24 },
  );
  assert.equal(unpaid.f[8], 2);
  near(unpaid.f[4] / 4096, 1 / 4096);
  checks.push(
    "unaffordable CPU call leaves reserve and cannot advance program effects",
  );
  for (const [program, field, cells] of [
    ["photosynthesize r0\nwait 1000", "photoEfficiency", [{ energy: 20 }]],
    [
      "eat r0\nwait 1000",
      "scavengeEfficiency",
      [
        { energy: 20, x: 100, y: 100 },
        { energy: 30, x: 108, y: 100, corpse: true },
      ],
    ],
    [
      "mobilize r0 3\nwait 1000",
      "mobilizeEfficiency",
      [{ energy: 20, storage: 30 }],
    ],
  ]) {
    const full = await run([program], cells),
      half = await run([program], cells, { [field]: 0.5 });
    near(half.f[8], full.f[8] * 0.5);
    if (field === "mobilizeEfficiency") near(half.f[38], full.f[38], 0.01);
    if (field === "scavengeEfficiency") near(half.f[56], full.f[56], 0.01);
    checks.push(field + " changes credit while preserving gross debit");
  }
  const motor = await run(["move 1\nwait 1000"], [{ x: 100, y: 100 }], {
    motorImpulse: 10,
    dragRetention: 1,
  });
  near(motor.f[2], 10);
  const still = await run(["move 1\nwait 1000"], [{ x: 100, y: 100 }], {
    motorImpulse: 0,
  });
  near(still.f[2], 0);
  checks.push("motor impulse and drag");
  const springCells = [
    { x: 100, y: 100, links: [2, 0, 0, 0] },
    { x: 130, y: 100, links: [1, 0, 0, 0] },
  ];
  const noSpring = await run(["wait 1000"], springCells, {
    springStiffness: 0,
  });
  near(noSpring.f[2], 0);
  const shortSpring = await run(["wait 1000"], springCells, {
      springRestDistance: 10,
    }),
    longSpring = await run(["wait 1000"], springCells, {
      springRestDistance: 30,
    });
  assert.ok(shortSpring.f[2] > longSpring.f[2]);
  checks.push("spring stiffness and rest length");
  const overlapping = [
    { x: 100, y: 100 },
    { x: 112, y: 100 },
  ];
  const small = await run(["wait 1000"], overlapping, {
      collisionDistance: 10,
    }),
    large = await run(["wait 1000"], overlapping, { collisionDistance: 16 });
  near(small.f[2], 0);
  assert.ok(large.f[2] < 0);
  const soft = await run(["wait 1000"], overlapping, {
    collisionDistance: 16,
    collisionStiffness: 0,
  });
  near(soft.f[2], 0);
  checks.push("collision distance and stiffness");
  const attackCells = [
    { x: 100, y: 100, energy: 70 },
    { x: 112, y: 100, energy: 70, shield: 1, genome: 1 },
  ];
  const unshielded = await run(
      ["attack 2 20\nwait 1000", "wait 1000"],
      attackCells,
      { shieldProtection: 0, attackAmountMax: 10 },
    ),
    shielded = await run(["attack 2 20\nwait 1000", "wait 1000"], attackCells, {
      shieldProtection: 1,
      attackAmountMax: 10,
    });
  near(unshielded.f[56] / 4096, 60, 2 / 4096);
  near(shielded.f[56] / 4096, 61);
  checks.push("maximum attack amount and shield effectiveness");
  const corpse = [
    { x: 100, y: 100, energy: 20 },
    { x: 125, y: 100, corpse: true, energy: 30 },
  ];
  const distant = await run(["eat r0\nwait 1000"], corpse, {
    interactionRadius: 32,
    eatAmount: 10,
  });
  near(distant.f[8], 10, 2 / 4096);
  checks.push("feeding radius and bite size");
  const linked = await run(
    ["link 2\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100 },
      { x: 128, y: 100, genome: 1 },
    ],
    { linkRange: 32 },
  );
  assert.equal(linked.u[32], 2);
  checks.push("link formation radius");
  const opts = {
    ...base,
    treePrograms: 1,
    forkMutation: 1,
    mutationOrdinary: 0,
    mutationGuard: 1,
    loopYield: 0,
  };
  const e = await createLifeEngine(device, opts);
  try {
    const parent = parseTree("(seq (bud) (wait 1000))");
    await e.fixture({ programs: [{ tree: parent }], cells: [{ energy: 120 }] });
    await e.step(16);
    const buf = await e.state(),
      u = new Uint32Array(buf);
    const child = Array.from({ length: 16 }, (_, i) => i).find(
      (i) => u[i * 52 + 30],
    );
    assert.ok(child !== undefined);
    const rngSeed = e.cfg.seed ^ u[child * 52 + 24] ^ Math.imul(1, 0x85ebca6b);
    const expected = mutateTree(parent, treeRng(rngSeed), e.cfg);
    assert.notDeepEqual(expected, mutateTree(parent, treeRng(rngSeed)));
    assert.deepEqual((await e.genome(u[child * 52 + 25])).tree, expected);
    checks.push(
      "fork mutation uses configured operator weights and feature palette",
    );
  } finally {
    e.destroy();
  }
  const barrierCells = [
    { x: 90, y: 100, links: [2, 0, 0, 0] },
    { x: 110, y: 100, links: [1, 0, 0, 0] },
    { x: 100, y: 104 },
  ];
  const barrier = await run(["wait 1000"], barrierCells),
    permeable = await run(["wait 1000"], barrierCells, { linkBarrierWidth: 0 }),
    noBarrierForce = await run(["wait 1000"], barrierCells, {
      linkBarrierStiffness: 0,
      linkBarrierDamping: 0,
    });
  assert.ok(barrier.f[107] > 0);
  near(permeable.f[107], 0);
  near(noBarrierForce.f[107], 0);
  const moving = barrierCells.map((c, i) => ({ ...c, vy: i === 2 ? -10 : 0 }));
  const damping = await run(["wait 1000"], moving, {
      linkBarrierStiffness: 0,
      linkBarrierDamping: 5,
    }),
    noDamping = await run(["wait 1000"], moving, {
      linkBarrierStiffness: 0,
      linkBarrierDamping: 0,
    });
  assert.ok(damping.f[107] > noDamping.f[107]);
  checks.push("link barrier width, stiffness and damping");
  const cap = await run(
    ["mobilize r0 500\nwait 1000"],
    [{ energy: 400, storage: 400 }],
    { energyCapacity: 500 },
  );
  near(cap.f[4] / 4096, 500);
  near(cap.f[38] / 4096, 300);
  const gifts = await run(
    ["give 2 1\nwait 1000", "wait 1000"],
    [
      { x: 100, y: 100, energy: 400 },
      { x: 112, y: 100, energy: 490, genome: 1 },
    ],
    { energyCapacity: 500 },
  );
  near(gifts.f[56] / 4096, 500, 2 / 4096);
  near((gifts.f[4] + gifts.f[56]) / 4096, 890);
  checks.push(
    "configurable energy capacity bounds conversion and contested transfers",
  );
  const bodyEngine = await createLifeEngine(device, {
    ...base,
    treePrograms: 1,
    energyCapacity: 500,
    seedEnergy: 300,
  });
  try {
    const result = await bodyEngine.admitBody({
      programs: [{ tree: parseTree("(wait 1000)") }],
      cells: [{ x: 100, y: 100, energy: 300 }],
    });
    assert.equal(result.admitted, 1);
    const state = new Float32Array(await bodyEngine.state());
    near(state[result.cellSlots[0] * 52 + 4] / 4096, 300);
    await assert.rejects(
      bodyEngine.admitBody({
        programs: [{ tree: parseTree("(wait 1000)") }],
        cells: [{ x: 100, y: 100, energy: 501 }],
      }),
      /Invalid body cell/,
    );
    checks.push("body admissions use configured per-cell energy capacity");
  } finally {
    bodyEngine.destroy();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-model-controls-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ checks }));
} finally {
  device.destroy();
  delete globalThis.__modelGPU;
}
