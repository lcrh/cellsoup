import test from "node:test";
import assert from "node:assert/strict";
import { createLifeEngine } from "../web/gpu/engine.js";
Object.assign(globalThis, {
  GPUBufferUsage: {
    MAP_READ: 1,
    COPY_SRC: 4,
    COPY_DST: 8,
    UNIFORM: 64,
    STORAGE: 128,
  },
  GPUShaderStage: { COMPUTE: 4 },
  GPUMapMode: { READ: 1 },
});
function fakeDevice(fault = {}) {
  const buffers = [];
  let creates = 0;
  return {
    buffers,
    queue: {
      writeBuffer() {},
      submit() {},
      async onSubmittedWorkDone() {
        if (fault.queue) throw Error("lost queue");
      },
    },
    createBuffer({ size, usage }) {
      if (++creates === fault.allocation) throw Error("allocation failed");
      const b = {
        size,
        usage,
        destroyed: false,
        unmapped: false,
        destroy() {
          this.destroyed = true;
        },
        async mapAsync() {
          if (fault.map) throw Error("map failed");
        },
        getMappedRange() {
          if (fault.range) throw Error("range failed");
          return new ArrayBuffer(size);
        },
        unmap() {
          this.unmapped = true;
          if (fault.unmap) throw Error("unmap failed");
        },
      };
      buffers.push(b);
      return b;
    },
    createShaderModule() {
      return {
        async getCompilationInfo() {
          return {
            messages: fault.shader
              ? [
                  {
                    type: "error",
                    message: "invalid shader",
                    lineNum: 1,
                    linePos: 1,
                  },
                ]
              : [],
          };
        },
      };
    },
    createBindGroupLayout() {
      return {};
    },
    createPipelineLayout() {
      return {};
    },
    async createComputePipelineAsync() {
      if (fault.pipeline) throw Error("pipeline failed");
      return {};
    },
    createBindGroup() {
      return {};
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups() {},
            end() {},
          };
        },
        finish() {
          return {};
        },
        copyBufferToBuffer() {
          if (fault.copy) throw Error("copy failed");
        },
      };
    },
  };
}
const cfg = {
  capacity: 1,
  genomeCapacity: 1,
  side: 5,
  sources: 1,
  initial: 0,
  treePrograms: 0,
  forkMutation: 0,
  capacityRate: 0,
  rate: 0,
  floor: 0,
};
test("unsupported large habitats fail before allocating their entity buffers", async () => {
  const d = fakeDevice();
  d.limits = {
    maxStorageBufferBindingSize: 128 * 1024 * 1024,
    maxBufferSize: 256 * 1024 * 1024,
  };
  await assert.rejects(
    createLifeEngine(d, { ...cfg, capacity: 262144, genomeCapacity: 65536 }),
    /smaller population limit/,
  );
  assert.ok(d.buffers.every((b) => b.destroyed));
});
for (const fault of [
  { allocation: 4 },
  { shader: true },
  { pipeline: true },
  { queue: true },
])
  test(
    "partial GPU engine failure destroys prior allocations " +
      JSON.stringify(fault),
    async () => {
      const d = fakeDevice(fault);
      await assert.rejects(createLifeEngine(d, cfg));
      assert.ok(d.buffers.length);
      assert.ok(d.buffers.every((b) => b.destroyed));
    },
  );
for (const stage of ["copy", "map", "range", "unmap"])
  test("readback " + stage + " failure destroys staging buffer", async () => {
    const fault = {},
      d = fakeDevice(fault),
      e = await createLifeEngine(d, cfg);
    try {
      fault[stage] = true;
      await assert.rejects(e.state());
      const staging = d.buffers.filter(
        (b) => (b.usage & GPUBufferUsage.MAP_READ) !== 0,
      );
      assert.equal(staging.length, 1);
      assert.ok(staging[0].destroyed);
      assert.ok(
        d.buffers
          .filter((b) => (b.usage & GPUBufferUsage.MAP_READ) === 0)
          .every((b) => !b.destroyed),
      );
    } finally {
      e.destroy();
    }
    assert.ok(d.buffers.every((b) => b.destroyed));
  });
test("successful readbacks free staging and retain owned simulation buffers", async () => {
  const d = fakeDevice(),
    e = await createLifeEngine(d, cfg);
  const data = await e.state();
  assert.equal(e.entityCapacity, 2 * cfg.capacity);
  assert.equal(data.byteLength, e.entityCapacity * 208);
  const staging = d.buffers.at(-1);
  assert.ok(staging.unmapped && staging.destroyed);
  e.destroy();
  assert.ok(d.buffers.every((b) => b.destroyed));
});
