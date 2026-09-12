import { snapshot, bodyAt, bodyMotion } from "../web/gpu/observe.js";

// Read only at research observation times. This adds no work to the live UI.
export async function readCellActivity(device, engine) {
  const size = engine.cfg.capacity * 32;
  const output = device.createBuffer({
    size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(engine.buffers.activity, 0, output, 0, size);
    device.queue.submit([encoder.finish()]);
    await output.mapAsync(GPUMapMode.READ);
    return new Uint32Array(output.getMappedRange().slice(0));
  } finally {
    output.destroy();
  }
}
export function cellActivity(stateWords, activityWords, slot) {
  const k = slot * 52,
    a = slot * 8;
  if (stateWords[k + 31] !== 1 || activityWords[a + 2] !== stateWords[k + 24])
    return null;
  return {
    lastThrustTick: activityWords[a],
    lastAttackTick: activityWords[a + 1],
    lastEatTick: activityWords[a + 3],
  };
}
export function summarizeColonyActivity(
  buffer,
  activity,
  tick,
  world,
  windowTicks = 60,
) {
  const s = snapshot(buffer, world);
  if (activity.length !== s.count * 8)
    throw Error("Activity length does not match cell state");
  if (
    !Number.isInteger(tick) ||
    tick < 0 ||
    !Number.isInteger(windowTicks) ||
    windowTicks < 1
  )
    throw Error("Invalid observation tick/window");
  const seen = new Uint8Array(s.count);
  const result = {
    recentThrustWindowTicks: windowTicks,
    recentThrustCells: 0,
    movingBodiesWithRecentThrust: 0,
    movingBodyCellsWithRecentThrust: 0,
    largestMovingBodyWithRecentThrust: 0,
    movingBodiesWithoutRecentThrust: 0,
  };
  for (let i = 0; i < s.count; i++) {
    if (seen[i] || s.u[i * 52 + 31] !== 1) continue;
    const body = bodyAt(s, i);
    let motors = 0;
    for (const slot of body) {
      seen[slot] = 1;
      const mark = cellActivity(s.u, activity, slot)?.lastThrustTick ?? 0;
      if (mark > 0 && mark <= tick && tick - mark < windowTicks) motors++;
    }
    result.recentThrustCells += motors;
    if (body.length < 4 || bodyMotion(s, body) <= 2) continue;
    if (motors) {
      result.movingBodiesWithRecentThrust++;
      result.movingBodyCellsWithRecentThrust += body.length;
      result.largestMovingBodyWithRecentThrust = Math.max(
        result.largestMovingBodyWithRecentThrust,
        body.length,
      );
    } else result.movingBodiesWithoutRecentThrust++;
  }
  return result;
}
