import test from "node:test";
import assert from "node:assert/strict";
import {
  cellActivity,
  summarizeColonyActivity,
} from "../research/colony-activity.mjs";
function fixture() {
  const state = new ArrayBuffer(9 * 208),
    f = new Float32Array(state),
    u = new Uint32Array(state),
    activity = new Uint32Array(9 * 8);
  for (let i = 0; i < 9; i++) {
    u[i * 52 + 24] = i + 10;
    u[i * 52 + 31] = 1;
    f[i * 52 + 2] = 3;
    activity[i * 8 + 2] = i + 10;
  }
  for (const start of [0, 4])
    for (let i = start; i < start + 3; i++) {
      u[i * 52 + 32] = i + 2;
      u[(i + 1) * 52 + 33] = i + 1;
    }
  return { state, f, u, activity };
}
test("recent thrust distinguishes moving groups from motion alone", () => {
  const { state, u, activity } = fixture();
  activity[0] = 100;
  activity[1] = 98;
  activity[3] = 99;
  activity[8 * 8] = 100; // A separate single cell is not a colony motor.
  const r = summarizeColonyActivity(state, activity, 100, 1000);
  assert.equal(r.recentThrustCells, 2);
  assert.equal(r.movingBodiesWithRecentThrust, 1);
  assert.equal(r.movingBodyCellsWithRecentThrust, 4);
  assert.equal(r.largestMovingBodyWithRecentThrust, 4);
  assert.equal(r.movingBodiesWithoutRecentThrust, 1);
  assert.deepEqual(cellActivity(u, activity, 0), {
    lastThrustTick: 100,
    lastAttackTick: 98,
    lastEatTick: 99,
  });
});
test("stale slots, dead cells, future marks and the age boundary cannot invent thrust", () => {
  const { state, u, activity } = fixture();
  activity[0] = 100;
  activity[2] = 999;
  activity[8] = 100;
  u[52 + 31] = 2;
  activity[4 * 8] = 40; // Exactly sixty ticks old is excluded.
  activity[5 * 8] = 101;
  assert.equal(cellActivity(u, activity, 0), null);
  assert.equal(cellActivity(u, activity, 1), null);
  const r = summarizeColonyActivity(state, activity, 100, 1000);
  assert.equal(r.recentThrustCells, 0);
  assert.equal(r.movingBodiesWithRecentThrust, 0);
  assert.equal(r.movingBodiesWithoutRecentThrust, 1);
  activity[4 * 8] = 41;
  assert.equal(
    summarizeColonyActivity(state, activity, 100, 1000).recentThrustCells,
    1,
  );
  assert.throws(
    () => summarizeColonyActivity(state, activity.subarray(1), 100, 1000),
    /length/,
  );
});
test("thrust alone does not make a stationary group count as moving", () => {
  const { state, f, activity } = fixture();
  for (let i = 0; i < 4; i++) f[i * 52 + 2] = 0;
  activity[0] = 100;
  const r = summarizeColonyActivity(state, activity, 100, 1000);
  assert.equal(r.recentThrustCells, 1);
  assert.equal(r.movingBodiesWithRecentThrust, 0);
  assert.equal(r.movingBodiesWithoutRecentThrust, 1);
});
