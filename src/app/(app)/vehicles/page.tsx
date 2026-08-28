import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, fleetStatusTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewVehicleForm } from "./NewVehicleForm";

export default async function VehiclesPage() {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader eyebrow="Fleet" title="Vehicles" description="Vehicles available for assignment to orders." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {vehicles.length === 0 ? (
            <EmptyState kind="empty" title="No vehicles yet" description="Add a vehicle to start dispatching orders." />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-3">
                      <th className="px-4 py-3 font-medium">Registration</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Capacity</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-ink tabular">{v.registration}</td>
                        <td className="px-4 py-3 text-ink-2">{v.type}</td>
                        <td className="px-4 py-3 text-ink-2 tabular">{v.capacityKg ? `${v.capacityKg} kg` : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={fleetStatusTone(v.status)}>{v.status.replace("_", " ")}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <NewVehicleForm />
      </div>
    </div>
  );
}
