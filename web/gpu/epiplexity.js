// Finite-observer two-part MDL estimate, not a universal epiplexity oracle.
// See docs/behavioral-epiplexity.md for the code, budget and conditioning data.
export const OBSERVER_VERSION = "behavior-mdl-v1";
export const ALPHABET = 16,
  CHANNELS = 6,
  WINDOW = 32,
  SAMPLE_TICKS = 120;
const Q = 4096,
  HEADER = 4;
const log = Math.log2;
const uniform = () => ({ kind: "uniform", bits: 2, p: Array(16).fill(1 / 16) });
function peak(symbol, q) {
  q = Math.max(1, Math.min(Q - 1, q));
  return {
    kind: "peak",
    symbol,
    q,
    bits: 18,
    p: Array.from({ length: 16 }, (_, i) =>
      i === symbol ? q / Q : (1 - q / Q) / 15,
    ),
  };
}
const loss = (counts, p) =>
  counts.reduce((sum, n, i) => sum - (n ? n * log(p[i]) : 0), 0);
function fitRow(counts, scale) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return uniform();
  let symbol = 0;
  for (let i = 1; i < 16; i++) if (counts[i] > counts[symbol]) symbol = i;
  const candidates = [
    uniform(),
    peak(symbol, Math.round((Q * counts[symbol]) / total)),
  ];
  const raw = counts.map((n) => (n / total) * (Q - 16)),
    q = raw.map((n) => 1 + Math.floor(n));
  let left = Q - q.reduce((a, b) => a + b, 0);
  const order = raw
    .map((n, i) => [n - Math.floor(n), i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let i = 0; i < left; i++) q[order[i][1]]++;
  candidates.push({ kind: "dense", q, bits: 182, p: q.map((n) => n / Q) });
  return candidates.reduce((best, r) =>
    r.bits + scale * loss(counts, r.p) <
    best.bits + scale * loss(counts, best.p)
      ? r
      : best,
  );
}
const specs = [
  { id: "uniform", label: "Uniform noise" },
  { id: "zero", label: "Empty / constant zero" },
  { id: "marginal", label: "Channel averages" },
  { id: "copy1", label: "Persistence", lag: 1 },
  { id: "copy4", label: "Eight-second recurrence", lag: 4 },
  { id: "shift1", label: "Simple cyclic change", lag: 1 },
  { id: "previous1", label: "Local transitions", lag: 1, contexts: 16 },
  { id: "previous4", label: "Longer local transitions", lag: 4, contexts: 16 },
  { id: "left", label: "Spatial relationships", contexts: 17 },
  { id: "joint", label: "Space and time", contexts: 16 * 17 },
  { id: "neighbors", label: "Neighbor dynamics", contexts: 256 },
];
function context(spec, frames, t, tile, ch, width, channels) {
  const i = tile * channels + ch,
    prev = frames[t - 1][i];
  if (spec.id.startsWith("previous")) return frames[t - spec.lag][i];
  const x = tile % width;
  if (spec.id === "neighbors")
    return (
      prev * 16 +
      frames[t - 1][(tile - x + ((x + width - 1) % width)) * channels + ch]
    );
  const left = x ? frames[t][i - channels] : 16;
  return spec.id === "joint" ? prev * 17 + left : left;
}
function train(spec, frames, width, channels) {
  const trainEnd = 16,
    scale = 8 / (trainEnd - 4),
    size = frames[0].length;
  if (["uniform", "zero"].includes(spec.id)) return { ...spec, bits: HEADER };
  const counts = Array.from({ length: channels }, () => Array(16).fill(0)),
    rows = new Map();
  const matches = Array(channels).fill(0),
    totals = Array(channels).fill(0);
  for (let t = 4; t < trainEnd; t++)
    for (let i = 0; i < size; i++) {
      const ch = i % channels,
        y = frames[t][i];
      totals[ch]++;
      if (spec.id.startsWith("copy") || spec.id === "shift1") {
        const delta = (y - frames[t - spec.lag][i] + 16) % 16;
        counts[ch][delta]++;
        if (!delta) matches[ch]++;
      } else {
        counts[ch][y]++;
        if (spec.contexts) {
          const key =
            ch * spec.contexts +
            context(
              spec,
              frames,
              t,
              Math.floor(i / channels),
              ch,
              width,
              channels,
            );
          if (!rows.has(key)) rows.set(key, Array(16).fill(0));
          rows.get(key)[y]++;
        }
      }
    }
  if (spec.id.startsWith("copy") || spec.id === "shift1") {
    const shifts = counts.map((c) =>
      spec.id === "shift1" ? c.indexOf(Math.max(...c)) : 0,
    );
    const q = counts.map((c, ch) =>
      Math.max(
        1,
        Math.min(Q - 1, Math.round((Q * c[shifts[ch]]) / totals[ch])),
      ),
    );
    return {
      ...spec,
      bits: HEADER + channels * (12 + (spec.id === "shift1" ? 4 : 0)),
      shifts,
      q,
    };
  }
  const base = counts.map((c) => fitRow(c, scale));
  let bits = HEADER + base.reduce((a, r) => a + r.bits, 0);
  const overrides = new Map();
  if (spec.contexts) {
    const keyBits = Math.ceil(log(channels * spec.contexts));
    bits += Math.ceil(log(channels * spec.contexts + 1));
    for (const [key, c] of rows) {
      const row = fitRow(c, scale),
        fallback = base[Math.floor(key / spec.contexts)];
      if (
        row.bits + keyBits + scale * loss(c, row.p) <
        scale * loss(c, fallback.p)
      ) {
        overrides.set(key, row);
        bits += keyBits + row.bits;
      }
    }
  }
  return { ...spec, bits, base, overrides };
}
function score(model, frames, start, end, width, channels) {
  let bits = 0;
  const size = frames[0].length;
  for (let t = start; t < end; t++)
    for (let i = 0; i < size; i++) {
      const y = frames[t][i],
        ch = i % channels;
      let p;
      if (model.id === "uniform") p = 1 / 16;
      else if (model.id === "zero") p = y === 0 ? 1 : 0;
      else if (model.q) {
        const predicted = (frames[t - model.lag][i] + model.shifts[ch]) % 16;
        p = y === predicted ? model.q[ch] / Q : (1 - model.q[ch] / Q) / 15;
      } else {
        const key = model.contexts
          ? ch * model.contexts +
            context(
              model,
              frames,
              t,
              Math.floor(i / channels),
              ch,
              width,
              channels,
            )
          : null;
        p = (model.overrides.get(key) ?? model.base[ch]).p[y];
      }
      if (!p) return Infinity;
      bits -= log(p);
    }
  return bits;
}
function summarize(model, validationBits, testBits, tokens) {
  return {
    id: model.id,
    label: model.label,
    modelBits: model.bits,
    validationBits,
    testBits,
    validationTotalBits: model.bits + validationBits,
    testBitsPerToken: testBits / tokens,
    rows: model.overrides?.size ?? 0,
  };
}
export function estimateBehavior(
  frames,
  { width = 32, channels = CHANNELS } = {},
) {
  if (
    frames.length !== WINDOW ||
    !Number.isInteger(width) ||
    width < 2 ||
    width > 32 ||
    !Number.isInteger(channels) ||
    channels < 1 ||
    channels > CHANNELS
  )
    throw Error("Expected a fixed 32-frame behavior window");
  const size = width * width * channels;
  for (const frame of frames) {
    if (frame.length !== size) throw Error("Behavior frame dimensions differ");
    for (const y of frame)
      if (!Number.isInteger(y) || y < 0 || y >= 16)
        throw Error("Behavior symbol outside alphabet");
  }
  const tokens = 8 * size,
    models = specs.map((s) => train(s, frames, width, channels));
  const candidates = models.map((m) =>
    summarize(
      m,
      score(m, frames, 16, 24, width, channels),
      score(m, frames, 24, 32, width, channels),
      tokens,
    ),
  );
  let selected = 0;
  for (let i = 1; i < candidates.length; i++)
    if (
      candidates[i].validationTotalBits <
      candidates[selected].validationTotalBits
    )
      selected = i;
  const winner = candidates[selected],
    baseline = candidates.find((c) => c.id === "marginal");
  const model = models[selected];
  const serializeRow = ({ p, ...row }) => row;
  return {
    version: OBSERVER_VERSION,
    width,
    channels,
    frames: WINDOW,
    sampleTicks: SAMPLE_TICKS,
    trainingFrames: 12,
    selectionFrames: 8,
    testFrames: 8,
    conditioningFrames: 4,
    testTokens: tokens,
    epiplexityBits: winner.modelBits,
    unpredictedBitsPerToken: winner.testBitsPerToken,
    heldOutGainBits: baseline.testBits - winner.testBits,
    selected: winner,
    candidates,
    model: {
      id: model.id,
      bits: model.bits,
      base: model.base?.map(serializeRow),
      overrides: model.overrides
        ? [...model.overrides].map(([k, r]) => [k, serializeRow(r)])
        : undefined,
      shifts: model.shifts,
      q: model.q,
    },
    budget: {
      candidateModels: specs.length,
      maxContextRows: channels * 16 * 17,
      probabilityDenominator: Q,
      maxTrainingSymbols: 12 * size,
    },
  };
}
export function shuffleBehavior(
  frames,
  channels = CHANNELS,
  seed = 0x6d2b79f5,
) {
  const result = frames.map((f) => Uint8Array.from(f));
  let state = seed >>> 0;
  const rng = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const sites = result[0].length / channels,
    total = sites * result.length;
  for (let ch = 0; ch < channels; ch++)
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)),
        a = Math.floor(i / sites),
        ai = (i % sites) * channels + ch,
        b = Math.floor(j / sites),
        bi = (j % sites) * channels + ch;
      [result[a][ai], result[b][bi]] = [result[b][bi], result[a][ai]];
    }
  return result;
}

