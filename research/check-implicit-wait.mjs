// Compare compiler acceptance and a minimal metabolic/division replay against a
// separate baseline checkout. Both use the same VM and physics settings.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { create, globals } from "webgpu";
import * as variant from "../web/gpu/trees.js";
import { createLifeEngine } from "../web/gpu/engine.js";
const [baselineRoot, output] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/check-implicit-wait.mjs baseline-checkout output.json",
  );
const baseline = await import(
  pathToFileURL(resolve(baselineRoot, "web/gpu/trees.js"))
);
const baselineEngine = await import(
  pathToFileURL(resolve(baselineRoot, "web/gpu/engine.js"))
);
const rngA = baseline.treeRng(904),
  rngB = variant.treeRng(904),
  hash = createHash("sha256");
for (let i = 0; i < 1000; i++) {
  const a = baseline.randomTree(rngA),
    b = variant.randomTree(rngB);
  assert.deepEqual(a, b, "Changed founder acceptance or random sampling");
  const ca = baseline.compileTree(a),
    cb = variant.compileTree(b);
  assert.equal(
    cb.source,
    ca.source.replace(/\nwait 0\njmp ROOT$/, "\njmp ROOT"),
  );
  assert.equal(cb.length, ca.length - 1);
  hash.update(JSON.stringify(a));
}
const tree = variant.parseTree("(seq (photosynthesize) (split))");
const explicit = variant.parseTree("(seq (photosynthesize) (wait 10) (split))");
assert.ok(variant.compileTree(explicit).source.includes("wait r0"));
Object.assign(globalThis, globals);
globalThis.__waitGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__waitGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const config = {
  treePrograms: 1,
  capacity: 256,
  genomeCapacity: 1,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 16,
  sources: 1,
  seed: 42,
  archiveEnabled: 0,
  solarEnabled: 0,
};
const report = {
  scope:
    "Identical 1000 founder trees and baseline-equivalent compiler size boundary; only compiler-inserted end-of-loop wait removed. Explicit wait remains. One cell, energy 24, storage 24, full static sunlight, default heat and energy costs. Normal births, 60-second replay. This checks removal of an accidental cadence barrier, not evolutionary complexity.",
  config,
  founderHash: hash.digest("hex"),
  trials: [],
};
try {
  for (const [name, engine] of [
    ["baseline", baselineEngine.createLifeEngine],
    ["no-implicit-wait", createLifeEngine],
  ]) {
    const e = await engine(device, config);
    const trial = { name, config: e.cfg, kernel: e.fingerprint, records: [] };
    try {
      await e.fixture({
        programs: [{ tree }],
        cells: [{ energy: 24, storage: 24 }],
        sunlight: 1,
      });
      for (let second = 0; second <= 60; second++) {
        if (second) await e.step(60);
        const c = await e.counters();
        delete c.raw;
        assert.equal(c.living, 1 + c.births - c.deaths);
        trial.records.push({ second, ...c });
      }
      report.trials.push(trial);
    } finally {
      e.destroy();
    }
  }
  assert.deepEqual(report.trials[0].config, report.trials[1].config);
  assert.equal(report.trials[0].kernel, report.trials[1].kernel);
  assert.equal(report.trials[0].records.at(-1).births, 0);
  assert.ok(report.trials[1].records.at(-1).births > 0);
  assert.deepEqual(errors, []);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "PASS identical founder trees, only implicit wait removed, identical physics, original zero births versus variant " +
      report.trials[1].records.at(-1).births +
      " births",
  );
} finally {
  device.destroy();
  delete globalThis.__waitGPU;
}
