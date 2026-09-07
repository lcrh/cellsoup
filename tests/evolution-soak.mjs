import { engine, spawn, snapshot } from "./helpers.mjs";
import { PRESETS } from "../web/presets.js";
import { assemble, disassemble } from "../web/language.js";
const minutes = Number(process.env.MINUTES || 30),
  seeds = (process.env.SEEDS || "42,97,321").split(",").map(Number);
for (const seed of seeds) {
  const e = await engine(seed);
  e.reset(seed);
  e.configure(24, 8192, 0.05, 1);
  spawn(e, PRESETS.colony.source, 560, 500, 96, 230);
  spawn(e, PRESETS.grazer.source, 1050, 500, 180, 310);
  spawn(e, PRESETS.predator.source, 850, 350, 32, 160);
  e.add_food(560, 500, 20);
  e.add_food(690, 460, 20);
  e.add_food(470, 630, 20);
  const started = performance.now();
  let mutatedReproductions = 0;
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
      mutatedReproductions = Math.max(mutatedReproductions, repro);
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
        }),
      );
    }
  }
  const { stats } = snapshot(e);
  if (stats[8] < 10 || stats[9] < 3 || mutatedReproductions < 1)
    throw Error("No sustained heritable evolution observed");
  console.log(
    `Seed ${seed} passed in ${((performance.now() - started) / 1000).toFixed(1)}s wall time.`,
  );
}
