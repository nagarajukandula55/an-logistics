import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TenantType } from "@prisma/client";
import { SellRateCardsPanel } from "./SellRateCardsPanel";
import { requireTenantSession } from "@/lib/tenant";

// What we charge (SellRateCard), as distinct from /couriers' RateCard (what
// a courier charges us). One default price list applies to ordinary/
// normal-user bookings (the public marketplace flow); each commercial
// CLIENT tenant can optionally have its own negotiated one, which takes
// priority for that tenant's orders (see src/lib/sell-pricing.ts).
export default async function PricingPage() {
  const { session } = await requireTenantSession();
  const canViewPricing = session.user.role === "ADMIN" || session.user.role === "STAFF" || session.user.role === "COLLABORATOR";
  if (!canViewPricing) return <p className="text-sm text-ink-2">Pricing is available to administrators, staff, and collaborators.</p>;
  const assignedCourierIds = session.user.role === "STAFF" || session.user.role === "COLLABORATOR"
    ? (await prisma.userCourierAssignment.findMany({ where: { userId: session.user.id }, select: { courierPartnerId: true } })).map((a) => a.courierPartnerId)
    : [];
  const [defaultCards, staffCards, collaboratorCards, clientTenants, couriers] = await Promise.all([
    prisma.sellRateCard.findMany({
      where: { audience: "DEFAULT", tenantId: null, customerId: null },
      include: { slabs: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.sellRateCard.findMany({ where: { audience: "STAFF", tenantId: null, customerId: null }, include: { slabs: true }, orderBy: { effectiveFrom: "desc" } }),
    prisma.sellRateCard.findMany({ where: { audience: "COLLABORATOR", tenantId: null, customerId: null }, include: { slabs: true }, orderBy: { effectiveFrom: "desc" } }),
    prisma.tenant.findMany({
      where: { type: TenantType.CLIENT },
      include: { sellRateCards: { where: { audience: "CLIENT", customerId: null }, include: { slabs: true }, orderBy: { effectiveFrom: "desc" } }, customers: { include: { sellRateCards: { where: { audience: "CLIENT" }, include: { slabs: true }, orderBy: { effectiveFrom: "desc" } } }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.courierPartner.findMany({
      where: session.user.role === "ADMIN" ? {} : { id: { in: assignedCourierIds } },
      include: {
        sellRateCards: {
          where: { tenantId: null, customerId: null, audience: { in: ["DEFAULT", "STAFF", "COLLABORATOR"] } },
          include: { slabs: true },
          orderBy: { effectiveFrom: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pricing"
        title="What we charge"
        description="Your own sell price to bookers — separate from what a courier charges you (see Couriers → Rate cards). One default list for normal bookings, plus an optional negotiated list per commercial (CLIENT) tenant."
        actions={<div className="flex flex-wrap gap-2"><Link href="/couriers" className="rounded-control border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-2">Courier cost cards</Link><Link href="/onboarding" className="rounded-control bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover">Customer onboarding</Link></div>}
      />

      <div className="rounded-card border border-accent/20 bg-accent-soft px-5 py-4 text-sm text-ink-2"><strong className="text-ink">How pricing works.</strong> Create a default sell card for ordinary users, then create a negotiated card for each client tenant. Link the customer card to their signed agreement; it becomes active only after the agreement is signed.</div>

      {session.user.role === "ADMIN" && <Card>
        <CardHeader>
          <h2 className="h-section">Default price list</h2>
          <p className="text-xs text-ink-3">Applies to ordinary bookings with no commercial-tenant override.</p>
        </CardHeader>
        <CardBody>
          <SellRateCardsPanel audience="DEFAULT" cards={defaultCards} />
        </CardBody>
      </Card>}

      <Card>
        <CardHeader>
          <h2 className="h-section">Courier-specific price lists</h2>
          <p className="text-xs text-ink-3">Create separate default, staff, or collaborator selling prices for each courier partner.</p>
        </CardHeader>
        <CardBody>
          {couriers.length === 0 ? <p className="text-sm text-ink-3">No courier assignments are available for this login.</p> : (
            <div className="flex flex-col gap-6">
              {couriers.map((courier) => {
                const cardsFor = (audience: "DEFAULT" | "STAFF" | "COLLABORATOR") => courier.sellRateCards.filter((card) => card.audience === audience);
                return <div key={courier.id} className="rounded-card border border-border p-4">
                  <h3 className="font-semibold text-ink">{courier.name}</h3>
                  <div className="mt-4 grid gap-5 lg:grid-cols-3">
                    <div><p className="mb-2 text-sm font-medium text-ink-2">Default</p><SellRateCardsPanel audience="DEFAULT" courierPartnerId={courier.id} cards={cardsFor("DEFAULT")} /></div>
                    <div><p className="mb-2 text-sm font-medium text-ink-2">Staff</p><SellRateCardsPanel audience="STAFF" courierPartnerId={courier.id} cards={cardsFor("STAFF")} /></div>
                    <div><p className="mb-2 text-sm font-medium text-ink-2">Collaborator</p><SellRateCardsPanel audience="COLLABORATOR" courierPartnerId={courier.id} cards={cardsFor("COLLABORATOR")} /></div>
                  </div>
                </div>;
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {session.user.role === "ADMIN" && <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><h2 className="h-section">Staff price list</h2><p className="text-xs text-ink-3">Applied when a staff login books without a client-specific rate.</p></CardHeader><CardBody><SellRateCardsPanel audience="STAFF" cards={staffCards} /></CardBody></Card>
        <Card><CardHeader><h2 className="h-section">Collaborator price list</h2><p className="text-xs text-ink-3">Applied when a collaborator login books without a client-specific rate.</p></CardHeader><CardBody><SellRateCardsPanel audience="COLLABORATOR" cards={collaboratorCards} /></CardBody></Card>
      </div>}

      {session.user.role === "ADMIN" && clientTenants.map((tenant) => (
        <Card key={tenant.id}>
          <CardHeader>
            <h2 className="h-section">{tenant.name}</h2>
            <p className="text-xs text-ink-3">Negotiated pricing for this commercial tenant — overrides the default list for their orders.</p>
          </CardHeader>
          <CardBody>
            <SellRateCardsPanel audience="CLIENT" tenantId={tenant.id} cards={tenant.sellRateCards} />
            {tenant.customers.map((customer) => <div key={customer.id} className="mt-5 border-t border-border pt-4"><p className="mb-2 text-sm font-medium text-ink">{customer.name}</p><SellRateCardsPanel audience="CLIENT" tenantId={tenant.id} customerId={customer.id} cards={customer.sellRateCards} /></div>)}
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
