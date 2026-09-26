import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCourierProvider } from "@/lib/courier-providers/registry";
import { mapDtdcStatus } from "@/lib/courier-providers/dtdc-status";
import { notifyTenantOnStatusChange } from "@/lib/webhooks";
import { OrderStatus, OrderFulfillmentType } from "@prisma/client";

// Safety-net reconciliation: DTDC's Consignment Status Webhook
// (api/webhooks/tracking-update) is push-based and depends on DTDC-side
// setup (their portal's webhook URL field) that hasn't been confirmed
// working yet — if it's ever misconfigured, down, or never set up for a
// given partner, orders would silently stop advancing with no other signal.
// This polls every non-terminal courier-assigned order's live tracking
// status instead, so status sync keeps working even if the webhook path
// fails or was never wired up. Same status mapping as the webhook
// (dtdc-status.ts) so the two paths can't disagree with each other.
//
// Scheduled via vercel.json's crons entry, which sends
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is
// set as a project env var — set that before relying on this running.
const TERMINAL_STATUSES: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.FAILED];

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      fulfillmentType: OrderFulfillmentType.COURIER_PARTNER,
      providerRef: { not: null },
      courierPartnerId: { not: null },
      status: { notIn: TERMINAL_STATUSES },
    },
    include: { courierPartner: true },
    // Bounded per run so one invocation can't run long enough to hit a
    // serverless timeout — the next scheduled run picks up whatever's left.
    take: 100,
  });

  let checked = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { orderId: string; message: string }[] = [];

  for (const order of orders) {
    if (!order.courierPartner || !order.providerRef) continue;
    const provider = await getCourierProvider(order.courierPartner);
    if (!provider.trackShipment) {
      skipped++;
      continue;
    }

    checked++;
    try {
      const result = await provider.trackShipment(order.courierPartner, order.providerRef);
      const mapped = mapDtdcStatus(result.status);
      if (!mapped || mapped === order.status) continue;

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: mapped,
          statusEvents: { create: { status: mapped, note: "Reconciled via scheduled tracking sync" } },
        },
        include: { statusEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      notifyTenantOnStatusChange(updatedOrder, updatedOrder.statusEvents[0]).catch(() => {});
      updated++;
    } catch (err) {
      errors.push({ orderId: order.id, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({ checked, updated, skipped, errors });
}
