import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewOrderForm } from "./NewOrderForm";

export default async function NewOrderPage() {
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true },
  });

  return (
    <div>
      <PageHeader eyebrow="Orders" title="New order" description="Capture pickup and delivery details to create a shipment." />
      <NewOrderForm customers={customers} />
    </div>
  );
}
