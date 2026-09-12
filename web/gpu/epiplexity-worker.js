import {
  estimateBehavior,
  shuffleBehavior,
  encodeBehaviorModel,
  WINDOW,
} from "./epiplexity.js";
let frames = [],
  ticks = [],
  lastAnalysis = 0;
onmessage = ({ data }) => {
  try {
    if (data.reset) {
      frames = [];
      ticks = [];
      lastAnalysis = 0;
      return;
    }
    frames.push(data.symbols);
    ticks.push(data.tick);
    if (frames.length > WINDOW) {
      frames.shift();
      ticks.shift();
    }
    if (frames.length < WINDOW) {
      postMessage({ warming: frames.length });
      return;
    }
    if (data.tick - lastAnalysis < 8 * 120 && lastAnalysis) return;
    lastAnalysis = data.tick;
    const started = performance.now(),
      estimate = estimateBehavior(frames);
    const shuffled = estimateBehavior(shuffleBehavior(frames));
    const code = encodeBehaviorModel(estimate.model);
    if (code.bitLength !== estimate.epiplexityBits)
      throw Error("Model code length mismatch");
    postMessage({
      estimate,
      shuffled,
      modelCode: { bitLength: code.bitLength, bytes: Array.from(code.bytes) },
      fromTick: ticks[0],
      toTick: ticks.at(-1),
      analysisMs: performance.now() - started,
      frames,
    });
  } catch (error) {
    postMessage({ error: error.message });
  } finally {
    postMessage({ accepted: true });
  }
};
