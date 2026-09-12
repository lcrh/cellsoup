// Run in the temporal-expression experimental checkout: verify interventions,
// complete ecological trials and retained provenance before drawing conclusions.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { compileTree } from "../web/gpu/trees.js";
import { simulationShader } from "../web/gpu/shader.js";
import { withoutTemporalHistory } from "./temporal-ablation.mjs";
const [
  root = "research/results",
  output = join(root, "history-crowding-comparison.json"),
] = process.argv.slice(2);
const sha = (x) => createHash("sha256").update(x).digest("hex");
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const candidate = await read(join(root, "temporal-crowding-candidate.json"));
const sightings = await read(join(root, "crowding-source/sightings.json"));
const censusBytes = gunzipSync(
  await readFile(join(root, "crowding-source", sightings.progressFile)),
);
assert.equal(sha(censusBytes), sightings.progressSha256);
const census = JSON.parse(censusBytes);
for (const sighting of sightings.sightings) {
  const bytes = gunzipSync(
    await readFile(join(root, "crowding-source", sighting.file)),
  );
  assert.equal(sha(bytes), sighting.sha256);
  const observation = JSON.parse(bytes),
    gene = observation.genomes.find(
      (g) => g.serial === candidate.genome.serial,
    );
  assert.ok(gene);
  assert.equal(gene.slot, sighting.slot);
  assert.deepEqual(gene.tree, candidate.genome.tree);
  const row = census.records.find((r) => r.seconds === sighting.seconds);
  assert.equal(row.leaders.find((g) => g[0] === gene.slot)[1], sighting.living);
  if (sighting.seconds === candidate.seconds) {
    assert.equal(sha(bytes), candidate.sha256);
    assert.deepEqual(gene, candidate.genome);
  }
}
const report = {
  scope:
    "Selected naturally observed program, three seeds and both slot assignments per intervention. Final descendants, integrated abundance and neutral comparisons are separate from the manipulated crowding pulse. Six assignments are not six independent environmental seeds. A useful derivative response is not evidence for distributed computing or a general complexity metric.",
  trials: [],
  groups: [],
};
let commonConfig;
const foundersBySeed = new Map();
const compiled = compileTree(candidate.genome.tree);
for (const treatment of ["all", "lag", "delta", "forward", "intact"]) {
  const path = join(root, `history-crowding-${treatment}.json`),
    raw = await readFile(path),
    run = JSON.parse(raw);
  assert.equal(run.complete, true);
  assert.equal(run.mode, "full");
  assert.equal(run.duration, 600);
  assert.equal(run.trials.length, 6);
  assert.deepEqual(run.candidate, candidate);
  let altered = compiled.source;
  if (treatment === "forward")
    altered = altered.replace(/^move .+$/m, "move 1");
  else if (treatment !== "intact")
    altered = withoutTemporalHistory(
      candidate.genome.tree,
      treatment === "all"
        ? null
        : compiled.statefulSlots
            .filter((s) => s.op === treatment)
            .map((s) => s.slot),
    ).changed.source;
  assert.deepEqual(
    run.trials.map((t) => [t.seed, t.blindSlot]),
    [42, 97, 321].flatMap((s) => [
      [s, 0],
      [s, 1],
    ]),
  );
  for (const t of run.trials) {
    assert.equal(t.complete, true);
    assert.equal(t.originalSource, compiled.source);
    assert.equal(t.alteredSource, altered);
    assert.equal(t.compiledSource, compiled.source);
    assert.equal(sha(simulationShader(t.config)), t.nominalKernel);
    const { seed, ...config } = t.config;
    assert.equal(seed, t.seed);
    if (commonConfig) assert.deepEqual(config, commonConfig);
    else commonConfig = config;
    assert.equal(config.capacity, 4096);
    assert.equal(config.rate, 0);
    assert.equal(config.floor, 0);
    assert.equal(config.archiveEnabled, 0);
    assert.equal(config.heatDamage, 0.5);
    if (foundersBySeed.has(seed))
      assert.deepEqual(t.founders, foundersBySeed.get(seed));
    else foundersBySeed.set(seed, t.founders);
    assert.equal(t.founders.length, 64);
    assert.equal(t.founders.filter((c) => c.genome === 0).length, 32);
    assert.ok(t.founders.every((c) => c.energy === 24 && c.storage === 24));
    assert.equal(t.records.length, 21);
    const rows = t.records.map((r, i) => {
      assert.equal(r.seconds, i * 30);
      assert.equal(r.tick, i * 1800);
      const intact = r.groups[1 - t.blindSlot],
        changed = r.groups[t.blindSlot];
      assert.equal(intact.blind, false);
      assert.equal(changed.blind, true);
      assert.equal(r.counters.living, intact.living + changed.living);
      assert.equal(
        r.counters.living,
        64 + r.counters.births - r.counters.deaths,
      );
      for (const g of r.groups)
        assert.equal(g.living, 32 + g.births - g.deaths);
      return {
        seconds: r.seconds,
        intact,
        changed,
        intactShare: r.counters.living
          ? intact.living / r.counters.living
          : null,
      };
    });
    const integral = (k) =>
      rows
        .slice(1)
        .reduce((sum, r, i) => sum + 15 * (r[k].living + rows[i][k].living), 0);
    report.trials.push({
      treatment,
      seed,
      changedSlot: t.blindSlot,
      file: path,
      sha256: sha(raw),
      rows,
      final: rows.at(-1),
      cellSeconds: { intact: integral("intact"), changed: integral("changed") },
    });
  }
  const ts = report.trials.filter((t) => t.treatment === treatment),
    shares = ts.map((t) => t.final.intactShare);
  const group = {
    treatment,
    finalWins: ts.filter((t) => t.final.intact.living > t.final.changed.living)
      .length,
    integralWins: ts.filter((t) => t.cellSeconds.intact > t.cellSeconds.changed)
      .length,
    shareRange: [Math.min(...shares), Math.max(...shares)],
  };
  report.groups.push(group);
  console.log(JSON.stringify(group));
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
