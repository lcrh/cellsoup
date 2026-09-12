import { createBehaviorSampler } from "./behavior-sampler.js";
import { SAMPLE_TICKS, WINDOW } from "./epiplexity.js";
export async function createBehaviorMeter(device, engine) {
  const sampler = await createBehaviorSampler(device, engine),
    $ = (id) => document.getElementById(id);
  let worker,
    nextTick = 0,
    epoch = 0,
    latest = null,
    history = [],
    destroyed = false,
    error = false,
    pending = 0;
  const bits = (n) => `${Math.round(n).toLocaleString()} bits`;
  function draw() {
    const canvas = $("epi-history"),
      r = canvas.getBoundingClientRect(),
      dpr = devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, r.width, r.height);
    if (history.length < 2) return;
    const max =
        Math.max(1, ...history.flatMap((p) => [p.score, p.shuffled])) * 1.1,
      first = history[0].tick,
      span = history.at(-1).tick - first;
    for (const [key, color] of [
      ["shuffled", "#8c9b9b"],
      ["score", "#9fdccc"],
    ]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      history.forEach((p, i) => {
        const x = ((p.tick - first) / span) * r.width,
          y = r.height - 5 - (p[key] / max) * (r.height - 10);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
  }
  function reset() {
    epoch++;
    pending = 0;
    worker?.terminate();
    worker = null;
    latest = null;
    history = [];
    error = false;
    nextTick = Math.ceil(engine.tick / SAMPLE_TICKS) * SAMPLE_TICKS;
    $("epi-score").textContent = "—";
    $("epi-noise").textContent = "—";
    $("epi-shuffled").textContent = "—";
    $("epi-export").disabled = true;
    draw();
    if (!$("epi-enabled").checked) {
      $("epi-status").textContent = "Measurement paused.";
      return;
    }
    $("epi-status").textContent = "Recording behavior · 0 / 32 samples";
    const version = epoch;
    worker = new Worker(new URL("./epiplexity-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (destroyed || version !== epoch) return;
      if (data.accepted) {
        pending = Math.max(0, pending - 1);
        return;
      }
      if (data.error) {
        error = true;
        $("epi-status").textContent = `Measurement unavailable: ${data.error}`;
        return;
      }
      if (data.warming) {
        $("epi-status").textContent =
          `Recording behavior · ${data.warming} / ${WINDOW} samples`;
        return;
      }
      latest = data;
      const e = data.estimate,
        s = data.shuffled;
      $("epi-score").textContent = bits(e.epiplexityBits);
      $("epi-noise").textContent = Number.isFinite(e.unpredictedBitsPerToken)
        ? e.unpredictedBitsPerToken.toFixed(2) + " bits / symbol"
        : "Not predicted";
      $("epi-shuffled").textContent = bits(s.epiplexityBits);
      const gain = e.heldOutGainBits / e.testTokens;
      $("epi-status").textContent = !Number.isFinite(gain)
        ? "The selected model failed on unseen frames; its estimate does not generalize to the latest behavior."
        : `${e.selected.label} · last ${(data.toTick - data.fromTick) / 60} simulated seconds · ${gain >= 0 ? "gains" : "loses"} ${Math.abs(gain).toFixed(2)} prediction bits / symbol versus channel averages on unseen frames.`;
      $("epi-export").disabled = false;
      history.push({
        tick: data.toTick,
        score: e.epiplexityBits,
        shuffled: s.epiplexityBits,
      });
      if (history.length > 120) history.shift();
      draw();
    };
    worker.onerror = () => {
      if (version === epoch) {
        error = true;
        $("epi-status").textContent =
          "Measurement worker stopped. Toggle measurement to restart.";
      }
    };
  }
  $("epi-enabled").onchange = reset;
  $("epi-export").onclick = () => {
    if (!latest) return;
    const record = {
      source: { kernel: engine.fingerprint, config: engine.cfg },
      ...latest,
      frames: latest.frames.map((f) => Array.from(f)),
      history,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cellsoup-behavior-${engine.tick}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  reset();
  return {
    limitStep(ticks) {
      return worker && !error
        ? Math.max(1, Math.min(ticks, nextTick - engine.tick))
        : ticks;
    },
    async observe() {
      if (!worker || error || engine.tick < nextTick) return;
      if (pending >= 8) reset();
      const version = epoch;
      try {
        if (engine.tick !== nextTick)
          throw Error("Behavior sample cadence was interrupted");
        const sample = await sampler.sample();
        if (destroyed || version !== epoch) return;
        nextTick += SAMPLE_TICKS;
        pending++;
        worker.postMessage(sample, [sample.symbols.buffer]);
      } catch (e) {
        if (version === epoch) {
          error = true;
          $("epi-status").textContent = `Measurement unavailable: ${e.message}`;
        }
      }
    },
    destroy() {
      destroyed = true;
      epoch++;
      worker?.terminate();
      sampler.destroy();
    },
  };
}
