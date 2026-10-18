import { requireTenantSession } from "@/lib/tenant";

export async function requireOnboardingAdmin() {
  const context = await requireTenantSession();
  if (!context.isStaff || context.session.user.role !== "ADMIN") throw new Error("Only an internal administrator can manage onboarding.");
  return context;
}

