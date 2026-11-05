import { requireCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";

export default async function PortalWalletPage() {
  const { customerId } = await requireCustomerSession();
  const wallet = await prisma.wallet.findUnique({
    where: { customerId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { accountType: true, taxRatePercent: true } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Account wallet" title="Shipping wallet" />
      <Card>
        <CardBody className="space-y-2">
          <p className="text-sm text-ink-2">Account type: <strong>{customer?.accountType === "RESELLER" ? "Reseller" : "Client"}</strong></p>
          <p className="text-sm text-ink-2">GST applied to agreed shipping rates: <strong>{customer?.taxRatePercent ?? 18}%</strong></p>
          <p className="text-3xl font-semibold tabular">₹{(wallet?.balance ?? 0).toFixed(2)}</p>
          <p className="text-sm text-ink-2">Every shipment booking debits the agreed rate plus applicable GST from this balance.</p>
          {!wallet && <p className="text-sm text-warning">Add funds through operations before booking your first shipment.</p>}
        </CardBody>
      </Card>
      <Card>
        <CardBody className="p-0">
          <h2 className="p-4 font-medium">Wallet activity</h2>
          {!wallet?.transactions.length ? <p className="p-4 text-sm text-ink-2">No wallet transactions yet.</p> : <ul className="divide-y divide-border">{wallet.transactions.map((tx) => <li key={tx.id} className="p-4 flex items-center justify-between gap-4"><div><p className="text-sm">{tx.note || (tx.type === "CREDIT" ? "Wallet credit" : "Shipment purchase")}</p><p className="text-xs text-ink-3">{tx.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div><span className={`tabular font-medium ${tx.type === "CREDIT" ? "text-success" : "text-ink"}`}>{tx.type === "CREDIT" ? "+" : "−"}₹{tx.amount.toFixed(2)}</span></li>)}</ul>}
        </CardBody>
      </Card>
    </div>
  );
}
