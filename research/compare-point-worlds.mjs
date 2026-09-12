// Require all six completed worlds before comparing the operation-only mutation.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { formatTree } from "../web/gpu/trees.js";
const [controlRoot, variantRoot, output] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/compare-point-worlds.mjs control-runs variant-runs output.json",
  );
const json = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return JSON.parse(gunzipSync(await readFile(path + ".gz")));
  }
};
const mean = (xs) => xs.reduce((sum, n) => sum + n, 0) / xs.length;
const keys = [
  "living",
  "linkedCells",
  "movingBodyCellsWithRecentThrust",
  "largestMovingBodyWithRecentThrust",
  "variants",
];
function has(t, op) {
  return t.op === op || t.args.some((c) => has(c, op));
}
const report = {
  scope:
    "Three one-hour trajectories per sampler with matched ecology and observer. Same seeds are not deterministic GPU counterfactuals. Late census means use seven snapshots at 30–60 minutes; late behavioral means use overlapping 62-second windows ending after minute 30, not independent replicates. The old observer model size is a historical diagnostic, not a trusted complexity objective. Colony persistence and causal sensory or communication dependence must be considered separately; none alone establishes adaptive complexity.",
  trials: [],
};
for (const seed of [42, 97, 321]) {
  let reference;
  for (const [condition, root, sampler] of [
    ["control", controlRoot, "typed-sequences-state-v2"],
    ["mutation", variantRoot, "typed-sequences-state-point-v1"],
  ]) {
    const directory = join(root, `continuous-point-${condition}-${seed}`);
    const run = await json(join(directory, "run.json")),
      progress = await json(join(directory, "progress.json")),
      behavior = await json(join(directory, "behavior.json"));
    assert.equal(progress.complete, true);
    assert.equal(behavior.complete, true);
    assert.deepEqual(run.records, progress.records);
    assert.deepEqual(run.config, run.finalConfig);
    assert.deepEqual(run.config, behavior.config);
    assert.equal(run.kernel, behavior.kernel);
    assert.equal(run.genomeSampler, sampler);
    assert.equal(behavior.genomeSampler, sampler);
    assert.equal(run.config.seed, seed);
    assert.equal(run.config.capacity, 32768);
    assert.equal(run.config.initial, 8192);
    assert.equal(run.config.floor, 0);
    assert.equal(run.config.rate, 8);
    assert.equal(run.closure, null);
    if (reference) {
      assert.deepEqual(run.config, reference.config);
      assert.equal(run.kernel, reference.kernel);
    } else reference = run;
    assert.equal(behavior.observer, "behavior-mdl-v1");
    assert.equal(behavior.sampleTicks, 120);
    assert.equal(behavior.window, 32);
    assert.equal(behavior.samples, 1801);
    assert.equal(behavior.sampledThroughTick, 216000);
    assert.deepEqual(
      behavior.measurements.map((m) => m.tick),
      Array.from({ length: 222 }, (_, i) => 3720 + i * 960),
    );
    assert.equal(behavior.toTick, 215880);
    assert.equal(behavior.fromTick, 212160);
    assert.equal(behavior.frames.length, 32);
    for (const f of behavior.frames) assert.equal(f.length, 6144);
    assert.deepEqual(
      run.records.map((r) => r.seconds),
      Array.from({ length: 13 }, (_, i) => i * 300),
    );
    const census = run.records.map((r) => {
      assert.equal(
        r.living,
        r.randomArrivals + r.sampledArrivals + r.births - r.deaths,
      );
      assert.equal(r.recentThrustWindowTicks, 60);
      for (const key of keys) assert.ok(Number.isFinite(r[key]));
      return {
        seconds: r.seconds,
        ...Object.fromEntries(keys.map((k) => [k, r[k]])),
        linkedFraction: r.living ? r.linkedCells / r.living : 0,
        movingThrustFraction: r.living
          ? r.movingBodyCellsWithRecentThrust / r.living
          : 0,
      };
    });
    const series = behavior.measurements.map((m) => {
      const e = m.estimate,
        s = m.shuffled;
      for (const x of [e, s]) {
        assert.equal(x.version, behavior.observer);
        assert.equal(x.width, 32);
        assert.equal(x.channels, 6);
        assert.equal(x.testTokens, 49152);
        assert.equal(x.epiplexityBits, x.selected.modelBits);
      }
      return {
        seconds: m.tick / 60,
        living: m.living,
        modelBits: e.epiplexityBits,
        shuffledBits: s.epiplexityBits,
        noise: e.unpredictedBitsPerToken,
        gain:
          e.heldOutGainBits === null ? null : e.heldOutGainBits / e.testTokens,
        model: e.selected.id,
      };
    });
    const lateCensus = census.filter((r) => r.seconds >= 1800),
      lateBehavior = series.filter((r) => r.seconds >= 1800);
    assert.equal(lateBehavior.length, 113);
    // A deterministic model may fail on held-out data. Preserve that failure;
    // do not coerce JSON null (Infinity) to zero or silently omit failed windows.
    const failed = lateBehavior.filter(
      (r) => r.gain === null || r.noise === null,
    ).length;
    const meanKeys = [...keys, "linkedFraction", "movingThrustFraction"];
    const survivors = run.survivingTrees;
    assert.equal(
      survivors.reduce((n, g) => n + g.living, 0),
      census.at(-1).living,
    );
    report.trials.push({
      condition,
      seed,
      config: run.config,
      kernel: run.kernel,
      sampler,
      census,
      behavior: series,
      lateCensus: Object.fromEntries(
        meanKeys.map((k) => [k, mean(lateCensus.map((r) => r[k]))]),
      ),
      lateBehavior: {
        windows: lateBehavior.length,
        modelBits: mean(lateBehavior.map((r) => r.modelBits)),
        shuffledBits: mean(lateBehavior.map((r) => r.shuffledBits)),
        noise: failed ? null : mean(lateBehavior.map((r) => r.noise)),
        gain: failed ? null : mean(lateBehavior.map((r) => r.gain)),
        failedWindows: failed,
        positiveGainFraction:
          lateBehavior.filter((r) => r.gain !== null && r.gain > 0).length /
          lateBehavior.length,
      },
      kinSyntax: {
        genotypes: survivors.filter((g) => has(g.tree, "kin")).length,
        cells: survivors
          .filter((g) => has(g.tree, "kin"))
          .reduce((n, g) => n + g.living, 0),
      },
      kinLeaders: survivors
        .filter((g) => has(g.tree, "kin"))
        .sort((a, b) => b.living - a.living)
        .slice(0, 10)
        .map((g) => ({ ...g, source: formatTree(g.tree) })),
    });
  }
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
for (const t of report.trials)
  console.log(
    JSON.stringify({
      condition: t.condition,
      seed: t.seed,
      census: t.lateCensus,
      behavior: t.lateBehavior,
      kinSyntax: t.kinSyntax,
    }),
  );
