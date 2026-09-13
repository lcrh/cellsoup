import { isCoreFunction } from "./core-language.js";
import { TREE_SCHEMA } from "./trees.js";
import { GPU_OPS } from "./language.js";
const descriptions = {
  resist:
    "Set persistent anchoring from 0 to 1; 0 releases it. Strong drag braces against the environment so contraction can pull linked neighbors. Costs energy per second and switches off if upkeep is unaffordable. The daughter inherits the brace level.",
  sin: "Sine of an angle in radians. Pure numeric function; combine with time and a phase offset for oscillation.",
  cos: "Cosine of an angle in radians. Pure numeric function; combine with time and a phase offset for oscillation.",
  time: "Simulation time in seconds, shared by every cell. Multiply by angular frequency, then add a phase offset, before applying sin or cos.",
  "colony-size":
    "Number of living cells in your entire connected component, including yourself. A solitary cell reads 1; this follows the whole body, not just direct links.",
  number:
    "A numeric literal, such as 0, 0.5 or 90. Values are bounded by the VM.",
  bool: "A boolean literal: true or false.",
  slot: "A persistent memory address m0–m7.",
  channel: "One of four independent communication channels: c0–c3.",
  energy: "Your usable energy. Reaching zero kills the cell.",
  storage:
    "Your stored reserves. These diffuse through links and require mobilization before use.",
  sunlight: "Local sunlight intensity, from 0 to 1.",
  temperature: "Your temperature in degrees Celsius.",
  linked_storage:
    "Mean stored reserves of directly linked living neighbors; zero without neighbors.",
  linked_temperature:
    "Mean temperature of directly linked living neighbors; zero without neighbors.",
  crowding:
    "Nearby overlap/density. Larger values also reduce physical cooling.",
  age: "Age in simulated seconds.",
  generation: "Number of divisions since this cell’s immigrant ancestor.",
  bonds: "Number of direct living links, from 0 to 4.",
  rotation:
    "Current angular velocity, relative to the cell. This is not an absolute heading.",
  color: "Your visible numeric hue, in degrees.",
  tag: "Your integer tag, from 0 to 255.",
  self: "A handle for this cell.",
  none: "An absent target. Target reads return zero; unlinking none removes all links.",
  "nearest-cell": "Nearest living cell within sensing range; none if absent.",
  "nearest-corpse":
    "Nearest edible corpse within sensing range; none if absent.",
  memory: "Read one of the eight persistent numeric values.",
  "birth-result":
    "0 in the parent, 1 in its daughter, −1 when the attempted division fails.",
  "+": "Add two numbers.",
  "-": "Subtract the second number from the first.",
  "*": "Multiply two numbers.",
  "/": "Protected division; a zero divisor produces zero.",
  mod: "Protected remainder; a zero divisor produces zero.",
  min: "The smaller input.",
  max: "The larger input.",
  abs: "Absolute value.",
  random: "A new random fraction of the supplied value.",
  ">": "True when the first number is greater.",
  "<": "True when the first number is smaller.",
  "=": "True when the numbers are equal.",
  not: "Invert a boolean.",
  and: "Both conditions must hold. The second is skipped if the first is false.",
  or: "Either condition may hold. The second is skipped if the first is true.",
  if: "Evaluate only the chosen branch. Both branches must have the same type. Useful for zero gating or conditional actions.",
  scan: "Find a nearby living cell using relative viewing direction and cone width in degrees.",
  "scan-color":
    "Find a nearby living cell using target hue and hue tolerance in degrees.",
  bond: "Get the neighbor in link slot c0–c3; none if that slot is empty.",
  alive: "True if the target is currently alive.",
  kin: "True if the target shares your genotype.",
  "sunlight-bearing":
    "Relative direction toward brighter sunlight; zero when the gradient is flat.",
  "sunlight-slope": "Strength of the local sunlight gradient.",
  "storage-bearing":
    "Relative direction toward nearby stored energy. Filter 0: living, 1: corpses, −1: both.",
  "storage-slope":
    "Strength of that stored-energy gradient, with the same living/dead filter.",
  listen:
    "Average environmental broadcast on the chosen channel from nearby cells; does not consume signals.",
  receive:
    "Consume the latest direct mailbox message on this channel; zero if none. Messages differ from persistent broadcasts.",
  nop: "Do nothing for this instruction. Ordinary upkeep still applies.",
  photosynthesize:
    "Harvest sunlight into usable energy. Light per tick, conversion/specialization efficiency, and the energy fill curve determine actual gain.",
  eat: "Eat a randomly selected nearby corpse. The corpse loses consumed material once; actual usable gain follows conversion/specialization efficiency and the energy fill curve.",
  bud: "Divide, staying linked. Requires energy and a free link slot. Returns through birth-result.",
  split:
    "Divide and disconnect the daughter. Requires sufficient energy. Returns through birth-result.",
  seq: "Execute actions in order.",
  set: "Write a numeric value to a persistent memory slot.",
  move: "Apply forward/backward thrust. Amount is clamped to −1…1; spring links pull other cells along.",
  turn: "Rotate by a relative number of degrees, clamped to −360…360. Costs energy.",
  contract: "Adjust spring rest lengths, spending energy.",
  shield:
    "Spend up to amount energy to build a persistent barrier, limited by capacity and build efficiency. Zero does nothing. Hits consume barrier points before cell energy, with damage absorbed per point set by toughness. Unpaid upkeep erodes the barrier. Division shares existing points between parent and daughter.",
  "color-set": "Set your visible hue, wrapping around 360 degrees.",
  "tag-set": "Set your integer tag.",
  store:
    "Spend usable energy to fill stored reserves. Filling becomes less efficient as reserves grow; returns the actual amount stored and keeps a tiny usable reserve.",
  mobilize:
    "Consume stored reserves to gain usable energy, reduced by conversion/specialization efficiency and the current energy fill curve. Returns actual energy gained. Cannot rescue an already dead cell.",
  wait: "Yield execution for the requested number of ticks; wait 0 yields until the next tick.",
  link: "Attempt a reciprocal spring link to a nearby living target.",
  unlink: "Remove the link to this target; none removes all links.",
  attack:
    "Strike a nearby living target with the supplied effort, capped by Maximum strike effort. Damage equals the variable energy actually spent × attack effectiveness; the separate base fee produces no damage. A configurable closing-speed bonus multiplies damage by 1 + bonus × relative approach speed. Barriers absorb hits first. Does not steal reserves; a resulting corpse can be eaten.",
  give: "Give a fraction (0–1) of your usable energy to a nearby or directly linked living target, preserving a tiny reserve. Incoming gifts are pooled and follow the recipient’s energy fill curve; transferred energy can be lost, never multiplied.",
  emit: "Publish a persistent broadcast on c0–c3, clipped to −100…100, at the configured cost. Neighbors can aggregate it, and nearby cells can listen.",
  send: "Send a direct mailbox message to the chosen linked target and channel. none broadcasts to direct links.",
  state:
    "Initialize named numeric state once, then evaluate the body. Exact-copy division inherits it. Use set! to update the name.",
  let: "Evaluate a named numeric local once per evaluation, then use it in the body.",
  do: "Perform an action and then return the value of another expression.",
  lag: "Return this occurrence’s previous input, then remember the current input. History starts at zero.",
  delta:
    "Return current input minus the previous input, then remember the current input.",
  smooth:
    "Exponential smoothing: previous + clamp(alpha,0,1) × (input − previous). Each occurrence has private history.",
  "linked-signal":
    "Mean broadcast on c0–c3 from reciprocal direct neighbors. Optional relaying spreads attenuated signals farther, one hop per tick. Does not consume messages.",
  "linked-sum":
    "Sum of the same linked broadcasts, without dividing by the number of neighbors.",
  couple:
    "Publish a value on one channel, then read that channel’s linked mean. Both steps obey ordinary instruction costs and timing.",
  relu: "Pure numeric activation: max(0, x). Negative inputs are gated to zero.",
  swish:
    "Pure numeric activation: x / (1 + exp(−x)). Smooth gating; stable for large inputs.",
  where:
    "A selection predicate evaluated for each candidate. Combine comparisons with and, or and not. Only pure expressions are allowed; it cannot perform actions, consume messages or update history.",
  candidate:
    "The cell or corpse currently being considered inside a where filter. Outside a filter it is not a valid expression.",
  nearby:
    "Select the nearest matching cell or corpse within the requested radius. Returns none if absent. Queries obey the world sensing radius and scan budget; crowded neighborhoods may be sampled incompletely.",
  "centroid-bearing":
    "Relative direction toward the centroid of matching neighbors. Returns zero if none, or if their centroid coincides with you.",
  "centroid-distance":
    "Distance to the centroid of matching neighbors; zero without matches.",
  "neighbor-count":
    "Number of matching neighbors found within the radius and scan budget.",
  alignment:
    "Relative direction of the average heading of matching living neighbors. Turns toward their travel orientation; does not reveal an absolute heading.",
  "separation-bearing":
    "Relative direction away from matching neighbors, weighting closer neighbors more strongly.",
  "separation-strength":
    "Strength of the local separation vector, weighting closer neighbors more strongly.",
  "linked-mean-where":
    "Average the selected channel of direct linked neighbors that satisfy the filter. Optional broadcast relay applies before selection. Zero if none.",
  "linked-sum-where":
    "Sum the selected channel of matching direct linked neighbors. Optional broadcast relay applies before selection.",
  "listen-where":
    "Average the selected channel of nearby matching living cells in the requested radius. Does not consume broadcasts.",
  "send-where":
    "Send a direct mailbox message on c0–c3 to each matching direct link. Uses the configured message cost. A mailbox retains the latest delivered message.",
  "receive-where":
    "Consume the latest message on a channel only when its sender still matches the filter; otherwise return zero and leave it unread.",
  "child-set":
    "Set a memory slot on the next successfully born daughter, leaving the parent unchanged. A failed division keeps the pending modifier. A later child-set for the same slot replaces it.",
  "child-turn":
    "Set the next daughter’s heading offset relative to the parent, in degrees, in addition to configured random jitter. Does not rotate the parent. Consumed only by successful division.",
};
const examples = {
  resist: "(resist 0.8)",
  sin: "(sin (+ (time) 0.5))",
  cos: "(cos (* (time) 2))",
  "child-set": "(seq (child-set m0 (* (memory m0) 0.5)) (bud))",
  "child-turn": "(seq (child-turn 30) (bud))",
  candidate: "(link (nearby 60 (where (kin (candidate)))))",
  number: "0.5",
  bool: "true",
  slot: "m0",
  channel: "c0",
  state: "(state ((acc 0)) (set! acc (+ acc 1)))",
  let: "(let ((x (sunlight))) (move x))",
  if: "(if (> (sunlight) 0.5) (photosynthesize) (eat))",
  relu: "(relu (- (linked-signal c0) 0.5))",
  swish: "(swish (linked-sum c1))",
  couple: "(couple c2 (relu (linked-signal c0)))",
};
const argument = {
  Number: "0.5",
  Bool: "true",
  Cell: "(nearest living)",
  Memory: "m0",
  Channel: "c0",
  Action: "(nop)",
  Any: "(nop)",
  Filter: "(where (alive (candidate)))",
};
export const FUNCTION_REFERENCE = TREE_SCHEMA.map((spec) => {
  let description = descriptions[spec.name];
  if (spec.name.startsWith("target-"))
    description = `Read the target’s ${spec.name.slice(7)}. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.`;
  if (spec.name === "target-shield")
    description =
      "Read the target’s remaining barrier points, before applying barrier toughness. Zero means no barrier or no valid target.";
  if (!description) description = GPU_OPS.find((o) => o[0] === spec.name)?.[2];
  if (!description) throw Error("Missing function documentation: " + spec.name);
  return {
    ...spec,
    description,
    example:
      examples[spec.name] ??
      `(${spec.name}${spec.args.length ? " " + spec.args.map((t) => argument[t]).join(" ") : ""})`,
    essential: isCoreFunction(spec.name),
  };
});
