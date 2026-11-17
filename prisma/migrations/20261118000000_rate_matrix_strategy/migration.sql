-- DTDC cost matrices, effective-dated source rows, and customer sell strategies.
ALTER TABLE "SellRateCard"
  ADD COLUMN "costMatrixId" TEXT,
  ADD COLUMN "pricingStrategyId" TEXT;

ALTER TABLE "Tenant"
  ADD COLUMN "baseOfficeCity" TEXT,
  ADD COLUMN "baseOfficePincode" TEXT;

ALTER TABLE "Customer"
  ADD COLUMN "businessModel" TEXT,
  ADD COLUMN "baseCity" TEXT,
  ADD COLUMN "basePincode" TEXT;

ALTER TABLE "PartnerApplication"
  ADD COLUMN "businessModel" TEXT,
  ADD COLUMN "baseCity" TEXT,
  ADD COLUMN "basePincode" TEXT,
  ADD COLUMN "pickupCity" TEXT;

CREATE TABLE "TatMatrix" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceFile" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TatMatrix_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TatRateRow" (
  "id" TEXT NOT NULL,
  "matrixId" TEXT NOT NULL,
  "originPincode" TEXT,
  "destinationPincode" TEXT NOT NULL,
  "originCity" TEXT,
  "destinationCity" TEXT,
  "serviceCode" TEXT,
  "tatDays" INTEGER NOT NULL,
  "workingDays" BOOLEAN NOT NULL DEFAULT true,
  "cutoffTime" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  CONSTRAINT "TatRateRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TatRateRow"
  ADD CONSTRAINT "TatRateRow_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "TatMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TatMatrix_isActive_effectiveFrom_idx" ON "TatMatrix"("isActive", "effectiveFrom");
CREATE INDEX "TatRateRow_destinationPincode_originPincode_serviceCode_idx" ON "TatRateRow"("destinationPincode", "originPincode", "serviceCode");
CREATE INDEX "TatRateRow_matrixId_idx" ON "TatRateRow"("matrixId");

CREATE TABLE "CourierCostRateMatrix" (
  "id" TEXT NOT NULL,
  "courierPartnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "matrixType" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "levelCode" TEXT,
  "customerSegment" TEXT NOT NULL DEFAULT 'ALL',
  "requiresBaseLocation" BOOLEAN NOT NULL DEFAULT false,
  "baseLocationCode" TEXT,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
  "fuelSurchargePercent" DOUBLE PRECISION,
  "includesFuelSurcharge" BOOLEAN NOT NULL DEFAULT false,
  "includesBookCost" BOOLEAN NOT NULL DEFAULT false,
  "costAdjustmentPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourierCostRateMatrix_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CourierCostRateMatrix"
  ADD COLUMN "bookCost" DOUBLE PRECISION,
  ADD COLUMN "pickupChargePerKg" DOUBLE PRECISION,
  ADD COLUMN "pickupMinimumCharge" DOUBLE PRECISION,
  ADD COLUMN "rtoPercent" DOUBLE PRECISION,
  ADD COLUMN "codFixedCharge" DOUBLE PRECISION,
  ADD COLUMN "codPercent" DOUBLE PRECISION,
  ADD COLUMN "insurancePercent" DOUBLE PRECISION;

CREATE TABLE "CourierCostRateRow" (
  "id" TEXT NOT NULL,
  "matrixId" TEXT NOT NULL,
  "lane" TEXT NOT NULL,
  "minWeightKg" DOUBLE PRECISION NOT NULL,
  "maxWeightKg" DOUBLE PRECISION NOT NULL,
  "weightBasis" TEXT NOT NULL,
  "costPrice" DOUBLE PRECISION NOT NULL,
  "surchargePercent" DOUBLE PRECISION,
  "fixedCharge" DOUBLE PRECISION,
  "sourceRow" TEXT,
  "metadata" JSONB,
  "sourceCostPrice" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "CourierCostRateRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellPricingStrategy" (
  "id" TEXT NOT NULL,
  "courierPartnerId" TEXT NOT NULL,
  "audience" "SellRateCardAudience" NOT NULL DEFAULT 'DEFAULT',
  "tenantId" TEXT,
  "customerId" TEXT,
  "name" TEXT NOT NULL,
  "volumeMinMonthly" DOUBLE PRECISION,
  "volumeMaxMonthly" DOUBLE PRECISION,
  "markupPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "minimumMarginPercent" DOUBLE PRECISION,
  "handlingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roundingUnit" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellPricingStrategy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerCourierNelAssignment" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "courierPartnerId" TEXT NOT NULL,
  "levelCode" TEXT NOT NULL,
  "assignedFrom" TIMESTAMP(3) NOT NULL,
  "assignedTo" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerCourierNelAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerCourierRevenueMonth" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "courierPartnerId" TEXT NOT NULL,
  "monthStart" TIMESTAMP(3) NOT NULL,
  "monthlyRevenue" DOUBLE PRECISION NOT NULL,
  "qualifiedLevelCode" TEXT,
  "appliedLevelCode" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerCourierRevenueMonth_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellRateCard"
  ADD CONSTRAINT "SellRateCard_costMatrixId_fkey" FOREIGN KEY ("costMatrixId") REFERENCES "CourierCostRateMatrix"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SellRateCard_pricingStrategyId_fkey" FOREIGN KEY ("pricingStrategyId") REFERENCES "SellPricingStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourierCostRateMatrix"
  ADD CONSTRAINT "CourierCostRateMatrix_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourierCostRateRow"
  ADD CONSTRAINT "CourierCostRateRow_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "CourierCostRateMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellPricingStrategy"
  ADD CONSTRAINT "SellPricingStrategy_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SellPricingStrategy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SellPricingStrategy_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerCourierNelAssignment"
  ADD CONSTRAINT "CustomerCourierNelAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerCourierNelAssignment_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCourierRevenueMonth"
  ADD CONSTRAINT "CustomerCourierRevenueMonth_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerCourierRevenueMonth_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CourierCostRateMatrix_courierPartnerId_matrixType_serviceCode_levelCode_isActive_idx" ON "CourierCostRateMatrix"("courierPartnerId", "matrixType", "serviceCode", "levelCode", "isActive");
CREATE INDEX "CourierCostRateMatrix_effectiveFrom_effectiveTo_idx" ON "CourierCostRateMatrix"("effectiveFrom", "effectiveTo");
CREATE INDEX "CourierCostRateRow_matrixId_lane_minWeightKg_maxWeightKg_idx" ON "CourierCostRateRow"("matrixId", "lane", "minWeightKg", "maxWeightKg");
CREATE INDEX "SellPricingStrategy_courierPartnerId_audience_tenantId_customerId_isActive_idx" ON "SellPricingStrategy"("courierPartnerId", "audience", "tenantId", "customerId", "isActive");
CREATE INDEX "SellPricingStrategy_volumeMinMonthly_volumeMaxMonthly_idx" ON "SellPricingStrategy"("volumeMinMonthly", "volumeMaxMonthly");
CREATE INDEX "SellRateCard_costMatrixId_idx" ON "SellRateCard"("costMatrixId");
CREATE INDEX "SellRateCard_pricingStrategyId_idx" ON "SellRateCard"("pricingStrategyId");
CREATE INDEX "CustomerCourierNelAssignment_customerId_courierPartnerId_assignedFrom_idx" ON "CustomerCourierNelAssignment"("customerId", "courierPartnerId", "assignedFrom");
CREATE INDEX "CustomerCourierNelAssignment_courierPartnerId_levelCode_assignedFrom_idx" ON "CustomerCourierNelAssignment"("courierPartnerId", "levelCode", "assignedFrom");
CREATE UNIQUE INDEX "CustomerCourierRevenueMonth_customerId_courierPartnerId_monthStart_key" ON "CustomerCourierRevenueMonth"("customerId", "courierPartnerId", "monthStart");
CREATE INDEX "CustomerCourierRevenueMonth_courierPartnerId_monthStart_idx" ON "CustomerCourierRevenueMonth"("courierPartnerId", "monthStart");
