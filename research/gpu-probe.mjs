import { create, globals } from "webgpu";
Object.assign(globalThis, globals);
const gpu = create(process.platform === "darwin" ? ["backend=metal"] : []);
globalThis.__headlessGPU = gpu;
const adapter = await gpu.requestAdapter();
if (!adapter) throw Error("No GPU adapter");
console.log(
  JSON.stringify({
    info: adapter.info,
    maxBufferSize: adapter.limits.maxBufferSize,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    features: [...adapter.features],
  }),
);
const device = await adapter.requestDevice();
const shader = device.createShaderModule({
  code: "@group(0) @binding(0) var<storage,read_write> values: array<u32>; @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { if(id.x<64u){values[id.x]=id.x*id.x;} }",
});
const pipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module: shader, entryPoint: "main" },
});
const buffer = device.createBuffer({
  size: 256,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});
const output = device.createBuffer({
  size: 256,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});
const binding = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer } }],
});
const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(pipeline);
pass.setBindGroup(0, binding);
pass.dispatchWorkgroups(1);
pass.end();
encoder.copyBufferToBuffer(buffer, 0, output, 0, 256);
device.queue.submit([encoder.finish()]);
await output.mapAsync(GPUMapMode.READ);
console.log([...new Uint32Array(output.getMappedRange())].slice(-4));
output.unmap();
device.destroy();
delete globalThis.__headlessGPU;
