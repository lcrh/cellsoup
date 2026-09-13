import {
  MAX_ENERGY_CAPACITY,
  MAX_STORAGE_CAPACITY,
  MAX_FILL_SCALE,
} from "./energy-fill.js";
import { isCoreFunction } from "./core-language.js";
import { TREE_SCHEMA, treeRng } from "./trees.js";

// Leave room for a photosynthesizing cell to reach division energy. The chosen
// 0.7 sunlight and 0.5 surplus are tuning assumptions, not viability guarantees.
function photosynthesisHeadroom(settings) {
  if (!settings.solarEnabled) return settings;
  const threshold = settings.divisionCost + 2 * settings.minimumBirthEnergy;
  const requiredRate = () =>
    (settings.upkeep + settings.energyDecay * threshold + 0.5) /
    (0.7 *
      settings.photoEfficiency *
      Math.exp(-threshold / settings.energyFillScale));
  while (requiredRate() > 20 && settings.energyFillScale < MAX_FILL_SCALE)
    settings.energyFillScale = Math.min(
      MAX_FILL_SCALE,
      settings.energyFillScale + 20,
    );
  settings.solarRate = Math.min(
    20,
    Math.ceil(Math.max(settings.solarRate, requiredRate()) * 2) / 2,
  );
  return settings;
}
// Explore around the working ecology defaults, not the full (often lethal)
// ranges of the manual controls. Capacity and habitat size stay user-chosen.
export function randomWorldSettings({
  capacity = 32768,
  previousSeed,
  rng = Math.random,
} = {}) {
  if (!Number.isInteger(capacity) || capacity < 128 || capacity > 262144)
    throw Error("Invalid random-world capacity");
  let seed = Math.floor(rng() * 4294967296);
  if (seed === previousSeed) seed = (seed + 1) >>> 0;
  return worldSettingsForSeed(seed, { capacity });
}

