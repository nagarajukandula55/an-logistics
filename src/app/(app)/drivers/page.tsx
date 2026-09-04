import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewDriverForm } from "./NewDriverForm";
import { DriverRow } from "./DriverRow";

export default async function DriversPage() {
  const { session, tenantId, isStaff } = await requireTenantSession();
  if (!["ADMIN", "DISPATCHER"].includes(session.user.role)) redirect("/orders");

  const drivers = await prisma.driver.findMany({
    where: isStaff ? {} : { tenantId },
    include: { user: true, vehicle: true, tenant: true },
    orderBy: { createdAt: "desc" },
  });
  const tenants = isStaff
    ? await prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

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
                      {isStaff && <th className="px-4 py-3 font-medium">Tenant</th>}
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">License</th>
                      <th className="px-4 py-3 font-medium">Vehicle</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <DriverRow key={d.id} driver={d} tenantName={isStaff ? d.tenant?.name ?? "—" : undefined} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <NewDriverForm tenants={tenants} />
      </div>
    </div>
  );
}
