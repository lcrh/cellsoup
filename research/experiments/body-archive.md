# Automatic structural resampling

This experiment applies `body-archive.patch` to production `c0494e8`. The patch
includes the previously validated runtime body-admission method; do not also
apply `body-arrivals.patch`. It adds an external-arrival mode and crossover
provenance. No production engine, grammar, UI default or evolutionary objective
is changed by retaining this experiment.

## Hypothesis and policy

A genome-only archive discards the links that some naturally evolved programs
need to establish cooperation. The earlier controlled fragment assays established
that this can matter for linked energy gifts. The new experiment asks whether
preserving small bodies during ordinary resampling helps autonomous evolution
retain functional interactions, without supplying authored organisms.

Every five simulated seconds, select up to four random live cells that are at
least 60 seconds old and whose current genotype qualifies for the existing
reproduction/harvest archive. Capture a reciprocal connected fragment of at most
eight cells around each root. Keep at most one fragment per founder lineage and
128 lineages total; replace a lineage's previous fragment with its latest sample
and evict a random lineage when full. Roots are sampled from eligible cells, so
larger qualifying populations have more opportunities. There is no reward for
movement, program depth, compression, signal syntax, or group size beyond the
requirement that a saved fragment has at least two cells.

At each one-second arrival boundary, offer eight cells, reserving available slots
before divisions. If a stored fragment fits the free cell and genome slots, use
one with probability 0.5, then fill the remaining cell budget with ordinary
independent arrivals. Individual arrivals use the usual 0.5 archive share. These
are separate probabilities: a body-heavy run can therefore have a lower overall
random-genome fraction than the original individual-only policy. Both test
conditions use exactly this same policy. Initial founders are independently random.

For each distinct source genotype in a fragment, attempt crossover with another
archived genotype with probability 0.25, then independently attempt mutation with
probability 0.8. All copies of that genotype within the new fragment share the
resulting edit. A genuine crossover records both parents; a mutation attempt and
its depth increment are counted per new genotype, not per clone. Division stays
exact. The original fragment's positions, relative headings, positional links,
anchors and spring rest factors are translated and rotated together. Memory,
registers, signals, age, velocity, temperature and program phase restart fresh.
Each admitted cell receives the same configured energy and reserves as an
individual arrival. Capture copies existing cells and never removes them.

The control performs the same capture, selection, genetic edits and placements,
then removes only the reintroduced links. For an identical source archive and
random stream, the submitted programs and non-link cell state are identical.
The worlds subsequently develop their own archives. GPU allocation uses atomics,
so identical seeds do not promise bitwise identical cell slots or trajectories.
Replicated ecological comparisons, rather than a single exact-replay claim, are
required. The control deliberately preserves spatial clustering and headings;
it is not the original independently scattered arrival policy.

## Accounting and validation

`manualArrivals` retains normal archive refresh and arrival reservations, while
allowing the host sampler to fill the available places. It requires typed genomes.
The runner steps exactly to each arrival boundary. Capacity limits may prevent
admissions: **offered** budgets are matched, while realized admissions and imported
energy can differ between worlds. Every arrival request, admitted cell/genotype
slot, source tree, mutation/crossover parent, capture and capacity miss is logged.
The runner checks arrival and energy ledgers, reciprocal live links, finite live
state and genotype references, and refuses to overwrite an existing output folder.

The experimental checkout passes 102 Node tests and all 52 existing GPU
lifecycle tests. The current repository, including the new random-world tests,
passes 104 Node tests. Dedicated tests check
reservation against simultaneous division, retained archive refresh, genotype
sharing, crossover without mutation, independent mutation ancestry, invalid
provenance without writes, and automatic capture followed by execution after
reintroduction. Existing runtime admission checks still pass.

A 512-slot, 120-second smoke pair first reintroduces a body at second 75. The
preceding 74 submitted plans match, and the first body's programs and all non-link
cell fields match. GPU-assigned slots already differ at second one. The connected
condition admits 420 cells (108 body members); the control admits 419 (also 108
body members). After immigration stops at second 90, final populations are 278
and 281. This is a mechanics check, not evidence that structural inheritance wins.
A separate 32,768-slot, 8,192-founder, 120-second run admits all 960 offered cells,
including 182 saved-body members. Stepping takes 13.0 seconds and capture/admission
work 1.55 seconds on this machine; this excludes census/export overhead and is
not a sustained throughput claim for crowded mature worlds.

[Sampler GPU checks](../results/body-archive-check.json),
[paired audit](../results/body-archive-smoke.json),
[retained smoke inputs and outputs](../results/body-archive-smoke/manifest.json).

## Longer trials and interpretation

The running pilot compares connected and unlinked resampling for seeds 42, 97
and 321: 32,768 slots, 8,192 random founders, ordinary sunlight and thermal costs,
eight offered arrivals/second, no population floor, and the policy above. Run for
3,600 simulated seconds and stop all immigration at second 3,000. Observe every
300 seconds. Compare population persistence, births after closure, living
world-born descendants, active moving groups and the actual admission budget.

More linked cells alone is an expected consequence of injecting links, not a
complexity result. Promising naturally evolved fragments still need fresh-world
regrowth and functional interventions: remove gifts, sensory information or
communication while keeping costs and geometry controlled, and compare simpler
controllers. Complexity credit requires useful information dependence that
changes cell behavior and supports descendants; this experiment does not replace
that standard with a group-size reward.

```sh
node --test tests/body-archive.test.mjs
node research/gpu-body-archive-check.mjs /tmp/body-archive-check.json
node research/check-body-smoke.mjs research/results/body-archive-smoke/connected research/results/body-archive-smoke/unlinked /tmp/body-smoke.json
node research/body-world-run.mjs --out=/tmp/body-connected-42 --seed=42 --connected=1 --seconds=3600 --close-at=3000
node research/body-world-run.mjs --out=/tmp/body-unlinked-42 --seed=42 --connected=0 --seconds=3600 --close-at=3000
```
