import { engine, spawn, snapshot } from "./helpers.mjs";
import { PRESETS } from "../web/presets.js";
import os from "node:os";
console.log(
  `WASM in Node ${process.version} on ${os.cpus()[0].model}; 24 instructions/cell/tick, four seeded patches, 60 Hz target.`,
);
for (const n of [1024, 4096, 8192, 16384]) {
  const e = await engine();
  e.configure(24, n, 0, 1);
  for (let k = 0; k < 4; k++)
    spawn(
      e,
      k % 2 ? PRESETS.grazer.source : PRESETS.colony.source,
      400 + (k % 2) * 800,
      250 + Math.floor(k / 2) * 500,
      n / 4,
      380,
    );
  e.step(60);
  const times = [];
  for (let k = 0; k < 120; k++) {
    const t = performance.now();
    e.step(1);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      seeded: n,
      surviving: snapshot(e).stats[0],
      median_ms: +times[60].toFixed(3),
      p95_ms: +times[114].toFixed(3),
    }),
  );
}
