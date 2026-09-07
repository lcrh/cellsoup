# Architecture and scaling

## Execution path

The main thread owns the editor, interaction, inspector, graph, and WebGL 2 renderer. A dedicated module worker owns a single C engine compiled to WebAssembly. The module has no imports, network calls, allocator, or WASI dependency. Its 32 MiB memory contains fixed cell slots, a free-list, a shared genome pool, spatial buckets, food fields, a 128-entry archive of copied genomes, and snapshot buffers.

The worker accumulates elapsed time and advances fixed 1/60-second ticks. Playback speed changes the number of ticks requested, not the physics timestep. Catch-up is limited to 12 ticks per scheduling pass and capped accumulated lag; overloaded devices run slower than requested rather than taking unstable large steps. Paused single-step advances exactly one tick.

A tick:

1. Adds periodic food and, every fourth tick, diffuses and decays the food grid.
2. Rebuilds the spatial hash and absorbs food, charges upkeep, ages cells, and decays signals.
3. Executes bounded programs in a rotating order. Children cannot execute in the tick they are created. Sensors see positions indexed at the start of the VM phase; newborns enter neighbor queries after the next grid rebuild.
4. Rebuilds the hash, applies pairwise soft collisions, spring forces, and conservative bond energy exchange.
5. Removes depleted cells and their bonds, damps and bounds velocities, and integrates positions with periodic boundaries.
6. Every 60 ticks, records newly qualifying reproductive variants and replenishes low populations with at most 64 random/archive arrivals. Both operations run inside WASM using the simulation RNG, independent of frame rate and inspection.

The 80 × 50 spatial hash has 20-unit buckets. Queries visit only buckets intersecting the axis-aligned bounds of their actual radius: eight units for collisions and 60 for senses. Exact distance and directional checks filter the candidates. Targeted actions return immediately once their unique in-range ID is found; directional thresholds are calculated once per search. This avoids global all-pairs loops and greatly reduces irrelevant candidates at ordinary densities. Dense clusters still approach quadratic local work. Bond work is bounded by six edges per cell; genomes are shared until a daughter mutates, rather than copied into every cell.

The finer hash changes contact traversal order, so long numerical trajectories can differ from earlier versions. Replay remains deterministic within the same implementation and runtime. Tests compare the optimized nearest-neighbor queries to a brute-force reference at grid boundaries and world seams.

## Rendering and handoff

At most approximately 30 snapshots per second are sent to the page. Normal snapshots wait for an acknowledgment before sending another, preventing an unbounded queue when rendering is slow. Explicit reset/inspect/step requests a fresh snapshot after any in-flight handoff is acknowledged. Paused dishes stop sending unchanged frames. Typed arrays are copied out of WASM and transferred; no SharedArrayBuffer or isolation headers are necessary. Inspecting returns only one cell's registers and inherited program.

WebGL draws circular point sprites in one cell draw call, bonds as instanced lines, and the nutrient grid as a filtered single-channel texture. Food is quantized to bytes only for display; simulation food is float32. CSS supports a side-by-side editor on wide screens and stacked controls on narrow screens. Cells, bonds, and the food field use periodic camera coordinates. A tracked organism stays continuous as its root crosses a world edge. Each bond is translated as a whole so it cannot turn into a spurious line across the screen. The nearest periodic image is drawn; mirrored edge copies are not drawn. Extremely large zoom is limited by the device's supported point-sprite size.

## Measured baseline

`npm run bench` warms up 60 ticks and times 120 individual ticks using the actual WASM engine in Node, with 24-instruction budgets, food arrival enabled, and colony/grazer cells in four seeded patches. It includes physics, sensing, and VM execution. It excludes rendering, snapshot copies, and browser main-thread work. These are short-run measurements, not guarantees for evolved dense colonies, arbitrary genomes, phones, or all browsers.

On an Apple M4 Pro, Node v24.4.1:

| Seeded / surviving cells | Median ms/tick | p95 ms/tick |
| ---: | ---: | ---: |
| 1,024 | 0.042 | 0.093 |
| 4,096 | 0.195 | 0.375 |
| 8,192 | 0.720 | 1.084 |
| 16,384 | 2.539 | 3.283 |

The earlier 40-unit hash measured 16.842 ms median at 16,384 cells on this machine; the current bounded searches are about 6.6 times faster in this benchmark. A 60 Hz tick budget is 16.67 ms. The default population limit is 8,192; 16,384 is available as a stress setting, not promised to sustain 60 Hz. The UI reports the measured worker time per tick as the actual dish evolves. Deterministic replay is tested with the same seed, programs, settings, and operation sequence in the same runtime; cross-browser bit-identical floating-point trajectories are not guaranteed.

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

The default dish starts with 512 independent random programs, 0% division mutation, a replenishment threshold of 2,048, 50% archive sampling, and 80% mutation on resampled arrivals. `npm run soak` advances three seeds for 30 simulated minutes each. It checks finite state, population limits, valid evolved bytecode, exact arrival/division/death accounting, archive formation and mutated reintroduction, and that all mutations come from resampling. Focused WASM tests verify archive qualification, retention after extinction and slot reuse, independent mutation rates, capped replenishment, disabling arrivals, reset, and deterministic replay with different step chunking and inspection frequency.

Verified v0.3 results (30 simulated minutes per seed, default settings):

| Seed | Final cells | Divisions | Random arrivals | Resampled arrivals | Resampling mutations | Division mutations |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 42 | 903 | 187,553 | 54,723 | 53,448 | 42,861 | 0 |
| 97 | 1,070 | 191,943 | 57,177 | 56,787 | 45,621 | 0 |
| 321 | 2,552 | 22,826 | 2,165 | 1,100 | 857 | 0 |

All three archives reached 128 entries, and resampled mutant variants produced offspring. Seed 321 stayed above the replenishment threshold after about ten minutes, so further mutations stopped, as specified with 0% division mutation. The threshold is a replenishment target, not a guaranteed population floor: losses can exceed the 64 arrivals/second limit. These runs demonstrate the sampling mechanism, not guaranteed continuous novelty or increasing complexity.

The earlier v0.2 authored-founder scenario was tested for two simulated hours per seed, reaching 48–200 generations with 5% division mutation. Those results describe that older scenario, not the new random-start default. The fixed benchmark above continues using authored colony/grazer programs for comparable performance measurements.

The background worker keeps the page responsive, but browsers may throttle or suspend background tabs. Closing the tab stops the simulation and discards the archive. “Autonomous” means no ongoing user intervention while the simulation runs, not an external always-on service. The archive copies genomes, not whole connected organisms; individual divisions still create all physical bodies in the running world.

## Connected-organism inspection

An organism here means the connected component containing the selected cell, including any attached parasites. A read-only breadth-first traversal returns every member once, total stored energy, and spatial bounds unrolled through periodic seams. It does not consume simulation energy, change RNG state, or alter subsequent evolution. Camera framing and following use those bounds; the whole component is highlighted and the selected individual remains distinguished. Dragging or choosing Fit releases the camera. If the selected individual dies, following stops. Genome and cell state remain independently inspectable.
