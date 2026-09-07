import test from "node:test";
import assert from "node:assert/strict";
import { engine, spawn, snapshot, detail } from "./helpers.mjs";
import { PRESETS } from "../web/presets.js";
const food = (e) => new Float32Array(e.memory.buffer, e.food_ptr(), 128 * 80);
function facing(e) {
  return snapshot(e).cells[6] * Math.PI * 2;
}
function at(x, y) {
  return (
    (((Math.floor(y / 12.5) % 80) + 80) % 80) * 128 +
    (((Math.floor(x / 12.5) % 128) + 128) % 128)
  );
}
test("food gradient returns relative bearing and strength, including across world seams", async () => {
  for (const [x, y, relative] of [
    [800, 500, 0],
    [800, 500, 90],
    [2, 2, -90],
  ]) {
    const e = await engine(91);
    spawn(e, "gradient r0 r1\nwait 1000", x, y);
    const a = facing(e) + (relative * Math.PI) / 180;
    food(e)[at(x + 25 * Math.cos(a), y + 25 * Math.sin(a))] = 10;
    e.step(1);
    const d = detail(e, 1);
    assert.ok(Math.abs(d[10] - relative) < 1, `${d[10]} versus ${relative}`);
    assert.ok(d[11] > 0.19 && d[11] < 0.21);
  }
  const e = await engine();
  spawn(e, "gradient r0 r1\nwait 1000");
  e.step(1);
  assert.equal(detail(e, 1)[10], 0);
  assert.equal(detail(e, 1)[11], 0);
});
test("color sensors wrap hue, honor tolerance and range, and expose biological color", async () => {
  const e = await engine();
  spawn(e, "color 359\nwait 1000", 820, 500);
  spawn(e, "color 120\nwait 1000", 810, 500);
  e.step(1);
  spawn(
    e,
    "color 240\nscan_color r0 1 3\nscan_color r1 1 1\nscan_color r2 120 2\npeek r3 r0 color\nsense r4 color\nwait 1000",
    800,
    500,
  );
  e.step(1);
  const d = detail(e, 3);
  assert.equal(d[10], 1);
  assert.equal(d[11], 0);
  assert.equal(d[12], 2);
  assert.ok(Math.abs(d[13] - 359) < 0.01);
  assert.ok(Math.abs(d[14] - 240) < 0.01);
  spawn(e, "scan_color r0 359 5\nwait 1000", 950, 500);
  e.step(1);
  assert.equal(detail(e, 4)[10], 0);
});
test("linked mail is delayed one tick, isolated from nearby unlinked cells, and consumed once", async () => {
  const e = await engine();
  spawn(e, "link 2\nsend 0 2 7\nbond r4 0\nwait 1000", 800, 500);
  const receiver =
    "receive r0 r1 2\nwait 0\nreceive r2 r3 2\nreceive r4 r5 2\nwait 1000";
  spawn(e, receiver, 818, 500);
  spawn(e, receiver, 800, 518);
  e.step(1);
  assert.equal(detail(e, 1)[14], 2);
  assert.equal(detail(e, 2)[10], 0);
  assert.equal(detail(e, 2)[11], 0);
  e.step(1);
  assert.equal(detail(e, 2)[12], 7);
  assert.equal(detail(e, 2)[13], 1);
  assert.equal(detail(e, 2)[14], 0);
  assert.equal(detail(e, 2)[15], 0);
  assert.equal(detail(e, 3)[12], 0);
  assert.equal(detail(e, 3)[13], 0);
});
test("targeted linked messages honor channels, preserve zero-valued messages, and charge per recipient", async () => {
  const e = await engine();
  for (let k = 0; k < 11; k++) e.set_cost(k, 0);
  e.set_cost(10, 2);
  spawn(e, "link 2\nlink 3\nsend 2 0 0\nsend 0 1 9\nwait 1000", 800, 500);
  const read = "wait 0\nreceive r0 r1 0\nreceive r2 r3 1\nwait 1000";
  spawn(e, read, 818, 500);
  spawn(e, read, 800, 518);
  e.step(2);
  assert.ok(Math.abs(snapshot(e).stats[6] - 204) < 0.01); // Three deliveries, two energy each.
  assert.equal(detail(e, 2)[10], 0);
  assert.equal(detail(e, 2)[11], 1);
  assert.equal(detail(e, 3)[10], 0);
  assert.equal(detail(e, 3)[11], 0);
  assert.equal(detail(e, 2)[12], 9);
  assert.equal(detail(e, 3)[12], 9);
});
test("message collisions use the last write per channel, and disconnected targets cannot be sent to", async () => {
  const e = await engine();
  spawn(
    e,
    "link 2\nsend 2 0 1\nsend 2 0 2\nunlink 2\nsend 2 0 3\nwait 1000",
    800,
    500,
  );
  spawn(e, "wait 0\nreceive r0 r1 0\nwait 1000", 818, 500);
  e.step(2);
  assert.equal(detail(e, 2)[10], 2);
  assert.equal(detail(e, 2)[11], 1);
  assert.equal(snapshot(e).stats[4], 0);
});
test("linked cells execute an end-to-end weighted ReLU relay", async () => {
  for (const input of [-2, 2]) {
    const e = await engine();
    spawn(e, `link 2\nsend 2 0 ${input}\nwait 1000`, 800, 500);
    spawn(e, "link 3\n" + PRESETS.relu.source, 818, 500);
    spawn(
      e,
      "loop: receive r0 r1 1\njnz r1 done\nwait 0\njmp loop\ndone: wait 1000",
      836,
      500,
    );
    e.step(6);
    assert.ok(
      Math.abs(detail(e, 3)[10] - Math.max(0, input * 0.75 - 0.2)) < 0.0001,
    );
    assert.equal(detail(e, 3)[11], 2);
  }
});
