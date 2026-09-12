# Autonomous typed-tree worlds

Choose **Typed Lisp trees** under **Genome language**, or open
`/gpu.html?substrate=trees`. Assembly remains the default. Both run the same
sunlight, temperature, attack, corpse and spring-barrier physics. Tree evolution
is experimental; no advantage over assembly has been established.

A tree has at most 32 nodes, compiles into at most 64 instructions, and uses the
same per-tick instruction and energy budget as assembly. Eight temporary
registers evaluate expressions. Eight separate cell-local memory slots persist
between evaluations; division copies them and the genome exactly. A ninth
internal slot retains the parent/daughter/failure return from division.

```lisp
(seq
  (set m0 (max 0 (+ (* (memory m1) 2) -3)))
  (move (memory m0)))
```

Number, Bool, Cell, Memory, Channel, and Action types prevent incompatible
connections. The vocabulary includes relative gradients, linked communication,
targeting, photosynthesis, eating, reserves, attacks, movement, and division.
Execution resumes across ticks. Untaken branches do not execute their effects.
The inspector shows the tree, its parents, and mutations along primary ancestry;
exports include the typed genotype and compiled bytecode.

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
