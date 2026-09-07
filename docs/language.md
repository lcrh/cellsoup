# Cell Assembly v0.1

A genome is a list of 1–256 instructions. A living cell owns eight registers (`r0`–`r7`), an instruction pointer, a sleep counter, energy, heading, tag, shield, four signal values, and up to six reciprocal spring bonds. Initial registers are zero. A seed begins with 70 stored energy, no bonds, and a random heading.

## Syntax and machine

Instructions and names are case-insensitive. Separate arguments with spaces or commas. A label such as `grow:` names an instruction. `;` begins a comment. Operands are registers or decimal numbers (including scientific notation) in ±999999; branch destinations must be valid labels. There is no stack, arbitrary memory access, I/O, or dynamic code execution outside the cell VM.

Arithmetic is float32. Registers are bounded to ±999999 after each non-yielding instruction; non-finite results are sanitized. Division or remainder by zero produces 0. Branch comparisons are exact float comparisons. Angles are clockwise degrees, with 0 pointing right. Public tags are integers, clamped to 0–255.

Physics advances at 60 ticks per simulated second. Every cell executes at most the configured 1–128 instructions per tick (default 24), retaining its PC when the budget expires. Passing the end wraps to the beginning. `wait n` ends the current execution slice and sleeps for **n additional ticks** (integer, clamped 0–36000). `wait 0` yields until next tick. All instructions cost 0.0005 energy, in addition to action-specific costs and upkeep.

A cell does not execute when it has no energy. It dies if still depleted after bond diffusion, and every incident bond is removed. IDs are stable and never reused within a reset. IDs refer to individuals, not array positions; 0 means no target.

## Forking

```asm
  bud r0
  jeq r0 1 daughter
  jeq r0 -1 failed
  ; original continues here
```

Both `split rD` and `bud rD` require at least 32 stored energy and a free population slot. `bud` additionally requires a free bond on the parent. A successful fork consumes 12 energy, then divides the remainder equally. The parent receives 0 and the daughter 1 in `rD`; every other register is copied. The daughter inherits the genome, next PC, public tag, color, shield, and ancestry. The parent keeps its current bonds. The daughter receives only the new parent bond for `bud`, and no bonds for `split`.

The daughter is placed nine units along the parent's heading and faces the opposite way. Its age, velocities, signals, and rest-length multiplier start fresh. Both executions yield on the fork. The daughter skips its first eligible tick, then continues after the fork; the parent can continue the next tick. This makes the fork boundary explicit and prevents recursive same-tick population explosions.

On failure no daughter or bond is created, `rD` becomes -1, no division energy is spent, and the instruction still yields. Its ordinary instruction cost is charged. The effective required starting energy includes that instruction cost and any earlier actions/upkeep during the tick.

## Physical actions and targeting

All neighbor distances use shortest paths across the wrapping world. `scan rD tag cone` returns the nearest matching cell ID within 60 units. A tag of -1 means any tag. Cone is the full angle around the cell's heading: 360 is omnidirectional, 90 is ±45 degrees. Self is excluded. There is no global cell lookup instruction; targets must remain in local range.

`peek rD id field` reads the specified neighbor within 60 units. Fields are `energy`, `tag`, `distance`, `bearing`, `kin`, `shield`, and `bonds`. Bearing is relative to the caller's heading, in [-180,180). `kin` is 1 for the same inherited genome identity, 0 otherwise. Separately seeded copies are distinct identities; a code mutation also creates a new genome identity. Public tags are a programmable alternative. Missing targets and ID 0 return 0.

`link id` creates a reciprocal spring only within 24 units, only when both endpoints have a free bond, and only when not already linked. Success costs 0.5. `unlink id` cuts that bond; `unlink 0` cuts all of the caller's bonds. Links longer than 65 units break mechanically.

`contract ratio` sets the caller's contribution to spring rest length, clamped 0.55–1.5, and costs 0.08. A bond's target length is 12 times the mean of the two endpoint ratios. `contract 1` restores the nominal contribution; a setting persists until changed. Cells have radius 4, use soft repulsive contact forces, have unit inertial mass, and experience damping.

`move strength` applies propulsion along heading, clamped to [-1,1], and costs 0.04 times absolute strength. `turn degrees` changes heading; ordinary instruction cost applies. All paid actions are skipped when the caller cannot afford the action cost. Any negative requested transfer amount is clamped to zero.

## Adversarial and cooperative actions

`steal id amount` explicitly targets a neighbor within 18 units. It costs 0.08 to attempt a transfer against an in-range target, takes at most 3 energy per instruction, and multiplies the requested amount by `1 - 0.9 × target.shield`. Transfer is capped by the victim's available energy and the thief's storage space. The thief retains 75% of what leaves the victim; 25% dissipates. With a full shield, only 10% of the requested theft penetrates. Out-of-range and missing targets cause no action charge.

