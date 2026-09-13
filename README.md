# Cell Soup

[Play Cell Soup](https://lcrh.github.io/cellsoup/)

A browser world of evolving, programmable cells. Press **Random new world** to
roll a new mix of ecology, computation and evolutionary mechanisms. Inspect a
cell to read its typed program, memory and energy specialization. Adjust settings
or the function palette to explore a particular idea. Habitat size and population
capacity are independent and stay fixed when you roll another world.

Cells harvest sunlight, scavenge corpses, turn shared reserves into usable
energy, attack, divide, move and connect through spring links. Clouds move slowly;
heat and crowding create ecological costs. An optional lifespan limits survival
even when energy is plentiful; deaths leave edible remains. With specialization enabled, cells
adapt to recent intake and mixing energy pathways reduces efficiency.

Programs can use persistent state, temporal filters, comparisons, ReLU and
Swish, sine/cosine with simulation time, relative neighborhood sensing, filtered target selection and four-channel
communication. Direct neighbors can aggregate broadcasts by mean or sum; optional
attenuated relaying carries information farther. Parents can prepare different
memory and relative headings for their next daughter, and read the full connected
colony size.

Evolution begins with random programs. New arrivals combine fresh random genomes
with previously successful lineages, optional crossover and adjustable mutation
styles. Division mutation is separate. A structural archive can reintroduce
small connected fragments instead of only isolated genomes. No authored creature
is required to start a world.

The [function reference](docs/functions.md), also available in the application,
explains primitives, types and examples.
Its toggles control what can appear in randomly generated programs and mutations.
The basic language, memory, movement and survival/reproduction toolkit stays
enabled; optional features vary between random worlds.
The address bar carries the current world seed and settings, so its link
recreates the starting world. World setup files also preserve settings and the
chosen palette. Settings take effect
when starting a new world; a setup file is not a full simulation checkpoint.

## Run locally

Requires Node.js 20 or newer and a browser with WebGPU.

```sh
npm install
npm run dev
```

Open the local address shown by the server. For a production build:

```sh
npm test
npm run build
npm run dev -- --dist
```

The build is static and deploys to GitHub Pages on pushes to `main`. The former
Classic/WASM application has been retired. Typed trees compile to an internal
bytecode; the bytecode helpers remain implementation details and regression tools.

## Validation and research

`npm test` checks the language, sampling, configuration and observation helpers.
`npm run gpu:check` runs the lifecycle tests on a machine with a working native
WebGPU adapter. Additional GPU feature checks live under `research/`.

Historical experiments retain their source versions and scopes. They are not
claims that large populations, long programs, deep ancestry or compressible
traces establish evolutionary complexity. The new feature palette is intended
for exploration; ecological tuning follows functional integration.
