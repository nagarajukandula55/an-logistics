import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { TatLookup, TatUpload } from "./TatPanel";

export default async function TatPage() {
  const { session } = await requireTenantSession();
  if (session.user.role === "CUSTOMER") return <div className="flex flex-col gap-6"><PageHeader eyebrow="Planning" title="Delivery TAT planner" description="Check indicative delivery time by pincode before planning shipments." /><TatLookup /></div>;
  if (session.user.role !== "ADMIN") redirect("/orders");
  return <div className="flex flex-col gap-6"><PageHeader eyebrow="Planning" title="Delivery TAT" description="Upload the latest pincode-wise schedule and verify routes." /><TatUpload /><TatLookup /></div>;
}
