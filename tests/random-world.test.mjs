import test from "node:test";
import assert from "node:assert/strict";
import { randomWorldSettings } from "../web/gpu/random-world.js";
import { defaults } from "../web/gpu/engine.js";
const random = (seed) => () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
test("random habitats stay bounded, retain thermal headroom and sustain immigration at every supported capacity", () => {
  const seen = new Set();
  for (const capacity of [32768, 131072, 262144])
    for (let seed = 0; seed < 1000; seed++) {
      const s = randomWorldSettings({ capacity, rng: random(seed) });
      seen.add(JSON.stringify(s));
      for (const [k, v] of Object.entries(s)) {
        assert.ok(k in defaults, k);
        assert.ok(Number.isFinite(v) && v >= 0, k);
      }
      assert.ok(Number.isInteger(s.seed) && s.seed <= 0xffffffff);
      assert.ok(
        s.safeTemperature >= s.ambientTemperature + 8 &&
          s.safeTemperature <= s.ambientTemperature + 16,
      );
      assert.ok(s.rate > 0 && s.rate <= capacity);
      assert.ok(s.floor > 0 && s.floor <= capacity / 16);
      assert.ok(
        s.upkeep > 0 && s.energyDecay > 0 && s.cpuCost > 0 && s.heatDamage > 0,
      );
      assert.ok(s.solarRate >= 3 && s.solarRate <= 6);
      assert.ok(s.corpseLifetime >= 600 && s.corpseLifetime <= 1800);
      for (const k of ["share", "mutation", "crossover"])
        assert.ok(s[k] > 0 && s[k] < 1);
      assert.ok(s.budget >= 16 && s.budget <= 48);
      for (const k of [
        "capacity",
        "genomeCapacity",
        "treePrograms",
        "initial",
        "divisionMutation",
      ])
        assert.equal(s[k], undefined);
    }
  assert.equal(seen.size, 3000);
});
test("random world settings are reproducible and always change the previous seed", () => {
  assert.deepEqual(
    randomWorldSettings({ rng: random(42) }),
    randomWorldSettings({ rng: random(42) }),
  );
  assert.equal(randomWorldSettings({ previousSeed: 0, rng: () => 0 }).seed, 1);
  assert.equal(
    randomWorldSettings({
      previousSeed: 4294967295,
      rng: () => 1 - Number.EPSILON,
    }).seed,
    0,
  );
});
