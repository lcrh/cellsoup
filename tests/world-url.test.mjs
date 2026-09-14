import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  worldSettingsForSeed,
  randomWorldSettings,
} from "../web/gpu/random-world.js";
import { worldConfigFromUrl, worldUrlForConfig } from "../web/gpu/world-url.js";
import { WORLD_CAPACITIES } from "../web/gpu/world-controls.js";
import { TREE_SCHEMA, functionEnabled } from "../web/gpu/trees.js";
import { CORE_FUNCTIONS } from "../web/gpu/core-language.js";
const origin = "https://lcrh.github.io/cellsoup/";
const urlWith = (values) => {
  const url = new URL(origin);
  for (const [name, value] of Object.entries(values))
    url.searchParams.set(name, String(value));
  return url.href;
};

test("one seed deterministically chooses settings and function palette independently of ambient randomness", () => {
  for (const capacity of WORLD_CAPACITIES)
    for (const seed of [0, 1, 42, 123456, 4294967295]) {
      const explicit = worldSettingsForSeed(seed, { capacity });
      assert.deepEqual(explicit, worldSettingsForSeed(seed, { capacity }));
      const rolled = randomWorldSettings({
        capacity,
        rng: () => seed / 4294967296,
      });
      assert.deepEqual(rolled, explicit);
      const reopened = worldConfigFromUrl(urlWith({ seed, capacity }));
      for (const [key, value] of Object.entries(explicit))
        assert.equal(reopened[key], value, key);
    }
});
test("normal seed links stay short and retain independent habitat dimensions and capacity", () => {
  for (const capacity of WORLD_CAPACITIES)
    for (const width of [160, 4096, 6144, 16384]) {
      const config = worldConfigFromUrl(urlWith({ seed: 42, capacity, width }));
      const link = worldUrlForConfig(origin + "?v=old#old", config);
      const parsed = new URL(link);
      assert.equal(parsed.searchParams.get("seed"), "42");
      assert.equal(parsed.searchParams.has("settings"), false);
      assert.equal(parsed.hash, "");
      assert.ok(link.length < 100);
      assert.deepEqual(worldConfigFromUrl(link), config);
    }
  assert.equal(
    worldUrlForConfig(origin, worldConfigFromUrl(origin + "?seed=0")),
    origin + "?seed=0",
  );
});
test("custom and loaded settings, population counts and optional function switches round-trip as overrides", () => {
  const config = worldConfigFromUrl(
    origin + "?seed=789&capacity=65536&width=6144",
  );
  Object.assign(config, {
    solarRate: 0,
    maximumAge: 12345,
    initial: 1234,
    storageCapacity: 700,
    energyFillScale: 85,
    storageFillScale: 0,
    moveCost: 0.007,
    linkedRelay: 0.95,
    capacityRate: 512,
    pressureStrength: 23,
    pressureFrequency: 3.7,
    shieldExchange: 0.17,
    attackSpeedBonus: 0.075,
  });
  const id = TREE_SCHEMA.findIndex((fn) => fn.name === "sin"),
    key = "functionMask" + Math.floor(id / 32);
  config[key] = (config[key] & ~(1 << (id % 32))) >>> 0;
  const link = worldUrlForConfig(origin, config);
  assert.ok(new URL(link).searchParams.get("settings").includes("maximumAge"));
  assert.deepEqual(worldConfigFromUrl(link), config);
  assert.equal(functionEnabled("sin", worldConfigFromUrl(link)), false);
  // Changing the seed manually retains the other chosen settings in the link.
  config.seed = 456;
  assert.deepEqual(
    worldConfigFromUrl(worldUrlForConfig(origin, config)),
    config,
  );
});
test("a new roll changes its seed, drops old overrides, and retains the selected space", () => {
  const config = worldConfigFromUrl(
    origin + "?seed=0&capacity=65536&width=6144",
  );
  config.maximumAge = 12345;
  const oldLink = worldUrlForConfig(origin, config);
  const next = {
    ...config,
    ...randomWorldSettings({
      capacity: config.capacity,
      previousSeed: 0,
      rng: () => 0,
    }),
  };
  const link = worldUrlForConfig(oldLink, next);
  assert.equal(next.seed, 1);
  assert.equal(new URL(link).searchParams.has("settings"), false);
  assert.equal(worldConfigFromUrl(link).side, 192);
  assert.equal(worldConfigFromUrl(link).capacity, 65536);
});
test("bad link parameters, unknown settings and incompatible capacities fail without executing anything", () => {
  const badQueries = [
    "?seed=-1",
    "?seed=1.5",
    "?seed=4294967296",
    "?seed=NaN",
    "?seed=",
    "?seed=1&seed=2",
    "?seed=1&unknown=2",
    "?capacity=65536",
    "?seed=1&capacity=128",
    "?seed=1&width=0",
    "?seed=1&width=161",
    "?seed=1&width=16416",
  ];
  for (const query of badQueries)
    assert.throws(() => worldConfigFromUrl(origin + query), query);
  for (const settings of [
    "null",
    "[]",
    '{"__proto__":{"polluted":true}}',
    '{"seed":7}',
    '{"treePrograms":0}',
    '{"upkeep":"alert(1)"}',
    '{"moveCost":0.00001}',
    '{"capacityRate":1025}',
    '{"initial":9000}',
    '{"seedEnergy":1000,"energyCapacity":40}',
    '{"seedStorage":100,"storageCapacity":0}',
    '{"energyFillScale":257}',
    '{"storageFillScale":-1}',
    '{"safeTemperature":0,"ambientTemperature":50}',
    '{"functionMask0":1.5}',
    "not json",
  ])
    assert.throws(
      () => worldConfigFromUrl(urlWith({ seed: 1, settings })),
      settings,
    );
  assert.throws(() => worldConfigFromUrl("javascript:alert(1)"));
  assert.throws(() =>
    worldConfigFromUrl(origin + "?seed=1&settings=" + "x".repeat(32000)),
  );
  assert.equal(worldConfigFromUrl(origin), null);
  assert.equal(worldConfigFromUrl(origin + "?v=0.8"), null);
});
test("old links cannot switch off protected core primitives and retain optional mask choices", () => {
  const settings = Object.fromEntries(
    [0, 1, 2, 3].map((i) => ["functionMask" + i, 0]),
  );
  const config = worldConfigFromUrl(
    urlWith({ seed: 42, settings: JSON.stringify(settings) }),
  );
  for (const name of CORE_FUNCTIONS)
    assert.ok(functionEnabled(name, config), name);
  assert.equal(functionEnabled("sin", config), false);
  assert.deepEqual(
    worldConfigFromUrl(worldUrlForConfig(origin, config)),
    config,
  );
});
test("the address is updated only after the world and its renderer have started", async () => {
  const source = await readFile(
    new URL("../web/gpu/app.js", import.meta.url),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("async function start()"),
    source.indexOf("function selectSlot("),
  );
  assert.ok(
    body.indexOf("window.history.replaceState") >
      body.indexOf("renderer = await createRenderer"),
  );
  assert.ok(
    body.indexOf("window.history.replaceState") >
      body.indexOf("controls(true)"),
  );
  assert.ok(
    body.includes("worldUrlForConfig(location.href, engine.cfg)") ||
      body.includes("worldUrlForConfig(location.href,engine.cfg)"),
  );
  assert.equal((source.match(/history\.replaceState/g) || []).length, 1);
});
