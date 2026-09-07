import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
test("real browser worker initializes three distinct genomes, pauses, steps and seeds", async () => {
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
    assert.equal(first.stats[0], 308);
    assert.equal(first.stats[7], 3);
    await next("ready");
    worker.postMessage({ type: "pause", value: true });
    worker.postMessage({ type: "step" });
    const stepped = await next("frame", (m) => m.stats[1] > 0);
    assert.equal(stepped.stats[7], 3);
    worker.postMessage({
      type: "seed",
      source: "wait 1000",
      x: 800,
      y: 500,
      n: 4,
    });
    await next("notice");
    const seeded = await next("frame", (m) => m.stats[0] === 312);
    assert.equal(seeded.stats[7], 4);
  } finally {
    await worker.terminate();
  }
});
