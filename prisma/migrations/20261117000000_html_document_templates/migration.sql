-- Editable courier/global HTML templates for quotations and agreements.
CREATE TYPE "DocumentTemplateKind" AS ENUM ('QUOTATION', 'AGREEMENT');

CREATE TABLE "DocumentTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "kind" "DocumentTemplateKind" NOT NULL,
  "courierPartnerId" TEXT,
  "html" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentTemplate_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "Agreement" ADD COLUMN "documentTemplateId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "documentTemplateId" TEXT;
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DocumentTemplate_kind_courierPartnerId_isActive_idx" ON "DocumentTemplate"("kind", "courierPartnerId", "isActive");
CREATE UNIQUE INDEX "DocumentTemplate_name_version_kind_courierPartnerId_key" ON "DocumentTemplate"("name", "version", "kind", "courierPartnerId");
