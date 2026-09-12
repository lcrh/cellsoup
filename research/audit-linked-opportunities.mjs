// Syntax opportunity audit, deliberately not a communication/complexity score.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { join } from "node:path";
const [output = "research/results/linked-opportunities.json", ...supplied] =
  process.argv.slice(2);
const roots = supplied.length
  ? supplied
  : ["research/results/cadence-worlds", "research/results/temporal-worlds"];
function walk(t) {
  return [t, ...t.args.flatMap(walk)];
}
const report = {
  scope:
    "Final surviving syntax in nine completed worlds. A matching send/receive channel inside one genome is an opportunity for a clonal body, not evidence of executed communication. Different genotypes can communicate without such a match; dead branches and unused values can create matches without function. Counts must not be optimized as a complexity measure.",
  worlds: [],
};
for (const root of roots)
  for (const name of (await readdir(root)).sort()) {
    if (name === "manifest.json") continue;
    const path = join(root, name, "run.json.gz"),
      raw = gunzipSync(await readFile(path)),
      run = JSON.parse(raw),
      counts = {},
      matched = [];
    for (const g of run.survivingTrees) {
      const nodes = walk(g.tree),
        ops = new Set(nodes.map((n) => n.op));
      const send = new Set(
        nodes.filter((n) => n.op === "send").map((n) => n.args[1].value),
      );
      const receive = new Set(
        nodes.filter((n) => n.op === "receive").map((n) => n.args[0].value),
      );
      for (const op of ["send", "receive", "emit", "listen"])
        if (ops.has(op)) {
          counts[op + "Genotypes"] = (counts[op + "Genotypes"] ?? 0) + 1;
          counts[op + "Cells"] = (counts[op + "Cells"] ?? 0) + g.living;
        }
      const channels = [...send].filter((ch) => receive.has(ch));
      if (channels.length)
        matched.push({
          serial: g.serial,
          living: g.living,
          channels,
          tree: g.tree,
        });
    }
    report.worlds.push({
      name,
      path,
      sha256: createHash("sha256").update(raw).digest("hex"),
      config: run.config,
      kernel: run.kernel,
      sampler: run.genomeSampler,
      finalLiving: run.records.at(-1).living,
      counts,
      matchedGenotypes: matched.length,
      matchedCells: matched.reduce((n, g) => n + g.living, 0),
      matched,
    });
  }
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
for (const w of report.worlds)
  console.log(w.name, w.matchedGenotypes, w.matchedCells);
