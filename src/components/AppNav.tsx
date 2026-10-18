"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Truck, Package, Users, LogOut, Handshake, ShieldCheck, Building2, Receipt, LayoutDashboard, Tag, FileSignature, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/lib/actions/auth-signout";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/dispatch", label: "Dispatch", icon: Truck },
  { href: "/couriers", label: "Couriers", icon: Handshake },
  { href: "/agreements", label: "Agreements", icon: FileSignature },
  { href: "/pricing", label: "Pricing", icon: Tag },
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
];

const ADMIN_LINKS = [
  { href: "/onboarding", label: "Onboarding", icon: Handshake },
  { href: "/users", label: "Users", icon: ShieldCheck },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/billing/invoices", label: "Billing", icon: Receipt },
  { href: "/settings/telegram-notifications", label: "Telegram", icon: Send },
];

export function AppNav({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();
  const links = role === "ADMIN" ? [...LINKS, ...ADMIN_LINKS] : LINKS;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" aria-label="AN Logistics dashboard" className="shrink-0 rounded-lg bg-white px-2 py-0.5 shadow-sm"><Image src="/an-group-logistics.png" alt="AN Logistics" width={100} height={64} className="h-10 w-auto object-contain" /></Link>
          <nav className="flex items-center gap-1 overflow-x-auto max-w-[65vw]">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight hidden sm:block">
            <p className="text-sm text-ink">{userName}</p>
            <p className="text-xs text-ink-3">{role}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
