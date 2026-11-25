import { prisma } from "@/lib/prisma";
import { selectCustomerCostSchedule } from "@/lib/nel-pricing";

export type IndicativeRate = { category: string; categoryLabel: string; courierName: string; source: string; serviceCode: string; lane: string; minWeightKg: number; maxWeightKg: number; sourceRate: number; costPrice: number; defaultSellRate: number };

export async function getIndicativeRates(input: { businessModel: string; baseCity: string; pickupCity: string; basePincode?: string; pickupPincode?: string; monthlyVolume: number }): Promise<{ source: string; rates: IndicativeRate[] }> {
  const requested = input.businessModel.split(",").map((item) => item.trim()).filter(Boolean);
  if (requested.length > 1) {
    const previews = await Promise.all(requested.map((category) => getIndicativeRates({ ...input, businessModel: category })));
    const rates = previews.flatMap((preview) => preview.rates);
    return { source: previews.map((preview) => preview.source).join(" + "), rates };
  }
  const category = input.businessModel === "B2B" ? "ECOM_B2B" : input.businessModel === "B2C" ? "ECOM_B2C" : input.businessModel;
  const segment = category === "ECOM_B2B" ? "ECOM" : "NON_ECOM";
  const officeWithPincode = await prisma.tenant.findFirst({ where: { type: "INTERNAL" }, select: { baseOfficeCity: true, baseOfficePincode: true } });
  const schedule = selectCustomerCostSchedule({ customerSegment: segment, customerBaseLocation: input.baseCity, customerBasePincode: input.basePincode, pickupLocation: input.pickupCity, pickupPincode: input.pickupPincode, baseLocation: officeWithPincode?.baseOfficeCity, basePincode: officeWithPincode?.baseOfficePincode });
  const levelCode = category === "ECOM_B2B" ? "NEL0" : null;
  const matrixType = category === "ECOM_B2B" ? "CPDP_ECOM" : category === "ECOM_B2C" ? "MLB_REVERSE" : schedule === "DOMESTIC_TS_BASE" ? "DOMESTIC_TS_BASE" : "MLB_REVERSE";
  const matrices = await prisma.courierCostRateMatrix.findMany({ where: { matrixType, isActive: true, ...(levelCode ? { levelCode } : {}), ...(["ECOM_B2C", "MLB_B2C"].includes(category) ? { customerSegment: { in: ["B2C_ECOM_DTDC", "B2C_ECOM_INDIA_POST"] } } : {}), ...(category === "MLB_B2B" ? { customerSegment: { notIn: ["B2C_ECOM_DTDC", "B2C_ECOM_INDIA_POST"] } } : {}), ...(category.startsWith("BIZ_") && schedule === "DOMESTIC_TS_BASE" ? { customerSegment: { in: ["BRANCH", "INDIA_POST"] }, serviceCode: { in: ["EXPRESS", "AIR_CARGO", "SURFACE_CARGO"] } } : {}) }, include: { courierPartner: { select: { name: true } }, rows: { where: { isActive: true }, orderBy: [{ minWeightKg: "asc" }, { lane: "asc" }], take: 24 } }, orderBy: { effectiveFrom: "desc" }, take: 40 });
  const categoryLabels: Record<string, string> = { ECOM_B2B: "E-commerce B2B", ECOM_B2C: "E-commerce B2C", MLB_B2B: "MLB B2B", MLB_B2C: "MLB B2C", BIZ_B2B: "Branch B2B", BIZ_B2C: "Branch B2C" };
  const rates = matrices.flatMap((matrix) => matrix.rows.map((row) => {
    const sourceRate = row.sourceCostPrice ?? row.costPrice;
    const adjustedCost = Math.round(sourceRate * (1 + matrix.costAdjustmentPercent / 100) * 100) / 100;
    return { category, categoryLabel: categoryLabels[category] ?? category, courierName: matrix.courierPartner.name, source: matrixType === "CPDP_ECOM" ? `${levelCode} CPDP` : matrixType === "DOMESTIC_TS_BASE" ? "Domestic TS +55%" : "MLB blue table +55%", serviceCode: matrix.serviceCode, lane: row.lane, minWeightKg: row.minWeightKg, maxWeightKg: row.maxWeightKg, sourceRate, costPrice: adjustedCost, defaultSellRate: Math.round(adjustedCost * 2 * 100) / 100 };
  }));
  const locationSchedule = schedule === "DOMESTIC_TS_BASE" ? "Branch" : "MLB";
  return { source: categoryLabels[category] ? `${categoryLabels[category]}${category.startsWith("BIZ_") ? ` - ${locationSchedule}` : ""}` : `${category} - ${locationSchedule}`, rates };
}
