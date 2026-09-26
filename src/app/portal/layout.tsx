import Link from "next/link";
import { requireCustomerSession } from "@/lib/customer-session";
import { signOutAction } from "@/lib/actions/auth-signout";
import { LogOut, Package, Truck } from "lucide-react";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireCustomerSession();

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-ink">AN Logistics</span>
            <nav className="flex items-center gap-1">
              <Link href="/portal" className="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
                <Package className="size-4" /> My orders
              </Link>
              <Link href="/portal/book" className="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
                <Truck className="size-4" /> Book a shipment
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-2 hidden sm:inline">{session.user.name}</span>
            <form action={signOutAction}>
              <button type="submit" className="flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2" title="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
