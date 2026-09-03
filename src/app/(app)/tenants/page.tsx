import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewTenantForm } from "./NewTenantForm";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  ONBOARDING: "warning",
  SUSPENDED: "neutral",
};

const TYPE_LABEL: Record<string, string> = {
  INTERNAL: "Internal",
  CLIENT: "Client",
  MARKETPLACE: "Marketplace",
};

export default async function TenantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { orders: true, users: true, apiKeys: true } } },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Tenants"
        description="Businesses running on this platform — our own operation, client businesses, and the public marketplace bucket."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {tenants.length === 0 ? (
            <EmptyState kind="empty" title="No tenants yet" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-3">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Orders</th>
                      <th className="px-4 py-3 font-medium">Users</th>
                      <th className="px-4 py-3 font-medium">API keys</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                        <td className="px-4 py-3">
                          <Link href={`/tenants/${t.id}`} className="text-accent font-medium">
                            {t.name}
                          </Link>
                          <p className="text-xs text-ink-3">{t.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{TYPE_LABEL[t.type] ?? t.type}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-ink tabular">{t._count.orders}</td>
                        <td className="px-4 py-3 text-ink tabular">{t._count.users}</td>
                        <td className="px-4 py-3 text-ink tabular">{t._count.apiKeys}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <NewTenantForm />
      </div>
    </div>
  );
}
