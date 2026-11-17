import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { DocumentTemplatesPanel } from "./DocumentTemplatesPanel";

export default async function DocumentsPage() {
  await requireOnboardingAdmin();
  const [templates, couriers] = await Promise.all([
    prisma.documentTemplate.findMany({ include: { courierPartner: { select: { name: true } } }, orderBy: [{ kind: "asc" }, { updatedAt: "desc" }] }),
    prisma.courierPartner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <div className="flex flex-col gap-6"><PageHeader eyebrow="Document studio" title="Quotation & agreement templates" description="Edit HTML formats, assign them globally or to a courier, and reuse them while rates remain dynamically loaded into each draft." /><Card><CardBody><DocumentTemplatesPanel templates={templates} couriers={couriers} /></CardBody></Card></div>;
}
