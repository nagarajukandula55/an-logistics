import { prisma } from "@/lib/prisma";
import { levelForMonthlyRevenue, selectCustomerCostSchedule } from "@/lib/nel-pricing";

export type IndicativeRate = { courierName: string; source: string; serviceCode: string; lane: string; minWeightKg: number; maxWeightKg: number; sourceRate: number; costPrice: number; defaultSellRate: number };

export async function getIndicativeRates(input: { businessModel: string; baseCity: string; pickupCity: string; monthlyVolume: number }): Promise<{ source: string; rates: IndicativeRate[] }> {
  const segment = input.businessModel === "ECOM" ? "ECOM" : "NON_ECOM";
  const office = await prisma.tenant.findFirst({ where: { type: "INTERNAL" }, select: { baseOfficeCity: true } });
  const schedule = selectCustomerCostSchedule({ customerSegment: segment, customerBaseLocation: input.baseCity, pickupLocation: input.pickupCity, baseLocation: office?.baseOfficeCity });
  const levelCode = schedule === "CPDP_NEL" ? levelForMonthlyRevenue(input.monthlyVolume) : null;
  const matrixType = schedule === "CPDP_NEL" ? "CPDP_ECOM" : schedule === "DOMESTIC_TS_BASE" ? "DOMESTIC_TS_BASE" : "MLB_REVERSE";
  const matrices = await prisma.courierCostRateMatrix.findMany({ where: { matrixType, isActive: true, ...(levelCode ? { levelCode } : {}) }, include: { courierPartner: { select: { name: true } }, rows: { where: { isActive: true }, orderBy: [{ minWeightKg: "asc" }, { lane: "asc" }], take: 24 } }, orderBy: { effectiveFrom: "desc" }, take: 20 });
  const rates = matrices.flatMap((matrix) => matrix.rows.map((row) => {
    const sourceRate = row.sourceCostPrice ?? row.costPrice;
    const adjustedCost = Math.round(sourceRate * (1 + matrix.costAdjustmentPercent / 100) * 100) / 100;
    return { courierName: matrix.courierPartner.name, source: matrixType === "CPDP_ECOM" ? `${levelCode} CPDP` : matrixType === "DOMESTIC_TS_BASE" ? "Domestic TS +55%" : "MLB blue table +55%", serviceCode: matrix.serviceCode, lane: row.lane, minWeightKg: row.minWeightKg, maxWeightKg: row.maxWeightKg, sourceRate, costPrice: adjustedCost, defaultSellRate: Math.round(adjustedCost * 2 * 100) / 100 };
  }));
  return { source: matrixType === "CPDP_ECOM" ? `${levelCode} CPDP ECOM` : matrixType === "DOMESTIC_TS_BASE" ? "Domestic TS +55%" : "MLB blue table +55%", rates };
}
