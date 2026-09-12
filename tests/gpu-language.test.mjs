import test from "node:test";
import assert from "node:assert/strict";
import { assemble } from "../web/language.js";
import { compile, decode } from "../web/gpu/language.js";
test("GPU assembly supports sunlight, storage, corpses and attacks without changing legacy assembly", () => {
  const source =
    "loop: photosynthesize r0\nsense r1 storage\nstore r2 5\nmobilize r3 2\nstorage_gradient r4 r5 -1\nscan_corpse r6 360\npeek r7 r6 alive\neat r0\nsense r1 temperature\nsense r2 linked_temperature\npeek r3 r6 temperature\nattack r6 3\njmp loop";
  const result = compile(source);
  assert.equal(new DataView(result.buffer).getInt32(0, true), 40);
  assert.deepEqual(
    new Uint8Array(compile(decode(result.buffer)).buffer),
    new Uint8Array(result.buffer),
  );
  assert.throws(() => assemble("photosynthesize r0"), /unknown instruction/);
  assert.throws(() => assemble("sense r0 storage"), /invalid sensor/);
});
test("GPU bytecode respects its fixed program capacity", () => {
  assert.equal(compile(Array(64).fill("nop").join("\n")).length, 64);
  assert.throws(
    () => compile(Array(65).fill("nop").join("\n")),
    /64 instructions/,
  );
});
