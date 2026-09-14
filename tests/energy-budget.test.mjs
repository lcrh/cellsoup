import test from "node:test";
import assert from "node:assert/strict";
import {
  ENERGY_INPUTS,
  ENERGY_OUTPUTS,
  budgetSnapshot,
  budgetLegend,
  energyBudgetSeries,
} from "../web/gpu/energy-budget.js";
import {
  ENERGY_BUDGET_KEYS,
  ENERGY_BUDGET_BYTES,
  addEnergyBudgetQuanta,
  decodeEnergyBudget,
} from "../web/gpu/energy-ledger.js";
import { appendEventSample } from "../web/gpu/event-history.js";

test("energy plots cover every ledger flow exactly once, with transfers on the appropriate side", () => {
  const keys = [...ENERGY_INPUTS, ...ENERGY_OUTPUTS].map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys.sort(), [...ENERGY_BUDGET_KEYS].sort());
  assert.ok(ENERGY_INPUTS.some((c) => c.key === "mobilized"));
  assert.ok(ENERGY_OUTPUTS.some((c) => c.key === "storage"));
});

test("energy rates use simulated minutes, retain large cumulative counters, and agree with legends", () => {
  const history = [];
  const base = { living: 100, attacks: 0, kills: 0 };
  appendEventSample(history, {
    ...base,
    tick: 600,
    energyBudget: { photosynthesis: 5e9, shields: 10 },
  });
  assert.equal(history[0].energyRates, null);
  appendEventSample(history, {
    ...base,
    tick: 2400,
    energyBudget: { photosynthesis: 5e9 + 15, shields: 14 },
  });
  assert.equal(history[1].energyRates.photosynthesis, 30);
  assert.equal(history[1].energyRates.shields, 8);
  assert.equal(budgetLegend(history[1], ENERGY_INPUTS).total, 30);
  assert.equal(budgetLegend(history[1], ENERGY_OUTPUTS).total, 8);
  assert.equal(
    budgetLegend(history[1], ENERGY_INPUTS, "total").total,
    5e9 + 15,
  );
  const series = energyBudgetSeries(history, ENERGY_OUTPUTS);
  assert.equal(series.samples.length, 1);
  assert.equal(series.samples[0].start, 600);
  assert.equal(series.samples[0].end, 2400);
  assert.equal(series.maxTotal, 8);
});

test("absent or reset energy counters create a gap rather than inventing zero or negative intake", () => {
  assert.equal(budgetSnapshot(null, { tick: 1 }).energyBudget, null);
  assert.equal(budgetLegend(undefined, ENERGY_INPUTS).total, null);
  const previous = { tick: 100, energyBudget: { photosynthesis: 10 } };
  for (const counters of [
    { tick: 100, energyBudget: { photosynthesis: 10 } },
    { tick: 50, energyBudget: { photosynthesis: 10 } },
    { tick: 200, energyBudget: { photosynthesis: 9 } },
    { tick: 200, energyBudget: { photosynthesis: NaN } },
  ])
    assert.equal(budgetSnapshot(previous, counters).energyRates, null);
});

test("no activity gives a real zero rate and world resets discard preceding energy samples", () => {
  const history = [];
  const base = {
    tick: 10,
    living: 1,
    attacks: 0,
    kills: 0,
    energyBudget: { arrivals: 50 },
  };
  appendEventSample(history, base);
  appendEventSample(history, { ...base, tick: 3610 });
  assert.equal(budgetLegend(history[1], ENERGY_INPUTS).total, 0);
  appendEventSample(history, { ...base, tick: 1 });
  assert.equal(history.length, 1);
  assert.equal(history[0].energyRates, null);
});

test("long-running energy totals preserve the low-word carry and independent categories", () => {
  const words = new Uint32Array(ENERGY_BUDGET_BYTES / 4);
  addEnergyBudgetQuanta(words, "shields", 4294967295);
  addEnergyBudgetQuanta(words, "shields", 8193);
  addEnergyBudgetQuanta(words, "photosynthesis", 4096);
  const result = decodeEnergyBudget(words);
  assert.equal(result.shields, 1048578);
  assert.equal(result.photosynthesis, 1);
  assert.equal(result.attacks, 0);
});

test("retained rate bands cover the same time window and integrate to observed energy", () => {
  const history = [];
  for (const [tick, photosynthesis] of [
    [0, 0],
    [120, 10],
    [360, 40],
    [960, 50],
  ])
    appendEventSample(
      history,
      { tick, attacks: 0, kills: 0, energyBudget: { photosynthesis } },
      3,
    );
  const series = energyBudgetSeries(history, ENERGY_INPUTS);
  assert.equal(series.firstTick, 120);
  assert.equal(series.lastTick, 960);
  assert.equal(
    series.samples.reduce(
      (sum, p) => sum + (p.total * (p.end - p.start)) / 3600,
      0,
    ),
    40,
  );
});
