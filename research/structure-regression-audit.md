# Structure regression audit

This audit investigates why recent worlds appear to produce less interesting
multicellular structures. The reference checkout is `d54ae2d`; the historical
tree sampler comparison uses `bdc6bac`. Random founders, logarithmic energy
filling, and inverse-energy capacity replacement remain part of the model.
Nine GPU runs compare the baseline, an initial candidate, and the final
release. The release has more cells in connected and moving bodies across the
three tested worlds, with gains weakening after population capacity is reached.
Largest-body size does not consistently improve. These observations do not
establish cooperation or a general increase in evolutionary complexity.

## Random program supply

The CPU audit sampled 10,000 founders per condition and attempted one mutation
for the first 2,000 founders in each condition: 80,000 founders and 16,000
mutations overall. Random-world conditions cover seeds 0–99, with 100 founders
per world. Private copies of the current and historical language modules count
compiler retries without modifying production code or adding RNG draws.

| Sampler condition                        | Mean AST nodes | Bud + photosynthesis | Bud + movement | All three |
| ---------------------------------------- | -------------: | -------------------: | -------------: | --------: |
| Historical plain defaults                |          18.49 |                  614 |            402 |       106 |
| Current plain defaults                   |          18.49 |                  614 |            402 |       106 |
| All extra feature weights set to 1       |          20.13 |                  454 |            305 |        80 |
| Current random worlds                    |          13.34 |                  352 |            224 |        54 |
| Random worlds, maximum founder actions 6 |          17.53 |                  644 |            424 |       101 |
| Random worlds, generation depth 6        |          15.30 |                  350 |            221 |        52 |
| Random worlds, both controls 6           |          19.35 |                  708 |            503 |       155 |
| Random worlds, extra feature weights 0   |          12.86 |                  362 |            265 |        50 |

Counts are founders out of 10,000. These are syntactic occurrences: an
instruction can be guarded off, receive an ineffective argument, or never be
reached during a cell's lifetime. They measure the supply of potential
behaviors, not realized cooperation, reproduction, or motion.

The larger supply change comes from randomizing the maximum founder action
count over 2–6; fixing it at 6 still samples fully random programs containing
1–6 top-level actions. It guarantees no particular primitive. Extra vocabulary alone
does not explain the observed supply reduction. Restoring depth alone did not
help these joint counts.

There were no generation failures, random-tree compiler retries, mutation
failures, or unchanged returned mutations in these samples. Current plain
defaults matched the historical aggregate statistics. Core random-world masks
preserve budding, photosynthesis, movement, and basic computation. Current
random-world programs averaged 14.28 bytecode instructions; 13.55% exceeded
24 instructions. Exceeding one tick's execution budget does not itself make
later instructions unreachable: execution resumes from the saved program
counter. This bounded audit does not rule out rare compiler or runtime defects.

The original raw measurements are preserved in
[tree-supply.json](results/structure-audit/tree-supply.json). Here, “current”
means the pre-tuning `d54ae2d` settings. Reproduce from the repository root by
extracting that settings module with its dependencies. Keep the shell variable
below for the subsequent commands:

```sh
snapshot_dir=$(mktemp -d /private/tmp/cellsoup-structure-d54ae2d.XXXXXX)
git archive d54ae2d web package.json | tar -x -C "$snapshot_dir"
node research/tree-evolvability-audit.mjs /private/tmp/cellsoup-tree-evolvability-replay.json "$snapshot_dir/web/gpu/random-world.js"
```

The optional second argument selects the settings module; omitting it audits
today's settings instead. Reports record its absolute path and source hash.

## Division cadence defect

The VM previously yielded for every `bud` or `split` instruction, even when the
cell could not meet the division energy threshold or a bud had no available
link slot. This made an impossible action consume the remainder of the tick,
delaying subsequent energy collection or movement. It contradicted the
intended no-op semantics for unaffordable actions.

The first shader correction checks the existing energy threshold and local
link availability before requesting division. Impossible attempts return the
failure value and continue executing. Feasible attempts still yield to the
synchronized allocator, which resolves population capacity, competing births,
and intervening damage. This is a scheduling correction, not free division or
a change to its energy requirements.

