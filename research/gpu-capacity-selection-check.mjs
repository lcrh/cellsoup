import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { create, globals } from "webgpu";
import { capacitySelection } from "../web/gpu/capacity-selection.js";

Object.assign(globalThis, globals);
globalThis.__selectionGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await __selectionGPU.requestAdapter();
assert.ok(adapter);
const device = await adapter.requestDevice(),
  errors = [],
  checks = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
async function fixture(n, g = 1, zeroHash = false, options = {}) {
  const helper = capacitySelection({
      capacity: n,
      genomeCapacity: g,
      ...options,
    }),
    C = helper.candidates;
  const source = `const N=${options.entityCapacity ?? n}u;const C=${C}u;
struct Cell{p:vec4f,b:vec4f,r:array<f32,8>,signal:vec4f,mail:vec4f,machine:vec4u,life:vec4u,link:vec4u,res:vec4f,sender:vec4u,anchor:vec4f,phen:vec4f}
struct Scratch{${helper.declarations} counter:array<atomic<u32>,32>}
struct Config{sim:vec4u}
@group(0)@binding(0)var<storage,read_write> cells:array<Cell,C>;
@group(0)@binding(1)var<storage,read_write> s:Scratch;
@group(0)@binding(2)var<uniform> cfg:Config;
fn tick()->u32{return cfg.sim.y;}
fn hash(x:u32)->u32{${zeroHash ? "return 0u;" : "var z=x+0x9e3779b9u;z=(z^(z>>16u))*0x21f0aaadu;z=(z^(z>>15u))*0x735a2d97u;return z^(z>>15u);"}}
${helper.source}`;
  const module = device.createShaderModule({ code: source });
  const info = await module.getCompilationInfo();
  assert.deepEqual(
    info.messages.filter((m) => m.type === "error"),
    [],
  );
  const bindLayout = device.createBindGroupLayout({
    entries: [0, 1, 2].map((binding) => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: binding === 2 ? "uniform" : "storage" },
    })),
  });
  const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindLayout],
  });
  const pipelines = helper.stages.map(({ name }) =>
    device.createComputePipeline({
      layout,
      compute: { module, entryPoint: name },
    }),
  );
  const storage = (size) =>
    device.createBuffer({
      size,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
  const cells = storage(C * 208),
    scratch = storage(helper.byteLength + 128),
    uniform = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  const output = device.createBuffer({
    size: helper.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const group = device.createBindGroup({
    layout: bindLayout,
    entries: [cells, scratch, uniform].map((buffer, binding) => ({
      binding,
      resource: { buffer },
    })),
  });
  return {
    C,
    async run(entries, { seed = 42, tick = 1 } = {}) {
      const data = new ArrayBuffer(C * 208),
        u = new Uint32Array(data),
        f = new Float32Array(data);
      for (const [i, e] of entries.entries())
        if (e) {
          u[i * 52 + 31] = e.life ?? 1;
          u[i * 52 + 28] = e.age ?? 0;
          u.set(e.links ?? [0, 0, 0, 0], i * 52 + 32);
          u[i * 52 + 24] = e.identity ?? i + 1;
          f[i * 52 + 4] = (e.energy ?? 10) * 4096;
        }
      const living = entries.filter((e) => e && (e.life ?? 1) === 1).length;
      const limit = options.dynamicCorpseLimit
        ? Math.min(n, Math.max(0, (options.entityCapacity ?? n) - living))
        : n;
      device.queue.writeBuffer(
        scratch,
        helper.byteLength,
        new Uint32Array([0, living]),
      );
      device.queue.writeBuffer(cells, 0, data);
      device.queue.writeBuffer(uniform, 0, new Uint32Array([seed, tick, 0, 0]));
      const encoder = device.createCommandEncoder();
      for (const [i, stage] of helper.stages.entries()) {
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipelines[i]);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(Math.ceil(stage.count / 128));
        pass.end();
      }
      encoder.copyBufferToBuffer(scratch, 0, output, 0, helper.byteLength);
      device.queue.submit([encoder.finish()]);
      await output.mapAsync(GPUMapMode.READ);
      const result = new Uint32Array(output.getMappedRange().slice(0));
      output.unmap();
      const keys = result.slice(0, C),
        map = result.slice(C, 2 * C),
        state = result.slice(2 * C + 256);
      const active = entries.flatMap((e, i) =>
        e && [1, 2].includes(e.life ?? 1) ? [i] : [],
      );
      const eligible = active.filter((i) =>
        options.policy === "living"
          ? (entries[i].life ?? 1) === 1
          : options.policy === "corpses"
            ? entries[i].life === 2
            : true,
      );
      eligible.sort((a, b) => keys[a] - keys[b] || a - b);
      const victims = new Set(
        eligible.slice(0, Math.max(0, eligible.length - limit)),
      );
      const expected = Array.from({ length: C }, (_, i) =>
        Number(
          Boolean(
            entries[i] &&
            [1, 2].includes(entries[i].life ?? 1) &&
            !victims.has(i),
          ),
        ),
      );
      assert.deepEqual(
        [...map],
        expected,
        "GPU radix selection must equal exact weighted-key sorting including ties",
      );
      assert.equal(
        [...map].reduce((a, b) => a + b, 0),
        active.length - Math.max(0, eligible.length - limit),
      );
      assert.equal(state[0], eligible.length);
      assert.equal(state[1], Math.max(0, eligible.length - limit));
      return { keys, map, state };
    },
    destroy() {
      for (const b of [cells, scratch, uniform, output]) b.destroy();
    },
  };
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
try {
  await check(
    "empty, under-limit and exactly full worlds retain all occupied entities",
    async () => {
      const f = await fixture(4);
      try {
        for (const entries of [
          [],
          [{}],
          [{}, { life: 2 }],
          Array.from({ length: 4 }, () => ({})),
        ])
          await f.run(entries);
      } finally {
        f.destroy();
      }
    },
  );
  await check(
    "weighted selection covers residents daughters newcomers and corpses with exact overflow",
    async () => {
      const f = await fixture(128, 16);
      try {
        for (let tick = 1; tick <= 12; tick++) {
          const entries = Array.from({ length: f.C }, (_, i) =>
            i % 11 === 0
              ? null
              : {
                  energy: i % 7 === 0 ? 0 : (i % 100) + 1,
                  life: i % 5 === 0 ? 2 : 1,
                },
          );
          await f.run(entries, { tick });
        }
      } finally {
        f.destroy();
      }
    },
  );
  await check(
    "zero race keys and equal-key ties cull exactly the lowest candidate indices",
    async () => {
      const f = await fixture(129, 5, true);
      try {
        const entries = Array.from({ length: f.C }, () => ({ energy: 1 })),
          r = await f.run(entries);
        assert.ok([...r.keys].every((k) => k === 0));
        assert.equal(r.map[0], 0);
        assert.equal(r.map.at(-1), 1);
      } finally {
        f.destroy();
      }
    },
  );
  await check(
    "inverse energy favors the 1-energy victim over the 4-energy victim without immunity",
    async () => {
      const f = await fixture(1);
      try {
        let low = 0;
        for (let tick = 1; tick <= 256; tick++) {
          const r = await f.run([{ energy: 1 }, { energy: 4 }], { tick });
          low += 1 - r.map[0];
        }
        assert.ok(low >= 180 && low <= 230, `low-energy victims ${low}/256`);
        console.log(JSON.stringify({ lowEnergyVictims: low, trials: 256 }));
      } finally {
        f.destroy();
      }
    },
  );
  await check(
    "corpse nutrient reserves do not change their zero-usable-energy selection weight",
    async () => {
      const f = await fixture(1);
      try {
        let left = 0;
        for (let tick = 1; tick <= 128; tick++) {
          const a = await f.run(
              [
                { life: 2, energy: 1 },
                { life: 2, energy: 3895 },
              ],
              { tick },
            ),
            b = await f.run(
              [
                { life: 2, energy: 3895 },
                { life: 2, energy: 1 },
              ],
              { tick },
            );
          assert.deepEqual(a.map, b.map);
          assert.deepEqual(a.keys, b.keys);
          left += 1 - a.map[0];
        }
        assert.ok(left > 40 && left < 88);
      } finally {
        f.destroy();
      }
    },
  );
  await check(
    "large overflowing candidate sets retain exact cap and stable deterministic selection",
    async () => {
      const f = await fixture(32768, 64);
      try {
        const entries = Array.from({ length: f.C }, (_, i) => ({
          energy: (i % 3895) + 1,
        }));
        const a = await f.run(entries),
          b = await f.run(entries);
        assert.deepEqual(a.map, b.map);
        assert.deepEqual(a.keys, b.keys);
        assert.ok([...a.map.slice(32768, 65536)].some(Boolean));
        assert.ok([...a.map.slice(0, 32768)].some(Boolean));
      } finally {
        f.destroy();
      }
    },
  );

  await check(
    "living contest leaves corpses untouched and keeps exactly the living cap",
    async () => {
      const f = await fixture(4, 1, false, {
        entityCapacity: 8,
        policy: "living",
      });
      try {
        const entries = Array.from({ length: 12 }, (_, i) => ({
          life: i % 3 === 0 ? 2 : 1,
          energy: i + 1,
        }));
        const r = await f.run(entries);
        assert.equal(
          entries.reduce(
            (n, e, i) => n + Number(e.life === 1 && r.map[i] === 1),
            0,
          ),
          4,
        );
        for (let i = 0; i < 12; i += 3) assert.equal(r.map[i], 1);
        const sparse = await f.run([
          { life: 1 },
          ...Array.from({ length: 8 }, () => ({ life: 2 })),
        ]);
        assert.equal(sparse.map[0], 1);
        assert.equal(sparse.state[1], 0);
      } finally {
        f.destroy();
      }
    },
  );
  await check(
    "corpse contest removes oldest first, preserves living and ignores nutrient value",
    async () => {
      const f = await fixture(2, 1, false, {
        entityCapacity: 4,
        policy: "corpses",
        prefix: "corpse",
      });
      try {
        const entries = [
          { life: 1, age: 9999 },
          { life: 2, age: 3, energy: 1 },
          { life: 2, age: 1, energy: 3000 },
          { life: 2, age: 9 },
          { life: 2, age: 2 },
          { life: 1 },
        ];
        const a = await f.run(entries),
          b = await f.run(
            entries.map((e) => ({ ...e, energy: 3895 - (e.energy ?? 10) })),
            { seed: 97, tick: 52 },
          );
        assert.deepEqual([...a.map.slice(0, 6)], [1, 0, 1, 0, 1, 1]);
        assert.deepEqual(a.map, b.map);
        assert.deepEqual(a.keys, b.keys);
      } finally {
        f.destroy();
      }
    },
  );
  await check(
    "corpse age saturation and ties remove lowest indices deterministically",
    async () => {
      const f = await fixture(2, 1, false, {
        entityCapacity: 4,
        policy: "corpses",
        prefix: "corpse",
      });
      try {
        const r = await f.run([
          { life: 2, age: 0xffffffff },
          { life: 2, age: 0xfffffffe },
          { life: 2, age: 0xffffffff },
          { life: 2, age: 0 },
        ]);
        assert.deepEqual([...r.map.slice(0, 4)], [0, 0, 1, 1]);
      } finally {
        f.destroy();
      }
    },
  );

  await check(
    "corpse retirement shrinks to free resident slots when living overshoots the soft target",
    async () => {
      const f = await fixture(4, 1, false, {
        entityCapacity: 8,
        policy: "corpses",
        prefix: "corpse",
        dynamicCorpseLimit: true,
      });
      try {
        for (const living of [3, 6, 8]) {
          const entries = [
            ...Array.from({ length: living }, () => ({ life: 1 })),
            ...Array.from({ length: 5 }, (_, i) => ({ life: 2, age: i + 1 })),
          ];
          const r = await f.run(entries),
            kept = entries.filter((e, i) => e.life === 2 && r.map[i]).length;
          assert.equal(kept, Math.min(4, 8 - living));
          assert.equal(
            [...r.map].reduce((a, b) => a + b, 0),
            living + kept,
          );
        }
      } finally {
        f.destroy();
      }
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    process.argv[2] ?? "/private/tmp/cellsoup-capacity-selection-check.json",
    JSON.stringify({ complete: true, checks }, null, 2),
  );
} finally {
  device.destroy();
  delete globalThis.__selectionGPU;
}
