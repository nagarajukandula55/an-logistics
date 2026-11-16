-- Add role-based operational logins and pricing audiences.
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'STAFF', 'COLLABORATOR', 'DISPATCHER', 'DRIVER', 'WAREHOUSE', 'CUSTOMER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'DISPATCHER';

CREATE TYPE "SellRateCardAudience" AS ENUM ('DEFAULT', 'STAFF', 'COLLABORATOR', 'CLIENT');
ALTER TABLE "SellRateCard" ADD COLUMN "audience" "SellRateCardAudience" NOT NULL DEFAULT 'DEFAULT';
UPDATE "SellRateCard" SET "audience" = 'CLIENT' WHERE "tenantId" IS NOT NULL OR "customerId" IS NOT NULL;
