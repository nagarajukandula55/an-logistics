import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

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
  customerId?: string | null,
  userRole?: UserRole | string | null,
  courierPartnerId?: string | null
): Promise<{ price: number; minMarginPercent: number | null; sellRateCardId: string } | null> {
  const now = new Date();
  const customerCard = customerId
    ? (courierPartnerId ? await prisma.sellRateCard.findFirst({ where: { customerId, courierPartnerId, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } }) : null) ??
      await prisma.sellRateCard.findFirst({ where: { customerId, courierPartnerId: null, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } })
    : null;
  const managed = customerId ? await prisma.partnerApplication.findUnique({ where: { customerId }, select: { id: true } }) : null;
  if(managed && !customerCard) return null;
  const card =
    customerCard ??
    (userRole === "STAFF" || userRole === "COLLABORATOR"
      ? (courierPartnerId ? await prisma.sellRateCard.findFirst({ where: { audience: userRole, courierPartnerId, tenantId: null, customerId: null, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } }) : null) ??
        await prisma.sellRateCard.findFirst({ where: { audience: userRole, courierPartnerId: null, tenantId: null, customerId: null, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } })
      : null) ??
    (tenantId
      ? (courierPartnerId ? await prisma.sellRateCard.findFirst({ where: { audience: "CLIENT", courierPartnerId, tenantId, customerId: null, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } }) : null) ??
        await prisma.sellRateCard.findFirst({ where: { audience: "CLIENT", courierPartnerId: null, tenantId, customerId: null, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } })
      : null) ??
    (courierPartnerId ? await prisma.sellRateCard.findFirst({ where: { audience: "DEFAULT", courierPartnerId, tenantId: null, customerId: null, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } }) : null) ??
    (await prisma.sellRateCard.findFirst({ where: { audience: "DEFAULT", courierPartnerId: null, tenantId: null, customerId: null, isActive: true, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" }, include: { slabs: { where: { isActive: true } } } }));
  if (!card) return null;

  const slab = card.slabs.find((s) => s.zone === zone && weightKg > s.minWeightKg && weightKg <= s.maxWeightKg);
  if (!slab) return null;

  return { price: slab.price, minMarginPercent: card.minMarginPercent, sellRateCardId: card.id };
}

/**
 * Returns the rate card attached to the customer's currently signed,
 * non-expired agreement. This is deliberately separate from the normal
 * fallback resolver: once an agreement is signed, billing must use that
 * agreement and must never silently fall through to a default/staff card.
 */
export async function getSignedCustomerRateCard(customerId?: string | null) {
  if (!customerId) return null;
  const now = new Date();
  const agreement = await prisma.agreement.findFirst({
    where: {
      customerId,
      status: "SIGNED",
      sellRateCardId: { not: null },
      OR: [{ renewalDate: null }, { renewalDate: { gt: now } }],
    },
    orderBy: [{ signedAt: "desc" }, { updatedAt: "desc" }],
    select: { sellRateCardId: true },
  });
  if (!agreement?.sellRateCardId) return null;

  return prisma.sellRateCard.findUnique({
    where: { id: agreement.sellRateCardId },
    include: { slabs: { where: { isActive: true } } },
  });
}

export async function hasSignedCustomerRateAgreement(customerId?: string | null): Promise<boolean> {
  return Boolean(await getSignedCustomerRateCard(customerId));
}

/**
 * Resolves the exact selling rate from the signed agreement's linked card.
 * A null result means either there is no signed agreement or that the
 * agreement has no matching slab; callers that are creating a shipment must
 * distinguish that case and block rather than use another price list.
 */
export async function getSignedCustomerSellPrice(
  customerId: string | null | undefined,
  zone: string,
  weightKg: number
): Promise<{ hasSignedAgreement: boolean; price: number; minMarginPercent: number | null; sellRateCardId: string } | null> {
  const card = await getSignedCustomerRateCard(customerId);
  if (!card) return null;
  const slab = card.slabs.find((s) => s.zone === zone && weightKg > s.minWeightKg && weightKg <= s.maxWeightKg);
  if (!slab) return { hasSignedAgreement: true, price: 0, minMarginPercent: card.minMarginPercent, sellRateCardId: card.id };
  return { hasSignedAgreement: true, price: slab.price, minMarginPercent: card.minMarginPercent, sellRateCardId: card.id };
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
