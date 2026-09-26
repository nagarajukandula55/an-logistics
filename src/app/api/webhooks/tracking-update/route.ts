import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyTenantOnStatusChange } from "@/lib/webhooks";
import { mapDtdcStatus } from "@/lib/courier-providers/dtdc-status";

// DTDC's "Consignment Status Webhook" (Shipsy platform) pushes status
// updates here. Confirmed against the "Order Status Update Request" SCHEMA
// (2026-09-26): the event name lives in `type` (lowercase snake_case, e.g.
// "delivered", "rto_initiated" — NOT an uppercase phrase like Shiprocket
// used), and the AWB is `courier_partner_reference_number` (our own
// `reference_number` is DTDC's internal consignment id, which may differ
// from the AWB stored as Order.providerRef — see createShipment, which
// currently stores whatever comes back as awb_number/reference_number;
// revisit if these two numbers turn out to diverge in practice).
// Status normalization lives in dtdc-status.ts, shared with the polling
// reconciliation job (api/cron/sync-tracking) so there's exactly one
// DTDC-status → OrderStatus mapping to keep correct, not two that can drift.

// POST /api/webhooks/tracking-update — inbound status push from DTDC.
// Looked up by AWB (Order.providerRef). Auth is a shared `x-api-key` header
// DTDC sends ("apiKey would have to be shared separately" per their docs) —
// not verified here yet since CourierApiConfig has nowhere to store that
// separate webhook secret today; the only side effect of a forged call is
// a status transition on an order already tied to a known AWB, which is
// the same acceptable tradeoff the Shiprocket version of this route made.
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const awb: string | undefined = payload?.courier_partner_reference_number || payload?.reference_number;
  const rawStatus: string | undefined = payload?.type;
  if (!awb || !rawStatus) {
    return NextResponse.json({ success: false, message: "Missing awb or status" }, { status: 400 });
  }

  const mapped = mapDtdcStatus(rawStatus);
  if (!mapped) {
    // Sub-status we don't track onto OrderStatus — acknowledge so DTDC
    // doesn't retry, but don't create a status event.
    return NextResponse.json({ success: true, ignored: true });
  }

  const order = await prisma.order.findFirst({ where: { providerRef: awb } });
  if (!order) {
    // Acknowledge with 200 rather than 404 -- a test/unknown AWB is not a
    // delivery failure on our end, so there's nothing to retry.
    return NextResponse.json({ success: true, ignored: true, message: "No matching order for this AWB" });
  }
  if (order.status === mapped) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: mapped,
      statusEvents: { create: { status: mapped, note: "DTDC webhook update" } },
    },
    include: { statusEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  notifyTenantOnStatusChange(updated, updated.statusEvents[0]).catch(() => {});

  return NextResponse.json({ success: true });
}
