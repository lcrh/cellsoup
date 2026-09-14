# Cell Soup function vocabulary

The browser reference is searchable and shows an evolution switch for every primitive. Basic computation, comparisons, memory, energy, movement, waiting and reproduction form a protected core that stays enabled. Optional senses, communication, oscillators and other extensions can be switched off manually or varied by Random new world. Switches affect new random programs and mutations, not already running genomes. Syntax aliases lower to those same primitives. Older saved setups are normalized to keep the core enabled while preserving their optional switches.

Programs are typed Lisp trees, limited to 32 nodes and 64 compiled instructions. Cells retain eight numeric memory slots across program cycles and exact-copy division. Temporal expressions and named bindings share that memory budget. Actions still spend energy and generate heat.

## Reading and selecting the environment

Selections compose with pure predicates. All bearings and alignment values are relative to the observing cell. Explicit-radius neighborhood queries exclude the observing cell, use a configurable radius up to 128 units, and examine at most the configured neighbor budget; dense neighborhoods can be incomplete. Filter expressions cannot perform actions, update history, or consume messages. Four independent channels are named c0 through c3.

### nearest

`(nearest selection [radius] [filter])`

Select the closest matching cell or corpse. Unqualified living/corpse uses the original 60-unit scan; an explicit radius or filter uses the bounded neighborhood query.

```lisp
(turn (orientation (nearest corpse 80)))
```

Palette primitives: `nearest-cell`, `nearest-corpse`, `nearby`, `where`, `candidate`, `alive`, `not`, `target-bearing`.

### selection

`living | corpse | kin | other | any`

Pure categories may be combined with and, or, not and (where predicate). Candidate means the cell being considered. Other means a living non-kin cell.

```lisp
(link (nearest (and living (where (> (storage candidate) 4))) 80))
```

Palette primitives: `where`, `candidate`, `alive`, `kin`, `and`, `or`, `not`, `target-storage`, `nearby`, `link`.

### orientation

`(orientation cell)`

Relative bearing toward the selected cell, in degrees; no absolute compass direction.

```lisp
(turn (orientation (nearest living)))
```

Palette primitives: `target-bearing`, `nearby`, `where`, `candidate`, `alive`.

### distance

`(distance cell)`

Distance to the selected cell. The GPU query determines which candidates are available.

```lisp
(move (distance (nearest living)))
```

Palette primitives: `target-distance`, `nearby`, `where`, `candidate`, `alive`.

### cell-fields

`(energy cell), (storage cell), (temperature cell), (color cell), (tag cell), (bonds cell)`

Read a selected cell field. The corresponding zero-argument form reads your own cell.

```lisp
(set m0 (storage (nearest corpse)))
```

Palette primitives: `target-energy`, `target-storage`, `target-temperature`, `target-color`, `target-tag`, `target-bonds`.

### centroid

`(orientation (centroid selection [radius])), (distance (centroid selection [radius]))`

Bearing or distance toward the mean relative position of matching neighbors; useful for cohesion.

```lisp
(turn (orientation (centroid living 80)))
```

Palette primitives: `centroid-bearing`, `centroid-distance`, `where`, `candidate`, `alive`.

### separation

`(orientation (separation selection [radius])), (strength (separation selection [radius]))`

Direction and magnitude of the separation response away from matching neighbors.

```lisp
(turn (orientation (separation living 40)))
```

Palette primitives: `separation-bearing`, `separation-strength`, `where`, `candidate`, `alive`.

### count

`(count selection [radius])`

Count the bounded set of matching neighbors.

```lisp
(move (count living 60))
```

Palette primitives: `neighbor-count`, `where`, `candidate`, `alive`.

### alignment

`(alignment selection [radius])`

Mean heading of matching neighbors relative to your own heading, in degrees.

```lisp
(turn (alignment living 80))
```

Palette primitives: `alignment`, `where`, `candidate`, `alive`.

### linked-mean

`(linked-mean channel [selection]), (linked-sum channel [selection])`

