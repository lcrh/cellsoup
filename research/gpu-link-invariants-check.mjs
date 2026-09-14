import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, globals);
globalThis.__linkGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __linkGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const base = {
  capacity: 8,
  genomeCapacity: 8,
  initial: 0,
  side: 8,
  sources: 1,
  treePrograms: 0,
  forkMutation: 0,
  rate: 0,
  floor: 0,
  capacityRate: 0,
  pressureStrength: 0,
  upkeep: 0,
  energyDecay: 0,
  cpuCost: 0,
  exchange: 0,
  shieldExchange: 0,
  solarEnabled: 0,
  solarRate: 0,
  sunlightHeating: 0,
  activityHeating: 0,
  heatDamage: 0,
  cooling: 0,
  archiveEnabled: 0,
  energyFillScale: 0,
  storageFillScale: 0,
  linkCost: 0,
};
async function run(programs, cells, config = {}) {
  const e = await createLifeEngine(device, { ...base, ...config });
  try {
    await e.fixture({ programs, cells });
    await e.step();
    const b = await e.state(),
      u = new Uint32Array(b),
      f = new Float32Array(b);
    return Array.from({ length: e.entityCapacity }, (_, i) => ({
      life: u[i * 52 + 31],
      links: [...u.slice(i * 52 + 32, i * 52 + 36)],
      anchors: [...f.slice(i * 52 + 44, i * 52 + 48)],
    }));
  } finally {
    e.destroy();
  }
}
function valid(c) {
  for (let i = 0; i < c.length; i++) {
    const links = c[i].links.filter(Boolean);
    assert.equal(new Set(links).size, links.length);
    for (let k = 0; k < 4; k++) {
      const h = c[i].links[k];
      if (!h) {
        assert.equal(c[i].anchors[k], 0);
        continue;
      }
      assert.ok(h !== i + 1 && h <= c.length);
      assert.equal(c[h - 1].life, 1);
      assert.ok(c[h - 1].links.includes(i + 1));
    }
  }
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
const pair = [
  { x: 100, y: 100, links: [2, 0, 0, 0] },
  { x: 118, y: 100, genome: 1, links: [1, 0, 0, 0], anchors: [0.5, 0, 0, 0] },
];
try {
  const after = await run(["unlink 0\nlink 2\nwait 1000", "wait 1000"], pair);
  if (process.argv.includes("--baseline")) {
    assert.deepEqual(after[0].links, [2, 0, 0, 0]);
    assert.deepEqual(after[1].links, [1, 1, 0, 0]);
    console.log(
      "CONFIRMED baseline same-tick unlink/relink creates duplicate target edges",
      JSON.stringify(after.slice(0, 2)),
    );
  } else {
    await check(
      "same-tick unlink and relink cannot duplicate the target backlink",
      async () => {
        valid(after);
        assert.ok(after.every((c) => c.links.every((h) => !h)));
      },
    );
    await check(
      "pruning removes malformed self, duplicate, and out-of-range edges and clears their anchors",
      async () => {
        const c = await run(
          ["wait 1000"],
          [
            {
              x: 100,
              y: 100,
              links: [1, 2, 2, 9999],
              anchors: [0.1, 0.2, 0.3, 0.4],
            },
            { x: 118, y: 100, links: [1, 0, 0, 0], anchors: [0.5, 0, 0, 0] },
          ],
        );
        valid(c);
        assert.deepEqual(c[0].links, [0, 2, 0, 0]);
        assert.deepEqual(c[1].links, [1, 0, 0, 0]);
      },
    );
    await check(
      "normal mutual link requests still create exactly one reciprocal edge",
      async () => {
        const c = await run(
          ["link 2\nwait 1000", "link 1\nwait 1000"],
          [
            { x: 100, y: 100 },
            { x: 118, y: 100, genome: 1 },
          ],
        );
        valid(c);
        assert.equal(c.flatMap((x) => x.links).filter(Boolean).length, 2);
      },
    );
    await check(
      "same-tick death cannot leave a backlink or recreate a link to remains",
      async () => {
        const c = await run(
          ["unlink 0\nlink 2\nwait 1000", "wait 1000"],
          pair.map((c, i) => ({ ...c, energy: i ? 1 / 4096 : 100 })),
          { upkeep: 1, corpseEnergy: 8 },
        );
        valid(c);
        assert.equal(c[1].life, 2);
        assert.ok(c.every((c) => c.links.every((h) => !h)));
      },
    );
    assert.deepEqual(errors, []);
    await writeFile(
      "/private/tmp/cellsoup-link-invariants-check.json",
      JSON.stringify({ pass: true, checks, errors }, null, 2),
    );
  }
} finally {
  device.destroy();
}
