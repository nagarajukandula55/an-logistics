import crypto from "crypto";
import type { Order, OrderStatusEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Pushes an order status change to the owning tenant's registered webhook
// (Tenant.webhookUrl), HMAC-signed with Tenant.webhookSecret so the
// receiver (e.g. angroup) can verify it. Best-effort with one retry — a
// failed delivery doesn't roll back the status change, since the tenant
// can always poll GET /api/v1/shipments/:trackingCode to reconcile.
export async function notifyTenantOnStatusChange(order: Order, event: OrderStatusEvent) {
  if (!order.tenantId) return;
  const tenant = await prisma.tenant.findUnique({ where: { id: order.tenantId } });
  if (!tenant?.webhookUrl || !tenant.webhookSecret) return;

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
