import type { CourierPartner } from "@prisma/client";
import { CourierIntegrationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { manualProvider } from "./manual-provider";
import type { CourierProvider } from "./types";

/**
 * Resolves the CourierProvider implementation for a partner. MANUAL
 * partners use our own ServiceArea/RateCard data (manual-provider.ts).
 * API partners are stubbed until a real per-courier adapter is built —
 * adding one later is just: a new file here implementing CourierProvider,
 * branch on apiConfig.provider below, no other code changes needed.
 */
export function getCourierProvider(partner: CourierPartner): CourierProvider {
  if (partner.integrationType === CourierIntegrationType.MANUAL) {
    return manualProvider;
  }

  return {
    async checkServiceability() {
      const apiConfig = await prisma.courierApiConfig.findUnique({ where: { courierPartnerId: partner.id } });
      throw new Error(
        `Real API integration not yet implemented for provider: ${apiConfig?.provider ?? "not configured"}`
      );
    },
    async getQuote() {
      const apiConfig = await prisma.courierApiConfig.findUnique({ where: { courierPartnerId: partner.id } });
      throw new Error(
        `Real API integration not yet implemented for provider: ${apiConfig?.provider ?? "not configured"}`
      );
    },
  };
}
