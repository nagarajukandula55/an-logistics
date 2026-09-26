import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  // Routed through /post-login (not hardcoded to /orders) since an
  // already-logged-in visitor here might be a customer-portal account,
  // which can't see /orders — same role-based landing as a fresh sign-in.
  if (session?.user) redirect("/post-login");

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-1">AN Logistics</p>
          <h1 className="h-page">Sign in</h1>
          <p className="text-sm text-ink-2 mt-1">Ops console for order intake, dispatch, and tracking.</p>
        </div>
        <LoginForm />
        <p className="text-xs text-ink-3 text-center mt-4">
          Booking as a customer?{" "}
          <Link href="/portal/signup" className="text-accent">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
