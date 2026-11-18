CREATE TYPE "BillingCycle" AS ENUM ('PER_SHIPMENT', 'FORTNIGHTLY', 'MONTHLY');

ALTER TABLE "Customer"
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "billingAddress" TEXT,
  ADD COLUMN "billingState" TEXT,
  ADD COLUMN "gstin" TEXT,
  ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "paymentTermsDays" INTEGER NOT NULL DEFAULT 7;

ALTER TABLE "PartnerApplication"
  ADD COLUMN "billingName" TEXT,
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "billingAddress" TEXT,
  ADD COLUMN "billingState" TEXT,
  ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "paymentTermsDays" INTEGER NOT NULL DEFAULT 7;
