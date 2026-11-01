/** The standard domestic courier divisor: cm³ per kg. */
export const DEFAULT_VOLUMETRIC_DIVISOR = 5000;

export type VolumetricWeightInput = {
  actualWeightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  divisor?: number;
};

export function calculateVolumetricWeight({
  actualWeightKg,
  lengthCm,
  widthCm,
  heightCm,
  divisor = DEFAULT_VOLUMETRIC_DIVISOR,
}: VolumetricWeightInput) {
  const hasDimensions = [lengthCm, widthCm, heightCm].every((value) => typeof value === "number" && value > 0);
  const volumetricWeightKg = hasDimensions
    ? Number(((lengthCm! * widthCm! * heightCm!) / divisor).toFixed(3))
    : 0;
  const chargeableWeightKg = Number(Math.max(actualWeightKg, volumetricWeightKg).toFixed(3));

  return {
    volumetricWeightKg,
    chargeableWeightKg,
    divisor,
    hasDimensions,
  };
}