// A shareable seed selects the whole feature palette and ecological setup.
// The caller chooses the habitat dimensions and population capacity separately.
export function worldSettingsForSeed(seed, { capacity = 32768 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw Error("Invalid world seed");
  if (!Number.isInteger(capacity) || capacity < 128 || capacity > 262144)
    throw Error("Invalid random-world capacity");
  const rng = treeRng(seed);
  const pick = (values) => values[Math.floor(rng() * values.length)];
  const range = (min, max, step = 1) =>
    Number(
      (
        min +
        Math.floor(rng() * (Math.round((max - min) / step) + 1)) * step
      ).toFixed(5),
    );
  const ambientTemperature = range(12, 28);
  const scale = Math.max(1, capacity / 32768);
  const masks = [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff];
  const solarEnabled = pick([0, 1, 1, 1, 1, 1, 1, 1]);
  for (const [id, fn] of TREE_SCHEMA.entries())
    if (!isCoreFunction(fn.name) && rng() < 0.18)
      masks[Math.floor(id / 32)] =
        (masks[Math.floor(id / 32)] & ~(1 << (id % 32))) >>> 0;
  return photosynthesisHeadroom({
    seed,
    functionMask0: masks[0],
    functionMask1: masks[1],
    functionMask2: masks[2],
    functionMask3: masks[3],
    initial: Math.floor(capacity * pick([1 / 32, 1 / 16, 1 / 8, 1 / 4])),
    archiveEnabled: pick([0, 1, 1, 1, 1, 1]),
    solarEnabled,
    // Keep numerical headroom generous; randomize the biologically relevant knees.
    energyCapacity: MAX_ENERGY_CAPACITY,
    storageCapacity: MAX_STORAGE_CAPACITY,
    energyFillScale: pick([40, 60, 80, 100, 140]),
    storageFillScale: pick([40, 60, 80, 120, 160, 240]),
    archiveAge: pick([30, 60, 90, 120]),
    archiveHarvest: pick([40, 80, 120, 180, 240]),
    archiveOffspring: pick([2, 4, 8, 12]),
    // Preserve both RNG draws and the rest of each seed's existing settings.
    // Founders still contain 1–6 random actions with no guaranteed primitive.
    generationDepth: pick([6, 6, 6, 6, 6]),
    founderActions: pick([6, 6, 6, 6, 6]),
    literalScale: pick([0.25, 0.5, 1, 2]),
    numericMutationScale: pick([0.5, 1, 1.5]),
    mutationOrdinary: pick([0.25, 0.5, 1]),
    motorImpulse: pick([3, 5, 7, 9]),
    resistCost: pick([0.05, 0.1, 0.2, 0.4, 0.8]),
    resistStrength: pick([40, 80, 120, 200, 320]),
    dragRetention: pick([0.88, 0.92, 0.94, 0.96, 0.98]),
    springStiffness: pick([12, 18, 24, 36, 48]),
    springRestDistance: pick([14, 18, 22, 26]),
    collisionStiffness: pick([30, 45, 55, 75]),
    collisionDistance: pick([8, 10, 12]),
    linkBarrierStiffness: pick([45, 60, 90, 120]),
    linkBarrierDamping: pick([2, 4, 5, 8]),
    linkBarrierWidth: pick([3, 4, 6, 8]),
    interactionRadius: pick([12, 18, 24]),
    linkRange: pick([18, 24, 30]),
    photoEfficiency: pick([0.5, 0.7, 0.85, 1]),
    scavengeEfficiency: pick([0.5, 0.7, 0.85, 1]),
    mobilizeEfficiency: pick([0.5, 0.7, 0.85, 1]),
    eatAmount: pick([1, 2, 3, 5]),
    attackAmountMax: pick([1, 2, 3, 5]),
    attackEfficiency: pick([2, 3, 5, 8, 12]),
    attackSpeedBonus: pick([0, 0, 0.01, 0.025, 0.05, 0.1]),
    shieldCapacity: pick([5, 10, 20, 40]),
    shieldBuildEfficiency: pick([0.5, 1, 2, 4]),
    shieldProtection: pick([0.5, 0.7, 0.9, 1]),
    mutationLocal: pick([0, 0.2, 0.5, 1]),
    mutationPoint: pick([0, 0.25, 0.5, 1]),
    mutationGuard: pick([0, 0.1, 0.5, 1]),
    mutationInsertion: pick([0, 0.25, 0.5, 1]),
    memoryBias: range(0, 1, 0.25),
    temporalWeight: pick([0, 0.25, 0.5, 1]),
    communicationWeight: pick([0.25, 0.5, 1]),
    activationWeight: pick([0.25, 0.5, 1]),
    neighborhoodWeight: pick([0.1, 0.25, 0.5, 1]),
    developmentWeight: pick([0, 0.1, 0.25, 0.5]),
    queryRadius: pick([48, 60, 80, 96]),
    queryBudget: pick([16, 32, 48]),
    loopYield: pick([0, 1, 1]),
    bodyShare: pick([0, 0.1, 0.25, 0.5]),
    bodyPreserveLinks: pick([0.5, 0.8, 1]),
    bodyMaxCells: pick([4, 8, 16]),
    bodyCaptureSeconds: pick([5, 10, 15]),
    linkedRelay: pick([0, 0, 0.25, 0.5, 0.75]),
    signalRetention: pick([0.9, 0.97, 0.99, 0.995]),
    specializationStrength: pick([0, 0.15, 0.3, 0.5, 0.65]),
    specializationTime: pick([15, 30, 60, 120]),
    rate: Math.min(capacity, Math.round(pick([4, 8, 12, 16]) * scale)),
    capacityRate: Math.min(
      capacity,
      64,
      Math.round((pick([0, 1, 2, 4, 8]) * capacity) / 32768),
    ),
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
    maximumAge: pick([0, 120, 300, 600, 1200, 2400]),
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
  });
}

export function describeWorld(s) {
  const features = [];
  features.push(
    s.solarEnabled === 0
      ? "sunless scavenger world"
      : s.cloudCover > 0.55
        ? "cloudy skies"
        : s.sunContrast > 2.5
          ? "rare bright patches"
          : "broad sunlight",
  );
  if (s.specializationStrength > 0)
    features.push(
      `${Math.round(s.specializationStrength * 100)}% specialization pressure`,
    );
  if (s.bodyShare > 0) features.push("body resampling");
  if (s.linkedRelay > 0) features.push("relayed broadcasts");
  if (s.temporalWeight > 0) features.push("memory filters");
  if (s.loopYield === 0) features.push("continuous computation");
  const enabled = TREE_SCHEMA.filter(
    (_, id) => (s["functionMask" + Math.floor(id / 32)] >>> (id % 32)) & 1,
  ).length;
  return `World ${s.seed.toLocaleString()} · ${features.join(" · ")} · ${enabled} primitives`;
}
