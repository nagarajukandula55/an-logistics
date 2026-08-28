/**
 * Coarse, deterministic zone heuristic based on Indian PIN code prefixes:
 * same first 3 digits (same sub-district/local delivery zone) => "LOCAL",
 * same first 2 digits only (same postal circle/state region) => "REGIONAL",
 * otherwise => "NATIONAL". This is a deliberate real choice — a simple,
 * well-understood approximation used across common Indian logistics
 * zoning — not a placeholder. Real partners may plug in their own zone
 * logic later via the provider adapter (see src/lib/courier-providers).
 */
export function determineZone(pickupPincode: string, deliveryPincode: string): string {
  const pickup = (pickupPincode ?? "").trim();
  const delivery = (deliveryPincode ?? "").trim();

  if (pickup.length >= 3 && delivery.length >= 3 && pickup.slice(0, 3) === delivery.slice(0, 3)) {
    return "LOCAL";
  }
  if (pickup.length >= 2 && delivery.length >= 2 && pickup.slice(0, 2) === delivery.slice(0, 2)) {
    return "REGIONAL";
  }
  return "NATIONAL";
}