The subsequent correction also continues without yielding when authoritative
birth capacity is zero: all slots are occupied or the available slots are
reserved for immigration. It preserves later reproduction when vacancies
become available. In the native typed-program fixture, photosynthesis followed
by an impossible bud now harvests six times in six ticks instead of three.
Nine focused cadence checks and 52 existing lifecycle checks passed. These
tests cover energy and link failures, retained CPU costs, successful division
and contention, no delayed division request, full habitats, and immigration
reservations. They complement the completed world comparisons below.

```sh
node research/gpu-division-cadence-check.mjs /private/tmp/cellsoup-division-cadence-check.json
```

## Energy headroom at the division threshold

Using the original `d54ae2d` settings for seeds 0–9999, 8,755 randomized worlds
enabled sunlight. In 5,908 of those
worlds (67.5%), the idealized photosynthesis gain at division threshold was no
greater than upkeep plus energy decay:

```text
T = divisionCost + 2 × minimumBirthEnergy
gain = solarRate × photoEfficiency × exp(-T / energyFillScale)
cost = upkeep + energyDecay × T
```

This assumes maximum sunlight, one full tick's photosynthesis each tick, and no
movement, CPU, heat, or other costs. It identifies a photosynthesis headroom
problem under that model. It is not a prediction of inevitable extinction:
cells can mobilize reserves, scavenge corpses, arrive with substantial energy,
or experience other specialization and program effects. Clouds and action
cadence can make actual photosynthetic performance worse.

The candidate current random-world defaults pass the stronger 0.7-sunlight,
0.5-surplus headroom check across all 8,755 sunny worlds in this seed sample.
That is a settings-level bound, not an observed evolutionary outcome.

```sh
node --input-type=module - "$snapshot_dir/web/gpu/random-world.js" <<'JS'
import { pathToFileURL } from 'node:url';
const { worldSettingsForSeed } = await import(pathToFileURL(process.argv[2]));
let lit = 0, failures = 0;
for (let seed = 0; seed < 10000; seed++) {
  const c = worldSettingsForSeed(seed);
  if (!c.solarEnabled) continue;
  lit++;
  const threshold = c.divisionCost + 2 * c.minimumBirthEnergy;
  const gain = c.solarRate * c.photoEfficiency *
    Math.exp(-threshold / c.energyFillScale);
  failures += gain <= c.upkeep + c.energyDecay * threshold;
}
console.log({ lit, failures, percent: 100 * failures / lit });
JS
```

## First GPU comparison

`structure-world-audit.mjs` compares random worlds at 32,768 entity slots,
8,192 genome slots, and a 4,096-unit habitat. It records connected-body sizes,
linked cell counts, branching, established genome slots, and recent thrust in
moving bodies. Genome slots can contain identical programs; their count is not a measurement of distinct genetic diversity. These are hypothesis tests against the frozen pre-tuning
settings. The `founders` condition fixes the two generation controls at 6. The
`balanced` condition additionally raises sunlight input using an assumed
0.7 illumination and 0.5 energy units/second surplus at the division threshold.
Those are candidate tuning assumptions, not measured sunlight or a guarantee
of viable growth.

The first six runs completed 1,200 simulated seconds each: seeds 42, 97, and
321 under both the original baseline and the first balanced candidate. The
first candidate combines the energy/link cadence correction with founder and
sunlight tuning. **It does not include the later zero-birth-capacity cadence
correction.** The combined comparison cannot assign changes to individual
interventions.

Late-half means use six observations at 600, 720, 840, 960, 1,080, and 1,200
seconds. “Moving cells” counts cells in bodies of at least four, moving faster
than the observation threshold, with at least one recent thrust event.

| Seed | Living, baseline → first candidate | Fraction in bodies ≥4, baseline → first candidate | Moving cells, baseline → first candidate |
| ---- | ---------------------------------: | ------------------------------------------------: | ---------------------------------------: |
| 42   |                    32,624 → 32,760 |                                     22.6% → 28.6% |                              294 → 1,174 |
| 97   |                       578 → 32,738 |                                        0% → 0.94% |                                  0 → 213 |
| 321  |                     7,630 → 32,725 |                                     11.2% → 16.7% |                                 70 → 525 |

The fraction column measures bodies of at least four cells, not every linked
pair or triple. The summary names this field `fractionInBodiesAtLeast4`.

