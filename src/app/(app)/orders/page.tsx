import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, orderStatusTone, orderStatusLabel } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus } from "lucide-react";
import { OrderStatus } from "@prisma/client";
import { format } from "date-fns";

const STATUSES = Object.values(OrderStatus);

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status && STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;

  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : undefined,
    include: { customer: true, driver: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Orders"
        description="All shipments, from intake through delivery."
        actions={
          <Link href="/orders/new">
            <Button>
              <Plus className="size-4" /> New order
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link href="/orders">
          <Badge tone={!filter ? "info" : "neutral"} className="cursor-pointer">
            All
          </Badge>
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/orders?status=${s}`}>
            <Badge tone={filter === s ? orderStatusTone(s) : "neutral"} className="cursor-pointer">
              {orderStatusLabel(s)}
            </Badge>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          kind={filter ? "search" : "empty"}
          title={filter ? "No orders with this status" : "No orders yet"}
          description={filter ? "Try a different filter." : "Create your first order to get started."}
          action={
            !filter && (
              <Link href="/orders/new">
                <Button size="sm">
                  <Plus className="size-4" /> New order
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-3">
                  <th className="px-4 py-3 font-medium">Tracking code</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border last:border-0 hover:bg-surface-2 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="tabular text-accent font-medium">
                        {order.trackingCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">{order.customer.name}</td>
                    <td className="px-4 py-3 text-ink-2 max-w-xs truncate">
                      {order.pickupAddress} → {order.deliveryAddress}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{order.driver?.user.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-3 tabular">{format(order.createdAt, "MMM d, HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
