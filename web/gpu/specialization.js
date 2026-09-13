export const ENERGY_PATHWAYS = [
  "Photosynthesis",
  "Scavenging",
  "Stored energy",
];
// Normalized Shannon entropy: zero for one source, one for an even mixture.
export function specializationSummary(history, strength = 0) {
  const total = history
    .slice(0, 3)
    .reduce((sum, value) => sum + Math.max(0, value), 0);
  const shares =
    total > 1e-12
      ? history.slice(0, 3).map((value) => Math.max(0, value) / total)
      : [1 / 3, 1 / 3, 1 / 3];
  const entropy = Math.max(
    0,
    Math.min(
      1,
      -shares.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0) /
        Math.log(3),
    ),
  );
  return {
    shares,
    entropy,
    efficiency: 1 - Math.max(0, Math.min(0.95, strength)) * entropy,
  };
}
