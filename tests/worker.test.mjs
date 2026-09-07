import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
test("real browser worker initializes independent random genomes, pauses, steps and seeds", async () => {
  const url = new URL("../web/worker.js", import.meta.url).href;
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');const {readFile}=require('node:fs/promises');global.self=global;global.postMessage=(v,t)=>parentPort.postMessage(v,t);global.fetch=async(url)=>({ok:true,arrayBuffer:async()=>{const b=await readFile(url);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}});parentPort.on('message',data=>self.onmessage?.({data}));import(${JSON.stringify(url)}).catch(e=>{throw e});`,
    { eval: true },
  );
  const messages = [];
  let wake;
  worker.on("message", (m) => {
    messages.push(m);
    if (m.type === "frame") worker.postMessage({ type: "ack" });
    wake?.();
  });
  worker.on("error", (e) => {
    messages.push({ type: "error", text: e.message });
    wake?.();
  });
  async function next(type, predicate = () => true) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const err = messages.find((m) => m.type === "error");
      if (err) throw Error(err.text);
      const i = messages.findIndex((m) => m.type === type && predicate(m));
      if (i >= 0) return messages.splice(i, 1)[0];
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 50);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
    throw Error(`Timed out waiting for ${type}`);
  }
  try {
    const first = await next("frame");
    assert.equal(first.stats[0], 512);
    assert.equal(first.stats[7], 512);
    await next("ready");
    worker.postMessage({ type: "pause", value: true });
    worker.postMessage({ type: "step" });
    const stepped = await next("frame", (m) => m.stats[1] > 0);
    assert.ok(stepped.stats[7] >= 512);
    worker.postMessage({
      type: "seed",
      source: "wait 1000",
      x: 800,
      y: 500,
      n: 4,
    });
    await next("notice");
    const seeded = await next(
      "frame",
      (m) => m.stats[0] === stepped.stats[0] + 4,
    );
    assert.equal(seeded.stats[7], stepped.stats[7] + 1);
    worker.postMessage({
      type: "config",
      settings: {
        floor: 0,
        arrivalRate: 0,
        drawEvery: 600,
        food: 0,
        costs: Array(11).fill(0),
      },
    });
    worker.postMessage({
      type: "reset",
      scenario: "editor",
      source: "wait 36000",
      seed: 42,
    });
    await next("frame", (m) => m.stats[0] === 128 && m.stats[1] === 0);
    messages.length = 0;
    worker.postMessage({ type: "speed", value: "max" });
    worker.postMessage({ type: "pause", value: false });
    const fast = await next(
      "frame",
      (m) => m.speed === "max" && m.stats[1] >= 600,
    );
    const later = await next(
      "frame",
      (m) => !m.paused && m.stats[1] > fast.stats[1],
    );
    assert.ok(later.stats[1] - fast.stats[1] >= 600);
    messages.length = 0;
    worker.postMessage({ type: "pause", value: true });
    const stopped = await next("frame", (m) => m.paused);
    worker.postMessage({ type: "step" });
    const single = await next(
      "frame",
      (m) => m.paused && m.stats[1] > stopped.stats[1],
    );
    assert.equal(single.stats[1], stopped.stats[1] + 1);
  } finally {
    await worker.terminate();
  }
});
