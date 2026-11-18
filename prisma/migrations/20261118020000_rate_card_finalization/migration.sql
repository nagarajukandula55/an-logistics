-- Existing cards remain usable. New cards are created as drafts by the app.
ALTER TABLE "SellRateCard"
  ADD COLUMN "isFinalized" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedBy" TEXT;

ALTER TABLE "SellRateCard"
  ALTER COLUMN "isFinalized" SET DEFAULT false;
