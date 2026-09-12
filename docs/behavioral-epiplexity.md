# Behavioral epiplexity estimate

The GPU page estimates the amount of behavioral structure captured by a fixed,
small predictive observer. It displays model-description bits, prediction error
on unseen frames, a shuffled-data estimate, and a rolling history. The measurement
is observational and does not change reproductive success, mutation or physics.

This follows the two-part description-length interpretation of epiplexity in
[Finzi et al., From Entropy to Epiplexity](https://arxiv.org/abs/2601.03220),
particularly Sections 3–4. The paper separates a computationally bounded model's
structural information from its residual prediction loss. Our implementation is
a finite-family approximation with an explicit parameter code, rather than a
neural prequential or requential estimator. It is not the universal optimum,
a bound on that optimum, an intelligence score, or a proof of adaptation.

## What is observed

Every **120 physics ticks (two simulated seconds)**, a read-only GPU pass bins
living cells into a fixed **32 × 32 whole-world map**, regardless of camera,
zoom, rendering frequency, cell hue, or genome identifiers. Each tile has six
symbols from a 16-symbol alphabet:

| Channel         | Quantization                                                                         |
| --------------- | ------------------------------------------------------------------------------------ |
| Density         | Empty = 0; otherwise `min(15, 1 + floor(log2(count)))`                               |
| Linked fraction | Fraction of living cells with at least one reciprocal live link, rounded to quarters |
| Mean motion     | Stationary when mean speed ≤ 1; otherwise eight compass sectors, encoded 1–8         |
| Recent activity | Three bits for any valid thrust, attack and eating mark in the last 60 ticks         |
| Local energy    | `min(15, floor(2 log2(1 + mean energy)))`                                            |
| Stable reserves | Same logarithmic bins applied to mean reserves                                       |

Empty tiles have all-zero symbols. The sampler validates activity incarnation
identifiers and excludes dead cells. Velocity components are clipped at ±128
and accumulated at 1/16-unit resolution; energy uses 1/16 units, reserves 1/4.
The full readback is **36,864 bytes per sample**, independent of population.
Living-cell counts, movements, link density and energy use are included; this is
not a complete account of communication, individual trajectories or morphology.
Cloud pixels are excluded, but the cells' response to clouds can still be learned.

The application splits simulation batches at sample boundaries. Thus switching
between 1×, 8× and Max does not change sample spacing. Pausing measurement or
starting a new world clears its window. An overloaded observer drops its pending
window and starts a fresh one, rather than constructing a trace with missing ticks.

## Fixed observer and data separation

Each estimate uses **32 samples spanning 62 simulated seconds**. The first four
frames are common conditioning information. Frames 4–15 train models; frames
16–23 select one; frames 24–31 measure its final prediction error. The final test
block cannot affect training or selection. Inference may use already observed
prior frames and earlier spatial symbols, as an autoregressive decoder would.

Eleven candidate predictors are fitted with a fixed budget:

- Uniform symbols, or deterministic all-zero symbols.
- Per-channel symbol distributions.
- Persistence after one or four samples.
- A learned cyclic increment after one sample.
- Per-channel transition tables at one- and four-sample lags.
- Current left-neighbor relationships.
- Previous local state plus the current left neighbor.
- Previous local state plus the previous left neighbor.

There is no future-spatial leakage at row boundaries: current-left contexts use
a sentinel. Previous-frame neighbors wrap across the torus. Each table backs
off to its channel distribution. Only overrides that improve training code length
after paying for their parameters are retained. Training likelihood is weighted
by 8/12 to match the selection block's length. This is a specified bounded search,
not exhaustive optimization over all programs or even all possible table subsets.

For each fitted model **M**, selection minimizes:

`modelBits(M) + negativeLog2Likelihood(selectionFrames | M)`

The displayed epiplexity estimate is **modelBits** of the winner. Unpredicted
behavior is its ideal negative log-likelihood on the independent test block,
divided by the number of symbols. The interface separately reports its held-out
advantage or disadvantage against channel averages. Large model size without
predictive advantage should not be read as evidence of useful organization.

Each fit sees 73,728 training symbols; selection and test have 49,152 each.
There are at most 1,632 context rows per candidate. The observer runs in a worker,
uses a bounded 32-frame window, and updates every eight new samples (16 simulated
seconds). Worker queuing is capped; computation and sampling can be disabled.
This is a fixed algorithmic budget, not a measured hardware FLOP budget.

## Explicit model code

`encodeBehaviorModel` and `decodeBehaviorModel` implement a round-trippable binary
code. The reported bits are its exact unpadded length. The shared decoder,
alphabet, channel ordering, dimensions and initial four context frames are
side information common to all candidates. Thus these are **relative model
bits under this observer**, not the shortest standalone program in every language.

The family identifier costs four bits. A probability row uses a two-bit tag:

- Uniform: no further parameters.
- Single peak: four bits for its symbol and twelve for peak probability;
  the remaining probability is shared equally among other symbols.
- Dense: fifteen twelve-bit positive frequencies; the sixteenth is determined
  by the fixed total 4,096.

Copy models encode one twelve-bit match probability per channel; cyclic models
also encode a four-bit increment. Context tables encode their channel baselines,
override count, fixed-width context keys, and override rows. All fitted stochastic
probabilities are positive. Deterministic zero predicts other symbols with zero
probability and therefore loses selection if contradicted. Impossible candidate
losses serialize as `null` in JSON, not as a finite estimate. If the final test
contradicts a selected deterministic-zero model, the interface reports that it
failed to predict unseen behavior rather than displaying a finite error.

Prediction losses are ideal arithmetic-code lengths, not rounded compressed
file sizes. The saved JSON contains the fitted model, packed parameter bytes,
all candidate scores, coarse frames, sample ticks, habitat configuration, shader
fingerprint and recent history, permitting the estimate to be checked independently.

## Shuffled control and calibration

The baseline independently permutes symbols within each channel across all
positions and times in the same window. This preserves each channel's exact
histogram but removes spatial, temporal and cross-channel arrangement. It is
one seeded surrogate, not a significance test or confidence interval. Its model
bits are displayed separately; subtracting it is not presented as the formal
measure.

Calibration uses the same 32-frame, 32 × 32, six-channel format:

| Control                     | Selected model            | Model bits | Test bits / symbol |
| --------------------------- | ------------------------- | ---------: | -----------------: |
| Empty                       | Deterministic zero        |          4 |                  0 |
| Uniform independent noise   | Uniform                   |          4 |                  4 |
| Frozen random map           | Persistence               |         76 |            0.00035 |
| Simple cyclic change        | Cyclic increment          |        100 |            0.00035 |
| Coupled multistate dynamics | Neighbor transition table |     44,571 |            0.00035 |

The coupled control is generated by a **short XOR rule**. The observer does not
contain an XOR primitive, so it learns a larger table. This deliberately shows
observer dependence: the number is not a claim that the generating rule requires
44,571 bits. The grid is relative to world size, so changing world dimensions changes its
physical scale. Population density can also affect which patterns are visible.
Different predictor families, time scales and coarse representations
can change the ranking. Noise and repeated images should not be rewarded merely
for looking complicated.

```sh
node --test tests/epiplexity.test.mjs
node research/epiplexity-calibrate.mjs research/results/epiplexity-calibration.json
node research/gpu-behavior-check.mjs
node research/behavior-run.mjs research/results/behavior-smoke.json 180 42
```

Tests cover controls, unseen-future isolation, shuffle marginals, invalid inputs,
exact parameter-code round trips, GPU state immutability, both state-buffer
parities, stale/dead activity and hue independence. Native GPU tools require the
optional `webgpu` development dependency. Historic five-minute colony snapshots
cannot reconstruct this two-second behavior trace and are not backfilled.
