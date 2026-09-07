import test from "node:test";
import assert from "node:assert/strict";
import { engine, spawn, snapshot, detail, program } from "./helpers.mjs";
import { assemble, disassemble, OPS } from "../web/language.js";
function code(e, g) {
  return new Uint8Array(
    e.memory.buffer,
    e.genome_ptr(g),
    e.genome_len(g) * 16,
  ).slice();
}
async function successful(seed = 42) {
  const e = await engine(seed);
  const g = spawn(e, "loop: split r0\nwait 1000\njmp loop", 800, 500, 4, 100);
  e.step(600);
  assert.equal(snapshot(e).stats[19], 1);
  return { e, g };
}
test("random founders are independent, valid, diverse programs with reproducible seeds", async () => {
  const a = await engine(91),
    b = await engine(91);
  for (const e of [a, b]) assert.equal(e.seed_random(512), 512);
  assert.deepEqual(snapshot(a), snapshot(b));
  const unique = new Set(),
    lengths = new Set(),
    ops = new Set();
  for (let g = 0; g < 512; g++) {
    const bytes = code(a, g);
    assert.deepEqual(bytes, code(b, g));
    const source = disassemble(bytes.buffer);
    assemble(source);
    unique.add(source);
    lengths.add(a.genome_len(g));
    for (let i = 0; i < bytes.byteLength; i += 16)
      ops.add(new DataView(bytes.buffer).getInt32(i, true));
  }
  assert.equal(unique.size, 512);
  assert.equal(ops.size, OPS.length);
  assert.ok(lengths.size > 40);
  assert.equal(snapshot(a).stats[17], 512);
  assert.equal(snapshot(a).stats[2], 0);
});
test("empty dishes replenish on simulation ticks, obey batch and cell limits, and can disable arrivals", async () => {
  const e = await engine();
  e.configure(24, 100, 0, 0);
  e.configure_arrivals(512, 1, 1); // Empty archive must fall back to random.
  e.step(59);
  assert.equal(snapshot(e).stats[0], 0);
  e.step(1);
  assert.equal(snapshot(e).stats[0], 64);
  assert.equal(snapshot(e).stats[18], 0);
  e.step(60);
  const s = snapshot(e).stats;
  assert.equal(s[0], 100);
  assert.equal(s[17] + s[2] - s[3], s[0]);
  assert.equal(s[22], 100);
  e.reset(42);
  e.configure_arrivals(0, 1, 1);
  e.step(600);
  assert.equal(snapshot(e).stats[0], 0);
});
test("archive requires reproduction and persistence, not merely seeded population size", async () => {
  const e = await engine();
  spawn(e, "wait 1000", 800, 500, 20, 50);
  e.step(600);
  assert.equal(snapshot(e).stats[19], 0);
  spawn(e, "loop: split r0\nwait 1000\njmp loop", 500, 500, 4, 50);
  e.step(599);
  assert.equal(snapshot(e).stats[19], 0);
  e.step(1);
  assert.equal(snapshot(e).stats[19], 1);
  e.step(600);
  assert.equal(snapshot(e).stats[23], 1); // Each variant enters reservoir only once.
});
test("division mutation defaults to zero and resampling uses its independent slider", async () => {
  for (const rate of [0, 1]) {
    const { e, g } = await successful(17);
    const original = code(e, g);
    assert.equal(snapshot(e).stats[8], 0);
    e.configure_arrivals(9, 1, rate);
    e.step(60);
    const s = snapshot(e).stats;
    assert.equal(s[18], 1);
    assert.equal(s[20], rate);
    assert.equal(s[21], 0);
    assert.equal(s[2], 4); // Resampling is not division.
    const d = detail(e, 9);
    if (rate) assert.notDeepEqual(code(e, d[8]), original);
    else assert.deepEqual(code(e, d[8]), original);
    assert.equal(d[19], detail(e, 1)[18]); // Archive source identity, not recycled slot.
    assert.equal(d[21], rate);
    assert.equal(d[2], 0);
  }
});
test("archived bytecode survives extinction and live genome-slot reuse; reset clears it", async () => {
  const { e, g } = await successful();
  const original = code(e, g);
  program(e, "nop"); // Release upload protection of original genome slot.
  for (let i = 0; i < 30; i++) e.step(600);
  assert.equal(snapshot(e).stats[0], 0);
  assert.equal(snapshot(e).stats[19], 1);
  e.seed_random(1);
  assert.notDeepEqual(code(e, g), original); // Slot reused, archive copy remains intact.
  e.configure_arrivals(64, 1, 0);
  e.step(60);
  const s = snapshot(e).stats;
  assert.ok(s[18] > 0);
  const cells = snapshot(e).cells;
  const newestId = Math.max(...cells.filter((_, i) => i % 8 === 4));
  assert.deepEqual(code(e, detail(e, newestId)[8]), original);
  e.reset(42);
  assert.equal(snapshot(e).stats[19], 0);
  assert.equal(snapshot(e).stats[17], 0);
  assert.equal(snapshot(e).stats[23], 0);
});
test("immigration and archive selection replay independently of step chunking and inspection", async () => {
  const a = await engine(11),
    b = await engine(11);
  for (const e of [a, b]) {
    e.configure_arrivals(512, 0.5, 0.8);
    e.seed_random(32);
  }
  for (let i = 0; i < 12; i++) a.step(600);
  for (let i = 0; i < 120; i++) {
    b.step(60);
    b.inspect(1);
    b.snapshot();
  }
  assert.deepEqual(snapshot(a), snapshot(b));
});

test("archive and random-genome storage stay bounded without blocking inherited division", async () => {
  const e = await engine();
  for (let i = 0; i < 140; i++)
    spawn(e, "loop: split r0\nwait 1000\njmp loop", i * 10, 500, 4, 4);
  e.step(600);
  assert.equal(snapshot(e).stats[19], 128);
  assert.equal(snapshot(e).stats[23], 140);
  const before = snapshot(e).stats;
  e.configure_arrivals(2048, 0, 1); // A populated archive can still be bypassed.
  e.step(60);
  assert.equal(snapshot(e).stats[18], 0);
  assert.equal(snapshot(e).stats[17], before[17] + 64);
  const full = await engine();
  assert.equal(full.seed_random(16384), 2048);
  assert.equal(full.seed_random(1), 0);
  full.step(1);
  assert.ok(snapshot(full).stats[2] > 0);
  assert.equal(snapshot(full).stats[7], 2048);
});

test("steady arrivals continue above the low-population threshold and combine with replenishment", async () => {
  const e = await engine();
  spawn(e, "wait 1000", 800, 500, 10, 100);
  e.configure_arrivals(5, 0, 0, 8);
  e.step(60);
  assert.equal(snapshot(e).stats[17], 8);
  e.step(60);
  assert.equal(snapshot(e).stats[17], 16);
  e.reset(42);
  e.configure_arrivals(100, 0, 0, 8);
  e.step(60);
  assert.equal(snapshot(e).stats[0], 72); // 8 steady + 64 low-population arrivals.
  e.configure(24, 72, 0, 0);
  e.step(60);
  assert.equal(snapshot(e).stats[17], 72); // Hard ceiling still applies.
  e.reset(42);
  e.configure_arrivals(0, 0, 0, 8);
  e.step(60);
  assert.equal(snapshot(e).stats[17], 8); // Trickle does not require a floor.
});
