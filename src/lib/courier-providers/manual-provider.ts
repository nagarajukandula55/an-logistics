import type { CourierPartner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findServiceableBranchForPartner } from "@/lib/courier-queries";
import { determineZone } from "@/lib/zone";
import type { CourierProvider, QuoteInput, QuoteOption, QuoteResult, ServiceabilityResult } from "./types";

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

  // A manually-onboarded partner (a directly-connected DTDC, Bluedart,
  // etc.) has exactly one rate — wrap getQuote's single result so callers
  // that want a uniform multi-option list (the dispatch UI's per-provider
  // tabs) don't need to special-case providers without a real getQuotes.
  async getQuotes(partner, input: QuoteInput): Promise<QuoteOption[]> {
    const quote = await manualProvider.getQuote(partner, input);
    return quote ? [{ price: quote.price, etaDays: quote.etaDays }] : [];
  },
};
