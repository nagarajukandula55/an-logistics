import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Prisma, OrderStatus, AgreementStatus } from "@prisma/client";
import { orderStatusLabel } from "@/components/ui/Badge";
import { subDays, startOfDay, format } from "date-fns";
import {
  OrdersTrendChart,
  StatusBreakdownChart,
  CourierVolumeChart,
  TenantBreakdownChart,
} from "./charts";
import { AgreementRenewalsCard } from "./AgreementRenewalsCard";
import { daysUntil } from "@/lib/date";
import Link from "next/link";

const TREND_DAYS = 14;

const DELIVERED_LIKE: OrderStatus[] = [OrderStatus.DELIVERED];
const IN_TRANSIT_LIKE: OrderStatus[] = [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY];
const PENDING_LIKE: OrderStatus[] = [OrderStatus.CREATED, OrderStatus.ASSIGNED];
const CANCELLED_LIKE: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.FAILED];

export default async function DashboardPage() {
  const { tenantId, isStaff } = await requireTenantSession();
  const tenantScope: Prisma.OrderWhereInput = isStaff ? {} : { tenantId };

  const since = startOfDay(subDays(new Date(), TREND_DAYS - 1));

  const [
    totalOrders,
    statusCounts,
    recentOrders,
    courierGrouped,
    codAgg,
    chargedAgg,
    tenants,
    tenantOrderCounts,
    agreementRenewals,
  ] = await Promise.all([
    prisma.order.count({ where: tenantScope }),
    prisma.order.groupBy({
      by: ["status"],
      where: tenantScope,
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { ...tenantScope, createdAt: { gte: since } },
      select: { createdAt: true, status: true },
    }),
    prisma.order.groupBy({
      by: ["courierPartnerId"],
      where: { ...tenantScope, courierPartnerId: { not: null } },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { ...tenantScope, status: OrderStatus.DELIVERED },
      _sum: { codAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...tenantScope, status: OrderStatus.DELIVERED },
      _sum: { chargedAmount: true },
    }),
    isStaff ? prisma.tenant.findMany({ select: { id: true, name: true, type: true } }) : Promise.resolve([]),
    isStaff
      ? prisma.order.groupBy({ by: ["tenantId"], _count: { _all: true } })
      : Promise.resolve([] as { tenantId: string | null; _count: { _all: number } }[]),
    // Expired or due-within-30-days agreements — surfaced here so staff can
    // proactively send a renewal rather than waiting on the nightly
    // reminder cron (api/cron/agreement-renewals) to flag it by email.
    prisma.agreement.findMany({
      where: {
        status: AgreementStatus.SIGNED,
        renewalDate: { not: null, lte: subDays(new Date(), -30) },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { renewalDate: "asc" },
      take: 10,
    }),
  ]);

  const renewalsWithDaysLeft = agreementRenewals
    .filter((a): a is typeof a & { renewalDate: Date } => a.renewalDate !== null)
    .map((a) => ({ ...a, daysLeft: daysUntil(a.renewalDate) }));

  const courierIds = courierGrouped.map((c) => c.courierPartnerId).filter((id): id is string => !!id);
  const couriers = courierIds.length
    ? await prisma.courierPartner.findMany({ where: { id: { in: courierIds } }, select: { id: true, name: true } })
    : [];
  const courierNameById = new Map(couriers.map((c) => [c.id, c.name]));

  const statusCountMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const deliveredCount = DELIVERED_LIKE.reduce((sum, s) => sum + (statusCountMap.get(s) ?? 0), 0);
  const inTransitCount = IN_TRANSIT_LIKE.reduce((sum, s) => sum + (statusCountMap.get(s) ?? 0), 0);
  const pendingCount = PENDING_LIKE.reduce((sum, s) => sum + (statusCountMap.get(s) ?? 0), 0);
  const cancelledCount = CANCELLED_LIKE.reduce((sum, s) => sum + (statusCountMap.get(s) ?? 0), 0);

  // Build a stable day-by-day series for the last TREND_DAYS days, even for
  // days with zero orders, so the chart doesn't silently skip gaps.
  const trendMap = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const day = format(subDays(new Date(), TREND_DAYS - 1 - i), "MMM d");
    trendMap.set(day, 0);
  }
  for (const order of recentOrders) {
    const day = format(order.createdAt, "MMM d");
    if (trendMap.has(day)) trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
  }
  const trendData = Array.from(trendMap.entries()).map(([day, count]) => ({ day, count }));

  const statusData = Object.values(OrderStatus).map((status) => ({
    status: orderStatusLabel(status),
    count: statusCountMap.get(status) ?? 0,
  }));

  const courierData = courierGrouped
    .map((c) => ({
      name: c.courierPartnerId ? courierNameById.get(c.courierPartnerId) ?? "Unknown" : "Unassigned",
      count: c._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const tenantNameById = new Map(tenants.map((t) => [t.id, t]));
  const tenantData = tenantOrderCounts
    .filter((t) => t.tenantId)
    .map((t) => ({
      name: tenantNameById.get(t.tenantId as string)?.name ?? "Unknown tenant",
      type: tenantNameById.get(t.tenantId as string)?.type ?? "",
      count: t._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const codCollected = codAgg._sum.codAmount ?? 0;
  const revenueCharged = chargedAgg._sum.chargedAmount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={isStaff ? "Cross-tenant view of all orders and fulfillment across AN Group." : "Your orders, fulfillment and revenue at a glance."}
        actions={isStaff ? <div className="flex flex-wrap gap-2"><Link href="/onboarding" className="rounded-control bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover">Review onboarding</Link><Link href="/orders/new" className="rounded-control border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-2">New order</Link></div> : <Link href="/orders/new" className="rounded-control bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover">Create shipment</Link>}
      />

      {isStaff && <div className="rounded-card border border-accent/20 bg-accent-soft px-5 py-4 text-sm text-ink-2"><strong className="text-ink">Admin workspace.</strong> Use onboarding for new customers and courier allocation, agreements for signing and rates, and orders for day-to-day dispatch.</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total orders" value={totalOrders.toLocaleString("en-IN")} />
        <StatTile label="Delivered" value={deliveredCount.toLocaleString("en-IN")} />
        <StatTile label="In transit" value={inTransitCount.toLocaleString("en-IN")} />
        <StatTile label="Pending" value={pendingCount.toLocaleString("en-IN")} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Cancelled / failed" value={cancelledCount.toLocaleString("en-IN")} />
        <StatTile label="COD collected (delivered)" value={`₹${codCollected.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
        <StatTile label="Revenue charged (delivered)" value={`₹${revenueCharged.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
        <StatTile label="Courier partners used" value={courierData.length.toLocaleString("en-IN")} />
      </div>

      <Card>
        <CardBody>
          <h2 className="h-section mb-4">Agreement renewals</h2>
          <AgreementRenewalsCard agreements={renewalsWithDaysLeft} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h2 className="h-section mb-4">Orders — last {TREND_DAYS} days</h2>
            <OrdersTrendChart data={trendData} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="h-section mb-4">Orders by status</h2>
            <StatusBreakdownChart data={statusData} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="h-section mb-4">Volume by courier partner</h2>
            {courierData.length > 0 ? (
              <CourierVolumeChart data={courierData} />
            ) : (
              <p className="text-sm text-ink-3">No orders assigned to a courier partner yet.</p>
            )}
          </CardBody>
        </Card>
        {isStaff && (
          <Card>
            <CardBody>
              <h2 className="h-section mb-4">Orders by tenant</h2>
              {tenantData.length > 0 ? (
                <TenantBreakdownChart data={tenantData} />
              ) : (
                <p className="text-sm text-ink-3">No orders yet.</p>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-ink-3">{label}</p>
        <p className="text-2xl font-semibold text-ink tabular mt-1">{value}</p>
      </CardBody>
    </Card>
  );
}
