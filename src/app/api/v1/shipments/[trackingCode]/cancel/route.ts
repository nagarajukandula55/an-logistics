import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api-auth";
import { getCourierProvider } from "@/lib/courier-providers/registry";
import { OrderStatus } from "@prisma/client";

// POST /api/v1/shipments/:trackingCode/cancel
export async function POST(req: Request, context: { params: Promise<{ trackingCode: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!auth.scopes.includes("orders:create")) {
    return NextResponse.json({ success: false, message: "Missing scope: orders:create" }, { status: 403 });
  }

  const { trackingCode } = await context.params;
  const order = await prisma.order.findUnique({ where: { trackingCode }, include: { courierPartner: true } });
  if (!order || order.tenantId !== auth.tenant.id) {
    return NextResponse.json({ success: false, message: "Shipment not found" }, { status: 404 });
  }
  if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
    return NextResponse.json({ success: false, message: `Cannot cancel a ${order.status} shipment` }, { status: 400 });
  }

  if (order.courierPartner && order.providerRef) {
    const provider = await getCourierProvider(order.courierPartner);
    if (provider.cancelShipment) {
      try {
        await provider.cancelShipment(order.courierPartner, order.providerRef);
      } catch (err) {
        return NextResponse.json(
          { success: false, message: `Courier cancellation failed: ${err instanceof Error ? err.message : "unknown error"}` },
          { status: 502 }
        );
      }
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.CANCELLED, statusEvents: { create: { status: OrderStatus.CANCELLED, note: "Cancelled via API" } } },
  });

  return NextResponse.json({ success: true });
}
