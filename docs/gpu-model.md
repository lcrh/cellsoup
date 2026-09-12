# Experimental GPU lifecycle and ecology

Status: implemented and running headlessly; **not yet integrated into the interactive page**. This is ongoing work toward the active evolution goal. The classic simulator and its defaults are still available unchanged. The earlier million-cell benchmark is a smaller kernel workload and is not a throughput claim for this complete model.

The browser-compatible modules are `web/gpu/engine.js`, `web/gpu/shader.js` and `web/gpu/language.js`. They use standard WebGPU without Node dependencies. The headless runner provides a Dawn/Metal device using the `webgpu` development dependency. Initial populations are independent random assembly programs. There are no designed founding organisms in the autonomous runs.

## Reproduction and resource economy

Cells have eight numeric registers, a bounded PC and sleep counter, four signal/mail channels, four reciprocal spring attachments, energy, two nutrient reserves and an enzyme allocation. The grammar preserves the existing forty operations and adds `enzyme target`. GPU programs currently have 8–64 random instructions (up to 64 when assembled); this differs from the classic engine's 256-instruction ceiling. New sensory names are `nutrient_a`, `nutrient_b`, `enzyme`, `reserve_a` and `reserve_b`.

Each nutrient is absorbed at `uptakeRate × allocation^exponent`, using the complementary allocation for the other nutrient. The default exponent is 2. Generalists process both at reduced rates; opposite specialists process one efficiently and can exchange reserves through bonds. Allocation moves gradually toward the program's target (default 0.2 per second). Pairs of complementary nutrients convert to the same total amount of stored energy: consuming one unit of each yields two energy. No metabolic energy bonus is created by conversion or by having bonds.

Reserve sharing reads the previous tick's state and transfers a configurable fraction of each bond's reserve difference. With at most four neighbors and exchange at most 0.25, reserves remain nonnegative. Reciprocal edges make this transport conservative apart from floating-point rounding. The default exchange is 0.12 per tick. Unlike the classic engine, these exchanged stores are nutrients; automatic scalar-energy diffusion is not duplicated on top. Explicit fractional energy gifts remain available.

Food comes from multiple correlated wandering sources. Each source deposits both nutrient types in nearby, displaced patches. The OU offset uses its own hash-derived randomness, independent of VM execution. Diffusion and decay occur every four ticks. Weather deposits occur every half second. Fields are capped at 80 units per nutrient per tile; additions beyond this cap are explicitly discarded. Saturating deposit accumulation prevents integer wraparound when a dense group dies or overlapping sources hit the same tile.

The initial experiment uses 24 energy per random arrival, 0.5 energy/second baseline upkeep, and 12 energy per division. A division additionally needs 40 remaining energy, leaving viable daughters. This makes a founder acquire nutrients before its first split. A separate 70-energy experiment tests whether that requirement prevents immediate developmental specialization. The higher endowment has not been chosen as the final default.

Both division operations copy the program without mutation. The split result remains 0 for the parent, 1 for the child and −1 on failure. The daughter inherits registers, phenotype and the continuation, starts with fresh signals/inboxes and age, and receives a bounded heading perturbation. `bud` creates a reciprocal bond; `split` leaves the daughter detached. Children do not execute in the birth tick.

## Parallel settlement rules

The GPU model deliberately uses synchronous phases. It does not claim identical trajectories to the serial C engine.

| Stage | Reads | Writes / ownership |
| --- | --- | --- |
| Clear, weather, field | Prior field and source state | Empty demand tables; per-source weather; per-tile new field |
| Prepare | Frozen cells and reciprocal bonds | Free-slot list, spatial hash, per-tile uptake demand |
| Metabolism / VM | Frozen cells, new food, completed demand totals | Each cell's working state and private action intents |
| Food debit | Completed uptake demands | One owner per food tile |
| Gift plan / apply | Post-VM energies and gift requests | Recipient demand totals; accepted outgoing gifts and incoming credits |
| Theft plan / apply | Post-gift energies and theft requests | Victim demand totals; accepted victim debits and thief credits |
| Lifecycle / physics | Settled ledgers and frozen physical state | Each existing cell, plus uniquely reserved dead slots for daughters |
| Link proposals / acceptance | Completed lifecycle state | At most one winning proposed edge per endpoint |
| Mail / pruning | Stable intents and link state | Per-recipient mail; candidate links, then a separate link commit |
| Genome scan / archive / arrivals | Completed population and genome counters | Free genome list, selected immutable archive copies, unique immigrant slots |

Energy is represented in exact integer quanta of 1/4096, stored in float32 within its exact integer range. Costs round to that quantum; consequently the nominal 0.5/second upkeep is approximately 0.498/second. Voluntary spending retains one quantum; mandatory upkeep and predation can still kill a cell.

Gift and theft demands use two 32-bit integer words with an explicit carry. This avoids overflow when thousands of donors select one recipient. Rationed transfers round down conservatively. Accepted gifts debit and credit exactly the same integer amount. Theft credits 75% after integer rounding, dissipating the remainder. All stages read immutable ledgers from the preceding stage, so a shared victim cannot be spent repeatedly and a full recipient cannot overflow. Unaccepted gifts remain with their donor.

Multiple requests in one VM slice are represented by bounded intents: the last gift, theft, link request and message per channel win. Earlier affordable instruction/action fees remain paid. Division ends the slice. This is an intentional semantic difference from sequential immediate transfers. Gifts settle before theft; newly received gifts can therefore be attacked in that tick.

A link attempt pays its fee when queued against an in-range cell. Contention may prevent the eventual edge from being accepted. Each endpoint accepts at most one proposal per tick, with matching claims on both endpoints. Pruning removes asymmetry and overly stretched edges in a separate commit phase. Spring forces read frozen endpoints, including rotating anchors, so a turn affects neighboring forces on the following tick. Equal-and-opposite endpoint forces, soft repulsion, damping and bounded integration remain in the physical model.

