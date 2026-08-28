-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "courierPartnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCardSlab" (
    "id" TEXT NOT NULL,
    "rateCardId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "minWeightKg" DOUBLE PRECISION NOT NULL,
    "maxWeightKg" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RateCardSlab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateCard_courierPartnerId_idx" ON "RateCard"("courierPartnerId");

-- CreateIndex
CREATE INDEX "RateCardSlab_rateCardId_idx" ON "RateCardSlab"("rateCardId");

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCardSlab" ADD CONSTRAINT "RateCardSlab_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
