# Cell Soup 0.9.6 — births under population pressure

Reaching entity capacity no longer blocks an otherwise valid division. The
parent pays the normal division cost, splits its remaining energy and reserves,
and creates its daughter. If the resulting population exceeds the limit, cells
are removed with probability biased toward low usable energy until it fits.
Both parent and daughter compete using their energy **after** division. A
daughter culled immediately still counts as a birth and a capacity death.
Insufficient energy and a full set of links for budding remain immediate
failures; population capacity is no longer one of those failures.

The ordinary newcomer stream continues at capacity. A separate adjustable
**Extra newcomers at capacity / sec** adds pressure when the habitat is full.
Its base default rises from 4 to 64; randomized worlds use 16–128 at 32k capacity,
scaled with habitat capacity up to 1,024. Setting this extra rate to zero leaves
the ordinary newcomer stream running. Newcomers receive no exemption from
culling. The existing independent genotype allocation limit still applies.

Selection is stochastic, with inverse usable-energy weights. It does not use
stored reserves, and high-energy cells are less likely to die rather than
immune. Corpses have no usable energy and use the small positive energy floor,
so they are usually reclaimed before living cells regardless of nutrient value.
The cap continues to count living cells plus corpses; a capacity removal
recycles the entity outright instead of leaving another occupied corpse slot.
Normal starvation, heat, attacks, and old age still leave corpses as before.

Birth candidates and normal newcomer batches compete together before the next
physics tick. Very large multicellular newcomer batches are processed in bounded
groups; later groups compete with the survivors of earlier ones. Temporary
candidate space is internal and does not change the selected habitat size or
the final entity limit.

The history panel now plots **capacity deaths** separately from attacks and
confirmed attack kills. Energy discarded by capacity removal appears under
**Death & replacement** in the usable-energy budget.

Validation covers weighted selection, division at capacity, newcomer batches,
inherited state, link remapping, genotype exhaustion, and energy accounting.
A browser run reached 32,768 living cells and continued dividing while capacity
deaths increased, without console errors. All 146 unit tests pass.

The extra GPU selection and materialization passes have a cost. In a native
Metal benchmark with no births or arrivals, median time for 120 ticks rose
from 231 to 284 ms at 32k cells and from 745 to 813 ms at 64k cells, compared
with 0.9.5 (three alternating pairs, after 60 warmup ticks, no renderer).
This is a narrow overhead measurement, not a prediction for every evolving world.
