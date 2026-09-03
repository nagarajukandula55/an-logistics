"use server";

import { prisma } from "@/lib/prisma";
import { generateTrackingCode } from "@/lib/tracking-code";
import { getCourierProvider } from "@/lib/courier-providers/registry";
import { findServiceableBranches, computePlatformFee, getEffectiveCommission } from "@/lib/courier-queries";
import { OrderAssignmentMethod, OrderFulfillmentType, OrderStatus, TenantType } from "@prisma/client";
import { z } from "zod";
import { pincodeSchema } from "@/lib/validation";

// Public bookings (no login) roll up under the singleton MARKETPLACE
// tenant seeded in prisma/seed.ts, so they're billable/reportable like any
// other tenant's volume without needing a real account per member of the
// public. Own-network-first, then partner fallback both fall out of
// findServiceableBranches's priority ordering (see courier-queries.ts) —
// no special-casing here.
async function getMarketplaceTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { type: TenantType.MARKETPLACE } });
  if (!tenant) throw new Error("Marketplace tenant is not configured — run the seed script");
  return tenant.id;
}

export type PublicQuote = {
  courierPartnerId: string;
  courierBranchId: string;
  courierName: string;
  rate: number;
  etaDays: number | undefined;
  providerCourierId: string | undefined;
};

const serviceabilitySchema = z.object({
  pickupPincode: pincodeSchema,
  deliveryPincode: pincodeSchema,
  weightKg: z.coerce.number().positive(),
});

export type CheckServiceabilityState = { ok: boolean; error?: string; quotes?: PublicQuote[] };

export async function checkPublicServiceabilityAction(
  _prev: CheckServiceabilityState,
  formData: FormData
): Promise<CheckServiceabilityState> {
  const parsed = serviceabilitySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { pickupPincode, deliveryPincode, weightKg } = parsed.data;

  const branches = await findServiceableBranches(deliveryPincode);
  if (branches.length === 0) {
    return { ok: true, quotes: [] };
  }

  const quotes = await Promise.all(
    branches.map(async (branch) => {
      const partner = branch.courierPartner;
      const provider = await getCourierProvider(partner);
      try {
        const quote = await provider.getQuote(partner, { pickupPincode, deliveryPincode, weightKg });
        if (!quote) return null;
        return {
          courierPartnerId: partner.id,
          courierBranchId: branch.id,
          courierName: partner.name,
          rate: quote.price,
          etaDays: quote.etaDays,
          providerCourierId: quote.providerCourierId,
        };
      } catch {
        return null;
      }
    })
  );

  return { ok: true, quotes: quotes.filter((q): q is PublicQuote => q !== null) };
}

const bookingSchema = z.object({
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().min(1, "Phone is required"),
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
  chargedAmount: z.coerce.number().nonnegative().optional(),
});

export type CreateBookingState = { ok: boolean; error?: string; trackingCode?: string };

export async function createPublicBookingAction(
  _prev: CreateBookingState,
  formData: FormData
): Promise<CreateBookingState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const tenantId = await getMarketplaceTenantId();

  const customer =
    (await prisma.customer.findFirst({ where: { tenantId, phone: data.customerPhone } })) ??
    (await prisma.customer.create({ data: { tenantId, name: data.customerName, phone: data.customerPhone } }));

  const branch = await prisma.courierBranch.findUnique({
    where: { id: data.courierBranchId },
    include: { courierPartner: true },
  });
  if (!branch || branch.courierPartnerId !== data.courierPartnerId) {
    return { ok: false, error: "Selected courier is no longer available — please check rates again" };
  }
  const partner = branch.courierPartner;

  const commission = await getEffectiveCommission(partner.id, partner);
  const platformFeeAmount = computePlatformFee(commission, data.chargedAmount ?? null);

  const order = await prisma.order.create({
    data: {
      trackingCode: generateTrackingCode(),
      tenantId,
      customerId: customer.id,
      pickupAddress: data.pickupAddress,
      pickupContactName: data.customerName,
      pickupContactPhone: data.customerPhone,
      pickupPincode: data.pickupPincode,
      deliveryAddress: data.deliveryAddress,
      deliveryContactName: data.deliveryContactName,
      deliveryContactPhone: data.deliveryContactPhone,
      deliveryPincode: data.deliveryPincode,
      weightKg: data.weightKg,
      chargedAmount: data.chargedAmount,
      fulfillmentType: OrderFulfillmentType.COURIER_PARTNER,
      assignmentMethod: OrderAssignmentMethod.AUTO,
      courierPartnerId: partner.id,
      courierBranchId: branch.id,
      platformFeeAmount,
      status: OrderStatus.CREATED,
      statusEvents: { create: { status: OrderStatus.CREATED, note: `Booked via public marketplace, routed to ${partner.name}` } },
    },
  });

  return { ok: true, trackingCode: order.trackingCode };
}
