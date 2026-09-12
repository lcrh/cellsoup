// Replace temporal history with the current input at equal bytecode length and
// CPU timing. lag(x) becomes x, delta(x) becomes 0, smooth(a,x) becomes x.
// Private histories still receive writes; no explicit memory access is altered.
import assert from "node:assert/strict";
import { assemble } from "../web/language.js";
import { compileTree, TREE_VM_OPS } from "../web/gpu/trees.js";
import { GPU_SENSORS, GPU_FIELDS } from "../web/gpu/language.js";
import { GENOME_BYTES } from "../web/gpu/engine.js";
export function withoutTemporalHistory(tree) {
  const original = compileTree(tree);
  assert.ok(
    original.statefulSlots,
    "Requires the temporal-expression compiler",
  );
  const lines = original.source.split("\n"),
    replacements = [];
  for (const { slot, op } of original.statefulSlots) {
    const indexes = lines
      .map((line, index) =>
        new RegExp(`^mem_load r[0-7] ${slot}$`).test(line) ? index : -1,
      )
      .filter((i) => i >= 0);
    assert.equal(
      indexes.length,
      1,
      "Private temporal history must have exactly one load",
    );
    const index = indexes[0],
      previous = /^mem_load (r[0-7])/.exec(lines[index])[1];
    const input = (
      op === "smooth"
        ? new RegExp(`^sub (r[0-7]) ${previous}$`)
        : new RegExp(`^mem_save ${slot} (r[0-7])$`)
    ).exec(lines[index + 1]);
    assert.ok(input, "Unexpected temporal compiler sequence");
    const before = lines[index];
    lines[index] = `mov ${previous} ${input[1]}`;
    replacements.push({ slot, op, before, after: lines[index] });
  }
  const source = lines.join("\n"),
    changed = assemble(source, TREE_VM_OPS, GPU_SENSORS, GPU_FIELDS);
  assert.equal(changed.length, original.length);
  return { original, changed: { ...changed, source }, replacements };
}
export async function uploadFixtureCode(device, engine, slot, code) {
  assert.equal(
    engine.tick,
    0,
    "Code intervention is restricted to an unstepped fixture",
  );
  assert.ok(
    Number.isInteger(slot) && slot >= 0 && slot < engine.cfg.genomeCapacity,
  );
  assert.equal((await engine.genome(slot)).length, code.length);
  const source = new DataView(code.buffer),
    data = new Float32Array(code.length * 4);
  for (let k = 0; k < code.length; k++) {
    data[k * 4] = source.getInt32(k * 16, true);
    for (let a = 1; a < 4; a++)
      data[k * 4 + a] = source.getFloat32(k * 16 + a * 4, true);
  }
  device.queue.writeBuffer(
    engine.buffers.genomes,
    slot * GENOME_BYTES + 32,
    data,
  );
}
