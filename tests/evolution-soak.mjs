import { engine, snapshot } from "./helpers.mjs";
import { assemble, disassemble } from "../web/language.js";
const minutes = Number(process.env.MINUTES || 30),
  seeds = (process.env.SEEDS || "42,97,321").split(",").map(Number);
for (const seed of seeds) {
  const e = await engine(seed);
  e.reset(seed);
  e.configure(24, 8192, 0, 1);
  e.set_cost(0, 2);
  e.configure_arrivals(2048, 0.5, 0.8, 8);
  e.seed_random(512);
  const started = performance.now();
  for (let second = 0; second < minutes * 60; second += 10) {
    e.step(600);
    const { stats, cells } = snapshot(e);
    if (!cells.every(Number.isFinite)) throw Error("Non-finite cell state");
    if (!stats[0]) throw Error(`Seed ${seed}: extinct at ${second + 10}s`);
    if (stats[0] > 8192) throw Error("Population limit exceeded");
    if ((second + 10) % 300 === 0) {
      let repro = 0;
      for (let g = 0; g < 2048; g++) {
        const len = e.genome_len(g);
        if (!len) continue;
        const code = new Uint8Array(
          e.memory.buffer,
          e.genome_ptr(g),
          len * 16,
        ).slice().buffer;
        assemble(disassemble(code));
      }
      const lineages = new Float32Array(
        e.memory.buffer,
        e.lineages_ptr(),
        stats[16] * 12,
      );
      for (let k = 0; k < lineages.length; k += 12)
        if (lineages[k + 6] > 0) repro += lineages[k + 4];
      console.log(
        JSON.stringify({
          seed,
          minutes: (second + 10) / 60,
          cells: stats[0],
          births: stats[2],
          deaths: stats[3],
          variants: stats[7],
          mutations: stats[8],
          generation: stats[9],
          mutationDepth: stats[10],
          mutantOffspring: repro,
          randomArrivals: stats[17],
          resampledArrivals: stats[18],
          archive: stats[19],
          resamplingMutations: stats[20],
          divisionMutations: stats[21],
        }),
      );
    }
  }
  const { stats } = snapshot(e);
  if (stats[21] !== 0 || stats[20] !== stats[8])
    throw Error("Default mutation must come exclusively from resampling");
  if (stats[17] + stats[18] + stats[2] - stats[3] !== stats[0])
    throw Error("Arrival / division accounting mismatch");
  if (stats[19] < 1 || stats[18] < 1 || stats[20] < 1)
    throw Error("No successful archive and mutated reintroduction observed");
  console.log(
    `Seed ${seed} passed in ${((performance.now() - started) / 1000).toFixed(1)}s wall time.`,
  );
}
