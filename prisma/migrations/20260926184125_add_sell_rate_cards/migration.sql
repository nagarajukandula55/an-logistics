-- CreateTable
CREATE TABLE "SellRateCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "minMarginPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellRateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellRateCardSlab" (
    "id" TEXT NOT NULL,
    "sellRateCardId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "minWeightKg" DOUBLE PRECISION NOT NULL,
    "maxWeightKg" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SellRateCardSlab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellRateCard_tenantId_idx" ON "SellRateCard"("tenantId");

-- CreateIndex
CREATE INDEX "SellRateCardSlab_sellRateCardId_idx" ON "SellRateCardSlab"("sellRateCardId");

-- AddForeignKey
ALTER TABLE "SellRateCard" ADD CONSTRAINT "SellRateCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellRateCardSlab" ADD CONSTRAINT "SellRateCardSlab_sellRateCardId_fkey" FOREIGN KEY ("sellRateCardId") REFERENCES "SellRateCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
