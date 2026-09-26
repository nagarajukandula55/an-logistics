import { prisma } from "@/lib/prisma";
import { TenantType } from "@prisma/client";

// The singleton bucket public/self-service bookings and signups roll up to
// when there's no negotiated commercial (CLIENT) tenant involved — see the
// TenantType doc comment in schema.prisma. Shared by the anonymous public
// booking flow (src/lib/actions/public-booking.ts) and customer self-service
// signup (src/lib/actions/customer-signup.ts) so there's exactly one lookup.
export async function getMarketplaceTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { type: TenantType.MARKETPLACE } });
  if (!tenant) throw new Error("Marketplace tenant is not configured — run the seed script");
  return tenant.id;
}
