// Cumulative usable-energy flow categories, each stored as a u64 pair of
// integer quanta on the GPU. Pool transfers are included on the appropriate
// side of the usable-energy budget, not labeled as energy destruction.
// Movement includes turning, contraction and resistance; shields includes
// construction and upkeep; communication includes linking and signals.
// Upkeep includes basal loss, energy decay, overheating and the eating fee.
// Intake credits are after conversion/fill losses. Gifts/storage are transfers.
// Arrivals includes host/GPU seeding; turnover includes senescence/replacement.
export const ENERGY_BUDGET_KEYS = Object.freeze([
  "photosynthesis",
  "scavenging",
  "mobilized",
  "giftsReceived",
  "movement",
  "shields",
  "attacks",
  "reproduction",
  "storage",
  "upkeep",
  "computation",
  "communication",
  "giftsSent",
  "attackDamage",
  "arrivals",
  "turnover",
  "populationPressure",
]);
export const ENERGY_BUDGET_BYTES = ENERGY_BUDGET_KEYS.length * 8;
export function decodeEnergyBudget(words) {
  return Object.fromEntries(
    ENERGY_BUDGET_KEYS.map((key, i) => [
      key,
      (words[i * 2] + words[i * 2 + 1] * 4294967296) / 4096,
    ]),
  );
}
export function addEnergyBudgetQuanta(words, key, quanta) {
  const index = ENERGY_BUDGET_KEYS.indexOf(key) * 2;
  if (index < 0 || !Number.isSafeInteger(quanta) || quanta < 0)
    throw Error("Invalid energy ledger increment");
  const total =
    BigInt(words[index]) + (BigInt(words[index + 1]) << 32n) + BigInt(quanta);
  words[index] = Number(total & 0xffffffffn);
  words[index + 1] = Number((total >> 32n) & 0xffffffffn);
}
