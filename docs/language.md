# Cell Assembly v0.5

A genome is a list of 1–256 instructions. A living cell owns eight registers (`r0`–`r7`), an instruction pointer, a sleep counter, energy, heading, tag, shield, four ambient signal values, four linked-message inboxes, and up to six reciprocal spring bonds. Initial registers are zero. A seed begins with 70 stored energy, no bonds, and a random heading.

## Syntax and machine

Instructions and names are case-insensitive. Separate arguments with spaces or commas. A label such as `grow:` names an instruction. `;` begins a comment. Operands are registers or decimal numbers (including scientific notation) in ±999999; branch destinations must be valid labels. There is no stack, arbitrary memory access, I/O, or dynamic code execution outside the cell VM.

Arithmetic is float32. Registers are bounded to ±999999 after each non-yielding instruction; non-finite results are sanitized. Division or remainder by zero produces 0. Branch comparisons are exact float comparisons. Relative angles are clockwise degrees: 0 means straight ahead, positive turns right, negative turns left. The VM cannot read world coordinates or absolute heading. Public tags are integers, clamped to 0–255.

Physics advances at 60 ticks per simulated second. Every cell executes at most the configured 1–128 instructions per tick (default 24), retaining its PC when the budget expires. Passing the end wraps to the beginning. `wait n` ends the current execution slice and sleeps for **n additional ticks** (integer, clamped 0–36000). `wait 0` yields until next tick. Every executed instruction pays its configurable cost (default 0.0005 energy), in addition to action costs and baseline upkeep. Sleeping still pays baseline upkeep. If the instruction fee cannot be paid while retaining 0.001 energy, its effects are skipped and the PC advances. Voluntary action charges also retain this reserve; an unaffordable action is a no-op (its affordable instruction fee is still charged). Baseline upkeep and attacks can still kill a cell.

A cell does not execute when it has no energy. It dies if still depleted after bond diffusion, and every incident bond is removed. IDs are stable and never reused within a reset. IDs refer to individuals, not array positions; 0 means no target.

## Forking

```asm
  bud r0
  jeq r0 1 daughter
  jeq r0 -1 failed
  ; original continues here
```

Both `split rD` and `bud rD` require at least `division cost + 20` stored energy (32 by default) and a free population slot. `bud` additionally requires a free bond on the parent. A successful fork consumes its configured cost (12 by default), then divides the remainder equally. The parent receives 0 and the daughter 1 in `rD`; every other register is copied. The daughter inherits the genome, next PC, public tag, color, shield, and ancestry. The parent keeps its current bonds. The daughter receives only the new parent bond for `bud`, and no bonds for `split`.

The daughter is placed 14 units forward and inherits the parent's heading with a uniform random offset, default ±12°. World controls this separately from code mutation; 0° copies heading exactly. Its age, linear/angular velocities, signals, message inboxes, and rest-length multiplier start fresh. Both executions yield on the fork. The daughter skips its first eligible tick, then continues after the fork; the parent can continue the next tick. This makes the fork boundary explicit and prevents recursive same-tick population explosions.

On failure no daughter or bond is created, `rD` becomes -1, no division energy is spent, and the instruction still yields. Its ordinary instruction cost is charged. The effective required starting energy includes that instruction cost and any earlier actions/upkeep during the tick.

## Physical actions and targeting

All neighbor distances use shortest paths across the wrapping world. `scan rD tag cone` returns the nearest matching cell ID within 60 units. A tag of -1 means any tag. Cone is the full angle around the cell's heading: 360 is omnidirectional, 90 is ±45 degrees. Self is excluded. There is no global cell lookup instruction; targets must remain in local range.

`peek rD id field` reads the specified neighbor within 60 units. Fields are `energy`, `tag`, `distance`, `bearing`, `kin`, `shield`, `bonds`, and `color` (biological hue in degrees). Bearing is relative to the caller's heading, in [-180,180). `kin` is 1 for the same inherited genome identity, 0 otherwise. Separately seeded copies are distinct identities; a code mutation also creates a new genome identity. Public tags are a programmable alternative. Missing targets and ID 0 return 0.

`link id` creates a reciprocal spring only within 24 units, only when both endpoints have a free bond, and only when not already linked. Success costs 0.5 by default. `unlink id` cuts that bond; `unlink 0` cuts all of the caller's bonds. Links longer than 65 units break mechanically.

