// Recompute saved measurements and verify that natural programs came unchanged
// from the retained world records. No GPU replay required.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { compileTree } from "../web/gpu/trees.js";
import { simulationShader } from "../web/gpu/shader.js";
import {
  traceBytes,
  measureTraceCompression,
  summarizeExecutionStructure,
} from "../web/gpu/trace-compression.js";
const [
  input = "research/results/sensory-motion.json.gz",
  root = "research/results/point-worlds",
] = process.argv.slice(2);
const data = JSON.parse(gunzipSync(await readFile(input)));
const sha = (x) => createHash("sha256").update(x).digest("hex");
assert.equal(data.complete, true);
assert.equal(data.mode, "full");
assert.equal(data.endTick, 900);
assert.equal(data.programs.length, 7);
const source = simulationShader(data.config);
assert.equal(sha(source), data.nominalKernel);
assert.equal(sha(source), data.actualShaderSha256.intact);
assert.equal(
  sha(
    source.replace(
      "c.r[d]=atan2(gradient.y,gradient.x)*57.29578;",
      "c.r[d]=0.0;",
    ),
  ),
  data.actualShaderSha256["zero-bearing"],
);
let pairs = 0;
for (const program of data.programs) {
  const compiled = compileTree(program.tree);
  assert.equal(compiled.source, program.compiledSource);
  if (!program.authored) {
    const raw = gunzipSync(
      await readFile(join(root, program.provenance.run + ".gz")),
    );
    assert.equal(sha(raw), program.provenance.sha256);
    const run = JSON.parse(raw),
      gene = run.survivingTrees.find((g) => g.serial === program.serial);
    assert.deepEqual(gene.tree, program.tree);
    assert.equal(gene.living, program.living);
    assert.equal(gene.depth, program.depth);
  }
  assert.equal(program.trials.length, 16);
  for (const pair of program.trials) {
    pairs++;
    assert.deepEqual(
      traceBytes(pair.intact.trace),
      traceBytes(pair.blind.trace),
      "Reported paired trace equality failed",
    );
    for (const trial of [pair.intact, pair.blind]) {
      assert.equal(trial.trajectory.at(-1).tick, 900);
      assert.equal(trial.trace.beginTick, 1);
      assert.equal(trial.trace.endTickExclusive, 257);
      assert.deepEqual(
        await measureTraceCompression(trial.trace),
        trial.compression,
      );
      assert.deepEqual(
        summarizeExecutionStructure(trial.trace, [
          {
            slot: 0,
            serial: program.serial ?? 0,
            depth: program.depth ?? 0,
            length: compiled.length,
            tree: program.tree,
          },
        ]),
        trial.structure,
      );
      const integrated =
        trial.trajectory
          .slice(1)
          .reduce(
            (sum, r, i) =>
              sum +
              ((r.tick - trial.trajectory[i].tick) *
                (r.sunlight + trial.trajectory[i].sunlight)) /
                2,
            0,
          ) / 900;
      assert.equal(integrated, trial.meanSunlight);
    }
  }
  assert.equal(program.summary.identicalInstructionTracePairs, 16);
}
console.log(
  `PASS ${pairs} paired replays: source provenance, shader ablation, trace equality, gzip, structural measurements and light integration`,
);
