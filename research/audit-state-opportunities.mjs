// Conservative static opportunities in completed worlds, not functional memory
// or communication claims. Explicit per-evaluation writes exclude state init.
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import assert from "node:assert/strict";
import { formatTree } from "../web/gpu/trees.js";
const [
  root = "research/results/point-worlds",
  output = "research/results/state-opportunities.json",
] = process.argv.slice(2);
const report = {
  scope:
    "Final survivors in six completed operation-mutation worlds. Counts are syntax and an overapproximate slot-dependency graph, not evidence of execution, useful history or communication. State initialization is excluded from recurrent write edges; let and set are included. Reads inside RHS effects can add false-positive edges. Physical state and registers are not covered.",
  worlds: [],
  selfDependent: [],
};
const readsIn = (t) =>
  t.op === "memory" ? [t.args[0].value] : t.args.flatMap(readsIn);
for (const condition of ["control", "mutation"])
  for (const seed of [42, 97, 321]) {
    const path = `continuous-point-${condition}-${seed}/run.json.gz`,
      run = JSON.parse(gunzipSync(await readFile(join(root, path))));
    assert.equal(run.records.at(-1).seconds, 3600);
    const counts = {
      genotypes: run.survivingTrees.length,
      withReads: 0,
      withReceive: 0,
      withSend: 0,
      withReadAndWriteToSameSlot: 0,
      withDirectSelfDependency: 0,
    };
    for (const g of run.survivingTrees) {
      const reads = new Set(),
        writes = new Set(),
        edges = [];
      let receive = false,
        send = false;
      function walk(t) {
        if (t.op === "memory") reads.add(t.args[0].value);
        if (["state", "let", "set"].includes(t.op)) {
          const slot = t.args[0].value;
          writes.add(slot);
          if (t.op !== "state")
            for (const read of readsIn(t.args[1]))
              edges.push({
                from: read,
                to: slot,
                identity: t.args[1].op === "memory" && read === slot,
              });
        }
        receive ||= t.op === "receive";
        send ||= t.op === "send";
        t.args.forEach(walk);
      }
      walk(g.tree);
      counts.withReads += Number(reads.size > 0);
      counts.withReceive += Number(receive);
      counts.withSend += Number(send);
      counts.withReadAndWriteToSameSlot += Number(
        [...reads].some((s) => writes.has(s)),
      );
      if (edges.some((e) => e.from === e.to)) {
        counts.withDirectSelfDependency++;
        report.selfDependent.push({
          condition,
          seed,
          serial: g.serial,
          living: g.living,
          edges,
          source: formatTree(g.tree),
          tree: g.tree,
        });
      }
    }
    report.worlds.push({ condition, seed, path, counts });
  }
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.worlds));
console.log("Direct self-dependency candidates", report.selfDependent.length);
