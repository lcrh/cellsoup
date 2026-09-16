// Pointer Events cover mouse, pen and touch. CSS touch-action: none on the
// canvas keeps a pinch in the habitat; the rest of the page scrolls normally.
export function attachCameraControls(
  canvas,
  camera,
  { enabled, maxWidth, isFollowing, onNavigate, onPick },
) {
  const pointers = new Map();
  const clampWidth = (width) => Math.min(maxWidth(), Math.max(80, width));
  const pair = () => {
    const [a, b] = pointers.values();
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(b.x - a.x, b.y - a.y),
    };
  };
  const worldPoint = (x, y, r) => ({
    x: camera.x + ((x - r.left - r.width / 2) * camera.width) / r.width,
    y: camera.y + ((y - r.top - r.height / 2) * camera.width) / r.width,
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!enabled() || event.button !== 0) return;
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    });
    // Neither finger of a pinch should select a cell when released.
    if (pointers.size > 1) for (const p of pointers.values()) p.moved = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const before = pointers.size > 1 ? pair() : null;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!enabled()) {
      pointer.moved = true;
      return;
    }
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (before) {
      const after = pair();
      const anchor = worldPoint(before.x, before.y, r);
      if (before.distance > 0 && after.distance > 0)
        camera.width = clampWidth(
          (camera.width * before.distance) / after.distance,
        );
      // Keep the world point under the midpoint, including two-finger panning
      // and at the zoom limits. A lifted finger naturally continues as a pan.
      camera.x =
        anchor.x - ((after.x - r.left - r.width / 2) * camera.width) / r.width;
      camera.y =
        anchor.y - ((after.y - r.top - r.height / 2) * camera.width) / r.width;
    } else {
      if (
        Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 4
      )
        pointer.moved = true;
      if (!pointer.moved) return;
      camera.x -= (dx * camera.width) / r.width;
      camera.y -= (dy * camera.width) / r.width;
    }
    camera.overview = false;
    onNavigate();
  });
  const finish = (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    if (event.type === "pointerup" && !pointer.moved && enabled()) {
      const r = canvas.getBoundingClientRect();
      if (r.width && r.height)
        onPick({
          ...worldPoint(event.clientX, event.clientY, r),
          radius: Math.max(8, (camera.width / r.width) * 12),
        });
    }
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(type, finish);
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!enabled()) return;
      event.preventDefault();
      const r = canvas.getBoundingClientRect(),
        old = camera.width;
      if (!r.width || !r.height) return;
      camera.overview = false;
      camera.width = clampWidth(old * Math.exp(event.deltaY * 0.0015));
      if (!isFollowing()) {
        camera.x +=
          ((event.clientX - r.left - r.width / 2) / r.width) *
          (old - camera.width);
        camera.y +=
          ((event.clientY - r.top - r.height / 2) / r.width) *
          (old - camera.width);
      }
    },
    { passive: false },
  );
}
