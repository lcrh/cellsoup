// Research-only structural checks and mutation reachability, not a fitness test.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const [controlPath, variantPath, inputPath, outputPath] = process.argv.slice(2);
if (!outputPath)
  throw Error(
    "Usage: node research/tree-guard-check.mjs control-module variant-module gift-probe.json output.json",
  );
const control = await import(pathToFileURL(resolve(controlPath)));
const variant = await import(pathToFileURL(resolve(variantPath)));
const source = JSON.parse(await readFile(inputPath, "utf8")).sourceGenome;
const report = {
  modules: {
    control: createHash("sha256")
      .update(await readFile(controlPath))
      .digest("hex"),
    guard: createHash("sha256")
      .update(await readFile(variantPath))
      .digest("hex"),
  },
  sourceGenome: source.serial,
  seed: 731,
  samples: 10000,
  founderChecks: [],
  mutation: {},
  scope:
    "Syntax reachability only. Insertion retains an action subtree in one branch with nop in the other; it need not preserve timing, execution, or fitness. Predicates use the full existing typed grammar and may have effects. No authored program is inserted into evolutionary worlds.",
};
for (const seed of [42, 97, 321]) {
  // Match the host founder stream used by createLifeEngine.
  const founderSeed = seed ^ 0x735a2d19;
  const a = control.treeRng(founderSeed),
    b = variant.treeRng(founderSeed),
    hash = createHash("sha256");
  for (let i = 0; i < 8192; i++) {
    const first = control.printTree(control.randomTree(a));
    assert.equal(variant.printTree(variant.randomTree(b)), first);
    hash.update(first + "\n");
  }
  report.founderChecks.push({
    seed,
    rngSeed: founderSeed >>> 0,
    count: 8192,
    sha256: hash.digest("hex"),
  });
}
const random = variant.treeRng(617);
let successes = 0,
  full = 0;
for (let i = 0; i < 1000; i++) {
  const parent = variant.randomTree(random),
    before = variant.printTree(parent);
  const result = variant.guardTree(parent, random);
  assert.equal(variant.printTree(parent), before);
  assert.ok(variant.compileTree(result.tree).length <= 64);
  assert.ok(variant.checkTree(result.tree).count <= 32);
  if (result.guarded) {
    successes++;
    const restored = structuredClone(result.tree);
    let cursor = restored;
    for (const index of result.path) cursor = cursor.args[index];
    assert.equal(cursor.op, "if");
    assert.equal(cursor.args[3 - result.branch].op, "nop");
    assert.equal(variant.checkTree(cursor.args[0], null).type, "Bool");
    const retained = structuredClone(cursor.args[result.branch]);
    if (result.path.length) {
      let owner = restored;
      for (const index of result.path.slice(0, -1)) owner = owner.args[index];
      owner.args[result.path.at(-1)] = retained;
      assert.equal(variant.printTree(restored), before);
    } else assert.equal(variant.printTree(retained), before);
  } else {
    full++;
    assert.equal(variant.printTree(result.tree), before);
  }
}
assert.ok(successes > 100);
// A full tree must fail insertion explicitly, and ordinary mutation must still work.
let saturated;
for (let i = 0; i < 10000 && !saturated; i++) {
  const t = variant.randomTree(random);
  if (variant.checkTree(t).count > 29) saturated = t;
}
assert.ok(saturated);
assert.equal(variant.guardTree(saturated, random).guarded, false);
assert.notEqual(
  variant.printTree(variant.mutateTree(saturated, random)),
  variant.printTree(saturated),
);
report.contractChecks = { samples: 1000, successes, declined: full };
function insertion(parent, child, module) {
  const original = module.printTree(parent),
    matches = [];
  function visit(n, path = []) {
    if (n.op === "if")
      for (const branch of [1, 2]) {
        if (n.args[3 - branch].op !== "nop") continue;
        let restored = structuredClone(child);
        if (!path.length) restored = structuredClone(n.args[branch]);
        else {
          let p = restored;
          for (const i of path.slice(0, -1)) p = p.args[i];
          p.args[path.at(-1)] = structuredClone(n.args[branch]);
        }
        if (module.printTree(restored) === original)
          matches.push({ path, branch, predicate: n.args[0] });
      }
    n.args.forEach((a, i) => visit(a, [...path, i]));
  }
  visit(child);
  return matches;
}
for (const [name, module] of [
  ["control", control],
  ["guard", variant],
]) {
  const rng = module.treeRng(report.seed),
    before = module.printTree(source.tree);
  const counts = {
    exactInsertions: 0,
    nonliteralPredicates: 0,
    kinOnGiftRecipient: 0,
    examples: [],
  };
  for (let i = 0; i < report.samples; i++) {
    const child = module.mutateTree(source.tree, rng);
    assert.equal(module.printTree(source.tree), before);
    assert.ok(module.compileTree(child).length <= 64);
    const matches = insertion(source.tree, child, module);
    if (!matches.length) continue;
    counts.exactInsertions++;
    if (matches.some((m) => m.predicate.op !== "bool"))
      counts.nonliteralPredicates++;
    if (
      matches.some(
        (m) =>
          JSON.stringify(m.path) === "[0]" &&
          m.predicate.op === "kin" &&
          module.printTree(m.predicate.args[0]) === "(bond c2)",
      )
    ) {
      counts.kinOnGiftRecipient++;
      if (counts.examples.length < 3)
        counts.examples.push(module.printTree(child));
    }
  }
  report.mutation[name] = counts;
}
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
