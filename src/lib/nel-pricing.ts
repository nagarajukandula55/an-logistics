export const NEL_LEVELS = ["NEL0", "NEL1", "NEL2", "NEL3", "NEL4", "NEL5", "NEL6"] as const;
export type NelLevel = (typeof NEL_LEVELS)[number];

export const NEL_REVENUE_BANDS: Record<NelLevel, { min: number; max: number | null }> = {
  NEL0: { min: 0, max: 5000 },
  NEL1: { min: 5001, max: 15000 },
  NEL2: { min: 15001, max: 50000 },
  NEL3: { min: 50001, max: 75000 },
  NEL4: { min: 75001, max: 100000 },
  NEL5: { min: 100001, max: 150000 },
  NEL6: { min: 150001, max: null },
};

export function levelForMonthlyRevenue(revenue: number): NelLevel {
  const value = Math.max(0, revenue);
  return [...NEL_LEVELS].reverse().find((level) => value >= NEL_REVENUE_BANDS[level].min) ?? "NEL0";
}

/**
 * The source CPDP rule keeps the initial NEL for the code-creation month and
 * the following two months. The next month is the first month in which the
 * completed revenue period may qualify a new NEL level.
 */
export function initialNelLockUntil(codeCreatedAt: Date): Date {
  const lockUntil = new Date(codeCreatedAt);
  lockUntil.setUTCMonth(lockUntil.getUTCMonth() + 3);
  lockUntil.setUTCDate(1);
  return lockUntil;
}

export function shouldUseInitialNel(codeCreatedAt: Date, appliedForMonth: Date): boolean {
  return appliedForMonth < initialNelLockUntil(codeCreatedAt);
}

export function adjustedNonEcomCost(sourceRate: number, adjustmentPercent = 55): number {
  return Math.round(sourceRate * (1 + adjustmentPercent / 100) * 100) / 100;
}

/** Backward-compatible name for callers that specifically handle MLB rows. */
export const mlbAdjustedCost = adjustedNonEcomCost;

export function isBaseLocationMatch(pickupLocation: string | null | undefined, baseLocation: string | null | undefined): boolean {
  if (!pickupLocation || !baseLocation) return false;
  return pickupLocation.trim().toLocaleLowerCase() === baseLocation.trim().toLocaleLowerCase();
}

export function selectCustomerCostSchedule({
  customerSegment,
  pickupLocation,
  customerBaseLocation,
  baseLocation,
}: {
  customerSegment: "ECOM" | "NON_ECOM";
  pickupLocation?: string | null;
  customerBaseLocation?: string | null;
  baseLocation?: string | null;
}): "CPDP_NEL" | "DOMESTIC_TS_BASE" | "MLB" {
  if (customerSegment === "ECOM") return "CPDP_NEL";
  if (isBaseLocationMatch(pickupLocation, baseLocation) || isBaseLocationMatch(customerBaseLocation, baseLocation)) return "DOMESTIC_TS_BASE";
  return "MLB";
}
