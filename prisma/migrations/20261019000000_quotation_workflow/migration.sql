ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'QUOTATION';

CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'REVISION_REQUESTED', 'EXPIRED');

CREATE TABLE "Quotation" (
  "id" TEXT NOT NULL,
  "quoteNumber" TEXT NOT NULL,
  "applicationId" TEXT,
  "customerId" TEXT,
  "courierPartnerId" TEXT,
  "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "validUntil" TIMESTAMP(3),
  "termsSnapshot" TEXT NOT NULL,
  "rateSnapshot" JSONB NOT NULL,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quotation_quoteNumber_key" ON "Quotation"("quoteNumber");
CREATE INDEX "Quotation_status_createdAt_idx" ON "Quotation"("status", "createdAt");
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