Read the mean or sum of previous-tick broadcast signals from reciprocal linked neighbors matching an optional filter.

```lisp
(move (linked-mean c1 kin))
```

Palette primitives: `linked-signal`, `linked-sum`, `linked-mean-where`, `linked-sum-where`, `where`, `candidate`, `alive`, `kin`, `and`.

### broadcast

`(broadcast channel value)`

Publish a value on one of four channels. Linked and proximity listeners choose which senders to aggregate.

```lisp
(broadcast c2 (relu (- (energy) 20)))
```

Palette primitives: `emit`, `relu`, `-`, `energy`.

### send-linked

`(send-linked channel value [selection])`

Send a mailbox message to matching direct reciprocal links. Selection defaults to living; receive consumes a mailbox value.

```lisp
(send-linked c0 (storage) kin)
```

Palette primitives: `send-where`, `where`, `candidate`, `alive`, `kin`, `and`.

### filtered-listen

`(listen channel radius selection), (receive channel selection)`

Average filtered nearby broadcasts, or consume a mailbox message only if its sender matches the selection.

```lisp
(move (listen c3 80 living))
```

Palette primitives: `listen-where`, `receive-where`, `where`, `candidate`, `alive`.

## Primitive reference

Examples show an expression unless a short sequence is needed to demonstrate context. Number expressions can feed movement, conditions or memory; cell expressions can feed linking, attacks or field reads. `candidate` is valid only inside a `where` filter. The selected branch or body determines the result type of `if`, `state`, `let` and `do`.

### number

No inputs → Number. Core toolkit; always enabled.

A numeric literal, such as 0, 0.5 or 90. Values are bounded by the VM.

```lisp
0.5
```

### bool

No inputs → Bool. Core toolkit; always enabled.

A boolean literal: true or false.

```lisp
true
```

### slot

No inputs → Memory. Core toolkit; always enabled.

A persistent memory address m0–m7.

```lisp
m0
```

### channel

No inputs → Channel. Core toolkit; always enabled.

One of four independent communication channels: c0–c3.

```lisp
c0
```

### energy

No inputs → Number. Core toolkit; always enabled.

Your usable energy. Reaching zero kills the cell.

```lisp
(energy)
```

### storage

No inputs → Number. Core toolkit; always enabled.

Your stored reserves. These diffuse through links and require mobilization before use.

```lisp
(storage)
```

### sunlight

No inputs → Number.

Local sunlight intensity, from 0 to 1.

```lisp
(sunlight)
```

### temperature

No inputs → Number.

Your temperature in degrees Celsius.

```lisp
(temperature)
```

### linked_storage

No inputs → Number.

Mean stored reserves of directly linked living neighbors; zero without neighbors.

```lisp
(linked_storage)
```

### linked_temperature

No inputs → Number.

Mean temperature of directly linked living neighbors; zero without neighbors.

```lisp
(linked_temperature)
```

### crowding

No inputs → Number.

Nearby overlap/density. Larger values also reduce physical cooling.

```lisp
(crowding)
```

### age

No inputs → Number.

Age in simulated seconds.

```lisp
(age)
```

### generation

No inputs → Number.

Number of divisions since this cell’s immigrant ancestor.

```lisp
(generation)
```

### bonds

No inputs → Number.

Number of direct living links, from 0 to 4.

```lisp
(bonds)
```

### rotation

No inputs → Number.

Current angular velocity, relative to the cell. This is not an absolute heading.

```lisp
(rotation)
```

### color

No inputs → Number.

Your visible numeric hue, in degrees.

```lisp
(color)
```

### tag

No inputs → Number.

Your integer tag, from 0 to 255.

```lisp
(tag)
```

### self

No inputs → Cell. Core toolkit; always enabled.

A handle for this cell.

```lisp
(self)
```

### none

No inputs → Cell. Core toolkit; always enabled.

An absent target. Target reads return zero; unlinking none removes all links.

```lisp
(none)
```

### nearest-cell

No inputs → Cell.

Nearest living cell within sensing range; none if absent.

