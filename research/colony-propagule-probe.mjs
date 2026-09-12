// Controlled founder-topology assay for a naturally generated genotype.
// This does not insert an authored organism into the evolutionary population.
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { compileTree } from "../web/gpu/trees.js";
import {
  readCellActivity,
  summarizeColonyActivity,
} from "./colony-activity.mjs";
import { observeColonies } from "./colony-observation.mjs";

const [input, output, lightChoice = "both"] = process.argv.slice(2);
if (!input || !output || !["both", "dim", "clouds"].includes(lightChoice))
  throw Error(
    "Usage: node research/colony-propagule-probe.mjs gift-probe.json output.json [both|dim|clouds]",
  );
const source = JSON.parse(await readFile(input, "utf8"));
assert.ok(source.sourceGenome?.tree && source.mutedTree);
assert.equal(
  compileTree(source.sourceGenome.tree).length,
  compileTree(source.mutedTree).length,
);
function founders(mode) {
  const totalEnergy = 96;
  if (mode === "single")
    return [{ x: 1024, y: 1024, energy: totalEnergy, storage: 0, heading: 0 }];
  const radius = mode === "dispersed" ? 80 : 16;
  const cells = [{ x: 1024, y: 1024 }];
  for (let i = 0; i < 3; i++)
    cells.push({
      x: 1024 + radius * Math.cos((i * 2 * Math.PI) / 3),
      y: 1024 + radius * Math.sin((i * 2 * Math.PI) / 3),
    });
  for (const c of cells)
    Object.assign(c, {
      energy: totalEnergy / 4,
      storage: 0,
      heading: 0,
      links: [0, 0, 0, 0],
      anchors: [0, 0, 0, 0],
    });
  if (mode === "connected") {
    cells[0].links = [2, 3, 4, 0];
    cells[0].anchors = [0, 1 / 3, 2 / 3, 0];
    for (let i = 0; i < 3; i++) {
      cells[i + 1].links = [1, 0, 0, 0];
      cells[i + 1].anchors = [(i / 3 + 0.5) % 1, 0, 0, 0];
    }
  }
  assert.equal(
    cells.reduce((sum, c) => sum + c.energy, 0),
    totalEnergy,
  );
  return cells;
}
const linked = founders("connected"),
  cluster = founders("cluster");
assert.deepEqual(
  linked.map(({ links, anchors, ...c }) => c),
  cluster.map(({ links, anchors, ...c }) => c),
);
const report = {
  sourceGenome: source.sourceGenome,
  nonGivingTree: source.mutedTree,
  scope:
    "Three seeds per condition. 600 simulated seconds, total initial usable energy 96, zero stored reserves, same genotype and fresh program/memory state. Single cell starts with 96 energy; groups start with four cells at 24 each. Connected and unconnected cluster have identical positions, headings and cell count; only links and their anchors differ. Dispersed cells begin 80 units from the center. Single versus group also differs in biomass and number of metabolic bodies, so it is not a topology-only contrast. Dim light is uniform 0.6; clouds use ordinary dynamic sunlight, initialized at 0.6. No arrivals or mutation; normal costs, physics, heat and corpse ecology. Original and zero-gift variant were previously verified to differ in one compiled instruction. These constructed fixtures test a possible resampling bottleneck, not spontaneous group reproduction or inherited morphology. GPU allocation may make same-seed repeats differ.",
  trials: [],
  complete: false,
};
async function checkpoint() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(output + ".tmp", output);
}
Object.assign(globalThis, globals);
globalThis.__propaguleGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__propaguleGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
try {
  for (const light of lightChoice === "both"
    ? ["dim", "clouds"]
    : [lightChoice])
    for (const seed of [42, 97, 321])
      for (const genotype of ["giving", "non-giving"])
        for (const mode of ["single", "cluster", "connected", "dispersed"]) {
          const engine = await createLifeEngine(device, {
            treePrograms: 1,
            capacity: 4096,
            genomeCapacity: 1,
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
            const cells = founders(mode),
              tree =
                genotype === "giving"
                  ? source.sourceGenome.tree
                  : source.mutedTree,
              records = [];
            await engine.fixture({
              programs: [{ tree }],
              cells,
              sunlight: 0.6,
            });
            for (let seconds = 0; seconds <= 600; seconds++) {
              if (seconds % 60 === 0) {
                const counters = await engine.counters();
                delete counters.raw;
                const state = await engine.state(),
                  u = new Uint32Array(state),
                  f = new Float32Array(state),
                  activity = await readCellActivity(device, engine);
                let living = 0,
                  thirdLinks = 0,
                  energy = 0;
                for (let i = 0; i < engine.cfg.capacity; i++)
                  if (u[i * 52 + 31] === 1) {
                    living++;
                    thirdLinks += Number(u[i * 52 + 34] !== 0);
                    energy += f[i * 52 + 4] / 4096;
                    assert.ok(
                      Number.isFinite(f[i * 52]) &&
                        Number.isFinite(f[i * 52 + 1]) &&
                        Number.isFinite(f[i * 52 + 39]),
                    );
                    assert.ok(f[i * 52 + 4] >= 0 && f[i * 52 + 4] <= 819200);
                    for (let e = 0; e < 4; e++) {
                      const neighbor = u[i * 52 + 32 + e] - 1;
                      if (neighbor < 0) continue;
                      assert.ok(
                        neighbor < engine.cfg.capacity &&
                          u[neighbor * 52 + 31] === 1,
                      );
                      assert.ok(
                        [
                          ...u.slice(neighbor * 52 + 32, neighbor * 52 + 36),
                        ].includes(i + 1),
                      );
                    }
                  }
                assert.equal(living, counters.living);
                assert.equal(
                  living,
                  cells.length + counters.births - counters.deaths,
                );
                const genes = await engine.genes();
                assert.equal(genes.stats[0], living);
                records.push({
                  seconds,
                  ...counters,
                  thirdLinks,
                  energy,
                  ...summarizeColonyActivity(
                    state,
                    activity,
                    engine.tick,
                    engine.cfg.side * 32,
                  ),
                  colonies: observeColonies(state, engine.cfg.side * 32, 0),
                });
              }
              if (seconds < 600) await engine.step(60);
            }
            assert.deepEqual(errors, []);
            report.trials.push({
              light,
              seed,
              genotype,
              mode,
              config: engine.cfg,
              kernel: engine.fingerprint,
              fixture: cells,
              records,
            });
            await checkpoint();
            const r = records.at(-1);
            console.log(
              JSON.stringify({
                light,
                seed,
                genotype,
                mode,
                living: r.living,
                births: r.births,
                movingWithThrust: r.movingBodyCellsWithRecentThrust,
              }),
            );
          } finally {
            engine.destroy();
          }
        }
  report.complete = true;
  await checkpoint();
} finally {
  device.destroy();
  delete globalThis.__propaguleGPU;
}
