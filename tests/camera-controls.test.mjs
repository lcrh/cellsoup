import test from "node:test";
import assert from "node:assert/strict";
import { attachCameraControls } from "../web/gpu/camera-controls.js";

function fixture() {
  const canvas = new EventTarget(),
    captures = new Set(),
    picks = [];
  const rect = { left: 20, top: 40, width: 400, height: 600 };
  canvas.getBoundingClientRect = () => rect;
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => captures.delete(id);
  const camera = { x: 1000, y: 1000, width: 800, overview: true };
  let following = true,
    enabled = true;
  attachCameraControls(canvas, camera, {
    enabled: () => enabled,
    maxWidth: () => 1600,
    isFollowing: () => following,
    onNavigate: () => {
      following = false;
    },
    onPick: (p) => picks.push(p),
  });
  const send = (type, id, x, y, extra = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      pointerId: id,
      clientX: x,
      clientY: y,
      button: 0,
      ...extra,
    });
    canvas.dispatchEvent(event);
    return event;
  };
  const point = (x, y) => ({
    x:
      camera.x + ((x - rect.left - rect.width / 2) * camera.width) / rect.width,
    y:
      camera.y + ((y - rect.top - rect.height / 2) * camera.width) / rect.width,
  });
  return {
    camera,
    captures,
    picks,
    send,
    point,
    following: () => following,
    enable: (value) => {
      enabled = value;
    },
  };
}
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

test("pinch scales around its moving midpoint on a portrait canvas", () => {
  const f = fixture(),
    anchor = f.point(170, 200);
  f.send("pointerdown", 1, 120, 200);
  f.send("pointerdown", 2, 220, 200);
  f.send("pointermove", 2, 320, 200);
  close(f.camera.width, 400);
  close(f.point(220, 200).x, anchor.x);
  close(f.point(220, 200).y, anchor.y);
  assert.equal(f.following(), false);
  assert.equal(f.camera.overview, false);
  f.send("pointerup", 2, 320, 200);
  const before = f.camera.x;
  f.send("pointermove", 1, 140, 200);
  close(f.camera.x, before - 20);
  f.send("pointerup", 1, 140, 200);
  assert.deepEqual(f.picks, []);
  assert.equal(f.captures.size, 0);
});

test("pinch supports zooming out, limits and coincident fingers without invalid camera values", () => {
  const f = fixture();
  f.send("pointerdown", 1, 120, 200);
  f.send("pointerdown", 2, 320, 200);
  f.send("pointermove", 2, 220, 200);
  assert.equal(f.camera.width, 1600);
  f.send("pointermove", 2, 121, 200);
  assert.equal(f.camera.width, 1600);
  f.send("pointermove", 2, 120, 200);
  f.send("pointermove", 2, 220, 200);
  f.send("pointermove", 2, 4220, 200);
  assert.equal(f.camera.width, 80);
  assert.ok(Number.isFinite(f.camera.x) && Number.isFinite(f.camera.y));
});

test("cancelled gestures and lost capture never pick or leave stale fingers", () => {
  for (const end of ["pointercancel", "lostpointercapture"]) {
    const f = fixture();
    f.send("pointerdown", 1, 120, 200);
    f.send("pointerdown", 2, 220, 200);
    f.send(end, 2, 220, 200);
    f.send("pointerup", 1, 120, 200);
    assert.equal(f.picks.length, 0);
    const before = { ...f.camera };
    f.send("pointermove", 2, 900, 900);
    assert.deepEqual(f.camera, before);
    f.send("pointerdown", 3, 220, 340);
    f.send("pointerup", 3, 220, 340);
    assert.deepEqual(f.picks, [{ x: 1000, y: 1000, radius: 24 }]);
  }
});

test("mouse drag, taps, wheel follow and pointer-anchored wheel zoom still work", () => {
  const f = fixture();
  assert.equal(
    f.send("wheel", 0, 120, 200, { deltaY: -100 }).defaultPrevented,
    true,
  );
  assert.equal(f.camera.x, 1000);
  assert.equal(f.camera.y, 1000);
  f.send("pointerdown", 1, 120, 200);
  f.send("pointermove", 1, 140, 220);
  f.send("pointerup", 1, 140, 220);
  assert.equal(f.picks.length, 0);
  assert.equal(f.following(), false);
  const anchor = f.point(120, 200);
  f.send("wheel", 0, 120, 200, { deltaY: 100 });
  close(f.point(120, 200).x, anchor.x);
  close(f.point(120, 200).y, anchor.y);
  f.send("pointerdown", 2, 220, 340);
  f.send("pointerup", 2, 220, 340);
  assert.equal(f.picks.length, 1);
  f.enable(false);
  f.send("pointerdown", 3, 120, 200);
  f.send("pointermove", 3, 100, 200);
  f.send("pointerup", 3, 100, 200);
  assert.equal(f.picks.length, 1);
  assert.equal(
    f.send("wheel", 0, 120, 200, { deltaY: 100 }).defaultPrevented,
    false,
  );
});