```lisp
(nearest-cell)
```

### nearest-corpse

No inputs → Cell.

Nearest edible corpse within sensing range; none if absent.

```lisp
(nearest-corpse)
```

### memory

Memory → Number. Core toolkit; always enabled.

Read one of the eight persistent numeric values.

```lisp
(memory m0)
```

### birth-result

No inputs → Number. Core toolkit; always enabled.

0 in the parent, 1 in its daughter, −1 when the attempted division fails.

```lisp
(birth-result)
```

### +

Number, Number → Number. Core toolkit; always enabled.

Add two numbers.

```lisp
(+ 0.5 0.5)
```

### -

Number, Number → Number. Core toolkit; always enabled.

Subtract the second number from the first.

```lisp
(- 0.5 0.5)
```

### *

Number, Number → Number. Core toolkit; always enabled.

Multiply two numbers.

```lisp
(* 0.5 0.5)
```

### /

Number, Number → Number. Core toolkit; always enabled.

Protected division; a zero divisor produces zero.

```lisp
(/ 0.5 0.5)
```

### mod

Number, Number → Number. Core toolkit; always enabled.

Protected remainder; a zero divisor produces zero.

```lisp
(mod 0.5 0.5)
```

### min

Number, Number → Number. Core toolkit; always enabled.

The smaller input.

```lisp
(min 0.5 0.5)
```

### max

Number, Number → Number. Core toolkit; always enabled.

The larger input.

```lisp
(max 0.5 0.5)
```

### abs

Number → Number. Core toolkit; always enabled.

Absolute value.

```lisp
(abs 0.5)
```

### random

Number → Number.

A new random fraction of the supplied value.

```lisp
(random 0.5)
```

### >

Number, Number → Bool. Core toolkit; always enabled.

True when the first number is greater.

```lisp
(> 0.5 0.5)
```

### <

Number, Number → Bool. Core toolkit; always enabled.

True when the first number is smaller.

```lisp
(< 0.5 0.5)
```

### =

Number, Number → Bool. Core toolkit; always enabled.

True when the numbers are equal.

```lisp
(= 0.5 0.5)
```

### not

Bool → Bool. Core toolkit; always enabled.

Invert a boolean.

```lisp
(not true)
```

### and

Bool, Bool → Bool. Core toolkit; always enabled.

Both conditions must hold. The second is skipped if the first is false.

```lisp
(and true true)
```

### or

Bool, Bool → Bool. Core toolkit; always enabled.

Either condition may hold. The second is skipped if the first is true.

```lisp
(or true true)
```

### if

Bool, Any, Any → Any. Core toolkit; always enabled.

Evaluate only the chosen branch. Both branches must have the same type. Useful for zero gating or conditional actions.

```lisp
(if (> (sunlight) 0.5) (photosynthesize) (eat))
```

### scan

Number, Number → Cell.

Find a nearby living cell using relative viewing direction and cone width in degrees.

```lisp
(scan 0.5 0.5)
```

### scan-color

Number, Number → Cell.

Find a nearby living cell using target hue and hue tolerance in degrees.

```lisp
(scan-color 0.5 0.5)
```

### bond

Channel → Cell.

Get the neighbor in link slot c0–c3; none if that slot is empty.

```lisp
(bond c0)
```

### target-energy

Cell → Number.

Read the target’s energy. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-energy (nearest living))
```

### target-storage

Cell → Number.

Read the target’s storage. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-storage (nearest living))
```

### target-temperature

Cell → Number.

Read the target’s temperature. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-temperature (nearest living))
```

### target-distance

Cell → Number.

Read the target’s distance. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-distance (nearest living))
```

### target-bearing

Cell → Number.

Read the target’s bearing. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-bearing (nearest living))
```

### target-color

Cell → Number.

Read the target’s color. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-color (nearest living))
```

### target-tag

Cell → Number.