Neighbor references exposed to programs are **ephemeral slot handles** (1…capacity), not permanent identities. Fractional handles are rejected. A dead slot may later refer to another cell. Separate integer incarnation IDs and parent identities remain in the state for observation and lineage tracking. This differs from the classic public-ID semantics and must be explained in the eventual UI. Linked messages arrive after the receiver's VM slice and can be consumed next tick; collisions choose the lowest sender slot. Zero payloads retain a nonzero sender handle.

## Selection and population scale

The default archive gate requires 60 seconds of lineage age, at least eight offspring and 120 absorbed nutrient energy. Candidates compete in 128 hashed founder niches using living family size, offspring and harvested energy; retained scores decay. No points are awarded for bonds, specialized cells or communication. The archive does not by itself establish that any of those traits are adaptive.

Steady arrivals and below-threshold replenishment are configurable. Arrivals select archived programs with probability 0.5 when available; otherwise they receive new random programs. Archived arrivals mutate with probability 0.8. Each current mutation makes an actual operand or opcode change. Insertion/deletion mutations from the classic model have not yet been ported. All mutation remains in this resampling channel, not division.

The current implementation supports up to 262,144 cell slots and 65,536 resident genomes. There are no per-bin occupancy caps or silently discarded neighbors. Extremely dense clusters can still require quadratic local searches. Higher-capacity support and dense-cluster throughput need further work. Genomes and arrays remain on the GPU between ticks; snapshots and genome export are explicit readbacks.

## Verification so far

`npm run gpu:life-check` runs seventeen actual-GPU tests:

- Fractional gifts, donor reserves, full recipients and conservative rationing.
- 18,000 donors generating demand above 32-bit capacity, without overflowing recipient capacity or losing transferred energy.
- Contested theft, a lethal single attack, and consistent population/genome reference counts.
- Division energy accounting, unique slot reservation, capacity rejection, fork results and delayed newborn execution.
- Reciprocal links under contention, unlinking, delayed zero-valued messages and a three-cell weighted ReLU relay.
- Unaffordable movement/shield behavior, finite food competition, gradual enzyme expression and the metabolic benefit of linked complementary specialists.
- Qualified archival and actual mutation on resampling while divisions remain unmutated.

The original simulator tests plus GPU grammar/round-trip/capacity tests total 67 and pass. The grammar extension is opt-in; classic assembly still rejects the new instructions and sensors. `npm run build` still produces the unchanged C/WASM engine plus the new static modules.

The headless runner checks finite cell state, bounded stores, reciprocal living links, population accounting and final per-genome reference counts. It saves configuration, shader fingerprint (newer runs), sampled ecology, leading programs and archived programs. It does not yet record dynamic GPU instruction traces or persistent organism identities.

## Observed autonomous runs

All runs below started from 32,768 independently random programs in 131,072 slots, with 32 food sources and 32 steady arrivals per second. These are ten simulated minutes on an Apple M4 Pro with 20 GPU cores, Node 24.4.1 and Dawn 0.6.0/Metal. Compute timing includes command encoding, submission and completion, but excludes periodic CPU inspection. Raw records and programs are in `research/results/gpu-life/`.

| Seed / starting energy | Final cells | Cells older than a minute | Divisions | Resampling mutations | Largest final body | Compute wall time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 42 / 24, optimized draft | 41,617 | 33,388 | 77,950 | 6,846 | 29 | 60.3 s |
| 97 / 24, earlier draft | 41,297 | 33,403 | 77,664 | 6,821 | 35 | 62.5 s |
| 42 / 70 | 42,165 | 32,999 | 101,944 | 6,945 | 31 | 63.2 s |

An upper-capacity test started 65,536 random founders in 262,144 slots. After two simulated minutes, 38,411 cells remained, 28,382 divisions had occurred, and both population and genome-reference ledgers matched the actual state. It took 21.5 seconds of compute (about 5.6× real time). This validates capacity and short-run operation, not a sustained 262,144-live-cell workload.

The 70-energy run reached a 50-cell connected body at an intermediate sample and ended with three bodies containing both strongly A- and B-specialized cells, totaling 32 cells. The final low-energy runs had none. This is a hypothesis-generating result, not a controlled proof of evolved cooperation: the initial and immigrant energy budgets also changed, and GPU atomic ordering produces nonidentical trajectories. A mixed body may contain unrelated lineages or simply transient specialization. Actual group lifetimes, establishment from a genome, and dependence on nutrient exchange still need assays.

The dominant 70-energy genotype had 291 living members, 1,104 recorded births, 57,024.5 harvested nutrient energy and mutation depth one. Static inspection shows a color-filtered neighbor scan followed by forward motion, detached division and targeted theft. Its initial constant jump bypasses `bud`, so the presence of a budding instruction does not make this a multicellular strategy. No reached turn operation steers it with the computed gradient. This interpretation must be checked with execution traces; it is not a claim of coordinated hunting.

## Work still required for the full goal

- Integrate direct GPU rendering, observation controls, body following, program inspection and a browser fallback, then validate the actual interactive experience.
- Add replayable exported specimens, GPU execution traces and nutrient-specific gradients. Test naturally evolved developmental programs, not only designed fixture pairs.
- Run longer replicated experiments and controlled bond/resource-sharing/message ablations. Distinguish functional multicellularity, spatially mixed communities and incidental connections.
- Profile the complete engine and dense evolved workloads. Preserve conservation and causal semantics while improving throughput. The earlier million-cell partial-kernel result is not a substitute for these measurements.
- Decide the ecological defaults from those results, verify the shipped browser model and publish the completed experience. The overall goal remains active.
