import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api-auth";

// GET /api/v1/shipments/:trackingCode — status + event history for a
// tenant's own shipment. Scoped to the calling tenant so one client can't
// enumerate another's tracking codes.
export async function GET(req: Request, context: { params: Promise<{ trackingCode: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!auth.scopes.includes("orders:read")) {
    return NextResponse.json({ success: false, message: "Missing scope: orders:read" }, { status: 403 });
  }

  const { trackingCode } = await context.params;
  const order = await prisma.order.findUnique({
    where: { trackingCode },
    include: { statusEvents: { orderBy: { createdAt: "desc" } } },
  });

  if (!order || order.tenantId !== auth.tenant.id) {
    return NextResponse.json({ success: false, message: "Shipment not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      trackingCode: order.trackingCode,
      status: order.status,
      providerRef: order.providerRef,
      providerLabelUrl: order.providerLabelUrl,
      events: order.statusEvents.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
    },
  });
}
