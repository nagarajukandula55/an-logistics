import type { CourierPartner } from "@prisma/client";

export type ServiceabilityResult = {
  serviceable: boolean;
  branchId?: string;
};

export type QuoteInput = {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number;
};

export type QuoteResult = {
  price: number;
  etaDays?: number;
};

/**
 * Pluggable per-courier integration surface. MANUAL partners (today's
 * default) are backed by our own ServiceArea/RateCard data. Adding a real
 * per-courier adapter later (Delhivery, DTDC, etc.) means adding a new file
 * here that implements this interface and branching on
 * CourierApiConfig.provider in registry.ts — no other code changes needed.
 */
export interface CourierProvider {
  checkServiceability(partner: CourierPartner, pincode: string): Promise<ServiceabilityResult>;
  getQuote(partner: CourierPartner, input: QuoteInput): Promise<QuoteResult | null>;
}
