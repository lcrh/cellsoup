# Persistent signals through links

This isolated experiment starts from `a387106`. Production remains unchanged.
It does not include the temporal-expression or compiler-cadence experiments.

The [syntax audit](../results/linked-opportunities.json) of nine completed worlds
finds many senders and receivers but few surviving genotypes containing both on
the same channel. Most matches have one living cell. This does not exclude
communication between different genotypes, and a match does not prove function.
The current mailbox also resolves simultaneous incoming messages to the lowest
sender slot, retaining one message per channel until consumed. That is useful
for discrete messages but awkward for combining multiple neighbor inputs.

## A small computational building block

The experiment adds two typed numeric forms:

- `(linked-signal c0)` reads the mean previous-tick signal on that channel from
  live reciprocal neighbors, or zero without neighbors. It does not consume the
  signals and does not include the cell itself or nearby unlinked cells.
- `(couple c0 x)` evaluates `x` once, publishes it using the existing paid `emit`
  instruction, then returns that neighbor mean. This packages publication and
  reading into an expression that subtree mutation can introduce at once.

The publication retains ordinary energy cost, clipping to −100…100, and 3%
per-tick decay. An unaffordable publication does not update the channel; the read
still happens. Signal values already exist in each cell's state, so there is no
new buffer. The published values are also visible to the existing environmental
`listen`, as with ordinary `emit`; this is not a private channel. Division retains
the existing rule that the child's signal starts at zero. Existing `send` and
destructive `receive` semantics are unchanged.

One tree-only VM opcode reads at most four linked cells. Schema entries and the
opcode are appended, preserving old serialized IDs. Ordinary VM budget and costs
apply. Lazy branches skip the entire expression, and evaluation can suspend at a
budget boundary. Publication and the read are two ordinary instructions, not an
atomic transaction across ticks. More than one neighbor contributes to the mean;
this deliberately exposes a generic aggregation operation rather than claiming
that evolution invented averaging.

## Validation

Both experimental configurations pass 99 Node tests; the variant also passes all
52 existing GPU lifecycle checks. Ten dedicated GPU checks cover neighbor means,
channels, repeated reads, unilateral links, isolation, clipping, cost, failed
publication, single evaluation of effects, lazy branches and a recurrent circuit.

An authored three-cell chain computes
`max(0, local-input + 0.5 * linked-signal)` repeatedly. Local inputs are 2, −0.1,
and −0.1. Every output update matches an independent numerical calculation from
the previous GPU state. A positive response reaches the far cell across two links.
Replacing only the neighbor-read instruction with zero, preserving instruction
count and publication, prevents that response. Actual altered bytecode is read
back and checked. This is a calibration of distributed computation, not evolved
intelligence or ecological benefit. The circuit never enters the evolving worlds.

All 8,192 initial random trees and compiled programs match production for each of
seeds 901, 1907 and 2309. Founders exclude the new forms; archive subtree mutation
can introduce them and crossover can transfer them once present. Division stays
exact. A further 3,000 founder/mutation pairs in the control match production.

## Evolutionary comparison, in progress

Three fresh environmental seeds, 901, 1907 and 2309, run for 3,600 simulated
seconds per condition. Both use 32,768 slots, 8,192 random founders, eight arrivals
per second, no population floor, 80% archive mutation, 25% crossover, zero division
mutation and the original compiler cadence. Both include identical GPU code;
only the mutation vocabulary and sampler label differ. The control excludes new
forms from mutation as well as founding. The old aggregate observer is disabled.

Before considering promotion, compare sustained descendants and active connected
groups across complete worlds. Inspect candidate programs and their actual inputs
and outputs. Replay promising bodies with neighbor input removed while retaining
links, publication, instruction count and costs. Then compare against constant
inputs or simpler motor programs; disabled motion alone is a weak control.
Publication/reading counts, population size, or a built-in mean are insufficient.
No evolutionary result is claimed yet.

## Reproduce

Apply [linked-signals.patch](linked-signals.patch) to a disposable checkout of
`a387106`. For the control, additionally apply
[linked-signals-control.patch](linked-signals-control.patch). Copy the current
`research/gpu-linked-signal-check.mjs`, `research/check-linked-founders.mjs`, and
their existing helper `research/temporal-ablation.mjs` into the experimental
checkout. Then run:

```sh
npm test
node research/gpu-life-check.mjs
node research/gpu-linked-signal-check.mjs /tmp/linked-check.json
node research/check-linked-founders.mjs /path/to/production /tmp/linked-founders.json
node research/gpu-life-run.mjs --substrate=trees --capacity=32768 --initial=8192 --floor=0 --rate=8 --seconds=3600 --sample=300 --seed=901 --behavior=0 --out=research/runs/continuous-linked-variant-901
# Repeat 1907 and 2309. In the control use continuous-linked-control-<seed>.
```

Samplers: `typed-sequences-state-linked-signals-mutations-v1` and
`typed-sequences-state-linked-signals-control-v1`.
[GPU records](../results/linked-signal-check.json),
[founder equivalence](../results/linked-founder-check.json),
[control sampler and shader equivalence](../results/linked-control-check.json).
The latter is reproduced from the variant with:

```sh
node research/check-linked-control.mjs /path/to/production /path/to/control /tmp/linked-control.json
```
