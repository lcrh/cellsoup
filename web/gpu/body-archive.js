// Bounded structural archive. Qualification comes from the existing ecological
// genotype archive; no authored program or score for motion/complexity is added.
import { colonyPropagule } from "./colony-propagule.js";
import { mutateTree, crossoverTrees, sampleTreeArrival } from "./trees.js";
export const originOf = (g) => ({
  serial: g.serial ?? g.id,
  founder: g.founder,
  depth: g.depth,
  tree: structuredClone(g.tree),
});
export function resampleBodyProgram(
  first,
  donors,
  { rng, mutation = 0.8, crossover = 0.25, evolution = {} },
) {
  let tree = structuredClone(first.tree),
    secondOrigin;
  const candidates = donors.filter(
    (g) => (g.serial ?? g.id) !== (first.serial ?? first.id),
  );
  if (candidates.length && rng() < crossover) {
    const second = candidates[Math.floor(rng() * candidates.length)],
      child = crossoverTrees(tree, second.tree, rng);
    tree = child.tree;
    if (child.crossed) secondOrigin = originOf(second);
  }
  const mutated = rng() < mutation;
  if (mutated) tree = mutateTree(tree, rng, evolution);
  return {
    tree,
    origin: originOf(first),
    ...(secondOrigin ? { secondOrigin } : {}),
    mutated,
  };
}
export function fragmentObservation(buffer, world, root, maxCells, genomes) {
  if (
    !(buffer instanceof ArrayBuffer) ||
    buffer.byteLength % (52 * 4) !== 0 ||
    !Number.isFinite(world) ||
    world <= 0 ||
    !Number.isInteger(maxCells) ||
    maxCells < 1 ||
    maxCells > 64
  )
    throw Error("Invalid fragment buffer or geometry");
  const f = new Float32Array(buffer),
    u = new Uint32Array(buffer),
    n = u.length / 52;
  if (
    !Number.isInteger(root) ||
    root < 0 ||
    root >= n ||
    u[root * 52 + 31] !== 1
  )
    throw Error("Invalid live fragment root");
  // GPU topology can be in the process of losing an edge. Archive only the
  // reciprocal, unique, non-self graph; preserve the first valid positional
  // slot and never change the live snapshot while cleaning an observed copy.
  const linksFor = (slot) => {
    const used = new Set();
    return Array.from(u.subarray(slot * 52 + 32, slot * 52 + 36), (handle) => {
      const neighbor = handle - 1;
      if (
        neighbor < 0 ||
        neighbor >= n ||
        neighbor === slot ||
        used.has(neighbor) ||
        u[neighbor * 52 + 31] !== 1 ||
        !u.subarray(neighbor * 52 + 32, neighbor * 52 + 36).includes(slot + 1)
      )
        return null;
      used.add(neighbor);
      return neighbor;
    });
  };
  const selected = [root],
    seen = new Set(selected);
  for (let q = 0; q < selected.length && selected.length < maxCells; q++) {
    for (const neighbor of linksFor(selected[q])) {
      if (neighbor === null || seen.has(neighbor)) continue;
      seen.add(neighbor);
      selected.push(neighbor);
      if (selected.length === maxCells) break;
    }
  }
  const cells = selected.map((slot) => {
    const k = slot * 52;
    const linkSlots = linksFor(slot).map((neighbor) =>
      seen.has(neighbor) ? neighbor : null,
    );
    return {
      slot,
      genomeSlot: u[k + 25],
      x: f[k],
      y: f[k + 1],
      heading: f[k + 5],
      rest: f[k + 36],
      anchors: linkSlots.map((neighbor, edge) =>
        neighbor === null ? 0 : f[k + 44 + edge],
      ),
      linkSlots,
    };
  });
  return { world, colonies: [{ cells, size: cells.length }], genomes };
}
export class BodyArchive {
  constructor({
    rng,
    capacity = 128,
    maxCells = 8,
    captureBudget = 4,
    minimumAge = 60,
    onCapture = () => {},
  }) {
    if (
      typeof rng !== "function" ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 128 ||
      !Number.isInteger(maxCells) ||
      maxCells < 2 ||
      maxCells > 64 ||
      !Number.isInteger(captureBudget) ||
      captureBudget < 1 ||
      captureBudget > 64 ||
      !Number.isFinite(minimumAge) ||
      minimumAge < 0
    )
      throw Error("Invalid structural archive configuration");
    Object.assign(this, {
      rng,
      capacity,
      maxCells,
      captureBudget,
      minimumAge,
      onCapture,
    });
    this.entries = new Map();
    this.serial = 0;
  }
  get size() {
    return this.entries.size;
  }
  snapshot() {
    return structuredClone([...this.entries.values()]);
  }
  async capture(engine, buffer) {
    const u = new Uint32Array(buffer),
      eligible = new Map(engine.archivedGenomeSlots().map((g) => [g.slot, g])),
      roots = [];
    for (let i = 0; i < u.length / 52; i++)
      if (
        u[i * 52 + 31] === 1 &&
        u[i * 52 + 28] >= this.minimumAge * 60 &&
        eligible.has(u[i * 52 + 25]) &&
        u.slice(i * 52 + 32, i * 52 + 36).some((h) => h !== 0)
      )
        roots.push(i);
    const chosen = new Set();
    let captured = 0;
    for (let k = 0; k < this.captureBudget && roots.length; k++) {
      const index = Math.floor(this.rng() * roots.length),
        root = roots[index];
      roots[index] = roots.at(-1);
      roots.pop();
      const lineage = eligible.get(u[root * 52 + 25]).founder;
      if (chosen.has(lineage)) continue;
      chosen.add(lineage);
      const observation = fragmentObservation(
        buffer,
        engine.cfg.side * 32,
        root,
        this.maxCells,
        [],
      );
      if (observation.colonies[0].cells.length < 2) continue;
      const slots = [
        ...new Set(observation.colonies[0].cells.map((c) => c.genomeSlot)),
      ];
      observation.genomes = await Promise.all(
        slots.map(async (slot) => ({ slot, ...(await engine.genome(slot)) })),
      );
      let body;
      try {
        body = colonyPropagule(observation, {
          energyCapacity: engine.cfg.energyCapacity,
          rootSlot: root,
          maxCells: this.maxCells,
          totalEnergy:
            observation.colonies[0].cells.length * engine.cfg.seedEnergy,
        });
      } catch (error) {
        if (/winds around/.test(error.message)) continue;
        throw error;
      }
      const entry = {
        id: ++this.serial,
        lineage,
        tick: engine.tick,
        root,
        observation,
        size: body.cells.length,
      };
      if (!this.entries.has(lineage) && this.entries.size === this.capacity) {
        const keys = [...this.entries.keys()];
        this.entries.delete(keys[Math.floor(this.rng() * keys.length)]);
      }
      this.entries.set(lineage, entry);
      await this.onCapture(structuredClone(entry));
      captured++;
    }
    return captured;
  }
  plan(
    engine,
    {
      budget,
      freeCells,
      freeGenes,
      connected = true,
      rng,
      bodyShare = 0.5,
      archiveShare = 0.5,
      mutation = 0.8,
      crossover = 0.25,
    },
  ) {
    for (const p of [bodyShare, archiveShare, mutation, crossover])
      if (!Number.isFinite(p) || p < 0 || p > 1)
        throw Error("Invalid resampling probability");
    if (
      ![budget, freeCells, freeGenes].every(
        (v) => Number.isInteger(v) && v >= 0,
      ) ||
      typeof rng !== "function"
    )
      throw Error("Invalid arrival budget");
    const count = Math.min(budget, freeCells, 64),
      donors = engine.archivedTrees(),
      byId = new Map(donors.map((g) => [g.id, g]));
    if (!count || !freeGenes)
      return { programs: [], cells: [], source: "capacity" };
    const choices = [...this.entries.values()].filter(
      (e) => e.size <= count && e.observation.genomes.length <= freeGenes,
    );
    if (choices.length && rng() < bodyShare) {
      const entry = choices[Math.floor(rng() * choices.length)];
      // Draw geometry and genetic edits identically for connected and unlinked
      // plans. Removing links is the final operation and consumes no randomness.
      const body = colonyPropagule(entry.observation, {
        energyCapacity: engine.cfg.energyCapacity,
        rootSlot: entry.root,
        maxCells: this.maxCells,
        totalEnergy: entry.size * engine.cfg.seedEnergy,
        x: rng() * engine.cfg.side * 32,
        y: rng() * engine.cfg.side * 32,
        rotation: rng(),
      });
      const origins = new Map(
        entry.observation.genomes.map((g) => [g.slot, g]),
      );
      const programs = body.provenance.sourceGenomeSlots.map((slot) =>
        resampleBodyProgram(origins.get(slot), donors, {
          rng,
          mutation,
          crossover,
          evolution: engine.cfg,
        }),
      );
      const cells = body.cells.map((c) => ({
        ...c,
        storage: engine.cfg.seedStorage,
        links: connected ? c.links : [0, 0, 0, 0],
      }));
      // Fill the rest of this second's cell budget with independent arrivals.
      return this.fill(
        engine,
        {
          programs,
          cells,
          source: "body",
          archiveId: entry.id,
          provenance: { ...body.provenance, connected },
        },
        Math.min(count, entry.size + freeGenes - programs.length),
        byId,
        { rng, archiveShare, mutation, crossover },
      );
    }
    return this.fill(
      engine,
      { programs: [], cells: [], source: "individual" },
      Math.min(count, freeGenes),
      byId,
      { rng, archiveShare, mutation, crossover },
    );
  }
  fill(engine, plan, count, byId, { rng, archiveShare, mutation, crossover }) {
    const archive = [...byId.values()];
    while (plan.cells.length < count) {
      const child = sampleTreeArrival(archive, {
        rng,
        archiveShare,
        mutationRate: mutation,
        crossoverRate: crossover,
        evolution: engine.cfg,
      });
      const program = { tree: child.tree, mutated: child.mutated };
      if (child.parents.length)
        program.origin = originOf(byId.get(child.parents[0]));
      if (child.parents[1])
        program.secondOrigin = originOf(byId.get(child.parents[1]));
      plan.cells.push({
        x: rng() * engine.cfg.side * 32,
        y: rng() * engine.cfg.side * 32,
        heading: rng(),
        energy: engine.cfg.seedEnergy,
        storage: engine.cfg.seedStorage,
        genome: plan.programs.length,
      });
      plan.programs.push(program);
    }
    return plan;
  }
}
