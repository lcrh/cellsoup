import test from "node:test";
import assert from "node:assert/strict";
import {
  gzip,
  traceBytes,
  measureTraceCompression,
} from "../web/gpu/trace-compression.js";
function trace(event) {
  return {
    version: "execution-path-v1",
    cells: [
      {
        slot: 1,
        identity: 20,
        genomeSlot: 7,
        frames: Array.from({ length: 256 }, (_, t) =>
          Uint32Array.from({ length: 32 }, (_, s) => event(t * 32 + s)),
        ),
      },
    ],
  };
}
test("gzip is lossless and ignores identity metadata", async () => {
  const input = trace(
    (i) => 0x1000000 | (i % 4) | ((i % 4) << 8) | (((i + 1) % 4) << 16),
  );
  const before = structuredClone(input),
    raw = traceBytes(input),
    zipped = await gzip(raw);
  const decoded = new Uint8Array(
    await new Response(
      new Blob([zipped]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer(),
  );
  assert.deepEqual(decoded, raw);
  input.cells[0].identity = 999;
  input.cells[0].genomeSlot = 3;
  assert.deepEqual(traceBytes(input), raw);
  input.cells[0].identity = 20;
  input.cells[0].genomeSlot = 7;
  assert.deepEqual(input, before);
});
test("repetition compresses strongly, random paths have little ordering advantage", async () => {
  const repeating = trace(
    (i) => 0x1000000 | (i % 16) | ((i % 16) << 8) | (((i + 1) % 16) << 16),
  );
  let seed = 89;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 8;
  }
  const noise = trace(
    () =>
      0x1000000 |
      (random() % 50) |
      ((random() % 64) << 8) |
      ((random() % 64) << 16),
  );
  const [a, b] = await Promise.all([
    measureTraceCompression(repeating),
    measureTraceCompression(noise),
  ]);
  assert.ok(a.orderSavings > 0.7);
  assert.ok(Math.abs(b.orderSavings) < 0.08);
  assert.ok(a.gzipBytes < b.gzipBytes / 10);
  assert.equal(a.executed, 8192);
  assert.equal(a.activeCells, 1);
});
test("shuffle preserves whole event counts and tick boundaries without changing input", () => {
  const input = trace((i) => 0x1000000 | (i % 13) | ((i % 61) << 8)),
    before = structuredClone(input);
  function events(bytes) {
    const v = new DataView(bytes.buffer),
      out = [];
    let at = 0;
    for (let t = 0; t < 256; t++) {
      const n = bytes[at++];
      assert.equal(n, 32);
      for (let i = 0; i < n; i++) {
        out.push(v.getUint32(at, true));
        at += 4;
      }
    }
    assert.equal(at, bytes.length);
    return out;
  }
  const a = events(traceBytes(input)),
    b = events(traceBytes(input, { shuffle: true }));
  assert.notDeepEqual(a, b);
  assert.deepEqual(a.sort(), b.sort());
  assert.deepEqual(input, before);
});
test("idle and unpaid traces do not receive an ordering score", async () => {
  const idle = trace(() => 0);
  idle.cells[0].frames = Array.from({ length: 256 }, () => new Uint32Array());
  for (const input of [idle, trace((i) => i % 4)]) {
    const m = await measureTraceCompression(input);
    assert.equal(m.executed, 0);
    assert.equal(m.orderSavings, null);
  }
});

test('structural cross-checks distinguish executed code and variable branches',async()=>{
 const {summarizeExecutionStructure}=await import('../web/gpu/trace-compression.js');
 const input=trace(()=>0);input.cells[0].frames=Array.from({length:256},()=>new Uint32Array());
 input.cells[0].frames[0]=new Uint32Array([0x1000000|9|(1<<8)|(2<<16)]);
 input.cells[0].frames[1]=new Uint32Array([0x1000000|9|(1<<8)|(7<<16)]);
 const programs=[{slot:7,serial:99,depth:3,length:8,tree:{op:'seq',args:[{op:'nop',args:[]},{op:'nop',args:[]}]}}];
 const a=summarizeExecutionStructure(input,programs);assert.equal(a.meanMutationDepth,3);assert.equal(a.meanTreeDepth,2);assert.equal(a.meanInstructionCoverage,1/8);assert.equal(a.variableBranches,1);
 input.cells[0].frames[1][0]&=~0x1000000;
 assert.equal(summarizeExecutionStructure(input,programs).variableBranches,0);
});
