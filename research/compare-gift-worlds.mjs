// Compare completed continuous evolution trials; population and syntax are not
// treated as estimates of adaptive complexity.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatTree } from "../web/gpu/trees.js";
const [controlRoot, linkedRoot, output] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/compare-gift-worlds.mjs control-runs linked-runs output.json",
  );
const keys = [
  "living",
  "bornInWorld",
  "linkedCells",
  "largestBody",
  "movingBodies",
  "movingBodyCells",
  "largestMovingBody",
  "variants",
  "recentThrustCells",
  "movingBodiesWithRecentThrust",
  "movingBodyCellsWithRecentThrust",
  "largestMovingBodyWithRecentThrust",
  "movingBodiesWithoutRecentThrust",
];
const report = {
  scope:
    "Three fresh one-hour worlds per gift rule, with the same random-founder sampler, complete configuration and observation tools. Matching seeds are not deterministic paired counterfactuals on the GPU. Groups contain at least four reciprocally linked cells; moving means centroid speed above two world units/second. Recent thrust means at least one member successfully applied nonzero thrust within the preceding 60 ticks. Neither motion nor thrust proves coordinated locomotion. Late means use seven snapshots at minutes 30–60; they are not continuous-time integrals. Gift syntax may be unreachable or ineffective. No epiplexity estimate is inferred.",
  trials: [],
};
const hasGift = (t) => t.op === "give" || t.args.some(hasGift);
for (const seed of [42, 97, 321]) {
  let reference;
  for (const [rule, root, prefix] of [
    ["contact", controlRoot, "continuous-contact-gifts"],
    ["linked", linkedRoot, "continuous-linked-gifts"],
  ]) {
    const directory = join(root, `${prefix}-${seed}`);
    const run = JSON.parse(await readFile(join(directory, "run.json"), "utf8"));
    const progress = JSON.parse(
      await readFile(join(directory, "progress.json"), "utf8"),
    );
    assert.equal(progress.complete, true, "Unfinished trial");
    assert.deepEqual(
      run.records,
      progress.records,
      "Stale final/checkpoint pair",
    );
    assert.equal(run.kernel, progress.kernel);
    assert.equal(run.config.seed, seed);
    assert.equal(run.closure, null);
    assert.equal(run.config.capacity, 32768);
    assert.equal(run.config.initial, 8192);
    assert.equal(run.config.floor, 0);
    assert.equal(run.config.rate, 8);
    assert.equal(run.config.treePrograms, 1);
    assert.deepEqual(run.config, run.finalConfig);
    assert.equal(run.records.at(-1).seconds, 3600);
    assert.deepEqual(
      run.records.map((r) => r.seconds),
      Array.from({ length: 13 }, (_, i) => i * 300),
    );
    if (reference) {
      assert.deepEqual(
        run.config,
        reference.config,
        "Ecology changed between conditions",
      );
      assert.equal(
        run.genomeSampler,
        reference.genomeSampler,
        "Founder sampler changed",
      );
      assert.notEqual(
        run.kernel,
        reference.kernel,
        "Missing gift intervention",
      );
    } else reference = run;
    const series = run.records.map((r) => {
      assert.equal(r.recentThrustWindowTicks, 60);
      for (const key of keys)
        assert.ok(Number.isFinite(r[key]), `Missing ${key}`);
      assert.equal(
        r.living,
        r.randomArrivals + r.sampledArrivals + r.births - r.deaths,
      );
      assert.ok(r.linkedCells <= r.living);
      assert.ok(r.movingBodyCellsWithRecentThrust <= r.movingBodyCells);
      return {
        seconds: r.seconds,
        ...Object.fromEntries(keys.map((k) => [k, r[k]])),
        linkedFraction: r.living ? r.linkedCells / r.living : 0,
        movingThrustFraction: r.living
          ? r.movingBodyCellsWithRecentThrust / r.living
          : 0,
      };
    });
    const late = series.filter((r) => r.seconds >= 1800);
    const meanKeys = [...keys, "linkedFraction", "movingThrustFraction"];
    const lateMean = Object.fromEntries(
      meanKeys.map((k) => [
        k,
        late.reduce((a, r) => a + r[k], 0) / late.length,
      ]),
    );
    assert.equal(
      run.survivingTrees.reduce((a, g) => a + g.living, 0),
      series.at(-1).living,
    );
    const giftGenes = run.survivingTrees.filter((g) => hasGift(g.tree));
    report.trials.push({
      rule,
      seed,
      path: `research/runs/${prefix}-${seed}/run.json`,
      kernel: run.kernel,
      genomeSampler: run.genomeSampler,
      config: run.config,
      final: {
        ...series.at(-1),
        ...Object.fromEntries(
          [
            "births",
            "deaths",
            "attacks",
            "kills",
            "eaten",
            "photosynthesis",
            "mutations",
            "crossovers",
          ].map((k) => [k, run.records.at(-1)[k]]),
        ),
      },
      lateMean,
      series,
      giftSyntax: {
        genotypes: giftGenes.length,
        cells: giftGenes.reduce((a, g) => a + g.living, 0),
      },
      giftLeaders: giftGenes
        .sort((a, b) => b.living - a.living)
        .slice(0, 8)
        .map((g) => ({ ...g, source: formatTree(g.tree) })),
    });
  }
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
for (const t of report.trials)
  console.log(
    JSON.stringify({
      rule: t.rule,
      seed: t.seed,
      final: t.final,
      lateMean: t.lateMean,
      giftSyntax: t.giftSyntax,
    }),
  );
