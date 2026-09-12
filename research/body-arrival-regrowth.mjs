// Reuse observed fragments to test runtime admission, not a new fitness claim.
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { colonyPropagule } from "./colony-propagule.mjs";
const [input, output] = process.argv.slice(2);
if (!output) throw Error("Supply captured-fragment report and output");
const raw = await readFile(input),
  source = JSON.parse(raw);
assert.equal(source.complete, true);
Object.assign(globalThis, globals);
globalThis.__regrowGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__regrowGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const report = {
  source: input,
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  sourceGenome: source.sourceGenome,
  scope:
    "Runtime-admission regression using three previously observed eight-cell fragments of natural genotype 15333. At tick 60, insert 96 total energy and no reserves into an otherwise empty running world at constant light 0.6. Compare original links, removed links, and equal-geometry disabled gifts for 180 seconds. All programs and physiology restart fresh. These are controlled regrowth cases, not autonomous group selection or a new world-level complexity comparison.",
  complete: false,
  trials: [],
};
async function save() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(output + ".tmp", output);
}
try {
  for (const capture of source.captures)
    for (const treatment of ["connected", "unlinked", "no-gift"]) {
      const e = await createLifeEngine(device, {
        treePrograms: 1,
        capacity: 4096,
        genomeCapacity: 4,
        initial: 0,
        floor: 0,
        rate: 0,
        side: 64,
        sources: 1,
        solarEnabled: 0,
        archiveEnabled: 0,
        seed: capture.seed,
      });
      try {
        await e.fixture({ programs: [], cells: [], sunlight: 0.6 });
        await e.step(60);
        const body = colonyPropagule(capture.observation, {
          rootSlot: capture.rootSlot,
          maxCells: 8,
          totalEnergy: 96,
          connected: treatment !== "unlinked",
        });
        assert.equal(body.cells.length, 8);
        assert.equal(body.programs.length, 1);
        body.programs[0].origin = source.sourceGenome;
        if (treatment === "no-gift")
          body.programs[0].tree = source.nonGivingTree;
        const admitted = await e.admitBody({
          programs: body.programs,
          cells: body.cells,
        });
        assert.equal(admitted.admitted, 8);
        const trial = {
          seed: capture.seed,
          treatment,
          config: e.cfg,
          kernel: e.fingerprint,
          provenance: body.provenance,
          admitted,
          records: [],
        };
        for (let second = 0; second <= 180; second += 30) {
          if (second) for (let i = 0; i < 3; i++) await e.step(600);
          const counters = await e.counters(),
            genes = await e.genes();
          delete counters.raw;
          assert.equal(counters.randomArrivals, 0);
          assert.equal(counters.sampledArrivals, 8);
          assert.equal(counters.living, 8 + counters.births - counters.deaths);
          assert.equal(
            genes.stats[admitted.genomeSlots[0] * 4],
            counters.living,
          );
          const state = new Uint32Array(await e.state()),
            f = new Float32Array(state.buffer);
          let living = 0;
          for (let i = 0; i < 4096; i++)
            if (state[i * 52 + 31] === 1) {
              living++;
              for (const k of [0, 1, 2, 3, 4, 38, 39])
                assert.ok(Number.isFinite(f[i * 52 + k]));
            }
          assert.equal(living, counters.living);
          assert.deepEqual(errors, []);
          trial.records.push({ seconds: second, ...counters });
        }
        trial.complete = true;
        report.trials.push(trial);
        await save();
        console.log(
          capture.seed,
          treatment,
          JSON.stringify(trial.records.at(-1)),
        );
      } finally {
        e.destroy();
      }
    }
  report.complete = true;
  await save();
} finally {
  device.destroy();
  delete globalThis.__regrowGPU;
}
