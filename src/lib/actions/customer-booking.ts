"use server";
import { Prisma } from "@prisma/client";
import { getCourierProvider } from "@/lib/courier-providers/registry";
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
    bookingKey: z.string().uuid(),
    pickupContactName: z.string().trim().min(2).max(100),
    pickupContactPhone: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/),
    pickupCity: z.string().min(2).max(100),
    pickupState: z.string().min(2).max(100),
    deliveryCity: z.string().min(2).max(100),
    deliveryState: z.string().min(2).max(100),
    lengthCm: z.coerce.number().positive().max(500),
    widthCm: z.coerce.number().positive().max(500),
    heightCm: z.coerce.number().positive().max(500),
    declaredValue: z.coerce.number().nonnegative().max(10000000),
    packageDescription: z.string().min(3).max(500),
    invoiceNumber: z.string().max(100),
    ewayBill: z.string().regex(/^$|^\d{12}$/, "E-way bill must contain 12 digits"),
    pickupDate: z.iso.date(),
    goodsConsent: z.literal("on"),
    pickupAddress: z.string().min(1, "Pickup address is required"),
    pickupPincode: pincodeSchema,
    deliveryAddress: z.string().min(1, "Delivery address is required"),
    deliveryContactName: z.string().min(1, "Recipient name is required"),
    deliveryContactPhone: z.string().regex(/^(?:\+91)?[6-9]\d{9}$/, "Enter a valid recipient mobile number"),
    deliveryPincode: pincodeSchema,
    weightKg: z.coerce.number().positive().max(1000),
    courierPartnerId: z.string().min(1, "Select a courier"),
    courierBranchId: z.string().min(1),
    providerCourierId: z.string().optional(),
});
export type CreateCustomerBookingState = {
    ok: boolean;
    error?: string;
    trackingCode?: string;
    providerRef?: string;
    message?: string;
};
export async function createCustomerBookingAction(_prev: CreateCustomerBookingState, formData: FormData): Promise<CreateCustomerBookingState> {
    const { customerId, tenantId } = await requireCustomerSession();
    const parsed = bookingSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const data = parsed.data;
    const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    if(data.pickupDate < today) return {ok:false,error:"Choose today or a future pickup date."};
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { onboardingApplication: true, allowedCouriers: true } });
    if (!customer)
        return { ok: false, error: "Account not found — please contact support" };
    const duplicate = await prisma.order.findUnique({ where: { bookingKey: data.bookingKey } });
    if (duplicate)
        return duplicate.customerId === customerId ? { ok: true, trackingCode: duplicate.trackingCode, providerRef: duplicate.providerRef || undefined, message: "Request already recorded. Check tracking for the latest docket status." } : { ok: false, error: "Please reload and try again." };
    if (customer.onboardingApplication && !customer.allowedCouriers.some(c => c.courierPartnerId === data.courierPartnerId))
        return { ok: false, error: "This courier is not allocated to your account." };
    const branch = await prisma.courierBranch.findUnique({
        where: { id: data.courierBranchId },
        include: { courierPartner: true },
    });
    if (!branch || !branch.isActive || branch.courierPartner.status !== "ACTIVE" || branch.courierPartnerId !== data.courierPartnerId) {
        return { ok: false, error: "Selected courier is no longer available — please check rates again" };
    }
    const partner = branch.courierPartner;
    const commission = await getEffectiveCommission(partner.id, partner);
    const zone = determineZone(data.pickupPincode, data.deliveryPincode);
    const sell = await getSellPrice(tenantId, zone, data.weightKg, customerId);
    if (!sell)
        return { ok: false, error: "No agreed rate covers this shipment. Please contact your account manager." };
    const chargedAmount = sell.price;
    const provider = await getCourierProvider(partner);
    if (partner.integrationType === "API" && !provider.createShipment)
        return { ok: false, error: "Courier booking is not configured yet. Please contact support." };
    try {
        const service = await provider.checkServiceability(partner, data.deliveryPincode);
        if (!service.serviceable)
            return { ok: false, error: "Destination is no longer serviceable." };
    }
    catch {
        return { ok: false, error: "Unable to confirm serviceability. Please try later." };
    }
    const platformFeeAmount = computePlatformFee(commission, chargedAmount ?? null);
    let order;
    try {
        order = await prisma.order.create({
            data: {
                bookingKey: data.bookingKey,
                bookingState: provider.createShipment ? "SUBMITTING" : "MANUAL_REVIEW",
                shipmentDetails: { pickupCity: data.pickupCity, pickupState: data.pickupState, deliveryCity: data.deliveryCity, deliveryState: data.deliveryState, lengthCm: data.lengthCm, widthCm: data.widthCm, heightCm: data.heightCm, declaredValue: data.declaredValue, invoiceNumber: data.invoiceNumber, ewayBill: data.ewayBill, pickupDate: data.pickupDate, goodsConsentAt: new Date().toISOString() },
                packageDescription: data.packageDescription,
                trackingCode: generateTrackingCode(),
                tenantId,
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
    }
    catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
            return { ok: false, error: "This request is already being processed. Check your orders before submitting again." };
        throw e;
    }
    if (provider.createShipment) {
        try {
            const result = await provider.createShipment(partner, { ...data, orderId: order.id });
            await prisma.order.update({ where: { id: order.id }, data: { providerRef: result.providerRef, providerLabelUrl: result.labelUrl, bookingState: "CONFIRMED", statusEvents: { create: { status: "CREATED", note: "Courier docket issued: " + result.providerRef } } } });
            return { ok: true, trackingCode: order.trackingCode, providerRef: result.providerRef, message: "Docket issued. Pickup timing is subject to courier confirmation." };
        }
        catch {
            await prisma.order.update({ where: { id: order.id }, data: { bookingState: "RECONCILIATION_REQUIRED", statusEvents: { create: { status: "CREATED", note: "Courier booking outcome needs operations review. Do not rebook until reconciled." } } } });
            return { ok: true, trackingCode: order.trackingCode, message: "Request saved; courier confirmation needs review. Do not submit again. Our operations team will reconcile it." };
        }
    }
    return { ok: true, trackingCode: order.trackingCode, message: "Request saved for manual courier coordination. A docket has not yet been issued." };
}
