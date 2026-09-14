// Exact weighted culling without a CPU readback or an unbounded GPU sort.
// Exponential-race keys give inverse-energy sampling without replacement;
// the smallest excess keys are culled. Living and corpse pools may be selected independently. Candidate index breaks key ties.
// Declarations are fields to append inside Scratch. Source expects Cell cells,
// N=entityCapacity, C=2*N+max(G,64), s:Scratch, cfg.sim.x (seed), hash(u32), and tick().
export function capacitySelection({
  capacity,
  genomeCapacity,
  entityCapacity = capacity,
  policy = "entities",
  prefix = "capacity",
  dynamicCorpseLimit = false,
}) {
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 262144 ||
    !Number.isInteger(entityCapacity) ||
    entityCapacity < capacity ||
    entityCapacity > 524288 ||
    !["entities", "living", "corpses"].includes(policy) ||
    !/^[a-zA-Z][a-zA-Z0-9]*$/.test(prefix) ||
    !Number.isInteger(genomeCapacity) ||
    genomeCapacity < 1 ||
    genomeCapacity > 65536
  )
    throw Error("Invalid capacity-selection dimensions");
  // Body arrivals can contain 64 cells while sharing only one genome.
  const candidates = 2 * entityCapacity + Math.max(genomeCapacity, 64);
  const eligible =
    policy === "living"
      ? "life==1u"
      : policy === "corpses"
        ? "life==2u"
        : "life==1u||life==2u";
  const keySource =
    policy === "corpses"
      ? "s.selectionKeys[i]=0xfffffffeu-min(cells[i].life.x,0xfffffffeu);"
      : `let bits=hash(hash(i+0x9e3779b9u)^hash(cells[i].machine.x+0x85ebca6bu)^hash(tick()^cfg.sim.x));
  let u=f32(bits>>8u)/16777216.0;
  var energy=select(1.0,max(1.0,cells[i].b.x),life==1u);
  s.selectionKeys[i]=select(bitcast<u32>(-log(1.0-u)*energy),0u,u==0.0);`;
  const declarations = `
  selectionKeys:array<u32,C>,
  selectionMap:array<u32,C>,
  selectionHistogram:array<atomic<u32>,256>,
  selectionState:array<atomic<u32>,16>,`;
  // state: occupied, overflow, residual zero-based rank, key prefix, index prefix.
  const parts = [
    `
@compute @workgroup_size(128) fn capacityReset(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;
  if(i<256u){atomicStore(&s.selectionHistogram[i],0u);}
  if(i<16u){atomicStore(&s.selectionState[i],0u);}
}
@compute @workgroup_size(128) fn capacityKeys(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;if(i>=C){return;}
  s.selectionMap[i]=0u;
  let life=cells[i].life.w;
  if(!(${eligible})){s.selectionKeys[i]=0xffffffffu;return;}
  atomicAdd(&s.selectionState[0],1u);
  ${keySource}
}
@compute @workgroup_size(128) fn capacityPrepare(@builtin(global_invocation_id) id:vec3u) {
  if(id.x!=0u){return;}
  let occupied=atomicLoad(&s.selectionState[0]);
  let limit=${dynamicCorpseLimit ? `min(${capacity}u,N-min(N,atomicLoad(&s.counter[1])))` : `${capacity}u`};
  let excess=occupied-min(occupied,limit);
  atomicStore(&s.selectionState[1],excess);
  atomicStore(&s.selectionState[2],excess-min(excess,1u));
}`,
  ];
  const stages = [
    { name: "capacityReset", count: 256 },
    { name: "capacityKeys", count: candidates },
    { name: "capacityPrepare", count: 1 },
  ];
  for (let pass = 0; pass < 7; pass++) {
    const keyPass = pass < 4;
    const shift = keyPass ? 24 - pass * 8 : 16 - (pass - 4) * 8;
    const mask = shift === 24 ? 0 : (0xffffffff << (shift + 8)) >>> 0;
    const prefixIndex = keyPass ? 3 : 4;
    const matches = keyPass
      ? `(key&${mask}u)==atomicLoad(&s.selectionState[3])`
      : `key==atomicLoad(&s.selectionState[3])&&(i&${mask}u)==atomicLoad(&s.selectionState[4])`;
    parts.push(`
@compute @workgroup_size(128) fn capacityHistogram${pass}(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;if(i>=C||atomicLoad(&s.selectionState[1])==0u){return;}
  let key=s.selectionKeys[i];if(key==0xffffffffu||!(${matches})){return;}
  atomicAdd(&s.selectionHistogram[(${keyPass ? "key" : "i"}>>${shift}u)&255u],1u);
}
@compute @workgroup_size(128) fn capacityChoose${pass}(@builtin(global_invocation_id) id:vec3u) {
  if(id.x!=0u||atomicLoad(&s.selectionState[1])==0u){return;}
  var rank=atomicLoad(&s.selectionState[2]);var chosen=0u;var found=false;
  for(var bucket=0u;bucket<256u;bucket++){
    let count=atomicLoad(&s.selectionHistogram[bucket]);
    if(!found){if(rank<count){chosen=bucket;found=true;}else{rank-=count;}}
    atomicStore(&s.selectionHistogram[bucket],0u);
  }
  atomicStore(&s.selectionState[2],rank);
  atomicOr(&s.selectionState[${prefixIndex}],chosen<<${shift}u);
}`);
    stages.push({ name: `capacityHistogram${pass}`, count: candidates });
    stages.push({ name: `capacityChoose${pass}`, count: 1 });
  }
  parts.push(`
@compute @workgroup_size(128) fn capacitySurvivors(@builtin(global_invocation_id) id:vec3u) {
  let i=id.x;if(i>=C){return;}
  let key=s.selectionKeys[i];if(key==0xffffffffu){let life=cells[i].life.w;s.selectionMap[i]=select(0u,1u,life==1u||life==2u);return;}
  if(atomicLoad(&s.selectionState[1])==0u){s.selectionMap[i]=1u;return;}
  let threshold=atomicLoad(&s.selectionState[3]);
  let index=atomicLoad(&s.selectionState[4]);
  s.selectionMap[i]=select(1u,0u,key<threshold||(key==threshold&&i<=index));
}`);
  stages.push({ name: "capacitySurvivors", count: candidates });
  return {
    declarations,
    source: parts.join("\n").replaceAll("fn capacity", `fn ${prefix}`),
    stages: stages.map((stage) => ({
      ...stage,
      name: stage.name.replace(/^capacity/, prefix),
    })),
    candidates,
    byteLength: candidates * 8 + 256 * 4 + 16 * 4,
  };
}
