import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyTenantOnStatusChange } from "@/lib/webhooks";
import { OrderStatus } from "@prisma/client";

// Shiprocket's shipment-status webhook maps loosely onto our OrderStatus
// enum — this list covers the cases relevant to a marketplace order (not
// every Shiprocket sub-status), matching the vocabulary already used in
// providers/shiprocketProvider.ts's tracking response.
const SHIPROCKET_STATUS_MAP: Record<string, OrderStatus> = {
  "PICKED UP": OrderStatus.PICKED_UP,
  "IN TRANSIT": OrderStatus.IN_TRANSIT,
  "OUT FOR DELIVERY": OrderStatus.OUT_FOR_DELIVERY,
  DELIVERED: OrderStatus.DELIVERED,
  CANCELLED: OrderStatus.CANCELLED,
  RTO: OrderStatus.FAILED,
};

// POST /api/webhooks/tracking-update — inbound status push from Shiprocket.
// Deliberately NOT named .../webhooks/shiprocket: Shiprocket's own webhook
// setup page rejects any URL containing "shiprocket"/"kartrocket"/"sr"/"kr"
// (confirmed live — "Address in not allowed" until this was renamed).
// Looked up by AWB (Order.providerRef) since Shiprocket's payload doesn't
// carry our trackingCode. No signature verification here (Shiprocket
// webhooks don't support HMAC signing) — acceptable since the only side
// effect is a status transition on an order already tied to a known AWB.
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const awb: string | undefined = payload?.awb || payload?.awb_code;
  const rawStatus: string | undefined = payload?.current_status || payload?.shipment_status;
  if (!awb || !rawStatus) {
    return NextResponse.json({ success: false, message: "Missing awb or status" }, { status: 400 });
  }

  const mapped = SHIPROCKET_STATUS_MAP[rawStatus.toUpperCase().trim()];
  if (!mapped) {
    // Sub-status we don't track onto OrderStatus — acknowledge so
    // Shiprocket doesn't retry, but don't create a status event.
    return NextResponse.json({ success: true, ignored: true });
  }

  const order = await prisma.order.findFirst({ where: { providerRef: awb } });
  if (!order) {
    // Acknowledge with 200 rather than 404 -- Shiprocket's own "Test
    // Webhook" button (and likely its retry logic for real events) treats
    // any non-2xx response as "unable to reach the endpoint" even though
    // we genuinely received and parsed the payload. A test/unknown AWB is
    // not a delivery failure on our end, so there's nothing to retry.
    return NextResponse.json({ success: true, ignored: true, message: "No matching order for this AWB" });
  }
  if (order.status === mapped) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: mapped,
      statusEvents: { create: { status: mapped, note: "Shiprocket webhook update" } },
    },
    include: { statusEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  notifyTenantOnStatusChange(updated, updated.statusEvents[0]).catch(() => {});

  return NextResponse.json({ success: true });
}
