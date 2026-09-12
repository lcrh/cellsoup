// Preserve completed source bytes, with hashes, for independent reanalysis.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { join, basename } from "node:path";
const [output, ...directories] = process.argv.slice(2);
if (!output || !directories.length)
  throw Error("Supply destination and completed world directories");
const manifest = [];
for (const directory of directories) {
  const progress = JSON.parse(await readFile(join(directory, "progress.json")));
  assert.equal(progress.complete, true);
  const name = basename(directory);
  await mkdir(join(output, name), { recursive: true });
  for (const file of (await readdir(directory)).sort()) {
    if (!/^(run|progress|observation-\d+)\.json$|^leaders\.md$/.test(file))
      continue;
    const raw = await readFile(join(directory, file)),
      packed = gzipSync(raw, { level: 9 });
    assert.deepEqual(gunzipSync(packed), raw);
    const path = join(name, file + ".gz");
    await writeFile(join(output, path), packed);
    manifest.push({
      path,
      rawBytes: raw.length,
      sha256: createHash("sha256").update(raw).digest("hex"),
    });
  }
}
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Retained ${manifest.length} files from ${directories.length} completed worlds`,
);
