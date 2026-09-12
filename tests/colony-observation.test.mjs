import test from "node:test";
import assert from "node:assert/strict";
import { observeColonies } from "../research/colony-observation.mjs";

test("colony records preserve periodic coordinates, reciprocal topology and cell state", () => {
  const buffer = new ArrayBuffer(6 * 208),
    f = new Float32Array(buffer),
    u = new Uint32Array(buffer);
  for (let i = 0; i < 6; i++) {
    u[i * 52 + 31] = 1;
    u[i * 52 + 24] = i + 10;
    f[i * 52] = (98 + i * 10) % 100;
    f[i * 52 + 2] = 3;
    f[i * 52 + 4] = 4096 * 12;
    f[i * 52 + 38] = 4096 * 7;
  }
  for (let i = 0; i < 3; i++) {
    u[i * 52 + 32] = i + 2;
    u[(i + 1) * 52 + 33] = i + 1;
  }
  f[3 * 52 + 45] = 0.25;
  f[3 * 52 + 36] = 16;
  u[34] = 3; // Unilateral extra edge inside the component is not a valid spring.
  u[4 * 52 + 32] = 1; // Nor does a unilateral outside cell belong to the body.
  const bodies = observeColonies(buffer, 100);
  assert.equal(bodies.length, 1); // Largest and largest-moving are the same body.
  assert.equal(bodies[0].size, 4);
  assert.equal(bodies[0].speed, 3);
  const cells = bodies[0].cells;
  assert.deepEqual(
    cells.map((c) => c.x),
    [98, 8, 18, 28],
  );
  assert.deepEqual(cells[0].links, [1]);
  assert.deepEqual(cells[0].linkSlots, [1, null, null, null]);
  assert.deepEqual(cells[3].linkSlots, [null, 2, null, null]);
  assert.deepEqual(cells[3].anchors, [0, 0.25, 0, 0]);
  assert.equal(cells[3].rest, 16);
  assert.equal(cells[0].incarnation, 10);
  assert.equal(cells[0].energy, 12);
  assert.equal(cells[0].storage, 7);
  const omitted = observeColonies(buffer, 100, 3);
  assert.equal(omitted[0].size, 4);
  assert.equal(omitted[0].cells, undefined);
  assert.match(omitted[0].omitted, /Whole body/);
});
