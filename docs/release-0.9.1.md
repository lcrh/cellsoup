# Cell Soup 0.9.1 — survival, protection and renewal

The function palette keeps the basic language, self energy/storage sensing,
memory, movement, energy acquisition and division functions enabled. Random
worlds still vary optional primitives, including richer queries, communication,
temporal filters and oscillators. Protected functions are labelled in the
reference; loading a setup cannot accidentally turn them off.

A configurable lifespan adds death from old age. Zero disables the age limit;
random worlds vary it alongside other ecological settings. Age starts again at
birth, and old-age deaths leave the same edible body material and stored reserves
as other deaths. The limit applies even if the cell still has usable energy.

Attacks have a configurable damage-per-energy conversion and an optional bonus
from closing speed relative to the target. The shield command
spends energy to build a persistent, wearable barrier, with adjustable capacity,
build efficiency, toughness and upkeep. Hits wear through the barrier before
reaching the cell's energy. Barrier strength is visible in the inspector and
as a violet rim; the Barrier color view shows its distribution.

`(resist amount)` braces a cell against motion, paying upkeep while active.
`(resist 0)` releases it. A braced cell can contract its links to pull its neighbors.
Movement thrust, resistance strength and their energy costs are configurable.

A separate arrivals-at-capacity rate keeps introducing the configured mix of
fresh and archive-sampled programs when all entity slots are occupied. It
replaces random residents and reuses their slots immediately. The replaced cell
cannot also leave an extra corpse in the full habitat. New arrivals start with
fresh physiology. The control is separate from ordinary immigration and the
population floor; zero disables replacement. Allocation failure leaves residents
untouched, and a saturated genome pool can limit which victims are eligible.

Random worlds vary these ecological settings while habitat size and entity
capacity remain under the player's control. A new world puts its seed in the
address bar. Opening that URL recreates its starting settings and population;
custom settings travel with the link as overrides. This shares initial conditions,
not a running simulation checkpoint or a promise of identical GPU evolution.

The release passes 76 language/configuration tests and native GPU checks for
aging, barriers, bracing, full-capacity renewal and the existing lifecycle,
communication and evolutionary mechanisms. A screenshot of a naturally evolved
colony also features on the [project homepage](https://lcrh.github.io/).
