import type { CourierPartner } from "@prisma/client";
import { CourierIntegrationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { manualProvider } from "./manual-provider";
import { shiprocketProvider } from "./shiprocket-provider";
import type { CourierProvider } from "./types";

const API_PROVIDERS: Record<string, CourierProvider> = {
  SHIPROCKET: shiprocketProvider,
};

/**
 * Resolves the CourierProvider implementation for a partner. MANUAL
 * partners use our own ServiceArea/RateCard data (manual-provider.ts). API
 * partners dispatch by CourierApiConfig.provider — adding a new real
 * integration later is just: a new file implementing CourierProvider,
 * registered in API_PROVIDERS above, no other code changes needed.
 */
export async function getCourierProvider(partner: CourierPartner): Promise<CourierProvider> {
  if (partner.integrationType === CourierIntegrationType.MANUAL) {
    return manualProvider;
  }

  const apiConfig = await prisma.courierApiConfig.findUnique({ where: { courierPartnerId: partner.id } });
  const provider = apiConfig?.provider ? API_PROVIDERS[apiConfig.provider] : undefined;
  if (!provider) {
    const name = apiConfig?.provider ?? "not configured";
    return {
      async checkServiceability() {
        throw new Error(`No adapter implemented for provider: ${name}`);
      },
      async getQuote() {
        throw new Error(`No adapter implemented for provider: ${name}`);
      },
    };
  }
  return provider;
}
