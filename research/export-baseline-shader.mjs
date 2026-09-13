import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [ref, output] = process.argv.slice(2);
if (!ref || !output)
  throw Error(
    "Usage: node research/export-baseline-shader.mjs GIT_REF OUTPUT.mjs",
  );
const source = execFileSync("git", ["show", `${ref}:web/gpu/shader.js`], {
  encoding: "utf8",
});
const marker = '"./language.js"';
assert.equal(source.split(marker).length, 2);
await writeFile(
  output,
  source.replace(
    marker,
    JSON.stringify(pathToFileURL(resolve("web/gpu/language.js")).href),
  ),
  { flag: "wx" },
);
console.log(
  `Exported ${ref} shader to ${output}; imports current opcode metadata.`,
);
