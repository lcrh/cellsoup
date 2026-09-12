import { GPU_OPS, GPU_SENSORS, GPU_FIELDS } from "./language.js";
// Mutate a packed assembly genotype without touching the source or its header.
export function mutateAssemblyGenome(buffer, rng = Math.random) {
  const result = buffer.slice(0),
    u = new Uint32Array(result),
    f = new Float32Array(result),
    length = u[0];
  if (
    !Number.isInteger(length) ||
    length < 1 ||
    length > 64 ||
    result.byteLength !== 1056
  )
    throw Error("Invalid assembly genome");
  const choose = (n) => Math.floor(rng() * n),
    at = 8 + choose(length) * 4,
    old = f[at],
    signature = GPU_OPS[old]?.[1];
  if (signature === undefined) throw Error("Invalid opcode");
  const types = signature.split(" ").filter(Boolean),
    arg = choose(3);
  const operand = (type) => {
    if (type === "r") return -1000000 - choose(8);
    if (type === "l") return choose(length);
    if (type === "s") return choose(GPU_SENSORS.length);
    if (type === "p") return choose(GPU_FIELDS.length);
    if (type === "v")
      return rng() < 0.25
        ? -1000000 - choose(8)
        : [-1, 0, 0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 10, 25, 60, 90, 120, 360][
            choose(16)
          ];
    return 0;
  };
  if (rng() < 0.75 && types[arg]) {
    const type = types[arg],
      previous = f[at + arg + 1];
    let value = Math.fround(operand(type));
    if (value === previous) {
      if (type === "r") value = -1000000 - ((-previous - 1000000 + 1) % 8);
      else if (type === "l") value = (previous + 1) % length;
      else if (type === "s") value = (previous + 1) % GPU_SENSORS.length;
      else if (type === "p") value = (previous + 1) % GPU_FIELDS.length;
      else value = previous === 0 ? 1 : 0;
    }
    // A one-instruction branch has no alternative target; change its opcode.
    if (value !== previous) {
      f[at + arg + 1] = value;
      return result;
    }
  }
  const op = (old + 1 + choose(GPU_OPS.length - 1)) % GPU_OPS.length;
  const next = GPU_OPS[op][1].split(" ").filter(Boolean);
  f[at] = op;
  for (let j = 0; j < 3; j++) f[at + j + 1] = operand(next[j]);
  return result;
}
