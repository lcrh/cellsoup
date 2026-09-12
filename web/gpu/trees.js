import { assemble, disassemble } from "../language.js";
import { GPU_OPS, GPU_SENSORS, GPU_FIELDS } from "./language.js";

export const TYPES = ["Number", "Bool", "Cell", "Memory", "Channel", "Action"];
export const MAX_TREE_NODES = 32;
export const TREE_MEMORY_SLOTS = 8;
export const TREE_VM_OPS = [
  ...GPU_OPS,
  ["mem_load", "r v", "Read persistent tree memory."],
  ["mem_save", "v v", "Write persistent tree memory."],
];
const entry = (name, result, args = []) => ({ name, result, args });
export const TREE_SCHEMA = [
  entry("number", "Number"),
  entry("bool", "Bool"),
  entry("slot", "Memory"),
  entry("channel", "Channel"),
  ...[
    "energy",
    "storage",
    "sunlight",
    "temperature",
    "linked_storage",
    "linked_temperature",
    "crowding",
    "age",
    "generation",
    "bonds",
    "rotation",
    "color",
    "tag",
  ].map((n) => entry(n, "Number")),
  entry("self", "Cell"),
  entry("none", "Cell"),
  entry("nearest-cell", "Cell"),
  entry("nearest-corpse", "Cell"),
  entry("memory", "Number", ["Memory"]),
  entry("birth-result", "Number"),
  ...["+", "-", "*", "/", "mod", "min", "max"].map((n) =>
    entry(n, "Number", ["Number", "Number"]),
  ),
  ...["abs", "random"].map((n) => entry(n, "Number", ["Number"])),
  ...[">", "<", "="].map((n) => entry(n, "Bool", ["Number", "Number"])),
  entry("not", "Bool", ["Bool"]),
  entry("and", "Bool", ["Bool", "Bool"]),
  entry("or", "Bool", ["Bool", "Bool"]),
  entry("if", "Any", ["Bool", "Any", "Any"]),
  entry("scan", "Cell", ["Number", "Number"]),
  entry("scan-color", "Cell", ["Number", "Number"]),
  entry("bond", "Cell", ["Channel"]),
  ...[
    "energy",
    "storage",
    "temperature",
    "distance",
    "bearing",
    "color",
    "tag",
    "shield",
    "bonds",
  ].map((n) => entry("target-" + n, "Number", ["Cell"])),
  entry("alive", "Bool", ["Cell"]),
  entry("kin", "Bool", ["Cell"]),
  entry("sunlight-bearing", "Number"),
  entry("sunlight-slope", "Number"),
  entry("storage-bearing", "Number", ["Number"]),
  entry("storage-slope", "Number", ["Number"]),
  entry("listen", "Number", ["Channel"]),
  entry("receive", "Number", ["Channel"]),
  ...["nop", "photosynthesize", "eat", "bud", "split"].map((n) =>
    entry(n, "Action"),
  ),
  entry("seq", "Action", ["Action", "Action"]),
  entry("set", "Action", ["Memory", "Number"]),
  ...[
    "move",
    "turn",
    "contract",
    "shield",
    "color-set",
    "tag-set",
    "store",
    "mobilize",
    "wait",
  ].map((n) => entry(n, "Action", ["Number"])),
  entry("link", "Action", ["Cell"]),
  entry("unlink", "Action", ["Cell"]),
  entry("attack", "Action", ["Cell", "Number"]),
  entry("give", "Action", ["Cell", "Number"]),
  entry("emit", "Action", ["Channel", "Number"]),
  entry("send", "Action", ["Cell", "Channel", "Number"]),
];
const byName = new Map(TREE_SCHEMA.map((s, i) => [s.name, { ...s, id: i }]));
const node = (op, args = [], value) =>
  value === undefined ? { op, args } : { op, args, value };
