import { prisma } from "@/lib/prisma";
import { Prisma, WalletTransactionType } from "@prisma/client";

/**
 * Wallet balance is debited when an order is actually handed to a courier
 * (assignOrderToCourierAction), not at order creation — a booking that
 * never ships never costs the Customer anything. WalletTransaction is the
 * ledger of record; Wallet.balance is a cached running total kept in sync
 * in the same transaction as each WalletTransaction insert.
 */

export async function getOrCreateWallet(customerId: string) {
  const existing = await prisma.wallet.findUnique({ where: { customerId } });
  if (existing) return existing;
  return prisma.wallet.create({ data: { customerId } });
}

/**
 * Debits `amount` from the Customer's wallet for `orderId`, inside the
 * given transaction client so it commits atomically with the order update
 * that triggered it (assignOrderToCourierAction). Throws if the balance
 * would go negative — the caller must not proceed with dispatch in that
 * case. Also pushes the movement to ANyPay (AN-accounting) best-effort,
 * same non-blocking pattern as accounting-sync.ts: a sync failure is
 * logged, not thrown, since the local debit already committed.
 */
export async function debitWalletForOrder(
  tx: Prisma.TransactionClient,
  customerId: string,
  orderId: string,
  amount: number,
): Promise<void> {
  const wallet = await tx.wallet.upsert({
    where: { customerId },
    create: { customerId },
    update: {},
  });

  if (wallet.balance < amount) {
    throw new Error(
      `Insufficient wallet balance (₹${wallet.balance.toFixed(2)} available, ₹${amount.toFixed(2)} required) — top up before dispatching this order.`,
    );
  }

  const balanceAfter = wallet.balance - amount;
  await tx.wallet.update({ where: { customerId }, data: { balance: balanceAfter } });
  const txn = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: WalletTransactionType.DEBIT,
      amount,
      balanceAfter,
      orderId,
    },
  });

  // Fire-and-forget: push to ANyPay after the local ledger has already
  // committed. Not awaited inside the DB transaction on purpose — a slow
  // or failed external call should never hold the order-assignment lock.
  void pushWalletTransactionToAnyPay(txn.id).catch((error) =>
    console.error(`[wallet] ANyPay push failed for WalletTransaction ${txn.id}:`, error),
  );
}

export async function creditWallet(customerId: string, amount: number, note?: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
    });
    const balanceAfter = wallet.balance + amount;
    await tx.wallet.update({ where: { customerId }, data: { balance: balanceAfter } });
    const txn = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.CREDIT,
        amount,
        balanceAfter,
        note,
      },
    });
    void pushWalletTransactionToAnyPay(txn.id).catch((error) =>
      console.error(`[wallet] ANyPay push failed for WalletTransaction ${txn.id}:`, error),
    );
  });
}

/**
 * Pushes a wallet movement to ANyPay (AN-accounting's wallet ledger) for
 * confirmation/reconciliation. Not yet a real integration — AN-accounting
 * doesn't expose this endpoint today; set WALLET_API_URL/WALLET_API_KEY and
 * point this at the real path once it does. No-ops (logged) if unset, same
 * as accounting-sync.ts without ACCOUNTING_API_KEY.
 */
async function pushWalletTransactionToAnyPay(walletTransactionId: string): Promise<void> {
  const baseUrl = process.env.WALLET_API_URL;
  const apiKey = process.env.WALLET_API_KEY;
  if (!baseUrl || !apiKey) {
    console.error(`[wallet] WALLET_API_URL/WALLET_API_KEY not set — skipped ANyPay sync for ${walletTransactionId}`);
    return;
  }

  const txn = await prisma.walletTransaction.findUnique({
    where: { id: walletTransactionId },
    include: { wallet: { include: { customer: true } } },
  });
  if (!txn) return;

  try {
    const response = await fetch(`${baseUrl}/api/external/wallet-transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        externalSource: "AN Logistics",
        externalTransactionId: txn.id,
        customerName: txn.wallet.customer.name,
        type: txn.type,
        amount: txn.amount,
        balanceAfter: txn.balanceAfter,
        orderId: txn.orderId ?? undefined,
        note: txn.note ?? undefined,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[wallet] ANyPay sync failed for ${txn.id}: ${response.status} ${text}`);
      return;
    }
    const data = (await response.json().catch(() => null)) as { externalRef?: string } | null;
    if (data?.externalRef) {
      await prisma.walletTransaction.update({
        where: { id: txn.id },
        data: { externalRef: data.externalRef },
      });
    }
  } catch (error) {
    console.error(`[wallet] ANyPay sync request failed for ${txn.id}:`, error);
  }
}
