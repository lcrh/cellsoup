// A controlled regrowth assay for an observed clonal genotype. This is not an
// exact replay of its original world, nor an intervention in the live browser.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { compileTree } from "../web/gpu/trees.js";
import { observeColonies } from "./colony-observation.mjs";

const [input, output, light = "1"] = process.argv.slice(2);
const sunlight = Number(light);
assert.ok(Number.isFinite(sunlight) && sunlight >= 0 && sunlight <= 1);
if (!input || !output)
  throw Error(
    "Usage: node research/colony-gift-probe.mjs observation.json output.json",
  );
const observation = JSON.parse(await readFile(input, "utf8"));
const body = observation.colonies.find((b) => b.cells?.length >= 4);
assert.ok(body, "Need a captured whole colony");
const slots = [...new Set(body.cells.map((c) => c.genomeSlot))];
assert.equal(slots.length, 1, "This assay requires a clonal colony");
const gene = observation.genomes.find((g) => g.slot === slots[0]);
assert.ok(gene?.tree);
let changed = 0;
function noGift(t) {
  const copy = { ...t, args: t.args.map(noGift) };
  if (
    t.op === "give" &&
    t.args[0].op === "bond" &&
    t.args[0].args[0].value === 2 &&
    t.args[1].op === "bonds"
  ) {
    changed++;
    copy.args[1] = { op: "number", args: [], value: 0 };
  }
  return copy;
}
const muted = noGift(gene.tree);
assert.equal(
  changed,
  1,
  "Expected one give-to-bond-c2 expression with bonds as its fraction",
);
const before = compileTree(gene.tree),
  after = compileTree(muted);
assert.equal(before.length, after.length);
const lines = before.source.split("\n"),
  modified = after.source.split("\n");
const differences = lines.flatMap((line, i) =>
  line === modified[i] ? [] : [i],
);
assert.equal(differences.length, 1);
const register = /^sense (r\d+) bonds$/.exec(lines[differences[0]])?.[1];
assert.ok(register);
assert.equal(modified[differences[0]], `mov ${register} 0`);

Object.assign(globalThis, globals);
globalThis.__giftProbeGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__giftProbeGPU.requestAdapter();
if (!adapter) throw Error("GPU unavailable");
const device = await adapter.requestDevice(),
  errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const trials = [];
try {
  for (const seed of [42, 97, 321, 617, 731]) {
    for (const [condition, tree] of [
      ["original", gene.tree],
      ["zero-gift", muted],
    ]) {
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
        solarEnabled: 0,
        archiveEnabled: 0,
      });
      try {
        await engine.fixture({
          programs: [{ tree }],
          cells: [{ energy: 70, storage: 0 }],
          sunlight,
        });
        const records = [];
        for (let seconds = 0; seconds <= 300; seconds++) {
          if (seconds % 60 === 0) {
            const counters = await engine.counters();
            delete counters.raw;
            const buffer = await engine.state(),
              f = new Float32Array(buffer),
              u = new Uint32Array(buffer);
            let energy = 0,
              eligibleGivers = 0,
              lowEnergy = 0,
              counted = 0;
            for (let i = 0; i < engine.cfg.capacity; i++)
              if (u[i * 52 + 31] === 1) {
                counted++;
                eligibleGivers += Number(u[i * 52 + 34] !== 0);
                energy += f[i * 52 + 4] / 4096;
                lowEnergy += Number(f[i * 52 + 4] < 4096);
              }
            assert.equal(counted, counters.living);
            assert.equal(
              counters.living,
              1 + counters.births - counters.deaths,
            );
            const colonies = observeColonies(buffer, engine.cfg.side * 32, 0);
            records.push({
              seconds,
              ...counters,
              energy,
              lowEnergy,
              eligibleGivers,
              colonies,
            });
          }
          if (seconds < 300) await engine.step(60);
        }
        trials.push({
          seed,
          condition,
          config: engine.cfg,
          kernel: engine.fingerprint,
          records,
        });
        const end = records.at(-1);
        console.log(
          JSON.stringify({
            seed,
            condition,
            living: end.living,
            births: end.births,
            lowEnergy: end.lowEnergy,
            eligibleGivers: end.eligibleGivers,
            largest: end.colonies[0]?.size ?? 0,
          }),
        );
        assert.deepEqual(errors, []);
      } finally {
        engine.destroy();
      }
    }
  }
  await writeFile(
    output,
    JSON.stringify(
      {
        sourceObservation: input,
        sourceGenome: gene,
        scope:
          "Five seeds, one regrowth per condition and seed. Start one fresh cell with 70 energy, zero storage, fixed uniform sunlight (recorded in fixture), normal costs/temperature/physics, no immigration or archive, 300 simulated seconds. The intervention makes the selected gift fraction zero and changes exactly one compiled sense instruction into a mov, retaining instruction count. Physical contention means paired seeds are not deterministic counterfactual trajectories. This measures genotype regrowth under these conditions, not the original colony's realized history or ecological fitness in its full world.",
        fixture: { energy: 70, storage: 0, sunlight },
        mutedTree: muted,
        trials,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  device.destroy();
  delete globalThis.__giftProbeGPU;
}
