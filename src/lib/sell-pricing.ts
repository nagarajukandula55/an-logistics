import { prisma } from "@/lib/prisma";

/**
 * What we charge for a shipment, as distinct from what a courier charges us
 * (RateCard) or what we pay them out (CourierApiConfig quotes). Resolution
 * order, most specific wins: the order's Customer's own agreed SellRateCard
 * (set via an Agreement — a BUSINESS Customer's staff all share this one
 * card, see Customer.kind), then the tenant-wide card (a commercial/
 * negotiated-rate CLIENT tenant), then the default price list (tenantId
 * null) used for ordinary/normal-user bookings. Mirrors the same
 * zone/weight-slab matching manual-provider.ts uses for RateCard, so the two
 * pricing surfaces behave consistently.
 */
export async function getSellPrice(
  tenantId: string | null | undefined,
  zone: string,
  weightKg: number,
  customerId?: string | null
): Promise<{ price: number; minMarginPercent: number | null; sellRateCardId: string } | null> {
  const managed = customerId ? await prisma.partnerApplication.findUnique({where:{customerId},select:{id:true}}) : null;
  const customerCard = customerId ? await prisma.sellRateCard.findFirst({where:{customerId,isActive:true,effectiveFrom:{lte:new Date()}},orderBy:{effectiveFrom:"desc"},include:{slabs:{where:{isActive:true}}}}) : null;
  if(managed && !customerCard) return null;
  const card =
    customerCard ??
    (tenantId
      ? await prisma.sellRateCard.findFirst({
          where: { tenantId, customerId: null, isActive: true },
          orderBy: { effectiveFrom: "desc" },
          include: { slabs: { where: { isActive: true } } },
        })
      : null) ??
    (await prisma.sellRateCard.findFirst({
      where: { tenantId: null, customerId: null, isActive: true },
      orderBy: { effectiveFrom: "desc" },
      include: { slabs: { where: { isActive: true } } },
    }));
  if (!card) return null;

  const slab = card.slabs.find((s) => s.zone === zone && weightKg > s.minWeightKg && weightKg <= s.maxWeightKg);
  if (!slab) return null;

  return { price: slab.price, minMarginPercent: card.minMarginPercent, sellRateCardId: card.id };
}

/**
 * Whether a computed sell price leaves at least minMarginPercent over a
 * given courier cost. Returns false (not flagged) when no floor is
 * configured for the applicable price list — the floor is an opt-in guard,
 * not a default requirement, since not every business wants one enforced.
 */
export function isBelowMarginFloor(
  sellPrice: number,
  courierCost: number,
  minMarginPercent: number | null
): boolean {
  if (minMarginPercent == null) return false;
  const requiredMargin = sellPrice * (minMarginPercent / 100);
  return sellPrice - courierCost < requiredMargin;
}
