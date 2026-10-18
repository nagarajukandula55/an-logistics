import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AgreementsPanel } from "./AgreementsPanel";
import { NewAgreementForm } from "./NewAgreementForm";
import { daysUntil } from "@/lib/date";

// Agreements between us and the Customers (B2B businesses or B2C
// individuals) who book through the platform — once SIGNED, the agreed
// SellRateCard activates and that's the pricing (single-courier or
// aggregated routing is a separate, courier-side decision) they're served
// under going forward.
export default async function AgreementsPage() {
  await requireOnboardingAdmin();

  const [agreementRows, customers] = await Promise.all([
    prisma.agreement.findMany({
      include: { customer: true, sellRateCard: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      include: { sellRateCards: { orderBy: { effectiveFrom: "desc" } } },
    }),
  ]);

  const agreements = agreementRows.map((a) => ({
    ...a,
    renewalDaysLeft: a.renewalDate ? daysUntil(a.renewalDate) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Customers"
        title="Agreements"
        description="B2B/B2C commercial agreements with customers using the platform — send for e-sign, track renewal dates, and the signed copy is emailed to both sides automatically once complete."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="h-section">All agreements</h2>
            </CardHeader>
            <CardBody>
              <AgreementsPanel agreements={agreements} customers={customers} />
            </CardBody>
          </Card>
        </div>
        <div>
          <NewAgreementForm customers={customers} />
        </div>
      </div>
    </div>
  );
}
