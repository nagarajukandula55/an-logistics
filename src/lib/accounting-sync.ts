import { prisma } from "@/lib/prisma";

/**
 * Pushes a PAID platform-fee Invoice into AN-accounting's external sales
 * intake (see AN-accounting's src/app/api/external/sales/route.ts), so this
 * app's revenue shows up there as a real GST invoice under the "AN
 * Logistics" Division, without duplicating GST/ledger logic here.
 *
 * Best-effort and non-blocking: called after the status update already
 * committed, so a sync failure never blocks marking an invoice PAID — it's
 * logged for follow-up instead. AN-accounting's endpoint is idempotent on
 * (businessId, externalOrderId), so a retry (manual re-run, or calling this
 * again for the same invoice) never double-posts.
 */
export async function syncInvoiceToAccounting(invoiceId: string): Promise<void> {
  const baseUrl = process.env.ACCOUNTING_API_URL;
  const apiKey = process.env.ACCOUNTING_API_KEY;
  if (!baseUrl || !apiKey) {
    console.error(`[accounting-sync] ACCOUNTING_API_URL/ACCOUNTING_API_KEY not set — skipped invoice ${invoiceId}`);
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { tenant: true },
  });
  if (!invoice) {
    console.error(`[accounting-sync] Invoice ${invoiceId} not found`);
    return;
  }
  if (!invoice.tenant.billingState) {
    console.error(
      `[accounting-sync] Tenant ${invoice.tenant.id} (${invoice.tenant.name}) has no billingState set — cannot sync invoice ${invoice.invoiceNumber}. Set it under tenant billing settings and re-run manually.`,
    );
    return;
  }

  const gstRatePercent =
    invoice.subtotal > 0 ? Math.round((invoice.taxAmount / invoice.subtotal) * 100) : 0;

  const payload = {
    externalOrderId: invoice.invoiceNumber,
    externalSource: "AN Logistics",
    customer: {
      name: invoice.tenant.name,
      email: invoice.tenant.billingEmail || undefined,
      gstin: invoice.tenant.gstin || undefined,
      state: invoice.tenant.billingState,
    },
    lines: [
      {
        description: `AN Logistics platform invoice ${invoice.invoiceNumber}`,
        quantity: 1,
        rate: invoice.subtotal,
        gstRatePercent,
      },
    ],
    payment: {
      amount: invoice.totalAmount,
      method: "BANK_TRANSFER" as const,
      reference: invoice.invoiceNumber,
      date: invoice.paidAt ?? undefined,
    },
  };

  try {
    const response = await fetch(`${baseUrl}/api/external/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[accounting-sync] Sync failed for invoice ${invoice.invoiceNumber}: ${response.status} ${text}`);
    }
  } catch (error) {
    console.error(`[accounting-sync] Sync request failed for invoice ${invoice.invoiceNumber}:`, error);
  }
}
