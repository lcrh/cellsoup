# Runtime admission of saved bodies

This prototype starts from `7403e79`, without the linked-signal, temporal-expression
or compiler-cadence patches. It adds a host-side admission method; production and
the automatic resampling policy remain unchanged.

The [earlier fragment experiments](../propagule-experiments.md) found a concrete
resampling bottleneck: a naturally generated giving program can establish much
better when its initial links survive. A genome-only archive discards that
structure. The prototype supplies the insertion mechanism needed to test a
structural archive in an autonomous world.

## Admission contract

`engine.admitBody({programs, cells})` admits up to 64 cells as one batch. Each
program contains a typed `tree` and may contain an `origin` with the source tree,
serial, founder and mutation depth. Each cell specifies a local program index,
position, heading, energy, stores, spring rest factor, four positional link slots
and anchors. Nonzero link handles address cells within the submitted body, are
reciprocal, and cannot include self-links or duplicate neighbors.

Positions and headings wrap into the world. Link-slot holes and anchors survive.
Each cell starts with zero velocity, age, generation, tag, registers, messages,
memory and program phase, at ambient temperature. Energy and stores are explicit
and bounded; this is a fresh arrival, not an exact restart. Source values are
copied; no source organism is moved or removed. Biology hue uses the source
founder's existing hash rule unless an explicit initial color is supplied.

The method allocates free cell and genome slots, never living cells or corpses.
It validates the complete request before writing. Insufficient room returns zero
admissions without partial insertion or altered counters. Engine stepping and
admission cannot interleave. New identities, references, arrival totals and
ancestry are assigned consistently, and recycled slots have their private memory
and activity marks cleared. Existing archived genotypes remain available after
their live slots recycle.

Cells sharing one submitted program share the new genotype. An unchanged source
preserves mutation depth; a changed tree increments it once for that genotype,
not once per clone. Source-backed cells count as sampled arrivals; cells without
an origin count as fresh arrivals. They are not divisions. This prototype accepts
one source parent per submitted program; a crossover policy is not implemented
here. Ordinary engine division and ordinary arrival crossover are unchanged.

The method adds no automatic arrivals or selection preference. A future caller
must charge body members against its existing arrival and imported-energy budget.
It currently reads the cell state and genome references for each admission. That
is suitable for these mechanics tests; batching/capture frequency must be measured
before making it a default mechanism at large populations.

## Validation

The modified engine passes all 97 existing Node tests and all 52 existing GPU
lifecycle checks. Dedicated GPU checks cover preserved seam geometry and link
slots, untouched residents/corpses, source ancestry, mutation accounting, fresh
state, actual execution after insertion, exhausted cell/genome capacity, malformed
input with no writes, operation serialization, and archived-tree survival after
genotype-slot recycling followed by ordinary immigration.

Nine regrowth cases reuse previously captured eight-cell fragments of natural
genotype 15333. An empty world first runs for 60 ticks, then receives the fragment
with 96 total local energy and zero stores. Light is constant at 0.6; ordinary
heat, costs and division rules remain. No further immigrants or mutations occur.
The three-minute results are:

| Capture seed | Connected: living / births | Same cells unlinked | Same links, gifts disabled |
| --- | ---: | ---: | ---: |
| 42 | 2,622 / 2,647 | 8 / 0 | 8 / 0 |
| 97 | 3,756 / 3,796 | 8 / 0 | 8 / 0 |
| 321 | 4,096 / 4,139 | 8 / 0 | 8 / 0 |

Births can exceed final living counts because some descendants die. The final
seed-321 population reaches capacity, so it is not an unconstrained growth-rate
estimate. All cases check the population ledger, genome references and finite
state. This reproduces a known cooperative advantage through the new runtime
admission path. It is not evidence of autonomous group selection, newly evolved
cooperation, or a general increase in complexity.

## Next experiment

Capture bounded fragments from qualifying live populations, retain their source
programs and geometry, and compare structural reintroduction with the same cells
and energy reintroduced without links. Keep random founders and random arrivals;
account for individual cells, not bodies, when matching immigration budgets.
Mutation should remain associated with resampling and be shared by cells that
share a genotype. Group sampling, archive capacity, crossover semantics and
capture overhead still need implementation and validation. No new selection
policy or public default is promoted by these admission tests.

## Reproduce

Apply [body-arrivals.patch](body-arrivals.patch) to a disposable checkout of
`7403e79`. Copy the current research scripts and existing fragment helpers:

```sh
npm test
node research/gpu-life-check.mjs
node research/gpu-body-arrival-check.mjs /tmp/body-check.json
node research/body-arrival-regrowth.mjs research/results/colony-fragment-linked-gifts.json /tmp/body-regrowth.json
```

[Admission checks](../results/body-arrival-check.json),
[regrowth records](../results/body-arrival-regrowth.json).
