import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Every operational resource (orders, fleet, users, customers) belongs to a
// tenant. ADMIN/DISPATCHER/DRIVER/WAREHOUSE users are provisioned under
// exactly one tenant (see Tenant model doc comment in schema.prisma) and
// should only ever see that tenant's data — CourierPartner data is the one
// exception, since it's a shared routable-provider pool, not tenant-scoped.
export async function requireTenantSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.tenantId) {
    throw new Error("This account is not assigned to a tenant yet — contact an administrator.");
  }
  return { session, tenantId: session.user.tenantId };
}
