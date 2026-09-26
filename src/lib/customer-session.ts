import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Guard for the self-service customer portal (src/app/portal/**) — distinct
// from requireTenantSession (src/lib/tenant.ts), which is for staff/tenant
// operators. A CUSTOMER-role user is scoped to exactly one Customer record
// (never a whole tenant's data), set at signup (see
// src/lib/actions/customer-signup.ts) and carried in the session via
// User.customerId (src/auth.ts, src/auth.config.ts).
export async function requireCustomerSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    // A staff/dispatcher account wandered into the customer portal by URL —
    // send them back to their own home instead of erroring.
    redirect("/dashboard");
  }
  return { session, customerId: session.user.customerId, tenantId: session.user.tenantId };
}
