import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const [baselineRoot, controlRoot, output] = process.argv.slice(2);
if (!output)
  throw Error("Supply baseline root, paired-control root and output JSON");
const baseline = await import(
  pathToFileURL(resolve(baselineRoot, "web/gpu/trees.js"))
);
const control = await import(
  pathToFileURL(resolve(controlRoot, "web/gpu/trees.js"))
);
const sha = (x) => createHash("sha256").update(x).digest("hex");
const rngA = baseline.treeRng(1749),
  rngB = control.treeRng(1749),
  hash = createHash("sha256");
for (let i = 0; i < 3000; i++) {
  let a = baseline.randomTree(rngA),
    b = control.randomTree(rngB);
  assert.deepEqual(b, a);
  a = baseline.mutateTree(a, rngA);
  b = control.mutateTree(b, rngB);
  assert.deepEqual(b, a);
  assert.equal(control.compileTree(b).source, baseline.compileTree(a).source);
  hash.update(JSON.stringify(a) + "\n" + control.compileTree(b).source + "\n");
}
const variantShader = await readFile(
  new URL("../web/gpu/shader.js", import.meta.url),
);
assert.deepEqual(
  await readFile(join(controlRoot, "web/gpu/shader.js")),
  variantShader,
);
const report = {
  scope:
    "Paired control reproduces 3000 production random-founder and mutation draws, including compiled source. Experimental control and variant use identical shader source bytes. This is sampler calibration, not a guarantee of bit-identical GPU ecological histories.",
  pairs: 3000,
  seed: 1749,
  drawSha256: hash.digest("hex"),
  shaderFileSha256: sha(variantShader),
  files: {},
};
for (const name of ["trees.js", "shader.js", "engine.js"]) {
  report.files[name] = {
    variant: sha(
      await readFile(new URL("../web/gpu/" + name, import.meta.url)),
    ),
    control: sha(await readFile(join(controlRoot, "web/gpu", name))),
  };
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log("PASS matched control sampler and identical shader");
