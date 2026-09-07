# Cell Soup

**[Live simulator](https://lcrh.github.io/cellsoup/)** · [Language reference](docs/language.md)

An autonomously evolving artificial-life laboratory inspired by [Turing Soup](https://github.com/lcrh/turingsoup). Small physical cells execute assembly genomes. Food, metabolism, division, spring bonds, communication, and targeted predation connect those programs to a shared ecology.

## Run

The compiled WebAssembly engine is included. No npm dependencies or build step are needed to try it:

```sh
npm start
```

Open **http://localhost:8000**. Node 20 or newer is required for the development scripts. The application itself runs entirely in the browser.

The initial dish mixes branching colonies, wandering grazers, and selective predators. Pause or single-step, inspect a cell, paint food, and seed an edited genome into the running world. Select a variant in Evolution to zoom to a living representative. The Inspector highlights its connected body and reports total body energy; use Focus body or Follow organism to keep it in view across the wrapping world. Scroll to zoom and drag to pan. The World panel controls the instruction budget, population limit, food arrival, mutation, and reset scenario. Space pauses when focus is outside an editing control.

## What is implemented

- A bounded register machine: eight float registers, labels, arithmetic, conditionals, sleeping, 35 instructions, and at most 256 instructions per genome.
- Two fork primitives: `split r0` detaches the daughter; `bud r0` connects it with a spring. Both resume after the fork with 0 in the parent, 1 in the daughter, or -1 on failure.
- Automatic food absorption, diffuse food arriving in blobs, metabolic costs, starvation, recycling, and automatic energy sharing across bonds.
- Soft-disc collisions, damped springs, propulsion, contraction, adhesion, detachment, and a toroidal world.
- Directional neighbor scans, food sensors, target inspection, four local signal channels, public tags, and kinship checks.
- Selective energy theft, costly shields, and targeted energy gifts. Predators can choose individuals or public tags; tags can be imitated.
- Editable examples, genome import/export, individual inspection with live registers and instruction position, organism focus/tracking, population history, and inherited code mutation enabled by default.
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
- `web/presets.js` — five example organisms
- `tests/` — behavior tests against compiled WASM and worker, repeatable benchmark

## Scope

The dish runs autonomously with 5% mutation per birth by default. Mutations change operands, replace instructions, insert instructions, or delete instructions. Successful variants propagate through division; inefficient or sterile descendants face ecological selection. The Evolution panel tracks living variants, ancestry, mutation depth, and offspring counts. Three unattended two-hour simulated runs passed without extinction, reaching 48–200 generations with reproducing mutant descendants. The current benchmark processes 16,384 cells in 2.46 ms per tick on an Apple M4 Pro; this excludes rendering and is not a universal frame-rate guarantee. This is demonstrated heritable evolution from designed founder genomes, not a claim of spontaneous abiogenesis or guaranteed open-ended complexity. Physics and VM execution run on the CPU via WASM; rendering runs on the GPU. Dense local clusters still have expensive neighbor searches. The benchmark reports these limits rather than promising a universal cell count or frame rate.

MIT licensed; see [LICENSE](LICENSE).
