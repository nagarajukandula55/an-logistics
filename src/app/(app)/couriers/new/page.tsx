import { PageHeader } from "@/components/ui/PageHeader";
import { NewCourierForm } from "./NewCourierForm";

export default function NewCourierPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Courier partners"
        title="Onboard courier"
        description="Register a courier company or local franchise as a fulfillment partner."
      />
      <NewCourierForm />
    </div>
  );
}