Read the target’s tag. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-tag (nearest living))
```

### target-shield

Cell → Number.

Read the target’s remaining barrier points, before applying barrier toughness. Zero means no barrier or no valid target.

```lisp
(target-shield (nearest living))
```

### target-bonds

Cell → Number.

Read the target’s bonds. Returns zero for an absent or out-of-range handle. Bearings are relative; storage also reads remaining corpse value.

```lisp
(target-bonds (nearest living))
```

### alive

Cell → Bool.

True if the target is currently alive.

```lisp
(alive (nearest living))
```

### kin

Cell → Bool.

True if the target shares your genotype.

```lisp
(kin (nearest living))
```

### sunlight-bearing

No inputs → Number.

Relative direction toward brighter sunlight; zero when the gradient is flat.

```lisp
(sunlight-bearing)
```

### sunlight-slope

No inputs → Number.

Strength of the local sunlight gradient.

```lisp
(sunlight-slope)
```

### storage-bearing

Number → Number.

Relative direction toward nearby stored energy. Filter 0: living, 1: corpses, −1: both.

```lisp
(storage-bearing 0.5)
```

### storage-slope

Number → Number.

Strength of that stored-energy gradient, with the same living/dead filter.

```lisp
(storage-slope 0.5)
```

### listen

Channel → Number.

Average environmental broadcast on the chosen channel from nearby cells; does not consume signals.

```lisp
(listen c0)
```

### receive

Channel → Number.

Consume the latest direct mailbox message on this channel; zero if none. Messages differ from persistent broadcasts.

```lisp
(receive c0)
```

### nop

No inputs → Action. Core toolkit; always enabled.

Do nothing for this instruction. Ordinary upkeep still applies.

```lisp
(nop)
```

### photosynthesize

No inputs → Action. Core toolkit; always enabled.

undefined

```lisp
(photosynthesize)
```

### eat

No inputs → Action. Core toolkit; always enabled.

undefined

```lisp
(eat)
```

### bud

No inputs → Action. Core toolkit; always enabled.

Divide, staying linked. Requires energy and a free link slot. Returns through birth-result. An unaffordable attempt or a full set of links returns failure immediately and continues execution; a feasible attempt pauses for synchronized division. Entity capacity does not block the birth: after division, both parent and daughter participate in low-energy-biased capacity culling.

```lisp
(bud)
```

### split

No inputs → Action. Core toolkit; always enabled.

Divide and disconnect the daughter. Requires sufficient energy. Returns through birth-result. An unaffordable attempt returns failure immediately and continues execution; a feasible attempt pauses for synchronized division. Entity capacity does not block the birth: after division, both parent and daughter participate in low-energy-biased capacity culling.

```lisp
(split)
```

### seq

Action, Action → Action. Core toolkit; always enabled.

Execute actions in order.

```lisp
(seq (nop) (nop))
```

### set

Memory, Number → Action. Core toolkit; always enabled.

Write a numeric value to a persistent memory slot.

```lisp
(set m0 0.5)
```

### move

Number → Action. Core toolkit; always enabled.

Apply forward/backward thrust. Amount is clamped to −1…1; spring links pull other cells along.

```lisp
(move 0.5)
```

### turn

Number → Action. Core toolkit; always enabled.

Rotate by a relative number of degrees, clamped to −360…360. Costs energy.

```lisp
(turn 0.5)
```

### contract

Number → Action.

Adjust spring rest lengths, spending energy.

```lisp
(contract 0.5)
```

### shield

Number → Action.

Spend up to amount energy to build a persistent barrier, limited by capacity and build efficiency. Zero does nothing. Hits consume barrier points before cell energy, with damage absorbed per point set by toughness. Unpaid upkeep erodes the barrier. Division shares existing points between parent and daughter.

```lisp
(shield 0.5)
```

### color-set

Number → Action.

Set your visible hue, wrapping around 360 degrees.

```lisp
(color-set 0.5)
```

### tag-set

Number → Action.

Set your integer tag.

```lisp
(tag-set 0.5)
```

### store

Number → Action. Core toolkit; always enabled.

undefined

```lisp
(store 0.5)
```

### mobilize

Number → Action. Core toolkit; always enabled.

undefined

```lisp
(mobilize 0.5)
```

### wait

Number → Action. Core toolkit; always enabled.

Yield execution for the requested number of ticks; wait 0 yields until the next tick.

```lisp
(wait 0.5)
```

### link

Cell → Action.

Attempt a reciprocal spring link to a nearby living target.

```lisp
(link (nearest living))
```

### unlink

Cell → Action.

Remove the link to this target; none removes all links.

```lisp
(unlink (nearest living))
```

### attack

Cell, Number → Action.

Strike a nearby living target with the supplied effort, capped by Maximum strike effort. Damage equals the variable energy actually spent × attack effectiveness; the separate base fee produces no damage. A configurable closing-speed bonus multiplies damage by 1 + bonus × relative approach speed. Barriers absorb hits first. Does not steal reserves; a resulting corpse can be eaten.

```lisp
(attack (nearest living) 0.5)
```

### give

Cell, Number → Action.

undefined

```lisp
(give (nearest living) 0.5)
```

### emit

Channel, Number → Action.

Publish a persistent broadcast on c0–c3, clipped to −100…100, at the configured cost. Neighbors can aggregate it, and nearby cells can listen.

```lisp
(emit c0 0.5)
```

### send

Cell, Channel, Number → Action.

Send a direct mailbox message to the chosen linked target and channel. none broadcasts to direct links.

```lisp
(send (nearest living) c0 0.5)
```

### state

Memory, Number, Any → Any. Core toolkit; always enabled.

Initialize named numeric state once, then evaluate the body. Exact-copy division inherits it. Use set! to update the name.

```lisp
(state ((acc 0)) (set! acc (+ acc 1)))
```

### let

Memory, Number, Any → Any. Core toolkit; always enabled.

Evaluate a named numeric local once per evaluation, then use it in the body.

```lisp
(let ((x (sunlight))) (move x))
```

### do

Action, Any → Any. Core toolkit; always enabled.

Perform an action and then return the value of another expression.

```lisp
(do (nop) (nop))
```

### lag

Number → Number.

Return this occurrence’s previous input, then remember the current input. History starts at zero.

```lisp
(lag 0.5)
```

### delta

Number → Number.

Return current input minus the previous input, then remember the current input.

```lisp
(delta 0.5)
```

### smooth

Number, Number → Number.

Exponential smoothing: previous + clamp(alpha,0,1) × (input − previous). Each occurrence has private history.

```lisp
(smooth 0.5 0.5)
```

### linked-signal

Channel → Number.

Mean broadcast on c0–c3 from reciprocal direct neighbors. Optional relaying spreads attenuated signals farther, one hop per tick. Does not consume messages.

```lisp
(linked-signal c0)
```

### linked-sum

Channel → Number.

Sum of the same linked broadcasts, without dividing by the number of neighbors.

```lisp
(linked-sum c0)
```

### couple

Channel, Number → Number.

Publish a value on one channel, then read that channel’s linked mean. Both steps obey ordinary instruction costs and timing.

```lisp
(couple c2 (relu (linked-signal c0)))
```

### relu

Number → Number.

Pure numeric activation: max(0, x). Negative inputs are gated to zero.

```lisp
(relu (- (linked-signal c0) 0.5))
```

### swish

Number → Number.

Pure numeric activation: x / (1 + exp(−x)). Smooth gating; stable for large inputs.

```lisp
(swish (linked-sum c1))
```

### where

Bool → Filter.

A selection predicate evaluated for each candidate. Combine comparisons with and, or and not. Only pure expressions are allowed; it cannot perform actions, consume messages or update history.

```lisp
(where true)
```

### candidate

No inputs → Cell.

The cell or corpse currently being considered inside a where filter. Outside a filter it is not a valid expression.

```lisp
(link (nearby 60 (where (kin (candidate)))))
```

### nearby

Number, Filter → Cell.

Select the nearest matching cell or corpse within the requested radius. Returns none if absent. Queries obey the world sensing radius and scan budget; crowded neighborhoods may be sampled incompletely.

```lisp
(nearby 0.5 (where (alive (candidate))))
```

### centroid-bearing

Number, Filter → Number.

Relative direction toward the centroid of matching neighbors. Returns zero if none, or if their centroid coincides with you.

```lisp
(centroid-bearing 0.5 (where (alive (candidate))))
```

### centroid-distance

Number, Filter → Number.

Distance to the centroid of matching neighbors; zero without matches.

```lisp
(centroid-distance 0.5 (where (alive (candidate))))
```

### neighbor-count

Number, Filter → Number.

Number of matching neighbors found within the radius and scan budget.

```lisp
(neighbor-count 0.5 (where (alive (candidate))))
```

### alignment

Number, Filter → Number.

Relative direction of the average heading of matching living neighbors. Turns toward their travel orientation; does not reveal an absolute heading.

```lisp
(alignment 0.5 (where (alive (candidate))))
```

### separation-bearing

Number, Filter → Number.

Relative direction away from matching neighbors, weighting closer neighbors more strongly.

```lisp
(separation-bearing 0.5 (where (alive (candidate))))
```

### separation-strength

Number, Filter → Number.

Strength of the local separation vector, weighting closer neighbors more strongly.

```lisp
(separation-strength 0.5 (where (alive (candidate))))
```

### linked-mean-where

Channel, Filter → Number.

Average the selected channel of direct linked neighbors that satisfy the filter. Optional broadcast relay applies before selection. Zero if none.

```lisp
(linked-mean-where c0 (where (alive (candidate))))
```

### linked-sum-where

Channel, Filter → Number.

Sum the selected channel of matching direct linked neighbors. Optional broadcast relay applies before selection.

```lisp
(linked-sum-where c0 (where (alive (candidate))))
```

### listen-where

Number, Channel, Filter → Number.

Average the selected channel of nearby matching living cells in the requested radius. Does not consume broadcasts.

```lisp
(listen-where 0.5 c0 (where (alive (candidate))))
```

### send-where

Channel, Number, Filter → Action.

Send a direct mailbox message on c0–c3 to each matching direct link. Uses the configured message cost. A mailbox retains the latest delivered message.

```lisp
(send-where c0 0.5 (where (alive (candidate))))
```

### receive-where

Channel, Filter → Number.

Consume the latest message on a channel only when its sender still matches the filter; otherwise return zero and leave it unread.

```lisp
(receive-where c0 (where (alive (candidate))))
```

### child-set

Memory, Number → Action.

Set a memory slot on the next successfully born daughter, leaving the parent unchanged. A failed division keeps the pending modifier. A later child-set for the same slot replaces it.

```lisp
(seq (child-set m0 (* (memory m0) 0.5)) (bud))
```

### child-turn

Number → Action.

Set the next daughter’s heading offset relative to the parent, in degrees, in addition to configured random jitter. Does not rotate the parent. Consumed only by successful division.

```lisp
(seq (child-turn 30) (bud))
```

### colony-size

No inputs → Number.

Number of living cells in your entire connected component, including yourself. A solitary cell reads 1; this follows the whole body, not just direct links.

```lisp
(colony-size)
```

### sin

Number → Number.

Sine of an angle in radians. Pure numeric function; combine with time and a phase offset for oscillation.

```lisp
(sin (+ (time) 0.5))
```

### cos

Number → Number.

Cosine of an angle in radians. Pure numeric function; combine with time and a phase offset for oscillation.

```lisp
(cos (* (time) 2))
```

### time

No inputs → Number.

Simulation time in seconds, shared by every cell. Multiply by angular frequency, then add a phase offset, before applying sin or cos.

```lisp
(time)
```

### resist

Number → Action.

Set persistent anchoring from 0 to 1; 0 releases it. Strong drag braces against the environment so contraction can pull linked neighbors. Costs energy per second and switches off if upkeep is unaffordable. The daughter inherits the brace level.

```lisp
(seq (resist 0.8) (contract 0.3))
```
