import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Deliberately not using @react-pdf/renderer or a similar PDF library — a
// print-styled HTML page the browser's own "Print to PDF" handles the same
// job without adding a rendering dependency. Sits inside (app) for the
// admin-only auth gate its layout already provides, but ignores the shell
// chrome entirely so what prints is just the invoice.
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { tenant: true, lineItems: { include: { order: true } } },
  });
  if (!invoice) notFound();

  return (
    <div className="max-w-2xl mx-auto bg-white text-black p-10 print:p-0">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">AN Logistics</h1>
          <p className="text-sm text-gray-600">Invoice {invoice.invoiceNumber}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{invoice.tenant.name}</p>
          {invoice.tenant.billingEmail && <p className="text-gray-600">{invoice.tenant.billingEmail}</p>}
        </div>
      </div>

      <div className="flex justify-between text-sm mb-6 text-gray-700">
        <p>Period: {invoice.periodStart.toLocaleDateString()} – {invoice.periodEnd.toLocaleDateString()}</p>
        <p>Status: {invoice.status}</p>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-2">{item.description}</td>
              <td className="py-2 text-right">₹{item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold">Total</td>
            <td className="pt-3 text-right font-semibold">₹{invoice.totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
