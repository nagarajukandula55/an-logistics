import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, orderStatusTone, orderStatusLabel } from "@/components/ui/Badge";
import { format } from "date-fns";

export default async function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const order = await prisma.order.findUnique({
    where: { trackingCode: code },
    include: { statusEvents: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) notFound();

  return (
    <div className="min-h-screen bg-bg p-4 flex justify-center">
      <div className="w-full max-w-lg py-10">
        <div className="mb-6 text-center">
          <p className="eyebrow mb-1">AN Logistics</p>
          <h1 className="h-page tabular">{order.trackingCode}</h1>
          <div className="mt-2">
            <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
          </div>
        </div>

        <Card>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-ink-3">From</p>
                <p className="text-ink">{order.pickupAddress}</p>
              </div>
              <div>
                <p className="text-ink-3">To</p>
                <p className="text-ink">{order.deliveryAddress}</p>
              </div>
            </div>

            <h2 className="h-section mb-3">Tracking history</h2>
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
    </div>
  );
}
