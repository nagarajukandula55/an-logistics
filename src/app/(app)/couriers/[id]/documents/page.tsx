import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { renderDtdcLetterheadHtml, renderDtdcSalesAgreementHtml } from "@/lib/dtdc-documents";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function CourierDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOnboardingAdmin();
  const { id } = await params;
  const courier = await prisma.courierPartner.findUnique({ where: { id }, include: { apiConfig: true, rateCards: { include: { slabs: true }, orderBy: { effectiveFrom: "desc" }, take: 1 } } });
  if (!courier) notFound();

  const isDtdc = courier.name.toLowerCase().includes("dtdc") || courier.apiConfig?.provider?.toLowerCase() === "dtdc";
  if (!isDtdc) notFound();

  const letterhead = renderDtdcLetterheadHtml({ title: "AN Logistics · DTDC letterhead", reference: "ANL-DTDC-LH", subject: "DTDC channel partner communication", body: "Prepare the approved DTDC communication here before printing or saving it as PDF." });
  const agreement = renderDtdcSalesAgreementHtml({ agreementNumber: `ANL-DTDC-${courier.id.slice(-6).toUpperCase()}`, customerName: "DTDC Express Limited", terms: "Final commercial terms, validity, taxes and applicable DTDC service charges must be reviewed and signed before use.", rates: courier.rateCards[0]?.slabs.map((slab) => ({ zone: slab.zone, minWeightKg: slab.minWeightKg, maxWeightKg: slab.maxWeightKg, price: slab.price })) ?? [] });

  return <div className="flex flex-col gap-6">
    <PageHeader eyebrow="Courier documents" title={`${courier.name} documents`} description="DTDC reference templates are kept inside the DTDC courier workspace. They do not apply to other courier partners." actions={<Link href={`/couriers/${courier.id}`}><Button variant="secondary">Back to courier</Button></Link>} />
    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardBody className="flex flex-col gap-4"><div><h2 className="h-section">AN Logistics letterhead</h2><p className="mt-1 text-sm text-ink-2">Use for DTDC-specific letters and operational communications.</p></div><iframe title="DTDC letterhead preview" srcDoc={letterhead} className="h-[620px] w-full rounded-lg border border-border bg-white" /></CardBody></Card>
      <Card><CardBody className="flex flex-col gap-4"><div><h2 className="h-section">DTDC sales agreement</h2><p className="mt-1 text-sm text-ink-2">Draft uses this courier&apos;s latest rate card when one is configured.</p></div><iframe title="DTDC sales agreement preview" srcDoc={agreement} className="h-[620px] w-full rounded-lg border border-border bg-white" /></CardBody></Card>
    </div>
  </div>;
}
