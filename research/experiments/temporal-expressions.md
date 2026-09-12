# Temporal expressions as an evolutionary building block

This separate experiment starts from `2d5a0ec` and retains the original compiler
cadence. It does not include the implicit-wait experiment. Production is unchanged.

The completed point-mutation worlds contain 3,384 surviving genotypes, of which
338 mention a memory read. Only 79 have any read and write addressing the same
slot. Four contain a direct syntactic self-dependency in a repeated write: three
copy the slot back unchanged, and the fourth applies `random` to a slot that an
earlier local binding sets from the invalid target `(none)`. These are not strong
examples of useful recurrence. This static audit does not exclude indirect
history, initialization effects, physical memory or intercellular computation;
it demonstrates why counting memory syntax inflates the evidence.

The experiment adds three generic numeric expressions, not behavior templates:

| Expression | Result and update on each evaluation |
| --- | --- |
| `(lag x)` | Return this occurrence's previous input, then remember the current input. |
| `(delta x)` | Return current input minus previous input, then remember the current input. |
| `(smooth a x)` | Clamp `a` to 0–1; update and return `previous + a * (x - previous)`. |

History starts at zero, is inherited on exact division, and resets for a fresh
random or archive arrival. Each syntactic occurrence owns a separate slot from
the existing eight memory locations; explicitly addressed memory, named state
and local bindings are reserved first. Nested expressions have separate histories.
Branches that do not execute do not update their history. Inputs execute exactly
once, including effects. These are histories of **evaluations**, not automatically
of fixed seconds or physics ticks. Ordinary VM clamping and instruction costs
apply, and evaluation can suspend at an instruction-budget boundary.

All three compile into existing instructions. No GPU state size, native opcode,
physics, energy rule or default configuration changes. A running average is a
built-in computational convenience; its presence must not be counted as evolved
complexity by itself.

## Controlled introduction and validation

The new forms are appended to the schema, preserving old serialized node IDs.
The random-founder generator excludes them in this experiment, so the original
random population is exactly matched. They are available to ordinary subtree
mutation of archived programs; crossover can transfer them once present.
Division still has no genomic mutation. The sampler ID is
`typed-sequences-state-temporal-mutations-v1`.

The 1,000-tree regression preserves trees, bytecode and packed IDs. A further
check compares **all 8,192 initial founder trees and compiled programs** for
seeds 42, 97 and 321 using the engine's actual random-stream initialization.
Two thousand mutation attempts on a small control tree can introduce all three
forms without editing the parent. This is reachability, not evolved utility.

Validation: 102 Node tests, the existing 52 GPU lifecycle regressions, and dedicated
GPU checks of delayed values, changes, smoothing/clamping, nested histories,
lazy branches, single input evaluation, shared-AST occurrence isolation,
budget-limited suspension, division inheritance and fresh archived arrivals.

## A matched history intervention

`research/temporal-ablation.mjs` replaces only each private history load with a
copy of the current input. The code keeps the same instruction count and CPU
cost. Explicit memory operations, input reads and history writes remain. Thus:

- `lag(x)` returns current `x`;
- `delta(x)` returns zero;
- `smooth(a,x)` returns current `x`.

This is more informative than deleting the whole expression or replacing all
outputs with zero. It still changes behavior and can remove actuation—for example,
a controller driven by a derivative—so ecological controls remain necessary.
Actual uploaded GPU bytecode is read back and checked against the intervention.

A calibration presents different past cue sequences that finish at the same
current cue. All three stateful controls retain a difference that disappears
under the intervention; a memoryless control does not. An authored linear
extrapolator `2*x - lag(x)` predicts a linear ramp with zero squared error after
the initial sample, versus error one with instantaneous input. These are small
computational checks, not evolved organisms or ecological fitness results.
The controls are never inserted into evolving worlds.

## Evolutionary comparison, in progress

The three temporal-variant worlds use the same baseline as the ongoing cadence
comparison: 32,768 slots, 8,192 random founders, eight arrivals per second, no
population floor, 80% archive mutation, 25% crossover, zero division mutation,
and 3,600 simulated seconds. The original compiler pause is retained here to
avoid combining two experimental changes. The old aggregate observer is off.
Censuses every 300 seconds retain populations, motion, lifecycle counts and
surviving programs.

After all three seeds finish, compare sustained colonies and inspect the temporal
expressions in survivors. Apply the matched history intervention to candidates
before claiming functional temporal control. Then test ecological maintenance
and descendants, as the earlier light-steering example failed outside its short
assay. A larger population, more stateful syntax, or a more compressible trace
is insufficient. No result from this comparison is claimed yet.

## Reproduction

In a disposable checkout of `2d5a0ec`, apply
[temporal-expressions.patch](temporal-expressions.patch). Copy these current
research tools and their relative layout into that checkout:
`gpu-temporal-check.mjs`, `gpu-temporal-ablation-check.mjs`, and
`temporal-ablation.mjs`, plus `check-temporal-founders.mjs`. Then run:

```sh
npm test
node research/gpu-life-check.mjs
node research/check-temporal-founders.mjs /path/to/baseline /tmp/founders.json
node research/gpu-temporal-check.mjs /tmp/temporal-check.json
node research/gpu-temporal-ablation-check.mjs /tmp/temporal-ablation.json
node research/gpu-life-run.mjs --substrate=trees --capacity=32768 --initial=8192 --floor=0 --rate=8 --seconds=3600 --sample=300 --seed=42 --behavior=0 --out=research/runs/continuous-temporal-variant-42
# Repeat seeds 97 and 321. Baseline outputs: continuous-cadence-control-<seed>.
```

[Static audit](../results/state-opportunities.json),
[founder equivalence](../results/temporal-founder-check.json),
[GPU semantic checks](../results/temporal-expression-check.json),
[history-intervention calibration](../results/temporal-ablation-check.json).
