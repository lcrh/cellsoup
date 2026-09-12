// Explore around the working ecology defaults, not the full (often lethal)
// ranges of the manual controls. Capacity and genome language stay user-chosen.
export function randomWorldSettings({
  capacity = 32768,
  previousSeed,
  rng = Math.random,
} = {}) {
  if (!Number.isInteger(capacity) || capacity < 128 || capacity > 262144)
    throw Error("Invalid random-world capacity");
  const pick = (values) => values[Math.floor(rng() * values.length)];
  const range = (min, max, step = 1) =>
    Number(
      (
        min +
        Math.floor(rng() * (Math.round((max - min) / step) + 1)) * step
      ).toFixed(5),
    );
  let seed = Math.floor(rng() * 4294967296);
  if (seed === previousSeed) seed = (seed + 1) >>> 0;
  const ambientTemperature = range(12, 28);
  const scale = Math.max(1, capacity / 32768);
  return {
    seed,
    rate: Math.min(capacity, Math.round(pick([4, 8, 12, 16]) * scale)),
    floor: Math.min(
      Math.floor(capacity / 16),
      Math.round(pick([128, 256, 512, 1024]) * scale),
    ),
    share: range(0.25, 0.75, 0.05),
    mutation: range(0.5, 0.95, 0.05),
    forkMutation: pick([0, 0.005, 0.01, 0.02, 0.03, 0.05]),
    crossover: range(0.1, 0.5, 0.05),
    solarRate: range(3, 6, 0.5),
    sunContrast: range(1.25, 3.5, 0.25),
    cloudCover: range(0.25, 0.7, 0.05),
    cloudOpacity: range(0.65, 0.95, 0.05),
    cloudScale: range(600, 2000, 100),
    cloudSpeed: range(4, 28),
    cloudMorph: range(90, 420, 30),
    seedEnergy: range(20, 40),
    seedStorage: range(12, 48),
    upkeep: range(0.25, 0.75, 0.05),
    energyDecay: range(0.03, 0.07, 0.01),
    exchange: range(0.04, 0.2, 0.01),
    corpseLifetime: range(600, 1800, 60),
    corpseEnergy: range(6, 16),
    ambientTemperature,
    sunlightHeating: range(0.6, 1.4, 0.1),
    activityHeating: range(0.06, 0.2, 0.01),
    cooling: range(0.15, 0.35, 0.01),
    thermalExchange: range(0.04, 0.2, 0.01),
    crowdInsulation: range(0.5, 2, 0.1),
    safeTemperature: ambientTemperature + range(8, 16),
    heatDamage: range(0.2, 0.8, 0.1),
    cpuCost: range(0.00002, 0.0001, 0.00001),
    budget: pick([16, 24, 32, 48]),
    divisionCost: range(8, 20),
    minimumBirthEnergy: range(8, 18),
    jitter: range(4, 30),
    moveCost: range(0.002, 0.008, 0.001),
    turnCost: range(0.0001, 0.0003, 0.0001),
    attackCost: range(0.04, 0.14, 0.01),
    attackDamageCost: range(0.1, 0.35, 0.05),
    eatCost: range(0.02, 0.08, 0.01),
    linkCost: range(0.2, 1, 0.1),
    contractCost: range(0.04, 0.16, 0.01),
    shieldUpkeep: range(0.36, 1.08, 0.01),
    sendCost: range(0.01, 0.03, 0.01),
    emitCost: range(0.01, 0.03, 0.01),
  };
}
