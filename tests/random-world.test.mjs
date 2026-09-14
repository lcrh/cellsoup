import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  randomWorldSettings,
  worldSettingsForSeed,
} from "../web/gpu/random-world.js";
import { defaults } from "../web/gpu/engine.js";
import { CORE_FUNCTIONS } from "../web/gpu/core-language.js";
import { functionEnabled } from "../web/gpu/trees.js";
const random = (seed) => () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
test("random habitats stay bounded, retain thermal headroom and sustain immigration at every supported capacity", () => {
  const seen = new Set(),
    strengths = new Set(),
    frequencies = new Set();
  for (const capacity of [32768, 65536, 131072, 262144])
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
      assert.ok(
        s.capacityRate >= 16 && s.capacityRate <= Math.min(capacity, 1024),
      );
      assert.ok(s.floor > 0 && s.floor <= capacity / 16);
      assert.ok([4, 8, 12, 18, 24].includes(s.pressureStrength));
      assert.ok([0.5, 1, 2, 4, 8].includes(s.pressureFrequency));
      strengths.add(s.pressureStrength);
      frequencies.add(s.pressureFrequency);
      assert.ok(
        s.upkeep > 0 && s.energyDecay > 0 && s.cpuCost > 0 && s.heatDamage > 0,
      );
      assert.ok(s.solarRate >= 3 && s.solarRate <= 20);
      assert.ok(s.corpseLifetime >= 600 && s.corpseLifetime <= 1800);
      for (const k of ["share", "mutation", "crossover"])
        assert.ok(s[k] > 0 && s[k] < 1);
      assert.ok(s.budget >= 16 && s.budget <= 48);
      for (const k of [
        "capacity",
        "genomeCapacity",
        "treePrograms",
        "side",
        "divisionMutation",
      ])
        assert.equal(s[k], undefined);
    }
  assert.equal(seen.size, 4000);
  assert.equal(strengths.size, 5);
  assert.equal(frequencies.size, 5);
});

test("10,000 seeded worlds retain their palette and non-target settings while allowing photosynthesis headroom", () => {
  const preserved = createHash("sha256");
  let sunny = 0,
    sunless = 0,
    increasedKnee = 0;
  for (let seed = 0; seed < 10000; seed++) {
    const s = worldSettingsForSeed(seed);
    assert.deepEqual(s, worldSettingsForSeed(seed));
    assert.equal(s.generationDepth, 6);
    assert.equal(s.founderActions, 6);
    for (const op of CORE_FUNCTIONS) assert.ok(functionEnabled(op, s), op);
    assert.ok(s.solarRate >= 3 && s.solarRate <= 20);
    assert.equal(s.solarRate * 2, Math.round(s.solarRate * 2));
    assert.ok(s.energyFillScale >= 40 && s.energyFillScale <= 256);
    if (s.solarEnabled) {
      sunny++;
      const threshold = s.divisionCost + 2 * s.minimumBirthEnergy;
      const required = s.upkeep + s.energyDecay * threshold + 0.5;
      const input =
        0.7 * s.photoEfficiency * Math.exp(-threshold / s.energyFillScale);
      assert.ok(s.solarRate * input >= required - 1e-12, `seed ${seed}`);
      // Rates above the old ceiling must be the smallest sufficient half-step.
      if (s.solarRate > 6) assert.ok((s.solarRate - 0.5) * input < required);
      if (s.energyFillScale > 140) {
        increasedKnee++;
        assert.ok(
          20 *
            0.7 *
            s.photoEfficiency *
            Math.exp(-threshold / (s.energyFillScale - 20)) <
            required,
        );
      }
    } else {
      sunless++;
      assert.ok(s.solarRate <= 6);
      assert.ok([40, 60, 80, 100, 140].includes(s.energyFillScale));
    }
    const unchanged = { ...s };
    delete unchanged.generationDepth;
    delete unchanged.founderActions;
    delete unchanged.capacityRate;
    delete unchanged.pressureStrength;
    delete unchanged.pressureFrequency;
    delete unchanged.shieldExchange;
    // In sunless worlds even the old solar rate and fill knee must be exact.
    if (s.solarEnabled) {
      delete unchanged.solarRate;
      delete unchanged.energyFillScale;
    }
    preserved.update(JSON.stringify(unchanged) + "\n");
  }
  assert.equal(sunny, 8755);
  assert.equal(sunless, 1245);
  assert.ok(increasedKnee > 0);
  // Captured before the v0.9.6 influx change, excluding the intentionally
  // tuned generation, energy and capacity-rate settings. Preserves RNG draws
  // and every other setting, including optional masks.
  assert.equal(
    preserved.digest("hex"),
    "f2e26f8185f5627c88916e8e6e75c2e651a6f2d2795281b64d13288cc0caa70d",
  );
});

test("candidate settings match the three balanced GPU trial fixtures", () => {
  for (const [seed, solarRate, energyFillScale] of [
    [42, 5.5, 140],
    [97, 11.5, 100],
    [321, 8, 100],
  ]) {
    const s = worldSettingsForSeed(seed);
    assert.equal(s.generationDepth, 6);
    assert.equal(s.founderActions, 6);
    assert.equal(s.solarRate, solarRate);
    assert.equal(s.energyFillScale, energyFillScale);
  }
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
