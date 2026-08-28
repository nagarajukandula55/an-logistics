import { PageHeader } from "@/components/ui/PageHeader";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <PageHeader
          eyebrow="Security"
          title="Change your password"
          description="You're using a temporary password. Set a new one to continue."
        />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
