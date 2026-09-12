// Require completed, matched worlds before comparing an experimental substrate.
// Structural descriptors are not a substitute for causal behavioral validation.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
const [controlRoot, variantRoot, variant, output] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/compare-evolution-variants.mjs control-runs variant-runs cadence|temporal output.json",
  );
assert.ok(["cadence", "temporal"].includes(variant));
async function json(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return JSON.parse(gunzipSync(await readFile(path + ".gz")));
  }
}
const mean = (xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
const has = (t, ops) => ops.includes(t.op) || t.args.some((a) => has(a, ops));
const depth = (t) => 1 + Math.max(0, ...t.args.map(depth));
const nodes = (t) => 1 + t.args.reduce((n, a) => n + nodes(a), 0);
const records = [
  "living",
  "bornInWorld",
  "livingArrivals",
  "linkedCells",
  "movingBodyCellsWithRecentThrust",
  "largestMovingBodyWithRecentThrust",
  "variants",
  "mature",
  "meanAge",
  "meanTemperature",
];
const report = {
  variant,
  scope:
    "Three one-hour worlds per condition. Seven late censuses at 30–60 minutes are summarized within each world, not treated as independent replicates. Founder equivalence was calibrated separately: 1,000 samples for cadence and all 8,192 initial trees per seed for temporal expressions. GPU contention prevents exact population counterfactuals. Population, motion, ancestry depth, tree size and temporal syntax are separate descriptors; no combined complexity score or promotion decision follows automatically.",
  trials: [],
};
for (const seed of [42, 97, 321]) {
  let reference;
  for (const condition of ["control", variant]) {
    const root = condition === "control" ? controlRoot : variantRoot;
    const prefix =
      condition === "control"
        ? "continuous-cadence-control"
        : variant === "cadence"
          ? "continuous-cadence-variant"
          : "continuous-temporal-variant";
    const directory = join(root, `${prefix}-${seed}`);
    const run = await json(join(directory, "run.json")),
      progress = await json(join(directory, "progress.json"));
    assert.equal(progress.complete, true);
    assert.deepEqual(run.records, progress.records);
    assert.deepEqual(run.config, run.finalConfig);
    assert.equal(run.closure, null);
    assert.equal(run.config.seed, seed);
    assert.equal(run.config.capacity, 32768);
    assert.equal(run.config.initial, 8192);
    assert.equal(run.config.rate, 8);
    assert.equal(run.config.floor, 0);
    const expected =
      condition === "control"
        ? "typed-sequences-state-v2"
        : variant === "cadence"
          ? "typed-sequences-state-no-implicit-wait-v1"
          : "typed-sequences-state-temporal-mutations-v1";
    assert.equal(run.genomeSampler, expected);
    if (reference) {
      assert.deepEqual(run.config, reference.config);
      assert.equal(run.kernel, reference.kernel);
    } else reference = run;
    assert.deepEqual(
      run.records.map((r) => r.seconds),
      Array.from({ length: 13 }, (_, i) => i * 300),
    );
    const census = run.records.map((r) => {
      assert.equal(
        r.living,
        r.randomArrivals + r.sampledArrivals + r.births - r.deaths,
      );
      assert.equal(r.living, r.bornInWorld + r.livingArrivals);
      assert.equal(r.recentThrustWindowTicks, 60);
      for (const key of records) assert.ok(Number.isFinite(r[key]));
      return {
        seconds: r.seconds,
        ...Object.fromEntries(records.map((k) => [k, r[k]])),
        linkedFraction: r.living ? r.linkedCells / r.living : 0,
        movingThrustFraction: r.living
          ? r.movingBodyCellsWithRecentThrust / r.living
          : 0,
        bornFraction: r.living ? r.bornInWorld / r.living : 0,
        births: r.births,
        deaths: r.deaths,
        randomArrivals: r.randomArrivals,
        sampledArrivals: r.sampledArrivals,
      };
    });
    const survivors = run.survivingTrees,
      total = census.at(-1).living;
    assert.equal(
      survivors.reduce((n, g) => n + g.living, 0),
      total,
    );
    for (const g of survivors) {
      assert.ok(g.living > 0);
      assert.ok(nodes(g.tree) <= 32);
    }
    const weighted = (fn) =>
      total
        ? survivors.reduce((n, g) => n + g.living * fn(g), 0) / total
        : null;
    const late = census.filter((r) => r.seconds >= 1800);
    const keys = [
      ...records,
      "linkedFraction",
      "movingThrustFraction",
      "bornFraction",
    ];
    const temporal = survivors.filter((g) =>
      has(g.tree, ["lag", "delta", "smooth"]),
    );
    report.trials.push({
      condition,
      seed,
      directory,
      config: run.config,
      kernel: run.kernel,
      sampler: run.genomeSampler,
      census,
      lateMean: Object.fromEntries(
        keys.map((k) => [k, mean(late.map((r) => r[k]))]),
      ),
      finalStructure: {
        genotypes: survivors.length,
        meanMutationDepth: weighted((g) => g.depth),
        meanTreeDepth: weighted((g) => depth(g.tree)),
        meanTreeNodes: weighted((g) => nodes(g.tree)),
        temporalGenotypes: temporal.length,
        temporalCells: temporal.reduce((n, g) => n + g.living, 0),
        explicitMemoryReadCells: survivors
          .filter((g) => has(g.tree, ["memory"]))
          .reduce((n, g) => n + g.living, 0),
      },
      temporalLeaders: temporal
        .sort((a, b) => b.living - a.living)
        .slice(0, 12),
    });
  }
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
for (const t of report.trials)
  console.log(
    JSON.stringify({
      condition: t.condition,
      seed: t.seed,
      late: t.lateMean,
      structure: t.finalStructure,
    }),
  );
