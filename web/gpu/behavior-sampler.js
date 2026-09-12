import { CHANNELS, SAMPLE_TICKS } from "./epiplexity.js";
export const BEHAVIOR_GRID = 32,
  BIN_WORDS = 9;
export function behaviorSymbols(bins, width = BEHAVIOR_GRID) {
  if (bins.length !== width * width * BIN_WORDS)
    throw Error("Invalid behavior bins");
  const symbols = new Uint8Array(width * width * CHANNELS);
  for (let tile = 0; tile < width * width; tile++) {
    const k = tile * BIN_WORDS,
      n = bins[k],
      o = tile * CHANNELS;
    if (!n) continue;
    const vx = bins[k + 2] / (16 * n),
      vy = bins[k + 3] / (16 * n);
    symbols[o] = Math.min(15, 1 + Math.floor(Math.log2(n)));
    symbols[o + 1] = Math.min(4, Math.round((4 * bins[k + 1]) / n));
    symbols[o + 2] =
      Math.hypot(vx, vy) > 1
        ? 1 + ((Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8)
        : 0;
    symbols[o + 3] =
      Number(bins[k + 4] > 0) +
      2 * Number(bins[k + 5] > 0) +
      4 * Number(bins[k + 6] > 0);
    symbols[o + 4] = Math.min(
      15,
      Math.floor(2 * Math.log2(1 + bins[k + 7] / (16 * n))),
    );
    symbols[o + 5] = Math.min(
      15,
      Math.floor(2 * Math.log2(1 + bins[k + 8] / (4 * n))),
    );
  }
  return symbols;
}
const shader = `
struct Cell {p:vec4f,b:vec4f,r:array<f32,8>,signal:vec4f,mail:vec4f,machine:vec4u,life:vec4u,link:vec4u,res:vec4f,sender:vec4u,anchors:vec4f,phen:vec4f}
struct Activity {marks:vec4u,impact:vec4f}
@group(0) @binding(0) var<storage,read> cells:array<Cell>;
@group(0) @binding(1) var<storage,read> activity:array<Activity>;
@group(0) @binding(2) var<storage,read_write> bins:array<atomic<i32>>;
@group(0) @binding(3) var<uniform> config:vec4u;
fn recent(mark:u32)->bool{return mark>0u&&mark<=config.y&&config.y-mark<60u;}
@compute @workgroup_size(128) fn collect(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=config.x){return;}let c=cells[i];if(c.life.w!=1u){return;}
 let xy=vec2u(floor(fract(c.p.xy/f32(config.z))*f32(config.w)));
 let k=(xy.y*config.w+xy.x)*9u;
 atomicAdd(&bins[k],1);
 var linked=false;
 for(var b=0u;b<4u;b++){let h=c.link[b];if(h>0u&&h<=config.x){let other=cells[h-1u];if(other.life.w==1u&&any(other.link==vec4u(i+1u))){linked=true;}}}
 if(linked){atomicAdd(&bins[k+1u],1);}
 atomicAdd(&bins[k+2u],i32(round(clamp(c.p.z,-128.0,128.0)*16.0)));
 atomicAdd(&bins[k+3u],i32(round(clamp(c.p.w,-128.0,128.0)*16.0)));
 let a=activity[i];if(a.marks.z==c.machine.x){
  if(recent(a.marks.x)){atomicAdd(&bins[k+4u],1);}
  if(recent(a.marks.y)){atomicAdd(&bins[k+5u],1);}
  if(recent(a.marks.w)){atomicAdd(&bins[k+6u],1);}
 }
 atomicAdd(&bins[k+7u],i32(round(clamp(c.b.x/4096.0,0.0,200.0)*16.0)));
 atomicAdd(&bins[k+8u],i32(round(clamp(c.res.z/4096.0,0.0,1000.0)*4.0)));
}`;
export async function createBehaviorSampler(device, engine) {
  const bytes = BEHAVIOR_GRID ** 2 * BIN_WORDS * 4;
  const bins = device.createBuffer({
    size: bytes,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  const readback = device.createBuffer({
    size: bytes,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const config = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let pipeline;
  try {
    pipeline = await device.createComputePipelineAsync({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: shader }),
        entryPoint: "collect",
      },
    });
  } catch (error) {
    bins.destroy();
    readback.destroy();
    config.destroy();
    throw error;
  }
  const groups = engine.buffers.state.map((state) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [state, engine.buffers.activity, bins, config].map(
        (buffer, binding) => ({ binding, resource: { buffer } }),
      ),
    }),
  );
  let busy = false,
    destroyed = false;
  return {
    async sample() {
      if (busy || destroyed) throw Error("Behavior sampler unavailable");
      busy = true;
      try {
        const tick = engine.tick;
        device.queue.writeBuffer(
          config,
          0,
          new Uint32Array([
            engine.cfg.capacity,
            tick,
            engine.cfg.side * 32,
            BEHAVIOR_GRID,
          ]),
        );
        const encoder = device.createCommandEncoder();
        encoder.clearBuffer(bins);
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(
          0,
          groups[engine.currentState === engine.buffers.state[0] ? 0 : 1],
        );
        pass.dispatchWorkgroups(Math.ceil(engine.cfg.capacity / 128));
        pass.end();
        encoder.copyBufferToBuffer(bins, 0, readback, 0, bytes);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const data = new Int32Array(readback.getMappedRange().slice(0));
        readback.unmap();
        return {
          tick,
          symbols: behaviorSymbols(data),
          living: data.reduce(
            (a, n, i) => a + (i % BIN_WORDS === 0 ? n : 0),
            0,
          ),
        };
      } finally {
        busy = false;
      }
    },
    destroy() {
      destroyed = true;
      bins.destroy();
      readback.destroy();
      config.destroy();
    },
    readbackBytes: bytes,
    sampleTicks: SAMPLE_TICKS,
  };
}
