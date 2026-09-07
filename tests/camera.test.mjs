import test from "node:test";
import assert from "node:assert/strict";
import { shortestDelta, followBody, fitBody } from "../web/camera.js";
test("tracking uses the nearest periodic image in both directions", () => {
  const d = new Float32Array(32);
  d[26] = 2;
  d[27] = 4;
  assert.deepEqual(followBody([1599, 999], d), [1602, 1004]);
  d[26] = 1598;
  d[27] = 997;
  assert.deepEqual(followBody([1, 1], d), [-2, -3]);
  assert.equal(shortestDelta(3204, 1600), 4);
});
test("focus fits a body with padding and keeps zoom bounded", () => {
  const d = new Float32Array(32);
  d[28] = 250;
  d[29] = 400;
  const z = fitBody(d, 800, 600, 0.5);
  assert.ok((d[28] + 50) * z * 0.5 <= 800 * 0.75 + 0.001);
  assert.ok((d[29] + 50) * z * 0.5 <= 600 * 0.65 + 0.001);
  d[28] = d[29] = 8;
  assert.ok(fitBody(d, 2000, 1200, 1) <= 12);
});
