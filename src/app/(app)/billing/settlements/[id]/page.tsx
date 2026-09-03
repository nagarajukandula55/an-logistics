import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusControls } from "./StatusControls";
import { ExternalLink } from "lucide-react";

export default async function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const { id } = await params;
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { courierPartner: true, lineItems: { include: { order: true } } },
  });
  if (!settlement) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Settlement"
        title={settlement.settlementNumber}
        description={settlement.courierPartner.name}
        actions={<Badge tone={settlement.status === "PAID" ? "success" : "warning"}>{settlement.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Line items</h2>
            </CardHeader>
            <CardBody>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-3">
                    <th className="py-2 font-medium">Order</th>
                    <th className="py-2 font-medium text-right">Payout</th>
                    <th className="py-2 font-medium text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-ink tabular">{item.order.trackingCode}</td>
                      <td className="py-2 text-right tabular text-ink">₹{item.payoutAmount.toFixed(2)}</td>
                      <td className="py-2 text-right tabular text-ink-2">₹{item.commissionAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-3 font-medium text-ink">Net payout</td>
                    <td className="pt-3 text-right tabular font-medium text-ink" colSpan={2}>
                      ₹{settlement.netAmount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardBody>
          </Card>

          <Link href={`/billing/settlements/${settlement.id}/print`} target="_blank" className="text-accent text-sm flex items-center gap-1 w-fit">
            <ExternalLink className="size-3.5" /> Open printable version
          </Link>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <h2 className="h-section">Status</h2>
          </CardHeader>
          <CardBody>
            <StatusControls settlementId={settlement.id} currentStatus={settlement.status} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
