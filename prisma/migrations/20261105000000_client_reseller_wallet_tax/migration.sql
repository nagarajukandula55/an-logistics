-- CreateEnum
CREATE TYPE "CustomerAccountType" AS ENUM ('CLIENT', 'RESELLER');

-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "accountType" "CustomerAccountType" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN "taxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 18;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "taxAmount" DOUBLE PRECISION,
ADD COLUMN "totalChargedAmount" DOUBLE PRECISION;
