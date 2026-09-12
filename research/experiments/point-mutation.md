# Small operation changes under the linked-gift ecology

This experiment is based on release `aba3eaa` (0.8.3). It is separate from
production. Apply `point-mutation.patch` to a disposable checkout of that release,
then copy the current `research/gpu-life-run.mjs` and `research/behavior-observer.mjs`
there to record behavior. Dependencies are unchanged.

One third of archive mutation calls first attempt a point mutation: choose a
node with compatible alternatives and replace only its operation with one of
the same declared input and output types. Its arguments and literals remain
unchanged. Compilation checks the resulting genome. If this attempt cannot
produce a valid edit, the ordinary mutation runs instead. Other calls use the
existing literal perturbation, subtree extraction and subtree regrowth. Thus
one third is the attempted mixture probability, not a guaranteed accepted count.

The operator can, for example, change `alive` to `kin` while preserving the
existing target computation, or change an arithmetic operator without losing
its inputs. It contains no special case for giving, kinship or metabolism.
Founders are exactly the same random sampler, crossover is unchanged, and
cell division still copies genomes without mutation. The archive mutation
probability remains 80%; only that mutation's distribution changes.

An earlier local-mutation experiment also preserved children. It used a different
mixture (including literal/address edits), the older contact-only gift rule, and
closed immigration at 300 seconds. Its small ecological comparison was negative;
see [the earlier protocol](README.md). That evidence prevents assuming this
operator is better. The new trial evaluates a narrower operation-only edit under
the corrected linked-gift ecology, with continuous arrivals and explicit
behavioral recording. The recent [matched guard assay](../linked-gift-evolution.md)
provides a concrete example of useful sensory refinement, not proof that point
mutation will discover it.

## Protocol fixed before inspecting outcomes

Three controls and three variants use seeds 42, 97 and 321, 32,768 entity slots,
8,192 random founders, eight arrivals per simulated second, no floor,
25% crossover, 80% archive mutation and 3,600 simulated seconds. All settings,
physics, genome limits and observation code match. Archive selection is unchanged.
The recorded sampler IDs distinguish `typed-sequences-state-v2` from
`typed-sequences-state-point-v1`. Shader fingerprints must match.

```sh
# In each condition's checkout, use the matching output prefix:
node research/gpu-life-run.mjs --substrate=trees --capacity=32768 --initial=8192 --floor=0 --rate=8 --seconds=3600 --sample=300 --seed=42 --behavior=1 --out=research/runs/continuous-point-control-42
# Variant prefix: continuous-point-mutation; repeat seeds 97 and 321.
```

The census records linked population, connected-group motion, recent successful
thrust, births and deaths, and all surviving genotypes. Compare late snapshots
at minutes 30–60 and retain the full trajectories. The optional behavior observer
records every 120 ticks and fits the same eleven bounded models as the browser,
using 32-frame windows and updates every eight samples. It saves all estimates
and the latest fitted raw window. Training, selection, held-out prediction and
shuffled baselines use the [published estimator](../../docs/behavioral-epiplexity.md).
Overlapping windows are not independent experimental replicates.

A larger learned model alone will not justify promotion. Compare it with
held-out prediction gain and the shuffled baseline, population trajectories,
moving group persistence, and inspection or ablation of any apparent regulatory
behavior. A boom, random conditional syntax, or one favorable seed is insufficient
to claim more adaptive organization. Matching seeds are not deterministic GPU
counterfactuals; concurrent timings are not performance benchmarks.

Validation before these runs: 93 Node tests, including 2,000 point-mutation
structural checks and a 1,000-genome baseline founder hash; 52 real GPU lifecycle
checks; and a 66-second trial verifying 34 samples, an exact 120-tick cadence,
32 frames in the final fitted window, and completed population/genome audits.

## Completed comparison

All six one-hour worlds completed. Each saved observer has 1,801 samples and 222
fits at the stipulated cadence; every world has 13 censuses and complete final
survivor trees. Configuration, shader fingerprints, census accounting and
completion markers were checked before comparison. The old observer is now a
historical diagnostic, not a trusted evolutionary objective.

Late means use the seven censuses from minutes 30–60:

| Seed | Baseline linked cells | Point mixture linked cells | Baseline moving-group cells with recent thrust | Point mixture moving-group cells with recent thrust |
| --- | ---: | ---: | ---: | ---: |
| 42 | 9.65% | 6.92% | 0.93% | 1.44% |
| 97 | 82.72% | 3.17% | 5.13% | 1.83% |
| 321 | 0.62% | 0.76% | 0.13% | 0.18% |

The outcome is mixed and strongly seed-dependent; this does not justify changing
the default mutation operator. Syntax counts also fail: the baseline seed-42
world has 1,505 living cells with `kin` somewhere in their tree, but its dominant
such program uses `(or true (kin (self)))`, a constant true condition. Several
other programs put kin sensing into dead or unused expressions.

Inspection found rare natural gradient-steering programs. A subsequent
[matched sensory assay](../sensory-complexity.md) establishes a light-navigation
benefit for two examples from point-mixture worlds. This is an existence result
from selected candidates, not a sampled prevalence comparison or evidence that
the mutation change caused an improvement. It is a useful next calibration target
for a complexity proxy beyond syntax and compression.

All source files, including intermediate observations, are retained as individual
gzip files under `research/results/point-worlds/`; the manifest records the SHA-256
of each original uncompressed file. The comparison reader supports either plain
run files or these compressed copies:

```sh
node research/compare-point-worlds.mjs research/results/point-worlds research/results/point-worlds /tmp/point-world-comparison.json
```

[Saved comparison](../results/point-world-comparison.json),
[raw-record manifest](../results/point-worlds/manifest.json).
