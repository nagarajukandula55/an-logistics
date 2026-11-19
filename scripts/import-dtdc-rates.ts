import { readFile } from "node:fs/promises";
import { Prisma, PrismaClient } from "@prisma/client";

type RateRow = {
  lane: string;
  minWeightKg: number;
  maxWeightKg: number;
  weightBasis: string;
  sourceCostPrice: number;
  sourceRow?: string;
  metadata?: Record<string, unknown>;
};

type Matrix = {
  idKey: string;
  name: string;
  matrixType: string;
  serviceCode: string;
  levelCode: string | null;
  customerSegment: string;
  sourceFile: string;
  sourceSheet: string;
  effectiveFrom: string;
  costAdjustmentPercent: number;
  gstPercent: number;
  rows: RateRow[];
  requiresBaseLocation?: boolean;
  includesFuelSurcharge?: boolean;
  includesBookCost?: boolean;
  fuelSurchargePercent?: number;
  pickupChargePerKg?: number;
  pickupMinimumCharge?: number;
  codFixedCharge?: number;
  codPercent?: number;
  rtoPercent?: number;
};

const prisma = new PrismaClient();
const DATA_PATH = new URL("../prisma/rate-data/dtdc-rates.json", import.meta.url);

function id(value: string) {
  return `dtdc-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

async function main() {
  const payload = JSON.parse(await readFile(DATA_PATH, "utf8")) as { matrices: Matrix[] };
  const dtdc = await prisma.courierPartner.findFirst({ where: { OR: [{ name: { contains: "DTDC", mode: "insensitive" } }, { legalName: { contains: "DTDC", mode: "insensitive" } }] } });
  const courier = dtdc ?? await prisma.courierPartner.create({ data: { name: "DTDC", legalName: "DTDC Express Limited", contactName: "DTDC Operations", contactPhone: "", status: "ACTIVE", integrationType: "MANUAL", commissionType: "PERCENT", commissionValue: 0 } });

  const importedMatrixIds = new Set(payload.matrices.map((source) => id(source.idKey)));
  const oldMlbMatrices = await prisma.courierCostRateMatrix.findMany({
    where: { courierPartnerId: courier.id, matrixType: "MLB_REVERSE", isActive: true },
    select: { id: true },
  });
  const obsoleteMlbIds = oldMlbMatrices.map((matrix) => matrix.id).filter((matrixId) => !importedMatrixIds.has(matrixId));
  if (obsoleteMlbIds.length > 0) {
    await prisma.courierCostRateMatrix.updateMany({
      where: { id: { in: obsoleteMlbIds } },
      data: { isActive: false, notes: "Superseded by corrected MLB workbook normalization; retained for audit." },
    });
  }

  let rowCount = 0;
  for (const source of payload.matrices) {
    const matrixId = id(source.idKey);
    await prisma.courierCostRateMatrix.upsert({
      where: { id: matrixId },
      create: {
        id: matrixId,
        courierPartnerId: courier.id,
        name: source.name,
        matrixType: source.matrixType,
        serviceCode: source.serviceCode,
        levelCode: source.levelCode,
        customerSegment: source.customerSegment,
        requiresBaseLocation: source.requiresBaseLocation ?? false,
        sourceFile: source.sourceFile,
        sourceSheet: source.sourceSheet,
        effectiveFrom: new Date(source.effectiveFrom),
        gstPercent: source.gstPercent,
        fuelSurchargePercent: source.fuelSurchargePercent,
        includesFuelSurcharge: source.includesFuelSurcharge ?? false,
        includesBookCost: source.includesBookCost ?? false,
        costAdjustmentPercent: source.costAdjustmentPercent,
        pickupChargePerKg: source.pickupChargePerKg,
        pickupMinimumCharge: source.pickupMinimumCharge,
        codFixedCharge: source.codFixedCharge,
        codPercent: source.codPercent,
        rtoPercent: source.rtoPercent,
        notes: "Imported from supplied DTDC workbook. Domestic TS and MLB use the agreed +55% cost adjustment; CPDP remains unchanged.",
      },
      update: {
        courierPartnerId: courier.id,
        name: source.name,
        matrixType: source.matrixType,
        serviceCode: source.serviceCode,
        levelCode: source.levelCode,
        customerSegment: source.customerSegment,
        requiresBaseLocation: source.requiresBaseLocation ?? false,
        sourceFile: source.sourceFile,
        sourceSheet: source.sourceSheet,
        effectiveFrom: new Date(source.effectiveFrom),
        gstPercent: source.gstPercent,
        fuelSurchargePercent: source.fuelSurchargePercent,
        includesFuelSurcharge: source.includesFuelSurcharge ?? false,
        includesBookCost: source.includesBookCost ?? false,
        costAdjustmentPercent: source.costAdjustmentPercent,
        pickupChargePerKg: source.pickupChargePerKg,
        pickupMinimumCharge: source.pickupMinimumCharge,
        codFixedCharge: source.codFixedCharge,
        codPercent: source.codPercent,
        rtoPercent: source.rtoPercent,
        notes: "Imported from supplied DTDC workbook. Domestic TS and MLB use the agreed +55% cost adjustment; CPDP remains unchanged.",
      },
    });
    for (let index = 0; index < source.rows.length; index += 1) {
      const row = source.rows[index];
      const rowId = `${matrixId}-row-${index}`;
      const adjusted = rounded(row.sourceCostPrice * (1 + source.costAdjustmentPercent / 100));
      await prisma.courierCostRateRow.upsert({
        where: { id: rowId },
        create: { id: rowId, matrixId, lane: row.lane, minWeightKg: row.minWeightKg, maxWeightKg: row.maxWeightKg, weightBasis: row.weightBasis, costPrice: adjusted, sourceCostPrice: row.sourceCostPrice, sourceRow: row.sourceRow, metadata: row.metadata as Prisma.InputJsonValue },
        update: { matrixId, lane: row.lane, minWeightKg: row.minWeightKg, maxWeightKg: row.maxWeightKg, weightBasis: row.weightBasis, costPrice: adjusted, sourceCostPrice: row.sourceCostPrice, sourceRow: row.sourceRow, metadata: row.metadata as Prisma.InputJsonValue, isActive: true },
      });
      rowCount += 1;
    }
  }

  for (const audience of ["STAFF", "COLLABORATOR"] as const) {
    await prisma.sellPricingStrategy.upsert({
      where: { id: id(`strategy-${audience}`) },
      create: { id: id(`strategy-${audience}`), courierPartnerId: courier.id, audience, name: `DTDC ${audience} - 2x cost price`, markupPercent: 100, handlingFee: 0, roundingUnit: 1, effectiveFrom: new Date("2026-01-01"), notes: "Selling price is 2x the applicable adjusted DTDC cost price." },
      update: { courierPartnerId: courier.id, audience, name: `DTDC ${audience} - 2x cost price`, markupPercent: 100, handlingFee: 0, roundingUnit: 1, effectiveFrom: new Date("2026-01-01"), notes: "Selling price is 2x the applicable adjusted DTDC cost price.", isActive: true },
    });

    // SellRateCard is intentionally service-agnostic in the existing booking
    // flow. Build one consolidated card from the highest 2x adjusted price
    // for each lane/weight slab across every imported DTDC service. This keeps
    // the current lookup deterministic while ensuring CPDP, Domestic TS and
    // MLB never produce an underpriced booking.
    const baseline = new Map<string, { zone: string; minWeightKg: number; maxWeightKg: number; price: number }>();
    for (const source of payload.matrices) {
      for (const row of source.rows) {
        const key = `${row.lane}|${row.minWeightKg}|${row.maxWeightKg}`;
        const current = baseline.get(key);
        const adjustedCost = row.sourceCostPrice * (1 + source.costAdjustmentPercent / 100);
        const price = rounded(adjustedCost * 2);
        if (!current || price > current.price) baseline.set(key, { zone: row.lane, minWeightKg: row.minWeightKg, maxWeightKg: row.maxWeightKg, price });
      }
    }
    const cardId = id(`sell-${audience}-dtdc-nel0-2x`);
    await prisma.sellRateCard.upsert({
      where: { id: cardId },
      create: {
        id: cardId,
        audience,
        courierPartnerId: courier.id,
        name: `DTDC ${audience} all services - 2x adjusted cost`,
        isActive: true,
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedBy: "DTDC source import",
        effectiveFrom: new Date("2026-01-01"),
        pricingStrategyId: id(`strategy-${audience}`),
        slabs: { create: [...baseline.values()] },
      },
      update: {
        courierPartnerId: courier.id,
        name: `DTDC ${audience} all services - 2x adjusted cost`,
        isActive: true,
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedBy: "DTDC source import",
        effectiveFrom: new Date("2026-01-01"),
        pricingStrategyId: id(`strategy-${audience}`),
        slabs: { deleteMany: {}, create: [...baseline.values()] },
      },
    });
  }

  console.log(`Imported ${payload.matrices.length} DTDC matrices and ${rowCount} rows for ${courier.name}.`);
  console.log("Domestic TS and MLB rows include +55% adjusted cost; CPDP rows remain unchanged.");
  console.log("Staff and collaborator strategies are configured at 100% markup (2x cost).");
  console.log("Staff and collaborator consolidated sell cards were generated at 2x adjusted cost across CPDP, Domestic TS and MLB.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
