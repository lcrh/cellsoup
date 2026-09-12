import { GPU_OPS, GPU_SENSORS } from "./language.js";
export function simulationShader({ capacity, genomeCapacity, side, sources }) {
  const types = { r: 1, v: 2, l: 3, s: 4, p: 5 };
  const signatures = GPU_OPS.map(
    (op) =>
      `vec3u(${op[1]
        .split(" ")
        .filter(Boolean)
        .map((t) => types[t])
        .concat([0, 0, 0])
        .slice(0, 3)
        .join(",")})`,
  ).join(",");
  return /* wgsl */ `
const N=${capacity}u;
const G=${genomeCapacity}u;
const SIDE=${side}u;
const T=${side * side}u;
const W=${side * 32}.0;
const SOURCES=${sources}u;
const ARCH=128u;
const Q=4096.0;
const CAP_E=819200u;
const DT=1.0/60.0;
const NONE=0xffffffffu;
const SIG=array<vec3u,41>(${signatures});
struct Cell {
  p:vec4f,
  b:vec4f,
  r:array<f32,8>,
  signal:vec4f,
  mail:vec4f,
  machine:vec4u,
  life:vec4u,
  link:vec4u,
  res:vec4f,
  sender:vec4u,
  anchor:vec4f,
  phen:vec4f,
}
// b: energy in exact integer quanta, heading, tag, shield; res: rest, enzyme, A, B.
// phen: hue, enzyme aim, unreported harvested energy, angular velocity.
struct Genome {
  info:vec4u,
  ancestry:vec4u,
  code:array<vec4f,64>,
}
struct Intent {
  req:vec4f,
  aim:vec4u,
  msg:vec4f,
  dest:vec4u,
  base:vec4u,
  uptake:vec4f,
  newLinks:vec4u,
  misc:vec4u,
}
struct Wide {
  lo:atomic<u32>,
  hi:atomic<u32>,
}
struct GeneStats {
  refs:atomic<u32>,
  births:atomic<u32>,
  harvest:atomic<u32>,
  pad:atomic<u32>,
}
struct Scratch {
  heads:array<atomic<u32>,T>,
  next:array<u32,N>,
  free:array<u32,N>,
  counter:array<atomic<u32>,32>,
  gift:array<Wide,N>,
  theft:array<Wide,N>,
  giftCredit:array<atomic<u32>,N>,
  theftDebit:array<atomic<u32>,N>,
  theftCredit:array<atomic<u32>,N>,
  claim:array<atomic<u32>,N>,
  demand:array<atomic<u32>,T*2>,
  deposit:array<atomic<u32>,T*2>,
  genes:array<GeneStats,G>,
  freeGenes:array<u32,G>,
  candidates:array<atomic<u32>,ARCH>,
}
struct Field {
  a:array<vec2f,T>,
  b:array<vec2f,T>,
  source:array<vec4f,SOURCES>,
  home:array<vec4f,SOURCES>,
}
struct Config {
  sim:vec4u,
  arrivals:vec4f,
  energy:vec4f,
  ecology:vec4f,
  cost0:vec4f,
  cost1:vec4f,
  misc:vec4f,
  selection:vec4f,
}
@group(0) @binding(0) var<storage,read> old:array<Cell>;
@group(0) @binding(1) var<storage,read_write> cells:array<Cell>;
@group(0) @binding(2) var<storage,read_write> s:Scratch;
@group(0) @binding(3) var<storage,read_write> genomes:array<Genome>;
@group(0) @binding(4) var<storage,read_write> archive:array<Genome>;
@group(0) @binding(5) var<storage,read_write> food:Field;
@group(0) @binding(6) var<storage,read_write> intents:array<Intent>;
@group(0) @binding(7) var<uniform> cfg:Config;
fn hash(x:u32)->u32 {
  var z=x+0x9e3779b9u;
  z=(z^(z>>16u))*0x21f0aaadu;
  z=(z^(z>>15u))*0x735a2d97u;
  return z^(z>>15u);
}
fn random(x:u32)->f32 {
  return f32(hash(x)>>8u)/16777216.0;
}
fn tick()->u32 {
  return atomicLoad(&s.counter[0]);
}
fn delta(a:vec2f,b:vec2f)->vec2f {
  let d=a-b;
  return d-round(d/W)*W;
}
fn wrapped(p:vec2f)->vec2f {
  return fract(p/W)*W;
}
fn bin(p:vec2f)->u32 {
  let q=vec2u(floor(wrapped(p)/32.0));
  return q.y*SIDE+q.x;
}
fn fvalue(k:u32)->vec2f {
  if((tick()&1u)==1u) {
    return food.b[k];
  }
  return food.a[k];
}
fn prevfood(k:u32)->vec2f {
  if((tick()&1u)==1u) {
    return food.a[k];
  }
  return food.b[k];
}
fn quantum(v:f32)->u32 {
  return u32(clamp(round(v*Q),0.0,f32(CAP_E)));
}
fn pay(c:ptr<function,Cell>,cost:f32)->bool {
  let q=f32(quantum(cost));
  if((*c).b.x-q<1.0) {
    return false;
  }
  (*c).b.x-=q;
  return true;
}
fn slot(v:f32)->u32 {
  if(v<1.0||v>f32(N)||v!=floor(v)) {
    return NONE;
  }
  let i=u32(v)-1u;
  if(old[i].life.w==0u) {
    return NONE;
  }
  return i;
}
fn value(x:f32,c:Cell)->f32 {
  if(x<=-1000000.0) {
    return c.r[u32(-x-1000000.0)%8u];
  }
  return x;
}
fn degree(c:Cell)->u32 {
  var n=0u;
  for(var k=0u;k<4u;k++) {
    n+=select(0u,1u,c.link[k]>0u);
  }
  return n;
}
fn linked(c:Cell,j:u32)->bool {
  return any(c.link==vec4u(j+1u));
}
fn liveLink(i:u32,k:u32)->u32 {
  let h=old[i].link[k];
  if(h==0u||h>N) {
    return NONE;
  }
  let j=h-1u;
  if(old[j].life.w==0u||!linked(old[j],i)) {
    return NONE;
  }
  return j;
}
fn bearing(d:vec2f,h:f32)->f32 {
  return fract(atan2(d.y,d.x)/6.28318530718-h+.5)*360.0-180.0;
}
fn search(i:u32,tag:f32,cone:f32,hue:f32,tolerance:f32)->u32 {
  let c=old[i];
  let base=vec2i(floor(c.p.xy/32.0));
  var nearest=NONE;
  var dist=3600.0;
  for(var y=-2;y<=2;y++) {
    for(var x=-2;x<=2;x++) {
      let b=(base+vec2i(x,y)+vec2i(i32(SIDE)))%vec2i(i32(SIDE));
      var j=atomicLoad(&s.heads[u32(b.y)*SIDE+u32(b.x)]);
      loop {
        if(j==NONE) {
          break;
        }
        if(j!=i) {
          let n=old[j];
          let d=delta(n.p.xy,c.p.xy);
          let q=dot(d,d);
          let hd=abs(fract((n.phen.x-hue)/360.0+.5)*360.0-180.0);
          if((q<dist||(q==dist&&j<nearest))&&(tag<0.0||n.b.z==floor(tag))&&(hue<0.0||hd<=tolerance)&&(cone>=360.0||abs(bearing(d,c.b.y))<=cone*.5)) {
            nearest=j;
            dist=q;
          }
        }
        j=s.next[j];
      }
    }
  }
  return nearest;
}
fn wideGift(i:u32)->f32 {
  return f32(atomicLoad(&s.gift[i].hi))*4294967296.0+f32(atomicLoad(&s.gift[i].lo));
}
fn wideTheft(i:u32)->f32 {
  return f32(atomicLoad(&s.theft[i].hi))*4294967296.0+f32(atomicLoad(&s.theft[i].lo));
}
fn portion(request:u32,available:u32,total:f32)->u32 {
  if(total<=f32(available)) {
    return request;
  }
  if(total==f32(request)) {
    return available;
  }
  return u32(floor(f32(request)*(f32(available)/max(1.0,total))*.999999));
}
// Deposits above the field's 80-unit cap are discarded, never allowed to wrap.
fn depositAdd(k:u32,units:u32) {
  if(units==0u) { return; }
  var current=atomicLoad(&s.deposit[k]);
  loop {
    if(current>=327680u) { break; }
    let next=current+min(units,327680u-current);
    let result=atomicCompareExchangeWeak(&s.deposit[k],current,next);
    if(result.exchanged) { break; }
    current=result.old_value;
  }
}
fn geneMetric(g:u32,v:u32) {
  var current=atomicLoad(&s.genes[g].harvest);
  loop {
    let next=current+min(v,0xffffffffu-current);
    let r=atomicCompareExchangeWeak(&s.genes[g].harvest,current,next);
    if(r.exchanged) {
      break;
    }
    current=r.old_value;
  }
}
fn operand(kind:u32,len:u32,seed:u32)->f32 {
  let h=hash(seed);
  if(kind==0u) {
    return 0.0;
  }
  if(kind==1u) {
    return -1000000.0-f32(h%8u);
  }
  if(kind==3u) {
    return f32(h%len);
  }
  if(kind==4u) {
    return f32(h%${GPU_SENSORS.length}u);
  }
  if(kind==5u) {
    return f32(h%8u);
  }
  if((h&3u)==0u) {
    return -1000000.0-f32((h>>2u)%8u);
  }
  let constants=array<f32,16>(-1.0,0.0,.1,.25,.5,.75,1.0,2.0,3.0,5.0,10.0,25.0,60.0,90.0,120.0,360.0);
  return constants[(h>>2u)%16u];
}
fn freshGenome(g:u32,serial:u32,seed:u32) {
  let len=8u+hash(seed)%57u;
  genomes[g].info=vec4u(len,serial,serial,0);
  genomes[g].ancestry=vec4u(0,tick(),0,0);
  for(var k=0u;k<64u;k++) {
    let h=hash(seed+k*7919u);
    let op=h%41u;
    genomes[g].code[k]=vec4f(f32(op),operand(SIG[op].x,len,h),operand(SIG[op].y,len,h+1u),operand(SIG[op].z,len,h+2u));
  }
}
fn newCell(i:u32,g:u32,identity:u32,seed:u32)->Cell {
  var c:Cell;
  c.p=vec4f(random(seed)*W,random(seed+1u)*W,0,0);
  c.b=vec4f(f32(quantum(cfg.energy.x)),random(seed+2u),0,0);
  c.machine=vec4u(identity,g,0,0);
  c.life=vec4u(0,0,0,1);
  c.res=vec4f(1,.5,0,0);
  c.phen=vec4f(random(genomes[g].info.z)*360.0,.5,0,0);
  return c;
}
@compute @workgroup_size(128) fn seed(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i==0u) {
    atomicStore(&s.counter[1],cfg.sim.z);
    atomicStore(&s.counter[8],cfg.sim.z);
    atomicStore(&s.counter[11],cfg.sim.z+1u);
    atomicStore(&s.counter[12],cfg.sim.z+1u);
  }
  if(i<cfg.sim.z) {
    freshGenome(i,i+1u,hash(cfg.sim.x+i));
    atomicStore(&s.genes[i].refs,1u);
    cells[i]=newCell(i,i,i+1u,hash(cfg.sim.x+i*37u));
  }
  if(i<SOURCES) {
    food.home[i]=vec4f(random(cfg.sim.x+i*7u)*W,random(cfg.sim.x+i*7u+1u)*W,random(i)*6.2831853,0);
    food.source[i]=vec4f(0);
  }
}
@compute @workgroup_size(128) fn clear(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i==0u) {
    atomicAdd(&s.counter[0],1u);
    atomicStore(&s.counter[2],0u);
    atomicStore(&s.counter[3],0u);
    atomicStore(&s.counter[4],0u);
  }
  if(i<N) {
    atomicStore(&s.gift[i].lo,0u);
    atomicStore(&s.gift[i].hi,0u);
    atomicStore(&s.theft[i].lo,0u);
    atomicStore(&s.theft[i].hi,0u);
    atomicStore(&s.giftCredit[i],0u);
    atomicStore(&s.theftDebit[i],0u);
    atomicStore(&s.theftCredit[i],0u);
    atomicStore(&s.claim[i],NONE);
    intents[i].aim=vec4u(NONE);
    intents[i].misc=vec4u(0);
  }
  if(i<T) {
    atomicStore(&s.heads[i],NONE);
    atomicStore(&s.demand[i*2u],0u);
    atomicStore(&s.demand[i*2u+1u],0u);
  }
  if(i<ARCH) {
    atomicStore(&s.candidates[i],0u);
  }
}
@compute @workgroup_size(64) fn weather(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=SOURCES||(tick()!=1u&&tick()%30u!=0u)) {
    return;
  }
  var normal=vec2f(0);
  for(var k=0u;k<12u;k++) {
    normal+=vec2f(random(cfg.sim.x+i*97u+tick()*101u+k*2u),random(cfg.sim.x+i*97u+tick()*101u+k*2u+1u))-.5;
  }
  let a=exp(-.5/max(.5,cfg.misc.y));
  let offset=a*food.source[i].xy+sqrt(1-a*a)*W*.22*normal;
  food.source[i]=vec4f(offset,0,0);
  let direction=vec2f(cos(food.home[i].z),sin(food.home[i].z))*80.0;
  for(var channel=0u;channel<2u;channel++) {
    let center=wrapped(food.home[i].xy+offset+select(-direction,direction,channel==1u));
    for(var y=-7;y<=7;y++) {
      for(var x=-7;x<=7;x++) {
        let fall=max(0.0,1.0-f32(x*x+y*y)/49.0);
        let k=bin(center+vec2f(f32(x),f32(y))*32.0);
        let amount=cfg.arrivals.w*cfg.misc.z*fall*fall*select(1.0,8.0,tick()==1u);
        depositAdd(k*2u+channel,u32(amount*Q));
      }
    }
  }
}
@compute @workgroup_size(128) fn field(@builtin(global_invocation_id) id:vec3u) {
  let k=id.x;
  if(k>=T) {
    return;
  }
  var v=prevfood(k);
  if(tick()%4u==0u) {
    let x=k%SIDE;
    let y=k/SIDE;
    let avg=prevfood(y*SIDE+(x+1u)%SIDE)+prevfood(y*SIDE+(x+SIDE-1u)%SIDE)+prevfood(((y+1u)%SIDE)*SIDE+x)+prevfood(((y+SIDE-1u)%SIDE)*SIDE+x);
    v=(v+.12*(avg-4.0*v))*.9995;
  }
  v+=vec2f(f32(atomicExchange(&s.deposit[k*2u],0u)),f32(atomicExchange(&s.deposit[k*2u+1u],0u)))/Q;
  v=min(v,vec2f(80));
  if((tick()&1u)==1u) {
    food.b[k]=v;
  }
  else {
    food.a[k]=v;
  }
}
@compute @workgroup_size(128) fn prepare(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N) {
    return;
  }
  let c=old[i];
  if(c.life.w==0u) {
    cells[i].life.w=0u;
    cells[i].b.x=0.0;
    cells[i].link=vec4u(0);
    let at=atomicAdd(&s.counter[2],1u);
    s.free[at]=i;
    return;
  }
  s.next[i]=atomicExchange(&s.heads[bin(c.p.xy)],i);
  var reserve=c.res.zw;
  for(var k=0u;k<4u;k++) {
    let j=liveLink(i,k);
    if(j!=NONE) {
      reserve+=cfg.ecology.y*(old[j].res.zw-c.res.zw);
    }
  }
  let allocation=clamp(c.res.y,0.0,1.0);
  let request=min(max(vec2f(0),100.0-reserve),cfg.energy.w*DT*pow(vec2f(allocation,1.0-allocation),vec2f(cfg.ecology.x)));
  let units=vec2u(floor(request*Q));
  intents[i].uptake=vec4f(vec2f(units)/Q,reserve);
  let tile=bin(c.p.xy);
  atomicAdd(&s.demand[tile*2u],units.x);
  atomicAdd(&s.demand[tile*2u+1u],units.y);
}
@compute @workgroup_size(128) fn vm(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||old[i].life.w==0u) {
    return;
  }
  var c=old[i];
  var action:Intent;
  action.aim=vec4u(NONE);
  action.uptake=intents[i].uptake;
  let tile=bin(c.p.xy);
  let total=vec2f(f32(atomicLoad(&s.demand[tile*2u])),f32(atomicLoad(&s.demand[tile*2u+1u])))/Q;
  let uptake=action.uptake.xy*min(vec2f(1),fvalue(tile)/max(total,vec2f(.000001)));
  c.res=vec4f(c.res.xy,action.uptake.zw+uptake);
  c.phen.z+=uptake.x+uptake.y;
  let metabolized=min(min(c.res.z,c.res.w),max(0.0,(f32(CAP_E)-c.b.x)/Q*.5));
  let earned=u32(floor(metabolized*2.0*Q));
  c.b.x+=f32(earned);
  c.res.z-=f32(earned)/Q*.5;
  c.res.w-=f32(earned)/Q*.5;
  c.b.x=max(0.0,c.b.x-f32(quantum(cfg.energy.y*DT)));
  if(!pay(&c,c.b.w*cfg.ecology.w*DT)) {
    c.b.w=0.0;
  }
  c.life.x++;
  c.signal*=.97;
  c.res.y+=clamp(c.phen.y-c.res.y,-cfg.ecology.z*DT,cfg.ecology.z*DT);
  if(c.machine.w>0u) {
    c.machine.w--;
  }
  else {
    let g=c.machine.y;
    let len=genomes[g].info.x;
    for(var step=0u;step<cfg.sim.y;step++) {
      if(c.b.x<=0.0) {
        break;
      }
      let ins=genomes[g].code[c.machine.z%len];
      c.machine.z=(c.machine.z+1u)%len;
      if(!pay(&c,cfg.cost0.x)) {
        continue;
      }
      let op=u32(ins.x);
      let d=u32(max(0.0,-ins.y-1000000.0))%8u;
      let a=value(ins.y,c);
      let b=value(ins.z,c);
      let v=value(ins.w,c);
      var yielding=false;
      switch op {
        case 1u: {
          c.r[d]=b;
        }
        case 2u: {
          c.r[d]+=b;
        }
        case 3u: {
          c.r[d]-=b;
        }
        case 4u: {
          c.r[d]*=b;
        }
        case 5u: {
          if(b==0.0) {
            c.r[d]=0.0;
          }
          else {
            c.r[d]/=b;
          }
        }
        case 6u: {
          if(b==0.0) {
            c.r[d]=0.0;
          }
          else {
            c.r[d]-=trunc(c.r[d]/b)*b;
          }
        }
        case 7u: {
          c.r[d]=random(c.machine.x+tick()*7919u+step)*b;
        }
        case 8u: {
          c.machine.z=u32(max(0.0,a))%len;
        }
        case 9u: {
          if(a==0.0) {
            c.machine.z=u32(max(0.0,b))%len;
          }
        }
        case 10u: {
          if(a!=0.0) {
            c.machine.z=u32(max(0.0,b))%len;
          }
        }
        case 11u: {
          if(a>b) {
            c.machine.z=u32(max(0.0,v))%len;
          }
        }
        case 12u: {
          if(a<b) {
            c.machine.z=u32(max(0.0,v))%len;
          }
        }
        case 13u: {
          if(a==b) {
            c.machine.z=u32(max(0.0,v))%len;
          }
        }
        case 14u: {
          c.machine.w=u32(clamp(a,0.0,36000.0));
          yielding=true;
        }
        case 15u: {
          let sense=u32(ins.z);
          switch sense {
            case 0u: {
              c.r[d]=c.b.x/Q;
            }
            case 1u: {
              c.r[d]=fvalue(tile).x+fvalue(tile).y;
            }
            case 2u: {
              c.r[d]=f32(c.life.x)*DT;
            }
            case 3u: {
              c.r[d]=f32(degree(c));
            }
            case 4u: {
              c.r[d]=c.phen.w*360.0;
            }
            case 5u: {
              c.r[d]=f32(i+1u);
            }
            case 6u: {
              c.r[d]=f32(c.life.y);
            }
            case 7u: {
              c.r[d]=c.b.z;
            }
            case 11u: {
              c.r[d]=c.phen.x;
            }
            case 12u: {
              c.r[d]=fvalue(tile).x;
            }
            case 13u: {
              c.r[d]=fvalue(tile).y;
            }
            case 14u: {
              c.r[d]=c.res.y;
            }
            case 15u: {
              c.r[d]=c.res.z;
            }
            case 16u: {
              c.r[d]=c.res.w;
            }
            default: {
              let h=(c.b.y+select(select(0.0,-.125,sense==9u),.125,sense==10u))*6.2831853;
              let f=fvalue(bin(c.p.xy+vec2f(cos(h),sin(h))*32.0));
              c.r[d]=f.x+f.y;
            }
          }
        }
        case 16u: {
          let j=search(i,b,clamp(v,0.0,360.0),-1.0,180.0);
          c.r[d]=select(f32(j+1u),0.0,j==NONE);
        }
        case 17u: {
          c.r[d]=0.0;
          let j=slot(b);
          if(j!=NONE) {
            let n=old[j];
            let diff=delta(n.p.xy,c.p.xy);
            if(dot(diff,diff)<3600.0) {
              switch u32(ins.w) {
                case 0u: {
                  c.r[d]=n.b.x/Q;
                }
                case 1u: {
                  c.r[d]=n.b.z;
                }
                case 2u: {
                  c.r[d]=length(diff);
                }
                case 3u: {
                  c.r[d]=bearing(diff,c.b.y);
                }
                case 4u: {
                  c.r[d]=select(0.0,1.0,n.machine.y==c.machine.y);
                }
                case 5u: {
                  c.r[d]=n.b.w;
                }
                case 6u: {
                  c.r[d]=f32(degree(n));
                }
                case 7u: {
                  c.r[d]=n.phen.x;
                }
                default: {
                }
              }
            }
          }
        }
        case 18u,19u: {
          action.req.z=f32(op-17u);
          action.req.w=f32(d);
          c.r[d]=-1.0;
          yielding=true;
        }
        case 20u: {
          let amount=clamp(a,-360.0,360.0);
          if(pay(&c,abs(amount)*cfg.cost0.z)) {
            c.b.y=fract(c.b.y+amount/360.0);
          }
        }
        case 21u: {
          let amount=clamp(a,-1.0,1.0);
          if(pay(&c,abs(amount)*cfg.cost0.y)) {
            let h=c.b.y*6.2831853;
            c.p=vec4f(c.p.xy,c.p.zw+vec2f(cos(h),sin(h))*amount*5.0);
          }
        }
        case 22u: {
          let j=slot(a);
          if(j!=NONE&&j!=i&&length(delta(old[j].p.xy,c.p.xy))<24.0&&pay(&c,cfg.cost0.w)) {
            action.aim.z=j;
          }
        }
        case 23u: {
          if(a==0.0) {
            c.link=vec4u(0);
          }
          else if(a>=1.0&&a<=f32(N)&&a==floor(a)) {
            for(var k=0u;k<4u;k++) {
              if(c.link[k]==u32(a)) {
                c.link[k]=0u;
              }
            }
          }
        }
        case 24u: {
          if(pay(&c,cfg.cost1.x)) {
            c.res.x=clamp(a,.55,1.5);
          }
        }
        case 25u,26u: {
          let j=slot(a);
          if(j!=NONE&&j!=i&&length(delta(old[j].p.xy,c.p.xy))<=18.0) {
            if(op==25u) {
              if(pay(&c,cfg.cost1.y)) {
                action.aim.y=j;
                action.req.y=clamp(b,0.0,3.0)*(1.0-old[j].b.w*.9);
              }
            }
            else {
              action.aim.x=j;
              action.req.x=clamp(b,0.0,1.0)*c.b.x/Q;
            }
          }
        }
        case 27u: {
          c.b.z=floor(clamp(a,0.0,255.0));
        }
        case 28u: {
          let shield=clamp(a,0.0,1.0);
          if(c.b.x-f32(quantum(shield*cfg.ecology.w*DT))>=1.0) {
            c.b.w=shield;
          }
        }
        case 29u: {
          c.phen.x=fract(a/360.0)*360.0;
        }
        case 30u: {
          if(pay(&c,cfg.cost1.z)) {
            c.signal[u32(clamp(a,0.0,3.0))]=clamp(b,-100.0,100.0);
          }
        }
        case 31u: {
          let base=vec2i(floor(c.p.xy/32.0));
          var heard=0.0;
          for(var y=-2;y<=2;y++) {
            for(var x=-2;x<=2;x++) {
              let p=(base+vec2i(x,y)+vec2i(i32(SIDE)))%vec2i(i32(SIDE));
              var j=atomicLoad(&s.heads[u32(p.y)*SIDE+u32(p.x)]);
              loop {
                if(j==NONE) {
                  break;
                }
                let distance=length(delta(old[j].p.xy,c.p.xy));
                if(j!=i&&distance<60.0) {
                  heard+=old[j].signal[u32(clamp(b,0.0,3.0))]*(1-distance/60.0);
                }
                j=s.next[j];
              }
            }
          }
          c.r[d]=heard;
        }
        case 32u: {
          c.r[d]=abs(b);
        }
        case 33u: {
          c.r[d]=min(c.r[d],b);
        }
        case 34u: {
          c.r[d]=max(c.r[d],b);
        }
        case 35u: {
          let h=c.b.y*6.2831853;
          let dir=vec2f(cos(h),sin(h))*32.0;
          let f=fvalue(bin(c.p.xy+dir))-fvalue(bin(c.p.xy-dir));
          let r=fvalue(bin(c.p.xy+vec2f(-dir.y,dir.x)))-fvalue(bin(c.p.xy-vec2f(-dir.y,dir.x)));
          let gradient=vec2f(f.x+f.y,r.x+r.y);
          c.r[d]=atan2(gradient.y,gradient.x)*57.29578;
          c.r[u32(max(0.0,-ins.z-1000000.0))%8u]=length(gradient)/50.0;
        }
        case 36u: {
          let j=search(i,-1.0,360.0,fract(b/360.0)*360.0,clamp(v,0.0,180.0));
          c.r[d]=select(f32(j+1u),0.0,j==NONE);
        }
        case 37u: {
          c.r[d]=0.0;
          if(b>=0.0&&b<4.0) {
            c.r[d]=f32(c.link[u32(b)]);
          }
        }
        case 38u: {
          let ch=u32(clamp(b,0.0,3.0));
          var recipients=0u;
          for(var k=0u;k<4u;k++) {
            if(c.link[k]!=0u&&(a==0.0||f32(c.link[k])==a)) {
              recipients++;
            }
          }
          if(recipients>0u&&pay(&c,f32(recipients)*cfg.cost1.w)) {
            action.msg[ch]=clamp(v,-100.0,100.0);
            action.dest[ch]=u32(max(0.0,a));
            action.misc.x|=1u<<ch;
          }
        }
        case 39u: {
          let ch=u32(clamp(v,0.0,3.0));
          c.r[d]=select(0.0,c.mail[ch],c.sender[ch]!=0u);
          c.r[u32(max(0.0,-ins.z-1000000.0))%8u]=f32(c.sender[ch]);
          c.sender[ch]=0u;
          c.mail[ch]=0.0;
        }
        case 40u: {
          c.phen.y=clamp(a,0.0,1.0);
        }
        default: {
        }
      }
      for(var k=0u;k<8u;k++) {
        if(c.r[k]!=c.r[k]) {
          c.r[k]=0.0;
        }
        c.r[k]=clamp(c.r[k],-999999.0,999999.0);
      }
      if(yielding) {
        break;
      }
    }
  }
  action.base.x=u32(c.b.x);
  cells[i]=c;
  intents[i]=action;
}
@compute @workgroup_size(128) fn foodDebit(@builtin(global_invocation_id) id:vec3u) {
  let k=id.x;
  if(k>=T) {
    return;
  }
  let demand=vec2f(f32(atomicLoad(&s.demand[k*2u])),f32(atomicLoad(&s.demand[k*2u+1u])))/Q;
  let v=max(vec2f(0),fvalue(k)-demand);
  if((tick()&1u)==1u) {
    food.b[k]=v;
  }
  else {
    food.a[k]=v;
  }
}
@compute @workgroup_size(128) fn giftPlan(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||old[i].life.w==0u) {
    return;
  }
  let j=intents[i].aim.x;
  if(j==NONE) {
    return;
  }
  let units=min(quantum(intents[i].req.x),u32(max(0.0,f32(intents[i].base.x)-1.0)));
  intents[i].base.y=units;
  let prev=atomicAdd(&s.gift[j].lo,units);
  if(prev+units<prev) {
    atomicAdd(&s.gift[j].hi,1u);
  }
}
@compute @workgroup_size(128) fn giftApply(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||old[i].life.w==0u) {
    return;
  }
  let j=intents[i].aim.x;
  if(j==NONE) {
    return;
  }
  let amount=portion(intents[i].base.y,CAP_E-intents[j].base.x,wideGift(j));
  intents[i].base.y=amount;
  atomicAdd(&s.giftCredit[j],amount);
}
@compute @workgroup_size(128) fn theftPlan(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||old[i].life.w==0u) {
    return;
  }
  let balance=intents[i].base.x-intents[i].base.y+atomicLoad(&s.giftCredit[i]);
  intents[i].base.z=balance;
  let j=intents[i].aim.y;
  if(j==NONE) {
    return;
  }
  let amount=min(quantum(intents[i].req.y),u32(floor(f32(CAP_E-balance)/.75)));
  intents[i].base.w=amount;
  let prev=atomicAdd(&s.theft[j].lo,amount);
  if(prev+amount<prev) {
    atomicAdd(&s.theft[j].hi,1u);
  }
}
@compute @workgroup_size(128) fn theftApply(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||old[i].life.w==0u) {
    return;
  }
  let j=intents[i].aim.y;
  if(j==NONE) {
    return;
  }
  let amount=portion(intents[i].base.w,intents[j].base.z,wideTheft(j));
  atomicAdd(&s.theftDebit[j],amount);
  atomicAdd(&s.theftCredit[i],u32(floor(f32(amount)*.75)));
}
fn forces(i:u32)->vec3f {
  let c=old[i];
  let base=vec2i(floor(c.p.xy/32.0));
  var f=vec2f(0);
  var torque=0.0;
  for(var y=-1;y<=1;y++) {
    for(var x=-1;x<=1;x++) {
      let b=(base+vec2i(x,y)+vec2i(i32(SIDE)))%vec2i(i32(SIDE));
      var j=atomicLoad(&s.heads[u32(b.y)*SIDE+u32(b.x)]);
      loop {
        if(j==NONE) {
          break;
        }
        if(j!=i) {
          let d=delta(c.p.xy,old[j].p.xy);
          let q=dot(d,d);
          if(q<100.0&&q>.000001) {
            let distance=sqrt(q);
            f+=d*((10.0-distance)*55.0/distance);
          }
        }
        j=s.next[j];
      }
    }
  }
  for(var k=0u;k<4u;k++) {
    let j=liveLink(i,k);
    if(j==NONE) {
      continue;
    }
    let n=old[j];
    var other=0u;
    for(var q=0u;q<4u;q++) {
      if(n.link[q]==i+1u) {
        other=q;
      }
    }
    let a=(c.b.y+c.anchor[k])*6.2831853;
    let b=(n.b.y+n.anchor[other])*6.2831853;
    let arm=vec2f(cos(a),sin(a))*3.0;
    let d=delta(n.p.xy,c.p.xy)+vec2f(cos(b),sin(b))*3.0-arm;
    let length=length(d);
    if(length>.0001) {
      let force=d*((length-max(.5,18.0*(c.res.x+n.res.x)*.5-6.0))*24.0/length);
      f+=force;
      torque+=(arm.x*force.y-arm.y*force.x)/8.0/6.2831853;
    }
  }
  return vec3f(f,torque);
}
@compute @workgroup_size(128) fn life(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||old[i].life.w==0u) {
    return;
  }
  var c=cells[i];
  c.b.x=f32(intents[i].base.z-atomicLoad(&s.theftDebit[i])+atomicLoad(&s.theftCredit[i]));
  if(c.b.x==0.0) {
    c.life.w=0u;
    atomicSub(&s.genes[c.machine.y].refs,1u);
    atomicSub(&s.counter[1],1u);
    atomicAdd(&s.counter[7],1u);
    geneMetric(c.machine.y,u32(c.phen.z*256.0));
    let k=bin(c.p.xy);
    depositAdd(k*2u,u32((2.0+c.res.z*.5)*Q*cfg.misc.w));
    depositAdd(k*2u+1u,u32((2.0+c.res.w*.5)*Q*cfg.misc.w));
    cells[i]=c;
    return;
  }
  if(tick()%60u==0u) {
    geneMetric(c.machine.y,u32(c.phen.z*256.0));
    c.phen.z=0.0;
  }
  let force=forces(i);
  c.phen.w=clamp((c.phen.w+force.z*DT)*.94,-2.0,2.0);
  c.b.y=fract(c.b.y+c.phen.w*DT);
  c.p=vec4f(c.p.xy,clamp((c.p.zw+force.xy*DT)*.94,vec2f(-100),vec2f(100)));
  c.p=vec4f(wrapped(c.p.xy+c.p.zw*DT),c.p.zw);
  let birth=u32(intents[i].req.z);
  var free=NONE;
  for(var k=0u;k<4u;k++) {
    if(c.link[k]==0u) {
      free=k;
      break;
    }
  }
  if(birth>0u&&c.b.x>=(cfg.energy.z+40.0)*Q&&(birth==1u||free!=NONE)) {
    let at=atomicAdd(&s.counter[3],1u);
    if(at<atomicLoad(&s.counter[2])) {
      let j=s.free[at];
      let identity=atomicAdd(&s.counter[11],1u);
      var child=c;
      let heading=c.b.y*6.2831853;
      child.p=vec4f(wrapped(c.p.xy+vec2f(cos(heading),sin(heading))*14.0),0,0);
      let remaining=u32(c.b.x)-quantum(cfg.energy.z);
      child.b.x=f32(remaining/2u);
      c.b.x=f32(remaining-remaining/2u);
      child.b.y=fract(c.b.y+(random(identity)-.5)*2.0*cfg.misc.x/360.0);
      child.machine.x=identity;
      child.machine.w=1u;
      child.life=vec4u(0,c.life.y+1u,c.machine.x,1);
      child.link=vec4u(0);
      child.anchor=vec4f(0);
      child.mail=vec4f(0);
      child.sender=vec4u(0);
      child.signal=vec4f(0);
      child.phen.z=0.0;
      child.phen.w=0.0;
      child.res.z=c.res.z*.5;
      child.res.w=c.res.w*.5;
      c.res.z*=.5;
      c.res.w*=.5;
      let dst=u32(intents[i].req.w);
      c.r[dst]=0;
      child.r[dst]=1;
      if(birth==2u) {
        c.link[free]=j+1u;
        c.anchor[free]=0.0;
        child.link[0]=i+1u;
        child.anchor[0]=fract(c.b.y+.5-child.b.y);
      }
      cells[j]=child;
      atomicAdd(&s.genes[c.machine.y].refs,1u);
      atomicAdd(&s.genes[c.machine.y].births,1u);
      atomicAdd(&s.counter[1],1u);
      atomicAdd(&s.counter[6],1u);
    }
  }
  cells[i]=c;
}
@compute @workgroup_size(128) fn linkPlan(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||cells[i].life.w==0u) {
    return;
  }
  var free=NONE;
  for(var k=0u;k<4u;k++) {
    if(cells[i].link[k]==0u) {
      free=k;
      break;
    }
  }
  intents[i].misc.y=free;
  let j=intents[i].aim.z;
  if(j==NONE||free==NONE||cells[j].life.w==0u||linked(cells[i],j)||degree(cells[j])>=4u) {
    return;
  }
  atomicMin(&s.claim[i],i);
  atomicMin(&s.claim[j],i);
}
@compute @workgroup_size(128) fn linkApply(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||cells[i].life.w==0u) {
    return;
  }
  let source=atomicLoad(&s.claim[i]);
  if(source==NONE) {
    return;
  }
  let aim=intents[source].aim.z;
  if(aim==NONE||atomicLoad(&s.claim[source])!=source||atomicLoad(&s.claim[aim])!=source) {
    return;
  }
  let j=select(source,aim,i==source);
  let free=intents[i].misc.y;
  if(free==NONE) {
    return;
  }
  let d=delta(cells[j].p.xy,cells[i].p.xy);
  cells[i].link[free]=j+1u;
  cells[i].anchor[free]=fract(atan2(d.y,d.x)/6.2831853-cells[i].b.y);
}
@compute @workgroup_size(128) fn mailAndPrune(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i>=N||cells[i].life.w==0u) {
    return;
  }
  var links=cells[i].link;
  for(var k=0u;k<4u;k++) {
    if(links[k]>0u) {
      let j=links[k]-1u;
      if(cells[j].life.w==0u||!any(cells[j].link==vec4u(i+1u))||length(delta(cells[j].p.xy,cells[i].p.xy))>65.0) {
        links[k]=0u;
      }
    }
  }
  intents[i].newLinks=links;
  if(old[i].life.w==0u) {
    return;
  }
  for(var ch=0u;ch<4u;ch++) {
    var sender=NONE;
    for(var k=0u;k<4u;k++) {
      let j=liveLink(i,k);
      if(j!=NONE&&(intents[j].misc.x&(1u<<ch))!=0u&&(intents[j].dest[ch]==0u||intents[j].dest[ch]==i+1u)) {
        sender=min(sender,j);
      }
    }
    if(sender!=NONE) {
      cells[i].mail[ch]=intents[sender].msg[ch];
      cells[i].sender[ch]=sender+1u;
    }
  }
}
@compute @workgroup_size(128) fn pruneApply(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i<N&&cells[i].life.w>0u) {
    cells[i].link=intents[i].newLinks;
  }
}
@compute @workgroup_size(128) fn geneScan(@builtin(global_invocation_id) id:vec3u) {
  let g=id.x;
  if(g>=G||tick()%60u!=0u) {
    return;
  }
  if(g==0u) {
    let deficit=u32(max(0.0,f32(cfg.sim.w)-f32(atomicLoad(&s.counter[1]))));
    atomicStore(&s.counter[16],u32(cfg.arrivals.x)+min(deficit,N/512u+1u));
  }
  let refs=atomicLoad(&s.genes[g].refs);
  if(refs==0u) {
    let at=atomicAdd(&s.counter[4],1u);
    s.freeGenes[at]=g;
    return;
  }
  let births=atomicLoad(&s.genes[g].births);
  let harvest=f32(atomicLoad(&s.genes[g].harvest))/256.0;
  let age=tick()-genomes[g].ancestry.y;
  if(cfg.selection.w>0.0&&f32(age)*DT>=cfg.selection.x&&harvest>=cfg.selection.y&&f32(births)>=cfg.selection.z) {
    let score=u32(min(65534.0,f32(min(refs,1024u))*16.0+f32(min(births,4096u))+min(harvest,4096.0)*.05));
    let bucket=hash(genomes[g].info.z)%ARCH;
    atomicMax(&s.candidates[bucket],score*65536u+g);
  }
}
@compute @workgroup_size(128) fn archiveUpdate(@builtin(global_invocation_id) id:vec3u) {
  let a=id.x;
  if(a>=ARCH||tick()%60u!=0u) {
    return;
  }
  let candidate=atomicLoad(&s.candidates[a]);
  let score=candidate/65536u;
  let previous=archive[a].ancestry.z;
  archive[a].ancestry.z=u32(f32(previous)*.995);
  if(score>0u&&score>previous) {
    let g=candidate%65536u;
    if(archive[a].info.x==0u) {
      atomicAdd(&s.counter[5],1u);
    }
    archive[a]=genomes[g];
    archive[a].ancestry.z=score;
  }
}
@compute @workgroup_size(128) fn arrivals(@builtin(global_invocation_id) id:vec3u) {
  let r=id.x;
  if(tick()%60u!=0u) {
    return;
  }
  let wanted=atomicLoad(&s.counter[16]);
  let start=min(atomicLoad(&s.counter[3]),atomicLoad(&s.counter[2]));
  if(r>=wanted||r>=atomicLoad(&s.counter[4])||start+r>=atomicLoad(&s.counter[2])) {
    return;
  }
  let i=s.free[start+r];
  let g=s.freeGenes[r];
  let identity=atomicAdd(&s.counter[11],1u);
  let serial=atomicAdd(&s.counter[12],1u);
  let rng=hash(cfg.sim.x+tick()*917u+r);
  var source=NONE;
  if(random(rng)<cfg.arrivals.y) {
    for(var k=0u;k<ARCH;k++) {
      let a=(hash(rng)%ARCH+k)%ARCH;
      if(archive[a].info.x>0u) {
        source=a;
        break;
      }
    }
  }
  if(source==NONE) {
    freshGenome(g,serial,rng);
    atomicAdd(&s.counter[8],1u);
  }
  else {
    genomes[g]=archive[source];
    genomes[g].ancestry=vec4u(genomes[g].info.y,tick(),0,0);
    genomes[g].info.y=serial;
    atomicAdd(&s.counter[9],1u);
    if(random(rng+1u)<cfg.arrivals.z) {
      let at=hash(rng+2u)%genomes[g].info.x;
      let op=u32(genomes[g].code[at].x);
      let arg=hash(rng+3u)%3u;
      if(random(rng+4u)<.75&&SIG[op][arg]>0u) {
        let previous=genomes[g].code[at][arg+1u];
        var changed=operand(SIG[op][arg],genomes[g].info.x,rng+5u);
        if(changed==previous) {
          switch SIG[op][arg] {
            case 1u: {
              changed=-1000000.0-f32((u32(-previous-1000000.0)+1u)%8u);
            }
            case 3u: {
              changed=f32((u32(previous)+1u)%genomes[g].info.x);
            }
            case 4u: {
              changed=f32((u32(previous)+1u)%17u);
            }
            case 5u: {
              changed=f32((u32(previous)+1u)%8u);
            }
            default: {
              changed=select(0.0,1.0,previous==0.0);
            }
          }
        }
        genomes[g].code[at][arg+1u]=changed;
      }
      else {
        var newop=hash(rng+6u)%41u;
        if(newop==op) {
          newop=(newop+1u)%41u;
        }
        genomes[g].code[at]=vec4f(f32(newop),operand(SIG[newop].x,genomes[g].info.x,rng+7u),operand(SIG[newop].y,genomes[g].info.x,rng+8u),operand(SIG[newop].z,genomes[g].info.x,rng+9u));
      }
      genomes[g].info.w++;
      atomicAdd(&s.counter[10],1u);
    }
  }
  atomicStore(&s.genes[g].refs,1u);
  atomicStore(&s.genes[g].births,0u);
  atomicStore(&s.genes[g].harvest,0u);
  cells[i]=newCell(i,g,identity,rng+10u);
  atomicAdd(&s.counter[1],1u);
}
`;
}
