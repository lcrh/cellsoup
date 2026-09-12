import { GPU_OPS } from "./language.js";
import { TREE_VM_OPS } from "./trees.js";
import {
  createTraceSelector,
  unpackExecutionTrace,
} from "./execution-traces.js";
export async function createExecutionMeter(device, engine) {
  const $ = (id) => document.getElementById(id),
    selector = await createTraceSelector(device, engine);
  let epoch = 0;
  let window = null,
    nextTick = engine.tick,
    programs = [],
    worker = null,
    latest = null,
    destroyed = false,
    pending = false;
  function reset() {
    epoch++;
    engine.stopExecutionTrace();
    window = null;
    latest = null;
    pending = false;
    nextTick = engine.tick;
    worker?.terminate();
    worker = null;
    $("trace-score").textContent = "—";
    $("trace-shuffled").textContent = "—";
    $("trace-saving").textContent = "—";
    $("trace-export").disabled = true;
    $("trace-structure").textContent = "";
    $("trace-status").textContent = $("trace-enabled").checked
      ? "Preparing an execution sample…"
      : "Execution recording paused.";
  }
  function compress(trace) {
    const version = epoch;
    worker = new Worker(new URL("./trace-worker.js", import.meta.url), {
      type: "module",
    });
    pending = true;
    worker.onmessage = ({ data }) => {
      if (destroyed || version !== epoch) return;
      pending = false;
      worker.terminate();
      worker = null;
      if (data.error) {
        $("trace-status").textContent =
          "Trace compression unavailable: " + data.error;
        return;
      }
      latest = data;
      const m = data.measurement;
      $("trace-score").textContent =
        m.bitsPerRawByte === null
          ? "—"
          : m.bitsPerRawByte.toFixed(2) + " bits / byte";
      $("trace-shuffled").textContent = m.rawBytes
        ? ((8 * m.shuffledGzipBytes) / m.rawBytes).toFixed(2) + " bits / byte"
        : "—";
      $("trace-saving").textContent =
        m.orderSavings === null
          ? "No execution"
          : (100 * m.orderSavings).toFixed(1) + "%";
      $("trace-status").textContent =
        `${m.executed.toLocaleString()} executed instructions · ${m.activeCells} active / ${m.sampledCells} sampled cells · ticks ${data.beginTick.toLocaleString()}–${data.endTick.toLocaleString()}.`;
      const s = m.structure;
      const number = (x) => (x === null ? "—" : x.toFixed(1));
      $("trace-structure").textContent =
        `Sample averages: mutation depth ${number(s.meanMutationDepth)} · tree depth ${number(s.meanTreeDepth)} · code executed ${s.meanInstructionCoverage === null ? "—" : (100 * s.meanInstructionCoverage).toFixed(0) + "%"} · ${s.variableBranches} branches took different paths.`;
      $("trace-export").disabled = false;
    };
    worker.onerror = () => {
      if (destroyed || version !== epoch) return;
      pending = false;
      worker?.terminate();
      worker = null;
      $("trace-status").textContent =
        "Trace worker stopped. Toggle recording to restart.";
    };
    worker.postMessage({
      trace,
      programs,
      opcodeNames: (engine.cfg.treePrograms ? TREE_VM_OPS : GPU_OPS).map(
        (o) => o[0],
      ),
      source: { kernel: engine.fingerprint, config: engine.cfg },
      encoding:
        "Each event is a 32-bit word: opcode in bits 0–7, PC before in 8–15, PC after in 16–23, paid/executed in bit 24, yielded in bit 25. Gzip input is cell-major: for each of 256 ticks, a one-byte attempt count then count little-endian event words. Identities, programs and unused buffer space are excluded from measured bytes. The download is a gzip-compressed JSON container; its size differs from the measured binary stream.",
    });
  }
  $("trace-enabled").onchange = reset;
  $("trace-export").onclick = () => {
    if (!latest) return;
    const url = URL.createObjectURL(
        new Blob([latest.download], { type: "application/gzip" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `cellsoup-execution-${latest.endTick}.json.gz`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  reset();
  return {
    limitStep(ticks) {
      return window ? Math.min(ticks, window.collectTick - engine.tick) : ticks;
    },
    async observe() {
      if (destroyed || !$("trace-enabled").checked) return;
      const version = epoch;
      try {
        if (window && engine.tick >= window.collectTick) {
          const trace = unpackExecutionTrace(await engine.executionTrace());
          if (destroyed || version !== epoch) return;
          engine.stopExecutionTrace();
          window = null;
          nextTick = engine.tick + 3600;
          compress(trace);
        }
        if (!window && !pending && engine.tick >= nextTick) {
          const seed = (engine.cfg.seed ^ engine.tick ^ 0x768a352d) >>> 0,
            selected = await selector.select(seed);
          const genes = new Set(
            Array.from({ length: 32 }, (_, i) => i)
              .filter((i) => selected[i * 4] !== 0xffffffff)
              .map((i) => selected[i * 4 + 2]),
          );
          programs = await Promise.all(
            [...genes].map(async (slot) => ({
              slot,
              ...(await engine.genome(slot)),
            })),
          );
          if (destroyed || version !== epoch) return;
          window = engine.armExecutionTrace(selected, seed);
          $("trace-status").textContent =
            `Recording 256 ticks from ${Array.from({ length: 32 }, (_, i) => selected[i * 4]).filter((i) => i !== 0xffffffff).length} sampled cells…`;
        }
      } catch (error) {
        if (destroyed || version !== epoch) return;
        engine.stopExecutionTrace();
        window = null;
        nextTick = engine.tick + 3600;
        $("trace-status").textContent =
          "Execution recording unavailable: " + error.message;
      }
    },
    destroy() {
      destroyed = true;
      worker?.terminate();
      selector.destroy();
      engine.stopExecutionTrace();
      $("trace-enabled").onchange = null;
      $("trace-export").onclick = null;
    },
  };
}
