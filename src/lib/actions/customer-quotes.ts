"use server";
import { checkPublicServiceabilityAction, type CheckServiceabilityState } from "./public-booking";
import { requireCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { getSellPrice } from "@/lib/sell-pricing";
import { determineZone } from "@/lib/zone";
export async function checkCustomerServiceabilityAction(prev: CheckServiceabilityState, fd: FormData): Promise<CheckServiceabilityState> {
    const { customerId, tenantId } = await requireCustomerSession();
    const result = await checkPublicServiceabilityAction(prev, fd);
    if (!result.ok)
        return result;
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { allowedCouriers: true, onboardingApplication: true } });
    const sell = await getSellPrice(tenantId, determineZone(String(fd.get("pickupPincode")), String(fd.get("deliveryPincode"))), Number(fd.get("weightKg")), customerId);
    if (!sell)
        return { ok: false, error: "No agreed rate covers this route and weight. Please contact your account manager." };
    return { ok: true, quotes: result.quotes?.filter(q => !customer?.onboardingApplication || customer.allowedCouriers.some(c => c.courierPartnerId === q.courierPartnerId)).map(q => ({ ...q, rate: sell.price })) };
}
