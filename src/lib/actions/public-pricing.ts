"use server";

import { z } from "zod";
import { getIndicativeRates } from "@/lib/indicative-pricing";
import { sendEmail } from "@/lib/email";

const schema = z.object({ businessModel: z.enum(["B2B", "B2C", "ECOM", "MIXED", "OTHER"]), baseCity: z.string().min(2), pickupCity: z.string().min(2), monthlyVolume: z.coerce.number().int().min(0) });
export type QuotationRequestState = { ok: boolean; message?: string; error?: string };

export async function previewSignupRates(input: { businessModel: string; baseCity: string; pickupCity: string; monthlyVolume: number }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("Complete business model, cities, and monthly volume to see indicative rates");
  return getIndicativeRates(parsed.data);
}

export async function requestSignupQuotationAction(_previous: QuotationRequestState, formData: FormData): Promise<QuotationRequestState> {
  const parsed = schema.extend({ name: z.string().min(2), email: z.string().email(), company: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Your application details are incomplete." };
  const preview = await getIndicativeRates(parsed.data);
  const escape = (value: string) => value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const rows = preview.rates.slice(0, 24).map((rate) => `<tr><td>${escape(rate.courierName)}</td><td>${escape(rate.serviceCode)}</td><td>${escape(rate.lane)}</td><td>${rate.minWeightKg}-${rate.maxWeightKg} kg</td><td>₹${rate.defaultSellRate.toFixed(2)}</td></tr>`).join("");
  const sent = await sendEmail({ to: parsed.data.email, subject: "AN Logistics indicative quotation", html: `<h2>Indicative quotation for ${escape(parsed.data.company || parsed.data.name)}</h2><p>Pricing basis: ${escape(preview.source)}. These rates are for discussion and become final only after commercial confirmation.</p>${rows ? `<table border="1" cellpadding="6" cellspacing="0"><tr><th>Courier</th><th>Service</th><th>Lane</th><th>Weight</th><th>Indicative sell rate</th></tr>${rows}</table>` : "<p>The detailed schedule is being prepared. Our team will contact you with the final quotation.</p>"}` });
  if (!sent) return { ok: false, error: "Quotation email is not configured yet. Our team will contact you directly." };
  return { ok: true, message: `Indicative quotation sent to ${parsed.data.email}.` };
}
