import type { CourierPartner } from "@prisma/client";
import { CourierIntegrationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { manualProvider } from "./manual-provider";
import { dtdcProvider } from "./dtdc-provider";
import type { CourierProvider } from "./types";

const API_PROVIDERS: Record<string, CourierProvider> = {
  DTDC: dtdcProvider,
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
  // isActive is the intended kill switch (the "Active" checkbox on the API
  // config panel) — credentials can be saved and tested ahead of go-live
  // without it silently going live, and it can be flipped off later without
  // deleting the stored config. Previously unenforced here, so unchecking
  // "Active" did nothing; a provider with real credentials fired live calls
  // regardless of the flag.
  const provider = apiConfig?.provider && apiConfig.isActive ? API_PROVIDERS[apiConfig.provider] : undefined;
  if (!provider) {
    const name = !apiConfig?.provider
      ? "not configured"
      : !apiConfig.isActive
        ? `${apiConfig.provider} (not active — check "Active" in the API config panel)`
        : apiConfig.provider;
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
