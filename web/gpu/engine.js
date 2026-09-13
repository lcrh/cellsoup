import { BodyArchive } from "./body-archive.js";
import {
  compileTree,
  TREE_EVOLUTION_DEFAULTS,
  treeEvolutionOptions,
  decodeTreeBytecode,
  randomTree,
  mutateTree,
  sampleTreeArrival,
  treeRng,
  formatTree,
  checkTree,
} from "./trees.js";
import { simulationShader } from "./shader.js";
import { compile } from "./language.js";
import { mutateAssemblyGenome } from "./fork-mutation.js";
export const CELL_FLOATS = 52,
  CELL_BYTES = 208,
  GENOME_BYTES = 1056,
  ENERGY_SCALE = 4096;
const stages = [
  "clear",
  "field",
  "prepare",
  "broadcast",
  "colonyInit",
  "colonyUnion",
  "colonyCount",
  "vm",
  "giftPlan",
  "giftApply",
  "theftPlan",
  "theftApply",
  "life",
  "linkPlan",
  "linkApply",
  "mailAndPrune",
  "pruneApply",
  "geneScan",
  "archiveUpdate",
  "arrivals",
];
export const defaults = {
  treePrograms: 1,
  ...TREE_EVOLUTION_DEFAULTS,
  loopYield: 1,
  manualArrivals: 0,
  bodyShare: 0,
  bodyPreserveLinks: 1,
  bodyMaxCells: 8,
  bodyCaptureSeconds: 5,
  linkedRelay: 0,
  queryRadius: 128,
  queryBudget: 32,
  signalRetention: 0.97,
  motorImpulse: 5,
  dragRetention: 0.94,
  springStiffness: 24,
  collisionStiffness: 55,
  linkBarrierStiffness: 90,
  linkBarrierDamping: 5,
  shieldProtection: 0.9,
  eatAmount: 3,
  attackAmountMax: 3,
  photoEfficiency: 1,
  scavengeEfficiency: 1,
  mobilizeEfficiency: 1,
  interactionRadius: 18,
  linkRange: 24,
  collisionDistance: 10,
  linkBarrierWidth: 6,
  springRestDistance: 18,

  crossover: 0.25,
  capacity: 131072,
  genomeCapacity: 32768,
  side: 256,
  sources: 1,
  initial: 32768,
  seed: 42,
  budget: 24,
  floor: 2048,
  rate: 32,
  share: 0.5,
  mutation: 0.8,
  forkMutation: 0.01,
  specializationStrength: 0,
  specializationTime: 60,
  energyCapacity: 200,
  seedEnergy: 24,
  seedStorage: 24,
  upkeep: 0.5,
  ambientTemperature: 20,
  sunlightHeating: 1,
  activityHeating: 0.12,
  cooling: 0.2,
  thermalExchange: 0.12,
  crowdInsulation: 1,
  safeTemperature: 28,
  heatDamage: 0.5,
  energyDecay: 0.05,
  divisionCost: 12,
  minimumBirthEnergy: 12,
  exchange: 0.12,
  shieldUpkeep: 0.72,
  cpuCost: 0.00005,
  moveCost: 0.004,
  turnCost: 0.0001,
  linkCost: 0.5,
  contractCost: 0.08,
  attackCost: 0.08,
  attackDamageCost: 0.2,
  emitCost: 0.01,
  sendCost: 0.01,
  jitter: 12,
  archiveAge: 60,
  archiveHarvest: 120,
  archiveOffspring: 8,
  archiveEnabled: 1,
  executionTrace: 0,
  solarRate: 4,
  sunContrast: 2,
  cloudCover: 0.5,
  cloudOpacity: 0.95,
  cloudScale: 1200,
  cloudSpeed: 12,
  cloudMorph: 180,
  solarEnabled: 1,
  corpseEnergy: 8,
  corpseLifetime: 900,
  eatCost: 0.04,
  storageCapacity: 400,
};
export async function createLifeEngine(device, options = {}) {
  for (const key of Object.keys(options))
    if (!(key in defaults)) throw Error(`Unknown setting ${key}`);
  const cfg = { ...defaults, ...options };
  treeEvolutionOptions(cfg);
  if (cfg.motorImpulse < 0 || cfg.motorImpulse > 20)
    throw Error("Invalid motorImpulse");
  if (cfg.dragRetention < 0.5 || cfg.dragRetention > 1)
    throw Error("Invalid dragRetention");
  if (cfg.springStiffness < 0 || cfg.springStiffness > 100)
    throw Error("Invalid springStiffness");
  if (cfg.collisionStiffness < 0 || cfg.collisionStiffness > 200)
    throw Error("Invalid collisionStiffness");
  if (cfg.linkBarrierStiffness < 0 || cfg.linkBarrierStiffness > 300)
    throw Error("Invalid linkBarrierStiffness");
  if (cfg.linkBarrierDamping < 0 || cfg.linkBarrierDamping > 20)
    throw Error("Invalid linkBarrierDamping");
  if (cfg.shieldProtection < 0 || cfg.shieldProtection > 1)
    throw Error("Invalid shieldProtection");
  if (cfg.eatAmount < 0.1 || cfg.eatAmount > 20)
    throw Error("Invalid eatAmount");
  if (cfg.attackAmountMax < 0 || cfg.attackAmountMax > 20)
    throw Error("Invalid attackAmountMax");
  if (cfg.photoEfficiency < 0.1 || cfg.photoEfficiency > 1)
    throw Error("Invalid photoEfficiency");
  if (cfg.scavengeEfficiency < 0.1 || cfg.scavengeEfficiency > 1)
    throw Error("Invalid scavengeEfficiency");
  if (cfg.mobilizeEfficiency < 0.1 || cfg.mobilizeEfficiency > 1)
    throw Error("Invalid mobilizeEfficiency");
  if (cfg.interactionRadius < 6 || cfg.interactionRadius > 32)
    throw Error("Invalid interactionRadius");
  if (cfg.linkRange < 6 || cfg.linkRange > 32) throw Error("Invalid linkRange");
  if (cfg.collisionDistance < 6 || cfg.collisionDistance > 16)
    throw Error("Invalid collisionDistance");
  if (cfg.linkBarrierWidth < 0 || cfg.linkBarrierWidth > 12)
    throw Error("Invalid linkBarrierWidth");
  if (cfg.springRestDistance < 10 || cfg.springRestDistance > 30)
    throw Error("Invalid springRestDistance");

  if (
    ![0, 1].includes(cfg.manualArrivals) ||
    (cfg.manualArrivals && !cfg.treePrograms)
  )
    throw Error("Manual arrivals require trees");
  if (
    cfg.bodyShare > 1 ||
    cfg.bodyPreserveLinks > 1 ||
    !Number.isInteger(cfg.bodyMaxCells) ||
    cfg.bodyMaxCells < 2 ||
    cfg.bodyMaxCells > 64 ||
    !Number.isInteger(cfg.bodyCaptureSeconds) ||
    cfg.bodyCaptureSeconds < 1 ||
    cfg.bodyCaptureSeconds > 120
  )
    throw Error("Invalid body resampling settings");
  if (![0, 1].includes(cfg.loopYield)) throw Error("Invalid loop yield");
  for (const [k, v] of Object.entries(cfg))
    if (!Number.isFinite(v) || !Number.isFinite(Math.fround(v)) || v < 0)
      throw Error(`Invalid ${k}`);
  for (const k of [
    "capacity",
    "genomeCapacity",
    "side",
    "sources",
    "initial",
    "seed",
    "budget",
    "floor",
    "rate",
  ])
    if (!Number.isInteger(cfg[k])) throw Error(`${k} must be an integer`);
  if (
    cfg.capacity < 1 ||
    cfg.capacity > 262144 ||
    cfg.genomeCapacity < 1 ||
    cfg.genomeCapacity > 65536 ||
    ![0, 1].includes(cfg.treePrograms) ||
    ![0, 1].includes(cfg.executionTrace) ||
    cfg.crossover > 1 ||
    cfg.initial > Math.min(cfg.capacity, cfg.genomeCapacity) ||
    cfg.side < 5 ||
    cfg.sources < 1 ||
    cfg.seed > 4294967295 ||
    cfg.floor > cfg.capacity ||
    cfg.rate > cfg.capacity ||
    cfg.cloudCover > 1 ||
    cfg.cloudOpacity > 1 ||
    cfg.cloudScale < 64 ||
    cfg.cloudMorph < 1 ||
    cfg.corpseLifetime < 1 ||
    cfg.thermalExchange > 0.25 ||
    cfg.ambientTemperature > cfg.safeTemperature ||
    cfg.safeTemperature > 1000 ||
    cfg.sunlightHeating > 100 ||
    cfg.activityHeating > 100 ||
    cfg.cooling > 10 ||
    cfg.crowdInsulation > 100 ||
    cfg.heatDamage > 100 ||
    cfg.solarRate > 100 ||
    cfg.sunContrast < 1 ||
    cfg.sunContrast > 8 ||
    cfg.corpseEnergy > 200 ||
    cfg.solarEnabled > 1 ||
    cfg.energyCapacity < 40 ||
    cfg.energyCapacity > 1000 ||
    cfg.seedEnergy > cfg.energyCapacity ||
    cfg.minimumBirthEnergy < 1 / ENERGY_SCALE ||
    cfg.divisionCost + 2 * cfg.minimumBirthEnergy > cfg.energyCapacity ||
    cfg.storageCapacity > 1000 ||
    cfg.seedStorage > cfg.storageCapacity ||
    cfg.energyDecay > 1 ||
    cfg.budget > 128 ||
    cfg.exchange > 0.25 ||
    cfg.mutation > 1 ||
    cfg.forkMutation > 1 ||
    cfg.linkedRelay > 0.95 ||
    cfg.queryRadius > 128 ||
    cfg.queryBudget < 1 ||
    cfg.queryBudget > 128 ||
    cfg.signalRetention > 1 ||
    cfg.specializationStrength > 0.95 ||
    cfg.specializationTime < 1 ||
    cfg.specializationTime > 3600 ||
    cfg.share > 1 ||
    cfg.side > 512 ||
    cfg.sources > 256
  )
    throw Error("Unsupported engine dimensions or rates");
  const n = cfg.capacity,
    g = cfg.genomeCapacity,
    t = cfg.side ** 2;
  const storage = (size) =>
    device.createBuffer({
      size: Math.ceil(size / 4) * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });
  const state = [storage(n * CELL_BYTES), storage(n * CELL_BYTES)];
  const treeMemoryOffset =
    Math.ceil((40 * n + 20 * t + 20 * g + 640) / 16) * 16;
  const childStateOffset = treeMemoryOffset + (cfg.treePrograms ? 48 * n : 0);
  const traceOffset = childStateOffset + (cfg.treePrograms ? 48 * n : 0);
  const traceBytes = 16 + 32 * 16 + 8192 * 4 + 1048576 * 4;
  const birthMutationOffset =
    traceOffset + (cfg.executionTrace ? traceBytes : 0);
  const specializationOffset =
    birthMutationOffset + (cfg.forkMutation > 0 ? n * 16 : 0);
  const relayOffset =
    specializationOffset + (cfg.specializationStrength > 0 ? n * 16 : 0);
  const cpuRemainderOffset =
    relayOffset +
    (cfg.linkedRelay > 0 ? n * 32 : 0) +
    (cfg.treePrograms ? n * 8 : 0);
  const scratch = storage(Math.ceil((cpuRemainderOffset + n * 4) / 16) * 16),
    genomes = storage(g * GENOME_BYTES),
    archive = storage(128 * GENOME_BYTES),
    food = storage(t * 16 + cfg.sources * 32),
    intents = storage(n * 128),
    activity = storage(n * 32);
  const uniform = device.createBuffer({
    size: 320,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const settings = new ArrayBuffer(320),
    u = new Uint32Array(settings),
    f = new Float32Array(settings);
  u.set([cfg.seed, cfg.budget, cfg.initial, cfg.floor]);
  f.set(
    [
      cfg.rate,
      cfg.share,
      cfg.mutation,
      cfg.forkMutation,
      cfg.seedEnergy,
      cfg.upkeep,
      cfg.divisionCost,
      cfg.minimumBirthEnergy,
      0,
      cfg.exchange,
      0,
      cfg.shieldUpkeep,
      cfg.cpuCost,
      cfg.moveCost,
      cfg.turnCost,
      cfg.linkCost,
      cfg.contractCost,
      cfg.attackCost,
      cfg.emitCost,
      cfg.sendCost,
      cfg.jitter,
      0,
      0,
      0,
      cfg.archiveAge,
      cfg.archiveHarvest,
      cfg.archiveOffspring,
      cfg.archiveEnabled,
      cfg.solarRate,
      cfg.cloudCover,
      cfg.cloudOpacity,
      cfg.cloudScale,
      cfg.cloudSpeed,
      cfg.cloudMorph,
      cfg.solarEnabled,
      cfg.corpseEnergy,
      cfg.corpseLifetime,
      cfg.eatCost,
      cfg.energyDecay,
      cfg.seedStorage,
      cfg.storageCapacity,
      cfg.attackDamageCost,
      cfg.sunContrast,
      0,
      cfg.ambientTemperature,
      cfg.sunlightHeating,
      cfg.activityHeating,
      cfg.cooling,
      cfg.thermalExchange,
      cfg.crowdInsulation,
      cfg.safeTemperature,
      cfg.heatDamage,
    ],
    4,
  );
  f.set(
    [
      cfg.specializationStrength,
      Math.exp(-1 / (60 * cfg.specializationTime)),
      cfg.springRestDistance,
      0,
    ],
    56,
  );
  f.set(
    [cfg.linkedRelay, cfg.signalRetention, cfg.queryRadius, cfg.queryBudget],
    60,
  );
  f.set(
    [
      cfg.motorImpulse,
      cfg.dragRetention,
      cfg.springStiffness,
      cfg.collisionStiffness,
      cfg.linkBarrierStiffness,
      cfg.linkBarrierDamping,
      cfg.shieldProtection,
      cfg.eatAmount,
      cfg.attackAmountMax,
      cfg.photoEfficiency,
      cfg.scavengeEfficiency,
      cfg.mobilizeEfficiency,
      cfg.interactionRadius,
      cfg.linkRange,
      cfg.collisionDistance,
      cfg.linkBarrierWidth,
    ],
    64,
  );
  device.queue.writeBuffer(uniform, 0, settings);
  const source = simulationShader(cfg);
  const fingerprint = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const module = device.createShaderModule({
    label: "Cell Soup lifecycle",
    code: source,
  });
  const info = await module.getCompilationInfo();
  if (info.messages.some((m) => m.type === "error"))
    throw Error(
      info.messages
        .map((m) => `${m.lineNum}:${m.linePos} ${m.message}`)
        .join("\n"),
    );
  const layout = device.createBindGroupLayout({
    entries: Array.from({ length: 9 }, (_, binding) => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type:
          binding === 7
            ? "uniform"
            : binding === 0
              ? "read-only-storage"
              : "storage",
      },
    })),
  });
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [layout],
  });
  const pipelines = Object.fromEntries(
    await Promise.all(
      ["seed", ...stages].map(async (entryPoint) => [
        entryPoint,
        await device.createComputePipelineAsync({
          layout: pipelineLayout,
          compute: { module, entryPoint },
        }),
      ]),
    ),
  );
  const groups = state.map((_, i) =>
    device.createBindGroup({
      layout,
      entries: [
        state[i],
        state[1 - i],
        scratch,
        genomes,
        archive,
        food,
        intents,
        uniform,
        activity,
      ].map((buffer, binding) => ({ binding, resource: { buffer } })),
    }),
  );
  let parity = 0,
    tick = 0,
    hostOperation = false;
  function dispatch(encoder, name, count) {
    if (!count) return;
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipelines[name]);
    pass.setBindGroup(0, groups[parity]);
    pass.dispatchWorkgroups(Math.ceil(count / (name === "weather" ? 64 : 128)));
    pass.end();
  }
  const treeSlots = new Array(g),
    treeRandom = treeRng(cfg.seed ^ 0x735a2d19);
  let treeArchive = [];
  function treeRecord(
    tree,
    serial,
    parent = null,
    secondParent = 0,
    mutated = false,
  ) {
    const code = compileTree(tree, cfg);
    const record = {
      id: serial,
      tree: code.tree,
      founder: parent?.founder ?? serial,
      depth: (parent?.depth ?? 0) + Number(mutated),
      parent: parent?.id ?? 0,
      secondParent,
      bornTick: tick,
    };
    const buffer = new ArrayBuffer(GENOME_BYTES),
      view = new DataView(buffer),
      source = new DataView(code.buffer);
    [
      code.length,
      serial,
      record.founder,
      record.depth,
      record.parent,
      tick,
      0,
      secondParent,
    ].forEach((value, i) => view.setUint32(i * 4, value, true));
    for (let k = 0; k < code.length; k++) {
      view.setFloat32(32 + k * 16, source.getInt32(k * 16, true), true);
      for (let a = 1; a < 4; a++)
        view.setFloat32(
          32 + k * 16 + a * 4,
          source.getFloat32(k * 16 + a * 4, true),
          true,
        );
    }
    return { record, buffer };
  }
  const initial = device.createCommandEncoder();
  dispatch(initial, "seed", Math.max(cfg.initial, cfg.sources));
  device.queue.submit([initial.finish()]);
  await device.queue.onSubmittedWorkDone();
  parity = 1;
  const counterOffset = t * 4 + n * 8,
    geneOffset = t * 20 + n * 40 + 128;
  async function read(buffer, offset = 0, size = buffer.size) {
    const result = device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const e = device.createCommandEncoder();
    e.copyBufferToBuffer(buffer, offset, result, 0, size);
    device.queue.submit([e.finish()]);
    await result.mapAsync(GPUMapMode.READ);
    const copy = result.getMappedRange().slice(0);
    result.unmap();
    result.destroy();
    return copy;
  }
  if (cfg.treePrograms && cfg.initial) {
    const founders = new Uint8Array(cfg.initial * GENOME_BYTES);
    for (let i = 0; i < cfg.initial; i++) {
      const { record, buffer } = treeRecord(
        randomTree(treeRandom, undefined, cfg),
        i + 1,
      );
      treeSlots[i] = record;
      founders.set(new Uint8Array(buffer), i * GENOME_BYTES);
    }
    device.queue.writeBuffer(genomes, 0, founders);
  }
  async function prepareTreeArrivals() {
    // The preceding submission ends after archive selection, before arrivals.
    // Keep the archive's typed trees even when their live genome slots recycle.
    const [counterData, archivedData] = await Promise.all([
      read(scratch, counterOffset, 128),
      read(archive),
    ]);
    const counters = new Uint32Array(counterData),
      av = new DataView(archivedData);
    const byId = new Map(
      [...treeSlots.filter(Boolean), ...treeArchive].map((r) => [r.id, r]),
    );
    treeArchive = [];
    for (let i = 0; i < 128; i++) {
      if (!av.getUint32(i * GENOME_BYTES, true)) continue;
      const id = av.getUint32(i * GENOME_BYTES + 4, true),
        record = byId.get(id);
      if (!record) throw Error("Missing archived tree genotype " + id);
      treeArchive.push(record);
    }
    if (cfg.manualArrivals || (cfg.treePrograms && cfg.bodyShare > 0)) return 0;
    const reserved = Math.min(counters[2], counters[16]);
    const start = Math.min(counters[3], counters[2] - reserved);
    const count = Math.min(counters[16], counters[4], counters[2] - start);
    if (!count) return 0;
    const freeGenesOffset = geneOffset + g * 16;
    const freeGenes = new Uint32Array(
      await read(scratch, freeGenesOffset, count * 4),
    );
    let randomCount = 0,
      sampledCount = 0,
      mutations = 0,
      crossovers = 0;
    for (let r = 0; r < count; r++) {
      const child = sampleTreeArrival(treeArchive, {
        rng: treeRandom,
        archiveShare: cfg.share,
        crossoverRate: cfg.crossover,
        mutationRate: cfg.mutation,
        evolution: cfg,
      });
      const parent = child.parents.length ? byId.get(child.parents[0]) : null;
      const { record, buffer } = treeRecord(
        child.tree,
        counters[12] + r,
        parent,
        child.parents[1] ?? 0,
        child.mutated,
      );
      treeSlots[freeGenes[r]] = record;
      device.queue.writeBuffer(genomes, freeGenes[r] * GENOME_BYTES, buffer);
      if (child.source === "random") randomCount++;
      else sampledCount++;
      mutations += Number(child.mutated);
      crossovers += Number(child.crossed);
    }
    // No simulation work can interleave with this phase. Only the four host-
    // generated provenance totals are written; GPU lifecycle totals stay intact.
    device.queue.writeBuffer(
      scratch,
      counterOffset + 8 * 4,
      new Uint32Array([
        counters[8] + randomCount,
        counters[9] + sampledCount,
        counters[10] + mutations,
      ]),
    );
    device.queue.writeBuffer(
      scratch,
      counterOffset + 24 * 4,
      new Uint32Array([counters[24] + crossovers]),
    );
    return count;
  }
  // Mutating newborns wait for the next fixed 16-tick boundary. Only they
  // pause their VM; physics, energy and exact-copy siblings continue normally.
  async function readPackets(buffer, slots, stride) {
    const size = slots.length * stride;
    const output = device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    try {
      const encoder = device.createCommandEncoder();
      slots.forEach((slot, i) =>
        encoder.copyBufferToBuffer(
          buffer,
          slot * stride,
          output,
          i * stride,
          stride,
        ),
      );
      device.queue.submit([encoder.finish()]);
      await output.mapAsync(GPUMapMode.READ);
      return output.getMappedRange().slice(0);
    } finally {
      output.destroy();
    }
  }
  async function resolveBirthMutations() {
    const counters = new Uint32Array(await read(scratch, counterOffset, 128));
    const count = Math.min(n, counters[25]);
    if (!count) return;
    const requests = new Uint32Array(
      await read(scratch, birthMutationOffset, count * 16),
    );
    const slots = Array.from({ length: count }, (_, i) => requests[i * 4]);
    const destination = state[1 - parity];
    const [packets, statsBuffer] = await Promise.all([
      readPackets(destination, slots, CELL_BYTES),
      read(scratch, geneOffset, g * 16),
    ]);
    const words = new Uint32Array(packets),
      stats = new Uint32Array(statsBuffer),
      freeGenes = [];
    for (let i = 0; i < g; i++) if (stats[i * 4] === 0) freeGenes.push(i);
    const living = slots.flatMap((slot, i) => {
      const k = i * CELL_FLOATS;
      return words[k + 24] === requests[i * 4 + 1] &&
        words[k + 31] === 1 &&
        words[k + 27] === 0xffffffff
        ? [i]
        : [];
    });
    const parents = [...new Set(living.map((i) => requests[i * 4 + 2]))];
    const assembly = new Map();
    if (!cfg.treePrograms && parents.length) {
      const packed = await readPackets(genomes, parents, GENOME_BYTES);
      parents.forEach((slot, i) =>
        assembly.set(
          slot,
          packed.slice(i * GENOME_BYTES, (i + 1) * GENOME_BYTES),
        ),
      );
    }
    let allocated = 0;
    const changedStats = new Set();
    for (const i of living) {
      const slot = slots[i],
        parentSlot = requests[i * 4 + 2],
        birthTick = requests[i * 4 + 3];
      const cell = packets.slice(i * CELL_BYTES, (i + 1) * CELL_BYTES);
      const cu = new Uint32Array(cell),
        cf = new Float32Array(cell);
      cu[27] = 0;
      if (allocated < freeGenes.length && counters[12] < 0xffffffff) {
        const gene = freeGenes[allocated++],
          serial = counters[12]++;
        const rng = treeRng(
          cfg.seed ^ cu[24] ^ Math.imul(birthTick, 0x85ebca6b),
        );
        let buffer;
        if (cfg.treePrograms) {
          const parent = treeSlots[parentSlot];
          if (!parent) throw Error("Missing division source tree");
          const child = treeRecord(
            mutateTree(parent.tree, rng, cfg),
            serial,
            parent,
            0,
            true,
          );
          treeSlots[gene] = child.record;
          buffer = child.buffer;
          cf.fill(0, 8, 16);
          const previousMemory = new Float32Array(
            await read(scratch, treeMemoryOffset + slot * 48, 48),
          );
          const memory = new Float32Array(12);
          const overrides = previousMemory[10] >>> 0;
          for (let k = 0; k < 8; k++)
            if (overrides & (1 << k)) memory[k] = previousMemory[k];
          memory[8] = 1;
          memory[9] = overrides;
          device.queue.writeBuffer(
            scratch,
            treeMemoryOffset + slot * 48,
            memory,
          );
        } else {
          buffer = mutateAssemblyGenome(assembly.get(parentSlot), rng);
          const info = new Uint32Array(buffer);
          info.set([
            info[0],
            serial,
            info[2],
            info[3] + 1,
            info[1],
            tick,
            0,
            0,
          ]);
        }
        cu[25] = gene;
        cu[26] = 0;
        // Start this genotype's harvest accounting at assignment time.
        cf[50] = 0;
        stats[parentSlot * 4]--;
        stats.set([1, 0, 0, 0], gene * 4);
        changedStats.add(parentSlot);
        changedStats.add(gene);
        device.queue.writeBuffer(genomes, gene * GENOME_BYTES, buffer);
        counters[26]++;
      } else counters[27]++;
      device.queue.writeBuffer(destination, slot * CELL_BYTES, cell);
    }
    for (const gene of changedStats)
      device.queue.writeBuffer(
        scratch,
        geneOffset + gene * 16,
        stats.subarray(gene * 4, gene * 4 + 4),
      );
    device.queue.writeBuffer(
      scratch,
      counterOffset + 12 * 4,
      new Uint32Array([counters[12]]),
    );
    device.queue.writeBuffer(
      scratch,
      counterOffset + 25 * 4,
      new Uint32Array([0, counters[26], counters[27]]),
    );
  }
  async function admitBody({ programs, cells: seeds }) {
    if (!cfg.treePrograms) throw Error("Body arrivals require typed programs");
    if (
      !Array.isArray(seeds) ||
      !seeds.length ||
      seeds.length > 64 ||
      !Array.isArray(programs) ||
      !programs.length ||
      programs.length > seeds.length
    )
      throw Error("Expected 1–64 cells and their programs");
    const finite = (x) => Number.isFinite(x) && Number.isFinite(Math.fround(x));
    const integer = (x) => Number.isInteger(x) && x >= 1 && x <= 0xffffffff;
    const prepared = programs.map((p) => {
      const code = compileTree(p.tree, cfg),
        origin = p.origin,
        secondOrigin = p.secondOrigin;
      if (
        (secondOrigin && !origin) ||
        (p.mutated !== undefined && typeof p.mutated !== "boolean") ||
        (!origin && p.mutated)
      )
        throw Error("Invalid resampling provenance");
      for (const ancestor of [origin, secondOrigin].filter(Boolean)) {
        if (
          !integer(ancestor.serial) ||
          !integer(ancestor.founder) ||
          !Number.isInteger(ancestor.depth) ||
          ancestor.depth < 0 ||
          ancestor.depth >= 0xffffffff
        )
          throw Error("Invalid source ancestry");
        compileTree(ancestor.tree, cfg);
      }
      if (secondOrigin?.serial === origin?.serial && secondOrigin)
        throw Error("Crossover requires distinct parents");
      const mutated =
        p.mutated ??
        (!!origin &&
          formatTree(code.tree) !==
            formatTree(compileTree(origin.tree, cfg).tree));
      return { tree: code.tree, origin, secondOrigin, mutated };
    });
    const normalized = seeds.map((c) => {
      if (
        Object.keys(c).some(
          (k) =>
            ![
              "x",
              "y",
              "heading",
              "energy",
              "storage",
              "genome",
              "rest",
              "links",
              "anchors",
              "color",
            ].includes(k),
        )
      )
        throw Error("Body arrivals reset physiology and program state");
      const result = {
        x: c.x,
        y: c.y,
        heading: c.heading ?? 0,
        energy: c.energy ?? cfg.seedEnergy,
        storage: c.storage ?? cfg.seedStorage,
        genome: c.genome ?? 0,
        rest: c.rest ?? 1,
        links: c.links ?? [0, 0, 0, 0],
        anchors: c.anchors ?? [0, 0, 0, 0],
        color: c.color,
      };
      if (
        ![
          result.x,
          result.y,
          result.heading,
          result.energy,
          result.storage,
          result.rest,
        ].every(finite) ||
        result.energy < 1 / ENERGY_SCALE ||
        result.energy > cfg.energyCapacity ||
        result.storage < 0 ||
        result.storage > cfg.storageCapacity ||
        result.rest < 0.55 ||
        result.rest > 1.5 ||
        !Number.isInteger(result.genome) ||
        result.genome < 0 ||
        result.genome >= programs.length ||
        (result.color !== undefined && !finite(result.color)) ||
        !Array.isArray(result.links) ||
        result.links.length !== 4 ||
        !Array.isArray(result.anchors) ||
        result.anchors.length !== 4 ||
        !result.anchors.every(finite)
      )
        throw Error("Invalid body cell");
      return result;
    });
    if (new Set(normalized.map((c) => c.genome)).size !== programs.length)
      throw Error("Every body program must be used");
    normalized.forEach((c, i) => {
      const neighbors = c.links.filter(Boolean);
      if (
        new Set(neighbors).size !== neighbors.length ||
        c.links.some(
          (h) =>
            !Number.isInteger(h) || h < 0 || h > seeds.length || h === i + 1,
        ) ||
        neighbors.some((h) => !normalized[h - 1].links.includes(i + 1))
      )
        throw Error("Body links must be reciprocal local handles");
    });
    {
      const [stateData, counterData, geneData] = await Promise.all([
        read(state[parity]),
        read(scratch, counterOffset, 128),
        read(scratch, geneOffset, g * 16),
      ]);
      const oldWords = new Uint32Array(stateData),
        counters = new Uint32Array(counterData),
        stats = new Uint32Array(geneData);
      const freeCells = [],
        freeGenes = [];
      for (let i = 0; i < n; i++)
        if (oldWords[i * 52 + 31] === 0) freeCells.push(i);
      for (let i = 0; i < g; i++) if (stats[i * 4] === 0) freeGenes.push(i);
      if (freeCells.length < seeds.length || freeGenes.length < programs.length)
        return {
          admitted: 0,
          reason: "capacity",
          cellSlots: [],
          genomeSlots: [],
        };
      if (
        counters[11] + seeds.length > 0xffffffff ||
        counters[12] + programs.length > 0xffffffff
      )
        throw Error("Arrival identity capacity exceeded");
      const cellSlots = freeCells.slice(0, seeds.length),
        genomeSlots = freeGenes.slice(0, programs.length);
      const records = prepared.map((p, j) =>
        treeRecord(
          p.tree,
          counters[12] + j,
          p.origin
            ? {
                id: p.origin.serial,
                founder: p.origin.founder,
                depth: p.origin.depth,
              }
            : null,
          p.secondOrigin?.serial ?? 0,
          p.mutated,
        ),
      );
      const references = new Uint32Array(programs.length),
        packets = normalized.map((c, j) => {
          const data = new ArrayBuffer(CELL_BYTES),
            cf = new Float32Array(data),
            cu = new Uint32Array(data),
            program = c.genome;
          const wrap = (x, size) => ((x % size) + size) % size;
          cf.set([wrap(c.x, cfg.side * 32), wrap(c.y, cfg.side * 32), 0, 0], 0);
          cf.set(
            [Math.round(c.energy * ENERGY_SCALE), wrap(c.heading, 1), 0, 0],
            4,
          );
          cu.set([counters[11] + j, genomeSlots[program], 0, 0], 24);
          cu.set([0, 0, 0, 1], 28);
          cu.set(
            c.links.map((h) => (h ? cellSlots[h - 1] + 1 : 0)),
            32,
          );
          cf.set(
            [
              c.rest,
              0,
              Math.round(c.storage * ENERGY_SCALE),
              cfg.ambientTemperature,
            ],
            36,
          );
          cf.set(c.anchors, 44);
          let z = (records[program].record.founder + 0x9e3779b9) >>> 0;
          z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
          z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
          z = (z ^ (z >>> 15)) >>> 0;
          cf[48] =
            c.color === undefined
              ? Math.fround(((z >>> 8) / 16777216) * 360)
              : wrap(c.color, 360);
          references[program]++;
          if (prepared[program].origin) counters[9]++;
          else counters[8]++;
          return data;
        });
      counters[1] += seeds.length;
      counters[11] += seeds.length;
      counters[12] += programs.length;
      counters[10] += prepared.filter((p) => p.mutated).length;
      counters[24] += prepared.filter((p) => p.secondOrigin).length;
      counters[2] = freeCells.length - seeds.length;
      counters[4] = freeGenes.length - programs.length;
      // Validation and all allocation decisions precede the first mutation.
      records.forEach(({ record, buffer }, j) => {
        treeSlots[genomeSlots[j]] = record;
        device.queue.writeBuffer(
          genomes,
          genomeSlots[j] * GENOME_BYTES,
          buffer,
        );
        device.queue.writeBuffer(
          scratch,
          geneOffset + genomeSlots[j] * 16,
          new Uint32Array([references[j], 0, 0, 0]),
        );
      });
      packets.forEach((data, j) => {
        device.queue.writeBuffer(
          scratch,
          cpuRemainderOffset + cellSlots[j] * 4,
          new Float32Array(1),
        );
        device.queue.writeBuffer(
          scratch,
          childStateOffset + cellSlots[j] * 48,
          new Float32Array(12),
        );
        if (cfg.specializationStrength)
          device.queue.writeBuffer(
            scratch,
            specializationOffset + cellSlots[j] * 16,
            new Float32Array(4),
          );
        if (cfg.linkedRelay) {
          device.queue.writeBuffer(
            scratch,
            relayOffset + cellSlots[j] * 16,
            new Float32Array(4),
          );
          device.queue.writeBuffer(
            scratch,
            relayOffset + n * 16 + cellSlots[j] * 16,
            new Float32Array(4),
          );
        }
        device.queue.writeBuffer(
          state[parity],
          cellSlots[j] * CELL_BYTES,
          data,
        );
        device.queue.writeBuffer(
          scratch,
          treeMemoryOffset + cellSlots[j] * 48,
          new Uint32Array(12),
        );
        device.queue.writeBuffer(
          activity,
          cellSlots[j] * 32,
          new Uint32Array(8),
        );
      });
      device.queue.writeBuffer(scratch, counterOffset, counters);
      await device.queue.onSubmittedWorkDone();
      return {
        admitted: seeds.length,
        cellSlots,
        genomeSlots,
        serials: records.map((r) => r.record.id),
        mutations: prepared.filter((p) => p.mutated).length,
        crossovers: prepared.filter((p) => p.secondOrigin).length,
      };
    }
  }

  const bodySampler =
    cfg.treePrograms && cfg.bodyShare > 0 && !cfg.manualArrivals
      ? new BodyArchive({
          rng: treeRng(cfg.seed ^ 0x71234311),
          maxCells: cfg.bodyMaxCells,
          minimumAge: cfg.archiveAge,
        })
      : null;
  const bodyRandom = treeRng(cfg.seed ^ 0x84673a01);
  const bodyStats = { captured: 0, admitted: 0, bodyCells: 0 };
  async function admitAutomaticBodies() {
    const [buffer, geneData, counterData] = await Promise.all([
      read(state[parity]),
      read(scratch, geneOffset, g * 16),
      read(scratch, counterOffset, 128),
    ]);
    const words = new Uint32Array(buffer),
      stats = new Uint32Array(geneData),
      counters = new Uint32Array(counterData);
    if (tick % (cfg.bodyCaptureSeconds * 60) === 0)
      bodyStats.captured += await bodySampler.capture(api, buffer);
    let freeCells = 0,
      freeGenes = 0;
    for (let i = 0; i < n; i++) freeCells += Number(words[i * 52 + 31] === 0);
    for (let i = 0; i < g; i++) freeGenes += Number(stats[i * 4] === 0);
    // counter[16] includes the steady rate AND population-floor replenishment.
    let remaining = Math.min(counters[16], freeCells);
    while (remaining > 0 && freeGenes > 0) {
      const plan = bodySampler.plan(api, {
        budget: remaining,
        freeCells,
        freeGenes,
        connected: bodyRandom() < cfg.bodyPreserveLinks,
        rng: bodyRandom,
        bodyShare: cfg.bodyShare,
        archiveShare: cfg.share,
        mutation: cfg.mutation,
        crossover: cfg.crossover,
      });
      if (!plan.cells.length) break;
      const result = await admitBody(plan);
      if (!result.admitted) break;
      bodyStats.admitted += result.admitted;
      if (plan.source === "body")
        bodyStats.bodyCells += plan.provenance.sourceSlots.length;
      remaining -= result.admitted;
      freeCells -= result.admitted;
      freeGenes -= plan.programs.length;
    }
  }
  const api = {
    cfg,
    fingerprint,
    genomeSampler: cfg.treePrograms
      ? "typed-sequences-state-v2"
      : "assembly-v1",
    buffers: { state, scratch, genomes, archive, food, intents, activity },
    get tick() {
      return tick;
    },
    get currentState() {
      return state[parity];
    },
    async cellSpecialization(slot) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= n)
        throw Error("Invalid cell slot");
      if (!cfg.specializationStrength) return [0, 0, 0];
      return [
        ...new Float32Array(
          await read(scratch, specializationOffset + slot * 16, 16),
        ),
      ].slice(0, 3);
    },
    async admitBody(body) {
      if (hostOperation) throw Error("Engine operation already in progress");
      hostOperation = true;
      try {
        return await admitBody(body);
      } finally {
        hostOperation = false;
      }
    },
    bodyStats() {
      return { ...bodyStats, archived: bodySampler?.size ?? 0 };
    },
    async step(ticks = 1) {
      if (!Number.isInteger(ticks) || ticks < 0 || ticks > 600)
        throw Error("step accepts 0–600 ticks");
      if (hostOperation) throw Error("Engine operation already in progress");
      hostOperation = true;
      try {
        let encoder = device.createCommandEncoder();
        for (let k = 0; k < ticks; k++) {
          tick++;
          for (const name of stages) {
            if (name === "broadcast" && !cfg.linkedRelay) continue;
            if (cfg.treePrograms && name === "arrivals") continue;
            if (name === "weather" && tick !== 1 && tick % 30 !== 0) continue;
            if (
              ["geneScan", "archiveUpdate", "arrivals"].includes(name) &&
              tick % 60 !== 0
            )
              continue;
            let count = n;
            if (["field", "foodDebit"].includes(name)) count = t;
            else if (name === "clear") count = Math.max(n, t, 128);
            else if (name === "weather") count = cfg.sources;
            else if (name === "geneScan") count = g;
            else if (name === "archiveUpdate") count = 128;
            else if (name === "arrivals")
              count = Math.min(n, cfg.rate + Math.floor(n / 512) + 1);
            dispatch(encoder, name, count);
          }
          if (cfg.treePrograms && tick % 60 === 0) {
            device.queue.submit([encoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            const count = await prepareTreeArrivals();
            encoder = device.createCommandEncoder();
            dispatch(encoder, "arrivals", count);
          }
          if (cfg.forkMutation > 0 && tick % 16 === 0) {
            device.queue.submit([encoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            await resolveBirthMutations();
            encoder = device.createCommandEncoder();
          }
          parity = 1 - parity;
          if (bodySampler && tick % 60 === 0) {
            device.queue.submit([encoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            await admitAutomaticBodies();
            encoder = device.createCommandEncoder();
          }
        }
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
      } finally {
        hostOperation = false;
      }
    },
    armExecutionTrace(selected, seed) {
      if (!cfg.executionTrace) throw Error("Execution tracing was not enabled");
      if (!(selected instanceof Uint32Array) || selected.length !== 128)
        throw Error("Expected 32 trace selections");
      const begin = tick + 1,
        end = begin + 256;
      device.queue.writeBuffer(
        scratch,
        traceOffset,
        new Uint32Array([begin, end, seed >>> 0, 0]),
      );
      device.queue.writeBuffer(scratch, traceOffset + 16, selected);
      const encoder = device.createCommandEncoder();
      encoder.clearBuffer(scratch, traceOffset + 16 + 32 * 16, 8192 * 4);
      device.queue.submit([encoder.finish()]);
      return { begin, end, collectTick: end - 1 };
    },
    stopExecutionTrace() {
      if (cfg.executionTrace)
        device.queue.writeBuffer(scratch, traceOffset, new Uint32Array(4));
    },
    async executionTrace() {
      if (!cfg.executionTrace) throw Error("Execution tracing was not enabled");
      return read(scratch, traceOffset, traceBytes);
    },
    async previewTransfers() {
      if (tick !== 0 || cfg.initial !== 0)
        throw Error("Transfer preview is a single-use fixture diagnostic");
      tick = 1;
      const encoder = device.createCommandEncoder();
      for (const name of [
        "clear",
        "prepare",
        "vm",
        "giftPlan",
        "giftApply",
        "theftPlan",
        "theftApply",
      ])
        dispatch(encoder, name, name === "clear" ? Math.max(n, t, 128) : n);
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      return {
        intents: new Uint32Array(await read(intents)),
        giftDemands: new Uint32Array(
          await read(scratch, t * 4 + n * 8 + 128, n * 8),
        ),
      };
    },
    setImmigration({ rate = cfg.rate, floor = cfg.floor } = {}) {
      for (const [name, value] of Object.entries({ rate, floor }))
        if (!Number.isInteger(value) || value < 0 || value > cfg.capacity)
          throw Error(`Invalid ${name}`);
      cfg.rate = rate;
      cfg.floor = floor;
      u[3] = floor;
      f[4] = rate;
      device.queue.writeBuffer(uniform, 0, settings);
    },
    async counters() {
      const c = new Uint32Array(await read(scratch, counterOffset, 128));
      return {
        tick: c[0],
        living: c[1],
        corpses: c[13],
        kills: c[22],
        attacks: c[14],
        eaten: (c[15] + c[23] * 4294967296) / ENERGY_SCALE,
        moves: c[17],
        photosynthesis: (c[18] + c[19] * 4294967296) / ENERGY_SCALE,
        attackDamage: (c[20] + c[21] * 4294967296) / ENERGY_SCALE,
        free: c[2],
        birthAttempts: c[3],
        archive: c[5],
        births: c[6],
        deaths: c[7],
        randomArrivals: c[8],
        sampledArrivals: c[9],
        mutations: c[10],
        crossovers: c[24],
        divisionMutations: c[26],
        skippedDivisionMutations: c[27],
        raw: [...c],
      };
    },
    async cellMemory(slot) {
      if (!cfg.treePrograms) return null;
      if (!Number.isInteger(slot) || slot < 0 || slot >= n)
        throw Error("Invalid cell slot");
      return new Float32Array(
        await read(scratch, treeMemoryOffset + slot * 48, 32),
      );
    },
    async treeMemory() {
      if (!cfg.treePrograms) throw Error("Tree memory is disabled");
      return new Float32Array(await read(scratch, treeMemoryOffset, n * 48));
    },
    async state() {
      return read(state[parity]);
    },
    async genome(slot) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= g)
        throw Error("Invalid genome slot");
      const description = describeGenome(
        await read(genomes, slot * GENOME_BYTES, GENOME_BYTES),
      );
      if (!description || !cfg.treePrograms) return description;
      const record = treeSlots[slot];
      if (!record || record.id !== description.serial)
        throw Error("Missing tree genotype");
      return {
        ...description,
        tree: structuredClone(record.tree),
        nodes: checkTree(record.tree).count,
        bytecode: description.source,
        source: formatTree(record.tree),
        substrate: "tree",
      };
    },
    archivedGenomeSlots() {
      const ids = new Set(treeArchive.map((r) => r.id));
      return treeSlots.flatMap((r, slot) =>
        r && ids.has(r.id) ? [{ slot, id: r.id, founder: r.founder }] : [],
      );
    },
    archivedTrees() {
      return structuredClone(treeArchive);
    },
    async field() {
      return new Float32Array(await read(food, t * 8 * (tick % 2), t * 8));
    },
    async genes() {
      return {
        data: await read(genomes),
        stats: new Uint32Array(await read(scratch, geneOffset, g * 16)),
      };
    },
    async archived() {
      return read(archive);
    },
    async fixture({ programs, cells: seeds, sunlight = 0 }) {
      if (tick !== 0 || cfg.initial !== 0)
        throw Error("Fixtures require an empty engine before stepping");
      if (!cfg.treePrograms && programs.some((p) => typeof p !== "string"))
        throw Error("Tree fixtures require treePrograms: 1");
      if (programs.length > g) throw Error("Too many programs");
      const codeBuffer = new ArrayBuffer(g * GENOME_BYTES),
        cv = new DataView(codeBuffer),
        data = new ArrayBuffer(n * CELL_BYTES),
        cf = new Float32Array(data),
        cu = new Uint32Array(data),
        refs = new Uint32Array(g * 4),
        treeMemory = new Float32Array(n * 12);
      programs.forEach((source, j) => {
        const code =
            typeof source === "string"
              ? compile(source)
              : compileTree(source.tree, cfg),
          v = new DataView(code.buffer),
          base = j * GENOME_BYTES;
        if (typeof source !== "string") {
          treeSlots[j] = treeRecord(code.tree, j + 1).record;
        }
        cv.setUint32(base, code.length, true);
        cv.setUint32(base + 4, j + 1, true);
        cv.setUint32(base + 8, j + 1, true);
        for (let k = 0; k < code.length; k++) {
          cv.setFloat32(base + 32 + k * 16, v.getInt32(k * 16, true), true);
          for (let a = 1; a < 4; a++)
            cv.setFloat32(
              base + 32 + k * 16 + a * 4,
              v.getFloat32(k * 16 + a * 4, true),
              true,
            );
        }
      });
      const seen = new Set();
      seeds.forEach((c, index) => {
        const slot = c.slot ?? index;
        if (slot < 0 || slot >= n || seen.has(slot))
          throw Error("Invalid fixture slot");
        seen.add(slot);
        const k = slot * 52,
          genome = c.genome ?? 0;
        if (genome >= programs.length) throw Error("Missing fixture program");
        cf.set(
          [c.x ?? cfg.side * 16, c.y ?? cfg.side * 16, c.vx ?? 0, c.vy ?? 0],
          k,
        );
        cf.set(
          [
            Math.round((c.energy ?? 70) * ENERGY_SCALE),
            c.heading ?? 0,
            c.tag ?? 0,
            c.shield ?? 0,
          ],
          k + 4,
        );
        if (c.registers) cf.set(c.registers, k + 8);
        if (c.memory) {
          if (c.memory.length > 8) throw Error("Too much fixture memory");
          treeMemory.set(c.memory, slot * 12);
        }
        cu.set([slot + 1, genome, 0, c.sleep ?? 0], k + 24);
        cu.set([c.age ?? 0, c.generation ?? 0, 0, c.corpse ? 2 : 1], k + 28);
        cu.set(c.links ?? [0, 0, 0, 0], k + 32);
        cf.set(
          [
            c.rest ?? 1,
            sunlight,
            Math.round(
              (c.corpse ? (c.energy ?? 70) : (c.storage ?? 0)) * ENERGY_SCALE,
            ),
            c.temperature ?? cfg.ambientTemperature,
          ],
          k + 36,
        );
        cf.set(c.anchors ?? [0, 0, 0, 0], k + 44);
        cf.set([c.color ?? 0, 0, 0, 0], k + 48);
        if (!c.corpse) refs[genome * 4]++;
      });
      device.queue.writeBuffer(state[parity], 0, data);
      if (cfg.treePrograms)
        device.queue.writeBuffer(scratch, treeMemoryOffset, treeMemory);
      device.queue.writeBuffer(genomes, 0, codeBuffer);
      device.queue.writeBuffer(scratch, geneOffset, refs);
      const counters = new Uint32Array(32);
      counters[1] = seeds.filter((c) => !c.corpse).length;
      counters[13] = seeds.filter((c) => c.corpse).length;
      counters[8] = seeds.filter((c) => !c.corpse).length;
      counters[11] = n + 1;
      counters[12] = programs.length + 1;
      device.queue.writeBuffer(scratch, counterOffset, counters);
      const nutrients = new Float32Array(t * 4);
      for (let i = 0; i < t * 2; i++) nutrients.set([sunlight, 0], i * 2);
      device.queue.writeBuffer(food, 0, nutrients);
    },
    destroy() {
      for (const b of [
        ...state,
        scratch,
        genomes,
        archive,
        food,
        intents,
        uniform,
        activity,
      ])
        b.destroy();
    },
  };
  return api;
}
export function describeGenome(buffer, index = 0) {
  const view = new DataView(buffer),
    base = index * GENOME_BYTES,
    len = view.getUint32(base, true);
  if (!len) return null;
  const data = new ArrayBuffer(len * 16),
    out = new DataView(data);
  for (let k = 0; k < len; k++) {
    out.setInt32(k * 16, view.getFloat32(base + 32 + k * 16, true), true);
    for (let a = 1; a < 4; a++)
      out.setFloat32(
        k * 16 + a * 4,
        view.getFloat32(base + 32 + k * 16 + a * 4, true),
        true,
      );
  }
  return {
    length: len,
    serial: view.getUint32(base + 4, true),
    founder: view.getUint32(base + 8, true),
    depth: view.getUint32(base + 12, true),
    parent: view.getUint32(base + 16, true),
    bornTick: view.getUint32(base + 20, true),
    secondParent: view.getUint32(base + 28, true),
    score: view.getUint32(base + 24, true),
    source: decodeTreeBytecode(data),
  };
}
