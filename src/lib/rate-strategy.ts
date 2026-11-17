export type PricingStrategyRule = {
  volumeMinMonthly: number | null;
  volumeMaxMonthly: number | null;
  markupPercent: number;
  minimumMarginPercent: number | null;
  handlingFee: number;
  roundingUnit: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type StrategicSellRate = {
  costPrice: number;
  markupAmount: number;
  handlingFee: number;
  minimumMarginAmount: number;
  sellPrice: number;
  marginPercent: number;
};

export const DEFAULT_STAFF_COLLABORATOR_COST_MULTIPLIER = 2;
export const DEFAULT_STAFF_COLLABORATOR_MARKUP_PERCENT = 100;

/**
 * Chooses the most specific active strategy for the customer's monthly volume.
 * A null lower/upper bound means open-ended. Ties are resolved by the latest
 * effective rule so a future rule can be staged without editing history.
 */
export function selectPricingStrategy<T extends PricingStrategyRule>(strategies: T[], monthlyVolume: number, at = new Date()): T | null {
  return strategies
    .filter((rule) =>
      rule.effectiveFrom <= at &&
      (!rule.effectiveTo || rule.effectiveTo >= at) &&
      (rule.volumeMinMonthly === null || monthlyVolume >= rule.volumeMinMonthly) &&
      (rule.volumeMaxMonthly === null || monthlyVolume <= rule.volumeMaxMonthly)
    )
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
}

/**
 * Calculates a sell price from the courier cost. Markup is applied first; the
 * minimum-margin floor then protects AN Logistics from accidental low quotes.
 */
export function calculateStrategicSellRate(costPrice: number, strategy: PricingStrategyRule): StrategicSellRate {
  if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error("Cost price must be a non-negative number");
  const markupAmount = costPrice * (strategy.markupPercent / 100);
  const handlingFee = Math.max(0, strategy.handlingFee || 0);
  const markedUp = costPrice + markupAmount + handlingFee;
  const minimumMarginAmount = strategy.minimumMarginPercent === null || strategy.minimumMarginPercent === undefined
    ? 0
    : costPrice / Math.max(0.0001, 1 - strategy.minimumMarginPercent / 100);
  const roundingUnit = Math.max(0.01, strategy.roundingUnit || 1);
  const sellPrice = Math.ceil(Math.max(markedUp, minimumMarginAmount) / roundingUnit) * roundingUnit;
  const marginPercent = sellPrice === 0 ? 0 : ((sellPrice - costPrice) / sellPrice) * 100;
  return { costPrice, markupAmount, handlingFee, minimumMarginAmount, sellPrice, marginPercent };
}
