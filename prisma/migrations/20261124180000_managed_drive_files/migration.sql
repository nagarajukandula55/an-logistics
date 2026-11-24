CREATE TYPE "ManagedFileCategory" AS ENUM ('COURIER_DOCUMENT', 'AGREEMENT_SOURCE', 'AGREEMENT_SIGNED', 'PROOF_OF_DELIVERY', 'INVOICE', 'OTHER');

CREATE TABLE "ManagedFile" (
    "id" TEXT NOT NULL,
    "category" "ManagedFileCategory" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "driveFileId" TEXT NOT NULL,
    "driveWebViewUrl" TEXT,
    "orderId" TEXT,
    "agreementId" TEXT,
    "invoiceId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedFile_driveFileId_key" ON "ManagedFile"("driveFileId");
CREATE INDEX "ManagedFile_category_idx" ON "ManagedFile"("category");
CREATE INDEX "ManagedFile_orderId_idx" ON "ManagedFile"("orderId");
CREATE INDEX "ManagedFile_agreementId_idx" ON "ManagedFile"("agreementId");
CREATE INDEX "ManagedFile_invoiceId_idx" ON "ManagedFile"("invoiceId");
CREATE INDEX "ManagedFile_customerId_idx" ON "ManagedFile"("customerId");

ALTER TABLE "ManagedFile" ADD CONSTRAINT "ManagedFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedFile" ADD CONSTRAINT "ManagedFile_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedFile" ADD CONSTRAINT "ManagedFile_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedFile" ADD CONSTRAINT "ManagedFile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
