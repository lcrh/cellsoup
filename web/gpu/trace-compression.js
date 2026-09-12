// Gzip comparisons on actual instruction paths. Buffer padding and identities
// are excluded from both streams; shuffling preserves each cell's event histogram.
export async function gzip(bytes) {
  return new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
}
export function traceBytes(trace, { shuffle = false, seed = 731 } = {}) {
  if (trace.version !== "execution-path-v1")
    throw Error("Unsupported trace version");
  const chunks = [];
  let size = 0,
    randomState = seed >>> 0;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  for (const cell of trace.cells) {
    if (cell.frames.length !== 256) throw Error("Expected 256 tick frames");
    const counts = cell.frames.map((f) => f.length);
    if (counts.some((c) => c > 128)) throw Error("Too many trace events");
    const events = Uint32Array.from(cell.frames.flatMap((f) => Array.from(f)));
    if (shuffle)
      for (let i = events.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [events[i], events[j]] = [events[j], events[i]];
      }
    const bytes = new Uint8Array(256 + events.length * 4),
      view = new DataView(bytes.buffer);
    let at = 0,
      event = 0;
    for (const count of counts) {
      bytes[at++] = count;
      for (let i = 0; i < count; i++) {
        view.setUint32(at, events[event++], true);
        at += 4;
      }
    }
    chunks.push(bytes);
    size += bytes.length;
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return bytes;
}
export async function measureTraceCompression(trace) {
  const raw = traceBytes(trace),
    shuffled = traceBytes(trace, { shuffle: true });
  const [compressed, control] = await Promise.all([gzip(raw), gzip(shuffled)]);
  let attempts = 0,
    executed = 0,
    activeCells = 0;
  for (const c of trace.cells) {
    let active = false;
    for (const f of c.frames)
      for (const event of f) {
        attempts++;
        if (event & 0x1000000) {
          executed++;
          active = true;
        }
      }
    activeCells += Number(active);
  }
  return {
    version: "gzip-execution-path-v1",
    sampledCells: trace.cells.length,
    activeCells,
    attempts,
    executed,
    rawBytes: raw.length,
    gzipBytes: compressed.length,
    shuffledGzipBytes: control.length,
    bitsPerRawByte: raw.length ? (8 * compressed.length) / raw.length : null,
    orderSavings: executed
      ? (control.length - compressed.length) / control.length
      : null,
    scope:
      "Compressibility of sampled instruction paths, not epiplexity or intelligence. Simple loops also compress well. Register values, physics and absolute cell/genome identities are excluded. Per-tick attempt counts are kept in both streams; only event order within each cell is shuffled.",
  };
}

export function summarizeExecutionStructure(trace, programs) {
  const bySlot = new Map(programs.map((p) => [p.slot, p])),
    rows = [];
  function treeDepth(t) {
    return 1 + Math.max(0, ...t.args.map(treeDepth));
  }
  for (const cell of trace.cells) {
    const p = bySlot.get(cell.genomeSlot);
    if (!p) throw Error("Missing sampled program");
    const visited = new Set(),
      branches = new Map();
    for (const frame of cell.frames)
      for (const word of frame) {
        if (!(word & 0x1000000)) continue;
        const op = word & 255,
          pc = (word >>> 8) & 255,
          next = (word >>> 16) & 255;
        visited.add(pc);
        if (op >= 9 && op <= 13) {
          if (!branches.has(pc)) branches.set(pc, new Set());
          branches.get(pc).add(next);
        }
      }
    rows.push({
      slot: cell.slot,
      identity: cell.identity,
      serial: p.serial,
      mutationDepth: p.depth,
      treeDepth: p.tree ? treeDepth(p.tree) : null,
      programLength: p.length,
      visitedInstructions: visited.size,
      coverage: visited.size / p.length,
      variableBranches: [...branches.values()].filter((x) => x.size > 1).length,
    });
  }
  const avg = (key) =>
    rows.length ? rows.reduce((n, r) => n + r[key], 0) / rows.length : null;
  return {
    cells: rows,
    meanMutationDepth: avg("mutationDepth"),
    meanTreeDepth:
      rows.length && rows.every((r) => r.treeDepth !== null)
        ? avg("treeDepth")
        : null,
    meanInstructionCoverage: avg("coverage"),
    variableBranches: rows.reduce((n, r) => n + r.variableBranches, 0),
    scope:
      "Sampled-cell averages, not a whole-population census. Mutation depth counts archive mutation ancestry, not accumulated adaptation; tree depth includes unexecuted code. A variable branch took different next-PC paths in this window; this does not identify the cause or establish useful sensing.",
  };
}
