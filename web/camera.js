// Keep tracked bodies continuous when their cells cross the periodic world edges.
export function shortestDelta(value, size) {
  return value - Math.floor(value / size + 0.5) * size;
}
export function followBody(center, detail) {
  return [
    center[0] + shortestDelta(detail[26] - center[0], 1600),
    center[1] + shortestDelta(detail[27] - center[1], 1000),
  ];
}
export function fitBody(detail, width, height, baseScale) {
  const spanX = Math.max(90, detail[28] + 50),
    spanY = Math.max(90, detail[29] + 50);
  return Math.max(
    0.5,
    Math.min(
      12,
      Math.min((width * 0.75) / spanX, (height * 0.65) / spanY) / baseScale,
    ),
  );
}
