# 0.8.7 — mutation during division

**Division mutation** is separate from archive-resampling mutation. It defaults
to 1% per successful division and applies to both linked `bud` and detached
`split`, in typed-tree and assembly worlds. Zero restores exact-copy division.
Random new worlds draw this probability from 0%, 0.5%, 1%, 2%, 3% and 5%.
The page displays division and archive mutation totals separately.

A selected daughter receives a private genotype. Typed trees use the existing
bounded subtree/constant mutation operation; assembly changes one instruction or
operand while respecting the opcode signatures. Parents and siblings retain
their original genome. Mutation depth increases by one and the source genotype
and founder are recorded. Division still conserves the remaining energy and
reserves and establishes or omits links according to its instruction.

Typed trees are compiled on the CPU. Selected newborns pause their program until
the next fixed 16-tick compilation boundary (at most about 0.27 simulated seconds),
while their physics and metabolism continue. This schedule is independent of
frame size and engine step chunking. Mutated programs restart at their beginning;
typed mutants receive fresh registers and private memory with birth-result 1,
and assembly mutants retain inherited registers. Unmutated daughters retain the
old code, registers, memory and program phase. A daughter that dies before
assignment does not receive a wasted new genotype. When genotype capacity or the
bounded request buffer is exhausted, the daughter remains an exact copy and the
skipped mutation is counted. Setting the probability to zero removes the request
buffer and host readback path.

Execution-trace sampling excludes newborns awaiting mutation, and trace capture
checks genotype identity so a recording cannot attribute a changed instruction
path to the old program.

## Validation

106 Node tests pass, including 4,000 assembly mutations that change one
instruction, preserve the original genome and remain valid assembly. All 52
existing GPU lifecycle checks pass with division mutation explicitly disabled.
Twelve focused GPU cases cover both languages, both division types, 0% and 100%,
source isolation, ancestry, fresh typed memory, preserved links, independent
mutation counters, unavailable genotype slots, step-chunk independence, trace
selection and dead requests whose cell slots are reused.

A 180-second random typed population starts with 2,048 founders in 8,192 slots,
10% division mutation and no immigration. It produces 1,367 divisions and 138
division mutations; archive mutations and sampled arrivals remain zero. Population
and genotype-reference ledgers pass. This establishes mutation in a closed world,
not an evolutionary-complexity improvement.

[GPU checks](../research/results/fork-mutation-check.json),
[closed-world run](../research/results/fork-mutation-autonomous.json.gz),
[empty-queue timing check](../research/results/fork-mutation-bench.json).
The paired timing check averages about 7% additional stepping time for an enabled
but empty mutation queue at 32,768 slots. Other experiments were using the GPU;
this is an overhead check, not a standalone throughput guarantee.
