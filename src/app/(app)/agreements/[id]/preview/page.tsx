import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
export default async function Preview({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    await requireOnboardingAdmin();
    const { id } = await params;
    const a = await prisma.agreement.findUnique({ where: { id }, include: { customer: true, sellRateCard: { include: { slabs: true } } } });
    if (!a)
        notFound();
    const rows = (Array.isArray(a.rateSnapshot) ? a.rateSnapshot : []) as {
        zone: string;
        minWeightKg: number;
        maxWeightKg: number;
        price: number;
    }[];
    return <article className="max-w-4xl mx-auto bg-surface border border-border rounded-xl p-8 space-y-6 print:border-0"><Link className="text-accent print:hidden" href="/agreements">← Agreements</Link><p className="eyebrow">{a.status} · {a.templateVersion}</p><h1 className="h-page">{a.title || "Shipping agreement"}</h1><p>Partner: {a.customer.name}<br />{a.customer.address}<br />Signatory: {a.signerName} · {a.signerEmail}</p><p className="whitespace-pre-wrap leading-relaxed">{a.termsSnapshot || "This legacy agreement uses an externally prepared document."}</p><h2 className="h-section">Commercial schedule · INR</h2><p>Effective from: {a.sellRateCard?.effectiveFrom.toISOString().slice(0, 10) || "As specified in document"}</p><table className="w-full text-left text-sm"><thead><tr><th>Zone</th><th>Above kg</th><th>Up to kg</th><th>Rate INR</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border"><td className="py-3">{r.zone}</td><td>{r.minWeightKg}</td><td>{r.maxWeightKg}</td><td>{r.price.toFixed(2)}</td></tr>)}</tbody></table><div className="py-8 break-inside-avoid"><p>Partner signature</p><p className="whitespace-nowrap mt-4">{"{{Signature:Recipient1*}}"}</p><p className="mt-6">Date: {"{{Signdate}}"}</p></div><p className="text-xs text-ink-2">Reference: {a.id}. Signed document and signing audit trail take precedence over this preview.</p><p className="print:hidden text-sm bg-warning-soft p-4">For signing, export the reviewed terms and schedule to PDF, store it on your approved document host, and set its URL using Edit in Agreements. Verify the PDF matches this preview before sending.</p></article>;
}
