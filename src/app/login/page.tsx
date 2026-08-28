import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/orders");

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-1">AN Logistics</p>
          <h1 className="h-page">Sign in</h1>
          <p className="text-sm text-ink-2 mt-1">Ops console for order intake, dispatch, and tracking.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
