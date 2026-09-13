import test from "node:test";
import assert from "node:assert/strict";
import { createRenderer } from "../web/gpu/renderer.js";
import { createBehaviorSampler } from "../web/gpu/behavior-sampler.js";
import { createTraceSelector } from "../web/gpu/execution-traces.js";
import { createBehaviorMeter } from "../web/gpu/behavior-meter.js";
import { createExecutionMeter } from "../web/gpu/trace-meter.js";

function environment(t, fault = {}) {
  const names = [
    "GPUBufferUsage",
    "GPUShaderStage",
    "GPUMapMode",
    "document",
    "Worker",
    "devicePixelRatio",
  ];
  const previous = names.map((key) =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  );
  t.after(() =>
    names.forEach((key, i) =>
      previous[i]
        ? Object.defineProperty(globalThis, key, previous[i])
        : delete globalThis[key],
    ),
  );
  globalThis.GPUBufferUsage = {
    STORAGE: 1,
    COPY_SRC: 2,
    COPY_DST: 4,
    MAP_READ: 8,
    UNIFORM: 16,
  };
  globalThis.GPUShaderStage = { COMPUTE: 1, VERTEX: 2, FRAGMENT: 4 };
  globalThis.GPUMapMode = { READ: 1 };
  globalThis.devicePixelRatio = 1;
  const buffers = [],
    workers = [],
    elements = new Map();
  const ctx = {
    scale() {},
    clearRect() {},
    beginPath() {},
    lineTo() {},
    moveTo() {},
    stroke() {},
  };
  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id))
        elements.set(id, {
          checked: true,
          textContent: "",
          onchange: null,
          onclick: null,
          getBoundingClientRect: () => ({ width: 200, height: 100 }),
          getContext: () => ctx,
        });
      return elements.get(id);
    },
  };
  globalThis.Worker = class {
    constructor() {
      if (fault.workerConstructor) throw Error("worker creation failed");
      this.terminations = 0;
      this.messages = [];
      workers.push(this);
    }
    terminate() {
      this.terminations++;
    }
    postMessage(message) {
      if (fault.postMessage) throw Error("worker transfer failed");
      this.messages.push(message);
    }
  };
  const pipeline = {
    getBindGroupLayout() {
      return {};
    },
  };
  let submissions = 0;
  const device = {
    queue: {
      writeBuffer() {},
      submit() {
        submissions++;
      },
    },
    createBuffer({ size, usage }) {
      if (buffers.length + 1 === fault.allocation)
        throw Error("allocation failed");
      const buffer = {
        size,
        usage,
        destructions: 0,
        unmaps: 0,
        mapped: false,
        destroy() {
          this.destructions++;
          this.mapped = false;
        },
        async mapAsync() {
          if (fault.mapGate) await fault.mapGate;
          if (this.destructions) throw Error("destroyed buffer");
          if (this.mapped) throw Error("already mapped");
          this.mapped = true;
        },
        getMappedRange() {
          if (fault.copy) throw Error("copy failed");
          return new ArrayBuffer(size);
        },
        unmap() {
          this.unmaps++;
          this.mapped = false;
        },
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule() {
      return {
        async getCompilationInfo() {
          return {
            messages: fault.shader
              ? [{ type: "error", message: "shader failed" }]
              : [],
          };
        },
      };
    },
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    async createComputePipelineAsync() {
      if (fault.pipeline) throw Error("pipeline failed");
      return pipeline;
    },
    async createRenderPipelineAsync() {
      if (fault.pipeline) throw Error("pipeline failed");
      return pipeline;
    },
    createBindGroup() {
      if (fault.bindGroup) throw Error("bind group failed");
      return {};
    },
    createCommandEncoder() {
      const pass = {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups() {},
        draw() {},
        end() {},
      };
      return {
        clearBuffer() {},
        copyBufferToBuffer() {},
        beginComputePass: () => pass,
        beginRenderPass: () => pass,
        finish: () => ({}),
      };
    },
  };
  let genomeReads = 0,
    traceStops = 0;
  const borrowed = () => ({
    destroy() {
      assert.fail("Borrowed engine resources must not be destroyed");
    },
  });
  const state = [borrowed(), borrowed()];
  const engine = {
    cfg: { capacity: 64, side: 8, seed: 4, treePrograms: 1 },
    tick: 0,
    buffers: {
      state,
      activity: borrowed(),
      food: borrowed(),
      intents: borrowed(),
    },
    currentState: state[0],
    stopExecutionTrace() {
      traceStops++;
    },
    armExecutionTrace() {
      return { collectTick: this.tick + 1 };
    },
    async genome() {
      genomeReads++;
      return {};
    },
    async executionTrace() {
      const data = new Uint32Array(4 + 128 + 8192 + 1048576);
      data.fill(0xffffffff, 4, 132);
      return data.buffer;
    },
  };
  const context = {
    configurations: 0,
    unconfigurations: 0,
    configure() {
      this.configurations++;
    },
    unconfigure() {
      this.unconfigurations++;
    },
    getCurrentTexture: () => ({ createView: () => ({}) }),
  };
  const canvas = {
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 200, height: 100 }),
  };
  return {
    fault,
    buffers,
    workers,
    elements,
    device,
    engine,
    context,
    canvas,
    element: (id) => document.getElementById(id),
    submissions: () => submissions,
    genomeReads: () => genomeReads,
    traceStops: () => traceStops,
  };
}

