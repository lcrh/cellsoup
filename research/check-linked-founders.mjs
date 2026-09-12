// Run from the patched linked-signal checkout against the baseline tree
// compiler. Use the same initial host RNG stream as createLifeEngine.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as temporal from "../web/gpu/trees.js";
const [baselineRoot, output] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/check-linked-founders.mjs baseline-checkout output.json",
  );
const baseline = await import(
  pathToFileURL(resolve(baselineRoot, "web/gpu/trees.js"))
);
const result = {
  scope:
    "All 8192 initial founder trees and compiled program sources match for each trial seed. Linked-signal forms are available through archive mutation; crossover can transfer them once present.",
  seeds: [],
};
for (const seed of [901, 1907, 2309]) {
  const a = baseline.treeRng(seed ^ 0x735a2d19),
    b = temporal.treeRng(seed ^ 0x735a2d19),
    h = createHash("sha256");
  for (let i = 0; i < 8192; i++) {
    const x = baseline.randomTree(a),
      y = temporal.randomTree(b);
    assert.deepEqual(y, x);
    assert.equal(
      temporal.compileTree(y).source,
      baseline.compileTree(x).source,
    );
    h.update(JSON.stringify(x) + "\n");
  }
  result.seeds.push({ seed, count: 8192, hash: h.digest("hex") });
}
await writeFile(output, JSON.stringify(result, null, 2) + "\n");
console.log(
  "PASS 24576 founder trees and compiled programs match the baseline",
);
