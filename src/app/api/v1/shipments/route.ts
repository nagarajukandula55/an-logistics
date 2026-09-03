import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api-auth";
import { generateTrackingCode } from "@/lib/tracking-code";
import { getCourierProvider } from "@/lib/courier-providers/registry";
import { computePlatformFee, getEffectiveCommission } from "@/lib/courier-queries";
import { OrderAssignmentMethod, OrderFulfillmentType, OrderStatus } from "@prisma/client";

const bodySchema = z.object({
  externalOrderId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().email().optional(),
  pickupAddress: z.string().min(1),
  pickupContactName: z.string().min(1),
  pickupContactPhone: z.string().min(1),
  pickupPincode: z.string().min(1),
  deliveryAddress: z.string().min(1),
  deliveryContactName: z.string().min(1),
  deliveryContactPhone: z.string().min(1),
  deliveryPincode: z.string().min(1),
  weightKg: z.coerce.number().positive(),
  packageDescription: z.string().optional(),
  codAmount: z.coerce.number().nonnegative().optional(),
  // From a prior POST /api/v1/rates response — which courier/branch to
  // book. Omit to create the order unassigned (CREATED), for callers that
  // want to dispatch manually afterward.
  courierPartnerId: z.string().optional(),
  courierBranchId: z.string().optional(),
  providerCourierId: z.string().optional(),
});

// POST /api/v1/shipments — creates an Order for the calling tenant, and if
// a courier was chosen (from /api/v1/rates), immediately dispatches it via
// that provider's createShipment. Mirrors createOrderAction +
// assignOrderToCourierAction (src/lib/actions/orders.ts, couriers.ts) but
// as a machine-callable endpoint rather than a form action.
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!auth.scopes.includes("orders:create")) {
    return NextResponse.json({ success: false, message: "Missing scope: orders:create" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const data = parsed.data;

  // Customer has no natural unique key today besides id, so look up by
  // phone within the tenant rather than creating a duplicate row per call.
  const customer =
    (await prisma.customer.findFirst({ where: { tenantId: auth.tenant.id, phone: data.customerPhone } })) ??
    (await prisma.customer.create({
      data: { tenantId: auth.tenant.id, name: data.customerName, phone: data.customerPhone, email: data.customerEmail },
    }));

  const order = await prisma.order.create({
    data: {
      trackingCode: generateTrackingCode(),
      tenantId: auth.tenant.id,
      customerId: customer.id,
      pickupAddress: data.pickupAddress,
      pickupContactName: data.pickupContactName,
      pickupContactPhone: data.pickupContactPhone,
      pickupPincode: data.pickupPincode,
      deliveryAddress: data.deliveryAddress,
      deliveryContactName: data.deliveryContactName,
      deliveryContactPhone: data.deliveryContactPhone,
      deliveryPincode: data.deliveryPincode,
      weightKg: data.weightKg,
      packageDescription: data.packageDescription,
      codAmount: data.codAmount,
      status: OrderStatus.CREATED,
      statusEvents: { create: { status: OrderStatus.CREATED, note: `Created via API by ${auth.tenant.name}` } },
    },
  });

  if (!data.courierPartnerId || !data.courierBranchId) {
    return NextResponse.json({ success: true, data: { trackingCode: order.trackingCode, status: order.status } });
  }

  const branch = await prisma.courierBranch.findUnique({
    where: { id: data.courierBranchId },
    include: { courierPartner: true },
  });
  if (!branch || branch.courierPartnerId !== data.courierPartnerId) {
    return NextResponse.json({
      success: true,
      data: { trackingCode: order.trackingCode, status: order.status, warning: "Courier branch not found — order left unassigned" },
    });
  }

  const partner = branch.courierPartner;
  const provider = await getCourierProvider(partner);
  const commission = await getEffectiveCommission(partner.id, partner);
  const platformFeeAmount = computePlatformFee(commission, data.codAmount);

  let providerRef: string | undefined;
  let providerLabelUrl: string | undefined;
  try {
    if (provider.createShipment) {
      const result = await provider.createShipment(partner, {
        orderId: order.id,
        pickupPincode: data.pickupPincode,
        deliveryAddress: data.deliveryAddress,
        deliveryPincode: data.deliveryPincode,
        deliveryContactName: data.deliveryContactName,
        deliveryContactPhone: data.deliveryContactPhone,
        weightKg: data.weightKg,
        packageDescription: data.packageDescription,
        codAmount: data.codAmount,
        providerCourierId: data.providerCourierId,
      });
      providerRef = result.providerRef;
      providerLabelUrl = result.labelUrl;
    }
  } catch (err) {
    // Order stays CREATED/unassigned rather than failing the whole
    // request — the caller already has a trackingCode to retry dispatch
    // against, and the failure reason is surfaced as a warning.
    return NextResponse.json({
      success: true,
      data: {
        trackingCode: order.trackingCode,
        status: order.status,
        warning: `Order created but courier booking failed: ${err instanceof Error ? err.message : "unknown error"}`,
      },
    });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      fulfillmentType: OrderFulfillmentType.COURIER_PARTNER,
      courierPartnerId: partner.id,
      courierBranchId: branch.id,
      assignmentMethod: OrderAssignmentMethod.AUTO,
      platformFeeAmount,
      providerRef,
      providerLabelUrl,
      status: OrderStatus.ASSIGNED,
      statusEvents: { create: { status: OrderStatus.ASSIGNED, note: `Routed to ${partner.name} via API` } },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      trackingCode: updated.trackingCode,
      status: updated.status,
      providerRef: updated.providerRef,
      providerLabelUrl: updated.providerLabelUrl,
    },
  });
}
