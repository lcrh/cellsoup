// Matched, explicitly authored controls for the observed nearest-cell gift.
// These are assay variants, never founders in autonomous evolution.
import assert from "node:assert/strict";
import { compileTree, printTree } from "../web/gpu/trees.js";
export function nearestGiftGuards(tree) {
  const pattern = "(give (nearest-cell) (if (not true) (crowding) (bonds)))";
  function variant(field) {
    let changed = 0;
    function visit(t) {
      if (printTree(t) === pattern) {
        changed++;
        return {
          op: "give",
          args: [
            { op: "nearest-cell", args: [] },
            {
              op: "if",
              args: [
                { op: field, args: [{ op: "nearest-cell", args: [] }] },
                { op: "bonds", args: [] },
                { op: "number", value: 0, args: [] },
              ],
            },
          ],
        };
      }
      return { ...t, args: t.args.map(visit) };
    }
    const result = visit(tree);
    assert.equal(changed, 1, "Expected exactly one observed nearest-cell gift");
    return result;
  }
  const alive = variant("alive"),
    kin = variant("kin");
  const a = compileTree(alive),
    k = compileTree(kin);
  assert.equal(a.length, k.length);
  const aa = a.source.split("\n"),
    kk = k.source.split("\n");
  const difference = aa.flatMap((line, i) => (line === kk[i] ? [] : [i]));
  assert.equal(difference.length, 1);
  const index = difference[0];
  assert.match(aa[index], /^peek r\d+ r\d+ alive$/);
  assert.equal(kk[index], aa[index].replace(/ alive$/, " kin"));
  return {
    alive,
    kin,
    instructions: a.length,
    changedInstruction: index,
    aliveSource: a.source,
    kinSource: k.source,
    originalInstructions: compileTree(tree).length,
  };
}
