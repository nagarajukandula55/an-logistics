import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-auth";
import { findServiceableBranches, computePlatformFee, getEffectiveCommission } from "@/lib/courier-queries";
import { getCourierProvider } from "@/lib/courier-providers/registry";
import { determineZone } from "@/lib/zone";

const bodySchema = z.object({
  pickupPincode: z.string().min(1),
  deliveryPincode: z.string().min(1),
  weightKg: z.coerce.number().positive(),
  codAmount: z.coerce.number().nonnegative().optional(),
});

// POST /api/v1/rates — ranked courier quotes for a pincode pair, own
// network first (highest CourierPartner.priority), then partners. Shared
// logic with getQuotesForOrder (src/lib/actions/couriers.ts) but operates
// on raw pincodes rather than an existing Order, since a caller (angroup,
// or the future public booking flow) may not have created one yet.
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!auth.scopes.includes("rates:read")) {
    return NextResponse.json({ success: false, message: "Missing scope: rates:read" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { pickupPincode, deliveryPincode, weightKg, codAmount } = parsed.data;

  const branches = await findServiceableBranches(deliveryPincode);
  const zone = determineZone(pickupPincode, deliveryPincode);

  const quotes = await Promise.all(
    branches.map(async (branch) => {
      const partner = branch.courierPartner;
      const provider = await getCourierProvider(partner);

      let quote: { price: number; etaDays?: number; providerCourierId?: string } | null = null;
      try {
        quote = await provider.getQuote(partner, { pickupPincode, deliveryPincode, weightKg });
      } catch {
        quote = null;
      }
      if (!quote) return null;

      const commission = await getEffectiveCommission(partner.id, partner);
      const platformFee = computePlatformFee(commission, codAmount ?? quote.price);

      return {
        courierPartnerId: partner.id,
        courierBranchId: branch.id,
        courierName: partner.name,
        priority: partner.priority,
        zone,
        rate: quote.price,
        etaDays: quote.etaDays ?? null,
        platformFee,
        providerCourierId: quote.providerCourierId ?? null,
      };
    })
  );

  const ranked = quotes
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.rate - b.rate));

  return NextResponse.json({ success: true, data: { quotes: ranked } });
}
