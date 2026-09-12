// Test a naturally observed temporal controller with matched interventions.
// See temporal-ablation.mjs for current-input history replacement semantics.
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { compileTree, treeRng, TREE_VM_OPS } from "../web/gpu/trees.js";
import { assemble } from "../web/language.js";
import { GPU_SENSORS, GPU_FIELDS } from "../web/gpu/language.js";
import {
  withoutTemporalHistory,
  uploadFixtureCode,
} from "./temporal-ablation.mjs";
const [input, output, treatment = "all", mode = "full"] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/history-establishment-probe.mjs candidate.json output.json [all|lag|delta|forward|intact] [full|smoke]",
  );
assert.ok(["all", "lag", "delta", "forward", "intact"].includes(treatment));
assert.ok(["smoke", "full"].includes(mode));
const candidate = JSON.parse(await readFile(input, "utf8"));
const programs = [{ ...candidate.genome, id: String(candidate.genome.serial) }];
const duration = mode === "smoke" ? 60 : 600;
const seeds = mode === "smoke" ? [42] : [42, 97, 321];
const report = {
  version: "history-establishment-v1",
  complete: false,
  treatment,
  mode,
  duration,
  candidate,
  trials: [],
  scope:
    "Clonal competition of a naturally observed temporal program against equal-length bytecode interventions. Same 64 fresh unlinked founders, 24 local and stored energy, normal moving clouds and heat, 4096 slots, no immigration or mutation. All history, only lag, or only delta can be replaced with current input; forward forces the single move instruction to one while leaving computation in place; intact is a neutral comparison. Three seeds and both assignment swaps. These are selected-program assays, not population-level evolutionary replicates or proof of a complexity increase.",
};
function intervention(tree) {
  const original = compileTree(tree);
  if (treatment === "intact")
    return { original, changed: original, replacements: [] };
  if (treatment === "forward") {
    assert.equal((original.source.match(/^move /gm) || []).length, 1);
    const source = original.source.replace(/^move .+$/m, "move 1");
    const changed = assemble(source, TREE_VM_OPS, GPU_SENSORS, GPU_FIELDS);
    assert.equal(changed.length, original.length);
    return {
      original,
      changed: { ...changed, source },
      replacements: [{ op: "move", after: "move 1" }],
    };
  }
  const slots =
    treatment === "all"
      ? null
      : original.statefulSlots
          .filter((s) => s.op === treatment)
          .map((s) => s.slot);
  if (slots !== null) assert.ok(slots.length);
  return withoutTemporalHistory(tree, slots);
}
async function save() {
  await writeFile(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(output + ".tmp", output);
}
Object.assign(globalThis, globals);
globalThis.__establishmentGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__establishmentGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
function initialCells(seed) {
  const rng = treeRng(seed ^ 0x146af029);
  const positions = Array.from({ length: 64 }, () => ({
    x: rng() * 2048,
    y: rng() * 2048,
    heading: rng(),
    energy: 24,
    storage: 24,
  }));
  const assignment = Array.from({ length: 64 }, (_, i) => i % 2);
  for (let i = 63; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [assignment[i], assignment[j]] = [assignment[j], assignment[i]];
  }
  return positions.map((c, i) => ({ ...c, genome: assignment[i] }));
}
function census(buffer, counters, genes, tick, blindSlot) {
  const f = new Float32Array(buffer),
    u = new Uint32Array(buffer);
  const groups = Array.from({ length: 2 }, (_, slot) => ({
    slot,
    blind: slot === blindSlot,
    living: 0,
    energy: 0,
    storage: 0,
    sunlight: 0,
    temperature: 0,
    speed: 0,
    generation: 0,
    maxGeneration: 0,
    thrustReadyReserves: 0,
  }));
  for (let i = 0; i < u.length / 52; i++) {
    const k = i * 52;
    if (u[k + 31] !== 1) continue;
    const g = groups[u[k + 25]];
    assert.ok(g);
    for (const q of [0, 1, 2, 3, 4, 37, 38, 39])
      assert.ok(Number.isFinite(f[k + q]));
    g.living++;
    g.energy += f[k + 4] / 4096;
    g.storage += f[k + 38] / 4096;
    g.sunlight += f[k + 37];
    g.temperature += f[k + 39];
    g.speed += Math.hypot(f[k + 2], f[k + 3]);
    g.generation += u[k + 29];
    g.maxGeneration = Math.max(g.maxGeneration, u[k + 29]);
    g.thrustReadyReserves += Number(f[k + 38] >= 4096);
  }
  const sums = groups.map((g) => ({ ...g }));
  for (const g of groups) {
    assert.equal(g.living, genes.stats[g.slot * 4]);
    g.births = genes.stats[g.slot * 4 + 1];
    g.deaths = 32 + g.births - g.living;
    assert.ok(g.deaths >= 0);
    for (const key of [
      "energy",
      "storage",
      "sunlight",
      "temperature",
      "speed",
      "generation",
    ])
      g[key] = g.living ? g[key] / g.living : null;
  }
  assert.equal(counters.living, groups[0].living + groups[1].living);
  assert.equal(counters.living, 64 + counters.births - counters.deaths);
  assert.equal(counters.births, groups[0].births + groups[1].births);
  delete counters.raw;
  return { tick, seconds: tick / 60, counters, groups, sums };
}
try {
  for (const program of programs)
    for (const seed of seeds)
      for (const blindSlot of [0, 1]) {
        const code = intervention(program.tree);
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
          archiveEnabled: 0,
        });
        const founders = initialCells(seed);
        const trial = {
          program: program.id,
          seed,
          blindSlot,
          complete: false,
          config: engine.cfg,
          nominalKernel: engine.fingerprint,
          originalSource: code.original.source,
          alteredSource: code.changed.source,
          replacements: code.replacements,
          founders,
          compiledSource: compileTree(program.tree).source,
          records: [],
        };
        try {
          await engine.fixture({
            programs: [{ tree: program.tree }, { tree: program.tree }],
            cells: founders,
            sunlight: 0,
          });
          await uploadFixtureCode(device, engine, blindSlot, code.changed);
          const readback = assemble(
            (await engine.genome(blindSlot)).bytecode,
            TREE_VM_OPS,
            GPU_SENSORS,
            GPU_FIELDS,
          );
          assert.deepEqual(
            new Uint8Array(readback.buffer),
            new Uint8Array(code.changed.buffer),
          );
          for (let second = 0; second <= duration; second += 30) {
            if (second)
              for (let batch = 0; batch < 3; batch++) await engine.step(600);
            trial.records.push(
              census(
                await engine.state(),
                await engine.counters(),
                await engine.genes(),
                engine.tick,
                blindSlot,
              ),
            );
            assert.deepEqual(errors, []);
          }
          trial.complete = true;
          report.trials.push(trial);
          await save();
          const last = trial.records.at(-1);
          console.log(
            JSON.stringify({
              program: program.id,
              seed,
              blindSlot,
              groups: last.groups,
            }),
          );
        } finally {
          engine.destroy();
        }
      }
  report.complete = true;
  await save();
} finally {
  device.destroy();
  delete globalThis.__establishmentGPU;
}
