import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
const [first, second, output] = process.argv.slice(2);
if (!output)
  throw Error("Supply connected and unlinked directories and output JSON");
const load = async (p, n) =>
  JSON.parse(gunzipSync(await readFile(`${p}/${n}.json.gz`)));
const journal = async (p, n) =>
  gunzipSync(await readFile(`${p}/${n}.jsonl.gz`))
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
const runs = await Promise.all([first, second].map((p) => load(p, "run"))),
  logs = await Promise.all([first, second].map((p) => journal(p, "arrivals"))),
  captures = await Promise.all(
    [first, second].map((p) => journal(p, "captures")),
  );
let firstBody;
for (let i = 0; i < Math.min(...logs.map((a) => a.length)); i++) {
  const [a, b] = logs.map((l) => l[i]);
  if (a.plan.source === "body") {
    assert.equal(b.plan.source, "body");
    assert.equal(a.second, b.second);
    firstBody = a.second;
    assert.deepEqual(a.plan.programs, b.plan.programs);
    assert.deepEqual(
      a.plan.cells.map(({ links, ...c }) => c),
      b.plan.cells.map(({ links, ...c }) => c),
    );
    assert.ok(a.plan.cells.some((c) => c.links?.some(Boolean)));
    assert.ok(b.plan.cells.every((c) => !c.links?.some(Boolean)));
    break;
  }
  assert.deepEqual(a.plan, b.plan);
}
assert.ok(firstBody);
for (let i = 0; i < 2; i++) {
  const r = runs[i],
    l = logs[i];
  assert.equal(l.length, r.policy.closeAt);
  assert.equal(
    l.reduce((s, a) => s + a.result.admitted, 0),
    r.totals.admitted,
  );
  assert.equal(captures[i].length, r.totals.captures);
  assert.equal(r.totals.energy, r.totals.admitted * r.config.seedEnergy);
  assert.equal(r.totals.storage, r.totals.admitted * r.config.seedStorage);
  assert.equal(
    r.records.at(-1).randomArrivals + r.records.at(-1).sampledArrivals,
    r.closure.arrivals,
  );
}
const result = {
  scope:
    "Autonomous scheduling and conservation check, not evidence of an evolutionary benefit. GPU slot allocation is nondeterministic: matching seeds do not imply byte-identical trajectories. Compare submitted inputs separately from slot IDs and subsequent ecology.",
  firstBodySecond: firstBody,
  precedingPlansIdentical: firstBody - 1,
  firstBodyProgramsAndNonLinkCellStateIdentical: true,
  firstAllocationDifference: logs[0].find(
    (a, i) =>
      JSON.stringify(a.result.cellSlots) !==
      JSON.stringify(logs[1][i].result.cellSlots),
  )?.second,
  runs: runs.map((r, i) => ({
    condition: ["connected", "unlinked"][i],
    totals: r.totals,
    closure: r.closure,
    final: r.records.at(-1),
  })),
};
await writeFile(output, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    firstBody,
    admitted: runs.map((r) => r.totals.admitted),
    finalLiving: runs.map((r) => r.records.at(-1).living),
  }),
);
