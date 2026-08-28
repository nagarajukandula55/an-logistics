import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, orderStatusTone, orderStatusLabel } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { OrderStatus, Prisma } from "@prisma/client";
import { format } from "date-fns";
import { OrderSearchForm } from "./OrderSearchForm";

const STATUSES = Object.values(OrderStatus);
const PAGE_SIZE = 25;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status, q, page: pageParam } = await searchParams;
  const filter = status && STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const search = q?.trim() || undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(filter ? { status: filter } : {}),
    ...(search
      ? {
          OR: [
            { trackingCode: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);

  const orders = await prisma.order.findMany({
    where,
    include: { customer: true, driver: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
    skip: (clampedPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const pageQuery = (p: number) => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (search) params.set("q", search);
    params.set("page", String(p));
    return `/orders?${params.toString()}`;
  };

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

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={search ? `/orders?q=${encodeURIComponent(search)}` : "/orders"}>
            <Badge tone={!filter ? "info" : "neutral"} className="cursor-pointer">
              All
            </Badge>
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/orders?status=${s}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
            >
              <Badge tone={filter === s ? orderStatusTone(s) : "neutral"} className="cursor-pointer">
                {orderStatusLabel(s)}
              </Badge>
            </Link>
          ))}
        </div>
        <OrderSearchForm defaultValue={search ?? ""} status={filter} />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          kind={filter || search ? "search" : "empty"}
          title={filter || search ? "No orders match" : "No orders yet"}
          description={filter || search ? "Try a different filter or search term." : "Create your first order to get started."}
          action={
            !filter && !search && (
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

      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink-3">
          <p>
            Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, total)} of {total} order
            {total === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            {clampedPage > 1 ? (
              <Link href={pageQuery(clampedPage - 1)}>
                <Button variant="secondary" size="sm">
                  <ChevronLeft className="size-4" /> Previous
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                <ChevronLeft className="size-4" /> Previous
              </Button>
            )}
            <span className="tabular px-1">
              Page {clampedPage} of {totalPages}
            </span>
            {clampedPage < totalPages ? (
              <Link href={pageQuery(clampedPage + 1)}>
                <Button variant="secondary" size="sm">
                  Next <ChevronRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                Next <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
