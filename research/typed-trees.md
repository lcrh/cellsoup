# Autonomous typed-tree worlds

Choose **Typed Lisp trees** under **Genome language**, or open
`/gpu.html?substrate=trees`. Typed trees are the default; assembly remains selectable. Both run the same
sunlight, temperature, attack, corpse and spring-barrier physics. Tree evolution
is experimental; no advantage over assembly has been established.

A tree has at most 32 nodes, compiles into at most 64 instructions, and uses the
same per-tick instruction and energy budget as assembly. Eight temporary
registers evaluate expressions. Eight separate cell-local memory values persist
between evaluations; division copies them and the genome exactly. A ninth
internal slot retains the parent/daughter/failure return from division.

```lisp
(state ((accumulator 0))
  (let ((light (sunlight)))
    (set! accumulator (+ (* 0.9 accumulator) light))))
```

`state` initializes a numeric variable the first time that form executes in a
cell, then retains its value. `let` evaluates its numeric bindings once each
time the form runs. Read a bound variable directly and use `set!` to update it.
Initializers use the surrounding scope, as in parallel Lisp `let` bindings.
Bodies may contain several actions; a final expression can return a value when
the form is used inside an expression. Both forms count toward the normal node
and instruction limits. There are eight shared numeric storage locations for
state, locals, and the earlier explicit `memory`/`set` operations. Named locals
avoid locations explicitly addressed elsewhere in the source.

Initialization status is separate from values: assigning zero does not trigger
reinitialization. Division copies values and initialization status, while random
and archived arrivals start uninitialized and evaluate their genome's initial
values. Computation is bounded by the same instruction budget even when it spans
several ticks. The tests also cover initializers with a message receive: later
messages are not consumed by an initializer that has already run.

The inspector uses canonical names `state0`–`state7` and `local0`–`local7` so
storage references stay stable through subtree crossover. Those names denote
fixed locations when parsing an exported tree; other source names are allocated
a free location. It displays all eight values under **Cell memory**. Division's
result is separate and remains available as `(birth-result)`.

Number, Bool, Cell, Memory, Channel, and Action types prevent incompatible
connections. State and local bindings currently hold numbers; boolean conditions
and cell references remain typed expressions. The vocabulary includes relative
gradients, linked communication, targeting, photosynthesis, eating, reserves,
attacks, movement, and division. Untaken branches do not execute their effects.
Exports include the typed genotype, both direct parent IDs, and compiled bytecode.

## Random programs and arrivals

Founders and random arrivals are independently sampled programs of 1–6 random
actions, including randomly generated expressions and branches. All samples
must satisfy node, depth, temporary-register and instruction limits. No action
is guaranteed and there are no hand-written survival templates. The first
sampler, which chose a single random root action, mostly produced programs that
could only do one thing; its 300-second pilot produced six divisions and no
qualifying archives. Changing random program structure is an explicit sampling
bias, not evidence that typed trees intrinsically evolve better.

Both the steady arrival rate and low-population replenishment use the same
sampler. **Archive share** chooses between fresh random programs and archived
successes. **Crossover** independently controls attempts to combine two distinct
archive entries by replacing a proper subtree with a same-type donor subtree.
Results identical to either whole parent do not count as crossovers. If no mixed
child fits the limits, an archive copy is reported instead.

**Resampling mutation** applies afterward to archived arrivals, including crossed
ones. Mutation and crossover are independent, and neither changes the parents.
Division bypasses this sampler entirely. New arrivals start with fresh cell
state. Both parent IDs are retained in the genotype header and export, and
successful crossover counts are visible separately from mutations.

The comparison trials below predate the named-state forms (`typed-sequences-v1`). New trials record `typed-sequences-state-v2`. Changing the available grammar changes random populations, so those trajectories should not be presented as current-state survival measurements.

## Implementation and validation

Physics and execution stay on the GPU. Once per simulated second, tree mode
pauses at the immigration boundary, mirrors the GPU-selected archive, creates
and compiles newcomers on the CPU, and uploads their programs into free genome
slots. The GPU initializes their cells using the same reservation rules as
assembly, so division cannot take slots reserved for arrivals. There is no
per-cell state readback for reproduction. The host retains at most one genotype
per genome slot plus the 128 archive entries; recycled slots do not lose archived
trees. This implementation adds synchronization at immigration boundaries and
has not been demonstrated at million-cell scale.

The existing GPU archive rules are unchanged: minimum age, harvest and direct
births, with founder buckets and decaying scores. Tree parents are sampled
uniformly from occupied archive entries. All random generation is seeded;
GPU allocation and physical contention can still change complete trajectories.

Node tests exercise type checking, immutable parents, 1,000 random programs with
mutations/crossovers, serialization, and separate arrival probabilities. GPU
checks cover memory, ReLU, branch effects, exact division, autonomous founders,
steady arrivals, replenishment, two-parent reintroduction, and slot recycling.

Reproduce a closed-population trial:

```sh
npm run gpu:life-run -- --substrate=trees --crossover=0.25 --capacity=32768 --initial=8192 --seconds=900 --close-at=300 --sample=60 --seed=42
```

Use `--substrate=assembly` for the same ecology with assembly, or `--crossover=0`
for trees without recombination. These are different stochastic trajectories;
a single seed cannot establish a causal benefit from crossover. See the saved
trial summary in `research/results/typed-arrivals.json` for current evidence.
