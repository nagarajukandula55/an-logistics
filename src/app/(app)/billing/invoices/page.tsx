import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "../Tabs";
import { NewInvoiceForm } from "./NewInvoiceForm";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "warning",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "neutral",
};

export default async function InvoicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const [invoices, tenants] = await Promise.all([
    prisma.invoice.findMany({ include: { tenant: true }, orderBy: { createdAt: "desc" } }),
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Billing" title="Invoices" description="What client tenants owe us for platform usage." />
      <Tabs active="invoices" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          {invoices.length === 0 ? (
            <EmptyState kind="empty" title="No invoices yet" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-3">
                      <th className="px-4 py-3 font-medium">Invoice</th>
                      <th className="px-4 py-3 font-medium">Tenant</th>
                      <th className="px-4 py-3 font-medium">Period</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                        <td className="px-4 py-3">
                          <Link href={`/billing/invoices/${inv.id}`} className="text-accent font-medium tabular">
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink">{inv.tenant.name}</td>
                        <td className="px-4 py-3 text-ink-2 text-xs">
                          {inv.periodStart.toLocaleDateString()} – {inv.periodEnd.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular text-ink">₹{inv.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <NewInvoiceForm tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} />
      </div>
    </div>
  );
}
