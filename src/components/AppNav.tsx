"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, Package, Users, LogOut, Handshake } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/lib/actions/auth-signout";

const LINKS = [
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/dispatch", label: "Dispatch", icon: Truck },
  { href: "/couriers", label: "Couriers", icon: Handshake },
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
];

export function AppNav({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-ink">AN Logistics</span>
          <nav className="flex items-center gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
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