`shield fraction` sets defense to [0,1]. Shield upkeep is 0.012 × fraction per tick. It is inherited at division, so defense competes with reproduction and propulsion for the same budget. `give id amount` transfers at most 10 energy within 18 units, capped by the donor's available energy and the receiver's room. This is conservative and cannot create energy. Transfers to ID 0 do nothing.

Tags are public and forgeable: predators can scan for prey tag 2, inspect a target, refuse kin, or select defended versus undefended prey in code. Link formation is unilateral; a parasite can attach and draw energy through passive sharing. A defender can inspect strangers, unlink, move away, change tags, signal, or shield itself against active theft. Shields do **not** block passive sharing across an existing bond.

## Energy and environment

The world is 1600 × 1000 units with periodic boundaries. Food occupies a 128 × 80 scalar grid. Initial food is seeded in patches; subsequent blobs arrive every 30 ticks, with strength controlled by food arrival. Every fourth tick, a conservative four-neighbor diffusion stencil redistributes food, followed by 0.05% decay. Blob deposits are locally capped at 80; manual food painting is an explicit external input.

Cells automatically take up to 0.16 food energy per tick from their occupied tile, capped by the tile's food and their storage capacity of 200. Basal metabolism is 0.004 per tick, plus shield upkeep and instruction/action costs. Each bond equalizes 1.2% of the endpoint energy difference per tick. Exchanges are pairwise conservative, with nonnegative availability bounds. Division consumes 12 energy: eight can be interpreted as embodied daughter structure and four as dissipative overhead. Death returns four embodied energy plus half of any remaining positive stored energy to food. Seeded cells and manually added food are external energy inputs.

Sampling and updates use stable arrays, with a rotating VM start index to reduce persistent first-cell advantage. Local actions are sequential rather than simultaneous; food uptake and diffusion can retain ordering effects. These are explicit model choices, not a numerically exact fluid or biophysical cell model.

## Communication and senses

`sense rD sensor` supports `energy`, `food` (current tile), `age` (seconds), `bonds`, `heading` (degrees), `id`, `generation`, `tag`, `ahead`, `left`, `right`. Directional food sensors sample 25 units ahead, or ±45 degrees.

`emit channel value` sets one of four channels (0–3), costs 0.01, and clamps value to ±100. Each stored signal decays by 3% per tick. `listen rD channel` sums other cells' signals within 60 units with weight `1-distance/60`. Signals are a cell-emitted local field, not stored environmental chemicals. `color degrees` sets an inherited display hue and has no ecological effect.

## Autonomous evolution and mutation

**Division mutation defaults to 0%. Resampled-arrival mutation defaults to 80%.** These are independent probabilities in World. An ordinary daughter inherits the parent's bytecode exactly unless the division slider is raised. An arrival sampled from the archive independently has the configured chance of one code edit. Fresh random arrivals get entirely newly sampled programs, not mutations of authored templates.

The default world starts with 512 random cells, each with its own program. Program length is uniform from 8 to 64; opcodes are uniform across all 35 instructions. Arguments are sampled by type: eight registers, valid local branch addresses, sensor/field enums, and value operands (25% registers, otherwise a uniform choice from -1, 0, 1, 2, 3, 5, 10, 25, 60, 90, 120, 0.25, 0.5). This deliberately specifies a finite sampling distribution; “random” does not mean uniform over all float32 values.

At the end of every 60th tick, the engine archives successes and then adds at most 64 cells if the live population is below `min(arrival threshold, population limit)`. The default threshold is 2,048. Each arrival independently has a 50% chance of sampling the archive; otherwise it gets a fresh random genome. If the archive is empty, all arrivals are random. Set archive share to 0% for random-only arrivals, 100% for archive-only when available, or the arrival threshold to 0 to disable replenishment. Above the threshold no arrivals occur, so with division mutation at zero, existing genomes remain unchanged until resampling resumes. Existing cells are never culled to make space.

A variant qualifies for the archive once it has produced at least three direct offspring, has existed for ten simulated seconds, and still has living members. Manual seeds and spontaneous arrivals do not count as offspring. Up to 128 complete bytecode copies are retained independently of the live genome pool. Each qualifying variant enters a reservoir once: after the first 128, the nth qualifying variant replaces a uniformly chosen entry with probability 128/n. Sampling the archive is uniform, so a prolific lineage does not receive extra weight for every division. The archive survives extinction and slot reuse, but resets with the dish and is not persisted across page reloads. This rule selects reproductive persistence, and does not claim intelligence or open-ended progress.

