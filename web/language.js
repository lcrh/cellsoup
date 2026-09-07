// Single opcode schema: assembler, reference UI, and disassembler share these definitions.
export const OPS = [
  ["nop", "", "Do nothing."],
  ["mov", "r v", "Copy a value into a register."],
  ["add", "r v", "Add to a register."],
  ["sub", "r v", "Subtract from a register."],
  ["mul", "r v", "Multiply a register."],
  ["div", "r v", "Divide; division by zero returns 0."],
  ["mod", "r v", "Remainder; zero divisor returns 0."],
  ["rand", "r v", "Uniform random value in [0, value)."],
  ["jmp", "l", "Jump to a label."],
  ["jz", "v l", "Jump if zero."],
  ["jnz", "v l", "Jump if nonzero."],
  ["jgt", "v v l", "Jump if first > second."],
  ["jlt", "v v l", "Jump if first < second."],
  ["jeq", "v v l", "Jump if equal."],
  ["wait", "v", "Yield now, then sleep this many additional ticks."],
  [
    "sense",
    "r s",
    "Read a sensor: energy, food, age, bonds, heading, id, generation, tag, ahead, left, right.",
  ],
  [
    "scan",
    "r v v",
    "Nearest target within 60 units: tag (-1 = any), cone (360 = all directions). Returns ID or 0.",
  ],
  [
    "peek",
    "r v p",
    "Read target ID: energy, tag, distance, bearing, kin, shield, bonds. Missing target returns 0.",
  ],
  [
    "split",
    "r",
    "Detached division: 0 parent, 1 child, -1 failure. Costs 12; requires 32 energy.",
  ],
  [
    "bud",
    "r",
    "Connected division. Same return values and energy rules as split.",
  ],
  ["turn", "v", "Rotate clockwise by degrees."],
  [
    "move",
    "v",
    "Propel along heading, strength -1…1. Costs 0.04 × |strength|.",
  ],
  [
    "link",
    "v",
    "Bond to target ID within 24 units. Costs 0.5 on success; six bonds maximum.",
  ],
  ["unlink", "v", "Cut bond to target ID; 0 cuts all bonds."],
  [
    "contract",
    "v",
    "Set own spring rest-length multiplier (0.55…1.5). Costs 0.08.",
  ],
  [
    "steal",
    "v v",
    "Take up to amount (max 3) energy from target within 18. Costs 0.08; 75% efficient; shields resist.",
  ],
  ["give", "v v", "Transfer up to amount (max 10) energy to target within 18."],
  ["tag", "v", "Set a public tag, 0…255. Tags can be imitated."],
  ["shield", "v", "Set protection 0…1; upkeep 0.012 × shield per tick."],
  ["color", "v", "Set display hue in degrees; inherited at division."],
  [
    "emit",
    "v v",
    "Set signal channel 0…3 to value -100…100. Costs 0.01; decays each tick.",
  ],
  [
    "listen",
    "r v",
    "Sum nearby signals on channel, weighted by distance within 60.",
  ],
  ["abs", "r v", "Absolute value."],
  ["min", "r v", "Clamp register down to value."],
  ["max", "r v", "Clamp register up to value."],
];
export const SENSORS = [
  "energy",
  "food",
  "age",
  "bonds",
  "heading",
  "id",
  "generation",
  "tag",
  "ahead",
  "left",
  "right",
];
export const FIELDS = [
  "energy",
  "tag",
  "distance",
  "bearing",
  "kin",
  "shield",
  "bonds",
];
const opcode = new Map(OPS.map((o, i) => [o[0], i]));
export function assemble(source) {
  const labels = new Map(),
    instructions = [];
  for (const [i, raw] of source.split("\n").entries()) {
    let text = raw.replace(/;.*/, "").trim().toLowerCase();
    if (!text) continue;
    const label = text.match(/^([a-z_]\w*):/);
    if (label) {
      if (labels.has(label[1]))
        throw new Error(`Line ${i + 1}: duplicate label ${label[1]}.`);
      labels.set(label[1], instructions.length);
      text = text.slice(label[0].length).trim();
    }
    if (text)
      instructions.push({
        parts: text.replace(/,/g, " ").split(/\s+/),
        line: i + 1,
      });
  }
  if (!instructions.length) throw new Error("Write at least one instruction.");
  if (instructions.length > 256)
    throw new Error("A genome can contain at most 256 instructions.");
  const buffer = new ArrayBuffer(instructions.length * 16),
    view = new DataView(buffer);
  for (const [i, { parts, line }] of instructions.entries()) {
    const op = opcode.get(parts[0]);
    if (op === undefined)
      throw new Error(`Line ${line}: unknown instruction “${parts[0]}”.`);
    const types = OPS[op][1].split(" ").filter(Boolean);
    if (parts.length !== types.length + 1)
      throw new Error(`Line ${line}: use ${parts[0]} ${OPS[op][1]}.`);
    view.setInt32(i * 16, op, true);
    types.forEach((type, j) => {
      const token = parts[j + 1];
      let value;
      if (type === "l") {
        value = labels.get(token);
        if (value === undefined || value >= instructions.length)
          throw new Error(`Line ${line}: unknown or empty label “${token}”.`);
      } else if (type === "s" || type === "p") {
        value = (type === "s" ? SENSORS : FIELDS).indexOf(token);
        if (value < 0)
          throw new Error(
            `Line ${line}: invalid ${type === "s" ? "sensor" : "field"} “${token}”.`,
          );
      } else if (/^r[0-7]$/.test(token)) value = -1000000 - Number(token[1]);
      else {
        if (type === "r")
          throw new Error(`Line ${line}: destination must be r0…r7.`);
        if (!/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/.test(token))
          throw new Error(
            `Line ${line}: expected a number or r0…r7, got “${token}”.`,
          );
        value = Number(token);
        if (!Number.isFinite(value) || Math.abs(value) > 999999)
          throw new Error(`Line ${line}: number outside ±999999.`);
      }
      view.setFloat32(i * 16 + 4 + j * 4, value, true);
    });
  }
  return {
    buffer,
    length: instructions.length,
    lines: instructions.map((i) => i.line),
  };
}
export function disassemble(buffer) {
  const view = new DataView(buffer),
    rows = [];
  for (let i = 0; i < buffer.byteLength / 16; i++) {
    const op = view.getInt32(i * 16, true),
      schema = OPS[op];
    if (!schema) {
      rows.push(`L${i}: nop`);
      continue;
    }
    const args = schema[1]
      .split(" ")
      .filter(Boolean)
      .map((type, j) => {
        const v = view.getFloat32(i * 16 + 4 + j * 4, true);
        if (type === "l")
          return `L${((Math.trunc(v) % (buffer.byteLength / 16)) + buffer.byteLength / 16) % (buffer.byteLength / 16)}`;
        if (type === "s") return SENSORS[Math.trunc(v)] ?? "energy";
        if (type === "p") return FIELDS[Math.trunc(v)] ?? "energy";
        return v <= -1000000
          ? `r${Math.trunc(-v - 1000000) & 7}`
          : String(Number(v.toPrecision(9)));
      });
    rows.push(`L${i}: ${schema[0]} ${args.join(" ")}`.trimEnd());
  }
  return rows.join("\n");
}
