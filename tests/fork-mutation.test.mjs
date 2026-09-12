import test from "node:test";
import assert from "node:assert/strict";
import { compile } from "../web/gpu/language.js";
import { mutateAssemblyGenome } from "../web/gpu/fork-mutation.js";
import { describeGenome } from "../web/gpu/engine.js";
function packed(source) {
  const code = compile(source),
    buffer = new ArrayBuffer(1056),
    v = new DataView(buffer),
    input = new DataView(code.buffer);
  [code.length, 99, 77, 4, 33, 100, 0, 0].forEach((x, i) =>
    v.setUint32(i * 4, x, true),
  );
  for (let k = 0; k < code.length; k++)
    for (let a = 0; a < 4; a++)
      v.setFloat32(
        32 + k * 16 + a * 4,
        a
          ? input.getFloat32(k * 16 + a * 4, true)
          : input.getInt32(k * 16, true),
        true,
      );
  return buffer;
}
const rng = (seed) => () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
test("division assembly mutation changes one instruction, preserves the source, and round trips through the assembler", () => {
  for (const source of [
    "loop: jmp loop",
    "nop",
    "bud r0\nwait 1000",
    "loop: sense r0 sunlight\nadd r0 1\nmove r0\npeek r1 r0 energy\njmp loop",
  ]) {
    const original = packed(source),
      before = original.slice(0);
    for (let seed = 0; seed < 1000; seed++) {
      const result = mutateAssemblyGenome(original, rng(seed));
      assert.deepEqual(original, before);
      assert.deepEqual(
        new Uint8Array(result, 0, 32),
        new Uint8Array(original, 0, 32),
      );
      assert.notDeepEqual(result, original);
      const length = new Uint32Array(original)[0],
        a = new Uint8Array(original),
        b = new Uint8Array(result);
      let changes = 0;
      for (let k = 0; k < length; k++)
        changes += !a
          .slice(32 + k * 16, 48 + k * 16)
          .every((v, j) => v === b[32 + k * 16 + j]);
      assert.equal(changes, 1);
      const decoded = describeGenome(result);
      assert.equal(compile(decoded.source).length, length);
    }
  }
});
test("division assembly mutation rejects malformed genomes", () => {
  assert.throws(() => mutateAssemblyGenome(new ArrayBuffer(1056)), /Invalid/);
  const b = packed("nop");
  new Float32Array(b)[8] = 999;
  assert.throws(() => mutateAssemblyGenome(b, rng(1)), /Invalid opcode/);
});