The early gains do not keep growing at capacity. For seed 97, the candidate
rose to 3,554 cells in bodies of at least four at 240 seconds, then fell to
1,492 at 360 seconds as population filled, and averaged only 306.5 in the
late half—about 1% of living cells. Seed 321 declined from 6,222 at 240 seconds
to 5,054 at 1,200 seconds. Seed 42 also declined after filling, although its
late-half connected and moving counts remained above baseline. Not every
structural descriptor improved: seed 42's mean largest body fell from 603.5
to 115.8 cells. More motion or more connected cells alone does not demonstrate
coordination, useful specialization, or cooperation.

See the [late-half summary](results/structure-audit/first-comparison.json) and
raw [baseline](results/structure-audit/baseline) and
[first-candidate](results/structure-audit/balanced) observations. Each run
records its actual configuration and shader fingerprint.

To recreate the first candidate exactly, extract a separate baseline and apply
the preserved shader patch. This avoids accidentally testing today's later
zero-capacity correction under the old candidate label:

```sh
candidate_dir=$(mktemp -d /private/tmp/cellsoup-structure-first-candidate.XXXXXX)
git archive d54ae2d web package.json | tar -x -C "$candidate_dir"
patch -d "$candidate_dir" -p1 < research/results/structure-audit/first-candidate-shader.patch
```

```sh
node research/structure-world-audit.mjs --mode=baseline --settings="$snapshot_dir/web/gpu/random-world.js" --engine="$snapshot_dir/web/gpu/engine.js" --seeds=42,97,321 --seconds=1200
node research/structure-world-audit.mjs --mode=balanced --settings="$snapshot_dir/web/gpu/random-world.js" --engine="$candidate_dir/web/gpu/engine.js" --seeds=42,97,321 --seconds=1200
node research/structure-world-audit.mjs --mode=production --seeds=42,97,321 --seconds=1200
```

Run these sequentially on the same GPU. `baseline` uses the frozen engine and
settings; `balanced` uses the first-candidate engine and applies its two
settings interventions. `production` uses both the current settings and current
engine, including the bounded sunlight-rate/fill-knee postprocessing and the
additional zero-birth-capacity correction. For the three listed trial seeds,
its settings match the balanced candidate exactly; its shader does not. These
commands intentionally separate `--settings` from `--engine`; merely loading
an old engine does not restore its old random-world settings. Population size alone is not
structural complexity, and a few worlds cannot establish a general evolutionary
benefit. The final-candidate results follow below; deployment is verified separately.

## Final release comparison

All three final-production runs completed the same 1,200 simulated seconds,
including the zero-capacity correction. Together with the baseline and first
candidate, this is nine runs and three simulated hours. The final runs check
reciprocal links, finite observed cell state, the population ledger, and GPU
errors. They completed without a reported error.

| Seed | Fraction in bodies ≥4, baseline → release | Moving cells, baseline → release |
| ---- | ----------------------------------------: | -------------------------------: |
| 42   |                             22.6% → 27.8% |                        294 → 661 |
| 97   |                                0% → 1.94% |                          0 → 528 |
| 321  |                             11.2% → 18.0% |                         70 → 855 |

These use the same late-half observations and definitions as above. Compared
with baseline, all three release runs had more cells in connected groups and
more cells in moving groups with recent thrust. The release does not maximize
colony size: seed 42's mean largest body was 76 cells versus 604 in baseline,
and seed 97 still had no bodies of 16 or more cells in the late samples.
Selected snapshots show smaller branching groups alongside dense clusters;
these are not uniformly larger or more elaborate organisms. The zero-capacity
fix also does not improve every movement descriptor over the first candidate.

The changes address verified scheduling defects and improve the supply and
viability of random programs. These three world configurations provide bounded
runtime evidence, not a claim that every seed improves or that adaptive
cooperation has evolved. GPU scheduling makes individual trajectories variable.

[Final comparison](results/structure-audit/final-comparison.json) ·
[Final raw observations](results/structure-audit/production).

Matched selected-colony sheets at 20 minutes, with identical physical scale within each comparison: [seed 42](results/structure-audit/final-42.png), [seed 97](results/structure-audit/final-97.png), [seed 321](results/structure-audit/final-321.png). These show selected bodies, not a whole-world census.

The v0.9.4 static build also passed browser checks: running seeded simulation, visible linked colonies, new-world restart with an updated seed URL, and no reported console errors. The [cadence checks](results/structure-audit/division-cadence.json) and [captured lifecycle output](results/structure-audit/life-check.txt) accompany the runtime records.
