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

  return <div className="mx-auto flex max-w-7xl flex-col gap-6">
    <header className="rounded-card border border-border bg-surface p-6">
      <p className="eyebrow">AN Logistics operations</p>
      <h1 className="h-page">Applications & onboarding</h1>
      <p className="mt-2 max-w-3xl text-ink-2">One place to review partner applications, send quotations, confirm rates, prepare agreements and activate courier access.</p>
      <nav className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link className="rounded-control bg-accent px-3 py-2 text-white" href="/signup">Public application</Link>
        <Link className="rounded-control border border-border px-3 py-2 text-ink hover:bg-surface-2" href="/quotations">Quotations</Link>
        <Link className="rounded-control border border-border px-3 py-2 text-ink hover:bg-surface-2" href="/agreements">Agreements</Link>
        <Link className="rounded-control border border-border px-3 py-2 text-ink hover:bg-surface-2" href="/settings/telegram-notifications">Telegram settings</Link>
      </nav>
    </header>

    <section aria-label="Application status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {statuses.map((status) => <Link key={status} href={`/onboarding?status=${status}`} className={`rounded-card border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent ${selectedStatus === status ? "border-accent ring-1 ring-accent" : "border-border"}`}><p className="eyebrow">{status}</p><p className="mt-1 text-3xl font-semibold tabular text-ink">{applications.filter((a) => a.status === status).length}</p><p className="mt-1 text-xs text-accent">View applications →</p></Link>)}
    </section>

    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h2 className="h-section">{selectedStatus ? `${selectedStatus} applications` : "Recent applications"}</h2>{selectedStatus && <Link href="/onboarding" className="text-sm text-accent underline">Show all</Link>}</div>
      {!visible.length && <p className="rounded-card border border-border bg-surface p-6 text-sm text-ink-2">No applications in this view.</p>}
      {visible.map((a) => { const quote = a.quotations[0]; return <details key={a.id} className="rounded-card border border-border bg-surface"><summary className="cursor-pointer list-none p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink">{a.company || a.name}</span><span className="text-sm text-ink-2">{a.applicationNumber || "Application number pending"} · {a.status}</span></div><p className="mt-1 text-xs text-ink-3">Submitted {a.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} · Click to review</p></summary><div className="grid gap-6 border-t border-border p-5 lg:grid-cols-3"><div className="space-y-2 text-sm"><p><strong>{a.name}</strong> · {a.accountType}</p><p><a href={`mailto:${a.email}`} className="text-accent">{a.email}</a> · <a href={`tel:${a.phone}`} className="text-accent">{a.phone}</a></p><p>{a.address}, {a.pincode}</p><p>Base: {a.baseCity || "Not supplied"} · Pickup: {a.pickupCity || "Not supplied"}</p><p>GSTIN: {a.gstin || "Not supplied"}</p><p>{a.monthlyVolume} shipments / month</p><p className="whitespace-pre-wrap text-ink-2">{a.requirements}</p><div className="flex flex-wrap gap-3 pt-2">{quote && <Link className="text-accent underline" href={`/quotations/${quote.id}`}>Open quotation</Link>}{a.customer?.agreements.map((g) => <Link key={g.id} className="text-accent underline" href={`/agreements/${g.id}/preview`}>Open agreement</Link>)}</div></div>{a.status !== "ACTIVE" ? <><ReviewForm id={a.id} notes={a.notes} status={a.status}/><ActivateForm id={a.id} couriers={couriers}/></> : <p className="text-success">Login enabled. Courier access and signed pricing are assigned.</p>}</div></details>; })}
    </section>

    <details className="rounded-card border border-border bg-surface"><summary className="cursor-pointer p-5 font-semibold text-ink">Agreement setup tools <span className="ml-2 text-sm font-normal text-ink-3">Template library and draft preparation</span></summary><div className="grid gap-6 border-t border-border p-5 lg:grid-cols-2"><section><TemplateForm /><ul className="mt-6 space-y-1 text-sm text-ink-2">{templates.map((t) => <li key={t.id}>{t.name} / {t.version} · {t.category}</li>)}</ul></section><section><PrepareForm applications={applications.filter((a) => a.customerId && a.status !== "REJECTED").map((a) => ({ id: a.id, name: a.company || a.name }))} templates={templates}/></section></div></details>
  </div>;
}
