import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
const dirs = process.argv.slice(2);
if (!dirs.length)
  throw Error("Pass one or more structure audit result directories");
const fields = [
  "living",
  "cellsIn4",
  "cellsIn16",
  "branches",
  "largestBody",
  "movingBodiesWithRecentThrust",
  "movingBodyCellsWithRecentThrust",
  "establishedGenomeSlots",
];
const rows = [];
for (const dir of dirs) {
  for (const file of (await readdir(dir)).filter((x) =>
    /^\d+\.json$/.test(x),
  )) {
    const run = JSON.parse(await readFile(join(dir, file), "utf8"));
    if (!run.complete) throw Error(`Incomplete run: ${join(dir, file)}`);
    const end = run.records.at(-1).second;
    const late = run.records.filter((r) => r.second >= end / 2);
    // Early audit captures used a looser label for the same slot count.
    for (const r of late) r.establishedGenomeSlots ??= r.establishedGenotypes;
    const mean = (key) =>
      late.reduce((sum, r) => sum + r[key], 0) / late.length;
    rows.push({
      mode: run.mode,
      seed: run.config.seed,
      seconds: end,
      samples: late.length,
      ...Object.fromEntries(
        fields.map((key) => [key, Math.round(mean(key) * 10) / 10]),
      ),
      fractionInBodiesAtLeast4:
        late.reduce(
          (sum, r) => sum + (r.living ? r.cellsIn4 / r.living : 0),
          0,
        ) / late.length,
    });
  }
}
console.log(
  JSON.stringify(
    {
      note: "Means over the second half of each complete run. Counts of structure and motion are descriptors, not a complexity or cooperation score. Established genome slots may contain duplicate programs. Compare equal durations and settings.",
      rows,
    },
    null,
    2,
  ),
);
