import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { tenant: true, customer: { include: { onboardingApplication: true } }, lineItems: { include: { order: true } } },
  });
  if (!invoice) notFound();
  return <InvoiceDocument invoice={invoice} />;
}
