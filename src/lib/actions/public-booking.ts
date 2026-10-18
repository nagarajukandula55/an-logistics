"use server";

import { getCourierProvider } from "@/lib/courier-providers/registry";
import { findServiceableBranches } from "@/lib/courier-queries";
import { z } from "zod";
import { pincodeSchema } from "@/lib/validation";

// Public bookings (no login) roll up under the singleton MARKETPLACE
// tenant seeded in prisma/seed.ts, so they're billable/reportable like any
// other tenant's volume without needing a real account per member of the
// public. Own-network-first, then partner fallback both fall out of
// findServiceableBranches's priority ordering (see courier-queries.ts) —
// no special-casing here.

export type PublicQuote = {
  courierPartnerId: string;
  courierBranchId: string;
  courierName: string;
  rate: number;
  etaDays: number | undefined;
  providerCourierId: string | undefined;
};

const serviceabilitySchema = z.object({
  pickupPincode: pincodeSchema,
  deliveryPincode: pincodeSchema,
  weightKg: z.coerce.number().positive(),
});

export type CheckServiceabilityState = { ok: boolean; error?: string; quotes?: PublicQuote[] };

export async function checkPublicServiceabilityAction(
  _prev: CheckServiceabilityState,
  formData: FormData
): Promise<CheckServiceabilityState> {
  const parsed = serviceabilitySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { pickupPincode, deliveryPincode, weightKg } = parsed.data;

  const branches = await findServiceableBranches(deliveryPincode);
  if (branches.length === 0) {
    return { ok: true, quotes: [] };
  }

  const quotes = await Promise.all(
    branches.map(async (branch) => {
      const partner = branch.courierPartner;
      const provider = await getCourierProvider(partner);
      try {
        const quote = await provider.getQuote(partner, { pickupPincode, deliveryPincode, weightKg });
        if (!quote) return null;
        return {
          courierPartnerId: partner.id,
          courierBranchId: branch.id,
          courierName: partner.name,
          rate: quote.price,
          etaDays: quote.etaDays,
          providerCourierId: quote.providerCourierId,
        };
      } catch {
        return null;
      }
    })
  );

  return { ok: true, quotes: quotes.filter((q): q is PublicQuote => q !== null) };
}

export type CreateBookingState = { ok: boolean; error?: string; trackingCode?: string };
export async function createPublicBookingAction(_prev: CreateBookingState, _formData: FormData): Promise<CreateBookingState> {
  void _prev; void _formData;
  return {ok:false,error:"Please apply at /signup. Shipments can be booked after your agreement and account are approved."};
}
