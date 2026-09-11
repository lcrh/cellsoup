// Scaling experiment, not the production ecology. Immutable inputs and per-cell
// outputs keep neighbor reads race-free. Hash insertion uses integer atomics.
export const shader = /* wgsl */ `
struct Cell { pv: vec4f, he: vec4f, r: array<f32,8>, pc: u32, sleep: u32, prev: u32, next: u32 }
struct Config { count:u32, bins:u32, side:u32, budget:u32, width:f32, dt:f32, tick:u32, pad:u32 }
@group(0) @binding(0) var<storage,read> input: array<Cell>;
@group(0) @binding(1) var<storage,read_write> output: array<Cell>;
@group(0) @binding(2) var<storage,read_write> heads: array<atomic<u32>>;
@group(0) @binding(3) var<storage,read_write> next: array<u32>;
@group(0) @binding(4) var<storage,read> code: array<vec4f>;
@group(0) @binding(5) var<uniform> cfg:Config;
const NONE:u32=0xffffffffu;
fn bin(p:vec2f)->u32 { let b=vec2u(floor(p/32.0)); return b.y*cfg.side+b.x; }
fn delta(a:vec2f,b:vec2f)->vec2f { let d=a-b; return d-round(d/cfg.width)*cfg.width; }
fn value(x:f32,c:Cell)->f32 { if(x<=-1000000.0){return c.r[u32(-x-1000000.0)%8u];} return x; }
fn nutrient(p:vec2f)->f32 { let d=delta(p,vec2f(cfg.width*.5));return exp(-dot(d,d)/(cfg.width*cfg.width*.02)); }
@compute @workgroup_size(128) fn clear(@builtin(global_invocation_id) id:vec3u) {
 if(id.x<cfg.bins){atomicStore(&heads[id.x],NONE);}
}
@compute @workgroup_size(128) fn index(@builtin(global_invocation_id) id:vec3u) {
 if(id.x<cfg.count){next[id.x]=atomicExchange(&heads[bin(input[id.x].pv.xy)],id.x);}
}
@compute @workgroup_size(128) fn simulate(@builtin(global_invocation_id) id:vec3u) {
 let i=id.x;if(i>=cfg.count){return;}var c=input[i];
 let base=vec2i(floor(c.pv.xy/32.0));var force=vec2f(0);var nearest=NONE;var closest=900.0;
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){
  let b=(base+vec2i(x,y)+vec2i(i32(cfg.side)))%vec2i(i32(cfg.side));
  var j=atomicLoad(&heads[u32(b.y)*cfg.side+u32(b.x)]);
  loop {if(j==NONE){break;}if(j!=i){let d=delta(c.pv.xy,input[j].pv.xy);let q=dot(d,d);
   if(q<closest || (q==closest && j<nearest)){closest=q;nearest=j;}
   if(q<100.0 && q>0.000001){let dist=sqrt(q);force+=d*((10.0-dist)*55.0/dist);}
  } j=next[j];}
 }}
 for(var k=0u;k<2u;k++){let j=select(c.prev,c.next,k==1u);if(j!=NONE){let d=delta(input[j].pv.xy,c.pv.xy);let dist=length(d);if(dist>.00001){force+=d*((dist-18.0)*24.0/dist);}}}
 let genome=(i/8u)%4096u;
 if(c.sleep>0u){c.sleep--;}else{
 for(var step=0u;step<cfg.budget;step++){
  let ins=code[genome*32u+c.pc%32u];c.pc=(c.pc+1u)%32u;
  let op=u32(ins.x);let d=u32(max(0.0,-ins.y-1000000.0))%8u;
  let a=value(ins.y,c);let b=value(ins.z,c);let v=value(ins.w,c);var yielding=false;
  switch op {
   case 1u:{c.r[d]=b;} case 2u:{c.r[d]+=b;} case 3u:{c.r[d]-=b;}
   case 4u:{c.r[d]*=b;} case 5u:{if(b==0.0){c.r[d]=0.0;}else{c.r[d]/=b;}}
   case 8u:{c.pc=u32(max(0.0,a))%32u;}
   case 9u:{if(a==0.0){c.pc=u32(max(0.0,b))%32u;}}
   case 10u:{if(a!=0.0){c.pc=u32(max(0.0,b))%32u;}}
   case 11u:{if(a>b){c.pc=u32(max(0.0,v))%32u;}}
   case 12u:{if(a<b){c.pc=u32(max(0.0,v))%32u;}}
   case 14u:{c.sleep=u32(clamp(a,0.0,36000.0));yielding=true;}
   case 15u:{c.r[d]=select(c.he.y,nutrient(c.pv.xy),u32(ins.z)==1u);}
   case 16u:{c.r[d]=select(f32(nearest+1u),0.0,nearest==NONE);}
   case 20u:{c.he.x=fract(c.he.x+clamp(a,-360.0,360.0)/360.0);}
   case 21u:{let h=c.he.x*6.28318530718;c.pv.z+=cos(h)*clamp(a,-1.0,1.0)*5.0;c.pv.w+=sin(h)*clamp(a,-1.0,1.0)*5.0;}
   case 32u:{c.r[d]=abs(b);}case 33u:{c.r[d]=min(c.r[d],b);}case 34u:{c.r[d]=max(c.r[d],b);}
   default:{}
  }
  for(var r=0u;r<8u;r++){c.r[r]=clamp(c.r[r],-999999.0,999999.0);}
  if(yielding){break;}
 }}
 c.pv=vec4f(c.pv.xy,clamp((c.pv.zw+force*cfg.dt)*.94,vec2f(-100.0),vec2f(100.0)));
 c.pv=vec4f(fract((c.pv.xy+c.pv.zw*cfg.dt)/cfg.width)*cfg.width,c.pv.zw);
 output[i]=c;
}
`;

