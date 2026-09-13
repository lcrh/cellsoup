import test from "node:test";
import assert from "node:assert/strict";
import {
  TREE_SCHEMA,
  TREE_SURFACE_FORMS,
  compileTree,
} from "../web/gpu/trees.js";
import { FUNCTION_REFERENCE } from "../web/gpu/function-reference.js";

test("every evolution palette primitive has a usable typed example", () => {
  assert.deepEqual(
    FUNCTION_REFERENCE.map((fn) => fn.name),
    TREE_SCHEMA.map((fn) => fn.name),
  );
  for (const fn of FUNCTION_REFERENCE) {
    assert.ok(fn.description.length > 0, fn.name);
    assert.ok(!fn.example.includes("undefined"), fn.name);
    let program = fn.example;
    if (!["candidate", "child-set", "child-turn"].includes(fn.name))
      switch (fn.result) {
        case "Number":
          program = `(move ${program})`;
          break;
        case "Bool":
          program = `(if ${program} (nop) (nop))`;
          break;
        case "Cell":
          program = `(link ${program})`;
          break;
        case "Memory":
          program = `(set ${program} 0)`;
          break;
        case "Channel":
          program = `(emit ${program} 0)`;
          break;
        case "Filter":
          program = `(link (nearby 60 ${program}))`;
          break;
      }
    assert.doesNotThrow(() => compileTree(program), fn.name + ": " + program);
  }
});
test("composable vocabulary examples compile and point to real evolution switches", () => {
  const names = new Set(TREE_SCHEMA.map((fn) => fn.name));
  for (const form of TREE_SURFACE_FORMS) {
    assert.doesNotThrow(() => compileTree(form.example), form.name);
    assert.ok(form.canonicalNames.length > 0, form.name);
    for (const name of form.canonicalNames)
      assert.ok(names.has(name), form.name + ": " + name);
  }
});
