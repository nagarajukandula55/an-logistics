"use server";

import { z } from "zod";
import { getIndicativeRates } from "@/lib/indicative-pricing";

const schema = z.object({ businessModel: z.enum(["B2B", "B2C", "ECOM", "MIXED", "OTHER"]), baseCity: z.string().min(2), pickupCity: z.string().min(2), monthlyVolume: z.coerce.number().int().min(0) });

export async function previewSignupRates(input: { businessModel: string; baseCity: string; pickupCity: string; monthlyVolume: number }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("Complete business model, cities, and monthly volume to see indicative rates");
  return getIndicativeRates(parsed.data);
}
