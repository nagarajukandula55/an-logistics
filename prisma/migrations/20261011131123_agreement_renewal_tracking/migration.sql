-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "AgreementKind" AS ENUM ('B2B', 'B2C');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'VOID');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "kind" "CustomerKind" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "maxStaffUsers" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "SellRateCard" ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isBusinessOwner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "externalRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "AgreementKind" NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "templateVersion" TEXT NOT NULL,
    "documentUrl" TEXT,
    "sellRateCardId" TEXT,
    "externalEnvelopeId" TEXT,
    "signerName" TEXT,
    "signerEmail" TEXT,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "renewalReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "chatId" TEXT,
    "chatTitle" TEXT,
    "groupChatId" TEXT,
    "groupChatTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_customerId_key" ON "Wallet"("customerId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_orderId_idx" ON "WalletTransaction"("orderId");

-- CreateIndex
CREATE INDEX "Agreement_customerId_idx" ON "Agreement"("customerId");

-- CreateIndex
CREATE INDEX "Agreement_externalEnvelopeId_idx" ON "Agreement"("externalEnvelopeId");

-- CreateIndex
CREATE INDEX "Agreement_renewalDate_idx" ON "Agreement"("renewalDate");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_customerId_key" ON "TelegramLink"("customerId");

-- CreateIndex
CREATE INDEX "TelegramLink_chatId_idx" ON "TelegramLink"("chatId");

-- CreateIndex
CREATE INDEX "TelegramLink_groupChatId_idx" ON "TelegramLink"("groupChatId");

-- CreateIndex
CREATE INDEX "SellRateCard_customerId_idx" ON "SellRateCard"("customerId");

-- AddForeignKey
ALTER TABLE "SellRateCard" ADD CONSTRAINT "SellRateCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_sellRateCardId_fkey" FOREIGN KEY ("sellRateCardId") REFERENCES "SellRateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
