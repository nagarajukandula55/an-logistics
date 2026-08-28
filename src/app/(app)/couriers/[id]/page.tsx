import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, courierPartnerStatusTone, enumLabel } from "@/components/ui/Badge";
import { format } from "date-fns";
import { StatusControls } from "./StatusControls";
import { AgreementPanel } from "./AgreementPanel";
import { ApiConfigPanel } from "./ApiConfigPanel";
import { BranchesPanel } from "./BranchesPanel";
import { RateCardsPanel } from "./RateCardsPanel";

export default async function CourierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const partner = await prisma.courierPartner.findUnique({
    where: { id },
    include: {
      branches: { include: { serviceAreas: true }, orderBy: { createdAt: "asc" } },
      agreements: { orderBy: { createdAt: "desc" } },
      apiConfig: true,
      rateCards: { include: { slabs: true }, orderBy: { effectiveFrom: "desc" } },
    },
  });

  if (!partner) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Courier partner"
        title={partner.name}
        description={partner.legalName ?? undefined}
        actions={<Badge tone={courierPartnerStatusTone(partner.status)}>{enumLabel(partner.status)}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Contact & commercial terms</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-ink-3">Contact</p>
                <p className="text-ink">{partner.contactName}</p>
                <p className="text-ink-2">{partner.contactPhone}</p>
                {partner.contactEmail && <p className="text-ink-2">{partner.contactEmail}</p>}
              </div>
              <div>
                <p className="text-ink-3">Integration</p>
                <p className="text-ink">{enumLabel(partner.integrationType)}</p>
              </div>
              <div>
                <p className="text-ink-3">Default commission</p>
                <p className="text-ink tabular">
                  {partner.commissionType === "PERCENT" ? `${partner.commissionValue}%` : `₹${partner.commissionValue.toFixed(2)} flat`}
                </p>
              </div>
              <div>
                <p className="text-ink-3">Onboarded</p>
                <p className="text-ink tabular">{format(partner.createdAt, "MMM d, yyyy")}</p>
              </div>
              {partner.notes && (
                <div className="sm:col-span-2">
                  <p className="text-ink-3">Notes</p>
                  <p className="text-ink-2">{partner.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Branches & service areas</h2>
            </CardHeader>
            <CardBody>
              <BranchesPanel courierPartnerId={partner.id} branches={partner.branches} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Agreements</h2>
            </CardHeader>
            <CardBody>
              <AgreementPanel courierPartnerId={partner.id} agreements={partner.agreements} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Rate cards</h2>
            </CardHeader>
            <CardBody>
              <RateCardsPanel courierPartnerId={partner.id} rateCards={partner.rateCards} />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Status</h2>
            </CardHeader>
            <CardBody>
              <StatusControls courierPartnerId={partner.id} currentStatus={partner.status} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">API configuration</h2>
            </CardHeader>
            <CardBody>
              <ApiConfigPanel courierPartnerId={partner.id} config={partner.apiConfig} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