for (const [name, create, method] of [
  ["behavior sampler", createBehaviorSampler, "sample"],
  ["trace selector", createTraceSelector, "select"],
]) {
  for (const fault of [
    { allocation: 2 },
    { allocation: 3 },
    { pipeline: true },
    { bindGroup: true },
  ]) {
    test(`${name} releases partial initialization after ${JSON.stringify(fault)}`, async (t) => {
      const e = environment(t, fault);
      await assert.rejects(create(e.device, e.engine), /failed/);
      assert.ok(e.buffers.length);
      assert.ok(e.buffers.every((b) => b.destructions === 1));
    });
  }
  test(`${name} unmaps failed copies and can sample again`, async (t) => {
    const e = environment(t, { copy: true });
    const sampler = await create(e.device, e.engine);
    await assert.rejects(sampler[method](123), /copy failed/);
    const readback = e.buffers.find((b) => b.usage & GPUBufferUsage.MAP_READ);
    assert.equal(readback.mapped, false);
    assert.equal(readback.unmaps, 1);
    e.fault.copy = false;
    await sampler[method](123);
    assert.equal(readback.unmaps, 2);
    sampler.destroy();
    sampler.destroy();
    assert.ok(e.buffers.every((b) => b.destructions === 1));
    const submitted = e.submissions();
    await assert.rejects(sampler[method](123), /unavailable/);
    assert.equal(e.submissions(), submitted);
  });
  test(`${name} rejects overlapping readbacks`, async (t) => {
    let resolve;
    const e = environment(t, { mapGate: new Promise((r) => (resolve = r)) });
    const sampler = await create(e.device, e.engine);
    const first = sampler[method](123);
    await assert.rejects(sampler[method](456), /unavailable/);
    resolve();
    await first;
    sampler.destroy();
  });
}

for (const fault of [
  { shader: true },
  { pipeline: true },
  { bindGroup: true },
]) {
  test(`renderer releases failed initialization after ${JSON.stringify(fault)}`, async (t) => {
    const e = environment(t, fault);
    await assert.rejects(
      createRenderer(e.device, e.canvas, e.engine, "rgba8unorm"),
      /failed/,
    );
    assert.equal(e.context.unconfigurations, 1);
    assert.ok(e.buffers.every((b) => b.destructions === 1));
  });
}
test("renderer destruction is idempotent and prevents stale submissions", async (t) => {
  const e = environment(t);
  const renderer = await createRenderer(
    e.device,
    e.canvas,
    e.engine,
    "rgba8unorm",
  );
  renderer.destroy();
  renderer.destroy();
  assert.equal(e.context.unconfigurations, 1);
  assert.ok(e.buffers.every((b) => b.destructions === 1));
  assert.throws(() => renderer.draw({}), /unavailable/);
  assert.equal(e.submissions(), 0);
});

