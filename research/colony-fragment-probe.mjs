// Regrow an evolved genome, extract observed geometry, and compare connected
// versus disconnected fragments. No hand-built fragment topology is used.
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { treeRng } from "../web/gpu/trees.js";
import { observeColonies } from "./colony-observation.mjs";
import { colonyPropagule } from "./colony-propagule.mjs";
import {
  readCellActivity,
  summarizeColonyActivity,
} from "./colony-activity.mjs";
const [input, output, lightChoice = "both", capturePath] =
  process.argv.slice(2);
if (!input || !output || !["both", "dim", "clouds"].includes(lightChoice))
  throw Error(
    "Usage: node research/colony-fragment-probe.mjs gift-probe.json output.json [both|dim|clouds] [capturePath]",
  );
const source = JSON.parse(await readFile(input, "utf8"));
const reusedCaptures = capturePath
  ? JSON.parse(await readFile(capturePath, "utf8"))
  : null;
if (reusedCaptures) assert.equal(reusedCaptures.complete, true);
const config = {
  treePrograms: 1,
  capacity: 4096,
  genomeCapacity: 1,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 64,
  sources: 1,
  archiveEnabled: 0,
};
const report = {
  captureSource: capturePath ?? null,
  sourceGenome: source.sourceGenome,
  nonGivingTree: source.mutedTree,
  captures: [],
  trials: [],
  complete: false,
  scope:
    "Three independent regrowth captures, one per seed. Each grows the naturally generated giving genome from one fresh cell with 70 energy for 180 seconds in uniform full sunlight. From its largest grown body, a seeded-random root selects an eight-cell breadth-first fragment. Fragment links retain exact slots, relative geometry, anchors and headings; roots are rotated to heading zero. Each assay restarts those eight cells with 12 energy each (96 total), no reserves, fresh memory, age, generation and program phase. Connected and disconnected controls differ only in links; a second control zeros the gift amount. 600 simulated seconds in uniform light 0.6 or ordinary moving clouds initialized at 0.6. No arrivals or mutations. This tests reusable observed structure, not an exact restart, epigenetic inheritance, spontaneous group reproduction, or general multicellular fitness. Same-seed GPU repeats may differ.",
};
async function checkpoint() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(output + ".tmp", output);
}
Object.assign(globalThis, globals);
globalThis.__fragmentGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__fragmentGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
try {
  for (const seed of [42, 97, 321]) {
    let observation, rootSlot;
    if (reusedCaptures) {
      const captured = reusedCaptures.captures.find((c) => c.seed === seed);
      assert.ok(captured, "Missing capture for seed");
      ({ observation, rootSlot } = structuredClone(captured));
      report.captures.push(structuredClone(captured));
    } else {
      const growth = await createLifeEngine(device, {
        ...config,
        seed,
        solarEnabled: 0,
      });
      try {
        await growth.fixture({
          programs: [{ tree: source.sourceGenome.tree }],
          cells: [{ energy: 70, storage: 0, x: 1024, y: 1024 }],
          sunlight: 1,
        });
        for (let i = 0; i < 18; i++) await growth.step(600);
        const state = await growth.state(),
          counters = await growth.counters();
        delete counters.raw;
        observation = {
          seconds: 180,
          world: 2048,
          colonies: observeColonies(state, 2048, 4096),
          genomes: [{ slot: 0, ...(await growth.genome(0)) }],
        };
        assert.ok(
          observation.colonies[0].cells.length >= 8,
          "Capture must have eight connected cells",
        );
        const rng = treeRng(seed ^ 0x91a37);
        rootSlot =
          observation.colonies[0].cells[
            Math.floor(rng() * observation.colonies[0].cells.length)
          ].slot;
        report.captures.push({
          seed,
          config: growth.cfg,
          kernel: growth.fingerprint,
          counters,
          rootSlot,
          observation,
        });
        console.log(
          "Captured",
          seed,
          observation.colonies[0].size,
          "cells; root",
          rootSlot,
        );
      } finally {
        growth.destroy();
      }
    }
    const connected = colonyPropagule(observation, {
        rootSlot,
        maxCells: 8,
        totalEnergy: 96,
      }),
      disconnected = colonyPropagule(observation, {
        rootSlot,
        maxCells: 8,
        totalEnergy: 96,
        connected: false,
      });
    assert.equal(connected.cells.length, 8);
    assert.deepEqual(
      connected.cells.map(({ links, ...c }) => c),
      disconnected.cells.map(({ links, ...c }) => c),
    );
    for (const light of lightChoice === "both"
      ? ["dim", "clouds"]
      : [lightChoice])
      for (const genotype of ["giving", "non-giving"])
        for (const mode of ["connected", "disconnected"]) {
          const engine = await createLifeEngine(device, {
            ...config,
            seed,
            solarEnabled: Number(light === "clouds"),
          });
          try {
            const fragment = structuredClone(
              mode === "connected" ? connected : disconnected,
            );
            assert.equal(fragment.programs.length, 1);
            if (genotype === "non-giving")
              fragment.programs[0].tree = structuredClone(source.mutedTree);
            await engine.fixture({ ...fragment, sunlight: 0.6 });
            const records = [];
            for (let seconds = 0; seconds <= 600; seconds++) {
              if (seconds % 60 === 0) {
                const counters = await engine.counters();
                delete counters.raw;
                const state = await engine.state(),
                  u = new Uint32Array(state),
                  f = new Float32Array(state),
                  activity = await readCellActivity(device, engine);
                let living = 0,
                  thirdLinks = 0;
                for (let i = 0; i < config.capacity; i++)
                  if (u[i * 52 + 31] === 1) {
                    living++;
                    thirdLinks += Number(u[i * 52 + 34] !== 0);
                    assert.ok(
                      Number.isFinite(f[i * 52]) &&
                        Number.isFinite(f[i * 52 + 1]) &&
                        Number.isFinite(f[i * 52 + 39]),
                    );
                    assert.ok(f[i * 52 + 4] >= 0 && f[i * 52 + 4] <= 819200);
                    for (let e = 0; e < 4; e++) {
                      const j = u[i * 52 + 32 + e] - 1;
                      if (j < 0) continue;
                      assert.ok(
                        j < config.capacity &&
                          u[j * 52 + 31] === 1 &&
                          [...u.slice(j * 52 + 32, j * 52 + 36)].includes(
                            i + 1,
                          ),
                      );
                    }
                  }
                assert.equal(living, counters.living);
                assert.equal(living, 8 + counters.births - counters.deaths);
                assert.equal((await engine.genes()).stats[0], living);
                records.push({
                  seconds,
                  ...counters,
                  thirdLinks,
                  ...summarizeColonyActivity(
                    state,
                    activity,
                    engine.tick,
                    2048,
                  ),
                });
              }
              if (seconds < 600) await engine.step(60);
            }
            assert.deepEqual(errors, []);
            report.trials.push({
              seed,
              light,
              genotype,
              mode,
              config: engine.cfg,
              kernel: engine.fingerprint,
              fragment,
              records,
            });
            await checkpoint();
            const r = records.at(-1);
            console.log(
              JSON.stringify({
                seed,
                light,
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
  }
  report.complete = true;
  await checkpoint();
} finally {
  device.destroy();
  delete globalThis.__fragmentGPU;
}
