import { notFound } from "next/navigation";
import { requireCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";

export default async function PortalInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { customerId } = await requireCustomerSession();
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, customerId }, include: { tenant: true, customer: { include: { onboardingApplication: true } }, lineItems: { include: { order: true } } } });
  if (!invoice) notFound();
  return <InvoiceDocument invoice={invoice} />;
}
