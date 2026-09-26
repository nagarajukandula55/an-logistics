import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TenantType } from "@prisma/client";
import { SellRateCardsPanel } from "./SellRateCardsPanel";

// What we charge (SellRateCard), as distinct from /couriers' RateCard (what
// a courier charges us). One default price list applies to ordinary/
// normal-user bookings (the public marketplace flow); each commercial
// CLIENT tenant can optionally have its own negotiated one, which takes
// priority for that tenant's orders (see src/lib/sell-pricing.ts).
export default async function PricingPage() {
  const [defaultCards, clientTenants] = await Promise.all([
    prisma.sellRateCard.findMany({
      where: { tenantId: null },
      include: { slabs: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.tenant.findMany({
      where: { type: TenantType.CLIENT },
      include: { sellRateCards: { include: { slabs: true }, orderBy: { effectiveFrom: "desc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pricing"
        title="What we charge"
        description="Your own sell price to bookers — separate from what a courier charges you (see Couriers → Rate cards). One default list for normal bookings, plus an optional negotiated list per commercial (CLIENT) tenant."
      />

      <Card>
        <CardHeader>
          <h2 className="h-section">Default price list</h2>
          <p className="text-xs text-ink-3">Applies to ordinary bookings with no commercial-tenant override.</p>
        </CardHeader>
        <CardBody>
          <SellRateCardsPanel cards={defaultCards} />
        </CardBody>
      </Card>

      {clientTenants.map((tenant) => (
        <Card key={tenant.id}>
          <CardHeader>
            <h2 className="h-section">{tenant.name}</h2>
            <p className="text-xs text-ink-3">Negotiated pricing for this commercial tenant — overrides the default list for their orders.</p>
          </CardHeader>
          <CardBody>
            <SellRateCardsPanel tenantId={tenant.id} cards={tenant.sellRateCards} />
          </CardBody>
        </Card>
      ))}

      {clientTenants.length === 0 && (
        <p className="text-sm text-ink-3">
          No commercial (CLIENT) tenants yet — onboard one from{" "}
          <Link href="/tenants" className="text-accent">
            Tenants
          </Link>{" "}
          to give them their own negotiated rates.
        </p>
      )}
    </div>
  );
}
