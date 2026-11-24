"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";
import { requestSignupQuotationAction } from "@/lib/actions/public-pricing";
import type { OnboardingState } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/Button";

export function SignupSuccess({ state }: { state: OnboardingState }) {
  const [quotationState, quotationAction, pending] = useActionState(requestSignupQuotationAction, { ok: false });
  const applicant = state.applicant;
  const preview = state.ratePreview;
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof preview extends undefined ? never[] : NonNullable<typeof preview>["rates"]>();
    for (const rate of preview?.rates ?? []) groups.set(rate.categoryLabel, [...(groups.get(rate.categoryLabel) ?? []), rate]);
    return [...groups.entries()];
  }, [preview]);
  return <div role="status" className="rounded-2xl border border-success/30 bg-success-soft p-6 text-success">
    <h2 className="text-xl font-semibold">Application submitted successfully</h2>
    <p className="mt-2">{state.message}</p>
    {preview && <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-ink">
      <p className="text-sm text-ink-2">Selected rate categories: <strong>{preview.source}</strong></p>
      <p className="mt-1 text-xs text-ink-3">These are indicative seller rates for discussion only. They are not final and may change after serviceability, volume, tax, surcharge, and commercial review. Final rates will be frozen in the signed agreement.</p>
      {state.quotationSent && <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">The applied quotation has also been sent to your email. Each selected category is shown separately.</p>}
      {grouped.length ? <div className="mt-4 space-y-5">{grouped.map(([category, rates]) => <section key={category} className="overflow-auto rounded-lg border border-border"><h3 className="border-b border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-ink">{category}</h3><table className="w-full min-w-[620px] text-left text-xs"><thead className="sticky top-0 bg-surface-2 text-ink-3"><tr><th className="px-2 py-2">Courier</th><th className="px-2 py-2">Service</th><th className="px-2 py-2">Lane</th><th className="px-2 py-2">Weight</th><th className="px-2 py-2">Indicative seller rate</th></tr></thead><tbody>{rates.slice(0, 80).map((rate, index) => <tr key={`${category}-${rate.courierName}-${rate.serviceCode}-${rate.lane}-${index}`} className="border-t border-border/70"><td className="px-2 py-2">{rate.courierName}</td><td className="px-2 py-2">{rate.serviceCode}</td><td className="px-2 py-2">{rate.lane}</td><td className="px-2 py-2">{rate.minWeightKg}-{rate.maxWeightKg} kg</td><td className="px-2 py-2 font-medium">Rs. {rate.defaultSellRate.toFixed(2)}</td></tr>)}</tbody></table></section>)}</div> : <p className="mt-4 text-sm text-ink-2">The applicable detailed schedule is being prepared. Our team will contact you with the rate table.</p>}
      {applicant && <form action={quotationAction} className="mt-5 flex flex-col gap-3"><input type="hidden" name="name" value={applicant.name}/><input type="hidden" name="email" value={applicant.email}/><input type="hidden" name="businessModel" value={applicant.businessModel}/><input type="hidden" name="baseCity" value={applicant.baseCity}/><input type="hidden" name="basePincode" value={applicant.basePincode}/><input type="hidden" name="pickupCity" value={applicant.pickupCity}/><input type="hidden" name="pickupPincode" value={applicant.pickupPincode}/><input type="hidden" name="monthlyVolume" value={applicant.monthlyVolume}/><Button type="submit" loading={pending}>Resend applied quotation</Button>{quotationState.error && <p className="text-sm text-danger">{quotationState.error}</p>}{quotationState.message && <p className="text-sm text-success">{quotationState.message}</p>}</form>}
    </div>}
    <Link href="/" className="mt-6 inline-block underline">Back to home</Link>
  </div>;
}
