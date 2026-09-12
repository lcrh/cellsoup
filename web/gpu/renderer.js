// Rendering reads the simulation's GPU buffers directly. No per-frame cell downloads.
const shader = /* wgsl */ `
struct Cell {
 p:vec4f, b:vec4f, r:array<f32,8>, signal:vec4f, mail:vec4f,
 machine:vec4u, life:vec4u, link:vec4u, res:vec4f, sender:vec4u,
 anchor:vec4f, phen:vec4f,
}
struct View { camera:vec4f, world:vec4f, flags:vec4u, selection:vec4u }
@group(0) @binding(0) var<storage,read> cells:array<Cell>;
@group(0) @binding(1) var<storage,read> food:array<vec2f>;
@group(0) @binding(2) var<uniform> view:View;
const CORNERS=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
fn delta(p:vec2f)->vec2f {return p-floor(p/view.world.x+0.5)*view.world.x;}
fn clip(p:vec2f)->vec4f {return vec4f(p/view.camera.zw*vec2f(2,-2),0,1);}
fn hue(h:f32)->vec3f {
 let rgb=clamp(abs(fract(h+vec3f(0,2.0/3.0,1.0/3.0))*6-3)-1,vec3f(0),vec3f(1));
 return mix(vec3f(0.24),vec3f(0.96),rgb);
}
struct Vertex { @builtin(position) pos:vec4f, @location(0) uv:vec2f, @location(1) color:vec4f, @location(2) facing:vec2f, @location(3) @interpolate(flat) picked:u32 }
@vertex fn cellVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->Vertex {
 let c=cells[i]; var o:Vertex;
 o.uv=CORNERS[v]; o.facing=vec2f(cos(c.b.y*6.2831853),sin(c.b.y*6.2831853));
 o.picked=select(0u,1u,i==view.selection.x && c.machine.x==view.selection.y);
 let radius=max(4.0,view.world.z*0.85)+f32(o.picked)*view.world.z*3;
 o.pos=clip(delta(c.p.xy-view.camera.xy)+o.uv*radius);
 if(c.life.w==0u){o.pos=vec4f(3,3,0,1);}
 var color=hue(c.phen.x/360);
 if(view.flags.z==1u){color=mix(vec3f(0.87,0.55,0.23),vec3f(0.25,0.85,0.84),c.res.y);}
 if(view.flags.z==2u){color=mix(vec3f(0.4,0.18,0.24),vec3f(0.85,0.98,0.53),clamp(c.b.x/(4096*100),0,1));}
 o.color=vec4f(color,1); return o;
}
@fragment fn cellFragment(i:Vertex)->@location(0) vec4f {
 let d=length(i.uv); let aa=max(fwidth(d),0.015);
 let alpha=1-smoothstep(1-aa,1.0,d);
 if(alpha<=0){discard;}
 var color=i.color.rgb*(0.72+0.28*(1-d));
 let nose=dot(i.uv,i.facing);
 if(nose>0.45 && abs(dot(i.uv,vec2f(-i.facing.y,i.facing.x)))<0.14){color=vec3f(1);}
 if(i.picked==1u && d>0.68){color=vec3f(1);}
 return vec4f(color,alpha);
}
@vertex fn linkVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->Vertex {
 let slot=i/4u; let edge=i%4u; let c=cells[slot]; let handle=c.link[edge];
 var o:Vertex; o.pos=vec4f(3,3,0,1); o.color=vec4f(0.55,0.85,0.78,0.55);
 if(c.life.w==0u || handle==0u || handle>arrayLength(&cells) || handle<=slot+1u){return o;}
 let other=cells[handle-1u]; if(other.life.w==0u){return o;}
 var back=4u; for(var k=0u;k<4u;k++){if(other.link[k]==slot+1u){back=k;}}
 if(back==4u){return o;}
 let a=(c.b.y+c.anchor[edge])*6.2831853; let b=(other.b.y+other.anchor[back])*6.2831853;
 let origin=delta(c.p.xy-view.camera.xy);
 let start=origin+vec2f(cos(a),sin(a))*3;
 let end=origin+delta(other.p.xy-c.p.xy)+vec2f(cos(b),sin(b))*3;
 o.pos=clip(select(start,end,v==1u)); return o;
}
@fragment fn linkFragment(i:Vertex)->@location(0) vec4f {return i.color;}
struct FieldVertex { @builtin(position) pos:vec4f, @location(0) world:vec2f }
@vertex fn fieldVertex(@builtin(vertex_index) v:u32)->FieldVertex {
 var o:FieldVertex; let p=CORNERS[v]; o.pos=vec4f(p,0,1);
 o.world=view.camera.xy+p*view.camera.zw*vec2f(0.5,-0.5); return o;
}
fn nutrient(p:vec2i)->vec2f {
 let side=i32(view.world.y); let q=((p%side)+side)%side;
 return food[view.flags.w*u32(side*side)+u32(q.y*side+q.x)];
}
@fragment fn fieldFragment(i:FieldVertex)->@location(0) vec4f {
 var color=vec3f(0.028,0.058,0.065);
 if(view.flags.x==1u && all(abs(i.world-view.camera.xy)<=vec2f(view.world.x*0.5))){
 let p=i.world/32-0.5; let base=vec2i(floor(p)); let f=fract(p);
 let value=mix(mix(nutrient(base),nutrient(base+vec2i(1,0)),f.x),mix(nutrient(base+vec2i(0,1)),nutrient(base+vec2i(1,1)),f.x),f.y);
 let amount=1-exp(-value*0.075);
 color+=amount.x*vec3f(0.015,0.15,0.17)+amount.y*vec3f(0.17,0.10,0.015);
 }
 return vec4f(color,1);
}
`;
export async function createRenderer(device, canvas, engine, format) {
  const context = canvas.getContext("webgpu");
  if (!context) throw Error("This browser cannot create a WebGPU canvas.");
  context.configure({ device, format, alphaMode: "opaque" });
  const module = device.createShaderModule({
    label: "Cell Soup observation",
    code: shader,
  });
  const info = await module.getCompilationInfo();
  if (info.messages.some((m) => m.type === "error"))
    throw Error(info.messages.map((m) => m.message).join("\n"));
  const uniform = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const layout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [layout],
  });
  const pipelines = await Promise.all(
    ["field", "link", "cell"].map((name) =>
      device.createRenderPipelineAsync({
        layout: pipelineLayout,
        vertex: { module, entryPoint: name + "Vertex" },
        fragment: {
          module,
          entryPoint: name + "Fragment",
          targets: [
            {
              format,
              blend: {
                color: {
                  srcFactor: "src-alpha",
                  dstFactor: "one-minus-src-alpha",
                  operation: "add",
                },
                alpha: {
                  srcFactor: "one",
                  dstFactor: "one-minus-src-alpha",
                  operation: "add",
                },
              },
            },
          ],
        },
        primitive: {
          topology: name === "link" ? "line-list" : "triangle-list",
        },
      }),
    ),
  );
  const groups = engine.buffers.state.map((buffer) =>
    device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 1, resource: { buffer: engine.buffers.food } },
        { binding: 2, resource: { buffer: uniform } },
      ],
    }),
  );
  return {
    draw(camera, options = {}) {
      const rect = canvas.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr)),
        height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      if (camera.overview)
        camera.width = engine.cfg.side * 32 * Math.max(1, width / height);
      camera.height = (camera.width * height) / width;
      const data = new ArrayBuffer(64),
        f = new Float32Array(data),
        u = new Uint32Array(data);
      f.set([
        camera.x,
        camera.y,
        camera.width,
        camera.height,
        engine.cfg.side * 32,
        engine.cfg.side,
        camera.width / width,
        0,
      ]);
      u.set(
        [
          options.food ? 1 : 0,
          options.links ? 1 : 0,
          options.color || 0,
          engine.tick % 2,
          options.slot ?? 0xffffffff,
          options.identity ?? 0,
          0,
          0,
        ],
        8,
      );
      device.queue.writeBuffer(uniform, 0, data);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          },
        ],
      });
      pass.setBindGroup(
        0,
        groups[engine.buffers.state.indexOf(engine.currentState)],
      );
      pass.setPipeline(pipelines[0]);
      pass.draw(6);
      if (options.links) {
        pass.setPipeline(pipelines[1]);
        pass.draw(2, engine.cfg.capacity * 4);
      }
      pass.setPipeline(pipelines[2]);
      pass.draw(6, engine.cfg.capacity);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      uniform.destroy();
      context.unconfigure();
    },
  };
}