const clone = (tree) => structuredClone(tree);
export function checkTree(
  tree,
  expected = "Action",
  maxNodes = MAX_TREE_NODES,
) {
  let count = 0,
    depth = 0;
  function visit(t, level) {
    if (++count > maxNodes || level > 16)
      throw Error("Tree size/depth limit exceeded");
    depth = Math.max(depth, level);
    const s = byName.get(t?.op);
    if (!s || !Array.isArray(t.args) || t.args.length !== s.args.length)
      throw Error("Invalid tree node " + t?.op);
    if (["number", "bool", "slot", "channel"].includes(t.op)) {
      if (!Number.isFinite(t.value) || Math.abs(t.value) > 999999)
        throw Error("Invalid literal");
      if (t.op === "bool" && t.value !== 0 && t.value !== 1)
        throw Error("Invalid boolean");
      if (
        (t.op === "slot" || t.op === "channel") &&
        (!Number.isInteger(t.value) ||
          t.value < 0 ||
          t.value >= (t.op === "slot" ? 8 : 4))
      )
        throw Error("Invalid index");
    } else if (t.value !== undefined) throw Error("Unexpected literal");
    const types = t.args.map((a) => visit(a, level + 1));
    const result = t.op === "if" ? types[1] : s.result;
    s.args.forEach((type, i) => {
      if (types[i] !== (type === "Any" ? result : type))
        throw Error(
          `Type mismatch in ${t.op}: expected ${type}, got ${types[i]}`,
        );
    });
    if (t.op === "if" && ["Memory", "Channel"].includes(result))
      throw Error("Index selectors must be literal");
    return result;
  }
  const type = visit(tree, 1);
  if (expected && type !== expected)
    throw Error(`Expected ${expected}, got ${type}`);
  return { type, count, depth };
}
export function parseTree(source) {
  const tokens = source.replace(/;[^\n]*/g, "").match(/\(|\)|[^\s()]+/g) || [];
  let at = 0;
  function read(depth = 0) {
    if (depth > 16) throw Error("Tree depth limit exceeded");
    const token = tokens[at++];
    if (token === undefined) throw Error("Unexpected end of tree");
    if (token === "(") {
      const op = tokens[at++],
        args = [];
      while (at < tokens.length && tokens[at] !== ")")
        args.push(read(depth + 1));
      if (tokens[at++] !== ")") throw Error("Missing closing parenthesis");
      if (op === "seq" && args.length > 2) {
        let rest = args.pop();
        while (args.length) rest = node("seq", [args.pop(), rest]);
        return rest;
      }
      return node(op, args);
    }
    if (token === ")") throw Error("Unexpected closing parenthesis");
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token))
      return node("number", [], Math.fround(Number(token)));
    if (token === "true" || token === "false")
      return node("bool", [], Number(token === "true"));
    if (/^m[0-7]$/.test(token)) return node("slot", [], Number(token[1]));
    if (/^c[0-3]$/.test(token)) return node("channel", [], Number(token[1]));
    return node(token);
  }
  const tree = read();
  if (at !== tokens.length) throw Error("Expected one program tree");
  checkTree(tree);
  return tree;
}
export function printTree(t) {
  if (t.op === "number") return String(t.value);
  if (t.op === "bool") return t.value ? "true" : "false";
  if (t.op === "slot") return "m" + t.value;
  if (t.op === "channel") return "c" + t.value;
  return `(${t.op}${t.args.length ? " " + t.args.map(printTree).join(" ") : ""})`;
}
// Presentation preserves the same tree; long programs use readable Lisp lines.
export function formatTree(tree, width = 54) {
  function render(t, indent) {
    const compact = printTree(t);
    if (indent + compact.length <= width || !t.args.length) return compact;
    let args = t.args;
    if (t.op === "seq") {
      args = [];
      let tail = t;
      while (tail.op === "seq") {
        args.push(tail.args[0]);
        tail = tail.args[1];
      }
      args.push(tail);
    }
    return `(${t.op}\n${args.map((a) => " ".repeat(indent + 2) + render(a, indent + 2)).join("\n")}\n${" ".repeat(indent)})`;
  }
  checkTree(tree);
  return render(tree, 0);
}
export function packTree(tree) {
  checkTree(tree);
  const data = new Float32Array(MAX_TREE_NODES * 4);
  let at = 0;
  function put(t) {
    const i = at++;
    data[i * 4] = byName.get(t.op).id;
    data[i * 4 + 1] = t.value ?? 0;
    for (const a of t.args) put(a);
    data[i * 4 + 2] = at;
    data[i * 4 + 3] = TYPES.indexOf(checkTree(t, null).type);
  }
  put(tree);
  return { data, count: at };
}
export function unpackTree(data, count) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_TREE_NODES ||
    data.length < count * 4
  )
    throw Error("Invalid packed tree size");
  let at = 0;
  function get(depth = 0) {
    if (at >= count || depth > 16) throw Error("Truncated tree");
    const i = at++,
      id = data[i * 4],
      s = TREE_SCHEMA[id];
    if (!s) throw Error("Invalid tree opcode");
    const literal = ["number", "bool", "slot", "channel"].includes(s.name);
    const t = node(
      s.name,
      s.args.map(() => get(depth + 1)),
      literal ? data[i * 4 + 1] : undefined,
    );
    if (
      data[i * 4 + 2] !== at ||
      data[i * 4 + 3] !== TYPES.indexOf(checkTree(t, null).type)
    )
      throw Error("Invalid subtree bounds/type");
    return t;
  }
  const tree = get();
  if (at !== count) throw Error("Trailing tree nodes");
  checkTree(tree);
  return tree;
}
// Eight VM registers hold evaluation temporaries; persistent memory is separate.
export function compileTree(tree) {
  if (typeof tree === "string") tree = parseTree(tree);
  checkTree(tree);
  const lines = [];
  let next = 0,
    label = 0;
  const emit = (...args) => lines.push(args.join(" "));
  const mark = () => `T${label++}`;
  const reg = (n) => "r" + n;
  function reserve(n = 1) {
    if (next + n > 8) throw Error("Tree needs more than eight temporaries");
    const r = next;
    next += n;
    return r;
  }
  function expr(t) {
    const start = next,
      op = t.op;
    if (op === "if") {
      const condition = expr(t.args[0]),
        otherwise = mark(),
        end = mark();
      emit("jz", reg(condition), otherwise);
      next = start;
      expr(t.args[1]);
      emit("jmp", end);
      emit(otherwise + ":");
      next = start;
      expr(t.args[2]);
      emit(end + ":");
      return start;
    }
    if (op === "and" || op === "or") {
      const r = expr(t.args[0]),
        end = mark();
      emit(op === "and" ? "jz" : "jnz", reg(r), end);
      next = start;
      expr(t.args[1]);
      emit(end + ":");
      return r;
    }
    if (op === "not") {
      const r = expr(t.args[0]),
        yes = mark(),
        end = mark();
      emit("jz", reg(r), yes);
      emit("mov", reg(r), 0);
      emit("jmp", end);
      emit(yes + ":");
      emit("mov", reg(r), 1);
      emit(end + ":");
      return r;
    }
    if (["+", "-", "*", "/", "mod", "min", "max", ">", "<", "="].includes(op)) {
      const a = expr(t.args[0]),
        b = expr(t.args[1]);
      if ([">", "<", "="].includes(op)) {
        const yes = mark(),
          end = mark();
        emit({ ">": "jgt", "<": "jlt", "=": "jeq" }[op], reg(a), reg(b), yes);
        emit("mov", reg(a), 0);
        emit("jmp", end);
        emit(yes + ":");
        emit("mov", reg(a), 1);
        emit(end + ":");
      } else
        emit(
          { "+": "add", "-": "sub", "*": "mul", "/": "div" }[op] || op,
          reg(a),
          reg(b),
        );
      next = start + 1;
      return a;
    }
    if (op === "abs" || op === "random") {
      const r = expr(t.args[0]);
      emit(op === "abs" ? "abs" : "rand", reg(r), reg(r));
      return r;
    }
    if (op.startsWith("target-") || op === "alive" || op === "kin") {
      const r = expr(t.args[0]);
      emit("peek", reg(r), reg(r), op.startsWith("target-") ? op.slice(7) : op);
      return r;
    }
    if (op === "scan" || op === "scan-color") {
      const a = expr(t.args[0]),
        b = expr(t.args[1]);
      emit(op === "scan" ? "scan" : "scan_color", reg(a), reg(a), reg(b));
      next = start + 1;
      return a;
    }
    if (
      op.startsWith("storage-") &&
      ["storage-bearing", "storage-slope"].includes(op)
    ) {
      const r = expr(t.args[0]);
      reserve();
      emit("storage_gradient", reg(r), reg(r + 1), reg(r));
      if (op === "storage-slope") emit("mov", reg(r), reg(r + 1));
      next = start + 1;
      return r;
    }
    const r = reserve();
    if (op === "number" || op === "bool") emit("mov", reg(r), t.value);
    else if (op === "memory" || op === "birth-result")
      emit("mem_load", reg(r), op === "memory" ? t.args[0].value : 8);
    else if (op === "none") emit("mov", reg(r), 0);
    else if (op === "self") emit("sense", reg(r), "id");
    else if (op === "nearest-cell") emit("scan", reg(r), -1, 360);
    else if (op === "nearest-corpse") emit("scan_corpse", reg(r), 360);
    else if (op === "bond") emit("bond", reg(r), t.args[0].value);
    else if (op === "listen") emit("listen", reg(r), t.args[0].value);
    else if (op === "receive") {
      reserve();
      emit("receive", reg(r), reg(r + 1), t.args[0].value);
      next--;
    } else if (op === "sunlight-bearing" || op === "sunlight-slope") {
      reserve();
      emit("gradient", reg(r), reg(r + 1));
      if (op === "sunlight-slope") emit("mov", reg(r), reg(r + 1));
      next--;
    } else if (GPU_SENSORS.includes(op)) emit("sense", reg(r), op);
    else throw Error("Cannot compile expression " + op);
    return r;
  }
  function action(t) {
    const op = t.op;
    if (op === "seq") {
      action(t.args[0]);
      action(t.args[1]);
      return;
    }
    if (op === "if") {
      const r = expr(t.args[0]),
        otherwise = mark(),
        end = mark();
      emit("jz", reg(r), otherwise);
      next = 0;
      action(t.args[1]);
      emit("jmp", end);
      emit(otherwise + ":");
      action(t.args[2]);
      emit(end + ":");
      return;
    }
    if (op === "nop") emit("nop");
    else if (op === "photosynthesize" || op === "eat") emit(op, "r0");
    else if (op === "bud" || op === "split") {
      emit(op, "r0");
      emit("mem_save", 8, "r0");
    } else if (op === "set") {
      const r = expr(t.args[1]);
      emit("mem_save", t.args[0].value, reg(r));
    } else if (op === "send") {
      const target = expr(t.args[0]),
        value = expr(t.args[2]);
      emit("send", reg(target), t.args[1].value, reg(value));
    } else if (op === "emit") {
      const r = expr(t.args[1]);
      emit("emit", t.args[0].value, reg(r));
    } else {
      const values = t.args.map(expr).map(reg);
      const name = { "color-set": "color", "tag-set": "tag" }[op] || op;
      if (op === "store" || op === "mobilize") emit(name, values[0], values[0]);
      else emit(name, ...values);
    }
    next = 0;
  }
  emit("ROOT:");
  action(tree);
  emit("wait", 0);
  emit("jmp", "ROOT");
  const source = lines.join("\n");
  let code;
  try {
    code = assemble(source, TREE_VM_OPS, GPU_SENSORS, GPU_FIELDS);
  } catch (e) {
    throw Error(e.message + "\n" + printTree(tree) + "\n" + source);
  }
  if (code.length > 64) throw Error("Compiled tree exceeds 64 instructions");
  return { ...code, source, tree: clone(tree) };
}
export function treeRng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const constants = [
  -1, 0, 0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 10, 25, 60, 90, 120, 360,
];
function grow(type, budget, depth, rng) {
  const options = TREE_SCHEMA.filter(
    (s) =>
      (s.result === type ||
        (s.name === "if" && !["Memory", "Channel"].includes(type))) &&
      s.args.length < budget &&
      (depth > 1 || s.args.length === 0),
  );
  const s = options[Math.floor(rng() * options.length)];
  if (!s) throw Error("Cannot generate type " + type);
  if (s.name === "number")
    return node(
      "number",
      [],
      Math.fround(constants[Math.floor(rng() * constants.length)]),
    );
  if (s.name === "bool") return node("bool", [], Number(rng() < 0.5));
  if (s.name === "slot" || s.name === "channel")
    return node(s.name, [], Math.floor(rng() * (s.name === "slot" ? 8 : 4)));
  let remaining = budget - 1;
  const args = s.args.map((child, i) => {
    const spare = remaining - (s.args.length - i - 1);
    const allowance =
      i === s.args.length - 1 ? spare : 1 + Math.floor(rng() * spare);
    const t = grow(child === "Any" ? type : child, allowance, depth - 1, rng);
    remaining -= checkTree(t, null).count;
    return t;
  });
  return node(s.name, args);
}
export function randomTree(rng = Math.random, maxNodes = MAX_TREE_NODES) {
  for (let i = 0; i < 64; i++) {
    // Sample a program of 1–6 random actions, not predominantly one action.
    // This changes structure only: no metabolic or reproductive primitive is
    // guaranteed, and there are no hand-written behavior templates.
    const count = 1 + Math.floor(rng() * Math.min(6, Math.ceil(maxNodes / 2)));
    let remaining = maxNodes - (count - 1);
    const actions = [];
    for (let k = 0; k < count; k++) {
      const left = count - k;
      const allowance = Math.max(1, Math.floor(remaining / left));
      const action = grow("Action", allowance, 6, rng);
      actions.push(action);
      remaining -= checkTree(action, null).count;
    }
    let t = actions.pop();
    while (actions.length) t = node("seq", [actions.pop(), t]);
    try {
      compileTree(t);
      return t;
    } catch (e) {
      if (!/limit|temporaries|64 instructions/.test(e.message)) throw e;
    }
  }
  throw Error("Could not sample bounded tree");
}
export function mutateTree(tree, rng = Math.random) {
  checkTree(tree);
  const original = printTree(tree),
    count = checkTree(tree).count;
  function paths(t, path = [], out = []) {
    out.push({ t, path, type: checkTree(t, null).type });
    t.args.forEach((a, i) => paths(a, [...path, i], out));
    return out;
  }
  const choices = paths(tree);
  for (let attempt = 0; attempt < 64; attempt++) {
    const chosen = choices[Math.floor(rng() * choices.length)],
      mode = rng();
    let replacement;
    if (chosen.t.op === "number" && mode < 0.5) {
      const v = chosen.t.value;
      replacement = node(
        "number",
        [],
        Math.fround(
          Math.max(
            -999999,
            Math.min(
              999999,
              v + (rng() - 0.5) * Math.max(0.1, Math.abs(v) * 0.25),
            ),
          ),
        ),
      );
    } else if (mode < 0.3) {
      const descendants = paths(chosen.t)
        .slice(1)
        .filter((x) => x.type === chosen.type);
      if (!descendants.length) continue;
      replacement = clone(
        descendants[Math.floor(rng() * descendants.length)].t,
      );
    } else
      replacement = grow(
        chosen.type,
        MAX_TREE_NODES - count + checkTree(chosen.t, null).count,
        6,
        rng,
      );
    const result = clone(tree);
    let parent = result;
    for (const i of chosen.path.slice(0, -1)) parent = parent.args[i];
    const changed = chosen.path.length
      ? ((parent.args[chosen.path.at(-1)] = replacement), result)
      : replacement;
    try {
      compileTree(changed);
      if (printTree(changed) !== original) return changed;
    } catch (e) {
      if (!/limit|temporaries|64 instructions/.test(e.message)) throw e;
    }
  }
  throw Error("Could not produce a bounded mutation");
}

