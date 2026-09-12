// Summarize complete continuous-world experiments without equating census size
// or conditional syntax with adaptive complexity.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileTree, formatTree } from "../web/gpu/trees.js";
const [controlRoot, variantRoot, output] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/compare-guard-worlds.mjs control-runs variant-runs output.json",
  );
const report = {
  scope:
    "Three independent one-hour trajectories per sampler; matching seed does not ensure paired physical outcomes. Same ecology, continuous arrivals, zero division mutation, no population-floor replenishment. Moving groups have at least four cells and centroid speed over two world units/second. Late means are arithmetic means of seven saved observations from minute 30 through 60, not exact time integrals. Conditional syntax includes unreachable and constant branches. No fitness dependence or epiplexity estimate is inferred from syntax.",
  trials: [],
};
const containsIf = (t) => t.op === "if" || t.args.some(containsIf);
for (const seed of [42, 97, 321]) {
  let reference;
  for (const [sampler, root, prefix] of [
    ["control", controlRoot, "continuous-memory-control"],
    ["guard", variantRoot, "continuous-guard"],
  ]) {
    const directory = join(root, `${prefix}-${seed}`);
    let progress;
    try {
      progress = JSON.parse(
        await readFile(join(directory, "progress.json"), "utf8"),
      );
      assert.equal(progress.complete, true);
    } catch (error) {
      // Seed 42 control predates checkpoint recording; its finalized run file
      // includes the end-of-run census, surviving genomes and leaders.
      if (!(error.code === "ENOENT" && sampler === "control" && seed === 42))
        throw error;
    }
    const run = JSON.parse(await readFile(join(directory, "run.json"), "utf8"));
    assert.ok(Array.isArray(run.survivingTrees) && Array.isArray(run.leaders));
    assert.equal(run.closure, null);
    assert.equal(run.records.at(-1).seconds, 3600);
    assert.equal(run.config.seed, seed);
    assert.equal(run.config.floor, 0);
    assert.equal(run.config.rate, 8);
    if (reference) {
      assert.deepEqual(run.config, reference.config);
      assert.equal(run.kernel, reference.kernel);
    } else reference = run;
    const late = run.records.filter((r) => r.seconds >= 1800);
    assert.equal(late.length, 7);
    const keys = [
      "living",
      "bornInWorld",
      "linkedCells",
      "movingBodies",
      "movingBodyCells",
      "largestMovingBody",
      "variants",
    ];
    const final = Object.fromEntries(
      [...keys, "mutations", "crossovers", "births", "deaths"].map((k) => [
        k,
        run.records.at(-1)[k],
      ]),
    );
    const lateMean = Object.fromEntries(
      keys.map((k) => [k, late.reduce((a, r) => a + r[k], 0) / late.length]),
    );
    const conditional = run.survivingTrees.filter((g) => containsIf(g.tree));
    report.trials.push({
      sampler,
      seed,
      path: `research/runs/${prefix}-${seed}/run.json`,
      completionEvidence: progress
        ? "Complete checkpoint and final run"
        : "Legacy finalized run with final census, leaders and surviving genomes",
      genomeSampler: run.genomeSampler,
      final,
      lateMean,
      conditionalSyntax: {
        genotypes: conditional.length,
        cells: conditional.reduce((a, g) => a + g.living, 0),
      },
      conditionalLeaders: conditional
        .sort((a, b) => b.living - a.living)
        .slice(0, 12)
        .map((g) => ({
          ...g,
          source: formatTree(g.tree),
          instructions: compileTree(g.tree).length,
        })),
      series: run.records.map((r) =>
        Object.fromEntries(["seconds", ...keys].map((k) => [k, r[k]])),
      ),
    });
  }
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
for (const t of report.trials)
  console.log(
    JSON.stringify({
      sampler: t.sampler,
      seed: t.seed,
      final: t.final,
      lateMean: t.lateMean,
      conditionalSyntax: t.conditionalSyntax,
    }),
  );
