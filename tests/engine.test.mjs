import test from "node:test";
import assert from "node:assert/strict";
import { engine, spawn, program, snapshot, detail } from "./helpers.mjs";
import { PRESETS } from "../web/presets.js";
test("budget bounds infinite loops and execution resumes next tick", async () => {
  const e = await engine();
  e.configure(4, 100, 0, 0);
  spawn(e, "loop: add r0 1\njmp loop");
  e.step(1);
  assert.equal(detail(e, 1)[10], 2);
  e.step(1);
  assert.equal(detail(e, 1)[10], 4);
});
test("wait yields and sleeps the requested additional ticks", async () => {
  const e = await engine();
  spawn(e, "add r0 1\nwait 2\njmp loop\nloop: add r0 1\nwait 2\njmp loop");
  e.step(1);
  assert.equal(detail(e, 1)[10], 1);
  e.step(2);
  assert.equal(detail(e, 1)[10], 1);
  e.step(1);
  assert.equal(detail(e, 1)[10], 2);
});
test("fork copies registers and PC, returns distinct values and conserves division energy", async () => {
  const e = await engine();
  spawn(e, "mov r3 17\nsplit r0\nwait 500");
  e.step(1);
  const p = detail(e, 1),
    c = detail(e, 2);
  assert.equal(snapshot(e).stats[0], 2);
  assert.equal(p[10], 0);
  assert.equal(c[10], 1);
  assert.equal(p[13], 17);
  assert.equal(c[13], 17);
  assert.equal(c[4], 1);
  assert.equal(c[9], 1);
  assert.equal(p[2], 2);
  assert.equal(c[2], 2);
  assert.ok(Math.abs(p[1] + c[1] - (70 - 12 - 0.004 - 0.001)) < 0.001);
  assert.equal(snapshot(e).stats[4], 0);
});
test("bud creates one symmetric bond and diffusion conserves energy", async () => {
  const e = await engine();
  spawn(e, "bud r0\nwait 1000");
  e.step(1);
  assert.equal(snapshot(e).stats[4], 1);
  assert.equal(detail(e, 1)[5], 1);
  assert.equal(detail(e, 2)[5], 1);
  assert.ok(Math.abs(detail(e, 1)[1] - detail(e, 2)[1]) < 0.001);
});
test("failed division returns -1 and leaves energy intact except metabolism", async () => {
  const e = await engine();
  e.configure(24, 1, 0, 0);
  spawn(e, "split r0");
  e.step(1);
  assert.equal(snapshot(e).stats[0], 1);
  assert.equal(detail(e, 1)[10], -1);
  assert.ok(detail(e, 1)[1] > 69.99);
});
test("low-energy division fails without creating a cell", async () => {
  const e = await engine();
  spawn(e, "split r0\nsplit r1\nwait 500");
  e.step(5);
  assert.equal(snapshot(e).stats[0], 2);
  assert.equal(detail(e, 1)[11], -1);
  assert.equal(detail(e, 2)[11], -1);
});
test("targeted stealing selects tag and shield reduces loss", async () => {
  async function run(shield) {
    const e = await engine();
    spawn(e, `tag 2\nshield ${shield}\nwait 500`, 800, 500);
    spawn(e, "wait 500", 808, 500);
    e.step(1);
    spawn(e, "scan r0 2 360\nsteal r0 3\nwait 500", 804, 505);
    e.step(1);
    return { prey: detail(e, 1), bystander: detail(e, 2), pred: detail(e, 3) };
  }
  const bare = await run(0),
    protected_ = await run(1);
  assert.equal(bare.pred[10], 1);
  assert.ok(bare.bystander[1] > 69.9);
  assert.ok(protected_.prey[1] - bare.prey[1] > 2.6);
  assert.ok(bare.pred[1] > protected_.pred[1] + 1.9);
});
test("ID zero cannot accidentally steal, give, peek, or link to nearest", async () => {
  const e = await engine();
  spawn(e, "wait 500", 800, 500);
  e.step(1);
  spawn(e, "peek r0 0 energy\nsteal 0 3\ngive 0 3\nlink 0\nwait 500", 810, 500);
  e.step(1);
  assert.equal(detail(e, 2)[10], 0);
  assert.equal(snapshot(e).stats[4], 0);
  assert.ok(detail(e, 1)[1] > 69.98);
});
test("directional sensing uses the caller's facing without exposing a compass", async () => {
  const e = await engine();
  spawn(e, "wait 0\nscan r1 7 40\nturn 180\nscan r2 7 40\nwait 500", 800, 500);
  const facing = snapshot(e).cells[6] * Math.PI * 2;
  spawn(
    e,
    "tag 7\nwait 500",
    800 + Math.cos(facing) * 20,
    500 + Math.sin(facing) * 20,
  );
  e.step(2);
  assert.equal(detail(e, 1)[11], 2);
  assert.equal(detail(e, 1)[12], 0);
});
test("signals are sensed nearby and decay", async () => {
  const e = await engine();
  spawn(e, "emit 2 10\nwait 1000", 800, 500);
  e.step(1);
  spawn(e, "listen r0 2\nwait 500", 810, 500);
  e.step(1);
  assert.ok(detail(e, 2)[10] > 7 && detail(e, 2)[10] < 10);
});
test("food absorption conserves field + stored energy before metabolism", async () => {
  const e = await engine();
  spawn(e, "wait 1000");
  e.add_food(800, 500, 10);
  const food = new Float32Array(e.memory.buffer, e.food_ptr(), 10240),
    before = food.reduce((a, b) => a + b, 0) + 70;
  e.step(1);
  const after = food.reduce((a, b) => a + b, 0) + snapshot(e).stats[6];
  assert.ok(Math.abs(before - after - 0.0045) < 0.001);
});
test("energy transfer does not create energy", async () => {
  const e = await engine();
  spawn(e, "wait 1000", 800, 500);
  e.step(1);
  spawn(e, "give 1 10\nwait 1000", 810, 500);
  const before = snapshot(e).stats[6];
  e.step(1);
  assert.ok(Math.abs(before - snapshot(e).stats[6] - 0.009) < 0.002);
  assert.ok(detail(e, 1)[1] > 79);
  assert.ok(detail(e, 2)[1] < 61);
});
test("starvation removes cells and their bonds", async () => {
  const e = await engine();
  spawn(e, "bud r0\nshield 1\nloop: move 1\njmp loop");
  for (let i = 0; i < 8; i++) e.step(600);
  assert.equal(snapshot(e).stats[0], 0);
  assert.equal(snapshot(e).stats[4], 0);
  assert.equal(detail(e, 1), null);
});
test("identical seeds and actions produce identical state", async () => {
  const a = await engine(85),
    b = await engine(85);
  for (const e of [a, b]) {
    e.configure(24, 1024, 0.1, 1);
    spawn(e, PRESETS.grazer.source, 800, 500, 300, 250);
    e.step(600);
  }
  assert.deepEqual(snapshot(a), snapshot(b));
});
test("dense collisions, mutation and division stay finite and within capacity", async () => {
  const e = await engine();
  e.configure(24, 512, 0.5, 5);
  spawn(e, PRESETS.colony.source, 800, 500, 512, 30);
  for (let k = 0; k < 10; k++) {
    e.add_food(800, 500, 80);
    e.step(120);
    const { cells, stats } = snapshot(e);
    assert.ok(stats[0] <= 512);
    assert.ok(cells.every(Number.isFinite));
    for (let i = 0; i < cells.length; i += 8) {
      assert.ok(cells[i] >= 0 && cells[i] < 1600);
      assert.ok(cells[i + 1] >= 0 && cells[i + 1] < 1000);
      assert.ok(cells[i + 2] >= 0 && cells[i + 2] <= 200.01);
    }
  }
});
test("bonds are capped at six, can be detached, and connect across wrapping edges", async () => {
  const e = await engine();
  spawn(e, "wait 1000", 1, 500);
  e.step(1);
  for (let i = 0; i < 8; i++) {
    spawn(e, "link 1\nwait 1000", 1595, 500 + i * 0.2);
    e.step(1);
  }
  assert.equal(detail(e, 1)[5], 6);
  assert.equal(snapshot(e).stats[4], 6);
  const f = await engine();
  spawn(f, "bud r0\nunlink 0\nwait 1000");
  f.step(3);
  assert.equal(snapshot(f).stats[4], 0);
});
test("out-of-range theft has no effect", async () => {
  const e = await engine();
  spawn(e, "wait 1000", 800, 500);
  e.step(1);
  spawn(e, "steal 1 3\nwait 1000", 850, 500);
  e.step(1);
  assert.ok(detail(e, 1)[1] > 69.98);
  assert.ok(detail(e, 2)[1] < 70);
});
test("full mutation creates safe inherited operand, replacement, insertion and deletion variants", async () => {
  const e = await engine();
  e.configure(24, 4096, 1, 0);
  const source =
    "mov r1 2\nsplit r0\nloop: sense r2 energy\njlt r2 90 rest\nsplit r3\nrest: wait 20\njmp loop";
  spawn(e, source, 800, 500, 1000, 350);
  e.step(1);
  const { stats } = snapshot(e);
  assert.equal(stats[8], 1000);
  for (let i = 12; i <= 15; i++) assert.ok(stats[i] > 30);
  assert.equal(detail(e, 1)[18], 1);
  assert.equal(detail(e, 1001)[19], 1);
  assert.equal(detail(e, 1001)[21], 1);
  const { assemble, disassemble } = await import("../web/language.js");
  for (let g = 0; g < 2048; g++) {
    const n = e.genome_len(g);
    if (n) {
      assert.ok(n <= 256);
      const bytes = new Uint8Array(
        e.memory.buffer,
        e.genome_ptr(g),
        n * 16,
      ).slice().buffer;
      assert.deepEqual(assemble(disassemble(bytes)).buffer, bytes);
    }
  }
  e.step(600);
  assert.ok(snapshot(e).cells.every(Number.isFinite));
});

