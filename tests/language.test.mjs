import test from "node:test";
import assert from "node:assert/strict";
import { assemble, disassemble } from "../web/language.js";
import { PRESETS } from "../web/presets.js";
test("every example assembles and disassembles to identical bytecode", () => {
  for (const p of Object.values(PRESETS)) {
    const a = assemble(p.source);
    assert.deepEqual(assemble(disassemble(a.buffer)).buffer, a.buffer);
  }
});
test("labels, comments, comma syntax, register encoding", () => {
  const p = assemble("; title\nstart: MOV r0, 12.5\nadd r0 -2\njmp start");
  const v = new DataView(p.buffer);
  assert.equal(p.length, 3);
  assert.equal(v.getFloat32(4, true), -1000000);
  assert.equal(v.getFloat32(8, true), 12.5);
  assert.equal(v.getFloat32(36, true), 0);
  assert.deepEqual(p.lines, [2, 3, 4]);
});
test("invalid programs fail with useful diagnostics", () => {
  for (const source of [
    "",
    "oops r0",
    "mov r8 2",
    "mov 2 3",
    "jmp missing",
    "a: nop\na: nop",
    "sense r0 smell",
    "peek r0 r1 nope",
    "mov r0 NaN",
    "mov r0 -1000000",
    "jmp end\nend:",
    "nop x",
  ])
    assert.throws(() => assemble(source));
  assert.throws(() => assemble(Array(257).fill("nop").join("\n")), /256/);
});

test("evolved float32 operands survive export and import exactly", () => {
  for (const v of [
    102.63676452636719, 0.000000034815516, 0.3, -0.0000000021, 999998.9375,
  ]) {
    const a = assemble(`mov r0 ${v}`);
    assert.deepEqual(assemble(disassemble(a.buffer)).buffer, a.buffer);
  }
});

test("disassembly displays readable decimals without sacrificing float32 identity", () => {
  assert.equal(disassemble(assemble("shield 0.3").buffer), "L0: shield 0.3");
});
