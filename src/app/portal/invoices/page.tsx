import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const tone: Record<string, "success" | "warning" | "danger" | "neutral"> = { DRAFT: "neutral", SENT: "warning", PAID: "success", OVERDUE: "danger", VOID: "neutral" };

export default async function PortalInvoicesPage() {
  const { customerId } = await requireCustomerSession();
  const invoices = await prisma.invoice.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
  return <div className="flex flex-col gap-6">
    <PageHeader eyebrow="Billing" title="My invoices" description="AN Logistics B2B invoices for your shipment bookings." />
    {invoices.length === 0 ? <EmptyState kind="empty" title="No invoices yet" description="Invoices will appear here after your bookings are processed." /> : <Card><CardBody className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-ink-3"><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b border-border last:border-0"><td className="px-4 py-3 font-medium tabular">{invoice.invoiceNumber}</td><td className="px-4 py-3 text-ink-2">{(invoice.issuedAt || invoice.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td className="px-4 py-3 text-right tabular">₹{invoice.totalAmount.toFixed(2)}</td><td className="px-4 py-3"><Badge tone={tone[invoice.status] ?? "neutral"}>{invoice.status}</Badge></td><td className="px-4 py-3 text-right"><Link href={`/portal/invoices/${invoice.id}/print`} target="_blank" className="text-accent">View / print</Link></td></tr>)}</tbody></table></div></CardBody></Card>}
  </div>;
}
