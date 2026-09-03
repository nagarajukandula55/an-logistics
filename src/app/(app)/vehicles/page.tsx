import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewVehicleForm } from "./NewVehicleForm";
import { VehicleRow } from "./VehicleRow";

export default async function VehiclesPage() {
  const { session, tenantId } = await requireTenantSession();
  if (!["ADMIN", "DISPATCHER"].includes(session.user.role)) redirect("/orders");

  const vehicles = await prisma.vehicle.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });

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
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <VehicleRow key={v.id} vehicle={v} />
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
