// Exact Float32 integer quanta leave 200 energy units of headroom for either
// ablative barrier damage accounting or a corpse's structural nutrient value.
export const MAX_ENERGY_CAPACITY = 3895;
export const MAX_STORAGE_CAPACITY = 3895;
export const MAX_FILL_SCALE = 256;

// Integrates dE/dInput=exp(-E/K). Scale zero explicitly selects linear fill.
// This reference uses doubles; GPU accounting floors credits with fractional
// carry and additionally respects the world's explicit upper pool limits.
export function energyFillGain(energy, input, scale) {
  if (
    ![energy, input, scale].every(Number.isFinite) ||
    energy < 0 ||
    input < 0 ||
    scale < 0 ||
    (scale > 0 && scale < 1) ||
    scale > MAX_FILL_SCALE
  )
    throw Error("Invalid energy fill values");
  if (scale === 0 || input === 0) return input;
  return Math.min(
    input,
    scale * Math.log1p((input / scale) * Math.exp(-energy / scale)),
  );
}