for (const [name, create, prefix] of [
  ["behavior", createBehaviorMeter, "epi"],
  ["trace", createExecutionMeter, "trace"],
]) {
  test(`${name} meter releases handlers and cannot restart after destruction`, async (t) => {
    const e = environment(t);
    const meter = await create(e.device, e.engine);
    const reset = e.element(`${prefix}-enabled`).onchange;
    const exportRecord = e.element(`${prefix}-export`).onclick;
    meter.destroy();
    meter.destroy();
    assert.equal(e.element(`${prefix}-enabled`).onchange, null);
    assert.equal(e.element(`${prefix}-export`).onclick, null);
    reset();
    exportRecord();
    await meter.observe();
    assert.ok(e.buffers.every((b) => b.destructions === 1));
    assert.ok(e.workers.every((w) => w.terminations === 1));
  });
  test(`${name} cleanup preserves handlers installed by its replacement`, async (t) => {
    const e = environment(t);
    const first = await create(e.device, e.engine);
    const second = await create(e.device, e.engine);
    const reset = e.element(`${prefix}-enabled`).onchange;
    const exportRecord = e.element(`${prefix}-export`).onclick;
    first.destroy();
    assert.equal(e.element(`${prefix}-enabled`).onchange, reset);
    assert.equal(e.element(`${prefix}-export`).onclick, exportRecord);
    second.destroy();
  });
}

test("behavior worker errors terminate their worker and remain local", async (t) => {
  const e = environment(t);
  const meter = await createBehaviorMeter(e.device, e.engine);
  e.workers[0].onmessage({ data: { error: "analysis failed" } });
  assert.equal(e.workers[0].terminations, 1);
  assert.match(e.element("epi-status").textContent, /analysis failed/);
  await meter.observe();
  assert.equal(e.submissions(), 0);
  e.element("epi-enabled").onchange();
  e.workers[1].onerror();
  assert.equal(e.workers[1].terminations, 1);
  meter.destroy();
});
test("behavior worker construction failure does not fail the world", async (t) => {
  const e = environment(t, { workerConstructor: true });
  const meter = await createBehaviorMeter(e.device, e.engine);
  assert.match(e.element("epi-status").textContent, /worker creation failed/);
  await meter.observe();
  assert.equal(e.submissions(), 0);
  meter.destroy();
  assert.ok(e.buffers.every((b) => b.destructions === 1));
});
test("behavior transfer failure terminates the worker without escaping observe", async (t) => {
  const e = environment(t, { postMessage: true });
  const meter = await createBehaviorMeter(e.device, e.engine);
  await meter.observe();
  assert.equal(e.workers[0].terminations, 1);
  assert.match(e.element("epi-status").textContent, /worker transfer failed/);
  meter.destroy();
});
test("trace transfer failure terminates compressor and releases pending work", async (t) => {
  const e = environment(t, { postMessage: true });
  const meter = await createExecutionMeter(e.device, e.engine);
  await meter.observe();
  e.engine.tick++;
  await meter.observe();
  assert.equal(e.workers[0].terminations, 1);
  assert.match(e.element("trace-status").textContent, /worker transfer failed/);
  e.fault.postMessage = false;
  e.engine.tick += 3600;
  await meter.observe();
  e.engine.tick++;
  await meter.observe();
  assert.equal(e.workers.length, 2);
  assert.equal(e.workers[1].messages.length, 1);
  meter.destroy();
  assert.equal(e.workers[1].terminations, 1);
});
test("reset during trace selection avoids stale genome readbacks", async (t) => {
  let resolve;
  const e = environment(t, { mapGate: new Promise((r) => (resolve = r)) });
  const meter = await createExecutionMeter(e.device, e.engine);
  const observing = meter.observe();
  e.element("trace-enabled").onchange();
  resolve();
  await observing;
  assert.equal(e.genomeReads(), 0);
  meter.destroy();
});
test("repeated observer replacement leaves no owned GPU buffers or workers live", async (t) => {
  const e = environment(t);
  for (let i = 0; i < 50; i++) {
    const behavior = await createBehaviorMeter(e.device, e.engine);
    const trace = await createExecutionMeter(e.device, e.engine);
    const renderer = await createRenderer(
      e.device,
      e.canvas,
      e.engine,
      "rgba8unorm",
    );
    await behavior.observe();
    behavior.destroy();
    trace.destroy();
    renderer.destroy();
    assert.ok(e.buffers.every((b) => b.destructions === 1));
    assert.ok(e.workers.every((w) => w.terminations === 1));
  }
  assert.equal(e.context.unconfigurations, 50);
});