`contract ratio` sets the caller's contribution to spring length, clamped 0.55–1.5, at a configurable default cost of 0.08. Nominal center spacing is 18 times the mean endpoint ratio; `contract 1` restores the nominal contribution. Spring attachment points sit three units from each cell's center and rotate with its body. The spring's endpoint rest length is `max(0.5, 18 × mean ratio − 6)`, so straight aligned links have 18-unit center spacing by default. Rendered links join those actual attachment points.

Cells have radius 4 and unit inertial mass. Soft repulsion begins below ten units of center separation, adding a little clearance between cells. Springs apply equal/opposite linear forces and torque at both endpoints; their passive angular velocity is damped and capped at two turns/second. With moment of inertia 8, attached cells can rotate and tug each other. Physics is intentionally soft and bounded, not a rigid-body constraint solver.

`move strength` applies forward (+) or backward (−) propulsion along the cell's facing, clamped to [-1,1]. Default action cost is `0.04 × abs(strength)`. `turn degrees` rotates relative to its current facing, clamped to ±360° per call, at a default cost of `0.001 × abs(degrees)`. Rotating its attachment points distorts springs and pulls connected cells during physics. Movement does not expose global x/y controls. All paid actions are skipped when the caller cannot afford their action cost. Negative requested transfers clamp to zero.

## Adversarial and cooperative actions

`steal id amount` explicitly targets a neighbor within 18 units. Its default cost is 0.08 to attempt a transfer against an in-range target, takes at most 3 energy per instruction, and multiplies the requested amount by `1 - 0.9 × target.shield`. Transfer is capped by the victim's available energy and the thief's storage space. The thief retains 75% of what leaves the victim; 25% dissipates. With a full shield, only 10% of the requested theft penetrates. Out-of-range and missing targets cause no action charge.

`shield fraction` sets defense to [0,1]. Full-shield upkeep defaults to 0.72 energy per simulated second, scaled by fraction; this cost is configurable. A shield switches off if its upkeep would exhaust the cell; activation is skipped if one tick of shield upkeep is unaffordable. It is inherited at division, so defense competes with reproduction and propulsion for the same budget. `give id fraction` transfers a fraction of the donor's current energy within 18 units. The fraction is clamped to [0,1], with no fixed transfer cap: `give r0 0.25` donates 25%. Transfers are capped by the receiver's room (200 energy maximum), and the donor always retains at least 0.001 energy, even for a fraction of 1. This is conservative and cannot create energy. Transfers to ID 0 do nothing.

Tags are public and forgeable: predators can scan for prey tag 2, inspect a target, refuse kin, or select defended versus undefended prey in code. Link formation is unilateral; a parasite can attach and draw energy through passive sharing. A defender can inspect strangers, unlink, move away, change tags, signal, or shield itself against active theft. Shields do **not** block passive sharing across an existing bond.

## Energy and environment

The world is 1600 × 1000 units with periodic boundaries. Food occupies a 128 × 80 scalar grid. Initial food is seeded in patches. Ongoing drops arrive every half simulated second from a wandering source, with correlated changes to location and amount. Every fourth tick, a conservative four-neighbor diffusion stencil redistributes food, followed by 0.05% decay. Deposits are locally capped at 80.

