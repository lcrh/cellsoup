import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { disassemble, OPS } from "../web/language.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match)
      throw Error("Arguments use --name=value. See research/README.md.");
    return [match[1], match[2]];
  }),
);
const allowed = new Set([
  "seed",
  "seconds",
  "sample",
  "floor",
  "rate",
  "share",
  "food",
  "selection",
  "out",
]);
for (const key of Object.keys(args))
  if (!allowed.has(key)) throw Error(`Unknown option ${key}`);
const config = {
  seed: 42,
  seconds: 1800,
  sample: 60,
  floor: 2048,
  rate: 8,
  share: 0.5,
  food: 1,
  selection: 0,
};
for (const key of Object.keys(config)) {
  if (key in args) config[key] = Number(args[key]);
  if (!Number.isFinite(config[key]) || config[key] < 0)
    throw Error(`Invalid ${key}`);
}
for (const key of ["seed", "seconds", "sample", "floor", "rate"])
  if (!Number.isInteger(config[key])) throw Error(`${key} must be integer`);
if (
  config.seconds < 1 ||
  config.sample < 1 ||
  config.seconds > 1e7 ||
  config.share > 1 ||
  config.food > 5 ||
  config.rate > 64 ||
  config.floor > 16384 ||
  config.seed > 2147483647 ||
  ![0, 1].includes(config.selection)
)
  throw Error("Invalid configuration bounds");
await mkdir("research/bin", { recursive: true });
const clang =
  process.env.CLANG ||
  (existsSync("/opt/homebrew/opt/llvm/bin/clang")
    ? "/opt/homebrew/opt/llvm/bin/clang"
    : "clang");
const build = spawnSync(
  clang,
  [
    "-O3",
    ...(process.platform === "darwin"
      ? [
          "-isysroot",
          spawnSync("xcrun", ["--show-sdk-path"], {
            encoding: "utf8",
          }).stdout.trim(),
        ]
      : []),
    "-ffp-contract=off",
    "-fno-builtin",
    "research/headless.c",
    "-lm",
    "-o",
    "research/bin/headless",
  ],
  { stdio: "inherit" },
);
if (build.status !== 0) process.exit(1);
const out = resolve(args.out || `research/runs/seed-${config.seed}`);
await mkdir(out, { recursive: true });
const records = [];
const child = spawn(
  "research/bin/headless",
  Object.values(config).map(String),
  { stdio: ["ignore", "pipe", "inherit"] },
);
let pending = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (data) => {
  pending += data;
  let end;
  while ((end = pending.indexOf("\n")) >= 0) {
    const line = pending.slice(0, end);
    pending = pending.slice(end + 1);
    const record = JSON.parse(line);
    records.push(record);
    if (record.type !== "genome") console.log(line);
  }
});
const code = await new Promise((res, rej) => {
  child.on("error", rej);
  child.on("exit", res);
});
if (code !== 0) throw Error(`Headless engine exited ${code}`);
const genomes = records.filter((r) => r.type === "genome");
for (const g of genomes) {
  const buffer = new ArrayBuffer(g.code.length * 16),
    data = new DataView(buffer);
  g.code.forEach(([op, a, b, c], i) => {
    data.setInt32(i * 16, op, true);
    [a, b, c].forEach((v, k) => data.setFloat32(i * 16 + 4 + k * 4, v, true));
  });
  g.source = disassemble(buffer);
  g.executedOps = Object.fromEntries(
    OPS.map(([name], op) => [
      name,
      g.code.reduce((n, ins, i) => n + (ins[0] === op ? g.visits[i] : 0), 0),
    ]).filter(([, n]) => n),
  );
}
await writeFile(
  `${out}/run.json`,
  JSON.stringify({ config, records }, null, 2) + "\n",
);
const leaders = genomes
  .filter((g) => !g.archived)
  .sort((a, b) => b.living - a.living)
  .slice(0, 12);
await writeFile(
  `${out}/leaders.md`,
  "# Evolved genomes\n\n" +
    leaders
      .map(
        (g) =>
          `## Variant ${g.id}: ${g.living} living, ${g.offspring} offspring\n\nHarvested ${g.harvested.toFixed(2)}; stolen ${g.stolen.toFixed(2)}; mutation depth ${g.depth}.\n\nInstruction visits (not necessarily successful actions): ${JSON.stringify(g.executedOps)}\n\n\`\`\`asm\n${g.source}\n\`\`\`\n`,
      )
      .join("\n"),
);
console.log(`Saved ${out}/run.json and leaders.md`);
