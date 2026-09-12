import test from "node:test";
import assert from "node:assert/strict";
import { assemble } from "../web/language.js";
import { compile, decode } from "../web/gpu/language.js";
test("GPU assembly adds enzyme and nutrient sensors without changing legacy assembly", () => {
  const source =
    "loop: enzyme .25\nsense r0 nutrient_a\nsense r1 reserve_b\njmp loop";
  const result = compile(source);
  assert.equal(new DataView(result.buffer).getInt32(0, true), 40);
  assert.deepEqual(
    new Uint8Array(compile(decode(result.buffer)).buffer),
    new Uint8Array(result.buffer),
  );
  assert.throws(() => assemble("enzyme .25"), /unknown instruction/);
  assert.throws(() => assemble("sense r0 nutrient_a"), /invalid sensor/);
});
test("GPU bytecode respects its fixed program capacity", () => {
  assert.equal(compile(Array(64).fill("nop").join("\n")).length, 64);
  assert.throws(
    () => compile(Array(65).fill("nop").join("\n")),
    /64 instructions/,
  );
});
