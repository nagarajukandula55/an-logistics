"use client";
import { useActionState } from "react";
import Link from "next/link";
import { applyPartnerAction } from "@/lib/actions/onboarding";
import { Input, Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
export function ApplicationForm() {
    const [state, action, pending] = useActionState(applyPartnerAction, { ok: false });
    if (state.ok)
        return <div role="status" className="rounded-2xl bg-success-soft p-8 text-success"><h2 className="text-xl font-semibold mb-3">Thank you for applying.</h2><p>{state.message}</p><Link href="/" className="inline-block mt-6 underline">Back to home</Link></div>;
    return <form action={action} className="grid sm:grid-cols-2 gap-5 rounded-2xl border border-border bg-surface p-6">
 {[["name", "Your full name", "text"], ["email", "Email address", "email"], ["phone", "Mobile number", "tel"], ["company", "Business / trading name (optional)", "text"]].map(([name, label, type]) => <Field key={name} label={label} htmlFor={name}><Input id={name} name={name} type={type} required={name !== "company"} maxLength={254}/></Field>)}
 <Field label="I’m applying as" htmlFor="accountType"><select id="accountType" name="accountType" className="w-full border border-border rounded-lg p-2 bg-surface"><option value="business">Business shipper</option><option value="individual">Individual</option><option value="reseller">Reseller / shipping partner</option></select></Field>
 <Field label="Estimated shipments per month" htmlFor="monthlyVolume"><Input id="monthlyVolume" name="monthlyVolume" type="number" min="0" max="10000000" required/></Field>
 <Field label="What are you shipping?" htmlFor="shipmentType"><select id="shipmentType" name="shipmentType" required className="w-full border border-border rounded-lg p-2 bg-surface"><option value="">Select one</option><option>E-commerce orders</option><option>Documents</option><option>Apparel and fashion</option><option>Electronics</option><option>Food and packaged goods</option><option>Industrial or commercial goods</option><option>Personal shipments</option><option>Mixed shipments</option><option>Other</option></select></Field>
 <Field label="Service you need" htmlFor="servicePreference"><select id="servicePreference" name="servicePreference" required className="w-full border border-border rounded-lg p-2 bg-surface"><option value="">Select one</option><option>Domestic surface delivery</option><option>Domestic express delivery</option><option>COD delivery</option><option>Returns and reverse logistics</option><option>International shipping consultation</option><option>Multiple services</option><option>Not sure yet</option></select></Field>
 <Field label="Pickup frequency" htmlFor="pickupFrequency"><select id="pickupFrequency" name="pickupFrequency" required className="w-full border border-border rounded-lg p-2 bg-surface"><option value="">Select one</option><option>One-time shipment</option><option>Daily</option><option>Several times a week</option><option>Weekly</option><option>Monthly</option><option>Seasonal or occasional</option></select></Field>
 <div className="sm:col-span-2"><Field label="Business / pickup address" htmlFor="address"><Input id="address" name="address" required minLength={10} maxLength={1000}/></Field></div>
 <Field label="Pickup pincode" htmlFor="pincode"><Input id="pincode" name="pincode" required pattern="[1-9][0-9]{5}" maxLength={6}/></Field>
 <Field label="GSTIN (if applicable)" htmlFor="gstin"><Input id="gstin" name="gstin" maxLength={15}/></Field>
 <label className="sm:col-span-2 text-sm">What do you ship? Any special requirements?<textarea name="requirements" className="mt-2 w-full rounded-lg border border-border bg-surface p-3" rows={3} maxLength={2000}/></label>
 <input name="website" aria-hidden="true" tabIndex={-1} autoComplete="off" className="hidden"/>
 <label className="sm:col-span-2 flex gap-3 text-sm text-ink-2"><input name="consent" type="checkbox" required className="mt-1"/><span>I have read the <Link href="/privacy" className="underline text-accent">privacy notice</Link> and agree to be contacted about this application.</span></label>
 {state.error && <p role="alert" className="text-danger sm:col-span-2">{state.error}</p>}<Button type="submit" loading={pending}>Submit application</Button>
 </form>;
}
