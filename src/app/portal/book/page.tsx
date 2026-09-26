import { PageHeader } from "@/components/ui/PageHeader";
import { requireCustomerSession } from "@/lib/customer-session";
import { CustomerBookingFlow } from "./CustomerBookingFlow";

export default async function PortalBookPage() {
  await requireCustomerSession();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Portal" title="Book a shipment" />
      <div className="max-w-lg">
        <CustomerBookingFlow />
      </div>
    </div>
  );
}