export function decodeTreeBytecode(buffer) {
  return disassemble(buffer, TREE_VM_OPS, GPU_SENSORS, GPU_FIELDS);
}

function subtrees(t, path = [], out = []) {
  out.push({ tree: t, path, ...checkTree(t, null) });
  t.args.forEach((child, i) => subtrees(child, [...path, i], out));
  return out;
}
function replaceSubtree(tree, path, donor) {
  if (!path.length) return clone(donor);
  const child = clone(tree);
  let parent = child;
  for (const index of path.slice(0, -1)) parent = parent.args[index];
  parent.args[path.at(-1)] = clone(donor);
  return child;
}
// Replace a proper subtree of one parent with a same-typed subtree from the
// other. Refuse whole-root swaps and identical results: those are copies, not
// recombination. Return an explicit failure when these parents cannot cross.
export function crossoverTrees(first, second, rng = Math.random) {
  compileTree(first);
  compileTree(second);
  const original = printTree(first),
    other = printTree(second);
  const recipients = subtrees(first).slice(1),
    donors = subtrees(second);
  const candidates = [];
  for (const recipient of recipients)
    for (const donor of donors) {
      if (
        recipient.type === donor.type &&
        checkTree(first).count - recipient.count + donor.count <=
          MAX_TREE_NODES &&
        printTree(recipient.tree) !== printTree(donor.tree)
      ) {
        candidates.push({ recipient, donor });
      }
    }
  // Random ordering avoids bias towards shallow nodes. Exhausting the bounded
  // set makes failure observable instead of silently fabricating a crossover.
  while (candidates.length) {
    const index = Math.floor(rng() * candidates.length);
    const { recipient, donor } = candidates[index];
    candidates[index] = candidates.at(-1);
    candidates.pop();
    const tree = replaceSubtree(first, recipient.path, donor.tree);
    const printed = printTree(tree);
    if (printed === original || printed === other) continue;
    try {
      compileTree(tree);
    } catch (error) {
      if (/limit|temporaries|64 instructions/.test(error.message)) continue;
      throw error;
    }
    return {
      tree,
      crossed: true,
      recipientPath: recipient.path,
      donorPath: donor.path,
    };
  }
  return {
    tree: clone(first),
    crossed: false,
    recipientPath: null,
    donorPath: null,
  };
}

