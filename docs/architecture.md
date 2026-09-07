# Architecture and scaling

## Execution path

The main thread owns the editor, interaction, inspector, graph, and WebGL 2 renderer. A dedicated module worker owns a single C engine compiled to WebAssembly. The module has no imports, network calls, allocator, or WASI dependency. Its 32 MiB memory contains fixed cell slots, a free-list, a shared genome pool, spatial buckets, food fields, a 128-entry genome archive, bounded message inboxes, and snapshots.

The worker accumulates elapsed time and advances fixed 1/60-second ticks. Playback speed changes the number of ticks requested, not the physics timestep. Catch-up is limited to 12 ticks per scheduling pass and capped accumulated lag; overloaded devices run slower than requested rather than taking unstable large steps. Paused single-step advances exactly one tick. Max mode ignores wall-time accumulation and executes four-tick chunks for approximately 12 ms per worker pass, then yields for messages. It keeps the fixed timestep and only sends periodic snapshots after at least the selected N ticks (default 60), also bounded to about 30 snapshots/second. Explicit pause/step/reset/inspect updates remain immediate; ACK backpressure still applies.

A tick:

1. Advances an independent seeded OU food source and adds periodic food and, every fourth tick, diffuses and decays the food grid.
2. Rebuilds the spatial hash and absorbs food, charges upkeep, ages cells, decays ambient signals and delivers last tick’s pending linked messages.
3. Executes bounded programs in a rotating order. Children cannot execute in the tick they are created. Sensors see positions indexed at the start of the VM phase; newborns enter neighbor queries after the next grid rebuild.
4. Rebuilds the hash, applies pairwise soft collisions, spring endpoint forces/torques, and conservative bond energy exchange.
5. Removes depleted cells and their bonds, damps and bounds velocities, and integrates positions with periodic boundaries.
6. Every 60 ticks, records newly qualifying reproductive variants and adds steady random/archive arrivals plus at most 64 extra arrivals for low populations. Both operations run inside WASM using the simulation RNG, independent of frame rate and inspection.

The 80 × 50 spatial hash has 20-unit buckets. Queries visit only buckets intersecting the axis-aligned bounds of their actual radius: ten units for collisions and 60 for senses. Exact distance and directional checks filter the candidates. Targeted actions return immediately once their unique in-range ID is found; directional thresholds are calculated once per search. This avoids global all-pairs loops and greatly reduces irrelevant candidates at ordinary densities. Dense clusters still approach quadratic local work. Bond work is bounded by six edges per cell; genomes are shared until a daughter mutates, rather than copied into every cell.

The finer hash changes contact traversal order, so long numerical trajectories can differ from earlier versions. Replay remains deterministic within the same implementation and runtime. Tests compare the optimized nearest-neighbor queries to a brute-force reference at grid boundaries and world seams.

## Rendering and handoff

At most approximately 30 snapshots per second are sent to the page. Normal snapshots wait for an acknowledgment before sending another, preventing an unbounded queue when rendering is slow. Explicit reset/inspect/step requests a fresh snapshot after any in-flight handoff is acknowledged. Paused dishes stop sending unchanged frames. Typed arrays are copied out of WASM and transferred; no SharedArrayBuffer or isolation headers are necessary. Inspecting returns only one cell's registers and inherited program.

WebGL draws circular point sprites in one cell draw call, bonds as instanced lines, and the nutrient grid as a filtered single-channel texture. Food is quantized to bytes only for display; simulation food is float32. CSS supports a side-by-side editor on wide screens and stacked controls on narrow screens. Cells, bonds, and the food field use periodic camera coordinates. A tracked organism stays continuous as its root crosses a world edge. Each bond is translated as a whole so it cannot turn into a spurious line across the screen. The nearest periodic image is drawn; mirrored edge copies are not drawn. Extremely large zoom is limited by the device's supported point-sprite size.

## Measured baseline

`npm run bench` warms up 60 ticks and times 120 individual ticks using the actual WASM engine in Node, with a fixed legacy 0.24/second baseline upkeep fixture, 24-instruction budgets, food arrival enabled, and colony/grazer cells in four seeded patches. It includes physics, sensing, and VM execution. It excludes rendering, snapshot copies, and browser main-thread work. These are short-run measurements, not guarantees for evolved dense colonies, arbitrary genomes, phones, or all browsers.

On an Apple M4 Pro, Node v24.4.1:

| Seeded / surviving cells | Median ms/tick | p95 ms/tick |
| ---: | ---: | ---: |
| 1,024 | 0.047 | 0.096 |
| 4,096 | 0.242 | 0.421 |
| 8,192 | 0.791 | 1.182 |
| 16,384 | 3.253 | 4.307 |

