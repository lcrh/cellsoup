import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { functionEnabled } from "../web/gpu/trees.js";
import { defaults } from "../web/gpu/engine.js";
import { SETTING_GROUPS, WORLD_CAPACITIES } from "../web/gpu/world-controls.js";
import { randomWorldSettings } from "../web/gpu/random-world.js";
const controls = SETTING_GROUPS.flatMap(([, fields]) => fields);
const nonSliderSettings = new Set([
  "treePrograms", // The app always uses typed trees.
  "manualArrivals", // Internal scenario/research control.
  "capacity",
  "side", // Independent user-selected capacity and habitat dimensions.
  "genomeCapacity",
  "sources", // Structural GPU dimensions.
  "executionTrace", // Existing record-traces checkbox.
  "functionMask0",
  "functionMask1",
  "functionMask2",
  "functionMask3", // Per-function palette.
]);
const random = (seed) => () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
test("every public model default has an exact-value control and slider", () => {
  const ids = controls.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    Object.keys(defaults)
      .filter((id) => !nonSliderSettings.has(id))
      .sort(),
    ids.toSorted(),
  );
  for (const [id, , min, max, step] of controls) {
    assert.ok(defaults[id] >= min && defaults[id] <= max, id);
    assert.ok(step > 0 && max >= min, id);
  }
});
test("random worlds cover every model slider within its control bounds and maintain coupled constraints", () => {
  const observed = new Map(controls.map(([id]) => [id, new Set()]));
  for (const capacity of WORLD_CAPACITIES)
    for (let seed = 0; seed < 200; seed++) {
      const cfg = randomWorldSettings({ capacity, rng: random(seed) });
      for (const [id, , min, max, step] of controls) {
        assert.ok(Object.hasOwn(cfg, id), id);
        const value = cfg[id];
        assert.ok(value >= min && value <= max, id + ": " + value);
        const offset = (value - min) / step;
        assert.ok(
          Math.abs(offset - Math.round(offset)) < 1e-5,
          id + " step: " + value,
        );
        observed.get(id).add(value);
      }
      assert.ok(Number.isInteger(cfg.initial) && cfg.initial <= capacity / 4);
      assert.ok(cfg.seedEnergy <= cfg.energyCapacity);
      assert.ok(cfg.seedStorage <= cfg.storageCapacity);
      assert.ok(
        cfg.minimumBirthEnergy * 2 + cfg.divisionCost <= cfg.energyCapacity,
      );
      assert.ok(cfg.ambientTemperature <= cfg.safeTemperature);
      assert.equal(cfg.capacity, undefined);
      assert.equal(cfg.side, undefined);
    }
  for (const [id, values] of observed)
    assert.ok(values.size > 1, id + " never varies");
});
test("the capacity selector and saved-setup validator support the 64k tier", async () => {
  assert.deepEqual(WORLD_CAPACITIES, [32768, 65536, 131072, 262144]);
  const html = await readFile(
    new URL("../web/gpu.html", import.meta.url),
    "utf8",
  );
  const selector = html.match(/<select id="capacity">([\s\S]*?)<\/select>/)[1];
  const values = [...selector.matchAll(/value="(\d+)"/g)].map((match) =>
    Number(match[1]),
  );
  assert.deepEqual(values, WORLD_CAPACITIES);
  const cfg = randomWorldSettings({ capacity: 65536, rng: random(64) });
  assert.ok(cfg.initial > 0 && cfg.initial <= 16384);
  assert.ok(cfg.floor <= 4096 && cfg.rate <= 65536);
});

test("random palettes vary core life actions while retaining an energy path and division", () => {
  const disabled = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const cfg = randomWorldSettings({ rng: random(seed) });
    for (const name of ["number", "bool", "slot", "channel", "nop", "seq"])
      assert.ok(functionEnabled(name, cfg), name);
    assert.ok(
      functionEnabled("eat", cfg) ||
        (cfg.solarEnabled && functionEnabled("photosynthesize", cfg)),
    );
    assert.ok(functionEnabled("bud", cfg) || functionEnabled("split", cfg));
    for (const name of [
      "photosynthesize",
      "eat",
      "store",
      "mobilize",
      "bud",
      "split",
      "move",
      "turn",
    ])
      if (!functionEnabled(name, cfg)) disabled.add(name);
  }
  assert.equal(disabled.size, 8);
});
