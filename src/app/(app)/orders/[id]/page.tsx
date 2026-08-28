import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, orderStatusTone, orderStatusLabel } from "@/components/ui/Badge";
import { format } from "date-fns";
import { OrderStatus } from "@prisma/client";
import { DispatchPanel } from "./DispatchPanel";
import { StatusControls } from "./StatusControls";
import { PodPanel } from "./PodPanel";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: { include: { user: true } },
      vehicle: true,
      statusEvents: { orderBy: { createdAt: "desc" } },
      proofOfDelivery: true,
    },
  });

  if (!order) notFound();

  const availableDrivers = await prisma.driver.findMany({
    where: { status: "AVAILABLE" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const availableVehicles = await prisma.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { createdAt: "asc" },
  });

  const needsDispatch = order.status === OrderStatus.CREATED;
  const showPod = order.status === OrderStatus.OUT_FOR_DELIVERY;

  return (
    <div>
      <PageHeader
        eyebrow="Order"
        title={order.trackingCode}
        description={order.customer.name}
        actions={<Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Route</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="eyebrow mb-1">Pickup</p>
                <p className="text-sm text-ink">{order.pickupAddress}</p>
                <p className="text-sm text-ink-2 mt-1">
                  {order.pickupContactName} · {order.pickupContactPhone}
                </p>
              </div>
              <div>
                <p className="eyebrow mb-1">Delivery</p>
                <p className="text-sm text-ink">{order.deliveryAddress}</p>
                <p className="text-sm text-ink-2 mt-1">
                  {order.deliveryContactName} · {order.deliveryContactPhone}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Package</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-ink-3">Weight</p>
                <p className="text-ink tabular">{order.weightKg ? `${order.weightKg} kg` : "—"}</p>
              </div>
              <div>
                <p className="text-ink-3">COD amount</p>
                <p className="text-ink tabular">{order.codAmount ? `₹${order.codAmount.toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-ink-3">Description</p>
                <p className="text-ink">{order.packageDescription ?? "—"}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Status timeline</h2>
            </CardHeader>
            <CardBody>
              <ol className="flex flex-col gap-4">
                {order.statusEvents.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className="size-2 rounded-full bg-accent" />
                      <span className="w-px flex-1 bg-border" />
                    </div>
                    <div className="pb-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={orderStatusTone(event.status)}>{orderStatusLabel(event.status)}</Badge>
                        <span className="text-xs text-ink-3 tabular">{format(event.createdAt, "MMM d, yyyy HH:mm")}</span>
                      </div>
                      {event.note && <p className="text-sm text-ink-2 mt-1">{event.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Assignment</h2>
            </CardHeader>
            <CardBody>
              {order.driver ? (
                <div className="flex flex-col gap-2 text-sm">
                  <div>
                    <p className="text-ink-3">Driver</p>
                    <p className="text-ink">{order.driver.user.name}</p>
                    <p className="text-ink-3">{order.driver.phone}</p>
                  </div>
                  {order.vehicle && (
                    <div>
                      <p className="text-ink-3">Vehicle</p>
                      <p className="text-ink">
                        {order.vehicle.registration} <span className="text-ink-3">({order.vehicle.type})</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : needsDispatch ? (
                <DispatchPanel orderId={order.id} drivers={availableDrivers} vehicles={availableVehicles} />
              ) : (
                <p className="text-sm text-ink-3">Not assigned.</p>
              )}
            </CardBody>
          </Card>

          {order.driver && !showPod && order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.FAILED && order.status !== OrderStatus.CANCELLED && (
            <Card>
              <CardHeader>
                <h2 className="h-section">Advance status</h2>
              </CardHeader>
              <CardBody>
                <StatusControls orderId={order.id} currentStatus={order.status} />
              </CardBody>
            </Card>
          )}

          {showPod && (
            <Card>
              <CardHeader>
                <h2 className="h-section">Proof of delivery</h2>
              </CardHeader>
              <CardBody>
                <PodPanel orderId={order.id} />
              </CardBody>
            </Card>
          )}

          {order.proofOfDelivery && (
            <Card>
              <CardHeader>
                <h2 className="h-section">Delivery confirmation</h2>
              </CardHeader>
              <CardBody className="text-sm flex flex-col gap-1">
                <p className="text-ink">
                  Signed by <span className="font-medium">{order.proofOfDelivery.signedByName}</span>
                </p>
                {order.proofOfDelivery.notes && <p className="text-ink-2">{order.proofOfDelivery.notes}</p>}
                <p className="text-ink-3 tabular text-xs">{format(order.proofOfDelivery.createdAt, "MMM d, yyyy HH:mm")}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody className="text-sm">
              <p className="text-ink-3">Public tracking link</p>
              <Link href={`/track/${order.trackingCode}`} className="text-accent break-all" target="_blank">
                /track/{order.trackingCode}
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