// Immigration only: archives contain {id, tree} entries already selected for
// ecological success. Division bypasses this entirely and copies the genome.
// Crossover and post-resampling mutation are separate probabilities.
export function sampleTreeArrival(
  archive,
  {
    rng = Math.random,
    archiveShare = 0.5,
    crossoverRate = 0.25,
    mutationRate = 0.8,
  } = {},
) {
  for (const value of [archiveShare, crossoverRate, mutationRate])
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw Error("Invalid arrival probability");
  if (!archive.length || rng() >= archiveShare)
    return {
      tree: randomTree(rng),
      source: "random",
      parents: [],
      crossed: false,
      mutated: false,
    };
  const firstIndex = Math.floor(rng() * archive.length),
    first = archive[firstIndex];
  let tree = clone(first.tree),
    crossed = false,
    parents = [first.id];
  if (archive.length > 1 && rng() < crossoverRate) {
    const offset = 1 + Math.floor(rng() * (archive.length - 1));
    const second = archive[(firstIndex + offset) % archive.length];
    const result = crossoverTrees(tree, second.tree, rng);
    tree = result.tree;
    crossed = result.crossed;
    if (crossed) parents.push(second.id);
  }
  const mutated = rng() < mutationRate;
  if (mutated) tree = mutateTree(tree, rng);
  return {
    tree,
    source: crossed ? "crossover" : "archive",
    parents,
    crossed,
    mutated,
  };
}
