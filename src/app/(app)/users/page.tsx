import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserRow } from "./UserRow";
import { CreateUserForm } from "./CreateUserForm";

export default async function UsersPage() {
  const { session, tenantId, isStaff } = await requireTenantSession();
  if (session.user.role !== "ADMIN") redirect("/orders");

  const users = await prisma.user.findMany({
    where: isStaff ? {} : { tenantId },
    include: { tenant: true, courierAssignments: { select: { courierPartnerId: true } } },
    orderBy: { createdAt: "desc" },
  });
  const tenants = isStaff ? await prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const couriers = await prisma.courierPartner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Accounts that can sign in to AN Logistics. Reset a password to force a temporary one on next login."
      />

      <CreateUserForm tenants={tenants} />

      {users.length === 0 ? (
        <EmptyState kind="empty" title="No users yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-3">
                  <th className="px-4 py-3 font-medium">Name</th>
                  {isStaff && <th className="px-4 py-3 font-medium">Tenant</th>}
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={session.user.id}
                    tenantName={isStaff ? u.tenant?.name ?? "—" : undefined}
                    couriers={couriers}
                    assignedCourierIds={u.courierAssignments.map((a) => a.courierPartnerId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
