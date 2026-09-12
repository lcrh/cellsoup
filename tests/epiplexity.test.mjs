import test from "node:test";
import assert from "node:assert/strict";
import { estimateBehavior, shuffleBehavior } from "../web/gpu/epiplexity.js";
function rng(seed = 71) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}
function noise() {
  const r = rng();
  return Array.from({ length: 32 }, () =>
    Uint8Array.from({ length: 1024 }, () => Math.floor(r() * 16)),
  );
}
function coupled() {
  const frames = noise();
  for (let t = 1; t < 32; t++)
    for (let i = 0; i < 1024; i++) {
      const x = i % 32,
        left = i - x + ((x + 31) % 32);
      frames[t][i] = frames[t - 1][i] ^ frames[t - 1][left];
    }
  return frames;
}
const options = { width: 32, channels: 1 };
test("finite observer separates uniform noise, persistence and learned local coupling", () => {
  const random = estimateBehavior(noise(), options),
    empty = estimateBehavior(
      Array.from({ length: 32 }, () => new Uint8Array(1024)),
      options,
    );
  const initial = noise()[0],
    frozen = estimateBehavior(
      Array.from({ length: 32 }, () => initial.slice()),
      options,
    );
  const structured = estimateBehavior(coupled(), options);
  assert.equal(random.selected.id, "uniform");
  assert.equal(random.epiplexityBits, 4);
  assert.equal(empty.selected.id, "zero");
  assert.equal(empty.unpredictedBitsPerToken, 0);
  assert.equal(frozen.selected.id, "copy1");
  assert.ok(frozen.epiplexityBits < 100);
  assert.equal(structured.selected.id, "neighbors");
  assert.ok(structured.epiplexityBits > frozen.epiplexityBits);
  assert.ok(
    structured.unpredictedBitsPerToken < random.unpredictedBitsPerToken,
  );
});
test("held-out future changes error but cannot change fitted model or selection", () => {
  const a = coupled(),
    b = a.map((f) => f.slice()),
    r = rng(91);
  for (let t = 24; t < 32; t++)
    b[t] = Uint8Array.from(b[t], () => Math.floor(r() * 16));
  const before = estimateBehavior(a, options),
    after = estimateBehavior(b, options);
  assert.deepEqual(before.model, after.model);
  assert.equal(before.selected.validationBits, after.selected.validationBits);
  assert.ok(after.unpredictedBitsPerToken > before.unpredictedBitsPerToken);
});
test("shuffle preserves each channel marginal, destroys ordering and leaves input alone", () => {
  const frames = noise(),
    before = frames.map((f) => f.slice());
  const mixed = shuffleBehavior(frames, 2, 42);
  assert.deepEqual(frames, before);
  assert.deepEqual(mixed, shuffleBehavior(frames, 2, 42));
  assert.notDeepEqual(mixed, frames);
  const histogram = (fs) => {
    const counts = [Array(16).fill(0), Array(16).fill(0)];
    for (const f of fs)
      for (let i = 0; i < f.length; i++) counts[i % 2][f[i]]++;
    return counts;
  };
  assert.deepEqual(histogram(frames), histogram(mixed));
});
test("invalid windows and symbols cannot silently produce a score", () => {
  assert.throws(() => estimateBehavior(noise().slice(1), options), /32-frame/);
  const bad = noise();
  bad[0][0] = 16;
  assert.throws(() => estimateBehavior(bad, options), /alphabet/);
  assert.throws(
    () => estimateBehavior(noise(), { width: 16, channels: 1 }),
    /dimensions/,
  );
});

test("the reported structural bits correspond to a round-trippable prefix code", async () => {
  const { encodeBehaviorModel, decodeBehaviorModel } =
    await import("../web/gpu/epiplexity.js");
  for (const frames of [
    noise(),
    coupled(),
    Array.from({ length: 32 }, () => noise()[0]),
  ]) {
    const e = estimateBehavior(frames, options),
      code = encodeBehaviorModel(e.model, 1);
    assert.equal(code.bitLength, e.epiplexityBits);
    assert.deepEqual(decodeBehaviorModel(code, 1), e.model);
    assert.throws(
      () => decodeBehaviorModel({ ...code, bitLength: code.bitLength - 1 }, 1),
      /Truncated/,
    );
  }
});

test("a contradicted deterministic prediction is exposed rather than refitted on the test block", () => {
  const frames = Array.from({ length: 32 }, () => new Uint8Array(1024));
  frames[24][0] = 1;
  const e = estimateBehavior(frames, options);
  assert.equal(e.selected.id, "zero");
  assert.equal(e.unpredictedBitsPerToken, Infinity);
});
