import { OPS, SENSORS, FIELDS, assemble, disassemble } from "../language.js";
export const GPU_OPS = [
  ...OPS,
  [
    "enzyme",
    "v",
    "Set target enzyme allocation 0–1. Allocation changes gradually; opposite specialists exchange complementary nutrients over bonds.",
  ],
];
export const GPU_SENSORS = [
  ...SENSORS,
  "nutrient_a",
  "nutrient_b",
  "enzyme",
  "reserve_a",
  "reserve_b",
];
export function compile(source) {
  const result = assemble(source, GPU_OPS, GPU_SENSORS, FIELDS);
  if (result.length > 64)
    throw Error("GPU genomes currently contain at most 64 instructions.");
  return result;
}
export function decode(buffer) {
  return disassemble(buffer, GPU_OPS, GPU_SENSORS, FIELDS);
}
