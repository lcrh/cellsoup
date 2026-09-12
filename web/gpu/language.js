import { OPS, SENSORS, FIELDS, assemble, disassemble } from "../language.js";
export const GPU_OPS = [
  ...OPS.map((op) =>
    op[0] === "steal"
      ? [
          "attack",
          "v v",
          "Attack a living target within 18. Spend energy to damage its energy; no energy is stolen. Shields reduce damage.",
        ]
      : op[0] === "gradient"
        ? [
            "gradient",
            "r r",
            "Sunlight gradient: relative bearing in degrees, then strength (light change per world unit). Zero when flat.",
          ]
        : op[0] === "give"
          ? [
              "give",
              "v v",
              "Give a fraction (0–1) of current energy to a living target within 18 units, or through a reciprocal link up to its 65-unit breaking distance. Limited by receiver capacity and a tiny donor reserve.",
            ]
          : op,
  ),
  [
    "photosynthesize",
    "r",
    "Harvest available sunlight into energy; return energy gained. Limited by local light and photosynthetic rate per tick, even if repeated.",
  ],
  [
    "scan_corpse",
    "r v",
    "Find the nearest corpse within 60 units and this relative viewing cone (360 = all directions). Return its handle or 0.",
  ],
  [
    "eat",
    "r",
    "Eat up to 3 energy from a random corpse within 18 units; return the amount eaten. No target register required. Competing eaters share finite remains.",
  ],
  [
    "store",
    "r v",
    "Convert up to the requested amount of local energy into stable storage; return amount stored. Keeps a tiny energy reserve.",
  ],
  [
    "mobilize",
    "r v",
    "Convert up to the requested amount of storage into local energy; return energy gained. Cannot rescue a cell whose energy has already reached zero.",
  ],
  [
    "storage_gradient",
    "r r v",
    "Relative bearing and strength toward nearby stored energy within 96 units. Filter: 0 living, 1 corpses, -1 both. Corpses contribute remaining edible value.",
  ],
];
export const GPU_SENSORS = [
  ...SENSORS.map((s) => (s === "food" ? "sunlight" : s)),
  "storage",
  "linked_storage",
  "temperature",
  "linked_temperature",
  "crowding",
];
export const GPU_FIELDS = [...FIELDS, "storage", "alive", "temperature"];
export function compile(source) {
  const result = assemble(source, GPU_OPS, GPU_SENSORS, GPU_FIELDS);
  if (result.length > 64)
    throw Error("GPU genomes currently contain at most 64 instructions.");
  return result;
}
export function decode(buffer) {
  return disassemble(buffer, GPU_OPS, GPU_SENSORS, GPU_FIELDS);
}
