// Test the previously observed genotype with variable light and a deliberately
// introduced non-giving neighbor. These are controlled fixtures, not founders
// injected into the default evolutionary world.
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { compileTree } from "../web/gpu/trees.js";
import { observeColonies } from "./colony-observation.mjs";

const [
  input,
  output,
  guard = "none",
  lightChoice = "both",
  conditionChoice = "all",
] = process.argv.slice(2);
assert.ok(["none", "alive", "kin"].includes(guard));
assert.ok(["both", "full", "clouds"].includes(lightChoice));
const lights = lightChoice === "both" ? ["full", "clouds"] : [lightChoice];
const allConditions = [
  "giving",
  "non-giving",
  "recipient-invader",
  "other-invader",
];
const conditions =
  conditionChoice === "all" ? allConditions : conditionChoice.split(",");
assert.ok(
  conditions.length && conditions.every((c) => allConditions.includes(c)),
);
if (!input || !output)
  throw Error(
    "Usage: node research/colony-invasion-probe.mjs gift-probe.json output.json",
  );
const source = JSON.parse(await readFile(input, "utf8"));
assert.ok(source.sourceGenome?.tree && source.mutedTree);
function guarded(kind) {
  const tree = structuredClone(source.sourceGenome.tree);
  const gift = tree.args[0];
  assert.equal(gift.op, "give");
  tree.args[0] = {
    op: "if",
    args: [
      { op: kind, args: [structuredClone(gift.args[0])] },
      gift,
      { op: "nop", args: [] },
    ],
  };
  return tree;
}
const givingTree = guard === "none" ? source.sourceGenome.tree : guarded(guard);
const aliveCode = compileTree(guarded("alive")),
  kinCode = compileTree(guarded("kin"));
assert.equal(aliveCode.length, kinCode.length);
assert.equal(
  kinCode.source.replace(/ kin(?=\n|$)/g, " alive"),
  aliveCode.source,
);
Object.assign(globalThis, globals);
globalThis.__invasionGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__invasionGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));

function founders(condition) {
  const cells = [
    { x: 1024, y: 1024, links: [2, 3, 4, 0], anchors: [0, 1 / 3, 2 / 3, 0] },
  ];
  for (let i = 0; i < 3; i++)
    cells.push({
      x: 1024 + 16 * Math.cos((i * Math.PI * 2) / 3),
      y: 1024 + 16 * Math.sin((i * Math.PI * 2) / 3),
      links: [1, 0, 0, 0],
      anchors: [(i / 3 + 0.5) % 1, 0, 0, 0],
    });
  cells.forEach((c, i) =>
    Object.assign(c, {
      energy: 24,
      storage: 0,
      heading: 0,
      genome: Number(
        condition === "non-giving" ||
          (condition === "recipient-invader" && i === 3) ||
          (condition === "other-invader" && i === 1),
      ),
    }),
  );
  return cells;
}
const trials = [];
const report = {
  sourceAssay: input,
  sourceGenome: source.sourceGenome,
  guard,
  testedGivingTree: givingTree,
  instructions: {
    original: compileTree(source.sourceGenome.tree).length,
    tested: compileTree(givingTree).length,
  },
  nonGivingTree: source.mutedTree,
  scope:
    "Three seeds per condition, 600 simulated seconds. Four fresh cells in an explicitly constructed star, 24 energy each, zero reserves, normal physics and costs, no arrivals or mutation. c2 of the central cell points to leaf 3. Non-giving differs only in the previously verified gift-fraction expression. Homogeneous controls contain four givers or four non-givers. Mixed cases replace either the targeted leaf or another leaf with a non-giver. Full light is constant one; clouds use the ordinary time-varying model. An optional guard wraps the giving action in an alive or kin condition with a nop alternative; these two guard programs have identical bytecode except for the sensed field. Guards are authored controls, not evolved discoveries. This is a deliberately founded invasion assay, not spontaneous invasion or an exact restart of the observed colony. Kernel allocation can make same-seed repeats differ.",
  trials,
  complete: false,
};
async function checkpoint() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(output + ".tmp", output);
}
try {
  for (const light of lights)
    for (const seed of [42, 97, 321]) {
      for (const condition of conditions) {
        const engine = await createLifeEngine(device, {
          treePrograms: 1,
          capacity: 4096,
          genomeCapacity: 2,
          initial: 0,
          floor: 0,
          rate: 0,
          side: 64,
          sources: 1,
          seed,
          solarEnabled: Number(light === "clouds"),
          archiveEnabled: 0,
        });
        try {
          const cells = founders(condition);
          await engine.fixture({
            programs: [{ tree: givingTree }, { tree: source.mutedTree }],
            cells,
            sunlight: 1,
          });
          const records = [];
          for (let seconds = 0; seconds <= 600; seconds++) {
            if (seconds % 60 === 0) {
              const counters = await engine.counters();
              delete counters.raw;
              const state = await engine.state(),
                f = new Float32Array(state),
                u = new Uint32Array(state);
              const living = [0, 0],
                energy = [0, 0],
                lightSum = [0, 0],
                thirdLinks = [0, 0];
              let mixedLinks = 0;
              for (let i = 0; i < engine.cfg.capacity; i++)
                if (u[i * 52 + 31] === 1) {
                  const k = i * 52,
                    g = u[k + 25];
                  assert.ok(g < 2);
                  living[g]++;
                  energy[g] += f[k + 4] / 4096;
                  lightSum[g] += f[k + 37];
                  thirdLinks[g] += Number(u[k + 34] !== 0);
                  for (let e = 0; e < 4; e++) {
                    const j = u[k + 32 + e] - 1;
                    if (
                      j > i &&
                      j < engine.cfg.capacity &&
                      u[j * 52 + 25] !== g
                    )
                      mixedLinks++;
                  }
                }
              assert.equal(living[0] + living[1], counters.living);
              assert.equal(
                counters.living,
                4 + counters.births - counters.deaths,
              );
              const genes = await engine.genes();
              assert.equal(genes.stats[0], living[0]);
              assert.equal(genes.stats[4], living[1]);
              records.push({
                seconds,
                ...counters,
                giving: living[0],
                nonGiving: living[1],
                birthsByType: [genes.stats[1], genes.stats[5]],
                energy,
                thirdLinks,
                mixedLinks,
                meanLight: lightSum.map((n, g) =>
                  living[g] ? n / living[g] : null,
                ),
                colonies: observeColonies(state, engine.cfg.side * 32, 0),
              });
            }
            if (seconds < 600) await engine.step(60);
          }
          assert.deepEqual(errors, []);
          trials.push({
            light,
            seed,
            condition,
            config: engine.cfg,
            fixture: cells,
            kernel: engine.fingerprint,
            records,
          });
          await checkpoint();
          const end = records.at(-1);
          console.log(
            JSON.stringify({
              light,
              seed,
              condition,
              giving: end.giving,
              nonGiving: end.nonGiving,
              birthsByType: end.birthsByType,
            }),
          );
        } finally {
          engine.destroy();
        }
      }
    }
  report.complete = true;
  await checkpoint();
} finally {
  device.destroy();
  delete globalThis.__invasionGPU;
}
