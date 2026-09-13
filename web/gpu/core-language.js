// The world palette keeps basic computation, memory, survival and reproduction
// available. Advanced senses, communication and other extensions can vary.
export const CORE_FUNCTIONS = Object.freeze([
  "number",
  "bool",
  "slot",
  "channel",
  "nop",
  "seq",
  "+",
  "-",
  "*",
  "/",
  "mod",
  "min",
  "max",
  "abs",
  ">",
  "<",
  "=",
  "not",
  "and",
  "or",
  "if",
  "self",
  "none",
  "energy",
  "storage",
  "memory",
  "set",
  "state",
  "let",
  "do",
  "birth-result",
  "wait",
  "photosynthesize",
  "eat",
  "store",
  "mobilize",
  "bud",
  "split",
  "move",
  "turn",
]);
const coreNames = new Set(CORE_FUNCTIONS);
export const isCoreFunction = (name) => coreNames.has(name);

// Imported older setups may have disabled now-protected primitives. Preserve
// every optional switch while making the protected UI and saved masks agree.
export function protectCoreFunctionMasks(config, schema) {
  const masks = Object.fromEntries(
    [0, 1, 2, 3].map((i) => [
      "functionMask" + i,
      (config["functionMask" + i] ?? 0xffffffff) >>> 0,
    ]),
  );
  for (const [id, fn] of schema.entries())
    if (isCoreFunction(fn.name)) {
      const key = "functionMask" + Math.floor(id / 32);
      masks[key] = (masks[key] | (1 << (id % 32))) >>> 0;
    }
  return masks;
}
