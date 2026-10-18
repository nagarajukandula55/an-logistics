import Link from "next/link";
import Image from "next/image";
import { requireCustomerSession } from "@/lib/customer-session";

export const dynamic = "force-dynamic";
import { signOutAction } from "@/lib/actions/auth-signout";
import { LogOut, Package, Truck } from "lucide-react";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireCustomerSession();

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/portal" aria-label="AN Logistics portal" className="shrink-0 rounded-lg bg-white px-2 py-0.5 shadow-sm"><Image src="/an-group-logistics.png" alt="AN Logistics" width={100} height={64} className="h-10 w-auto object-contain" /></Link>
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
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
}
