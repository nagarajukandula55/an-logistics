ALTER TABLE "Customer"
ADD COLUMN "resellerMarginType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN "resellerMarginValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD COLUMN "agreedPriceAmount" DOUBLE PRECISION,
ADD COLUMN "marginAmount" DOUBLE PRECISION,
ADD COLUMN "walletDebitAmount" DOUBLE PRECISION;

ALTER TABLE "Invoice"
ADD COLUMN "customerId" TEXT;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
