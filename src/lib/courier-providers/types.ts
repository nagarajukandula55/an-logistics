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
  // Provider-specific identifier for the exact courier/rate quoted (e.g.
  // Shiprocket's courier_company_id) — required by createShipment to book
  // the same option the quote was generated for.
  providerCourierId?: string;
};

// A single bookable option within a provider's quote — most providers
// (MANUAL partners like a directly-onboarded DTDC or Bluedart) have exactly
// one, but an aggregator like Shiprocket returns many (one per courier in
// its own network) that should all be selectable, not just the cheapest.
export type QuoteOption = {
  price: number;
  etaDays?: number;
  providerCourierId?: string;
  label?: string; // e.g. Shiprocket's own courier_name, distinguishing options within one provider
};

export type CreateShipmentInput = {
  orderId: string;
  pickupPincode: string;
  deliveryAddress: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPincode: string;
  deliveryContactName: string;
  deliveryContactPhone: string;
  weightKg: number;
  packageDescription?: string;
  codAmount?: number | null;
  providerCourierId?: string;
};

export type CreateShipmentResult = {
  providerRef: string; // AWB or equivalent tracking reference
  labelUrl?: string;
};

export type TrackingResult = {
  status: string;
  raw?: unknown;
};

/**
 * Pluggable per-courier integration surface. MANUAL partners (today's
 * default) are backed by our own ServiceArea/RateCard data. createShipment/
 * trackShipment/cancelShipment are optional so MANUAL partners (dispatched
 * by phone/WhatsApp coordination, not an API) don't need to implement them.
 * Adding a real per-courier adapter later (Delhivery, DTDC, etc.) means
 * adding a new file here that implements this interface and branching on
 * CourierApiConfig.provider in registry.ts — no other code changes needed.
 */
export interface CourierProvider {
  checkServiceability(partner: CourierPartner, pincode: string): Promise<ServiceabilityResult>;
  getQuote(partner: CourierPartner, input: QuoteInput): Promise<QuoteResult | null>;
  // All bookable options this provider has for the lane, not just the
  // cheapest — lets the dispatch UI show every real courier an aggregator
  // (Shiprocket) offers, grouped under that provider's own tab, rather than
  // silently collapsing to one. Providers that only ever have one option
  // (MANUAL partners) can omit this — callers fall back to wrapping
  // getQuote's single result.
  getQuotes?(partner: CourierPartner, input: QuoteInput): Promise<QuoteOption[]>;
  createShipment?(partner: CourierPartner, input: CreateShipmentInput): Promise<CreateShipmentResult>;
  trackShipment?(partner: CourierPartner, providerRef: string): Promise<TrackingResult>;
  cancelShipment?(partner: CourierPartner, providerRef: string): Promise<{ success: boolean }>;
}
