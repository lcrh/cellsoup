// Controlled phototaxis assay. Authored controls stay in this harness; evolved
// programs are replayed unchanged. This is a task-specific causal probe, not a
// general complexity score or a test of reproductive fitness.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { create, globals } from "webgpu";
import { createLifeEngine, ENERGY_SCALE } from "../web/gpu/engine.js";
import { parseTree, compileTree, formatTree } from "../web/gpu/trees.js";
import {
  createTraceSelector,
  unpackExecutionTrace,
} from "../web/gpu/execution-traces.js";
import {
  measureTraceCompression,
  summarizeExecutionStructure,
  traceBytes,
} from "../web/gpu/trace-compression.js";

const [input, output, mode = "full"] = process.argv.slice(2);
if (!output)
  throw Error(
    "Usage: node research/sensory-motion-probe.mjs candidates.json output.json [smoke|full]",
  );
assert.ok(["smoke", "full"].includes(mode));
const candidates = JSON.parse(await readFile(input, "utf8"));
const controls = [
  {
    id: "control-gradient-turn",
    authored: true,
    tree: parseTree(
      "(seq (photosynthesize) (turn (sunlight-bearing)) (move 1))",
    ),
  },
  {
    id: "control-straight",
    authored: true,
    tree: parseTree("(seq (photosynthesize) (move 1))"),
  },
  {
    id: "control-idle-photo",
    authored: true,
    tree: parseTree("(photosynthesize)"),
  },
];
const programs =
  mode === "smoke" ? controls.slice(0, 2) : [...controls, ...candidates];
Object.assign(globalThis, globals);
globalThis.__sensoryGPU = create(
  process.platform === "darwin" ? ["backend=metal"] : [],
);
const adapter = await globalThis.__sensoryGPU.requestAdapter();
assert.ok(adapter, "GPU unavailable");
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
const config = {
  treePrograms: 1,
  capacity: 1,
  genomeCapacity: 1,
  initial: 0,
  floor: 0,
  rate: 0,
  side: 64,
  sources: 1,
  seed: 813,
  solarEnabled: 0,
  archiveEnabled: 0,
  executionTrace: 1,
};
const width = config.side * 32,
  center = width / 2;
