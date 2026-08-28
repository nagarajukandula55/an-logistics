import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, fleetStatusTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewDriverForm } from "./NewDriverForm";

export default async function DriversPage() {
  const drivers = await prisma.driver.findMany({
    include: { user: true, vehicle: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader eyebrow="Fleet" title="Drivers" description="Driver accounts used for dispatch and login." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {drivers.length === 0 ? (
            <EmptyState kind="empty" title="No drivers yet" description="Add a driver to start dispatching orders." />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-3">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">License</th>
                      <th className="px-4 py-3 font-medium">Vehicle</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-ink">{d.user.name}</td>
                        <td className="px-4 py-3 text-ink-2">{d.phone}</td>
                        <td className="px-4 py-3 text-ink-2 tabular">{d.licenseNo}</td>
                        <td className="px-4 py-3 text-ink-2">{d.vehicle?.registration ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={fleetStatusTone(d.status)}>{d.status.replace("_", " ")}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <NewDriverForm />
      </div>
    </div>
  );
}
