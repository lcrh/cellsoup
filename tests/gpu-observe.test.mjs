import test from "node:test";
import assert from "node:assert/strict";
import {
  snapshot,
  bodyAt,
  largestBody,
  bodyBounds,
  nearest,
} from "../web/gpu/observe.js";
function dish() {
  const data = new ArrayBuffer(208 * 6),
    f = new Float32Array(data),
    u = new Uint32Array(data);
  for (let i = 0; i < 6; i++) {
    u[i * 52 + 31] = 1;
    u[i * 52 + 24] = i + 1;
    f[i * 52] = i * 10;
    f[i * 52 + 1] = 50;
  }
  u[32] = 2;
  u[52 + 32] = 1;
  u[52 + 33] = 3;
  u[104 + 32] = 2;
  return snapshot(data, 100);
}
test("observer finds reciprocal connected components, excluding dead and unilateral links", () => {
  const s = dish();
  s.u[3 * 52 + 32] = 1;
  s.u[4 * 52 + 31] = 0;
  assert.deepEqual(bodyAt(s, 0), [0, 1, 2]);
  assert.deepEqual(largestBody(s), [0, 1, 2]);
  assert.deepEqual(bodyAt(s, 4), []);
  assert.deepEqual(bodyAt(s, -1), []);
  assert.deepEqual(bodyAt(s, 6), []);
});
test("selection and colony bounds wrap through the periodic boundary", () => {
  const s = dish();
  s.f[0] = 98;
  s.f[52] = 2;
  s.f[104] = 6;
  assert.equal(nearest(s, 99, 50, 3), 0);
  assert.equal(nearest(s, 1, 50, 2), 1);
  const b = bodyBounds(s, [0, 1, 2]);
  assert.equal(b.width, 48);
  assert.equal(b.x, 102);
  assert.equal(nearest(s, 50, 0, 1), -1);
});