test("exhausting genome storage skips mutation while preserving viable births", async () => {
  const e = await engine();
  e.configure(1, 8192, 1, 0);
  spawn(e, "split r0\nwait 500", 800, 500, 2200, 500);
  e.step(1);
  const { stats, cells } = snapshot(e);
  assert.equal(stats[0], 4400);
  assert.equal(stats[7], 2048);
  assert.equal(stats[8], 2047);
  assert.ok(cells.every(Number.isFinite));
});

test("fine spatial searches match brute-force nearest neighbors at buckets and world seams", async () => {
  const { shortestDelta } = await import("../web/camera.js");
  for (const [x, y] of [
    [0.01, 0.01],
    [19.99, 20.01],
    [1599.9, 999.9],
    [799.99, 499.99],
  ]) {
    const e = await engine();
    spawn(e, "wait 1000", x + 35, y - 22, 40, 80);
    e.step(1);
    const { cells } = snapshot(e);
    let expected = 0,
      best = 3600;
    for (let k = 0; k < cells.length; k += 8) {
      const d =
        shortestDelta(cells[k] - x, 1600) ** 2 +
        shortestDelta(cells[k + 1] - y, 1000) ** 2;
      if (d < best) {
        best = d;
        expected = cells[k + 4];
      }
    }
    spawn(e, "scan r0 -1 360\nwait 1000", x, y);
    e.step(1);
    assert.equal(detail(e, 41)[10], expected);
  }
});
test("connected-body inspection crosses the world seam without including unrelated cells", async () => {
  const e = await engine();
  spawn(e, "wait 1000", 1, 500);
  e.step(1);
  spawn(e, "link 1\nwait 1000", 1592, 500);
  spawn(e, "wait 1000", 800, 500);
  e.step(1);
  const d = new Float32Array(e.memory.buffer, e.inspect(1), 32);
  assert.equal(d[24], 2);
  assert.ok(d[28] < 25);
  assert.ok(Math.abs(d[25] - detail(e, 1)[1] - detail(e, 2)[1]) < 0.001);
  const body = new Float32Array(e.memory.buffer, e.organism_ptr(), d[24] * 8);
  assert.deepEqual([body[4], body[12]].sort(), [1, 2]);
  assert.ok(Math.abs(body[0] - body[8]) < 20);
});
test("inspection is read-only and does not alter subsequent evolution", async () => {
  const a = await engine(17),
    b = await engine(17);
  for (const e of [a, b]) {
    e.configure(24, 1024, 0.1, 1);
    spawn(e, PRESETS.colony.source, 800, 500, 64, 70);
  }
  for (let k = 0; k < 30; k++) {
    a.inspect(1);
    a.step(20);
    b.step(20);
  }
  assert.deepEqual(snapshot(a), snapshot(b));
});

test("contracted springs physically shorten a connected body", async () => {
  async function run(rest) {
    const e = await engine(22);
    spawn(e, `bud r0\ncontract ${rest}\nwait 1000`);
    e.step(300);
    const a = snapshot(e).cells;
    const dx = a[8] - a[0],
      dy = a[9] - a[1];
    return Math.hypot(dx, dy);
  }
  const short = await run(0.6),
    long = await run(1.4);
  assert.ok(short > 9 && short < 13);
  assert.ok(long > 23 && long < 27);
  assert.ok(long - short > 10);
});
test("passive bond diffusion equalizes unequal stores without introducing energy", async () => {
  const e = await engine(31);
  spawn(
    e,
    "bud r0\njz r0 parent\nwait 1000\nparent: give 2 10\nwait 1000",
    800,
    500,
  );
  spawn(e, "wait 1000", 815, 500);
  e.step(2);
  const before = Math.abs(detail(e, 1)[1] - detail(e, 3)[1]),
    energy = snapshot(e).stats[6];
  assert.ok(before > 9);
  e.step(100);
  assert.ok(Math.abs(detail(e, 1)[1] - detail(e, 3)[1]) < before * 0.15);
  assert.ok(snapshot(e).stats[6] < energy);
});
