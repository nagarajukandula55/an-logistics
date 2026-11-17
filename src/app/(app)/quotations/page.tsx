import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { QuotationsPanel } from "./QuotationsPanel";

export default async function QuotationsPage() {
  await requireOnboardingAdmin();
  const [quotations, applications, couriers, templates, rateCards] = await Promise.all([
    prisma.quotation.findMany({ include: { application: true, customer: true, courierPartner: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.partnerApplication.findMany({ where: { status: { not: "REJECTED" } }, select: { id: true, name: true, company: true, email: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.courierPartner.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.documentTemplate.findMany({ where: { kind: "QUOTATION", isActive: true }, select: { id: true, name: true, version: true, courierPartnerId: true }, orderBy: { updatedAt: "desc" } }),
    prisma.sellRateCard.findMany({ where: { audience: "DEFAULT", tenantId: null, customerId: null, courierPartnerId: { not: null }, isActive: true }, include: { slabs: true }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  return <div className="flex flex-col gap-6">
    <PageHeader eyebrow="Commercial" title="Quotations" description="Prepare courier-specific quotations, preview the final HTML document, and email approved drafts to applicants." actions={<Link href="/onboarding" className="rounded-control border border-border px-3.5 py-2 text-sm font-medium text-ink">Open onboarding</Link>} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card><CardHeader><h2 className="h-section">Quotation register</h2></CardHeader><CardBody><QuotationsPanel quotations={quotations.map(q => ({ id: q.id, quoteNumber: q.quoteNumber, title: q.title, status: q.status, sentAt: q.sentAt, validUntil: q.validUntil, customerName: q.application?.company || q.application?.name || q.customer?.name || "Customer", recipientEmail: q.application?.email || q.customer?.email || null, courierName: q.courierPartner?.name || "Courier" }))} applications={applications} couriers={couriers} templates={templates} rateCards={rateCards.map(c => ({ id: c.id, name: c.name, courierPartnerId: c.courierPartnerId!, slabs: c.slabs }))} /></CardBody></Card>
    </div>
  </div>;
}
