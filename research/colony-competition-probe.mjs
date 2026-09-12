// Compare naturally observed programs in isolation and together. Optional
// authored gift guards are matched assay controls, never evolutionary founders.
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { treeRng } from "../web/gpu/trees.js";
import { nearestGiftGuards } from "./nearest-gift-guards.mjs";
import { observeColonies } from "./colony-observation.mjs";
import {
  readCellActivity,
  summarizeColonyActivity,
} from "./colony-activity.mjs";
const [
  input,
  output,
  colonialId = "8919",
  solitaryId = "13530",
  guard = "original",
  conditions = "colonial,solitary,mixed",
] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/colony-competition-probe.mjs observation.json output.json [colonialSerial] [solitarySerial] [original|alive|kin] [conditions]",
  );
const observation = JSON.parse(await readFile(input, "utf8"));
const sources = [Number(colonialId), Number(solitaryId)].map((id) => {
  const gene = observation.genomes.find((g) => g.serial === id);
  assert.ok(gene?.tree, `Missing observed tree ${id}`);
  return gene;
});
assert.notEqual(sources[0].serial, sources[1].serial);
assert.ok(["original", "alive", "kin"].includes(guard));
const chosenConditions = conditions.split(",");
assert.ok(
  chosenConditions.length &&
    new Set(chosenConditions).size === chosenConditions.length &&
    chosenConditions.every((c) =>
      ["colonial", "solitary", "mixed"].includes(c),
    ),
);
const guards = guard === "original" ? null : nearestGiftGuards(sources[0].tree);
const programTrees = [
  guards ? guards[guard] : sources[0].tree,
  sources[1].tree,
];
const report = {
  guard,
  guardComparison: guards,
  programTrees,
  conditions: chosenConditions,
  source: input,
  sourceGenomes: sources,
  complete: false,
  trials: [],
  scope:
    "Two naturally generated genomes from the same observed world, tested as monocultures and a 50:50 mixture. Each trial starts 64 unlinked, fresh cells at the same seeded-random positions/headings, 24 local energy and 24 reserves per cell. Mixture assigns exactly 32 positions to each genotype using a seeded shuffle. Normal moving clouds, energy costs and physics, no arrivals, mutation or archive. 600 simulated seconds, 4096 entity slots. These are fresh ecological assays, not exact restarts or a direct intervention in the original evolutionary trajectory. Three seeds per condition are not sufficient for a general invasion claim; GPU contention can change repeats. When guard is alive or kin, the colonial program is an explicitly authored control replacing its gift fraction with (if (FIELD (nearest-cell)) (bonds) 0). The two controls differ by exactly one sensed bytecode field, while both are shorter than the observed original. Kin tests exact genome identity, not ancestry.",
};
async function save() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(output + ".tmp", output);
}
Object.assign(globalThis, globals);
globalThis.__competitionGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__competitionGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
try {
  for (const seed of [42, 97, 321]) {
    const random = treeRng(seed ^ 0x146af029);
    const positions = Array.from({ length: 64 }, () => ({
      x: random() * 2048,
      y: random() * 2048,
      heading: random(),
      energy: 24,
      storage: 24,
    }));
    const assignment = Array.from({ length: 64 }, (_, i) => i % 2);
    for (let i = 63; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [assignment[i], assignment[j]] = [assignment[j], assignment[i]];
    }
    for (const condition of chosenConditions) {
      const e = await createLifeEngine(device, {
        treePrograms: 1,
        capacity: 4096,
        genomeCapacity: 2,
        initial: 0,
        floor: 0,
        rate: 0,
        side: 64,
        sources: 1,
        seed,
        archiveEnabled: 0,
      });
      const seeds = positions.map((c, i) => ({
        ...c,
        genome:
          condition === "colonial"
            ? 0
            : condition === "solitary"
              ? 1
              : assignment[i],
      }));
      const trial = {
        seed,
        condition,
        config: { ...e.cfg },
        kernel: e.fingerprint,
        founders: seeds,
        records: [],
      };
      try {
        await e.fixture({
          programs: programTrees.map((tree) => ({ tree })),
          cells: seeds,
          sunlight: 0,
        });
        for (let second = 0; second <= 600; second += 60) {
          if (second) for (let step = 0; step < 6; step++) await e.step(600);
          const buffer = await e.state(),
            u = new Uint32Array(buffer),
            f = new Float32Array(buffer),
            c = await e.counters(),
            genes = await e.genes();
          delete c.raw;
          const populations = [0, 0],
            energy = [0, 0],
            storage = [0, 0];
          for (let i = 0; i < e.cfg.capacity; i++)
            if (u[i * 52 + 31] === 1) {
              const k = i * 52,
                g = u[k + 25];
              assert.ok(g < 2);
              populations[g]++;
              energy[g] += f[k + 4] / 4096;
              storage[g] += f[k + 38] / 4096;
              for (const q of [0, 1, 2, 3, 4, 38, 39])
                assert.ok(Number.isFinite(f[k + q]));
              assert.ok(f[k + 4] >= 0 && f[k + 4] <= 200 * 4096);
              assert.ok(f[k + 38] >= 0 && f[k + 38] <= 400 * 4096);
              for (let l = 32; l < 36; l++)
                if (u[k + l]) {
                  const j = u[k + l] - 1;
                  assert.ok(j < e.cfg.capacity && u[j * 52 + 31] === 1);
                  assert.ok(
                    [...u.subarray(j * 52 + 32, j * 52 + 36)].includes(i + 1),
                  );
                }
            }
          assert.equal(c.living, populations[0] + populations[1]);
          assert.equal(c.living, 64 + c.births - c.deaths);
          for (let g = 0; g < 2; g++)
            assert.equal(populations[g], genes.stats[g * 4]);
          const activity = summarizeColonyActivity(
            buffer,
            await readCellActivity(device, e),
            e.tick,
            2048,
          );
          trial.records.push({
            seconds: second,
            ...c,
            ...activity,
            populations,
            energy,
            storage,
            genotypeBirths: [genes.stats[1], genes.stats[5]],
          });
          assert.deepEqual(errors, []);
          if (second === 600) {
            trial.colonies = observeColonies(buffer, 2048);
            trial.genomes = [];
            for (let g = 0; g < 2; g++)
              trial.genomes.push({ slot: g, ...(await e.genome(g)) });
          }
        }
        trial.complete = true;
        report.trials.push(trial);
        await save();
        console.log(
          JSON.stringify({ seed, condition, ...trial.records.at(-1) }),
        );
      } finally {
        e.destroy();
      }
    }
  }
  report.complete = true;
  await save();
} finally {
  device.destroy();
  delete globalThis.__competitionGPU;
}
