import test from "node:test";
import assert from "node:assert/strict";
import { appendEventSample } from "../web/gpu/event-history.js";

test("attack and kill rates use elapsed simulated time at any playback speed", () => {
  const history = [];
  appendEventSample(history, { tick: 60, living: 100, attacks: 100, kills: 5 });
  assert.equal(history[0].killsRate, null);
  appendEventSample(history, { tick: 180, living: 90, attacks: 120, kills: 7 });
  assert.equal(history[1].attacksRate, 600);
  assert.equal(history[1].killsRate, 60);
  appendEventSample(history, {
    tick: 1380,
    living: 90,
    attacks: 320,
    kills: 27,
  });
  assert.equal(history[2].attacksRate, 600);
  assert.equal(history[2].killsRate, 60);
  assert.equal(history[2].kills, 27);
});

test("pausing adds no samples; idle intervals report zero and new worlds reset history", () => {
  const history = [];
  const sample = { tick: 600, living: 100, attacks: 10, kills: 2 };
  appendEventSample(history, sample);
  assert.equal(appendEventSample(history, sample), false);
  assert.equal(history.length, 1);
  appendEventSample(history, { ...sample, tick: 1200 });
  assert.equal(history[1].attacksRate, 0);
  assert.equal(history[1].killsRate, 0);
  appendEventSample(history, { ...sample, tick: 1, attacks: 0, kills: 0 });
  assert.equal(history.length, 1);
  assert.equal(history[0].killsRate, null);
});

test("rates survive a GPU counter rollover and bounded history keeps its baseline", () => {
  const history = [];
  appendEventSample(
    history,
    { tick: 1, attacks: 4294967294, kills: 4294967295 },
    2,
  );
  appendEventSample(history, { tick: 3601, attacks: 3, kills: 1 }, 2);
  assert.equal(history[1].attacksRate, 5);
  assert.equal(history[1].killsRate, 2);
  appendEventSample(history, { tick: 7201, attacks: 4, kills: 1 }, 2);
  assert.equal(history.length, 2);
  assert.equal(history[1].attacksRate, 1);
  assert.equal(history[1].killsRate, 0);
});

test("capacity deaths are plotted independently from confirmed attack kills", () => {
  const history = [];
  appendEventSample(history, {
    tick: 0,
    attacks: 10,
    kills: 2,
    capacityDeaths: 100,
  });
  appendEventSample(history, {
    tick: 3600,
    attacks: 12,
    kills: 3,
    capacityDeaths: 125,
  });
  assert.equal(history[1].killsRate, 1);
  assert.equal(history[1].capacityDeathsRate, 25);
  assert.equal(history[1].capacityDeaths, 125);
});
