# Typed-tree experiment

This is an experimental genome compiler and immigration sampler. The interactive
world still creates and mutates assembly genomes. Tree populations, a two-parent
archive, and browser controls are not wired into the autonomous GPU world yet.
No evolutionary advantage over assembly has been demonstrated.

Trees have Number, Bool, Cell, Memory, Channel, and Action types. A genome has at
most 32 nodes and must compile into at most 64 instructions using eight temporary
registers. Eight separate, cell-local memory slots persist between evaluations;
a ninth internal slot records division's parent/daughter/failure result. Programs
resume across ticks under the existing instruction budget. An evaluation ends
with a yield before starting again. Effects in untaken branches do not execute.

```lisp
(seq
  (set m0 (max 0 (+ (* (memory m1) 2) -3)))
  (move (memory m0)))
```

The vocabulary includes current cell sensors, relative gradients, linked
communication, targeting, photosynthesis, eating, storage/mobilization, attacks,
movement, and division. Numbers compose directly into actions and comparisons;
no hand-matched registers are required. The spelling is documented by
`TREE_SCHEMA` in `web/gpu/trees.js`.

## New arrivals and crossover

`sampleTreeArrival(archive, options)` chooses an entirely random tree or samples
an archived successful genome. `archiveShare` controls that choice.
`crossoverRate` is independently adjustable: it attempts a same-type subtree
swap with a distinct second archive entry. Only proper recipient subtrees are
replaced, retaining part of the first parent. A result identical to either whole
parent is not counted as recombination. The size, depth, temporary-register, and
instruction limits all apply. If no compatible mixed child fits, the sampler
reports an archive copy instead of a crossover.

`mutationRate` applies afterward to archived arrivals, including crossed ones.
It is separate from crossover and does not mutate the parents. Entirely random
arrivals are already newly sampled programs. This sampler is intended for both
constant-rate arrivals and population replenishment, never division. Division
retains the same genome and copies persistent memory. Parent IDs and whether
crossover and mutation occurred are returned for future lineage reporting.

The sampler accepts an explicit seeded random generator for reproducible trials.
Archive entries are `{id, tree}` and must already have been selected for success;
the sampler does not invent a new fitness criterion.

## Validation and remaining integration

Node tests check type errors, immutable parents, packed-tree round trips, 1,000
random programs with mutations and crossovers, independent arrival probabilities,
and explicit crossover failure. Real GPU fixtures check ReLU evaluation,
persistent memory, conditional effects, and unchanged genomes across division.

Still needed before switching the live world: retain typed genotypes alongside
compiled code, archive those trees with both parent identities, connect the
sampler to actual arrivals and UI controls, and compare autonomous populations
against assembly under matched ecology and compute budgets. Internal memory
opcodes are deliberately excluded from random assembly generation.

Tree execution is opt-in with `treePrograms: 1` and an empty, closed, archive-disabled engine. Supply `{tree}` fixture programs. The normal world allocates no tree memory. Automatic immigration is rejected in this experimental mode until typed genotype/archive integration is available.
