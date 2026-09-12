import { OPS, SENSORS, FIELDS } from "../web/language.js";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  cpSync,
  writeFileSync,
} from "node:fs";
writeFileSync(
  "src/opcodes.h",
  `// Generated from web/language.js by scripts/build.mjs.\n#define OP_COUNT ${OPS.length}\n#define SENSOR_COUNT ${SENSORS.length}\n#define FIELD_COUNT ${FIELDS.length}\nstatic const char *ARG_TYPES[]={` +
    OPS.map((o) => JSON.stringify(o[1].replaceAll(" ", ""))).join(",") +
    "};\n",
);
const clang =
  process.env.CLANG ||
  (existsSync("/opt/homebrew/opt/llvm/bin/clang")
    ? "/opt/homebrew/opt/llvm/bin/clang"
    : "clang");
const linker =
  process.env.WASM_LD ||
  (existsSync("/opt/homebrew/opt/lld/bin/wasm-ld")
    ? "/opt/homebrew/opt/lld/bin/wasm-ld"
    : null);
const args = [
  "--target=wasm32",
  "-O3",
  "-nostdlib",
  "-fno-builtin",
  "-fvisibility=hidden",
  "src/engine.c",
  "-o",
  "web/engine.wasm",
  "-Wl,--no-entry",
  "-Wl,--export-dynamic",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=33554432",
  "-Wl,--max-memory=33554432",
  "-Wl,-z,stack-size=1048576",
];
if (linker) args.push(`-fuse-ld=${linker}`);
const result = spawnSync(clang, args, { stdio: "inherit" });
if (result.status !== 0) {
  console.error(
    "Install clang and lld (macOS: brew install llvm lld; Ubuntu: apt install clang lld), or set CLANG and WASM_LD.",
  );
  process.exit(1);
}
// Version the whole module graph, including workers and their relative imports.
// An HTML update therefore cannot pick up modules cached from an earlier release.
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const hash = createHash("sha256");
function hashDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) hashDirectory(file);
    else hash.update(file).update("\0").update(readFileSync(file)).update("\0");
  }
}
hash.update(version);
hashDirectory("web");
const assetId = hash.digest("hex").slice(0, 16);
const assetPath = `assets/${assetId}`;
const commit =
  process.env.GITHUB_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).stdout?.trim() ||
  null;
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("web", "dist", { recursive: true });
cpSync("web", `dist/${assetPath}`, { recursive: true });
function publishedHtml(name) {
  return readFileSync(`web/${name}`, "utf8")
    .replace(/(src|href)="\.\/([^" ]+\.(?:js|css))"/g, `$1="./${assetPath}/$2"`)
    .replace(
      '<span class="badge" data-build>development</span>',
      `<span class="badge" data-build title="Assets ${assetId}">v${version}</span>`,
    );
}
const gpuHtml = publishedHtml("gpu.html");
writeFileSync("dist/index.html", gpuHtml);
writeFileSync("dist/gpu.html", gpuHtml);
writeFileSync("dist/classic.html", publishedHtml("classic.html"));
writeFileSync(
  "dist/build.json",
  JSON.stringify({ version, commit, assetId }, null, 2) + "\n",
);
console.log(`Built Cell Soup v${version} (${assetId}) in static dist/.`);