// Actual prefix code for learned model parameters. The shared decoder, channel
// count, alphabet, grid and initial four frames are observer-side information.
export function encodeBehaviorModel(model, channels = CHANNELS) {
  const stream = [];
  function put(n, bits) {
    if (!Number.isInteger(n) || n < 0 || n >= 2 ** bits)
      throw Error("Invalid model code");
    for (let k = bits - 1; k >= 0; k--) stream.push((n >>> k) & 1);
  }
  function row(r) {
    if (r.kind === "uniform") put(0, 2);
    else if (r.kind === "peak") {
      put(1, 2);
      put(r.symbol, 4);
      put(r.q, 12);
    } else if (r.kind === "dense") {
      put(2, 2);
      for (let i = 0; i < 15; i++) put(r.q[i], 12);
    } else throw Error("Unknown probability row");
  }
  const index = specs.findIndex((s) => s.id === model.id);
  if (index < 0) throw Error("Unknown observer");
  put(index, HEADER);
  const spec = specs[index];
  if (model.q) {
    for (let ch = 0; ch < channels; ch++) {
      if (spec.id === "shift1") put(model.shifts[ch], 4);
      put(model.q[ch], 12);
    }
  } else if (!["zero", "uniform"].includes(spec.id)) {
    if (model.base?.length !== channels) throw Error("Model channels differ");
    for (const r of model.base) row(r);
    if (spec.contexts) {
      const max = channels * spec.contexts,
        keyBits = Math.ceil(log(max));
      put(model.overrides.length, Math.ceil(log(max + 1)));
      for (const [key, r] of model.overrides) {
        put(key, keyBits);
        row(r);
      }
    }
  }
  const bytes = new Uint8Array(Math.ceil(stream.length / 8));
  stream.forEach((b, i) => (bytes[Math.floor(i / 8)] |= b << (7 - (i % 8))));
  return { bitLength: stream.length, bytes };
}
export function decodeBehaviorModel({ bitLength, bytes }, channels = CHANNELS) {
  let pos = 0;
  const take = (bits) => {
    if (pos + bits > bitLength) throw Error("Truncated model");
    let n = 0;
    for (let i = 0; i < bits; i++, pos++)
      n = n * 2 + ((bytes[Math.floor(pos / 8)] >>> (7 - (pos % 8))) & 1);
    return n;
  };
  function row() {
    const kind = take(2);
    if (kind === 0) return { kind: "uniform", bits: 2 };
    if (kind === 1) {
      const symbol = take(4),
        q = take(12);
      if (q < 1 || q >= Q) throw Error("Invalid peak");
      return { kind: "peak", symbol, q, bits: 18 };
    }
    if (kind === 2) {
      const q = Array.from({ length: 15 }, () => take(12));
      q.push(Q - q.reduce((a, b) => a + b, 0));
      if (q.some((n) => n < 1)) throw Error("Invalid dense row");
      return { kind: "dense", q, bits: 182 };
    }
    throw Error("Invalid row code");
  }
  const spec = specs[take(HEADER)];
  if (!spec) throw Error("Unknown observer");
  const model = {
    id: spec.id,
    bits: bitLength,
    base: undefined,
    overrides: undefined,
    shifts: undefined,
    q: undefined,
  };
  if (spec.id.startsWith("copy") || spec.id === "shift1") {
    model.q = [];
    model.shifts = [];
    for (let ch = 0; ch < channels; ch++) {
      model.shifts.push(spec.id === "shift1" ? take(4) : 0);
      const q = take(12);
      if (q < 1 || q >= Q) throw Error("Invalid prediction");
      model.q.push(q);
    }
  } else if (!["zero", "uniform"].includes(spec.id)) {
    model.base = Array.from({ length: channels }, row);
    model.overrides = [];
    if (spec.contexts) {
      const max = channels * spec.contexts,
        n = take(Math.ceil(log(max + 1))),
        seen = new Set();
      if (n > max) throw Error("Too many contexts");
      for (let i = 0; i < n; i++) {
        const key = take(Math.ceil(log(max)));
        if (key >= max || seen.has(key)) throw Error("Invalid context");
        seen.add(key);
        model.overrides.push([key, row()]);
      }
    }
  }
  if (pos !== bitLength) throw Error("Trailing model bits");
  return model;
}
