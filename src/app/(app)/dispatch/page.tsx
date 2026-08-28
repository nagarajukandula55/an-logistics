import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, orderStatusTone, orderStatusLabel, fleetStatusTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderStatus } from "@prisma/client";

export default async function DispatchPage() {
  const [pendingOrders, activeOrders, drivers, vehicles] = await Promise.all([
    prisma.order.findMany({
      where: { status: OrderStatus.CREATED },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { status: { in: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY] } },
      include: { customer: true, driver: { include: { user: true } }, vehicle: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.driver.findMany({ include: { user: true, vehicle: true }, orderBy: { status: "asc" } }),
    prisma.vehicle.findMany({ orderBy: { status: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Dispatch" description="Assign drivers and vehicles to waiting orders." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Awaiting dispatch ({pendingOrders.length})</h2>
            </CardHeader>
            <CardBody>
              {pendingOrders.length === 0 ? (
                <EmptyState kind="empty" title="Nothing to dispatch" description="All new orders have been assigned." />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {pendingOrders.map((o) => (
                    <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <Link href={`/orders/${o.id}`} className="text-accent font-medium tabular">
                          {o.trackingCode}
                        </Link>
                        <p className="text-sm text-ink-2">{o.customer.name}</p>
                        <p className="text-xs text-ink-3 max-w-md truncate">
                          {o.pickupAddress} → {o.deliveryAddress}
                        </p>
                      </div>
                      <Link href={`/orders/${o.id}`} className="text-sm text-accent font-medium whitespace-nowrap">
                        Assign →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">In progress ({activeOrders.length})</h2>
            </CardHeader>
            <CardBody>
              {activeOrders.length === 0 ? (
                <EmptyState kind="empty" title="No active shipments" />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {activeOrders.map((o) => (
                    <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <Link href={`/orders/${o.id}`} className="text-accent font-medium tabular">
                          {o.trackingCode}
                        </Link>
                        <p className="text-sm text-ink-2">
                          {o.driver?.user.name ?? "—"} {o.vehicle ? `· ${o.vehicle.registration}` : ""}
                        </p>
                      </div>
                      <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Drivers</h2>
            </CardHeader>
            <CardBody>
              <ul className="flex flex-col divide-y divide-border">
                {drivers.map((d) => (
                  <li key={d.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-ink">{d.user.name}</p>
                      <p className="text-xs text-ink-3">{d.vehicle?.registration ?? "No vehicle"}</p>
                    </div>
                    <Badge tone={fleetStatusTone(d.status)}>{d.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Vehicles</h2>
            </CardHeader>
            <CardBody>
              <ul className="flex flex-col divide-y divide-border">
                {vehicles.map((v) => (
                  <li key={v.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-ink">{v.registration}</p>
                      <p className="text-xs text-ink-3">{v.type}</p>
                    </div>
                    <Badge tone={fleetStatusTone(v.status)}>{v.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
