import { readFile } from "node:fs/promises";
import { assemble } from "../web/language.js";
export async function engine(seed = 42) {
  const { instance } = await WebAssembly.instantiate(
    await readFile(new URL("../web/engine.wasm", import.meta.url)),
    {},
  );
  const e = instance.exports;
  e.reset(seed);
  e.configure(24, 16384, 0, 0);
  new Float32Array(e.memory.buffer, e.food_ptr(), 128 * 80).fill(0);
  return e;
}
export function program(e, source) {
  const p = assemble(source);
  new Uint8Array(e.memory.buffer, e.upload_ptr(), p.buffer.byteLength).set(
    new Uint8Array(p.buffer),
  );
  return e.load_program(p.length);
}
export function spawn(e, source, x = 800, y = 500, n = 1, spread = 0) {
  const g = program(e, source);
  e.seed_cells(n, x, y, spread, g);
  return g;
}
export function snapshot(e) {
  e.snapshot();
  const stats = [...new Float32Array(e.memory.buffer, e.stats_ptr(), 24)];
  const cells = [
    ...new Float32Array(e.memory.buffer, e.render_ptr(), stats[0] * 8),
  ];
  return { stats, cells };
}
export function detail(e, id) {
  const p = e.inspect(id);
  return p ? [...new Float32Array(e.memory.buffer, p, 24)] : null;
}
