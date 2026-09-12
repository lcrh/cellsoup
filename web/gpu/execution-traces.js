export const TRACE_CELLS = 32,
  TRACE_TICKS = 256,
  TRACE_STEPS = 128;
const selectionShader = `
struct Output { winners:array<atomic<u32>,32>, selected:array<vec4u,32> }
@group(0) @binding(0) var<storage,read> cells:array<u32>;
@group(0) @binding(1) var<storage,read_write> result:Output;
@group(0) @binding(2) var<uniform> cfg:vec4u;
fn hash(x:u32)->u32{var z=x+0x9e3779b9u;z=(z^(z>>16u))*0x21f0aaadu;z=(z^(z>>15u))*0x735a2d97u;return z^(z>>15u);}
@compute @workgroup_size(128) fn choose(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=cfg.x||cells[i*52u+31u]!=1u){return;}
 let h=hash(i^cfg.y);let bucket=h&31u;let rank=((h>>5u)&8191u)<<18u;
 atomicMin(&result.winners[bucket],rank|i);
}
@compute @workgroup_size(32) fn resolve(@builtin(global_invocation_id) id:vec3u){
 let b=id.x;if(b>=32u){return;}let packed=atomicLoad(&result.winners[b]);
 if(packed==0xffffffffu){result.selected[b]=vec4u(0xffffffffu);return;}
 let i=packed&262143u;result.selected[b]=vec4u(i,cells[i*52u+24u],cells[i*52u+25u],0u);
}`;
export async function createTraceSelector(device, engine) {
  const result = device.createBuffer({
    size: 640,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  const config = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const readback = device.createBuffer({
    size: 512,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const module = device.createShaderModule({ code: selectionShader });
  const layout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [layout],
  });
  const pipelines = await Promise.all(
    ["choose", "resolve"].map((entryPoint) =>
      device.createComputePipelineAsync({
        layout: pipelineLayout,
        compute: { module, entryPoint },
      }),
    ),
  );
  const groups = engine.buffers.state.map((state) =>
    device.createBindGroup({
      layout,
      entries: [state, result, config].map((buffer, binding) => ({
        binding,
        resource: { buffer },
      })),
    }),
  );
  return {
    async select(seed) {
      device.queue.writeBuffer(result, 0, new Uint32Array(32).fill(0xffffffff));
      device.queue.writeBuffer(
        config,
        0,
        new Uint32Array([engine.cfg.capacity, seed >>> 0, 0, 0]),
      );
      const encoder = device.createCommandEncoder(),
        group = groups[engine.buffers.state.indexOf(engine.currentState)];
      for (let i = 0; i < 2; i++) {
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipelines[i]);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(i ? 1 : Math.ceil(engine.cfg.capacity / 128));
        pass.end();
      }
      encoder.copyBufferToBuffer(result, 128, readback, 0, 512);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const selected = new Uint32Array(readback.getMappedRange().slice(0));
      readback.unmap();
      return selected;
    },
    destroy() {
      result.destroy();
      config.destroy();
      readback.destroy();
    },
  };
}
export function unpackExecutionTrace(buffer) {
  const words = new Uint32Array(buffer),
    countsOffset = 4 + 128,
    eventsOffset = countsOffset + 8192;
  if (words.length !== eventsOffset + 1048576)
    throw Error("Invalid trace buffer size");
  const cells = [];
  for (let i = 0; i < 32; i++) {
    const k = 4 + i * 4;
    if (words[k] === 0xffffffff) continue;
    const frames = [];
    for (let t = 0; t < 256; t++) {
      const row = i * 256 + t,
        count = words[countsOffset + row];
      if (count > 128) throw Error("Trace count exceeds VM budget");
      frames.push(
        words.slice(eventsOffset + row * 128, eventsOffset + row * 128 + count),
      );
    }
    cells.push({
      slot: words[k],
      identity: words[k + 1],
      genomeSlot: words[k + 2],
      frames,
    });
  }
  return {
    version: "execution-path-v1",
    beginTick: words[0],
    endTickExclusive: words[1],
    seed: words[2],
    cells,
  };
}
