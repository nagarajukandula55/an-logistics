"use server";
import { checkPublicServiceabilityAction, type CheckServiceabilityState } from "./public-booking";
import { requireCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { getSellPrice } from "@/lib/sell-pricing";
import { determineZone } from "@/lib/zone";
import { calculateVolumetricWeight } from "@/lib/volumetric-weight";
export async function checkCustomerServiceabilityAction(prev: CheckServiceabilityState, fd: FormData): Promise<CheckServiceabilityState> {
    const { customerId, tenantId } = await requireCustomerSession();
    const result = await checkPublicServiceabilityAction(prev, fd);
    if (!result.ok)
        return result;
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { allowedCouriers: true, onboardingApplication: true } });
    const weight = calculateVolumetricWeight({ actualWeightKg: Number(fd.get("weightKg")), lengthCm: Number(fd.get("lengthCm")) || undefined, widthCm: Number(fd.get("widthCm")) || undefined, heightCm: Number(fd.get("heightCm")) || undefined });
    const zone = determineZone(String(fd.get("pickupPincode")), String(fd.get("deliveryPincode")));
    const quotes = await Promise.all((result.quotes ?? [])
        .filter(q => !customer?.onboardingApplication || customer.allowedCouriers.some(c => c.courierPartnerId === q.courierPartnerId))
        .map(async (q) => {
            const sell = await getSellPrice(tenantId, zone, weight.chargeableWeightKg, customerId, null, q.courierPartnerId);
            return sell ? { ...q, rate: sell.price } : null;
        }));
    if (quotes.length > 0 && quotes.every((q) => q === null))
        return { ok: false, error: "No agreed rate covers this route and weight. Please contact your account manager." };
    return { ok: true, quotes: quotes.filter((q): q is NonNullable<typeof q> => q !== null) };
}
