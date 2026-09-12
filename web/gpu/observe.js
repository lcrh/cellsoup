// CPU snapshots are for occasional observation only, never physics or rendering.
export const stride = 52;
export const wrapDelta = (x, size) => x - Math.floor(x / size + 0.5) * size;
export function snapshot(buffer, world) {
  return {
    f: new Float32Array(buffer),
    u: new Uint32Array(buffer),
    world,
    count: buffer.byteLength / 208,
  };
}
export function bodyAt(s, slot) {
  if (slot < 0 || slot >= s.count || !s.u[slot * stride + 31]) return [];
  const seen = new Set([slot]),
    queue = [slot];
  for (let j = 0; j < queue.length; j++) {
    const k = queue[j] * stride;
    for (let e = 0; e < 4; e++) {
      const other = s.u[k + 32 + e] - 1;
      if (
        other >= 0 &&
        other < s.count &&
        !seen.has(other) &&
        s.u[other * stride + 31]
      ) {
        // Verify reciprocal edges: snapshots must not invent connections.
        let reciprocal = false;
        for (let b = 0; b < 4; b++)
          if (s.u[other * stride + 32 + b] === queue[j] + 1) reciprocal = true;
        if (reciprocal) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
  }
  return queue;
}
export function largestBody(s) {
  const visited = new Uint8Array(s.count);
  let largest = [];
  for (let i = 0; i < s.count; i++)
    if (!visited[i] && s.u[i * stride + 31]) {
      const body = bodyAt(s, i);
      for (const slot of body) visited[slot] = 1;
      if (body.length > largest.length) largest = body;
    }
  return largest;
}
export function nearest(s, x, y, radius) {
  let best = -1,
    distance = radius ** 2;
  for (let i = 0; i < s.count; i++)
    if (s.u[i * stride + 31]) {
      const d =
        wrapDelta(s.f[i * stride] - x, s.world) ** 2 +
        wrapDelta(s.f[i * stride + 1] - y, s.world) ** 2;
      if (d < distance) {
        distance = d;
        best = i;
      }
    }
  return best;
}
export function bodyBounds(s, body) {
  if (!body.length) return null;
  const origin = body[0] * stride,
    x = s.f[origin],
    y = s.f[origin + 1];
  let minX = 0,
    maxX = 0,
    minY = 0,
    maxY = 0;
  for (const slot of body) {
    const dx = wrapDelta(s.f[slot * stride] - x, s.world),
      dy = wrapDelta(s.f[slot * stride + 1] - y, s.world);
    minX = Math.min(minX, dx);
    maxX = Math.max(maxX, dx);
    minY = Math.min(minY, dy);
    maxY = Math.max(maxY, dy);
  }
  return {
    x: x + (minX + maxX) / 2,
    y: y + (minY + maxY) / 2,
    width: maxX - minX + 40,
    height: maxY - minY + 40,
  };
}
