import type { CourierPartner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findServiceableBranchForPartner } from "@/lib/courier-queries";
import { determineZone } from "@/lib/zone";
import type { CourierProvider, QuoteInput, QuoteResult, ServiceabilityResult } from "./types";

/**
 * Provider implementation for MANUAL (non-API) courier partners: today's
 * default. Serviceability and pricing are answered entirely from our own
 * ServiceArea/RateCard data rather than a live courier API call.
 */
export const manualProvider: CourierProvider = {
  async checkServiceability(partner: CourierPartner, pincode: string): Promise<ServiceabilityResult> {
    const branch = await findServiceableBranchForPartner(partner.id, pincode);
    return branch ? { serviceable: true, branchId: branch.id } : { serviceable: false };
  },

  async getQuote(partner: CourierPartner, input: QuoteInput): Promise<QuoteResult | null> {
    const rateCard = await prisma.rateCard.findFirst({
      where: { courierPartnerId: partner.id, isActive: true },
      orderBy: { effectiveFrom: "desc" },
      include: { slabs: { where: { isActive: true } } },
    });
    if (!rateCard) return null;

    const zone = determineZone(input.pickupPincode, input.deliveryPincode);
    const slab = rateCard.slabs.find(
      (s) => s.zone === zone && input.weightKg >= s.minWeightKg && input.weightKg <= s.maxWeightKg
    );
    if (!slab) return null;

    return { price: slab.price, etaDays: undefined };
  },
};
