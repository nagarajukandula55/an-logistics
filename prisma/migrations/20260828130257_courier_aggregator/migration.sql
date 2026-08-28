-- CreateEnum
CREATE TYPE "OrderFulfillmentType" AS ENUM ('SELF_FLEET', 'COURIER_PARTNER');

-- CreateEnum
CREATE TYPE "OrderAssignmentMethod" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "CourierPartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "CourierIntegrationType" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "CourierAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignmentMethod" "OrderAssignmentMethod" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "courierBranchId" TEXT,
ADD COLUMN     "courierPartnerId" TEXT,
ADD COLUMN     "courierPayoutAmount" DOUBLE PRECISION,
ADD COLUMN     "deliveryPincode" TEXT,
ADD COLUMN     "fulfillmentType" "OrderFulfillmentType" NOT NULL DEFAULT 'SELF_FLEET',
ADD COLUMN     "pickupPincode" TEXT,
ADD COLUMN     "platformFeeAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "CourierPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "status" "CourierPartnerStatus" NOT NULL DEFAULT 'PENDING',
    "integrationType" "CourierIntegrationType" NOT NULL DEFAULT 'MANUAL',
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierBranch" (
    "id" TEXT NOT NULL,
    "courierPartnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceArea" (
    "id" TEXT NOT NULL,
    "courierBranchId" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierAgreement" (
    "id" TEXT NOT NULL,
    "courierPartnerId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "commissionType" "CommissionType" NOT NULL,
    "commissionValue" DOUBLE PRECISION NOT NULL,
    "documentUrl" TEXT,
    "status" "CourierAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierApiConfig" (
    "id" TEXT NOT NULL,
    "courierPartnerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CourierApiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourierPartner_status_idx" ON "CourierPartner"("status");

-- CreateIndex
CREATE INDEX "CourierBranch_courierPartnerId_idx" ON "CourierBranch"("courierPartnerId");

-- CreateIndex
CREATE INDEX "ServiceArea_pincode_idx" ON "ServiceArea"("pincode");

-- CreateIndex
CREATE INDEX "ServiceArea_courierBranchId_idx" ON "ServiceArea"("courierBranchId");

-- CreateIndex
CREATE INDEX "CourierAgreement_courierPartnerId_idx" ON "CourierAgreement"("courierPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "CourierApiConfig_courierPartnerId_key" ON "CourierApiConfig"("courierPartnerId");

-- CreateIndex
CREATE INDEX "Order_deliveryPincode_idx" ON "Order"("deliveryPincode");

-- CreateIndex
CREATE INDEX "Order_courierPartnerId_idx" ON "Order"("courierPartnerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierBranchId_fkey" FOREIGN KEY ("courierBranchId") REFERENCES "CourierBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierBranch" ADD CONSTRAINT "CourierBranch_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_courierBranchId_fkey" FOREIGN KEY ("courierBranchId") REFERENCES "CourierBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierAgreement" ADD CONSTRAINT "CourierAgreement_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierApiConfig" ADD CONSTRAINT "CourierApiConfig_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
