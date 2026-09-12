// Test whether useful isolated steering survives reproduction and normal clouds.
// Duplicate, unchanged genomes compete with one copy's bearing output disabled.
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { create, globals } from "webgpu";
import { createLifeEngine } from "../web/gpu/engine.js";
import { parseTree, compileTree, treeRng } from "../web/gpu/trees.js";
const [input, output, mode = "full", treatment = "zero", selection = "all"] =
  process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/sensory-establishment-probe.mjs candidates.json output.json [smoke|full] [zero|forward|no-heat-damage] [all|serial,...]",
  );
assert.ok(["smoke", "full"].includes(mode));
assert.ok(["zero", "forward", "no-heat-damage"].includes(treatment));
const candidates = JSON.parse(await readFile(input, "utf8"));
const control = {
  id: "control-straight-division",
  authored: true,
  tree: parseTree("(seq (photosynthesize) (move 1) (split))"),
};
const programs = (
  mode === "smoke"
    ? [control]
    : [
        control,
        ...candidates.filter((p) => [31236, 32994, 14980].includes(p.serial)),
      ]
).filter(
  (p) =>
    selection === "all" ||
    selection.split(",").includes(String(p.serial ?? p.id)),
);
assert.ok(programs.length);
const duration = mode === "smoke" ? 60 : 600;
const seeds = mode === "smoke" ? [42] : [42, 97, 321];
const sha = (x) => createHash("sha256").update(x).digest("hex");
const report = {
  version: "sensory-establishment-v1",
  complete: false,
  mode,
  treatment,
  selection,
  duration,
  source: input,
  programs,
  trials: [],
  scope:
    "Each assay competes 32 intact and 32 bearing-disabled founders of the same unchanged natural program. Identical tree bytecode occupies two genome slots. Both choices of disabled slot are tested at fixed seeded positions and assignments. Normal clouds, births, energy, storage, thermal damage and physics; no immigration, archive or mutation. Records every 30 seconds for 600 seconds. This measures clonal establishment under one ecology, not open-ended evolutionary complexity. The authored straight-division control has no directional sensor and measures ecological/identity imbalance. Treatment zero replaces the directional reading with zero; forward replaces it with 180 degrees (saturated positive movement for the bearing-as-thrust program); no-heat-damage uses zero bearing and disables thermal damage equally for both competitors. All other rules remain. GPU contention means matched initial states are not bitwise deterministic counterfactuals.",
};
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
function assayDevice(blindSlot) {
  const target = "c.r[d]=atan2(gradient.y,gradient.x)*57.29578;";
  let actualHash,
    count = 0;
  const proxy = new Proxy(device, {
    get(obj, name) {
      if (name === "createShaderModule")
        return (descriptor) => {
          assert.equal(++count, 1);
          assert.equal(descriptor.code.split(target).length, 2);
          const replacement = `c.r[d]=select(atan2(gradient.y,gradient.x)*57.29578,${treatment === "forward" ? "180.0" : "0.0"},c.machine.y==${blindSlot}u);`;
          const code = descriptor.code.replace(target, replacement);
          actualHash = sha(code);
          return obj.createShaderModule({ ...descriptor, code });
        };
      const value = Reflect.get(obj, name, obj);
      return typeof value === "function" ? value.bind(obj) : value;
    },
  });
  return {
    device: proxy,
    get hash() {
      assert.equal(count, 1);
      return actualHash;
    },
  };
}
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
        const wrapped = assayDevice(blindSlot);
        const engine = await createLifeEngine(wrapped.device, {
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
          ...(treatment === "no-heat-damage" ? { heatDamage: 0 } : {}),
        });
        const founders = initialCells(seed);
        const trial = {
          program: program.id,
          seed,
          blindSlot,
          complete: false,
          config: engine.cfg,
          nominalKernel: engine.fingerprint,
          actualShaderSha256: wrapped.hash,
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
