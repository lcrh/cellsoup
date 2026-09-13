import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  cpSync,
  writeFileSync,
} from "node:fs";
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
writeFileSync(
  "dist/build.json",
  JSON.stringify({ version, commit, assetId }, null, 2) + "\n",
);
console.log(`Built Cell Soup v${version} (${assetId}) in static dist/.`);
