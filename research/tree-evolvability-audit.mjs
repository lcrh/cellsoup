import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const settingsPath = resolve(process.argv[3] || "web/gpu/random-world.js");
const { worldSettingsForSeed } = await import(pathToFileURL(settingsPath));

// Read-only historical comparison. Instrument private copies to count rejected
// compiler candidates without changing RNG draws or the production sampler.
async function load(revision) {
  const dir = await mkdtemp(join(tmpdir(), "cellsoup-tree-audit-"));
  await mkdir(join(dir, "web/gpu"), { recursive: true });
  await writeFile(join(dir, "package.json"), '{"type":"module"}');
  for (const file of [
    "web/language.js",
    "web/gpu/language.js",
    "web/gpu/trees.js",
  ]) {
    let source =
      revision === "working"
        ? await readFile(resolve(file), "utf8")
        : execFileSync("git", ["show", `${revision}:${file}`], {
            encoding: "utf8",
          });
    if (file.endsWith("trees.js")) {
      const start = source.indexOf("export function randomTree("),
        end = source.indexOf("export function", start + 20);
      let part = source.slice(start, end);
      part = part.replace(
        "compileTree(t);",
        "audit.attempts++; compileTree(t);",
      );
      part = part.replace(
        "} catch (e) {",
        '} catch (e) { const reason=e.message.split("\\n")[0]; audit.rejections[reason]=(audit.rejections[reason]||0)+1;',
      );
      source =
        source.slice(0, start) +
        part +
        source.slice(end) +
        "\nexport const audit={attempts:0,rejections:{}};\n";
    }
    await writeFile(join(dir, file), source);
  }
  return import(pathToFileURL(join(dir, "web/gpu/trees.js")));
}
const current = await load("working"),
  previous = await load("bdc6bac");
const full = {
  neighborhoodWeight: 1,
  developmentWeight: 1,
  temporalWeight: 1,
  communicationWeight: 1,
  activationWeight: 1,
  memoryBias: 1,
  mutationOrdinary: 1,
  mutationLocal: 1,
  mutationPoint: 1,
  mutationGuard: 1,
  mutationInsertion: 1,
};
const report = {
  settingsSource: {
    path: settingsPath,
    sha256: createHash("sha256")
      .update(await readFile(settingsPath))
      .digest("hex"),
  },
  revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  samples: [],
};
function visit(tree, out = []) {
  out.push(tree.op);
  for (const t of tree.args) visit(t, out);
  return out;
}
function sample(name, language, settings, count = 10000) {
  const rng = language.treeRng(87654),
    result = {
      name,
      count,
      failed: 0,
      meanNodes: 0,
      meanInstructions: 0,
      over24Instructions: 0,
      presence: {},
      joint: {},
      mutationsFailed: 0,
      mutationLostBud: 0,
      mutationRetainedBud: 0,
      mutationUnchanged: 0,
      opOccurrences: {},
    };
  const before = language.audit.attempts,
    rejects = { ...language.audit.rejections };
  for (let i = 0; i < count; i++) {
    const cfg = typeof settings === "function" ? settings(i) : settings;
    let tree;
    try {
      tree = language.randomTree(rng, 32, cfg);
    } catch (error) {
      result.failed++;
      continue;
    }
    const ops = visit(tree),
      seen = new Set(ops),
      code = language.compileTree(tree);
    result.meanNodes += ops.length;
    result.meanInstructions += code.length;
    result.over24Instructions += Number(code.length > 24);
    for (const op of ops)
      result.opOccurrences[op] = (result.opOccurrences[op] || 0) + 1;
    for (const op of seen) result.presence[op] = (result.presence[op] || 0) + 1;
    for (const group of [
      ["bud", "photosynthesize"],
      ["bud", "move"],
      ["bud", "photosynthesize", "move"],
      ["bud", "contract"],
      ["bud", "if"],
    ])
      if (group.every((op) => seen.has(op)))
        result.joint[group.join("+")] =
          (result.joint[group.join("+")] || 0) + 1;
    if (i < 2000)
      try {
        const mutant = language.mutateTree(tree, rng, cfg),
          mutated = new Set(visit(mutant));
        result.mutationUnchanged += Number(
          language.printTree(tree) === language.printTree(mutant),
        );
        if (seen.has("bud"))
          result[
            mutated.has("bud") ? "mutationRetainedBud" : "mutationLostBud"
          ]++;
        language.compileTree(mutant);
      } catch (error) {
        result.mutationsFailed++;
      }
  }
  result.meanNodes /= count - result.failed;
  result.meanInstructions /= count - result.failed;
  result.compilerAttempts = language.audit.attempts - before;
  result.compilerRejects = Object.fromEntries(
    Object.entries(language.audit.rejections).map(([key, value]) => [
      key,
      value - (rejects[key] || 0),
    ]),
  );
  report.samples.push(result);
}
sample("pre-feature default", previous, {});
sample("current default", current, {});
sample("current all features weight1", current, full);
sample("current random worlds 100 seeds", current, (i) =>
  worldSettingsForSeed(Math.floor(i / 100)),
);
sample("random worlds founderActions6 depth6", current, (i) => ({
  ...worldSettingsForSeed(Math.floor(i / 100)),
  founderActions: 6,
  generationDepth: 6,
}));
sample("random worlds baseline feature weights", current, (i) => ({
  ...worldSettingsForSeed(Math.floor(i / 100)),
  neighborhoodWeight: 0,
  developmentWeight: 0,
  temporalWeight: 0,
  communicationWeight: 0,
  activationWeight: 0,
}));
sample("random worlds founderActions6 only", current, (i) => ({
  ...worldSettingsForSeed(Math.floor(i / 100)),
  founderActions: 6,
}));
sample("random worlds depth6 only", current, (i) => ({
  ...worldSettingsForSeed(Math.floor(i / 100)),
  generationDepth: 6,
}));
const output =
  process.argv[2] || "/private/tmp/cellsoup-tree-evolvability-audit.json";
await writeFile(output, JSON.stringify(report, null, 2));
for (const r of report.samples)
  console.log(
    JSON.stringify({
      ...r,
      presence: Object.fromEntries(
        [
          "bud",
          "split",
          "photosynthesize",
          "eat",
          "move",
          "turn",
          "contract",
          "if",
          "wait",
          "resist",
          "store",
          "mobilize",
        ].map((k) => [k, r.presence[k] || 0]),
      ),
      opOccurrences: undefined,
    }),
  );
