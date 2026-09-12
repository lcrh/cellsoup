# What the complexity proxy must survive

The current direction is to measure **useful dependence on information**, rather
than reward program size, execution-path compression, signal traffic or memory
syntax. The evidence so far rejects collapsing those cheap descriptors into one
complexity score. The expensive causal assays serve as checks on any cheaper
observer we subsequently use for search.

A candidate needs three distinct checks:

1. **Information:** does behavior depend on an input unavailable to a simpler
   controller? For linked signals, substitute the cell's own previous output as
   well as zero and constants. For memory, preserve current input while replacing
   history. Otherwise local recurrence or an arbitrary offset can masquerade as
   information processing.
2. **Cellular effect:** does that dependence change movement, resource use,
   temperature regulation, attack or reproduction? Changed temporary registers
   or outgoing signals alone are insufficient. Examine the value's consumer;
   saturation, discarded values and rejected actions can erase the effect.
3. **Ecological value:** does the effect help establish descendants in fresh
   environments against simpler alternatives, with no continuing immigration?
   Retain ordinary heat and costs. Report environments separately and use new
   seeds for confirmation, rather than selecting one favorable world.

Until these pass, each stage remains an evidence field, not a positive complexity
point. Even passing all three would identify a useful computation, not by itself
prove open-ended complexity. The next scale of evidence is a longer causal chain
or multiple complementary decisions that cannot be replaced by a shorter useful
controller, especially when those computations span cells.

## Current calibration cases

| Case | Information / cellular effect | Stronger control | Interpretation |
| --- | --- | --- | --- |
| Natural light-steerer 31236 | Bearing changes motion and improves short-term energy | Normal ecological heat reverses its reproductive advantage | A real sensor-dependent behavior; short-task score misranks ecology |
| Natural crowding controller 14515 | Density changes affect memory and thrust; deleting the difference detector hurts descendants | Constant forward movement wins four of six assignments; extra delay has mixed effects | Useful in some environments, not a robust improvement over a simpler motor |
| Natural linked-reader 33540 | In the assay it unlinks; forced nonzero readings change temporary registers | Cellular state and lifecycle counts remain identical | Reading syntax does not establish a functional dependency |
| Authored heterogeneous ReLU chain | A distant cell's activation requires signals from other cells | Neither zero input nor self-history reproduces it | Distributed computation is possible; no phenotype or fitness claim |
| Authored homogeneous ReLU chain | Zeroing inputs changes activation | Self-history exactly reproduces the complete recorded signal trajectory | Deletion alone falsely suggests a need for intercellular information |

The authored circuits are calibration controls and never evolutionary founders.
Their presence in the experimental language is not counted as an evolved result.

## The self-history comparison

The three-cell recurrent circuit evaluates
`max(0, local-input + 0.5 * linked-signal)` using the previous tick's published
values. After 30 ticks:

| Inputs | Neighbor mean | Zero input | Own previous signal |
| --- | --- | --- | --- |
| 2, −0.1, −0.1 | 2.25, 0.50, 0.15 | 2, 0, 0 | 4, 0, 0 |
| 1, 1, 1 | 2, 2, 2 | 1, 1, 1 | 2, 2, 2 |

Both zero-intervention implementations—equal-length bytecode replacement and
replacement of the reading in the shader—produce identical recorded states.
For homogeneous inputs, intact and self-history states are identical at **every
recorded tick**, not merely at the final point. All output updates also match an
independent numerical calculation. These results motivate requiring the local
history control, instead of treating a change under zeroing as a complexity gain.
[Complete GPU records](results/linked-signal-context-check.json).

## An observed read that goes nowhere

The first linked-signal world, seed 901, finishes with 117 cells in ten genotypes
containing a new communication expression. The largest, 33540, has 51 cells. Its
read becomes the fraction of a gift whose recipient is `(self)`. The GPU rejects
self-gifts before transferring energy.

In a 120-tick assay, a linked passive partner publishes 100 on channel 3. The
observed program first calls `unlink` on a corpse search. With no corpse present,
the returned zero means unlink all, so the ordinary and zero-input cases become
identical. A further intervention forces the read to 100 despite missing links:
temporary registers differ on 119 of 120 ticks, while every other cell-state word
and every lifecycle counter remains identical. This separates an input actually
reaching the VM from an input influencing the organism. It is a bounded semantic
test, not a general ecological replay.

[Observed-program record](results/observed-linked-noop.json),
[retained source-world bytes](results/linked-worlds/manifest.json).
The retained world collection now includes all six completed worlds. Their
[comparison](experiments/linked-signals.md) has mixed group-movement outcomes and
does not establish a causal advantage from the new communication forms.

## Reproduce

Use the [linked-signal experimental checkout](experiments/linked-signals.md),
copying the updated research scripts and `linked-signal-intervention.mjs`:

```sh
node research/gpu-linked-signal-check.mjs /tmp/linked-context.json
node research/check-observed-linked-noop.mjs research/results/linked-worlds/continuous-linked-variant-901/run.json.gz /tmp/linked-noop.json
```

The intervention helper can select genotype slots for subsequent ecological
competitions; it leaves publication, links, history decay and instruction timing
in place. Selected-cohort use still needs validation in the actual assay. The
whole-circuit controls above change all linked reads.