The earlier 40-unit hash measured 16.842 ms median at 16,384 cells on this machine; the current bounded searches are about 5.2 times faster in this benchmark. A 60 Hz tick budget is 16.67 ms. The default population limit is 8,192; 16,384 is available as a stress setting, not promised to sustain 60 Hz. The UI reports the measured worker time per tick as the actual dish evolves. Deterministic replay is tested with the same seed, programs, settings, and operation sequence in the same runtime; cross-browser bit-identical floating-point trajectories are not guaranteed.

## Why CPU WASM first

GPU rendering is already useful for many small cells. A GPU simulation would require more than porting the force loop: variable control flow diverges within GPU execution groups, and births, deaths, bonds, targeted energy transfers, genome mutation, and race-free resource accounting all need explicit parallel algorithms. Keeping the complete model in a small tested CPU core first makes its semantics inspectable and measurable.

If larger populations become the priority:

1. Profile representative evolved/dense workloads; reduce sensor frequency, hash-bucket occupancy and snapshot/inspector churn first.
2. Move hot state to structure-of-arrays storage, reuse transferable buffers, and consider WASM SIMD for food and integration.
3. Add a WebGPU backend for food diffusion, collision broad phase, and forces, keeping the current backend as the compatibility/reference implementation.
4. Introduce staged action intents, parallel conflict resolution and double-buffered energy updates before porting the VM, reproduction, or theft to GPU compute. Specify the changed update semantics and compare against conservation/invariant tests.

No unmeasured GPU-speedup claim is made by this implementation.

## Dependencies and hosting

Runtime assets are all local static files. The checked-in binary can be served immediately; building uses Clang + lld and Node's standard library. GitHub Pages requires no custom response headers because the worker uses transferred snapshots rather than shared memory. See the official [Web Workers documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) and [LLVM WASM linker documentation](https://lld.llvm.org/WebAssembly.html) for the platform mechanisms used here.

## Autonomous evolution verification

The default dish starts with 512 independent random programs, zero division mutation, ±12° daughter heading jitter, 8 steady arrivals/second, a replenishment threshold of 2,048, 50% archive sampling, 80% mutation on resampled arrivals, and 2 energy/second baseline upkeep. `npm run soak` advances three seeds for 30 simulated minutes each with these defaults. It checks finite state, population limits, valid bytecode, arrival/division/death accounting, archive formation and mutated reintroduction, and that all mutations come from resampling.

Behavior tests execute the compiled WASM: energy and fork accounting; bounded archives and genome pools; replay; relative food gradients; circular color filtering; next-tick, per-link mailboxes; an end-to-end weighted ReLU relay; configurable costs; exact-cost action rejection, fractional transfer conservation and capacity, shield shutdown, fed CPU exhaustion, predation and idle starvation; forward/backward and rotational force transfer; collision spacing; and offspring heading jitter. Weather tests check OU mean, variance and lag correlation against the transition law, and verify that VM behavior cannot change the weather RNG. A real worker test exercises Max playback, skipped snapshots, responsive pause and exact single-step.

Verified v0.5 default runs (30 simulated minutes per seed):

| Seed | Final cells | Divisions | Random arrivals | Resampled arrivals | Resampling mutations | Division mutations |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 42 | 853 | 157,671 | 65,922 | 64,190 | 51,242 | 0 |
| 97 | 1,125 | 176,729 | 65,848 | 64,264 | 51,442 | 0 |
| 321 | 813 | 196,702 | 65,548 | 64,564 | 51,766 | 0 |

All archives reached 128 entries, and resampled mutant variants reproduced in all three runs. These measurements include voluntary spending guards and fractional gifts, correlated food, the increased baseline cost, rotating spring attachments, relative sensors and linked communication.

Earlier v0.2–v0.4 measurements describe different founder/arrival/physics settings and are not performance or evolution guarantees for the current ecology. Steady arrivals now continue above the replenishment threshold, allowing continued mutation without division mutation. The threshold is a replenishment target rather than a guaranteed floor; losses can exceed arrivals. The archive explicitly selects reproductive persistence, not intelligence or increasing complexity.

The background worker keeps the page responsive, but browsers may throttle or suspend background tabs. Closing the tab stops the simulation and discards the archive. “Autonomous” means no ongoing user intervention while the simulation runs. The archive copies genomes, not whole connected bodies; individual divisions construct physical organisms.

## Connected-organism inspection

An organism here means the connected component containing the selected cell, including any attached parasites. A read-only breadth-first traversal returns every member once, total stored energy, and spatial bounds unrolled through periodic seams. It does not consume simulation energy, change RNG state, or alter subsequent evolution. Camera framing and following use those bounds; the whole component is highlighted and the selected individual remains distinguished. Dragging or choosing Fit releases the camera. If the selected individual dies, following stops. Genome and cell state remain independently inspectable.
