import test from "node:test";
import assert from "node:assert/strict";
import { parseTree } from "../web/gpu/trees.js";
import { auditMemory } from "../research/tree-memory-audit.mjs";

test("memory audit separates bound reads and recurrence from writes and birth-result", () => {
  assert.deepEqual(
    auditMemory(parseTree("(seq (set m0 1) (move (birth-result)))")),
    {
      stateBindings: 0,
      localBindings: 0,
      memoryReads: 0,
      bindingsWithReadInBody: 0,
      bindingsWithRecurrentUpdate: 0,
    },
  );
  assert.deepEqual(
    auditMemory(
      parseTree(
        "(state ((sum 0)) (let ((sample (sunlight))) (set! sum (+ sum sample))))",
      ),
    ),
    {
      stateBindings: 1,
      localBindings: 1,
      memoryReads: 2,
      bindingsWithReadInBody: 2,
      bindingsWithRecurrentUpdate: 1,
    },
  );
});

test("memory audit counts syntax in unexecuted branches without calling it activity", () => {
  const result = auditMemory(
    parseTree(
      "(state ((sum 0)) (if false (set! sum (+ sum 1)) (photosynthesize)))",
    ),
  );
  assert.equal(result.memoryReads, 1);
  assert.equal(result.bindingsWithRecurrentUpdate, 1);
});
