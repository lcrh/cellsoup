# GPU sunlight ecology

The interactive `/gpu.html` prototype runs program execution, physics, evolution and rendering on WebGPU. Typed trees are the default; the [tree world](../research/typed-trees.md) creates and compiles newcomer genomes on the CPU at immigration boundaries. Founders are random programs; division copies genomes exactly, while archived reintroductions have their own mutation control. Programs have eight registers and up to 64 instructions. Division requires its configured cost plus twice the minimum offspring energy, and conserves the remaining usable energy and stores. It keeps a positive energy reserve for each daughter. The default minimum is 12 energy per daughter, so division requires 36 energy including the 12-energy division cost. Cells have up to four reciprocal spring links.

## Energy and storage

Usable energy is cell-local and pays upkeep, proportional decay and actions. Reaching zero kills the cell even if storage remains. Storage is stable and diffuses conservatively across reciprocal links. `store result amount` converts usable energy into storage; `mobilize result amount` converts it back. Both return the actual amount converted. Voluntary spending retains a tiny positive energy reserve. Explicit fractional energy gifts can reach a living target within 18 units, or travel through a reciprocal spring link up to its 65-unit breaking distance. Gifts remain limited by recipient capacity and the donor reserve; attacks still require proximity within 18 units.

Sunlight and energy expenditure heat cells. Cells cool toward ambient temperature, with nearby living cells reducing their cooling rate. Linked cells exchange temperature using the previous tick's values, so exposed cells can conduct heat away from a crowded body. There is no direct crowding energy penalty. Above the configurable safe temperature, heat stress drains usable energy and can kill. Conversion between usable energy and reserves does not itself generate heat. The inspector and temperature view show cell temperature; `sense result temperature`, `sense result linked_temperature` (neighbor mean, zero if none), and `peek result target temperature` expose it to programs. `sense result crowding` reads the local, distance-weighted living-neighbor density.

Sunlight varies under slowly drifting, morphing cloud shadows, with broad penumbrae and rare bright peaks. Peak photosynthesis defaults to 4 energy per second; Bright peak rarity controls how strongly illumination concentrates into those peaks. There are no environmental food drops and no automatic absorption. `photosynthesize result` harvests local sunlight, subject to a per-cell, per-tick limit shared across repeated calls. `gradient bearing strength` senses sunlight in coordinates relative to the cell's heading.

`attack target amount` spends energy to reduce a nearby living target's usable energy. It does not credit the attacker. On death, body material plus stored energy becomes an edible corpse. Corpses decay over 15 simulated minutes by default (configurable), with fractional decay preserved for small remains, and occupy population slots until consumed or decayed. `eat result` chooses a random corpse within 18 units and consumes remains into usable energy, without requiring a scan or target register; competing eaters cannot consume more than the corpse contains.

## Sensing

- `sense result energy` and `sense result storage` read the cell's own pools.
- `sense result linked_storage` reads the sum of connected neighbors' stores.
- `sense result sunlight` reads local illumination.
- `scan_corpse result cone` finds a nearby corpse within a relative viewing cone.
- `peek result target storage` reads stored energy in living targets or edible energy in corpses; the `alive` field distinguishes them.
- `storage_gradient bearing strength kind` senses nearby stored energy: 0 selects living cells, 1 corpses, and -1 both.

The in-page instruction reference documents all 46 operations, including relative motion, color sensing and linked communication. This GPU grammar differs from the classic engine and the historical enzyme model.

## Observation and limits

Click a living cell to inspect its genome, energy and storage. Find colony selects a connected body. Moving colony selects a body of at least four cells whose mean velocity exceeds 2 world units per second; this does not establish purposeful movement. Brown dots are corpses, cyan tails indicate recent thrust, and red traces indicate successful attacks, and gold rings mark successful eating.

The browser starts with 8,192 random founders in 32,768 slots. Capacity can be raised to 262,144 slots, including corpses; density and hardware strongly affect speed. Settings apply when restarting the soup. The thermal pilot exposed a survival bottleneck after the sunlight change; cost and division-threshold assays are recorded separately below. Predation and sustained multicellular movement still need ecological tuning; evolved cooperation has not been established.

Validation includes actual GPU checks for bounded photosynthesis, storage conversion and sharing, starvation despite reserves, paid attacks, finite contested corpse consumption, corpse sensing/decay, cloud continuity, and propulsion through springs. Older throughput measurements and enzyme experiments are preserved in [the historical model](gpu-model-nutrients.md); they are not benchmarks for this sunlight version.

## Thermal pilot

A 180-second autonomous pilot with 2,048 independently random founders in 8,192 slots consumed about 88,704 energy from corpses and produced 930 divisions. At the last sample it had 130 living cells, 171 corpses and one overheated cell. The population remained near its replenishment floor, so this is evidence that scavenging is reachable, not evidence of a self-sustaining diverse ecosystem. Sustained predation and multicellular movement remain open ecological work. [Configuration, shader fingerprint and samples](../research/runs/thermal-pilot-42/run.json) · [Surviving programs](../research/runs/thermal-pilot-42/leaders.md).

## Survival and immigration checks

The headless runner accepts `--close-at=300` to stop both steady immigration and low-population replenishment after five simulated minutes. Output records the closure time, arrival total, starting configuration and final configuration. A population surviving beyond closure can no longer be explained by continued newcomers, although corpses from the initial population can still feed survivors. Continuing reproduction across cloud cycles, energy sources and lineage diversity all matter when interpreting these trials.

Scheduled newcomers reserve available slots before divisions on their arrival tick. This prevents rapidly dividing residents from taking all newly free slots. It does not evict living cells or corpses when capacity is completely occupied.

## Affordable movement assay

Keeping peak photosynthesis at 4, the new defaults lower movement cost from 0.04 to 0.004 per full command, turn cost from 0.001 to 0.0001 per degree, instruction cost from 0.0005 to 0.00005, and minimum offspring energy from 20 to 12. The maximum instruction budget remains 24. These costs let movement and computation compete under moderate light while preserving rapid usable-energy decay.

Each trial starts with 8,192 random founders in 32,768 slots. Steady arrivals and replenishment stop at 300 seconds; the trial continues to 900 seconds.

| Configuration / seed  | Living at closure | Living 10 min later | Births after closure | Moving bodies at end |
| --------------------- | ----------------: | ------------------: | -------------------: | -------------------: |
| thermal-control-42    |               520 |                   0 |                  138 |                    0 |
| affordable-motion-42  |             3,318 |              10,516 |               24,135 |                1,054 |
| affordable-motion-97  |             1,277 |               8,078 |               17,509 |                  511 |
| affordable-motion-321 |             9,326 |               6,204 |               11,567 |                   12 |

All three lower-cost trials retained reproducing populations without further newcomers. Most subsequent harvested energy came from sunlight. Moving bodies are connected groups of at least four cells with mean velocity above 2 units/sec, not proof of coordinated navigation or cooperation. The dominant lineage in seed 42 was an unmutated random founder; selection favored its moving, budding, photosynthetic program. Predation remained sparse. These short trials establish a useful ecological improvement, not open-ended evolution.

[Compact results](../research/results/thermal-survival.json). Full configurations, shader fingerprints, trajectories and surviving programs are in `research/runs/thermal-control-42/` and `research/runs/affordable-motion-{42,97,321}/`. The seed-42 affordable trial preceded the newcomer reservation fix; no sampled state was at capacity, and the other two trials include the fix.

Spring links are soft collision barriers. Cells near a segment are repelled and its endpoints receive opposite, distance-weighted reactions. This respects periodic boundaries and allows occasional fast crossings.
