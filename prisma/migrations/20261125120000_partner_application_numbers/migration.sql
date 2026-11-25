ALTER TABLE "PartnerApplication" ADD COLUMN "applicationNumber" TEXT;

CREATE UNIQUE INDEX "PartnerApplication_applicationNumber_key" ON "PartnerApplication"("applicationNumber");
