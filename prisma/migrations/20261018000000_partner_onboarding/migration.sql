-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'CONTACTED', 'NEGOTIATING', 'AGREEMENT', 'ACTIVE', 'REJECTED');

-- AlterEnum
ALTER TYPE "AgreementStatus" ADD VALUE 'SENDING';

-- AlterEnum
ALTER TYPE "TelegramNotificationEvent" ADD VALUE 'PARTNER_APPLICATION';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bookingKey" TEXT,
ADD COLUMN     "bookingState" TEXT,
ADD COLUMN     "shipmentDetails" JSONB;

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "legalReviewedAt" TIMESTAMP(3),
ADD COLUMN     "rateSnapshot" JSONB,
ADD COLUMN     "termsSnapshot" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "PartnerApplication" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "accountType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "gstin" TEXT,
    "monthlyVolume" INTEGER NOT NULL,
    "requirements" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "privacyVersion" TEXT NOT NULL DEFAULT '2026-10-18',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCourier" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "courierPartnerId" TEXT NOT NULL,

    CONSTRAINT "CustomerCourier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApplication_email_key" ON "PartnerApplication"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApplication_customerId_key" ON "PartnerApplication"("customerId");

-- CreateIndex
CREATE INDEX "PartnerApplication_status_createdAt_idx" ON "PartnerApplication"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCourier_customerId_courierPartnerId_key" ON "CustomerCourier"("customerId", "courierPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementTemplate_name_version_key" ON "AgreementTemplate"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Order_bookingKey_key" ON "Order"("bookingKey");

-- AddForeignKey
ALTER TABLE "PartnerApplication" ADD CONSTRAINT "PartnerApplication_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCourier" ADD CONSTRAINT "CustomerCourier_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCourier" ADD CONSTRAINT "CustomerCourier_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