export function fixture(count) {
  const side = Math.ceil(Math.sqrt(count / 1.5)),
    width = side * 32;
  const bytes = new ArrayBuffer(count * 80),
    f = new Float32Array(bytes),
    u = new Uint32Array(bytes);
  let rng = 42;
  const random = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const k = i * 20,
      group = Math.floor(i / 8),
      columns = Math.ceil(Math.sqrt(count / 8));
    f[k] = (((group % columns) * width) / columns + (i % 8) * 14 + 10) % width;
    f[k + 1] = ((Math.floor(group / columns) * width) / columns + 10) % width;
    f[k + 4] = random();
    f[k + 5] = 70;
    u[k + 18] = i % 8 === 0 ? 0xffffffff : i - 1;
    u[k + 19] = i % 8 === 7 || i === count - 1 ? 0xffffffff : i + 1;
  }
  const code = new Float32Array(4096 * 32 * 4);
  for (let g = 0; g < 4096; g++)
    for (let pc = 0; pc < 32; pc++) {
      const k = (g * 32 + pc) * 4;
      let ins;
      if (pc === 31) ins = [8, 0, 0, 0];
      else if (pc % 8 === 0) ins = [15, -1000000, 1, 0];
      else if (pc % 8 === 1) ins = [16, -1000001, -1, 360];
      else if (pc % 8 === 2) ins = [20, (random() - 0.5) * 10, 0, 0];
      else if (pc % 8 === 3) ins = [21, random() * 0.3, 0, 0];
      else if (pc % 8 === 4) ins = [2, -1000002, random() - 0.5, 0];
      else if (pc % 8 === 5) ins = [4, -1000002, 0.99, 0];
      else if (pc % 8 === 6) ins = [11, -1000002, 0.5, (g + pc) % 32];
      else ins = [34, -1000002, -0.5, 0];
      code.set(ins, k);
    }
  return { bytes, code, side, width, count };
}

export async function createExperiment(device, count, budget = 24) {
  const data = fixture(count),
    size = data.bytes.byteLength;
  const storage = (size, usage = 0) =>
    device.createBuffer({
      size,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC |
        usage,
    });
  const states = [storage(size), storage(size)],
    heads = storage(data.side ** 2 * 4),
    links = storage(count * 4),
    code = storage(data.code.byteLength);
  const uniform = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(states[0], 0, data.bytes);
  device.queue.writeBuffer(code, 0, data.code);
  const config = new ArrayBuffer(32),
    cu = new Uint32Array(config),
    cf = new Float32Array(config);
  cu.set([count, data.side ** 2, data.side, budget]);
  cf[4] = data.width;
  cf[5] = 1 / 60;
  device.queue.writeBuffer(uniform, 0, config);
  const module = device.createShaderModule({ code: shader });
  const info = await module.getCompilationInfo();
  if (info.messages.some((m) => m.type === "error"))
    throw Error(info.messages.map((m) => m.message).join("\n"));
  const layout = device.createBindGroupLayout({
    entries: [0, 1, 2, 3, 4, 5].map((binding) => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type:
          binding === 5
            ? "uniform"
            : binding === 0 || binding === 4
              ? "read-only-storage"
              : "storage",
      },
    })),
  });
  const pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipelines = Object.fromEntries(
    await Promise.all(
      ["clear", "index", "simulate"].map(async (entryPoint) => [
        entryPoint,
        await device.createComputePipelineAsync({
          layout: pl,
          compute: { module, entryPoint },
        }),
      ]),
    ),
  );
  const groups = states.map((state, i) =>
    device.createBindGroup({
      layout,
      entries: [state, states[1 - i], heads, links, code, uniform].map(
        (buffer, binding) => ({ binding, resource: { buffer } }),
      ),
    }),
  );
  let parity = 0;
  return {
    data,
    async run(ticks) {
      const encoder = device.createCommandEncoder();
      for (let t = 0; t < ticks; t++)
        for (const stage of ["clear", "index", "simulate"]) {
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipelines[stage]);
          pass.setBindGroup(0, groups[parity]);
          pass.dispatchWorkgroups(
            Math.ceil((stage === "clear" ? data.side ** 2 : count) / 128),
          );
          pass.end();
          if (stage === "simulate") parity = 1 - parity;
        }
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
    },
    async read() {
      const out = device.createBuffer({
        size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(states[parity], 0, out, 0, size);
      device.queue.submit([encoder.finish()]);
      await out.mapAsync(GPUMapMode.READ);
      const result = out.getMappedRange().slice(0);
      out.unmap();
      out.destroy();
      return result;
    },
    destroy() {
      for (const b of [...states, heads, links, code, uniform]) b.destroy();
    },
  };
}
