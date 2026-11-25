import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { ActivateForm, PrepareForm, ReviewForm, TemplateForm } from "./Forms";

const statuses = ["NEW", "CONTACTED", "QUOTATION", "NEGOTIATING", "AGREEMENT", "ACTIVE", "REJECTED"] as const;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireOnboardingAdmin();
  const params = await searchParams;
  const selectedStatus = statuses.includes((params.status ?? "") as typeof statuses[number]) ? params.status : undefined;
  const [applications, templates, couriers] = await Promise.all([
    prisma.partnerApplication.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { customer: { include: { agreements: true } }, quotations: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.agreementTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.courierPartner.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
  ]);
  const visible = selectedStatus ? applications.filter((a) => a.status === selectedStatus) : applications;
  return <div className="space-y-8"><div><p className="eyebrow">AN Logistics operations</p><h1 className="h-page">Applications & onboarding</h1><p className="text-ink-2 mt-2">Review applications, discuss rates, send quotations, prepare agreements, allocate couriers and activate partner logins.</p><div className="flex flex-wrap gap-5 mt-4 text-accent text-sm"><Link href="/signup">Public application</Link><Link href="/quotations">Quotations</Link><Link href="/agreements">Agreements & signatures</Link><Link href="/settings/telegram-notifications">Configure signup alerts</Link></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{statuses.map((status) => <Link key={status} href={`/onboarding?status=${status}`} className={`bg-surface border rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-accent ${selectedStatus === status ? "border-accent ring-1 ring-accent" : "border-border"}`}><p className="eyebrow">{status}</p><p className="text-3xl mt-2">{applications.filter((a) => a.status === status).length}</p><p className="mt-2 text-xs text-ink-3">Open applications</p></Link>)}</div>
    {selectedStatus && <p className="text-sm text-ink-2">Showing <strong>{selectedStatus}</strong> applications. <Link href="/onboarding" className="text-accent underline">Show all</Link></p>}
    <div className="space-y-4"><h2 className="h-section">{selectedStatus ? `${selectedStatus} applications` : "Recent applications"}</h2>{!visible.length && <p className="bg-surface p-8 rounded-xl">No applications in this view.</p>}{visible.map((a) => { const quote = a.quotations[0]; return <details key={a.id} className="border border-border bg-surface rounded-xl p-5"><summary className="cursor-pointer"><strong>{a.company || a.name}</strong><span className="text-ink-2 ml-4 text-sm">{a.applicationNumber ? `${a.applicationNumber} · ` : ""}{a.status} · {a.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span></summary><div className="grid lg:grid-cols-3 gap-6 mt-5"><div className="text-sm space-y-2"><p>{a.name} · {a.accountType}</p><p><a href={`mailto:${a.email}`} className="text-accent">{a.email}</a> · <a href={`tel:${a.phone}`} className="text-accent">{a.phone}</a></p><p>{a.address}, {a.pincode}</p><p>Base: {a.baseCity || "Not supplied"} · Pickup: {a.pickupCity || "Not supplied"}</p><p>GSTIN: {a.gstin || "Not supplied"}</p><p>{a.monthlyVolume} shipments / month</p><p className="whitespace-pre-wrap">{a.requirements}</p>{quote && <p><Link className="text-accent" href={`/quotations/${quote.id}`}>Quotation {quote.quoteNumber} · {quote.status}</Link></p>}{a.customer?.agreements.map((g) => <p key={g.id}><Link className="text-accent" href={`/agreements/${g.id}/preview`}>{g.title || g.templateVersion} · {g.status}</Link></p>)}</div>{a.status !== "ACTIVE" ? <><ReviewForm id={a.id} notes={a.notes} status={a.status}/><ActivateForm id={a.id} couriers={couriers}/></> : <p className="text-success">Login enabled. Courier access and signed pricing are assigned.</p>}</div></details>; })}</div>
    <div className="grid lg:grid-cols-2 gap-6"><section className="rounded-xl border border-border bg-surface p-6"><TemplateForm /><ul className="mt-6 text-sm text-ink-2">{templates.map((t) => <li key={t.id}>{t.name} / {t.version} · {t.category}</li>)}</ul></section><section className="rounded-xl border border-border bg-surface p-6"><PrepareForm applications={applications.filter((a) => a.customerId && a.status !== "REJECTED").map((a) => ({ id: a.id, name: a.company || a.name }))} templates={templates}/></section></div>
  </div>;
}
