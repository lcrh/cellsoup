# Cell Soup 0.9.0 — a soup of features

Random new world is the main action and the default startup experience. It rolls
an ecological setting, evolutionary operator mix and function palette. Habitat
width and entity capacity stay under the player's control; capacity now includes
32,768, 65,536, 131,072 and 262,144 entities. Setup files save settings and the
palette, not the live population.

Typed trees are the sole public programming substrate. The Classic laboratory,
its WASM engine and assembly interface have been retired. The static WebGPU build
is the default at both the site root and `gpu.html`.

## Programs and behavior

- Composable entity selection, candidate predicates, field projections and
  relative geometry: for example `(orientation (nearest corpse))` and filtered
  centroids, counts, alignment and separation.
- Four independent linked broadcast channels, mean and sum aggregation, filtered
  publication/reception, and optional attenuated relaying beyond direct links.
- Persistent memory, lag/delta/smoothing expressions, comparisons and lazy
  branches, ReLU and Swish, sine/cosine in radians, and simulation time in seconds.
- `child-set` and `child-turn` prepare state and relative heading changes for the
  next successful daughter. Failed division keeps the pending modifications;
  success consumes them once. Explicit daughter state survives fork mutation.
- `colony-size` returns the total live reciprocal connected component from the
  beginning of the tick, including the querying cell.

The searchable [function reference](functions.md) documents every primitive,
its types and examples. Palette toggles control future generation and mutation;
existing programs retain their semantics.

## Ecology and evolution

Cells can gradually specialize from recent gross intake through photosynthesis,
scavenging and conversion of shared storage. An adjustable normalized-entropy
penalty lowers usable intake when pathways are mixed. Fresh immigrants start
without intake history; division inherits history. Consuming storage or corpse
material debits the full input even when conversion efficiency reduces its yield.

Controls cover evolutionary mutation styles, founder generation, optional body
resampling, computation, broadcasts, temperature, sunlight, action costs and
physical interactions. Manual defaults retain conservative settings; random
worlds explore a bounded subset of the manual ranges. Division mutation remains
separate from resampling mutation. Accumulating fractional instruction costs
makes small configured costs effective instead of rounding every call to zero.

## Practical limits

Nearby sensing is a bounded sample, with configurable radius and candidate
budget. Rejected candidates consume the budget too; a query does not promise
an exhaustive census of a crowded area. Predicate computation is charged and
bounded. Colony size uses a full component calculation rather than that sample.

Fixed GPU resource bounds, simulation timestep and numerical safety limits stay
internal. Links resist crossing but are not rigid barriers. Larger populations,
more query work and connected-component calculation can reduce simulation speed.

Execution-trace compression remains an observation of repetition and ordering,
not a validated measure of intelligence or evolutionary complexity. This release
integrates features; ecological tuning is separate.

## Release validation

The release passed 65 Node tests, including all documented expressions, random
palette generation, evolutionary edits, control coverage and 64k configuration.
Native WebGPU checks passed 52 lifecycle cases, 17 neighborhood/development cases,
15 model-control cases and 12 fork-mutation cases, plus linked communication,
body admission/resampling, execution tracing and specialization lifecycle checks.
The browser preview runs with the new controls. The production build uses a
content-versioned module graph and identical root/`gpu.html` entry points.