const endTick = mode === "smoke" ? 300 : 900;
const directions = mode === "smoke" ? [0, 0.5] : [0, 0.25, 0.5, 0.75];
const headings = [0, 0.25, 0.5, 0.75];
const target = "c.r[d]=atan2(gradient.y,gradient.x)*57.29578;";
const replacement = "c.r[d]=0.0;";
const hash = (code) => createHash("sha256").update(code).digest("hex");
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const shaderHashes = {};
// Instrument only this assay's shader module, preserving program bytes, budget,
// costs, instruction timing and gradient-magnitude output. No production hook.
function instrumented(blind) {
  let modules = 0;
  return {
    device: new Proxy(device, {
      get(obj, name) {
        if (name === "createShaderModule")
          return (descriptor) => {
            assert.equal(++modules, 1);
            assert.equal(
              descriptor.code.split(target).length,
              2,
              "Expected exactly one sunlight-bearing assignment",
            );
            const code = blind
              ? descriptor.code.replace(target, replacement)
              : descriptor.code;
            const key = blind ? "zero-bearing" : "intact";
            assert.ok(!shaderHashes[key] || shaderHashes[key] === hash(code));
            shaderHashes[key] = hash(code);
            return obj.createShaderModule({ ...descriptor, code });
          };
        const value = Reflect.get(obj, name, obj);
        return typeof value === "function" ? value.bind(obj) : value;
      },
    }),
    verify() {
      assert.equal(modules, 1);
    },
  };
}
function lightField(direction) {
  const theta = direction * Math.PI * 2;
  const axis = [Math.round(Math.cos(theta)), Math.round(Math.sin(theta))];
  const values = new Float32Array(config.side ** 2 * 4);
  for (let phase = 0; phase < 2; phase++)
    for (let y = 0; y < config.side; y++)
      for (let x = 0; x < config.side; x++) {
        const distance =
          (x * 32 + 16 - center) * axis[0] + (y * 32 + 16 - center) * axis[1];
        values[(phase * config.side ** 2 + y * config.side + x) * 2] =
          0.5 + 0.45 * Math.sin((distance * 2 * Math.PI) / width);
      }
  return { values, axis };
}
let resolvedConfig, nominalKernel;
async function replay(program, direction, heading, blind) {
  const instrument = instrumented(blind);
  const engine = await createLifeEngine(instrument.device, config);
  instrument.verify();
  resolvedConfig = engine.cfg;
  nominalKernel = engine.fingerprint;
  let selector;
  try {
    await engine.fixture({
      programs: [{ tree: program.tree }],
      cells: [{ energy: 70, storage: 24, heading }],
      sunlight: 0.5,
    });
    const field = lightField(direction);
    device.queue.writeBuffer(engine.buffers.food, 0, field.values);
    selector = await createTraceSelector(device, engine);
    const selection = await selector.select(92);
    engine.armExecutionTrace(selection, 92);
    const trajectory = [];
    let lastTick = 0,
      trace;
    const ticks = [
      ...new Set([
        0,
        256,
        ...Array.from({ length: endTick / 30 }, (_, i) => (i + 1) * 30),
      ]),
    ].sort((a, b) => a - b);
    let px = center,
      py = center,
      ux = 0,
      uy = 0,
      path = 0;
    for (const tick of ticks) {
      await engine.step(tick - lastTick);
      lastTick = tick;
      const state = await engine.state(),
        f = new Float32Array(state),
        u = new Uint32Array(state);
      const wrap = (d) => d - Math.round(d / width) * width;
      const dx = wrap(f[0] - px),
        dy = wrap(f[1] - py);
      px = f[0];
      py = f[1];
      ux += dx;
      uy += dy;
      path += Math.hypot(dx, dy);
      const tileY = Math.floor(f[1] / 32),
        tileX = Math.floor(f[0] / 32);
      const row = {
        tick,
        x: f[0],
        y: f[1],
        ux,
        uy,
        heading: f[5],
        alive: u[31] === 1,
        energy: f[4] / ENERGY_SCALE,
        storage: f[38] / ENERGY_SCALE,
        temperature: f[39],
        sunlight: field.values[(tileY * config.side + tileX) * 2],
        upGradient: ux * field.axis[0] + uy * field.axis[1],
        path,
      };
      assert.ok(
        Object.values(row).every(
          (v) => typeof v === "boolean" || Number.isFinite(v),
        ),
      );
      trajectory.push(row);
      if (tick === 256)
        trace = unpackExecutionTrace(await engine.executionTrace());
    }
    const compiled = compileTree(program.tree);
    const compression = await measureTraceCompression(trace);
    const structure = summarizeExecutionStructure(trace, [
      {
        slot: 0,
        serial: program.serial ?? 0,
        depth: program.depth ?? 0,
        length: compiled.length,
        tree: program.tree,
      },
    ]);
    return {
      direction,
      heading,
      blind,
      trajectory,
      compression,
      structure,
      trace,
      meanSunlight:
        trajectory
          .slice(1)
          .reduce(
            (sum, r, i) =>
              sum +
              ((r.tick - trajectory[i].tick) *
                (r.sunlight + trajectory[i].sunlight)) /
                2,
            0,
          ) / endTick,
      final: trajectory.at(-1),
    };
  } finally {
    selector?.destroy();
    engine.destroy();
  }
}
const report = {
  mode,
  complete: false,
  endTick,
  directions,
  headings,
  version: "sensory-motion-v1",
  scope:
    "An isolated fresh cell in a static periodic sunlight band, at four balanced initial headings and four cardinal band orientations. Paired replay zeros only the sunlight-bearing output at identical VM timing; magnitude and local-light readings remain. Capacity one prevents births. Normal energy and action costs; the endTick field specifies the duration (60 ticks per second). Tests directional sensor dependence, not memory, communication, selection history, colony coordination or reproductive fitness. No mutations or authored founders added to evolving worlds.",
  programs: [],
};
async function save() {
  await writeFile(
    output.replace(/\.json$/, "") + ".json.gz",
    gzipSync(
      JSON.stringify(report, (_, value) =>
        ArrayBuffer.isView(value) ? Array.from(value) : value,
      ),
    ),
  );
  const compact = {
    ...report,
    programs: report.programs.map(({ trials, ...rest }) => ({
      ...rest,
      trials: trials.map((t) =>
        Object.fromEntries(
          Object.entries(t).map(([key, { trace, ...value }]) => [key, value]),
        ),
      ),
    })),
  };
  await writeFile(output, JSON.stringify(compact, null, 2) + "\n");
}
try {
  for (const program of programs) {
    const trials = [];
    for (const direction of directions)
      for (const heading of headings) {
        const intact = await replay(program, direction, heading, false);
        const blind = await replay(program, direction, heading, true);
        trials.push({ intact, blind });
      }
    // A repeat at a nontrivial heading must reproduce before causal attribution.
    const repeat = await replay(program, directions[0], headings[1], false);
    assert.deepEqual(
      repeat,
      trials[1].intact,
      "Single-cell replay was not deterministic",
    );
    const summary = {
      pairs: trials.length,
      identicalInstructionTracePairs: trials.filter((t) =>
        Buffer.from(traceBytes(t.intact.trace)).equals(
          Buffer.from(traceBytes(t.blind.trace)),
        ),
      ).length,
      intactMeanSunlight: mean(trials.map((t) => t.intact.meanSunlight)),
      blindMeanSunlight: mean(trials.map((t) => t.blind.meanSunlight)),
      lightBenefit: mean(
        trials.map((t) => t.intact.meanSunlight - t.blind.meanSunlight),
      ),
      intactFinalEnergy: mean(trials.map((t) => t.intact.final.energy)),
      blindFinalEnergy: mean(trials.map((t) => t.blind.final.energy)),
      intactAlive: trials.filter((t) => t.intact.final.alive).length,
      blindAlive: trials.filter((t) => t.blind.final.alive).length,
      intactProgress: mean(trials.map((t) => t.intact.final.upGradient)),
      blindProgress: mean(trials.map((t) => t.blind.final.upGradient)),
      meanOrderSavings: mean(
        trials.map((t) => t.intact.compression.orderSavings),
      ),
      variableBranches: trials.map((t) => t.intact.structure.variableBranches),
    };
    if (program.id === "control-gradient-turn")
      assert.ok(
        summary.lightBenefit > 0.05,
        "Positive control must benefit from sensing",
      );
    if (
      program.id === "control-straight" ||
      program.id === "control-idle-photo"
    ) {
      for (const t of trials)
        assert.deepEqual(
          t.intact.trajectory,
          t.blind.trajectory,
          "Sensor-independent control changed",
        );
      assert.equal(summary.lightBenefit, 0);
    }
    report.programs.push({
      ...program,
      source: formatTree(program.tree),
      compiledSource: compileTree(program.tree).source,
      summary,
      trials,
    });
    console.log(JSON.stringify({ id: program.id, ...summary }));
    report.config = resolvedConfig;
    report.nominalKernel = nominalKernel;
    report.actualShaderSha256 = shaderHashes;
    await save();
  }
  assert.deepEqual(errors, []);
  report.complete = true;
  await save();
} finally {
  device.destroy();
  delete globalThis.__sensoryGPU;
}
