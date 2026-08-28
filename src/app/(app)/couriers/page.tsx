import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, courierPartnerStatusTone, enumLabel } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus } from "lucide-react";

export default async function CouriersPage() {
  const partners = await prisma.courierPartner.findMany({
    orderBy: { createdAt: "desc" },
    include: { branches: true },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Marketplace"
        title="Courier partners"
        description="Onboard and manage the courier companies and franchises that fulfill orders on your behalf."
        actions={
          <Link href="/couriers/new">
            <Button>
              <Plus className="size-4" /> Onboard courier
            </Button>
          </Link>
        }
      />

      {partners.length === 0 ? (
        <EmptyState
          kind="empty"
          title="No courier partners yet"
          description="Onboard your first courier partner to start routing orders to them."
          action={
            <Link href="/couriers/new">
              <Button size="sm">
                <Plus className="size-4" /> Onboard courier
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-3">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Integration</th>
                  <th className="px-4 py-3 font-medium">Commission</th>
                  <th className="px-4 py-3 font-medium">Branches</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-border last:border-0 hover:bg-surface-2 cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/couriers/${partner.id}`} className="text-accent font-medium">
                        {partner.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {partner.contactName} · {partner.contactPhone}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{enumLabel(partner.integrationType)}</td>
                    <td className="px-4 py-3 text-ink tabular">
                      {partner.commissionType === "PERCENT" ? `${partner.commissionValue}%` : `₹${partner.commissionValue.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-ink-2 tabular">{partner.branches.length}</td>
                    <td className="px-4 py-3">
                      <Badge tone={courierPartnerStatusTone(partner.status)}>{enumLabel(partner.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
