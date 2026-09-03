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
  createShipment?(partner: CourierPartner, input: CreateShipmentInput): Promise<CreateShipmentResult>;
  trackShipment?(partner: CourierPartner, providerRef: string): Promise<TrackingResult>;
  cancelShipment?(partner: CourierPartner, providerRef: string): Promise<{ success: boolean }>;
}
