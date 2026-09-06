import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusControls } from "./StatusControls";
import { ApiKeyPanel } from "./ApiKeyPanel";
import { WebhookPanel } from "./WebhookPanel";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      courierPartner: true,
      apiKeys: { orderBy: { createdAt: "desc" } },
      _count: { select: { orders: true, users: true, vehicles: true, drivers: true } },
    },
  });
  if (!tenant) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Tenant"
        title={tenant.name}
        description={tenant.slug}
        actions={<Badge tone={tenant.status === "ACTIVE" ? "success" : "warning"}>{tenant.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2 className="h-section">Overview</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-ink-3">Type</p>
                <p className="text-ink">{tenant.type}</p>
              </div>
              <div>
                <p className="text-ink-3">Orders</p>
                <p className="text-ink tabular">{tenant._count.orders}</p>
              </div>
              <div>
                <p className="text-ink-3">Users</p>
                <p className="text-ink tabular">{tenant._count.users}</p>
              </div>
              <div>
                <p className="text-ink-3">Fleet</p>
                <p className="text-ink tabular">
                  {tenant._count.vehicles} vehicles / {tenant._count.drivers} drivers
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Fulfillment network</h2>
            </CardHeader>
            <CardBody>
              {tenant.courierPartner ? (
                <p className="text-sm text-ink">
                  Linked as courier partner <span className="font-medium">{tenant.courierPartner.name}</span> —
                  this tenant&apos;s own network can be routed to for other tenants&apos; orders. Manage its
                  branches, coverage, and rate cards from{" "}
                  <a href={`/couriers/${tenant.courierPartner.id}`} className="text-accent">
                    Couriers → {tenant.courierPartner.name}
                  </a>
                  .
                </p>
              ) : (
                <EmptyState
                  kind="empty"
                  title="Not linked to a fulfillment network"
                  description="This tenant only brings its own order volume today. To route other tenants' shipments through this tenant's own network (e.g. a direct courier-company deal), onboard them as a Courier Partner on the Couriers page, then link that partner to this tenant from the partner's API config — full self-service linking is a planned follow-up."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">API access</h2>
            </CardHeader>
            <CardBody>
              <ApiKeyPanel tenantId={tenant.id} apiKeys={tenant.apiKeys} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="h-section">Status webhook</h2>
            </CardHeader>
            <CardBody>
              <WebhookPanel
                tenantId={tenant.id}
                webhookUrl={tenant.webhookUrl}
                hasSecret={Boolean(tenant.webhookSecret)}
              />
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <h2 className="h-section">Status</h2>
          </CardHeader>
          <CardBody>
            <StatusControls tenantId={tenant.id} currentStatus={tenant.status} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
