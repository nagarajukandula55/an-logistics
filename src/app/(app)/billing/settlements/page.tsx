import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "../Tabs";
import { NewSettlementForm } from "./NewSettlementForm";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  DRAFT: "neutral",
  FINALIZED: "warning",
  PAID: "success",
};

export default async function SettlementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const [settlements, partners] = await Promise.all([
    prisma.settlement.findMany({ include: { courierPartner: true }, orderBy: { createdAt: "desc" } }),
    prisma.courierPartner.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Billing" title="Settlements" description="What we owe courier partners for delivered orders." />
      <Tabs active="settlements" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          {settlements.length === 0 ? (
            <EmptyState kind="empty" title="No settlements yet" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-3">
                      <th className="px-4 py-3 font-medium">Settlement</th>
                      <th className="px-4 py-3 font-medium">Partner</th>
                      <th className="px-4 py-3 font-medium">Period</th>
                      <th className="px-4 py-3 font-medium text-right">Net</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                        <td className="px-4 py-3">
                          <Link href={`/billing/settlements/${s.id}`} className="text-accent font-medium tabular">
                            {s.settlementNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink">{s.courierPartner.name}</td>
                        <td className="px-4 py-3 text-ink-2 text-xs">
                          {s.periodStart.toLocaleDateString()} – {s.periodEnd.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular text-ink">₹{s.netAmount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <NewSettlementForm partners={partners.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
    </div>
  );
}
