import { SETTING_GROUPS, WORLD_CAPACITIES } from "./world-controls.js";
import { worldSettingsForSeed } from "./random-world.js";
import { protectCoreFunctionMasks } from "./core-language.js";
import { TREE_SCHEMA } from "./trees.js";

const fields = new Map(
  SETTING_GROUPS.flatMap(([, items]) =>
    items.map(([name, , min, max, step]) => [name, { min, max, step }]),
  ),
);
const maskNames = [0, 1, 2, 3].map((i) => "functionMask" + i);
const knownOverrides = new Set([...fields.keys(), ...maskNames]);
const queryKeys = new Set(["seed", "capacity", "width", "settings"]);
const defaultCapacity = 32768,
  defaultWidth = 4096;
function integer(value, label) {
  if (!/^\d+$/.test(value ?? ""))
    throw Error("Invalid " + label + " in world link");
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw Error("Invalid " + label + " in world link");
  return number;
}
function baseConfig(seed, capacity, width) {
  if (!WORLD_CAPACITIES.includes(capacity))
    throw Error("Unsupported capacity in world link");
  if (
    !Number.isInteger(width) ||
    width < 160 ||
    width > 16384 ||
    width % 32 !== 0
  )
    throw Error("Invalid habitat width in world link");
  return {
    capacity,
    genomeCapacity: capacity / 4,
    treePrograms: 1,
    side: width / 32,
    sources: 1,
    executionTrace: 1,
    ...worldSettingsForSeed(seed, { capacity }),
  };
}
function validate(config) {
  for (const [name, { min, max, step }] of fields) {
    const value = config[name],
      offset = (value - min) / step;
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      Math.abs(offset - Math.round(offset)) > 1e-5
    )
      throw Error("Invalid " + name + " in world link");
  }
  for (const name of maskNames)
    if (
      !Number.isInteger(config[name]) ||
      config[name] < 0 ||
      config[name] > 4294967295
    )
      throw Error("Invalid function palette in world link");
  if (
    config.initial > config.genomeCapacity ||
    config.floor > config.capacity ||
    config.rate > config.capacity ||
    config.capacityRate > Math.min(config.capacity, 64)
  )
    throw Error("Population settings exceed capacity in world link");
  if (
    config.seedEnergy > config.energyCapacity ||
    config.seedStorage > config.storageCapacity ||
    config.divisionCost + 2 * config.minimumBirthEnergy > config.energyCapacity
  )
    throw Error("Energy settings exceed capacity in world link");
  if (config.ambientTemperature > config.safeTemperature)
    throw Error(
      "Overheating threshold is below ambient temperature in world link",
    );
  return { ...config, ...protectCoreFunctionMasks(config, TREE_SCHEMA) };
}
function parseUrl(input) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("Unsupported world link");
  if (url.href.length > 32000) throw Error("World link is too long");
  return url;
}
export function worldConfigFromUrl(input) {
  const url = parseUrl(input),
    query = url.searchParams;
  if (!query.has("seed")) {
    if (query.has("capacity") || query.has("width") || query.has("settings"))
      throw Error("World link is missing its seed");
    return null;
  }
  for (const key of query.keys())
    if (!queryKeys.has(key) || query.getAll(key).length !== 1)
      throw Error("Unknown or repeated world link parameter: " + key);
  const seed = integer(query.get("seed"), "seed");
  const capacity = query.has("capacity")
    ? integer(query.get("capacity"), "capacity")
    : defaultCapacity;
  const width = query.has("width")
    ? integer(query.get("width"), "width")
    : defaultWidth;
  const base = baseConfig(seed, capacity, width);
  let overrides = {};
  if (query.has("settings")) {
    try {
      overrides = JSON.parse(query.get("settings"));
    } catch {
      throw Error("Invalid settings in world link");
    }
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
      throw Error("Invalid settings in world link");
    for (const name of Object.keys(overrides))
      if (!knownOverrides.has(name) || name === "seed")
        throw Error("Unknown world setting: " + name);
  }
  return validate({ ...base, ...overrides });
}
export function worldUrlForConfig(input, config) {
  const url = parseUrl(input);
  const base = baseConfig(config.seed, config.capacity, config.side * 32);
  const active = validate({
    ...base,
    ...Object.fromEntries(
      [...knownOverrides].map((name) => [name, config[name] ?? base[name]]),
    ),
  });
  const overrides = {};
  for (const name of [...knownOverrides].sort())
    if (name !== "seed" && active[name] !== base[name])
      overrides[name] = active[name];
  url.search = "";
  url.hash = "";
  url.searchParams.set("seed", String(active.seed));
  if (active.capacity !== defaultCapacity)
    url.searchParams.set("capacity", String(active.capacity));
  if (active.side * 32 !== defaultWidth)
    url.searchParams.set("width", String(active.side * 32));
  if (Object.keys(overrides).length)
    url.searchParams.set("settings", JSON.stringify(overrides));
  return url.href;
}
