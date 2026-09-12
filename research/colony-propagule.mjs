import { wrapDelta } from "../web/gpu/observe.js";

// Preserve an observed fragment's link slots, relative geometry and headings.
// This is a fresh developmental assay, not a restart: velocity, age, generation,
// registers, memory, messages, thermal state, reserves and program phase reset.
export function colonyPropagule(
  observation,
  {
    bodyIndex = 0,
    rootSlot,
    maxCells = 16,
    totalEnergy = 96,
    x = 1024,
    y = 1024,
    rotation = 0,
    connected = true,
  } = {},
) {
  const body = observation.colonies?.[bodyIndex];
  if (!body?.cells?.length) throw Error("A whole observed colony is required");
  if (
    !Number.isInteger(maxCells) ||
    maxCells < 1 ||
    maxCells > 1024 ||
    !Number.isFinite(totalEnergy) ||
    totalEnergy <= 0
  )
    throw Error("Invalid propagule size or energy");
  if (
    ![x, y, rotation, observation.world].every(Number.isFinite) ||
    observation.world <= 0
  )
    throw Error("Invalid geometry");
  const cells = new Map(body.cells.map((c) => [c.slot, c]));
  if (cells.size !== body.cells.length)
    throw Error("Duplicate observed cell slot");
  for (const cell of cells.values()) {
    if (
      !Array.isArray(cell.linkSlots) ||
      cell.linkSlots.length !== 4 ||
      !Array.isArray(cell.anchors) ||
      cell.anchors.length !== 4
    )
      throw Error(
        "Positional linkSlots and anchors are required; condensed links are insufficient",
      );
    if (
      ![cell.x, cell.y, cell.heading, cell.rest, ...cell.anchors].every(
        Number.isFinite,
      )
    )
      throw Error("Invalid observed cell geometry");
    for (const neighbor of cell.linkSlots)
      if (
        neighbor !== null &&
        (!cells.has(neighbor) ||
          !cells.get(neighbor).linkSlots?.includes(cell.slot))
      )
        throw Error("Observed link is not reciprocal within the whole body");
  }
  const root = cells.get(rootSlot ?? body.cells[0].slot);
  if (!root) throw Error("Root is outside the observed colony");
  const selected = [root.slot],
    seen = new Set(selected),
    positions = new Map([[root.slot, [0, 0]]]);
  for (let i = 0; i < selected.length && selected.length < maxCells; i++) {
    for (const slot of cells.get(selected[i]).linkSlots) {
      if (slot === null || seen.has(slot)) continue;
      const parent = cells.get(selected[i]),
        child = cells.get(slot),
        [px, py] = positions.get(parent.slot);
      positions.set(slot, [
        px + wrapDelta(child.x - parent.x, observation.world),
        py + wrapDelta(child.y - parent.y, observation.world),
      ]);
      selected.push(slot);
      seen.add(slot);
      if (selected.length === maxCells) break;
    }
  }
  // A fragment that winds around the torus cannot be flattened into a fresh
  // local body without changing one of its springs. Refuse that geometry.
  for (const slot of selected) {
    const parent = cells.get(slot),
      [px, py] = positions.get(slot);
    for (const neighbor of parent.linkSlots)
      if (seen.has(neighbor)) {
        const child = cells.get(neighbor),
          [cx, cy] = positions.get(neighbor);
        if (
          Math.abs(cx - px - wrapDelta(child.x - parent.x, observation.world)) >
            1e-4 ||
          Math.abs(cy - py - wrapDelta(child.y - parent.y, observation.world)) >
            1e-4
        )
          throw Error(
            "Fragment winds around the periodic world; cannot preserve its geometry",
          );
      }
  }
  const energy = totalEnergy / selected.length;
  if (energy > 200) throw Error("Initial energy exceeds the per-cell capacity");
  const indices = new Map(selected.map((slot, i) => [slot, i])),
    programs = [],
    programIndex = new Map();
  const genomes = new Map((observation.genomes ?? []).map((g) => [g.slot, g]));
  // Rotate positions and headings together; local geometry is unchanged.
  const turn = rotation - root.heading,
    angle = turn * 2 * Math.PI,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const seeds = selected.map((slot) => {
    const c = cells.get(slot),
      [dx, dy] = positions.get(slot);
    if (!programIndex.has(c.genomeSlot)) {
      const genome = genomes.get(c.genomeSlot);
      if (!genome?.tree)
        throw Error("Every selected cell needs its observed typed genome");
      programIndex.set(c.genomeSlot, programs.length);
      programs.push({ tree: structuredClone(genome.tree) });
    }
    return {
      x: x + dx * cos - dy * sin,
      y: y + dx * sin + dy * cos,
      heading: (((c.heading + turn) % 1) + 1) % 1,
      energy,
      storage: 0,
      genome: programIndex.get(c.genomeSlot),
      rest: c.rest,
      links: c.linkSlots.map((neighbor) =>
        connected && indices.has(neighbor) ? indices.get(neighbor) + 1 : 0,
      ),
      anchors: [...c.anchors],
    };
  });
  return {
    programs,
    cells: seeds,
    provenance: {
      sourceSeconds: observation.seconds,
      sourceSlots: selected,
      sourceGenomeSlots: [...programIndex.keys()],
      connected,
      totalEnergy,
      scope:
        "Observed links, spring anchors, rest factors, relative positions and headings; all cells restart their programs with fresh memory and physiology. This is not an exact restart or complete epigenetic inheritance.",
    },
  };
}
