import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusControls } from "./StatusControls";
import { ExternalLink } from "lucide-react";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { tenant: true, lineItems: { include: { order: true } } },
  });
  if (!invoice) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Invoice"
        title={invoice.invoiceNumber}
        description={invoice.tenant.name}
        actions={<Badge tone={invoice.status === "PAID" ? "success" : "warning"}>{invoice.status}</Badge>}
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
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-ink">
                        {item.description}
                        {item.order && (
                          <span className="text-ink-3 text-xs ml-1">({item.order.trackingCode})</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular text-ink">₹{item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-3 font-medium text-ink">Total</td>
                    <td className="pt-3 text-right tabular font-medium text-ink">₹{invoice.totalAmount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardBody>
          </Card>

          <Link href={`/billing/invoices/${invoice.id}/print`} target="_blank" className="text-accent text-sm flex items-center gap-1 w-fit">
            <ExternalLink className="size-3.5" /> Open printable version
          </Link>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <h2 className="h-section">Status</h2>
          </CardHeader>
          <CardBody>
            <StatusControls invoiceId={invoice.id} currentStatus={invoice.status} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
