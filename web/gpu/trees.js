import { assemble, disassemble } from "../language.js";
import { GPU_OPS, GPU_SENSORS, GPU_FIELDS } from "./language.js";

export const TYPES = [
  "Number",
  "Bool",
  "Cell",
  "Memory",
  "Channel",
  "Action",
  "Filter",
];
export const MAX_TREE_NODES = 32;
export const TREE_MEMORY_SLOTS = 8;
// Experimental: founders retain the baseline vocabulary; mutations may add
// persistent communication through reciprocal links. False is the paired control.
export const TREE_VM_OPS = [
  ...GPU_OPS,
  ["mem_load", "r v", "Read persistent tree memory."],
  ["mem_save", "v v", "Write persistent tree memory."],
  ["mem_ready", "r v", "Test whether a state binding has been initialized."],
  ["mem_init", "v v", "Initialize state once per cell; inherited on division."],
  [
    "linked_listen",
    "r v",
    "Mean previous-tick signal of live reciprocal neighbors on a channel; zero without neighbors. Does not consume signals.",
  ],
  ["linked_sum", "r v", "Sum of linked broadcasts on a channel."],
  ["swish", "r", "Pure swish activation: x / (1 + exp(-x))."],
  [
    "neighborhood",
    "r v l",
    "Filtered neighborhood query; result replaces radius.",
  ],
  ["candidate", "r", "Current filter candidate."],
  ["filter_return", "r", "Return a pure filter predicate."],
  ["child_set", "v v", "Set a memory value for the next daughter."],
  ["child_turn", "v", "Set relative heading offset for the next daughter."],
  [
    "filtered_send",
    "v v l",
    "Send to directly linked neighbors matching a predicate.",
  ],
  [
    "filtered_receive",
    "r v l",
    "Consume a mailbox value only from a matching sender.",
  ],
  ["sin", "r", "Pure sine, with a radian argument."],
  ["cos", "r", "Pure cosine, with a radian argument."],
  ["resist", "v", "Set persistent bracing resistance between zero and one."],
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
  entry("state", "Any", ["Memory", "Number", "Any"]),
  entry("let", "Any", ["Memory", "Number", "Any"]),
  entry("do", "Any", ["Action", "Any"]),
  // Append to preserve existing serialized node IDs.
  entry("lag", "Number", ["Number"]),
  entry("delta", "Number", ["Number"]),
  entry("smooth", "Number", ["Number", "Number"]),
  entry("linked-signal", "Number", ["Channel"]),
  entry("linked-sum", "Number", ["Channel"]),
  entry("couple", "Number", ["Channel", "Number"]),
  entry("relu", "Number", ["Number"]),
  entry("swish", "Number", ["Number"]),
  entry("where", "Filter", ["Bool"]),
  entry("candidate", "Cell"),
  entry("nearby", "Cell", ["Number", "Filter"]),
  ...[
    "centroid-bearing",
    "centroid-distance",
    "neighbor-count",
    "alignment",
    "separation-bearing",
    "separation-strength",
  ].map((name) => entry(name, "Number", ["Number", "Filter"])),
  entry("linked-mean-where", "Number", ["Channel", "Filter"]),
  entry("linked-sum-where", "Number", ["Channel", "Filter"]),
  entry("listen-where", "Number", ["Number", "Channel", "Filter"]),
  entry("send-where", "Action", ["Channel", "Number", "Filter"]),
  entry("receive-where", "Number", ["Channel", "Filter"]),
  entry("child-set", "Action", ["Memory", "Number"]),
  entry("child-turn", "Action", ["Number"]),
  entry("colony-size", "Number"),
  entry("sin", "Number", ["Number"]),
  entry("cos", "Number", ["Number"]),
  entry("time", "Number"),
  entry("resist", "Action", ["Number"]),
];
// Parser conveniences lower to the same typed, serialized vocabulary. Function
// switches act on the canonical nodes below; aliases do not bypass a switch.
export const TREE_SURFACE_FORMS = [
  {
    name: "nearest",
    signature: "(nearest selection [radius] [filter])",
    description:
      "Select the closest matching cell or corpse. Unqualified living/corpse uses the original 60-unit scan; an explicit radius or filter uses the bounded neighborhood query.",
    example: "(turn (orientation (nearest corpse 80)))",
    canonicalNames: [
      "nearest-cell",
      "nearest-corpse",
      "nearby",
      "where",
      "candidate",
      "alive",
      "not",
      "target-bearing",
    ],
  },
  {
    name: "selection",
    signature: "living | corpse | kin | other | any",
    description:
      "Pure categories may be combined with and, or, not and (where predicate). Candidate means the cell being considered. Other means a living non-kin cell.",
    example:
      "(link (nearest (and living (where (> (storage candidate) 4))) 80))",
    canonicalNames: [
      "where",
      "candidate",
      "alive",
      "kin",
      "and",
      "or",
      "not",
      "target-storage",
      "nearby",
      "link",
    ],
  },
  {
    name: "orientation",
    signature: "(orientation cell)",
    description:
      "Relative bearing toward the selected cell, in degrees; no absolute compass direction.",
    example: "(turn (orientation (nearest living)))",
    canonicalNames: ["target-bearing", "nearby", "where", "candidate", "alive"],
  },
  {
    name: "distance",
    signature: "(distance cell)",
    description:
      "Distance to the selected cell. The GPU query determines which candidates are available.",
    example: "(move (distance (nearest living)))",
    canonicalNames: [
      "target-distance",
      "nearby",
      "where",
      "candidate",
      "alive",
    ],
  },
  {
    name: "cell-fields",
    signature:
      "(energy cell), (storage cell), (temperature cell), (color cell), (tag cell), (bonds cell)",
    description:
      "Read a selected cell field. The corresponding zero-argument form reads your own cell.",
    example: "(set m0 (storage (nearest corpse)))",
    canonicalNames: [
      "target-energy",
      "target-storage",
      "target-temperature",
      "target-color",
      "target-tag",
      "target-bonds",
    ],
  },
  {
    name: "centroid",
    signature:
      "(orientation (centroid selection [radius])), (distance (centroid selection [radius]))",
    description:
      "Bearing or distance toward the mean relative position of matching neighbors; useful for cohesion.",
    example: "(turn (orientation (centroid living 80)))",
    canonicalNames: [
      "centroid-bearing",
      "centroid-distance",
      "where",
      "candidate",
      "alive",
    ],
  },
  {
    name: "separation",
    signature:
      "(orientation (separation selection [radius])), (strength (separation selection [radius]))",
    description:
      "Direction and magnitude of the separation response away from matching neighbors.",
    example: "(turn (orientation (separation living 40)))",
    canonicalNames: [
      "separation-bearing",
      "separation-strength",
      "where",
      "candidate",
      "alive",
    ],
  },
  {
    name: "count",
    signature: "(count selection [radius])",
    description: "Count the bounded set of matching neighbors.",
    example: "(move (count living 60))",
    canonicalNames: ["neighbor-count", "where", "candidate", "alive"],
  },
  {
    name: "alignment",
    signature: "(alignment selection [radius])",
    description:
      "Mean heading of matching neighbors relative to your own heading, in degrees.",
    example: "(turn (alignment living 80))",
    canonicalNames: ["alignment", "where", "candidate", "alive"],
  },
  {
    name: "linked-mean",
    signature:
      "(linked-mean channel [selection]), (linked-sum channel [selection])",
    description:
      "Read the mean or sum of previous-tick broadcast signals from reciprocal linked neighbors matching an optional filter.",
    example: "(move (linked-mean c1 kin))",
    canonicalNames: [
      "linked-signal",
      "linked-sum",
      "linked-mean-where",
      "linked-sum-where",
      "where",
      "candidate",
      "alive",
      "kin",
      "and",
    ],
  },
  {
    name: "broadcast",
    signature: "(broadcast channel value)",
    description:
      "Publish a value on one of four channels. Linked and proximity listeners choose which senders to aggregate.",
    example: "(broadcast c2 (relu (- (energy) 20)))",
    canonicalNames: ["emit", "relu", "-", "energy"],
  },
  {
    name: "send-linked",
    signature: "(send-linked channel value [selection])",
    description:
      "Send a mailbox message to matching direct reciprocal links. Selection defaults to living; receive consumes a mailbox value.",
    example: "(send-linked c0 (storage) kin)",
    canonicalNames: ["send-where", "where", "candidate", "alive", "kin", "and"],
  },
  {
    name: "filtered-listen",
    signature: "(listen channel radius selection), (receive channel selection)",
    description:
      "Average filtered nearby broadcasts, or consume a mailbox message only if its sender matches the selection.",
    example: "(move (listen c3 80 living))",
    canonicalNames: [
      "listen-where",
      "receive-where",
      "where",
      "candidate",
      "alive",
    ],
  },
];
const FILTER_PURE = new Set([
  "number",
  "bool",
  "slot",
  "channel",
  "candidate",
  "self",
  "none",
  "memory",
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
  "colony-size",
  "rotation",
  "color",
  "tag",
  "birth-result",
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
  "relu",
  "swish",
  "sin",
  "cos",
  "time",
  "alive",
  "kin",
  ...TREE_SCHEMA.filter((s) => s.name.startsWith("target-")).map((s) => s.name),
]);
const QUERY_MODES = {
  nearby: 0,
  "centroid-bearing": 1,
  "centroid-distance": 2,
  "neighbor-count": 3,
  alignment: 4,
  "separation-bearing": 5,
  "separation-strength": 6,
};
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
  function visit(t, level, filterContext = false) {
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
    if (t.op === "candidate" && !filterContext && expected !== null)
      throw Error("Filter candidate is only valid inside where");
    if (t.op === "where") {
      const pure = (n) => {
        if (!FILTER_PURE.has(n.op))
          throw Error("Filters require pure expressions: " + n.op);
        n.args.forEach(pure);
      };
      pure(t.args[0]);
    }
    const types = t.args.map((a) =>
      visit(a, level + 1, filterContext || t.op === "where"),
    );
    const result = ["state", "let"].includes(t.op)
      ? types[2]
      : ["if", "do"].includes(t.op)
        ? types[1]
        : s.result;
    s.args.forEach((type, i) => {
      if (types[i] !== (type === "Any" ? result : type))
        throw Error(
          `Type mismatch in ${t.op}: expected ${type}, got ${types[i]}`,
        );
    });
    if (s.result === "Any" && ["Memory", "Channel", "Filter"].includes(result))
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
  if (tokens.length > 4096) throw Error("Tree source limit exceeded");
  let at = 0;
  const allocated = new Set();
  function read(depth = 0) {
    if (depth > 64) throw Error("Tree depth limit exceeded");
    const token = tokens[at++];
    if (token === undefined) throw Error("Unexpected end of tree");
    if (token === ")") throw Error("Unexpected closing parenthesis");
    if (token !== "(") return token;
    const list = [];
    while (at < tokens.length && tokens[at] !== ")") list.push(read(depth + 1));
    if (tokens[at++] !== ")") throw Error("Missing closing parenthesis");
    return list;
  }
  function sequence(forms) {
    if (!forms.length) throw Error("Expected a body");
    let result = forms.at(-1);
    for (let i = forms.length - 2; i >= 0; i--) {
      result = node(checkTree(result, null).type === "Action" ? "seq" : "do", [
        forms[i],
        result,
      ]);
    }
    return result;
  }
  // Surface selections are syntax, not runtime collections. Lower them to a
  // pure predicate executed against each bounded neighborhood candidate.
  const categories = new Set([
    "living",
    "alive",
    "corpse",
    "dead",
    "kin",
    "other",
    "any",
  ]);
  function selection(raw, scope) {
    const candidate = () => node("candidate");
    if (raw === "living" || raw === "alive")
      return node("where", [node("alive", [candidate()])]);
    if (raw === "corpse" || raw === "dead")
      return node("where", [node("not", [node("alive", [candidate()])])]);
    if (raw === "kin")
      return node("where", [
        node("and", [node("alive", [candidate()]), node("kin", [candidate()])]),
      ]);
    if (raw === "other")
      return node("where", [
        node("and", [
          node("alive", [candidate()]),
          node("not", [node("kin", [candidate()])]),
        ]),
      ]);
    if (raw === "any") return node("where", [node("bool", [], 1)]);
    if (Array.isArray(raw) && ["and", "or", "not"].includes(raw[0])) {
      const arity = raw[0] === "not" ? 1 : 2;
      if (raw.length !== arity + 1) throw Error("Invalid selection predicate");
      return node("where", [
        node(
          raw[0],
          raw.slice(1).map((x) => selection(x, scope).args[0]),
        ),
      ]);
    }
    const result = lower(raw, scope);
    if (result.op !== "where")
      throw Error("Selection requires a category or (where predicate)");
    return result;
  }
  function neighborhood(op, args, scope) {
    if (args.length < 1 || args.length > 3)
      throw Error("Expected selection, optional radius and optional filter");
    let filter = selection(args[0], scope);
    const radius =
      args.length > 1 ? lower(args[1], scope) : node("number", [], 60);
    if (args.length === 3)
      filter = node("where", [
        node("and", [filter.args[0], selection(args[2], scope).args[0]]),
      ]);
    return node(op, [radius, filter]);
  }
  function lower(raw, scope = new Map()) {
    if (!Array.isArray(raw)) {
      if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw))
        return node("number", [], Math.fround(Number(raw)));
      if (raw === "true" || raw === "false")
        return node("bool", [], Number(raw === "true"));
      if (scope.has(raw))
        return node("memory", [node("slot", [], scope.get(raw))]);
      if (/^m[0-7]$/.test(raw)) return node("slot", [], Number(raw[1]));
      if (/^c[0-3]$/.test(raw)) return node("channel", [], Number(raw[1]));
      if (!byName.has(raw))
        throw Error("Unbound variable or unknown operation " + raw);
      return node(raw);
    }
    const [op, ...args] = raw;
    if (typeof op !== "string") throw Error("Expected an operation");
    if (
      op === "nearest" &&
      args.length === 1 &&
      ["corpse", "living"].includes(args[0])
    )
      return node(args[0] === "corpse" ? "nearest-corpse" : "nearest-cell");
    if (op === "nearest") return neighborhood("nearby", args, scope);
    if (op === "count") return neighborhood("neighbor-count", args, scope);
    if (
      ["orientation", "distance", "strength"].includes(op) &&
      args.length === 1 &&
      Array.isArray(args[0])
    ) {
      const [kind, ...selectionArgs] = args[0];
      const projection = {
        centroid: {
          orientation: "centroid-bearing",
          distance: "centroid-distance",
        },
        separation: {
          orientation: "separation-bearing",
          strength: "separation-strength",
        },
      }[kind]?.[op];
      if (projection) return neighborhood(projection, selectionArgs, scope);
    }
    if (
      op in QUERY_MODES &&
      (categories.has(args[0]) ||
        (Array.isArray(args[0]) &&
          ["where", "and", "or", "not"].includes(args[0][0])))
    )
      return neighborhood(op, args, scope);
    if (op === "orientation" || op === "distance") {
      if (args.length !== 1) throw Error("Expected one selected cell");
      return node("target-" + (op === "orientation" ? "bearing" : "distance"), [
        lower(args[0], scope),
      ]);
    }
    if (
      [
        "energy",
        "storage",
        "temperature",
        "color",
        "tag",
        "shield",
        "bonds",
      ].includes(op) &&
      args.length === 1 &&
      op !== "shield"
    )
      return node("target-" + op, [lower(args[0], scope)]);
    if ((op === "linked-mean" || op === "linked-sum") && args.length === 2)
      return node(
        op === "linked-mean" ? "linked-mean-where" : "linked-sum-where",
        [lower(args[0], scope), selection(args[1], scope)],
      );
    if (op === "linked-mean" && args.length === 1)
      return node("linked-signal", [lower(args[0], scope)]);
    if (op === "send-linked") {
      if (args.length < 2 || args.length > 3)
        throw Error("Expected channel, value and optional selection");
      return node("send-where", [
        lower(args[0], scope),
        lower(args[1], scope),
        selection(args[2] ?? "living", scope),
      ]);
    }
    if (op === "broadcast" && args.length === 2)
      return node(
        "emit",
        args.map((x) => lower(x, scope)),
      );
    if (op === "receive" && args.length === 2)
      return node("receive-where", [
        lower(args[0], scope),
        selection(args[1], scope),
      ]);
    if (op === "listen" && args.length === 3)
      return node("listen-where", [
        lower(args[1], scope),
        lower(args[0], scope),
        selection(args[2], scope),
      ]);
    if ((op === "state" || op === "let") && Array.isArray(args[0])) {
      const declarations = args[0],
        inner = new Map(scope),
        names = new Set(),
        bindings = [];
      if (!declarations.length || args.length < 2)
        throw Error("Expected bindings and a body");
      for (const pair of declarations) {
        if (
          !Array.isArray(pair) ||
          pair.length !== 2 ||
          typeof pair[0] !== "string" ||
          !/^[a-zA-Z_][a-zA-Z0-9_!?-]*$/.test(pair[0]) ||
          /^(?:m[0-7]|c[0-3]|true|false)$/.test(pair[0])
        )
          throw Error("Invalid binding");
        const [name, value] = pair;
        if (names.has(name)) throw Error("Duplicate binding " + name);
        names.add(name);
        // Canonical names retain slot identity when inspecting evolved trees.
        const fixed = /^(?:state|local)([0-7])$/.exec(name);
        let slot = fixed ? Number(fixed[1]) : 0;
        if (!fixed) while (allocated.has(slot)) slot++;
        if (slot >= TREE_MEMORY_SLOTS)
          throw Error("At most eight state and local bindings");
        allocated.add(slot);
        inner.set(name, slot);
        bindings.push([node("slot", [], slot), lower(value, scope)]);
      }
      let body = sequence(args.slice(1).map((x) => lower(x, inner)));
      for (let i = bindings.length - 1; i >= 0; i--)
        body = node(op, [...bindings[i], body]);
      return body;
    }
    if (op === "set!") {
      if (args.length !== 2 || !scope.has(args[0]))
        throw Error("set! requires a bound variable");
      return node("set", [
        node("slot", [], scope.get(args[0])),
        lower(args[1], scope),
      ]);
    }
    const lowered = args.map((x) => lower(x, scope));
    if (op === "seq" && lowered.length > 2) {
      let tail = lowered.pop();
      while (lowered.length) tail = node("seq", [lowered.pop(), tail]);
      return tail;
    }
    return node(op, lowered);
  }
  const raw = read();
  // Named locals must not overwrite explicitly addressed legacy memory.
  function reserveExplicit(value) {
    if (Array.isArray(value)) value.forEach(reserveExplicit);
    else if (/^m[0-7]$/.test(value)) allocated.add(Number(value[1]));
  }
  reserveExplicit(raw);
  if (at !== tokens.length) throw Error("Expected one program tree");
  const tree = lower(raw);
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
  function render(t, indent, scope = new Map()) {
    if (t.op === "memory" && scope.has(t.args[0].value))
      return scope.get(t.args[0].value);
    if (t.op === "state" || t.op === "let") {
      const slot = t.args[0].value,
        name = `${t.op === "state" ? "state" : "local"}${slot}`;
      const inner = new Map(scope);
      inner.set(slot, name);
      return `(${t.op} ((${name} ${render(t.args[1], indent + 2, scope)}))\n${" ".repeat(indent + 2)}${render(t.args[2], indent + 2, inner)}\n${" ".repeat(indent)})`;
    }
    if (t.op === "set" && scope.has(t.args[0].value))
      return `(set! ${scope.get(t.args[0].value)} ${render(t.args[1], indent + 2, scope)})`;
    if (t.op === "nearest-cell") return "(nearest living)";
    if (t.op === "nearest-corpse") return "(nearest corpse)";
    if (!t.args.length) return printTree(t);
    const displayOp =
      {
        "target-bearing": "orientation",
        "target-distance": "distance",
        "target-energy": "energy",
        "target-storage": "storage",
        "target-temperature": "temperature",
        "target-color": "color",
        "target-tag": "tag",
        "target-bonds": "bonds",
      }[t.op] || t.op;
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
    const inline = `(${displayOp} ${args.map((a) => render(a, indent + 2, scope)).join(" ")})`;
    if (!inline.includes("\n") && indent + inline.length <= width)
      return inline;
    return `(${displayOp}\n${args.map((a) => " ".repeat(indent + 2) + render(a, indent + 2, scope)).join("\n")}\n${" ".repeat(indent)})`;
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
export function compileTree(tree, { loopYield = 1 } = {}) {
  if (![0, 1].includes(loopYield)) throw Error("Invalid loop yield");
  if (typeof tree === "string") tree = parseTree(tree);
  checkTree(tree);
  // Each syntactic occurrence owns its history even when an API caller reused
  // an AST object. The input remains untouched.
  const copyOccurrence = (t) => ({ ...t, args: t.args.map(copyOccurrence) });
  tree = copyOccurrence(tree);
  const occupied = new Set();
  function explicitSlots(t) {
    if (t.op === "slot") occupied.add(t.value);
    t.args.forEach(explicitSlots);
  }
  explicitSlots(tree);
  const temporalSlots = new Map(),
    statefulSlots = [];
  function allocateTemporal(t, path = []) {
    if (["lag", "delta", "smooth"].includes(t.op)) {
      let slot = 0;
      while (occupied.has(slot)) slot++;
      if (slot >= TREE_MEMORY_SLOTS) throw Error("Tree memory limit exceeded");
      occupied.add(slot);
      temporalSlots.set(t, slot);
      statefulSlots.push({ op: t.op, slot, path });
    }
    t.args.forEach((child, index) => allocateTemporal(child, [...path, index]));
  }
  allocateTemporal(tree);
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
  function binding(t, body) {
    const start = next,
      slot = t.args[0].value,
      ready = mark();
    if (t.op === "state") {
      const r = reserve();
      emit("mem_ready", reg(r), slot);
      emit("jnz", reg(r), ready);
      next = start;
    }
    const initial = expr(t.args[1]);
    emit(t.op === "state" ? "mem_init" : "mem_save", slot, reg(initial));
    if (t.op === "state") emit(ready + ":");
    next = start;
    return body(t.args[2]);
  }
  function query(t, actionQuery = false) {
    const start = next;
    const predicate = t.args.at(-1).args[0],
      filter = mark(),
      end = mark();
    let result;
    if (t.op === "send-where") {
      const v = expr(t.args[1]);
      emit("filtered_send", t.args[0].value, reg(v), filter);
      result = v;
    } else if (t.op === "receive-where") {
      result = reserve();
      emit("filtered_receive", reg(result), t.args[0].value, filter);
    } else {
      const radius = t.op.startsWith("linked-") ? reserve() : expr(t.args[0]);
      let mode = QUERY_MODES[t.op];
      if (t.op.startsWith("linked-")) {
        emit("mov", reg(radius), 0);
        mode = (t.op === "linked-mean-where" ? 10 : 14) + t.args[0].value;
      }
      if (t.op === "listen-where") mode = 18 + t.args[1].value;
      emit("neighborhood", reg(radius), mode, filter);
      result = radius;
    }
    emit("jmp", end);
    emit(filter + ":");
    next = 0;
    const value = expr(predicate);
    emit("filter_return", reg(value));
    emit(end + ":");
    next = actionQuery ? start : start + 1;
    return result;
  }
  function expr(t) {
    const start = next,
      op = t.op;
    if (
      op in QUERY_MODES ||
      [
        "linked-mean-where",
        "linked-sum-where",
        "listen-where",
        "receive-where",
      ].includes(op)
    )
      return query(t);
    if (op === "state" || op === "let") return binding(t, expr);
    if (op === "do") {
      action(t.args[0]);
      return expr(t.args[1]);
    }
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
    if (op === "smooth") {
      const fraction = expr(t.args[0]),
        value = expr(t.args[1]),
        previous = reserve();
      const slot = temporalSlots.get(t);
      emit("max", reg(fraction), 0);
      emit("min", reg(fraction), 1);
      emit("mem_load", reg(previous), slot);
      emit("sub", reg(value), reg(previous));
      emit("mul", reg(value), reg(fraction));
      emit("add", reg(previous), reg(value));
      emit("mem_save", slot, reg(previous));
      emit("mov", reg(fraction), reg(previous));
      next = start + 1;
      return fraction;
    }
    if (op === "lag" || op === "delta") {
      const value = expr(t.args[0]),
        previous = reserve();
      const slot = temporalSlots.get(t);
      emit("mem_load", reg(previous), slot);
      emit("mem_save", slot, reg(value));
      emit(op === "lag" ? "mov" : "sub", reg(value), reg(previous));
      next = start + 1;
      return value;
    }
    if (["relu", "swish", "sin", "cos"].includes(op)) {
      const r = expr(t.args[0]);
      if (op === "relu") emit("max", reg(r), 0);
      else emit(op, reg(r));
      return r;
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
    if (op === "couple") {
      const r = expr(t.args[1]);
      emit("emit", t.args[0].value, reg(r));
      emit("linked_listen", reg(r), t.args[0].value);
      return r;
    }
    const r = reserve();
    if (op === "number" || op === "bool") emit("mov", reg(r), t.value);
    else if (op === "memory" || op === "birth-result")
      emit("mem_load", reg(r), op === "memory" ? t.args[0].value : 8);
    else if (op === "none") emit("mov", reg(r), 0);
    else if (op === "self") emit("sense", reg(r), "id");
    else if (op === "nearest-cell") emit("scan", reg(r), -1, 360);
    else if (op === "candidate") emit("candidate", reg(r));
    else if (op === "nearest-corpse") emit("scan_corpse", reg(r), 360);
    else if (op === "bond") emit("bond", reg(r), t.args[0].value);
    else if (op === "listen") emit("listen", reg(r), t.args[0].value);
    else if (op === "linked-signal" || op === "linked-sum")
      emit(
        op === "linked-sum" ? "linked_sum" : "linked_listen",
        reg(r),
        t.args[0].value,
      );
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
    if (t.op === "send-where") {
      query(t, true);
      return;
    }
    if (t.op === "child-set") {
      const start = next,
        r = expr(t.args[1]);
      emit("child_set", t.args[0].value, reg(r));
      next = start;
      return;
    }
    if (t.op === "child-turn") {
      const start = next,
        r = expr(t.args[0]);
      emit("child_turn", reg(r));
      next = start;
      return;
    }

    const op = t.op,
      base = next;
    if (op === "state" || op === "let") {
      binding(t, action);
      return;
    }
    if (op === "seq" || op === "do") {
      action(t.args[0]);
      action(t.args[1]);
      return;
    }
    if (op === "if") {
      const r = expr(t.args[0]),
        otherwise = mark(),
        end = mark();
      emit("jz", reg(r), otherwise);
      next = base;
      action(t.args[1]);
      emit("jmp", end);
      emit(otherwise + ":");
      action(t.args[2]);
      emit(end + ":");
      return;
    }
    if (op === "nop") emit("nop");
    else if (op === "photosynthesize" || op === "eat") emit(op, reg(reserve()));
    else if (op === "bud" || op === "split") {
      const r = reg(reserve());
      emit(op, r);
      emit("mem_save", 8, r);
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
    next = base;
  }
  emit("ROOT:");
  action(tree);
  if (loopYield) emit("wait", 0);
  emit("jmp", "ROOT");
  const source = lines.join("\n");
  let code;
  try {
    code = assemble(source, TREE_VM_OPS, GPU_SENSORS, GPU_FIELDS);
  } catch (e) {
    throw Error(e.message + "\n" + printTree(tree) + "\n" + source);
  }
  if (code.length > 64) throw Error("Compiled tree exceeds 64 instructions");
  return { ...code, source, tree: clone(tree), statefulSlots };
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
export const TREE_EVOLUTION_DEFAULTS = {
  mutationOrdinary: 1,
  mutationLocal: 0,
  mutationPoint: 0,
  mutationGuard: 0,
  mutationInsertion: 0,
  neighborhoodWeight: 0,
  developmentWeight: 0,
  memoryBias: 0,
  temporalWeight: 0,
  communicationWeight: 0,
  activationWeight: 0,
  generationDepth: 6,
  founderActions: 6,
  literalScale: 1,
  numericMutationScale: 1,
  functionMask0: 4294967295,
  functionMask1: 4294967295,
  functionMask2: 4294967295,
  functionMask3: 4294967295,
};
const essentialFunctions = new Set([
  "number",
  "bool",
  "slot",
  "channel",
  "nop",
  "seq",
]);
export function functionEnabled(name, options = {}) {
  if (essentialFunctions.has(name)) return true;
  const id = byName.get(name)?.id;
  if (id === undefined) return false;
  return Boolean(
    ((options["functionMask" + Math.floor(id / 32)] ?? 4294967295) >>>
      (id % 32)) &
    1,
  );
}
export function treeEvolutionOptions(options = {}) {
  const result = {};
  for (const [key, fallback] of Object.entries(TREE_EVOLUTION_DEFAULTS)) {
    const value = options[key] ?? fallback;
    const ranges = {
      generationDepth: [1, 8, true],
      founderActions: [1, 6, true],
      literalScale: [0.1, 4, false],
      numericMutationScale: [0, 2, false],
    };
    const [min, max, integer] = ranges[key] ?? [
      0,
      key.startsWith("functionMask") ? 4294967295 : 1,
      key.startsWith("functionMask"),
    ];
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw Error("Invalid " + key);
    result[key] = value;
  }
  return result;
}
function samplingWeight(name, options) {
  if (!functionEnabled(name, options)) return 0;
  if (["lag", "delta", "smooth"].includes(name)) return options.temporalWeight;
  if (["linked-signal", "linked-sum", "couple", "colony-size"].includes(name))
    return options.communicationWeight;
  if (["relu", "swish", "sin", "cos", "time"].includes(name))
    return options.activationWeight;
  if (
    name in QUERY_MODES ||
    [
      "where",
      "candidate",
      "linked-mean-where",
      "linked-sum-where",
      "listen-where",
      "send-where",
      "receive-where",
    ].includes(name)
  )
    return options.neighborhoodWeight;
  if (["child-set", "child-turn", "resist"].includes(name))
    return options.developmentWeight;
  return 1;
}
const generationCostCache = new WeakMap();
function generationCost(type, depth, filterContext, evolution) {
  if (depth < 1) return Infinity;
  let cache = generationCostCache.get(evolution);
  if (!cache) generationCostCache.set(evolution, (cache = new Map()));
  const key = `${type}:${depth}:${filterContext}`;
  if (cache.has(key)) return cache.get(key);
  let cost = Infinity;
  for (const s of TREE_SCHEMA) {
    if (!generatable(s, type, filterContext, evolution)) continue;
    const size =
      1 +
      s.args.reduce(
        (sum, arg) =>
          sum +
          generationCost(
            arg === "Any" ? type : arg,
            depth - 1,
            filterContext || s.name === "where",
            evolution,
          ),
        0,
      );
    cost = Math.min(cost, size);
  }
  cache.set(key, cost);
  return cost;
}
function generatable(s, type, filterContext, evolution) {
  return (
    (s.result === type ||
      (["if", "state", "let", "do"].includes(s.name) &&
        !["Memory", "Channel", "Filter"].includes(type))) &&
    samplingWeight(s.name, evolution) > 0 &&
    (!filterContext || FILTER_PURE.has(s.name)) &&
    (s.name !== "candidate" || filterContext)
  );
}
function grow(
  type,
  budget,
  depth,
  rng,
  evolution = TREE_EVOLUTION_DEFAULTS,
  scope = [],
  filterContext = false,
) {
  const options = TREE_SCHEMA.filter(
    (s) =>
      generatable(s, type, filterContext, evolution) &&
      1 +
        s.args.reduce(
          (sum, arg) =>
            sum +
            generationCost(
              arg === "Any" ? type : arg,
              depth - 1,
              filterContext || s.name === "where",
              evolution,
            ),
          0,
        ) <=
        budget,
  );
  if (
    type === "Memory" ||
    (type === "Number" &&
      functionEnabled("memory", evolution) &&
      budget >= 2 &&
      depth > 1)
  )
    for (const slot of scope)
      if (evolution.memoryBias > 0) options.push({ boundSlot: slot });
  const weights = options.map((s) =>
    s.boundSlot === undefined
      ? samplingWeight(s.name, evolution)
      : evolution.memoryBias,
  );
  let draw = rng() * weights.reduce((sum, w) => sum + w, 0),
    index = 0;
  while (index < weights.length - 1 && draw >= weights[index])
    draw -= weights[index++];
  const s = options[index];
  if (s?.boundSlot !== undefined) {
    const address = node("slot", [], s.boundSlot);
    return type === "Memory" ? address : node("memory", [address]);
  }
  if (!s) throw Error("Cannot generate type " + type);
  if (s.name === "number")
    return node(
      "number",
      [],
      Math.fround(
        constants[Math.floor(rng() * constants.length)] *
          evolution.literalScale,
      ),
    );
  if (s.name === "bool") return node("bool", [], Number(rng() < 0.5));
  if (s.name === "slot" || s.name === "channel")
    return node(s.name, [], Math.floor(rng() * (s.name === "slot" ? 8 : 4)));
  let remaining = budget - 1;
  const args = [];
  for (const [i, child] of s.args.entries()) {
    const childCost = (arg) =>
      generationCost(
        arg === "Any" ? type : arg,
        depth - 1,
        filterContext || s.name === "where",
        evolution,
      );
    const spare =
      remaining -
      s.args.slice(i + 1).reduce((sum, arg) => sum + childCost(arg), 0);
    const minimum = childCost(child);
    const allowance =
      i === s.args.length - 1
        ? spare
        : minimum + Math.floor(rng() * (spare - minimum + 1));
    const binding = ["state", "let"].includes(s.name);
    const childScope =
      binding && i === 2 ? [...new Set([...scope, args[0].value])] : scope;
    const t = grow(
      child === "Any" ? type : child,
      allowance,
      depth - 1,
      rng,
      evolution,
      binding && i === 0 ? [] : childScope,
      filterContext || s.name === "where",
    );
    remaining -= checkTree(t, null).count;
    args.push(t);
  }
  return node(s.name, args);
}
export function randomTree(
  rng = Math.random,
  maxNodes = MAX_TREE_NODES,
  options = {},
) {
  const evolution = treeEvolutionOptions(options);
  for (let i = 0; i < 64; i++) {
    // Sample a program of 1–6 random actions, not predominantly one action.
    // This changes structure only: no metabolic or reproductive primitive is
    // guaranteed, and there are no hand-written behavior templates.
    const count =
      1 +
      Math.floor(
        rng() * Math.min(evolution.founderActions, Math.ceil(maxNodes / 2)),
      );
    let remaining = maxNodes - (count - 1);
    const actions = [];
    for (let k = 0; k < count; k++) {
      const left = count - k;
      const allowance = Math.max(1, Math.floor(remaining / left));
      const action = grow(
        "Action",
        allowance,
        evolution.generationDepth,
        rng,
        evolution,
      );
      actions.push(action);
      remaining -= checkTree(action, null).count;
    }
    let t = actions.pop();
    while (actions.length) t = node("seq", [actions.pop(), t]);
    try {
      compileTree(t);
      return t;
    } catch (e) {
      if (
        !/limit|temporaries|64 instructions|Filters require pure expressions|Filter candidate|Index selectors/.test(
          e.message,
        )
      )
        throw e;
    }
  }
  throw Error("Could not sample bounded tree");
}
function mutateSubtree(tree, rng, evolution) {
  checkTree(tree);
  const original = printTree(tree),
    count = checkTree(tree).count;
  function paths(t, path = [], out = [], scope = [], filterContext = false) {
    out.push({ t, path, scope, filterContext, type: checkTree(t, null).type });
    t.args.forEach((a, i) =>
      paths(
        a,
        [...path, i],
        out,
        ["state", "let"].includes(t.op) && i === 2
          ? [...new Set([...scope, t.args[0].value])]
          : scope,
        filterContext || t.op === "where",
      ),
    );
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
              v +
                (rng() - 0.5) *
                  Math.max(0.1, Math.abs(v) * 0.25) *
                  evolution.numericMutationScale,
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
    } else {
      if (
        !Number.isFinite(
          generationCost(
            chosen.type,
            evolution.generationDepth,
            chosen.filterContext,
            evolution,
          ),
        )
      )
        continue;
      replacement = grow(
        chosen.type,
        MAX_TREE_NODES - count + checkTree(chosen.t, null).count,
        evolution.generationDepth,
        rng,
        evolution,
        chosen.scope,
        chosen.filterContext,
      );
    }
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
      if (
        !/limit|temporaries|64 instructions|Filters require pure expressions|Filter candidate|Index selectors/.test(
          e.message,
        )
      )
        throw e;
    }
  }
  throw Error("Could not produce a bounded mutation");
}

export function decodeTreeBytecode(buffer) {
  return disassemble(buffer, TREE_VM_OPS, GPU_SENSORS, GPU_FIELDS);
}

function subtrees(t, path = [], out = [], filterContext = false) {
  out.push({ tree: t, path, filterContext, ...checkTree(t, null) });
  t.args.forEach((child, i) =>
    subtrees(child, [...path, i], out, filterContext || t.op === "where"),
  );
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
      if (
        /limit|temporaries|64 instructions|Filters require pure expressions|Filter candidate|Index selectors/.test(
          error.message,
        )
      )
        continue;
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
    evolution = {},
  } = {},
) {
  for (const value of [archiveShare, crossoverRate, mutationRate])
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw Error("Invalid arrival probability");
  if (!archive.length || rng() >= archiveShare)
    return {
      tree: randomTree(rng, MAX_TREE_NODES, evolution),
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
  if (mutated) tree = mutateTree(tree, rng, evolution);
  return {
    tree,
    source: crossed ? "crossover" : "archive",
    parents,
    crossed,
    mutated,
  };
}

export function insertTreeMutation(
  tree,
  rng = Math.random,
  evolution = TREE_EVOLUTION_DEFAULTS,
) {
  evolution = treeEvolutionOptions(evolution);
  const count = checkTree(tree).count;
  const allowance = MAX_TREE_NODES - count - 1;
  if (allowance < 1) return { tree: clone(tree), inserted: false };
  const choices = subtrees(tree).filter(
    ({ type, filterContext }) =>
      ["Action", "Number", "Bool", "Cell"].includes(type) &&
      !(filterContext && type === "Cell"),
  );
  for (let attempt = 0; attempt < 64; attempt++) {
    const chosen = choices[Math.floor(rng() * choices.length)];
    const operators =
      chosen.type === "Action"
        ? ["seq"]
        : chosen.type === "Number"
          ? ["+", "-", "*", "/", "min", "max"]
          : chosen.type === "Bool"
            ? ["and", "or"]
            : ["do"];
    const allowed = operators.filter((op) => functionEnabled(op, evolution));
    if (!allowed.length) continue;
    const op = allowed[Math.floor(rng() * allowed.length)];
    if (
      generationCost(
        chosen.type === "Cell" ? "Action" : chosen.type,
        Math.min(4, evolution.generationDepth),
        chosen.filterContext,
        evolution,
      ) > allowance
    )
      continue;
    const extra = grow(
      chosen.type === "Cell" ? "Action" : chosen.type,
      allowance,
      Math.min(4, evolution.generationDepth),
      rng,
      evolution,
      [],
      chosen.filterContext,
    );
    const oldIndex = chosen.type === "Cell" ? 1 : Number(rng() < 0.5);
    const args = oldIndex
      ? [extra, clone(chosen.tree)]
      : [clone(chosen.tree), extra];
    const changed = replaceSubtree(tree, chosen.path, node(op, args));
    try {
      compileTree(changed);
      return {
        tree: changed,
        inserted: true,
        path: chosen.path,
        oldIndex,
        operator: op,
      };
    } catch (e) {
      if (
        !/limit|temporaries|64 instructions|Filters require pure expressions|Filter candidate|Index selectors/.test(
          e.message,
        )
      )
        throw e;
    }
  }
  return { tree: clone(tree), inserted: false };
}

// Extra mutation controls are weights relative to ordinary mutation (weight 1).
// An unsuccessful bounded edit falls back to ordinary mutation.
export function mutateTree(tree, rng = Math.random, options = {}) {
  const evolution = treeEvolutionOptions(options);
  const names = [
    "mutationLocal",
    "mutationPoint",
    "mutationGuard",
    "mutationInsertion",
  ];
  const extra = names.reduce((sum, key) => sum + evolution[key], 0);
  if (extra > 0) {
    let draw = rng() * (evolution.mutationOrdinary + extra);
    if (draw >= evolution.mutationOrdinary) {
      draw -= evolution.mutationOrdinary;
      for (const name of names) {
        if (draw < evolution[name]) {
          let child;
          if (name === "mutationInsertion") {
            const edit = insertTreeMutation(tree, rng, evolution);
            if (edit.inserted) child = edit.tree;
          } else if (name === "mutationGuard")
            child = guardMutation(tree, rng, evolution);
          else
            child = localMutation(
              tree,
              rng,
              evolution,
              name === "mutationPoint",
            );
          if (child) return child;
          break;
        }
        draw -= evolution[name];
      }
    }
  }
  return mutateSubtree(tree, rng, evolution);
}
function localMutation(tree, rng, evolution, operationOnly) {
  const original = printTree(tree),
    choices = subtrees(tree);
  for (let attempt = 0; attempt < 64; attempt++) {
    const selected = choices[Math.floor(rng() * choices.length)],
      t = clone(selected.tree);
    const spec = byName.get(t.op);
    if (t.value !== undefined) {
      if (operationOnly) continue;
      if (t.op === "number")
        t.value = Math.fround(
          Math.max(
            -999999,
            Math.min(
              999999,
              t.value +
                (rng() - 0.5) *
                  Math.max(0.1, Math.abs(t.value) * 0.25) *
                  evolution.numericMutationScale,
            ),
          ),
        );
      else {
        const count = t.op === "bool" ? 2 : t.op === "slot" ? 8 : 4;
        t.value = (t.value + 1 + Math.floor(rng() * (count - 1))) % count;
      }
    } else {
      const peers = TREE_SCHEMA.filter(
        (s) =>
          s.name !== t.op &&
          (s.name !== "candidate" || selected.filterContext) &&
          (!selected.filterContext || FILTER_PURE.has(s.name)) &&
          !["number", "bool", "slot", "channel"].includes(s.name) &&
          samplingWeight(s.name, evolution) > 0 &&
          s.result === spec.result &&
          s.args.join(",") === spec.args.join(","),
      );
      if (!peers.length) continue;
      t.op = peers[Math.floor(rng() * peers.length)].name;
    }
    const child = replaceSubtree(tree, selected.path, t);
    try {
      compileTree(child);
      if (printTree(child) !== original) return child;
    } catch (e) {
      if (
        !/limit|temporaries|64 instructions|Filters require pure expressions|Filter candidate|Index selectors/.test(
          e.message,
        )
      )
        throw e;
    }
  }
  return null;
}
function guardMutation(tree, rng, evolution) {
  if (!functionEnabled("if", evolution)) return null;
  const spare = MAX_TREE_NODES - checkTree(tree).count;
  if (spare < 3) return null;
  const choices = subtrees(tree).filter((t) => t.type === "Action");
  for (let attempt = 0; attempt < 64; attempt++) {
    const selected = choices[Math.floor(rng() * choices.length)],
      predicate = grow(
        "Bool",
        spare - 2,
        evolution.generationDepth,
        rng,
        evolution,
      ),
      branch = rng() < 0.5 ? 1 : 2;
    const args = [predicate, node("nop"), node("nop")];
    args[branch] = selected.tree;
    const child = replaceSubtree(tree, selected.path, node("if", args));
    try {
      compileTree(child);
      return child;
    } catch (e) {
      if (
        !/limit|temporaries|64 instructions|Filters require pure expressions|Filter candidate|Index selectors/.test(
          e.message,
        )
      )
        throw e;
    }
  }
  return null;
}
