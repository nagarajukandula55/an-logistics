import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function SettlementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { courierPartner: true, lineItems: { include: { order: true } } },
  });
  if (!settlement) notFound();

  return (
    <div className="max-w-2xl mx-auto bg-white text-black p-10 print:p-0">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">AN Logistics</h1>
          <p className="text-sm text-gray-600">Settlement {settlement.settlementNumber}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{settlement.courierPartner.name}</p>
        </div>
      </div>

      <div className="flex justify-between text-sm mb-6 text-gray-700">
        <p>
          Period: {settlement.periodStart.toLocaleDateString()} – {settlement.periodEnd.toLocaleDateString()}
        </p>
        <p>Status: {settlement.status}</p>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th className="py-2">Order</th>
            <th className="py-2 text-right">Payout</th>
            <th className="py-2 text-right">Commission</th>
          </tr>
        </thead>
        <tbody>
          {settlement.lineItems.map((item) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-2">{item.order.trackingCode}</td>
              <td className="py-2 text-right">₹{item.payoutAmount.toFixed(2)}</td>
              <td className="py-2 text-right">₹{item.commissionAmount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold">Net payout</td>
            <td className="pt-3 text-right font-semibold" colSpan={2}>
              ₹{settlement.netAmount.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
