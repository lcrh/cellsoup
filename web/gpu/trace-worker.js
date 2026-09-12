import {
  measureTraceCompression,
  gzip,
  summarizeExecutionStructure,
} from "./trace-compression.js";
self.onmessage = async ({ data }) => {
  try {
    const measurement = {
      ...(await measureTraceCompression(data.trace)),
      structure: summarizeExecutionStructure(data.trace, data.programs),
    };
    const artifact = {
      ...data,
      measurement,
      trace: {
        ...data.trace,
        cells: data.trace.cells.map((c) => ({
          ...c,
          frames: c.frames.map((f) => Array.from(f)),
        })),
      },
    };
    const download = await gzip(
      new TextEncoder().encode(JSON.stringify(artifact)),
    );
    self.postMessage(
      {
        measurement,
        beginTick: data.trace.beginTick,
        endTick: data.trace.endTickExclusive - 1,
        download,
      },
      [download.buffer],
    );
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
