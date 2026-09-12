// Static opportunity counts, not evidence of executed or useful computation.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

export function auditMemory(tree) {
  const result = {
    stateBindings: 0,
    localBindings: 0,
    memoryReads: 0,
    bindingsWithReadInBody: 0,
    bindingsWithRecurrentUpdate: 0,
  };
  function walk(t) {
    if (t.op === "memory") result.memoryReads++;
    if (t.op === "state" || t.op === "let") {
      result[t.op === "state" ? "stateBindings" : "localBindings"]++;
      const slot = t.args[0].value;
      let reads = false,
        recurrent = false;
      function containsRead(n) {
        return (
          (n.op === "memory" && n.args[0].value === slot) ||
          n.args.some(containsRead)
        );
      }
      function body(n) {
        if (n.op === "memory" && n.args[0].value === slot) reads = true;
        if (
          n.op === "set" &&
          n.args[0].value === slot &&
          containsRead(n.args[1])
        )
          recurrent = true;
        n.args.forEach(body);
      }
      body(t.args[2]);
      result.bindingsWithReadInBody += Number(reads);
      result.bindingsWithRecurrentUpdate += Number(recurrent);
    }
    t.args.forEach(walk);
  }
  walk(tree);
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [modulePath = "web/gpu/trees.js", out, count = "10000", seed = "731"] =
    process.argv.slice(2);
  const { randomTree, treeRng, mutateTree } = await import(
    pathToFileURL(resolve(modulePath))
  );
  const rng = treeRng(Number(seed));
  const totals = {
    programs: Number(count),
    seed: Number(seed),
    scope:
      "Static syntax; system birth-result excluded. Flat memory aliases count by slot. No claim of execution or fitness.",
  };
  for (const mode of ["random", "mutated"]) {
    const sum = {};
    for (let i = 0; i < Number(count); i++) {
      let tree = randomTree(rng);
      if (mode === "mutated") tree = mutateTree(tree, rng);
      for (const [key, value] of Object.entries(auditMemory(tree)))
        sum[key] = (sum[key] ?? 0) + value;
    }
    totals[mode] = sum;
  }
  const text = JSON.stringify(totals, null, 2) + "\n";
  if (out) await writeFile(out, text);
  console.log(text);
}
