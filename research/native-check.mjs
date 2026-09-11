import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { engine, snapshot } from "../tests/helpers.mjs";
for (const seed of [42, 97]) {
  const result = spawnSync(
    "research/bin/headless",
    [seed, 60, 60, 2048, 8, 0.5, 1, 0].map(String),
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr);
  const native = result.stdout
    .trim()
    .split("\n")
    .map(JSON.parse)
    .filter((r) => r.type === "sample")
    .at(-1);
  const e = await engine(seed, { legacyCosts: false });
  e.reset(seed);
  e.configure(24, 8192, 0, 1);
  e.configure_arrivals(2048, 0.5, 0.8, 8);
  e.seed_random(512);
  for (let i = 0; i < 6; i++) e.step(600);
  const { stats } = snapshot(e);
  for (const [key, index] of [
    ["cells", 0],
    ["births", 2],
    ["deaths", 3],
    ["archive", 19],
  ])
    assert.equal(native[key], stats[index], key);
  assert.ok(Math.abs(native.totalEnergy - stats[6]) < 0.00001);
  assert.equal(native.importedEnergy, (stats[17] + stats[18]) * 70);
  assert.ok(native.foodAdded > 0 && native.absorbedEnergy > 0);
  console.log(
    JSON.stringify({
      seed,
      parity: true,
      cells: native.cells,
      births: native.births,
    }),
  );
}
