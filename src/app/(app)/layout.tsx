import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav userName={session.user.name ?? session.user.email ?? "User"} role={session.user.role} />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}
