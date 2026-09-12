# Memory and evolutionary variation

These patches are research variants of commit
`32dc8cd78832211203492c5c043aad0b947aa658`, not changes to the published simulator.
Apply one at a time to a disposable checkout of that commit. The research tools
and saved results in this directory's parent can also be copied into that
checkout. Each patch modifies only the tree sampler and its recorded version.

* `bound-memory.patch` adds in-scope variables as grammar choices for numeric
  reads and memory addresses. The scope reaches a binding's body and replacement
  mutations inside it, but not its initializer. Reads still lower to the same
  two-node memory expression. No ecological action is guaranteed.
* `local-mutation.patch` attempts a local edit in 50% of mutation attempts,
  compatible-subtree extraction in 10%, and subtree regrowth in 40%. Local edits
  preserve children: change a same-signature operation, perturb a constant, or
  change a memory/channel address. Rejected attempts are retried, so accepted
  proportions need not equal those percentages. Founding genomes are identical
  to the control for seeds 42, 97, and 321 (all 8,192 checked per seed).

Both variants pass the existing 74 Node tests and 51 real GPU lifecycle checks.
Neither is promoted: the small ecological comparison does not support doing so.
Both retained fewer living cells than control at 900 seconds for each tested
seed. The scope variant lost all moving groups; the local-edit variant retained
one moving group in one seed. This is a decision about these experiments, not
proof that scoped variables or local mutation are generally harmful.

## Reproduction

From the repository root, with the project's dependencies installed:

```sh
git apply research/experiments/bound-memory.patch
node research/tree-memory-audit.mjs web/gpu/trees.js audit.json
node research/gpu-life-run.mjs --capacity=32768 --initial=8192 --seconds=900 --sample=60 --close-at=300 --seed=42 --out=research/runs/replay
```

Use seeds 97 and 321 as well. The control uses the unpatched sampler. The
run starts with random programs, introduces random and archive-derived arrivals
for 300 seconds, then disables both constant immigration and replenishment.
Division continues to copy genomes exactly. A different GPU allocation order or
random draw stream after mutation can change whole-world trajectories; matching
seed values do not make these deterministic paired counterfactuals.

## Measurements

`../results/memory-evolution.json` summarizes the nine comparison runs; the
corresponding `../runs/memory-*` directories retain raw observations and leaders.
`../results/memory-generator-{control,scope}.json` records 10,000 random programs
and a separate 10,000 one-mutation samples, using seed 731.

The control generated 9 bindings with reads in their bodies out of 7,225
bindings. Scope-aware generation produced 160 out of 7,250, and two syntactic
recurrent updates instead of zero. These counts include unreachable expressions
and aliases. They demonstrate greater opportunity, not executed computation.

The local-mutation runs record **every surviving tree**, extending the older
runner's twelve-leader snapshot. They contain 0, 1, and 11 memory-reading
genotypes respectively. Each of those reading genotypes has only one surviving
cell. This does not demonstrate a successful reproducing memory-based strategy.

`tree-memory-probe.mjs` replays all twelve readers as isolated cells for ten
simulated seconds under constant sunlight. It replaces only user-memory reads
with zero, preserving compiled instruction count, initialization, and the
separate birth-result slot. Capacity one prevents division. Each original is
repeated and must reproduce exactly before any difference is attributed to the
intervention. Positive and negative authored fixtures validate the assay; they
are never seeded into evolutionary worlds.

One generated survivor, serial 10049 in `memory-local-321`, changes its behavior:
it retains an initial sunlight value and later uses that value in its shield
setting. Effects begin on tick three. After ten seconds its original shield is
0.6; disabling reads makes it zero, conserving about 3.33 energy and reducing
temperature. This establishes a functional storage dependency in the assay. It
does **not** establish a fitness benefit, recurrent computation, inherited-state
behavior, cooperation, or useful ecological memory. The other eleven programs
produce no measured difference in this isolated setting. See
`../results/memory-probe-{97,321}.json` for configurations and observations.

No epiplexity estimate is claimed. Survival, sustained reproduction, moving
groups, and causal dependence on memory are distinct pieces of evidence; none
alone is a measure of emergent structured complexity.

## Computation allowance and continuous evolution

A second follow-up keeps the control sampler and raises `--budget=64`, from 24
instructions per tick. Longer programs otherwise spread an evaluation over
several ticks, potentially reducing the frequency of their photosynthesis calls.
The budget-64 runs finish with 420, 20, and 778 living cells for seeds 42, 97, and
321. Seed 42 retains four moving groups, the largest with 93 cells; the other
seeds retain zero and one moving group. These results do not support changing
the default. Raw runs are `../runs/memory-budget64-*`; summaries are appended to
`../results/memory-evolution.json`. The UI already exposes this parameter.

Closing immigration also closes the **only source of genetic variation** under
the requested zero-division-mutation model. These closed trials measure
ecological persistence and selection among existing genomes. They cannot test
continued adaptation after closure. Their role is diagnostic, not an overall
ranking of evolutionary substrates.

The next protocol retains eight arrivals per simulated second for an hour,
disables only low-population replenishment, and records `bornInWorld` versus
`livingArrivals`. This separates population created by division from founders
and imported cells while retaining the user's evolutionary mechanism. It still
requires causal behavior probes and comparison across seeds; population size
alone cannot establish increasing structured complexity.

```sh
node research/gpu-life-run.mjs --capacity=32768 --initial=8192 --seconds=3600 --sample=300 --floor=0 --seed=42 --out=research/runs/continuous-memory-control-42
```
