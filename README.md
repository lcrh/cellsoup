# Cell Soup

**[GPU ecology](https://lcrh.github.io/cellsoup/gpu.html)** · [Classic laboratory](https://lcrh.github.io/cellsoup/) · [Language reference](docs/language.md)

An autonomously evolving artificial-life laboratory inspired by [Turing Soup](https://github.com/lcrh/turingsoup). Small physical cells execute programmable genomes. Food, metabolism, division, spring bonds, communication, and targeted predation connect those programs to a shared ecology.

## Large-population GPU ecology

Open **[GPU ecology](https://lcrh.github.io/cellsoup/gpu.html)** (locally `/gpu.html`) for the experimental large-population simulation. It supports up to **262,144 slots and 65,536 resident genomes**. Slots include living cells and slowly decaying edible corpses. Typed Lisp trees are the default. Physics, compiled program execution, sunlight, birth/death, attacks and archive selection run on WebGPU; new tree genomes are generated and compiled on the CPU at immigration boundaries. Assembly remains selectable.

The browser default starts with 8,192 independent random founders in 32,768 slots. Cells explicitly photosynthesize under slowly moving cloud shadows. They have rapidly decaying, cell-local usable energy and stable storage that diffuses across spring links. Programs must mobilize reserves before usable energy runs out. Attacks damage energy; stored reserves become part of the victim's edible corpse. Sunlight and activity generate heat; crowding slows cooling, links conduct heat, and overheating drains usable energy. Division copies genomes exactly; mutation remains concentrated in archived reintroductions. Links also act as soft barriers: nearby cells are repelled from link segments, with the opposite force shared by their endpoints. Collisions wrap across world edges; sufficiently fast or crowded cells may occasionally pass through.

Use **Find colony**, **Moving colony**, **Follow**, and the energy/storage/activity/temperature color views to observe bodies. Click cells to inspect their programs, ancestry, pools and age. Brown dots are corpses, cyan tails mark recent thrust, red traces mark successful attacks, gold rings mark eating, and green arrows show completed energy gifts. Settings take effect when starting a new soup.

This sunlight model is a working prototype. Three earlier assembly trials sustained thousands of reproducing cells for ten simulated minutes after newcomers stopped; moving connected groups emerged in each. The named-state tree grammar has since completed three one-hour continuous evolution runs. One naturally generated genotype showed a reproducible growth advantage from giving energy in controlled regrowth tests; this does not establish general evolved cooperation. Predation remains uncommon. Performance depends strongly on density and hardware; older nutrient-model speed measurements do not apply to this version. [Current GPU model](docs/gpu-model.md) · [Historical nutrient model and measurements](docs/gpu-model-nutrients.md) · [Headless experiments](research/README.md).

Version 0.8.3 adds a live **behavioral epiplexity estimate**: model-description bits from a bounded predictor of whole-world behavior, separate held-out prediction error, a shuffled baseline, and exportable recordings. [Measurement method and limitations](docs/behavioral-epiplexity.md) · [Release notes](docs/release-0.8.3.md).

Version 0.8.2 lets explicit energy gifts travel along reciprocal links, including stretched links outside the ordinary 18-unit contact range. Random founders, single-cell archive arrivals and exact-copy division remain the defaults. [Release notes](docs/release-0.8.2.md) · [Controlled colony regrowth experiments](research/propagule-experiments.md).

## Run the classic laboratory

The compiled WebAssembly engine is included. No npm dependencies or build step are needed to try it:

```sh
npm start
```

Open **http://localhost:8000**. Node 20 or newer is required for the development scripts. The application itself runs entirely in the browser.

The default dish starts with 512 independently random programs. A steady trickle of 8 arrivals per second, plus extra replenishment below 2,048 cells, draws either fresh random genomes or genomes from an archive of past reproductive successes. Resampled arrivals mutate at 80% by default; ordinary division has 0% mutation. Both rates and the random/archive mixture are independent controls. Authored organisms remain optional editor examples and reset scenarios. Pause or single-step, inspect a cell, paint food, and seed an edited genome into the running world. Select a variant in Evolution to zoom to a living representative. The Inspector highlights its connected body and reports total body energy; use Focus body or Follow organism to keep it in view across the wrapping world. Scroll to zoom and drag to pan. The World panel controls the instruction budget, population limit, food arrival, mutation, and reset scenario. Space pauses when focus is outside an editing control.

Max playback runs the worker as fast as possible while drawing only after the chosen number of simulation ticks. World controls also include separate energy costs, daughter heading jitter, and food wandering/amount variability. Baseline upkeep is 2 energy/second, so an idle, unfed cell lasts roughly 35 seconds. Voluntary spending retains 0.001 energy; unaffordable instructions/actions are skipped and unaffordable shields switch off. `give id fraction` donates a fraction of current energy (0–1), capped by receiver capacity and the donor reserve. Food drops follow correlated Ornstein–Uhlenbeck motion and amount fluctuations. The optional ReLU relay shows how linked cells can compute weighted activations with ordinary assembly.

## Classic model features

- A bounded register machine: eight float registers, labels, arithmetic, conditionals, sleeping, 40 instructions, and at most 256 instructions per genome.
- Two fork primitives: `split r0` detaches the daughter; `bud r0` connects it with a spring. Both resume after the fork with 0 in the parent, 1 in the daughter, or -1 on failure.
- Automatic food absorption, diffuse food arriving in blobs, metabolic costs, starvation, recycling, and automatic energy sharing across bonds.
- Spaced soft-disc collisions, visible springs with rotating attachment points, forward/backward propulsion, relative turns, contraction, and a toroidal world.
- Relative food gradients, tunable hue matching, neighbor inspection, local signals, linked next-tick messages, public tags, and kinship checks. No absolute compass sensor.
- Selective energy theft, costly shields, and targeted energy gifts. Predators can choose individuals or public tags; tags can be imitated.
- Editable examples, genome import/export, individual inspection with live registers and instruction position, organism focus/tracking, population history, random founders, a bounded success archive, and independently controlled resampling/division mutation.
- A C/WASM simulation in a dedicated worker and WebGL 2 rendering. Fixed 32 MiB WASM memory; up to 16,384 live cells, six bonds per cell, and 2,048 simultaneously retained genomes.

See [the language specification](docs/language.md) for exact semantics and [the architecture notes](docs/architecture.md) for scheduling, performance, limits, and the GPU migration path.

## Build and test

Building requires Clang and the LLVM WebAssembly linker:

```sh
# macOS
brew install llvm lld
# Ubuntu / Debian
sudo apt-get install clang lld

npm run build
npm test
npm run bench
npm run soak # three unattended 30-minute simulated runs
```

Set `CLANG` and `WASM_LD` if the compiler and linker are installed elsewhere. `npm run build` refreshes `web/engine.wasm` and creates the completely static `dist/` output. Keep the WASM binary committed so a checkout can run immediately. `npm test` executes the actual WASM binary in Node, plus assembler and worker integration tests; rebuild after changing C.

## GitHub Pages

The included `.github/workflows/pages.yml` builds and tests on pushes to `main`, then publishes `dist/` using GitHub Pages Actions. After creating the GitHub remote and pushing, choose **Settings → Pages → Build and deployment → Source: GitHub Actions**. This repository is prepared for that flow; a local checkout alone does not create a hosted GitHub repository or live Pages URL.

All asset URLs are relative, so project pages such as `/cellsoup/` work. No backend, service worker, SharedArrayBuffer, cross-origin isolation headers, CDN scripts, or external fonts are required. To verify the packaged output locally:

```sh
PORT=8001 node scripts/serve.mjs --dist
```

## Project layout

- `src/engine.c` — simulation, cell VM, fixed memory, rendering snapshots, WASM ABI
- `web/language.js` — opcode schema, validating assembler, disassembler
- `web/worker.js` — fixed-step scheduling, simulation commands, bounded snapshot handoff
- `web/renderer.js` — GPU cell discs, spring lines, diffuse food texture
- `web/app.js` — controls, editor, inspector, graphs, mouse/touch interaction
- `web/gpu/` and `web/gpu.html` — full WebGPU engine, ecology, direct renderer and observation UI
- `research/` — headless assays, GPU checks and measured autonomous runs
- `web/presets.js` — optional example organisms and a linked ReLU relay
- `tests/` — behavior tests against compiled WASM and worker, repeatable benchmark

## Scope

Fresh random programs contain 8–64 well-typed instructions sampled from all 40 opcodes, with random operands and branches. They contain no authored reproduction or survival template. Division inherits the parent's program; mutations are concentrated at archive reintroduction by default. Every simulated second, steady arrivals continue regardless of the replenishment threshold, plus up to 64 extra arrivals if below it. The hard population and genome-storage limits still apply. The default mixture is 50% archive / 50% random; an empty archive falls back to random. Set both the steady arrival rate and replenishment threshold to zero to disable arrivals.

The archive holds up to 128 variant genomes that have produced at least three direct offspring and still have living members ten seconds after introduction. Reservoir sampling retains a uniform sample of all variants that have qualified; arrivals sample retained entries uniformly. Reintroduced cells start with fresh state and energy, with no copied bonds or body structure. Reset clears the archive. This is an explicit reproduction-based sampling rule, not a guarantee of increasing complexity. See the language reference for identity, mutation, and resource accounting.

In the classic laboratory, physics and VM execution run on the CPU via WASM; rendering runs on the GPU. The measured benchmark processes 16,384 cells in 3.25 ms per tick on an Apple M4 Pro, excluding rendering. Dense local clusters can be expensive; this is not a universal frame-rate guarantee.

MIT licensed; see [LICENSE](LICENSE).

## Research in progress

The [evolution and scaling laboratory](research/README.md) contains a native headless client, exported evolved programs, ecological ablations, and a separately validated WebGPU scaling prototype. The prototype is not yet the live ecology backend; its measurements and remaining work are documented explicitly.

The [typed-tree world](research/typed-trees.md) is now the default at `/gpu.html`. Assembly remains available under **Genome language**. It runs autonomous random tree populations, archives successful genomes, and supports separate crossover and resampling-mutation sliders. Named `state`, `let`, and `set!` forms support iterated computation. Division copies genomes and memory exactly. Trees remain experimental: the first closed-population comparison retained fewer cells than assembly.

The GPU page now shows [execution-trace compression and candidate complexity cross-checks](docs/execution-traces.md). The coarse observer is off by default. Raw instruction paths and their programs can be downloaded as compressed JSON for inspection.
