// Validate completed establishment assays and summarize separately from the
// isolated light-navigation task. No single combined complexity score.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { simulationShader } from "../web/gpu/shader.js";
import { compileTree } from "../web/gpu/trees.js";
const [
  root = "research/results",
  output = "research/results/sensory-establishment-comparison.json",
] = process.argv.slice(2);
const sha = (x) => createHash("sha256").update(x).digest("hex");
const datasets = [
  ["zero", "sensory-establishment.json", 24],
  ["no-heat-damage", "sensory-establishment-no-heat-damage.json", 6],
  ["forward", "sensory-establishment-forward.json", 6],
  ["no-implicit-wait", "sensory-establishment-no-implicit-wait.json", 24],
];
const report = {
  scope:
    "Final abundance, offspring and time-integrated abundance in balanced two-slot clonal competitions. Three environmental seeds, both intervention assignments. These are ecological assay results, not evolutionary replicates or a general complexity estimate. A sensor-dependent advantage against zero can reflect useful movement; the constant-forward intervention checks one alternative, not every possible open-loop controller.",
  trials: [],
};
let baseConfig;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const [treatment, file, count] of datasets) {
  const raw = await readFile(join(root, file));
  const run = JSON.parse(raw);
  assert.equal(run.complete, true);
  assert.equal(run.mode, "full");
  assert.equal(run.duration, 600);
  assert.equal(run.trials.length, count);
  assert.equal(
    run.treatment ?? "zero",
    treatment === "no-implicit-wait" ? "zero" : treatment,
  );
  for (const t of run.trials) {
    assert.equal(t.complete, true);
    assert.equal(t.records.length, 21);
    assert.equal(t.config.heatDamage, treatment === "no-heat-damage" ? 0 : 0.5);
    const { heatDamage, seed, ...common } = t.config;
    if (baseConfig) assert.deepEqual(common, baseConfig);
    else baseConfig = common;
    // Seed is an experimental factor, not a mismatched ecology setting.
    const source = simulationShader(t.config);
    assert.equal(sha(source), t.nominalKernel);
    const target = "c.r[d]=atan2(gradient.y,gradient.x)*57.29578;";
    assert.equal(source.split(target).length, 2);
    const altered = source.replace(
      target,
      `c.r[d]=select(atan2(gradient.y,gradient.x)*57.29578,${treatment === "forward" ? "180.0" : "0.0"},c.machine.y==${t.blindSlot}u);`,
    );
    assert.equal(sha(altered), t.actualShaderSha256);
    const program = run.programs.find((p) => p.id === t.program);
    const compiled = compileTree(program.tree).source;
    assert.equal(
      treatment === "no-implicit-wait"
        ? compiled.replace(/\nwait 0\njmp ROOT$/, "\njmp ROOT")
        : compiled,
      t.compiledSource,
    );
    assert.equal(t.founders.length, 64);
    assert.equal(t.founders.filter((c) => c.genome === 0).length, 32);
    const rows = t.records.map((r, index) => {
      assert.equal(r.seconds, index * 30);
      assert.equal(r.tick, r.seconds * 60);
      const intact = r.groups[1 - t.blindSlot],
        changed = r.groups[t.blindSlot];
      assert.equal(intact.blind, false);
      assert.equal(changed.blind, true);
      assert.equal(r.counters.living, intact.living + changed.living);
      assert.equal(
        r.counters.living,
        64 + r.counters.births - r.counters.deaths,
      );
      for (const g of r.groups) {
        assert.equal(g.living, 32 + g.births - g.deaths);
        assert.ok(g.living >= 0);
      }
      return {
        seconds: r.seconds,
        intact,
        changed,
        intactShare: r.counters.living
          ? intact.living / r.counters.living
          : null,
      };
    });
    const integral = (which) =>
      rows
        .slice(1)
        .reduce(
          (sum, r, i) =>
            sum + (30 * (r[which].living + rows[i][which].living)) / 2,
          0,
        );
    report.trials.push({
      treatment,
      file,
      sourceSha256: sha(raw),
      program: t.program,
      seed: t.seed,
      changedSlot: t.blindSlot,
      rows,
      final: rows.at(-1),
      cellSeconds: { intact: integral("intact"), changed: integral("changed") },
      lateLiving: {
        intact: mean(rows.slice(10).map((r) => r.intact.living)),
        changed: mean(rows.slice(10).map((r) => r.changed.living)),
      },
    });
  }
}
report.groups = [];
for (const key of new Set(
  report.trials.map((t) => `${t.treatment}/${t.program}`),
)) {
  const ts = report.trials.filter((t) => `${t.treatment}/${t.program}` === key);
  assert.equal(ts.length, 6);
  const shares = ts.map((t) => t.final.intactShare);
  const group = {
    key,
    trials: 6,
    intactFinalWins: ts.filter(
      (t) => t.final.intact.living > t.final.changed.living,
    ).length,
    intactIntegralWins: ts.filter(
      (t) => t.cellSeconds.intact > t.cellSeconds.changed,
    ).length,
    finalShareRange: shares.every((x) => x === null)
      ? null
      : [
          Math.min(...shares.filter((x) => x !== null)),
          Math.max(...shares.filter((x) => x !== null)),
        ],
  };
  report.groups.push(group);
  console.log(JSON.stringify(group));
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
