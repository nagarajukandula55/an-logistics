import { SignupForm } from "./SignupForm";

export default function PortalSignupPage() {
  return (
    <div className="min-h-screen bg-bg p-4 flex justify-center">
      <div className="w-full max-w-sm py-10">
        <div className="mb-6 text-center">
          <p className="eyebrow mb-1">AN Logistics</p>
          <h1 className="h-page">Create your account</h1>
          <p className="text-sm text-ink-2 mt-1">Book shipments and track them from one place.</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
