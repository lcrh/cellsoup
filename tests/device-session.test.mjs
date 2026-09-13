import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeviceSession,
  describeGpuFailure,
} from "../web/gpu/device-session.js";

function fixture() {
  const devices = [],
    failures = [],
    events = [];
  const gpu = {
    async requestAdapter() {
      events.push("adapter");
      return {
        async requestDevice() {
          let lose;
          const listeners = {};
          const d = {
            lost: new Promise((resolve) => {
              lose = resolve;
            }),
            addEventListener(name, fn) {
              listeners[name] = fn;
            },
            destroy() {
              events.push("destroy");
              this.destroyed = true;
              lose({ reason: "destroyed" });
            },
            lose,
            error(error) {
              listeners.uncapturederror({ error });
            },
          };
          devices.push(d);
          return d;
        },
      };
    },
  };
  return {
    devices,
    failures,
    events,
    gpu,
    session: createDeviceSession(gpu, (error) => failures.push(error)),
  };
}

test("healthy worlds reuse a device; disposal releases it before reconnecting", async () => {
  const { session, devices, events } = fixture();
  assert.equal(await session.connect(), await session.connect());
  assert.equal(devices.length, 1);
  session.dispose();
  await session.connect();
  assert.deepEqual(events, ["adapter", "destroy", "adapter"]);
  assert.equal(devices.length, 2);
});
test("device loss preserves the actual reason and prevents further work until reconnect", async () => {
  const { session, failures } = fixture();
  const device = await session.connect();
  device.lose({
    reason: "unknown",
    message: "GPU reset during command execution",
  });
  await Promise.resolve();
  assert.equal(failures.length, 1);
  assert.match(failures[0].message, /GPU reset/);
  assert.throws(() => session.check(), failures[0]);
  await assert.rejects(session.connect(), failures[0]);
  session.dispose();
  await session.connect();
  session.check();
});
test("retired device errors and deliberate destruction cannot stop the replacement world", async () => {
  const { session, failures } = fixture();
  const old = await session.connect();
  session.dispose();
  await session.connect();
  old.error(new Error("late validation error"));
  await Promise.resolve();
  assert.equal(failures.length, 0);
  session.check();
});
test("uncaptured errors retain their type for useful recovery guidance", async () => {
  const { session, failures } = fixture();
  const device = await session.connect();
  const error = Object.assign(new Error("allocation failed"), {
    name: "GPUOutOfMemoryError",
  });
  device.error(error);
  assert.equal(failures[0], error);
  assert.throws(() => session.check(), error);
  assert.match(
    describeGpuFailure(error, { seed: 42, tick: 3600 }),
    /lower entity capacity/,
  );
});
test("cancelled startup releases its late-arriving device", async () => {
  const { gpu, session, devices } = fixture();
  let resume;
  const adapter = await gpu.requestAdapter();
  gpu.requestAdapter = () =>
    new Promise((resolve) => {
      resume = () => resolve(adapter);
    });
  const pending = session.connect();
  session.dispose();
  resume();
  await assert.rejects(pending, /cancelled/);
  assert.equal(devices[0].destroyed, true);
});
test("unavailable adapter during recovery is distinguished from unsupported WebGPU", async () => {
  const { gpu, session } = fixture();
  await session.connect();
  session.dispose();
  gpu.requestAdapter = async () => null;
  await assert.rejects(session.connect(), /could not reconnect/);
  await assert.rejects(
    createDeviceSession(null, () => {}).connect(),
    /unavailable in this browser/,
  );
});
test("ordinary runtime failures show seed and tick without blaming browser support", () => {
  const text = describeGpuFailure(
    new Error("Missing archived tree genotype 123"),
    { seed: 42, tick: 9876 },
  );
  assert.match(text, /genotype 123/);
  assert.match(text, /World 42, tick 9876/);
  assert.doesNotMatch(text, /capable|enabled|unavailable|connection was lost/);
});

test("WebGPU error objects without Error.name still identify memory and validation failures", () => {
  class GPUOutOfMemoryError {
    message = "allocation failed";
  }
  class GPUValidationError {
    message = "invalid buffer";
  }
  assert.match(
    describeGpuFailure(new GPUOutOfMemoryError()),
    /ran out of memory/,
  );
  assert.match(
    describeGpuFailure(new GPUValidationError()),
    /GPU validation failed: invalid buffer/,
  );
});

test("secondary validation errors cannot hide the initial failure, but device loss retains its reason", async () => {
  const { session, failures } = fixture();
  const device = await session.connect();
  const first = new Error("allocation failed");
  device.error(first);
  device.error(new Error("subsequent invalid buffer"));
  assert.deepEqual(failures, [first]);
  device.lose({ reason: "unknown", message: "device reset" });
  await Promise.resolve();
  assert.equal(failures.length, 2);
  assert.match(failures[1].message, /device reset/);
});
