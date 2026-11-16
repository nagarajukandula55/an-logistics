-- Add courier-specific sell pricing and per-user courier access.
ALTER TABLE "User" ADD COLUMN "canManageCourierCosts" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SellRateCard" ADD COLUMN "courierPartnerId" TEXT;

CREATE TABLE "UserCourierAssignment" (
  "userId" TEXT NOT NULL,
  "courierPartnerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCourierAssignment_pkey" PRIMARY KEY ("userId", "courierPartnerId"),
  CONSTRAINT "UserCourierAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserCourierAssignment_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SellRateCard_courierPartnerId_idx" ON "SellRateCard"("courierPartnerId");
CREATE INDEX "SellRateCard_audience_courierPartnerId_tenantId_customerId_isActive_idx" ON "SellRateCard"("audience", "courierPartnerId", "tenantId", "customerId", "isActive");
CREATE INDEX "UserCourierAssignment_courierPartnerId_idx" ON "UserCourierAssignment"("courierPartnerId");

ALTER TABLE "SellRateCard" ADD CONSTRAINT "SellRateCard_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
