import crypto from "crypto";
import type { Order, OrderStatusEvent } from "@prisma/client";
import { TelegramNotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyCustomerTelegram, notifyOpsTelegram, notifyTenantTelegram } from "@/lib/telegram";

// Pushes an order status change to the owning tenant: their registered
// webhook (Tenant.webhookUrl, HMAC-signed with Tenant.webhookSecret) and/or
// their connected Telegram group (Tenant.telegramEnabled) — a client can
// use either, both, or neither; each is independently best-effort and
// doesn't block the other. A failed webhook delivery doesn't roll back the
// status change, since the tenant can always poll
// GET /api/v1/shipments/:trackingCode to reconcile.
export async function notifyTenantOnStatusChange(order: Order, event: OrderStatusEvent) {
  if (!order.tenantId) return;
  const tenant = await prisma.tenant.findUnique({ where: { id: order.tenantId } });
  if (!tenant) return;

  const statusText = event.status.replace(/_/g, " ").toLowerCase();
  const telegramLines = [`<b>${order.trackingCode}</b> is now ${statusText}.`];
  if (event.note) telegramLines.push(event.note);
  await notifyTenantTelegram(tenant.id, telegramLines.join("\n"));

  if (!tenant.webhookUrl || !tenant.webhookSecret) return;

  const payload = JSON.stringify({
    trackingCode: order.trackingCode,
    externalOrderId: order.id,
    status: event.status,
    note: event.note,
    providerRef: order.providerRef,
    timestamp: event.createdAt,
  });
  const signature = crypto.createHmac("sha256", tenant.webhookSecret).update(payload).digest("hex");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(tenant.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-AN-Logistics-Signature": signature },
        body: payload,
      });
      if (res.ok) return;
    } catch {
      // retry once, then give up silently — see doc comment above
    }
  }
}

/**
 * Notifies the order's Customer over Telegram, if they've linked one (see
 * src/app/api/telegram/webhook/route.ts). Call this alongside
 * notifyTenantOnStatusChange at every status-change site — same
 * best-effort, non-blocking contract (always .catch(() => {})'d by callers).
 */
export async function notifyCustomerOnStatusChange(order: Order, event: OrderStatusEvent) {
  const statusText = event.status.replace(/_/g, " ").toLowerCase();
  const lines = [`<b>${order.trackingCode}</b> is now ${statusText}.`];
  if (event.note) lines.push(event.note);
  await notifyCustomerTelegram(order.customerId, lines.join("\n"));
}

/**
 * Posts an order status change to the ops Telegram group configured for
 * ORDER_STATUS_CHANGE (Settings -> Telegram notifications), if any. Same
 * call-alongside-the-others contract as notifyCustomerOnStatusChange.
 */
export async function notifyOpsOnStatusChange(order: Order, event: OrderStatusEvent) {
  const statusText = event.status.replace(/_/g, " ").toLowerCase();
  const lines = [`<b>${order.trackingCode}</b> is now ${statusText}.`];
  if (event.note) lines.push(event.note);
  await notifyOpsTelegram(TelegramNotificationEvent.ORDER_STATUS_CHANGE, lines.join("\n"));
}
