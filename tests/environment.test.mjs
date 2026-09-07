import test from "node:test";
import assert from "node:assert/strict";
import { engine, spawn, snapshot, detail } from "./helpers.mjs";
import { assemble, SENSORS } from "../web/language.js";
const weather = (e) => [
  ...new Float32Array(e.memory.buffer, e.food_process_ptr(), 12),
];
function free(e) {
  for (let i = 0; i < 11; i++) e.set_cost(i, 0);
}
function cell(e, id) {
  const data = snapshot(e).cells;
  for (let k = 0; k < data.length; k += 8)
    if (data[k + 4] === id) return data.slice(k, k + 8);
}
const angularDifference = (a, b) => ((((a - b + 0.5) % 1) + 1) % 1) - 0.5;
test("OU food has the expected variance and temporal correlation, finite nonnegative drops", async () => {
  const e = await engine(246);
  e.configure(24, 8192, 0, 1);
  e.configure_food(2, 0.22, 0.4);
  const a = weather(e)[8];
  assert.ok(Math.abs(a - Math.exp(-0.5 / 2)) < 1e-6);
  let sum = 0,
    squares = 0,
    cross = 0,
    previous = 0,
    n = 0;
  for (let i = 0; i < 12000; i++) {
    e.step(30);
    const w = weather(e),
      x = w[4];
    assert.ok(w.every(Number.isFinite));
    assert.ok(w[5] >= 0 && w[5] < 1600 && w[6] >= 0 && w[6] < 1000);
    assert.ok(w[7] >= 0 && w[7] <= 24);
    if (i >= 1000) {
      sum += x;
      squares += x * x;
      cross += x * previous;
      n++;
    }
    previous = x;
  }
  const mean = sum / n,
    variance = squares / n - mean * mean,
    correlation = (cross / n - mean * mean) / variance;
  assert.ok(Math.abs(mean) < 0.035, `mean ${mean}`);
  assert.ok(Math.abs(variance - 0.16) < 0.02, `variance ${variance}`);
  assert.ok(Math.abs(correlation - a) < 0.025, `correlation ${correlation}`);
});
test("zero food variation fixes amount and position; food randomness is separate from cell behavior", async () => {
  const a = await engine(56),
    b = await engine(56);
  for (const e of [a, b]) {
    e.configure(24, 8192, 0, 1);
    e.configure_food(20, 0, 0);
  }
  spawn(a, "loop: rand r0 90\nturn r0\njmp loop");
  a.step(600);
  b.step(600);
  assert.deepEqual(weather(a), weather(b));
  const w = weather(a);
  assert.equal(w[5], w[0]);
  assert.equal(w[6], w[1]);
  assert.equal(w[7], 8);
  a.configure(24, 8192, 0, 0);
  a.step(30);
  assert.equal(weather(a)[7], 0);
  a.reset(56);
  a.configure_food(20, 0.22, 0.4);
  a.step(600);
  const c = await engine(56);
  c.configure_food(20, 0.22, 0.4);
  c.step(600);
  assert.deepEqual(weather(a), weather(c));
});
test("default baseline drains a waiting cell in about 35 seconds without food", async () => {
  const e = await engine(42, { legacyCosts: false });
  assert.equal(new Float32Array(e.memory.buffer, e.costs_ptr(), 10)[0], 2);
  spawn(e, "wait 36000");
  for (let i = 0; i < 3; i++) e.step(600);
  e.step(240);
  assert.ok(detail(e, 1)[1] > 1.9 && detail(e, 1)[1] < 2.1);
  e.step(120);
  assert.equal(snapshot(e).stats[0], 0);
});
test("instruction cost distinguishes waiting from executing; zero costs are supported", async () => {
  const e = await engine();
  free(e);
  e.set_cost(1, 0.01);
  spawn(e, "nop", 500, 500);
  spawn(e, "wait 1000", 900, 500);
  e.step(10);
  assert.ok(Math.abs(detail(e, 1)[1] - 67.6) < 0.01);
  assert.ok(Math.abs(detail(e, 2)[1] - 69.99) < 0.01);
  e.set_cost(1, 0);
  e.step(100);
  assert.ok(Math.abs(detail(e, 1)[1] - 67.6) < 0.01);
});
test("configured division cost gates birth and conserves the remainder", async () => {
  for (const cost of [30, 60]) {
    const e = await engine();
    free(e);
    e.set_cost(2, cost);
    spawn(e, "split r0\nwait 1000");
    e.step(1);
    assert.equal(snapshot(e).stats[0], cost === 30 ? 2 : 1);
    assert.ok(Math.abs(snapshot(e).stats[6] - (cost === 30 ? 40 : 70)) < 0.001);
  }
});
test("movement, rotation, links, contraction, theft, emission and shield costs are configurable", async () => {
  for (const [kind, source, cost, spent] of [
    [3, "move -0.5", 2, 1],
    [9, "turn 90", 0.2, 18],
    [4, "link 2", 5, 5],
    [5, "contract .8", 2, 2],
    [6, "steal 2 0", 3, 3],
    [7, "emit 0 1", 4, 4],
    [8, "shield 1", 6, 0],
  ]) {
    const e = await engine();
    free(e);
    e.set_cost(kind, cost);
    spawn(e, source + "\nwait 1000", 800, 500);
    spawn(e, "wait 1000", 815, 500);
    e.step(1);
    assert.ok(
      Math.abs(snapshot(e).stats[6] - (140 - spent)) < 0.01,
      `cost ${kind}`,
    );
    if (kind === 8) {
      e.step(60);
      assert.ok(Math.abs(snapshot(e).stats[6] - 134) < 0.01);
    }
  }
});
test("daughter heading jitter is bounded, optional and independent of genome mutation", async () => {
  for (const jitter of [0, 12]) {
    const e = await engine(18);
    e.configure_births(jitter);
    spawn(e, "split r0\nwait 1000", 800, 500, 100, 400);
    const parents = new Map();
    const before = snapshot(e).cells;
    for (let k = 0; k < before.length; k += 8)
      parents.set(before[k + 4], before[k + 6]);
    e.step(1);
    let spread = 0;
    const after = snapshot(e).cells;
    for (let k = 0; k < after.length; k += 8) {
      const d = detail(e, after[k + 4]);
      if (!d[9]) continue;
      const delta = angularDifference(after[k + 6], parents.get(d[9])) * 360;
      assert.ok(Math.abs(delta) <= jitter + 0.0001);
      spread += Math.abs(delta);
    }
    assert.equal(snapshot(e).stats[8], 0);
    assert.equal(snapshot(e).stats[7], 1);
    if (jitter) assert.ok(spread > 300);
    else assert.ok(spread < 0.001);
  }
});
test("forward and backward thrust pull a linked cell through the spring", async () => {
  for (const direction of [-1, 1]) {
    const e = await engine(29);
    free(e);
    // Calibrate only in the test harness; genomes receive no absolute heading sensor.
    const probe = await engine(29);
    spawn(probe, "wait 1000");
    const h = cell(probe, 1)[6] * 360;
    spawn(
      e,
      `turn ${-h}\nlink 2\nloop: move ${direction}\nwait 0\njmp loop`,
      800,
      500,
    );
    spawn(e, "wait 1000", 818, 500);
    e.step(60);
    assert.ok((cell(e, 2)[0] - 818) * direction > 2);
    assert.equal(snapshot(e).stats[4], 1);
  }
});
test("rotating spring anchors tug linked cells, with equal and opposite linear forces", async () => {
  const outcomes = [];
  for (const turn of [-90, 0, 90]) {
    const e = await engine(29);
    free(e);
    spawn(e, `link 2\nwait 1\nturn ${turn}\nwait 1000`, 800, 500);
    spawn(e, "wait 1000", 818, 500);
    e.step(120);
    const a = cell(e, 1),
      b = cell(e, 2);
    assert.equal(snapshot(e).stats[4], 1);
    assert.ok(Math.abs((a[0] + b[0]) / 2 - 809) < 0.02);
    assert.ok(Math.abs((a[1] + b[1]) / 2 - 500) < 0.02);
    outcomes.push(b[1] - 500);
  }
  assert.ok(outcomes[0] * outcomes[2] < 0, JSON.stringify(outcomes));
  assert.ok(Math.abs(outcomes[0]) > 0.1 && Math.abs(outcomes[2]) > 0.1);
  assert.ok(Math.abs(outcomes[1]) < 0.1);
});
test("close unlinked cells repel and ordinary links leave a visible gap", async () => {
  const e = await engine();
  spawn(e, "wait 1000", 800, 500, 2);
  e.step(300);
  const a = cell(e, 1),
    b = cell(e, 2);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 9.5);
  const linked = await engine();
  linked.configure_births(0);
  spawn(linked, "bud r0\nwait 1000");
  linked.step(300);
  const c = cell(linked, 1),
    d = cell(linked, 2);
  assert.ok(Math.hypot(c[0] - d[0], c[1] - d[1]) > 17);
  const line = new Float32Array(linked.memory.buffer, linked.lines_ptr(), 4);
  assert.ok(Math.hypot(line[2] - line[0], line[3] - line[1]) > 10);
});
test("the assembly language exposes relative rotation, never an absolute compass", async () => {
  assert.ok(!SENSORS.includes("heading"));
  assert.throws(() => assemble("sense r0 heading"));
  const e = await engine();
  spawn(e, "turn 90\nsense r0 rotation\nwait 1000");
  e.step(1);
  assert.equal(detail(e, 1)[10], 0); // Unattached cell has no passive angular velocity.
});
