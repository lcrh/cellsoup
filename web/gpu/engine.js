import { simulationShader } from "./shader.js";
import { compile, decode } from "./language.js";
export const CELL_FLOATS = 52,
  CELL_BYTES = 208,
  GENOME_BYTES = 1056,
  ENERGY_SCALE = 4096;
const stages = [
  "clear",
  "weather",
  "field",
  "prepare",
  "vm",
  "foodDebit",
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
  capacity: 131072,
  genomeCapacity: 32768,
  side: 256,
  sources: 32,
  initial: 32768,
  seed: 42,
  budget: 24,
  floor: 2048,
  rate: 32,
  share: 0.5,
  mutation: 0.8,
  foodRate: 1,
  seedEnergy: 24,
  upkeep: 0.5,
  divisionCost: 12,
  uptakeRate: 4,
  specialization: 2,
  exchange: 0.12,
  enzymeSpeed: 0.2,
  shieldUpkeep: 0.72,
  cpuCost: 0.0005,
  moveCost: 0.04,
  turnCost: 0.001,
  linkCost: 0.5,
  contractCost: 0.08,
  stealCost: 0.08,
  emitCost: 0.01,
  sendCost: 0.01,
  jitter: 12,
  foodMemory: 20,
  foodStrength: 4,
  corpseRecycle: 1,
  archiveAge: 60,
  archiveFood: 120,
  archiveOffspring: 8,
  archiveEnabled: 1,
};
export async function createLifeEngine(device, options = {}) {
  const cfg = { ...defaults, ...options };
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
    cfg.initial > Math.min(cfg.capacity, cfg.genomeCapacity) ||
    cfg.side < 5 ||
    cfg.sources < 1 ||
    cfg.seed > 4294967295 ||
    cfg.floor > cfg.capacity ||
    cfg.rate > cfg.capacity ||
    cfg.specialization <= 0 ||
    cfg.uptakeRate > 60 ||
    cfg.budget > 128 ||
    cfg.exchange > 0.25 ||
    cfg.mutation > 1 ||
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
  const scratch = storage(40 * n + 20 * t + 20 * g + 640),
    genomes = storage(g * GENOME_BYTES),
    archive = storage(128 * GENOME_BYTES),
    food = storage(t * 16 + cfg.sources * 32),
    intents = storage(n * 128);
  const uniform = device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const settings = new ArrayBuffer(128),
    u = new Uint32Array(settings),
    f = new Float32Array(settings);
  u.set([cfg.seed, cfg.budget, cfg.initial, cfg.floor]);
  f.set(
    [
      cfg.rate,
      cfg.share,
      cfg.mutation,
      cfg.foodRate,
      cfg.seedEnergy,
      cfg.upkeep,
      cfg.divisionCost,
      cfg.uptakeRate,
      cfg.specialization,
      cfg.exchange,
      cfg.enzymeSpeed,
      cfg.shieldUpkeep,
      cfg.cpuCost,
      cfg.moveCost,
      cfg.turnCost,
      cfg.linkCost,
      cfg.contractCost,
      cfg.stealCost,
      cfg.emitCost,
      cfg.sendCost,
      cfg.jitter,
      cfg.foodMemory,
      cfg.foodStrength,
      cfg.corpseRecycle,
      cfg.archiveAge,
      cfg.archiveFood,
      cfg.archiveOffspring,
      cfg.archiveEnabled,
    ],
    4,
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
    entries: Array.from({ length: 8 }, (_, binding) => ({
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
      ].map((buffer, binding) => ({ binding, resource: { buffer } })),
    }),
  );
  let parity = 0,
    tick = 0;
  function dispatch(encoder, name, count) {
    if (!count) return;
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipelines[name]);
    pass.setBindGroup(0, groups[parity]);
    pass.dispatchWorkgroups(Math.ceil(count / (name === "weather" ? 64 : 128)));
    pass.end();
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
  return {
    cfg,
    fingerprint,
    buffers: { state, scratch, genomes, archive, food, intents },
    get tick() {
      return tick;
    },
    get currentState() {
      return state[parity];
    },
    async step(ticks = 1) {
      if (!Number.isInteger(ticks) || ticks < 0 || ticks > 600)
        throw Error("step accepts 0–600 ticks");
      const encoder = device.createCommandEncoder();
      for (let k = 0; k < ticks; k++) {
        tick++;
        for (const name of stages) {
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
        parity = 1 - parity;
      }
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
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
    async counters() {
      const c = new Uint32Array(await read(scratch, counterOffset, 128));
      return {
        tick: c[0],
        living: c[1],
        free: c[2],
        birthAttempts: c[3],
        archive: c[5],
        births: c[6],
        deaths: c[7],
        randomArrivals: c[8],
        sampledArrivals: c[9],
        mutations: c[10],
        raw: [...c],
      };
    },
    async state() {
      return read(state[parity]);
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
    async fixture({ programs, cells: seeds, foodValue = [0, 0] }) {
      if (tick !== 0 || cfg.initial !== 0)
        throw Error("Fixtures require an empty engine before stepping");
      if (programs.length > g) throw Error("Too many programs");
      const codeBuffer = new ArrayBuffer(g * GENOME_BYTES),
        cv = new DataView(codeBuffer),
        data = new ArrayBuffer(n * CELL_BYTES),
        cf = new Float32Array(data),
        cu = new Uint32Array(data),
        refs = new Uint32Array(g * 4);
      programs.forEach((source, j) => {
        const code = compile(source),
          v = new DataView(code.buffer),
          base = j * GENOME_BYTES;
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
        cu.set([slot + 1, genome, 0, c.sleep ?? 0], k + 24);
        cu.set([c.age ?? 0, c.generation ?? 0, 0, 1], k + 28);
        cu.set(c.links ?? [0, 0, 0, 0], k + 32);
        cf.set([c.rest ?? 1, c.enzyme ?? 0.5, c.a ?? 0, c.b ?? 0], k + 36);
        cf.set(c.anchors ?? [0, 0, 0, 0], k + 44);
        cf.set([c.color ?? 0, c.enzyme ?? 0.5, 0, 0], k + 48);
        refs[genome * 4]++;
      });
      device.queue.writeBuffer(state[parity], 0, data);
      device.queue.writeBuffer(genomes, 0, codeBuffer);
      device.queue.writeBuffer(scratch, geneOffset, refs);
      const counters = new Uint32Array(32);
      counters[1] = seeds.length;
      counters[8] = seeds.length;
      counters[11] = n + 1;
      counters[12] = programs.length + 1;
      device.queue.writeBuffer(scratch, counterOffset, counters);
      const nutrients = new Float32Array(t * 4);
      for (let i = 0; i < t * 2; i++) nutrients.set(foodValue, i * 2);
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
      ])
        b.destroy();
    },
  };
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
    score: view.getUint32(base + 24, true),
    source: decode(data),
  };
}
