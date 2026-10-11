-- CreateEnum
CREATE TYPE "TelegramNotificationEvent" AS ENUM ('ORDER_STATUS_CHANGE', 'AGREEMENT_SENT', 'AGREEMENT_SIGNED', 'AGREEMENT_RENEWAL_DUE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramGroupChatId" TEXT,
ADD COLUMN     "telegramGroupTitle" TEXT;

-- CreateTable
CREATE TABLE "TelegramNotificationChannel" (
    "id" TEXT NOT NULL,
    "event" "TelegramNotificationEvent" NOT NULL,
    "groupChatId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramNotificationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramNotificationChannel_event_key" ON "TelegramNotificationChannel"("event");

-- CreateIndex
CREATE INDEX "Tenant_telegramGroupChatId_idx" ON "Tenant"("telegramGroupChatId");
