import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewOrderForm } from "./NewOrderForm";

export default async function NewOrderPage() {
  const { tenantId, isStaff } = await requireTenantSession();
  const customers = await prisma.customer.findMany({
    where: { isActive: true, ...(isStaff ? {} : { tenantId }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, tenantId: true },
  });
  const tenants = isStaff
    ? await prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <div>
      <PageHeader eyebrow="Orders" title="New order" description="Capture pickup and delivery details to create a shipment." />
      <NewOrderForm customers={customers} tenants={tenants} defaultTenantId={tenantId} />
    </div>
  );
}
