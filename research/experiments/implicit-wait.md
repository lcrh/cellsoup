# Removing the compiler-imposed pause

This isolated experiment starts from commit `5dd83ee` (0.8.4). It removes the
compiler's final `wait 0`, preserving `jmp ROOT`, all explicit waits, action
semantics and the per-tick VM instruction budget. A division request still yields.
Pure computations can iterate within that budget, as assembly programs already
can. This is a timing change, not a neutral source simplification.

To isolate execution cadence, the variant preserves the baseline's tree acceptance
boundary: its compiled length plus the removed instruction must still be at most
64. Consequently 1,000 random founder trees sampled with seed 904 match exactly;
only their final wait differs. Ordinary mutation/crossover sampling and founder
energy are unchanged. The sampler label is
`typed-sequences-state-no-implicit-wait-v1` so datasets can be distinguished.

Apply [implicit-wait.patch](implicit-wait.patch) to a disposable checkout of
`5dd83ee`. Copy the current `research/check-implicit-wait.mjs` and
`research/sensory-establishment-probe.mjs` into that checkout. Then run:

```sh
npm test
node research/gpu-life-check.mjs
node research/check-implicit-wait.mjs /path/to/baseline-checkout /tmp/implicit-wait-check.json
node research/sensory-establishment-probe.mjs research/results/sensory-candidates.json /tmp/cadence-establishment.json full zero control-straight-division,31236,32994,14980
```

Validation: 97 Node tests; 53 GPU lifecycle checks; identical random founder trees
and compiler acceptance in the paired 1,000-tree check; identical physics shader
and settings in a full-light metabolic replay. The original loop cannot reproduce
from energy 24, while the variant produces nine births in 60 seconds. That is
an opportunity correction, not evidence of more complex evolution.

Three existing named-state tests assumed one update per tick. They initially
failed because the program now legitimately executes more than once within its
budget. In the experimental test patch, those programs explicitly wait at each
loop, retaining their state-initialization and inheritance checks. A separate new
test checks zero, one and two evaluations as the budget changes, plus explicit
waiting. No production tests or compiler files have been changed.

## Completed matched evolutionary comparison

Baseline and variant each use seeds 42, 97 and 321, 32,768 slots, 8,192 random
founders, eight arrivals per second, no population floor, 80% archive mutation,
25% crossover, zero division mutation and 3,600 simulated seconds. Every 300
seconds save the population, linked groups and motion, lifecycle counters and
surviving trees. The old aggregate observer is disabled because its model size
is not the current objective. GPU kernel fingerprints and ecology settings should
match; compiler/sampler labels should differ.

```sh
node research/gpu-life-run.mjs --substrate=trees --capacity=32768 --initial=8192 --floor=0 --rate=8 --seconds=3600 --sample=300 --seed=42 --behavior=0 --out=research/runs/continuous-cadence-control-42
# In the variant checkout use continuous-cadence-variant-42; repeat 97 and 321.
```

Before considering promotion, compare sustained populations and group behavior,
inspect surviving controllers, and test apparent sensing/state/communication
benefits under matched interventions. More births, larger trees, extra iterations
or faster score growth alone are insufficient. Existing selected-genome replays
are mixed and do not substitute for this evolutionary comparison. Concurrent
world runs are not performance benchmarks.

All six one-hour runs completed. Configuration, physics shader, demographic
accounting and 13 censuses per run pass the comparison checks. The following
are means over seven late censuses (minutes 30–60), summarized within each world.
They are three environmental seeds, not 42 independent samples.

| Seed | Baseline living | Faster living | Baseline fraction in moving groups | Faster fraction in moving groups |
| --- | ---: | ---: | ---: | ---: |
| 42 | 12,083 | 21,864 | 35.46% | 0.26% |
| 97 | 25,993 | 27,377 | 1.00% | 0.68% |
| 321 | 22,625 | 31,993 | 4.23% | 3.36% |

Moving groups require the existing motion threshold and recent thrust within
60 ticks. They are connected components, not validated coordinated organisms.
The faster compiler raises abundance in all three worlds but lowers this fraction
in all three. Seed 321 produces many linked cells while its final population's
mean mutation depth falls from 1.39 to 0.14. Higher abundance is therefore not a
reliable improvement in the intended behavior. No default change is promoted.

All 96 original files are individually gzipped with raw-byte hashes in
[cadence-worlds](../results/cadence-worlds/manifest.json). Recompute the
[comparison](../results/cadence-world-comparison.json) without experimental code:

```sh
node research/compare-evolution-variants.mjs research/results/cadence-worlds research/results/cadence-worlds cadence /tmp/cadence-comparison.json
```

[Full-light cadence check](../results/implicit-wait-check.json),
[ecological replay analysis](../sensory-establishment.md).
