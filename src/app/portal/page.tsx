import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/customer-session";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, orderStatusTone, enumLabel } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { format } from "date-fns";

export default async function PortalOrdersPage() {
  const { customerId } = await requireCustomerSession();

  const orders = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Portal"
        title="My orders"
        actions={
          <Link href="/portal/book" className="text-sm text-accent">
            Book a shipment →
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState kind="empty" title="No shipments yet" description="Book your first shipment to see it here." />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li key={order.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <Link href={`/track/${order.trackingCode}`} className="text-ink font-medium tabular hover:text-accent">
                      {order.trackingCode}
                    </Link>
                    <p className="text-xs text-ink-3">
                      {order.deliveryAddress} · {format(order.createdAt, "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {order.chargedAmount != null && <span className="tabular text-sm text-ink">₹{order.chargedAmount.toFixed(2)}</span>}
                    <Badge tone={orderStatusTone(order.status)}>{enumLabel(order.status)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
