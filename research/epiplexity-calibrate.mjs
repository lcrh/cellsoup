import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  estimateBehavior,
  shuffleBehavior,
  encodeBehaviorModel,
  decodeBehaviorModel,
} from "../web/gpu/epiplexity.js";
const output = process.argv[2];
if (!output)
  throw Error("Usage: node research/epiplexity-calibrate.mjs output.json");
let seed = 1743;
const random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
};
const iid = Array.from({ length: 32 }, () =>
  Uint8Array.from({ length: 32 * 32 * 6 }, () => Math.floor(random() * 16)),
);
const frozen = Array.from({ length: 32 }, () => iid[0].slice()),
  cycle = iid.map((f) => f.slice()),
  coupled = iid.map((f) => f.slice());
for (let t = 1; t < 32; t++)
  for (let i = 0; i < 32 * 32 * 6; i++) {
    cycle[t][i] = (cycle[t - 1][i] + 1) % 16;
    const tile = Math.floor(i / 6),
      ch = i % 6,
      x = tile % 32,
      left = (tile - x + ((x + 31) % 32)) * 6 + ch;
    coupled[t][i] = coupled[t - 1][i] ^ coupled[t - 1][left];
  }
const report = {
  scope:
    "Calibration of the fixed finite observer, not ground-truth epiplexity values. All controls have 32 frames, 32×32 tiles and six 16-symbol channels. The coupled process has a short XOR generating rule; this observer uses a learned table because XOR is absent from its model library. These tests expose observer dependence rather than proving universal complexity.",
  cases: [],
};
for (const [name, frames] of [
  ["empty", Array.from({ length: 32 }, () => new Uint8Array(6144))],
  ["uniform-noise", iid],
  ["frozen-random-map", frozen],
  ["simple-cycle", cycle],
  ["local-coupling", coupled],
]) {
  const started = performance.now(),
    e = estimateBehavior(frames),
    s = estimateBehavior(shuffleBehavior(frames));
  const code = encodeBehaviorModel(e.model);
  assert.equal(code.bitLength, e.epiplexityBits);
  assert.deepEqual(decodeBehaviorModel(code), e.model);
  report.cases.push({
    name,
    estimate: e,
    shuffled: s,
    analysisMs: performance.now() - started,
  });
  console.log(
    name,
    e.selected.id,
    e.epiplexityBits,
    e.unpredictedBitsPerToken,
    "shuffled",
    s.epiplexityBits,
  );
}
assert.equal(report.cases[1].estimate.selected.id, "uniform");
assert.equal(report.cases[2].estimate.selected.id, "copy1");
assert.equal(report.cases[3].estimate.selected.id, "shift1");
assert.equal(report.cases[4].estimate.selected.id, "neighbors");
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
