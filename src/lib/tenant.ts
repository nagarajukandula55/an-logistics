import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Every operational resource (orders, fleet, users, customers) belongs to a
// tenant. ADMIN/DISPATCHER/DRIVER/WAREHOUSE users are provisioned under
// exactly one tenant (see Tenant model doc comment in schema.prisma) and
// should only ever see that tenant's data — CourierPartner data is the one
// exception, since it's a shared routable-provider pool, not tenant-scoped.
//
// The one deliberate exception to strict single-tenant scoping: a user whose
// own tenant is INTERNAL (AN Group staff) is treated as staff and can see
// and manage every tenant's data from one login. A user whose tenant is
// CLIENT (or MARKETPLACE) keeps the exact single-tenant-only behavior —
// that isolation boundary must never be weakened, since it's what keeps a
// real external client's data private to them.
export async function requireTenantSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.tenantId) {
    throw new Error("This account is not assigned to a tenant yet — contact an administrator.");
  }
  const isStaff = session.user.tenantType === "INTERNAL";
  return { session, tenantId: session.user.tenantId, isStaff };
}
