import test from "node:test";
import assert from "node:assert/strict";
import { engine, spawn, detail, snapshot } from "./helpers.mjs";

async function free() {
  const e = await engine();
  for (let k = 0; k < 11; k++) e.set_cost(k, 0);
  return e;
}

test("instruction exhaustion skips effects, advances PC and leaves energy", async () => {
  const e = await free();
  e.configure(1, 100, 0, 0);
  e.set_cost(1, 10);
  spawn(e, "add r0 1\nadd r1 1\nadd r2 1");
  e.step(8);
  assert.equal(detail(e, 1)[1], 10);
  assert.deepEqual(detail(e, 1).slice(10, 13), [2, 2, 2]);
  assert.equal(detail(e, 1)[2], 2);
  e.set_cost(1, 0);
  e.step(1);
  assert.equal(detail(e, 1)[12], 3);
});

test("exact-cost and oversized voluntary actions are no-ops", async () => {
  for (const cost of [70, 100]) {
    for (const [kind, source] of [
      [3, "move 1"],
      [9, "turn 1"],
      [4, "link 2"],
      [5, "contract .55"],
      [6, "steal 2 3"],
      [7, "emit 0 50"],
    ]) {
      const e = await free();
      e.set_cost(kind, cost);
      spawn(e, source + "\nwait 1000", 800, 500);
      spawn(e, "listen r0 0\nwait 1000", 815, 500);
      const before = snapshot(e).cells;
      e.step(1);
      assert.equal(detail(e, 1)[1], 70, `${source}, cost ${cost}`);
      assert.equal(detail(e, 2)[1], 70);
      assert.equal(detail(e, 1)[5], 0);
      assert.deepEqual(snapshot(e).cells.slice(0, 2), before.slice(0, 2));
      assert.equal(snapshot(e).cells[6], before[6]);
      assert.equal(detail(e, 2)[10], 0);
    }
  }
});

test("give transfers a fraction of current energy and conserves the total", async () => {
  for (const fraction of [-1, 0, 0.25, 0.5, 1, 3]) {
    const e = await free();
    spawn(e, `give 2 ${fraction}\nwait 1000`, 800, 500);
    spawn(e, "wait 1000", 815, 500);
    e.step(1);
    const transfer = Math.min(69.999, 70 * Math.max(0, Math.min(1, fraction)));
    assert.ok(Math.abs(detail(e, 1)[1] - (70 - transfer)) < 0.00002);
    assert.ok(Math.abs(detail(e, 2)[1] - (70 + transfer)) < 0.00002);
    assert.ok(Math.abs(snapshot(e).stats[6] - 140) < 0.00002);
    assert.ok(detail(e, 1)[1] >= 0.001);
  }
});

test("fractional giving respects recipient capacity", async () => {
  const e = await free();
  spawn(e, "wait 1000", 800, 500);
  for (let i = 0; i < 3; i++) spawn(e, "give 1 1\nwait 1000", 815, 500);
  e.step(1);
  assert.equal(detail(e, 1)[1], 200);
  assert.ok(Math.abs(snapshot(e).stats[6] - 280) < 0.0001);
  assert.equal(snapshot(e).stats[0], 4);
});

test("unaffordable linked send preserves energy and delivers no message", async () => {
  const e = await free();
  e.set_cost(10, 35);
  spawn(e, "bud r0\nsend 0 0 99\nwait 0\nreceive r1 r2 0\nwait 1000");
  e.step(6);
  assert.equal(detail(e, 1)[11], 0);
  assert.equal(detail(e, 2)[11], 0);
  assert.equal(detail(e, 1)[12], 0);
  assert.equal(detail(e, 2)[12], 0);
  assert.equal(detail(e, 1)[1], 35);
  assert.equal(detail(e, 2)[1], 35);
});

test("shields switch off before exhausting a cell and cannot be reactivated without energy", async () => {
  const e = await free();
  e.set_cost(8, 60);
  spawn(e, "shield 1");
  e.step(100);
  assert.equal(detail(e, 1)[1], 1);
  assert.equal(detail(e, 1)[7], 0);
  e.set_cost(0, 60);
  e.step(1);
  assert.equal(detail(e, 1), null);
});

test("a fed busy cell survives unaffordable instruction and action costs", async () => {
  const e = await engine(42, { legacyCosts: false });
  e.set_cost(1, 10);
  e.set_cost(3, 200);
  spawn(e, "move 1");
  for (let i = 0; i < 300; i++) {
    new Float32Array(e.memory.buffer, e.food_ptr(), 10240).fill(80);
    e.step(60);
    assert.ok(detail(e, 1), `alive at second ${i + 1}`);
  }
});

test("predation can still deplete a victim despite voluntary spending guards", async () => {
  const e = await free();
  spawn(e, "wait 1000", 800, 500);
  spawn(e, "steal 1 3", 815, 500);
  e.step(1);
  assert.equal(detail(e, 1), null);
  assert.ok(detail(e, 2)[1] > 70);
});