The food source uses independent Ornstein–Uhlenbeck states for x offset, y offset, and amount fluctuation. At each drop, `z_next = a × z + s × sqrt(1 − a²) × Normal(0,1)`, with `a = exp(−0.5 / memory)`. Default memory is 20 seconds. Positional stationary deviations are 22% of world width/height around a randomly placed anchor, wrapped at world boundaries. Amount deviation is 40%; emitted strength is `8 × food arrival × clamp(1 + amount state, 0, 3)`. The underlying state remains unclipped. These controls can be set to zero independently. Weather uses its own seeded random stream and advances even with food arrival set to zero. The transition law follows [Särkkä & Solin, Applied Stochastic Differential Equations, Example 6.2](https://users.aalto.fi/~asolin/sde-book/sde-book.pdf), evaluated with float32 arithmetic.

Cells absorb up to 0.16 food energy per tick from their occupied tile, limited by available food and capacity 200. Baseline upkeep defaults to **2 energy per simulated second**, even while sleeping (previously 0.24). A waiting cell with 70 energy lasts about 35 seconds without food; food absorption can still sustain it. Each bond equalizes 1.2% of the endpoint energy difference per tick conservatively. Death returns four energy plus half any remaining positive stored energy to food. Arrivals, manual seeds, and food deposits are explicit external inputs.

All costs are adjustable in World and apply immediately:

| Cost | Default energy | Unit |
| --- | ---: | --- |
| Baseline upkeep | 2 | Per cell per simulated second, including sleep |
| Instruction | 0.0005 | Per executed instruction |
| Division | 12 | Per successful split/bud |
| Movement | 0.04 | Per full-strength call; scales with absolute strength |
| Link | 0.5 | Per successful new bond |
| Contract | 0.08 | Per affordable call |
| Steal | 0.08 | Per attempt against an in-range target |
| Ambient emission | 0.01 | Per emission |
| Full shield | 0.72 | Per second, scaled by shield fraction |
| Rotation | 0.001 | Per absolute degree requested, clamped to 360° |
| Linked send | 0.01 | Per recipient |

Action costs are additional to instruction cost. Setting costs to zero is supported. Changing division cost also changes its eligibility threshold to `cost + 20`; both cells share the remaining energy equally.

Sampling and updates use stable arrays, with a rotating VM start index to reduce persistent first-cell advantage. Local actions are sequential rather than simultaneous; food uptake and diffusion can retain ordering effects. These are explicit model choices, not a numerically exact fluid or biophysical cell model.

## Communication and senses

`sense rD sensor` supports `energy`, `food` (current tile), `age` (seconds), `bonds`, `rotation` (passive angular velocity in degrees/second), `id`, `generation`, `tag`, `ahead`, `left`, `right`, and `color` (own biological hue). Directional food sensors sample 25 units ahead, or ±45°. **There is no absolute heading sensor.** Sensor slot 4 is now `rotation`; source using `sense ... heading` is rejected.

`gradient rBearing rStrength` estimates the food gradient from samples 25 units forward, backward, right, and left. It returns a relative bearing in [-180,180) and gradient strength (central difference divided by 50 world units). A flat field returns zeros. `turn rBearing` then `move 0.5` steers toward food without a compass. Use distinct output registers; if aliased, the strength write is last.

`scan_color rD hue tolerance` returns the nearest matching cell within 60 units, or 0. Hue wraps to [0,360); tolerance clamps to [0,180]. Distance around the hue wheel is circular, so 359° matches a 1° target with 3° tolerance. `peek ... color` reads the target's hue. `color degrees` sets an inherited, public biological hue. Energy/ancestry visualization modes do not change what cells sense; colors are forgeable like tags.

Ambient communication remains available: `emit channel value` publishes one of four channels (0–3), clamps to ±100 and costs 0.01 by default. Signals decay 3% per tick. `listen rD channel` sums signals from other cells within 60 units with weight `1 − distance/60`. These signals are carried by cells, not stored as environmental chemicals.

Linked communication is separate and travels only along actual bonds:

- `bond rD index` returns the neighbor ID in slot 0–5, or 0 for an empty/out-of-range slot. New bonds take the first free slot; removal leaves holes, so enumerate all six slots.
- `send target channel value` targets one directly linked cell by ID, or broadcasts with target 0. Channel clamps to 0–3 and value to ±100. The default cost is 0.01 per affordable recipient, plus instruction cost. Nearby unlinked cells receive nothing.
- `receive rValue rSender channel` reads and clears that inbox, returning both payload and sender ID. An empty inbox returns (0,0); a real zero-valued message retains its nonzero sender. Use distinct output registers; sender is written last if they alias.

Messages sent in one tick become visible at the start of the next tick, independent of VM execution order. Each channel is a one-message mailbox: the last send in the rotating VM order wins, and a new delivery overwrites an unread message. Messages already sent remain deliverable if the link subsequently detaches; dead cells discard their inboxes. Newborns start with empty mailboxes. This is bounded message passing, not an unbounded queue.

Registers persist between ticks, allowing held input values, weighted sums, routing by sender, gates and recurrent circuits. For example, the optional **Linked ReLU relay** consumes channel 0 and publishes `max(0, 0.75 × input − 0.2)` on channel 1:

```asm
loop:
  receive r0 r1 0
  jz r1 rest
  mul r0 0.75
  add r0 -0.2
  max r0 0
  send 0 1 r0
rest:
  wait 0
  jmp loop
```

For multiple inputs, use separate channels and keep their values in registers; multiply each by its weight, sum, add bias and apply `max`. This example needs linked senders and receivers. It is an optional template, never inserted into the default random dish.

## Autonomous evolution and mutation

**Division mutation defaults to 0%. Resampled-arrival mutation defaults to 80%.** These are independent probabilities in World. An ordinary daughter inherits the parent's bytecode exactly unless the division slider is raised. An arrival sampled from the archive independently has the configured chance of one code edit. Fresh random arrivals get entirely newly sampled programs, not mutations of authored templates.

The default world starts with 512 random cells, each with its own program. Program length is uniform from 8 to 64; opcodes are uniform across all 40 instructions. Arguments are sampled by type: eight registers, valid local branch addresses, sensor/field enums, and value operands (25% registers, otherwise a uniform choice from -1, 0, 1, 2, 3, 5, 10, 25, 60, 90, 120, 0.25, 0.5). This deliberately specifies a finite sampling distribution; “random” does not mean uniform over all float32 values.

At the end of every 60th tick, the engine archives successes and adds a steady trickle of **8 cells per simulated second by default**, plus up to 64 extra cells when below `min(replenishment threshold, population limit)`. The default threshold is 2,048. Steady arrivals continue above the threshold. Both kinds stop at the hard population or genome-storage limit; existing cells are never culled to make room. There is no backlog. The steady rate and low-population threshold are independent controls; set both to zero to disable arrivals.

Each arrival independently has a default 50% chance of sampling the archive; otherwise it gets a fresh random genome. An empty archive falls back to random. Archive share 0% gives random-only arrivals; 100% gives archive-only when available. Both steady and replenishment arrivals use the same mixture and independent resampling mutation rate.
A variant qualifies for the archive once it has produced at least three direct offspring, has existed for ten simulated seconds, and still has living members. Manual seeds and spontaneous arrivals do not count as offspring. Up to 128 complete bytecode copies are retained independently of the live genome pool. Each qualifying variant enters a reservoir once: after the first 128, the nth qualifying variant replaces a uniformly chosen entry with probability 128/n. Sampling the archive is uniform, so a prolific lineage does not receive extra weight for every division. The archive survives extinction and slot reuse, but resets with the dish and is not persisted across page reloads. This rule selects reproductive persistence, and does not claim intelligence or open-ended progress.

Reintroduced genomes get a new stable variant identity, their archived source's identity as parent, the same founder identity and mutation depth (incremented on mutation), and fresh offspring/age counters. Even unmutated reintroductions are separate variants and must qualify on their own. Arrivals begin at PC 0 with zero registers, no bonds or shield, random position/heading and 70 energy. They reintroduce genomes, not saved multicellular bodies. That energy is an explicit external input, separate from food arrivals. Ordinary divisions conserve the remaining parental energy after their division cost. Inspecting ancestry never consumes RNG state.

A mutated daughter receives a new variant identity with the same founder, incremented mutation depth and its parent's variant identity. The parent retains its genome. Evolution statistics separately report random arrivals, resampled arrivals, resampling mutations and division mutations.
For a selected division or resampled arrival, a free genome slot receives a copy, then one mutation is chosen:

- **60% operand change.** Change a register reference, sensor, field, branch destination, or immediate number. Numeric perturbations usually scale to the old value (at least ±1, otherwise ±20%). Register and symbolic operands remain valid for their argument types.
- **20% instruction replacement.** Replace one instruction with a different, well-typed opcode and valid arguments. Any of the 40 opcodes may appear.
- **10% insertion.** Insert a new well-typed instruction, shifting existing jump targets and the daughter's PC to preserve references to existing instructions.
- **10% deletion.** Remove one instruction, adjusting the PC and jump targets; a jump to the deleted instruction follows its successor, or the last remaining instruction at the end.

Insertion at 256 instructions or deletion at one instruction falls back to replacement. A chosen operand mutation on `nop` also becomes replacement. Generated branches remain within the genome and destinations remain registers. Every evolved program still obeys the per-tick budget and memory limits. Some changes are neutral, including changing a jump in a one-instruction genome where no alternative target exists. Code that loses reproduction or useful behavior is allowed; automatic validation protects the simulator, not the organism's fitness.

The genome pool holds 2,048 simultaneously retained variants. Extinct slots can be reused; stable variant identities are separate from these storage slots. If the pool is full, divisions still occur but their mutation is skipped; spontaneous arrivals wait for an available genome slot. The Evolution panel shows the 16 largest living variants, their direct offspring counts (including mutated daughters), instruction length, and mutation depth. Selecting one reveals a live representative's executable source for export. Ancestry color groups founder lineages and shades mutation depth; the ordinary genome hue remains under program control.

Ordinary gameplay begins with designed branching colonies, food-seeking grazers, and selective predators. This demonstrates heritable code evolution under ecological selection. It does not assume abiogenesis from random code or guarantee ever-increasing complexity. Recombination, evolving cell sizes, consent-based adhesion, and persistent environmental chemical channels remain possible extensions.

## Complete instruction reference

`r` denotes a destination register, `v` a register or value, `l` a label, `s` a sensor, and `p` a peek field. Listed costs are defaults; World controls override them.

| Instruction | Meaning |
| --- | --- |
| `nop` | Do nothing. |
| `mov r v` | Copy a value into a register. |
| `add r v` | Add to a register. |
| `sub r v` | Subtract from a register. |
| `mul r v` | Multiply a register. |
| `div r v` | Divide; division by zero returns 0. |
| `mod r v` | Remainder; zero divisor returns 0. |
| `rand r v` | Uniform random value in [0, value). |
| `jmp l` | Jump to a label. |
| `jz v l` | Jump if zero. |
| `jnz v l` | Jump if nonzero. |
| `jgt v v l` | Jump if first > second. |
| `jlt v v l` | Jump if first < second. |
| `jeq v v l` | Jump if equal. |
| `wait v` | Yield now, then sleep this many additional ticks. |
| `sense r s` | Read a sensor: energy, food, age, bonds, rotation, id, generation, tag, ahead, left, right, color. |
| `scan r v v` | Nearest target within 60 units: tag (-1 = any), cone (360 = all directions). Returns ID or 0. |
| `peek r v p` | Read target ID: energy, tag, distance, bearing, kin, shield, bonds, color. Missing target returns 0. |
| `split r` | Detached division: 0 parent, 1 child, -1 failure. Default cost 12; requires division cost + 20 energy. |
| `bud r` | Connected division. Same return values and energy rules as split. |
| `turn v` | Rotate by signed degrees (positive clockwise). Rotating spring anchors tug linked cells. Default cost 0.001 × \|degrees\|. |
| `move v` | Forward (+) or backward (−) thrust along heading, strength -1…1. Pulls linked cells through springs. Default cost 0.04 × \|strength\|. |
| `link v` | Bond to target ID within 24 units. Default cost 0.5 on success; six bonds maximum. |
| `unlink v` | Cut bond to target ID; 0 cuts all bonds. |
| `contract v` | Set own spring rest-length multiplier (0.55…1.5). Default cost 0.08. |
| `steal v v` | Take up to amount (max 3) energy from target within 18. Default cost 0.08; 75% efficient; shields resist. |
| `give v v` | Give a fraction (0…1) of current energy to target within 18, retaining 0.001 energy. Receiver capacity is 200. |
| `tag v` | Set a public tag, 0…255. Tags can be imitated. |
| `shield v` | Set protection 0…1; default upkeep 0.72 × shield per second. Switches off when unaffordable. |
| `color v` | Set biological hue in degrees; inherited and visible to color sensors. |
| `emit v v` | Set signal channel 0…3 to value -100…100. Default cost 0.01; decays each tick. |
| `listen r v` | Sum nearby signals on channel, weighted by distance within 60. |
| `abs r v` | Absolute value. |
| `min r v` | Clamp register down to value. |
| `max r v` | Clamp register up to value. |
| `gradient r r` | Food gradient: relative bearing in first register (degrees), strength in second. Zero if flat. |
| `scan_color r v v` | Nearest cell within 60 matching hue ± tolerance (degrees). Circular hue matching; returns ID or 0. |
| `bond r v` | Read linked neighbor ID in slot 0–5, or 0 if empty. |
| `send v v v` | Send target ID (0 = all links), channel 0–3, value. Delivered next tick. Default cost 0.01 per recipient. |
| `receive r r v` | Read and clear a linked-message channel: value in first register, sender ID in second (0 = empty). |
