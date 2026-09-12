// Rendering reads the simulation's GPU buffers directly. No per-frame cell downloads.
const shader = /* wgsl */ `
struct Cell {
 p:vec4f, b:vec4f, r:array<f32,8>, signal:vec4f, mail:vec4f,
 machine:vec4u, life:vec4u, link:vec4u, res:vec4f, sender:vec4u,
 anchor:vec4f, phen:vec4f,
}
struct Activity {marks:vec4u,impact:vec4f}
struct View { camera:vec4f, world:vec4f, flags:vec4u, selection:vec4u }
@group(0) @binding(0) var<storage,read> cells:array<Cell>;
@group(0) @binding(1) var<storage,read> food:array<vec2f>;
@group(0) @binding(2) var<uniform> view:View;
@group(0) @binding(3) var<storage,read> activity:array<Activity>;
const CORNERS=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
fn delta(p:vec2f)->vec2f {return p-floor(p/view.world.x+0.5)*view.world.x;}
fn clip(p:vec2f)->vec4f {return vec4f(p/view.camera.zw*vec2f(2,-2),0,1);}
fn hue(h:f32)->vec3f {
 let rgb=clamp(abs(fract(h+vec3f(0,2.0/3.0,1.0/3.0))*6-3)-1,vec3f(0),vec3f(1));
 return mix(vec3f(0.24),vec3f(0.96),rgb);
}
struct Vertex { @builtin(position) pos:vec4f, @location(0) uv:vec2f, @location(1) color:vec4f, @location(2) facing:vec2f, @location(3) @interpolate(flat) picked:u32, @location(4) feeding:f32 }
@vertex fn cellVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->Vertex {
 let c=cells[i]; var o:Vertex;
 o.uv=CORNERS[v]; o.facing=vec2f(cos(c.b.y*6.2831853),sin(c.b.y*6.2831853));
 o.picked=select(0u,1u,i==view.selection.x && c.machine.x==view.selection.y);
 let activityState=activity[i];
 o.feeding=select(0.0,1.0,view.selection.w==1u&&c.life.w==1u&&activityState.marks.z==c.machine.x&&activityState.marks.w>0u&&view.selection.z-activityState.marks.w<120u);
 let radius=max(select(4.0,3.0,c.life.w==2u),view.world.z*0.85)+f32(o.picked)*view.world.z*3;
 o.pos=clip(delta(c.p.xy-view.camera.xy)+o.uv*radius);
 if(c.life.w==0u){o.pos=vec4f(3,3,0,1);}
 var color=hue(c.phen.x/360);
 if(view.flags.z==1u){color=mix(vec3f(.15,.28,.35),vec3f(.76,.94,.45),clamp(c.res.z/(200*4096),0,1));}
 if(view.flags.z==2u){color=mix(vec3f(0.4,0.18,0.24),vec3f(0.85,0.98,0.53),clamp(c.b.x/(4096*100),0,1));}
 if(view.flags.z==3u){let a=activity[i];color=vec3f(.30,.39,.39);if(a.marks.z==c.machine.x){if(a.marks.x>0u&&view.selection.z-a.marks.x<120u){color=vec3f(.35,.9,.88);}if(a.marks.w>0u&&view.selection.z-a.marks.w<120u){color=vec3f(1,.72,.18);}if(a.marks.y>0u&&view.selection.z-a.marks.y<120u){color=vec3f(1,.25,.18);}}}
 if(view.flags.z==4u){let warmth=clamp((c.res.w-view.world.w+8)/8,0,1);color=mix(vec3f(.22,.55,.9),vec3f(.98,.76,.25),warmth);if(c.res.w>view.world.w){color=mix(color,vec3f(1,.12,.10),clamp((c.res.w-view.world.w)/8,.1,1));}}
 if(c.life.w==2u){color=mix(vec3f(.25,.18,.12),vec3f(.72,.49,.25),clamp(c.b.x/(64*4096),0,1));o.picked=2u;}
 o.color=vec4f(color,1); return o;
}
@fragment fn cellFragment(i:Vertex)->@location(0) vec4f {
 let d=length(i.uv); let aa=max(fwidth(d),0.015);
 let alpha=1-smoothstep(1-aa,1.0,d);
 if(alpha<=0){discard;}
 var color=i.color.rgb*(0.72+0.28*(1-d));
 let nose=dot(i.uv,i.facing);
 if(i.picked!=2u && nose>0.45 && abs(dot(i.uv,vec2f(-i.facing.y,i.facing.x)))<0.14){color=vec3f(1);}
 if(i.feeding>0.5 && d>0.58){color=vec3f(1,.72,.18);}
 if(i.picked==1u && d>0.68){color=vec3f(1);}
 return vec4f(color,alpha);
}
@vertex fn linkVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->Vertex {
 let slot=i/4u; let edge=i%4u; let c=cells[slot]; let handle=c.link[edge];
 var o:Vertex; o.pos=vec4f(3,3,0,1); o.color=vec4f(0.55,0.85,0.78,0.55);
 if(c.life.w!=1u || handle==0u || handle>arrayLength(&cells) || handle<=slot+1u){return o;}
 let other=cells[handle-1u]; if(other.life.w!=1u){return o;}
 var back=4u; for(var k=0u;k<4u;k++){if(other.link[k]==slot+1u){back=k;}}
 if(back==4u){return o;}
 let a=(c.b.y+c.anchor[edge])*6.2831853; let b=(other.b.y+other.anchor[back])*6.2831853;
 let origin=delta(c.p.xy-view.camera.xy);
 let start=origin+vec2f(cos(a),sin(a))*3;
 let end=origin+delta(other.p.xy-c.p.xy)+vec2f(cos(b),sin(b))*3;
 o.pos=clip(select(start,end,v==1u)); return o;
}
@fragment fn linkFragment(i:Vertex)->@location(0) vec4f {return i.color;}
@vertex fn attackVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->Vertex {
 var o:Vertex;o.pos=vec4f(3,3,0,1);let c=cells[i];let a=activity[i];
 if(c.life.w!=1u||a.marks.z!=c.machine.x||a.marks.y==0u||view.selection.z-a.marks.y>=120u){return o;}
 let start=delta(c.p.xy-view.camera.xy);let end=start+delta(a.impact.xy-c.p.xy);
 o.pos=clip(select(start,end,v==1u));o.color=vec4f(1,.27,.15,.8);return o;
}
@vertex fn motorVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->Vertex {
 var o:Vertex;o.pos=vec4f(3,3,0,1);let c=cells[i];let a=activity[i];
 if(c.life.w!=1u||a.marks.z!=c.machine.x||a.marks.x==0u||view.selection.z-a.marks.x>=60u){return o;}
 let h=a.impact.w*6.2831853;let d=vec2f(cos(h),sin(h));
 o.pos=clip(delta(c.p.xy-view.camera.xy)-d*select(5.0,13.0,v==1u));o.color=vec4f(.35,.9,.88,.65);return o;
}
@fragment fn attackFragment(i:Vertex)->@location(0) vec4f{return i.color;}
@fragment fn motorFragment(i:Vertex)->@location(0) vec4f{return i.color;}
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
 color=mix(vec3f(.025,.045,.065),vec3f(.28,.31,.20),clamp(value.x,0,1));
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
        binding: 3,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
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
    ["field", "link", "cell", "attack", "motor"].map((name) =>
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
          topology: ["link", "attack", "motor"].includes(name)
            ? "line-list"
            : "triangle-list",
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
        { binding: 3, resource: { buffer: engine.buffers.activity } },
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
        engine.cfg.safeTemperature,
      ]);
      u.set(
        [
          options.food ? 1 : 0,
          options.links ? 1 : 0,
          options.color || 0,
          engine.tick % 2,
          options.slot ?? 0xffffffff,
          options.identity ?? 0,
          engine.tick,
          options.activity ? 1 : 0,
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
      if (options.activity) {
        pass.setPipeline(pipelines[3]);
        pass.draw(2, engine.cfg.capacity);
        pass.setPipeline(pipelines[4]);
        pass.draw(2, engine.cfg.capacity);
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
