# Cell Soup 0.9.7 — population pressure and edible remains

The selected **Living population target** is now a soft ecological target.
Births and newcomers can take the living population above it. Instead of
selecting cells for immediate removal, the simulation gives living cells random
energy penalties. A cell dies only when a hit depletes its usable energy.

Penalties start at zero at the target and grow quadratically with the excess.
**Pressure at 10% over target** sets nominal energy loss per cell per simulated
second at 10% above the target. At the base default of 12, the nominal loss is
12 at 10% over, 48 at 20% over, and 300 at 50% over. **Pressure hits / sec**
changes burstiness: fewer, larger hits or more frequent, smaller hits with the
same nominal average. Both settings are randomized by Random new world.
Setting strength to zero disables pressure.

Hits do not depend on links. Connected cells benefit through their existing
shared reserves, which they can explicitly mobilize into usable energy. Stored
reserves do not automatically save a cell whose usable energy reaches zero.

Pressure deaths leave ordinary edible corpses: body material plus stored
reserves. Scavengers can sense and eat them normally. Remains are limited to
at most the target population, with the oldest corpses retired first. Retiring
an existing corpse is not another cell death or an attack kill.

Finite GPU storage imposes a separate hard ceiling of twice the target for
living cells and corpses together. Old corpses make room as the living population
overshoots. If that entire space contains living cells, births and newcomers
wait for room; existing cells are not removed to make space. This resource
ceiling remains even when ecological pressure is disabled.

**Minimum living population** requests the full shortage once per simulated
second, in addition to steady immigration. It works even with the ordinary
newcomer rate set to zero and ignores corpses. Random worlds retain positive
minimums so sunless worlds recover after extinction. Set the minimum to zero
to disable replenishment. Admissions still need available genotype allocations;
the minimum is a replenishment target, not immunity from death between arrivals.

The history panel shows **Pressure deaths**, and the energy-out plot includes
**Population pressure** so the cost is visible independently of upkeep and
attacks. Pressure losses are actual energy debits, capped by each cell's
remaining usable energy; the nominal curve is not a guarantee of realized loss.

Additional entity slots allow living cells and edible remains to coexist.
The largest habitats require higher GPU buffer limits, requested only when
supported. Unsupported sizes fail with a capacity-specific message before
invalid buffers are submitted.

Validation: all 150 unit tests pass, together with native GPU checks for the
pressure curve, hit frequency, death accounting, corpse feeding, replenishment,
body admission and storage ceilings. The largest 262,144 target initialized and
stepped with all optional state enabled and no validation errors. A browser run
reached about 34,200 living cells against a 32,768 target while pressure deaths,
scavenging and energy-flow histories updated without console errors.