Reintroduced genomes get a new stable variant identity, their archived source's identity as parent, the same founder identity and mutation depth (incremented on mutation), and fresh offspring/age counters. Even unmutated reintroductions are separate variants and must qualify on their own. Arrivals begin at PC 0 with zero registers, no bonds or shield, random position/heading and 70 energy. They reintroduce genomes, not saved multicellular bodies. That energy is an explicit external input, separate from food arrivals. Ordinary divisions conserve the remaining parental energy after their division cost. Inspecting ancestry never consumes RNG state.

A mutated daughter receives a new variant identity with the same founder, incremented mutation depth and its parent's variant identity. The parent retains its genome. Evolution statistics separately report random arrivals, resampled arrivals, resampling mutations and division mutations.
For a selected division or resampled arrival, a free genome slot receives a copy, then one mutation is chosen:

- **60% operand change.** Change a register reference, sensor, field, branch destination, or immediate number. Numeric perturbations usually scale to the old value (at least ±1, otherwise ±20%). Register and symbolic operands remain valid for their argument types.
- **20% instruction replacement.** Replace one instruction with a different, well-typed opcode and valid arguments. Any of the 35 opcodes may appear.
- **10% insertion.** Insert a new well-typed instruction, shifting existing jump targets and the daughter's PC to preserve references to existing instructions.
- **10% deletion.** Remove one instruction, adjusting the PC and jump targets; a jump to the deleted instruction follows its successor, or the last remaining instruction at the end.

Insertion at 256 instructions or deletion at one instruction falls back to replacement. A chosen operand mutation on `nop` also becomes replacement. Generated branches remain within the genome and destinations remain registers. Every evolved program still obeys the per-tick budget and memory limits. Some changes are neutral, including changing a jump in a one-instruction genome where no alternative target exists. Code that loses reproduction or useful behavior is allowed; automatic validation protects the simulator, not the organism's fitness.

The genome pool holds 2,048 simultaneously retained variants. Extinct slots can be reused; stable variant identities are separate from these storage slots. If the pool is full, divisions still occur but their mutation is skipped; spontaneous arrivals wait for an available genome slot. The Evolution panel shows the 16 largest living variants, their direct offspring counts (including mutated daughters), instruction length, and mutation depth. Selecting one reveals a live representative's executable source for export. Ancestry color groups founder lineages and shades mutation depth; the ordinary genome hue remains under program control.

Ordinary gameplay begins with designed branching colonies, food-seeking grazers, and selective predators. This demonstrates heritable code evolution under ecological selection. It does not assume abiogenesis from random code or guarantee ever-increasing complexity. Recombination, evolving cell sizes, consent-based adhesion, and persistent environmental chemical channels remain possible extensions.

## Complete instruction reference

In the table, `r` means a destination register, `v` a number or register, `l` a label, `s` a sensor, and `p` a target field.

| Instruction | Meaning |
| --- | --- |
| `nop ` | Do nothing. |
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
| `sense r s` | Read a sensor: energy, food, age, bonds, heading, id, generation, tag, ahead, left, right. |
| `scan r v v` | Nearest target within 60 units: tag (-1 = any), cone (360 = all directions). Returns ID or 0. |
| `peek r v p` | Read target ID: energy, tag, distance, bearing, kin, shield, bonds. Missing target returns 0. |
| `split r` | Detached division: 0 parent, 1 child, -1 failure. Costs 12; requires 32 energy. |
| `bud r` | Connected division. Same return values and energy rules as split. |
| `turn v` | Rotate clockwise by degrees. |
| `move v` | Propel along heading, strength -1…1. Costs 0.04 × \|strength\|. |
| `link v` | Bond to target ID within 24 units. Costs 0.5 on success; six bonds maximum. |
| `unlink v` | Cut bond to target ID; 0 cuts all bonds. |
| `contract v` | Set own spring rest-length multiplier (0.55…1.5). Costs 0.08. |
| `steal v v` | Take up to amount (max 3) energy from target within 18. Costs 0.08; 75% efficient; shields resist. |
| `give v v` | Transfer up to amount (max 10) energy to target within 18. |
| `tag v` | Set a public tag, 0…255. Tags can be imitated. |
| `shield v` | Set protection 0…1; upkeep 0.012 × shield per tick. |
| `color v` | Set display hue in degrees; inherited at division. |
| `emit v v` | Set signal channel 0…3 to value -100…100. Costs 0.01; decays each tick. |
| `listen r v` | Sum nearby signals on channel, weighted by distance within 60. |
| `abs r v` | Absolute value. |
| `min r v` | Clamp register down to value. |
| `max r v` | Clamp register up to value. |
