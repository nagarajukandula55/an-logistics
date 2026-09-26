"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/customer-session";
import { generateTrackingCode } from "@/lib/tracking-code";
import { computePlatformFee, getEffectiveCommission } from "@/lib/courier-queries";
import { getSellPrice } from "@/lib/sell-pricing";
import { determineZone } from "@/lib/zone";
import { OrderAssignmentMethod, OrderFulfillmentType, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { pincodeSchema } from "@/lib/validation";

// Logged-in counterpart to src/lib/actions/public-booking.ts's
// createPublicBookingAction. Quoting reuses checkPublicServiceabilityAction
// as-is (it's already anonymous/stateless — no reason to duplicate it), but
// booking itself needs a session: the order is attached to the caller's own
// Customer/Tenant (requireCustomerSession) instead of looking up/creating a
// Customer by phone number, and pricing automatically picks up that
// tenant's own negotiated SellRateCard if they're a commercial (CLIENT)
// tenant rather than always falling back to the default price list.

const bookingSchema = z.object({
  pickupAddress: z.string().min(1, "Pickup address is required"),
  pickupPincode: pincodeSchema,
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryContactName: z.string().min(1, "Recipient name is required"),
  deliveryContactPhone: z.string().min(1, "Recipient phone is required"),
  deliveryPincode: pincodeSchema,
  weightKg: z.coerce.number().positive(),
  courierPartnerId: z.string().min(1, "Select a courier"),
  courierBranchId: z.string().min(1),
  providerCourierId: z.string().optional(),
});

export type CreateCustomerBookingState = { ok: boolean; error?: string; trackingCode?: string };

export async function createCustomerBookingAction(
  _prev: CreateCustomerBookingState,
  formData: FormData
): Promise<CreateCustomerBookingState> {
  const { session, customerId, tenantId } = await requireCustomerSession();

  const parsed = bookingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { ok: false, error: "Account not found — please contact support" };

  const branch = await prisma.courierBranch.findUnique({
    where: { id: data.courierBranchId },
    include: { courierPartner: true },
  });
  if (!branch || branch.courierPartnerId !== data.courierPartnerId) {
    return { ok: false, error: "Selected courier is no longer available — please check rates again" };
  }
  const partner = branch.courierPartner;

  const commission = await getEffectiveCommission(partner.id, partner);

  const zone = determineZone(data.pickupPincode, data.deliveryPincode);
  const sell = await getSellPrice(tenantId, zone, data.weightKg);
  const chargedAmount = sell?.price ?? undefined;

  const platformFeeAmount = computePlatformFee(commission, chargedAmount ?? null);

  const order = await prisma.order.create({
    data: {
      trackingCode: generateTrackingCode(),
      tenantId,
      customerId: customer.id,
      pickupAddress: data.pickupAddress,
      pickupContactName: session.user.name ?? customer.name,
      pickupContactPhone: customer.phone ?? "",
      pickupPincode: data.pickupPincode,
      deliveryAddress: data.deliveryAddress,
      deliveryContactName: data.deliveryContactName,
      deliveryContactPhone: data.deliveryContactPhone,
      deliveryPincode: data.deliveryPincode,
      weightKg: data.weightKg,
      chargedAmount,
      fulfillmentType: OrderFulfillmentType.COURIER_PARTNER,
      assignmentMethod: OrderAssignmentMethod.AUTO,
      courierPartnerId: partner.id,
      courierBranchId: branch.id,
      selectedProviderCourierId: data.providerCourierId || null,
      platformFeeAmount,
      status: OrderStatus.CREATED,
      statusEvents: {
        create: { status: OrderStatus.CREATED, note: `Booked via customer portal, routed to ${partner.name}` },
      },
    },
  });

  return { ok: true, trackingCode: order.trackingCode };
}
