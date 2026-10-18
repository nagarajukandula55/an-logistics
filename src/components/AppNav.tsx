"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Truck, Package, Users, LogOut, Handshake, ShieldCheck, Building2, Receipt, LayoutDashboard, Tag, FileSignature, Send, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/lib/actions/auth-signout";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/orders", label: "Orders", icon: Package },
  { href: "/dispatch", label: "Dispatch", icon: Truck }, { href: "/couriers", label: "Couriers", icon: Handshake },
  { href: "/agreements", label: "Agreements", icon: FileSignature }, { href: "/pricing", label: "Pricing", icon: Tag },
  { href: "/drivers", label: "Drivers", icon: Users }, { href: "/vehicles", label: "Vehicles", icon: Truck },
];
const ADMIN_LINKS = [
  { href: "/onboarding", label: "Onboarding", icon: Handshake }, { href: "/users", label: "Users", icon: ShieldCheck },
  { href: "/tenants", label: "Tenants", icon: Building2 }, { href: "/billing/invoices", label: "Billing", icon: Receipt },
  { href: "/settings/telegram-notifications", label: "Telegram", icon: Send },
];

export function AppNav({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const links = role === "ADMIN" ? [...LINKS, ...ADMIN_LINKS] : LINKS;
  const nav = <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">{links.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return <Link key={href} href={href} title={collapsed ? label : undefined} className={cn("flex shrink-0 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors", collapsed && "justify-center", active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}><Icon className="size-4" />{!collapsed && label}</Link>;
  })}</nav>;
  return <>
    <aside className={cn("hidden shrink-0 border-r border-border bg-surface transition-[width] lg:flex lg:min-h-screen lg:flex-col lg:py-5", collapsed ? "w-20 px-3" : "w-64 px-4")}>
      <div className={cn("mb-8 flex items-center", collapsed ? "justify-center" : "justify-between")}><Link href="/dashboard" aria-label="AN Logistics dashboard" className="inline-flex rounded-xl bg-white px-3 py-1 shadow-sm"><Image src="/an-group-logistics.png" alt="AN Logistics" width={120} height={76} className={cn("h-12 w-auto object-contain", collapsed && "h-10 w-12 object-cover object-left")} /></Link>{!collapsed && <button type="button" onClick={() => setCollapsed(true)} className="rounded-control p-2 text-ink-3 hover:bg-surface-2" title="Collapse navigation"><PanelLeftClose className="size-4" /></button>}</div>
      {collapsed && <button type="button" onClick={() => setCollapsed(false)} className="mb-4 self-center rounded-control p-2 text-ink-3 hover:bg-surface-2" title="Expand navigation"><PanelLeftOpen className="size-4" /></button>}
      {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-ink-3">Workspace</p>}{nav}
      <div className="mt-auto border-t border-border pt-4">{!collapsed && <><p className="truncate px-3 text-sm text-ink">{userName}</p><p className="px-3 text-xs text-ink-3">{role}</p></>}<form action={signOutAction} className="mt-3"><button type="submit" className={cn("flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm text-ink-2 hover:bg-surface-2", collapsed && "justify-center")} title="Sign out"><LogOut className="size-4" />{!collapsed && "Sign out"}</button></form></div>
    </aside>
    <header className="border-b border-border bg-surface lg:hidden"><div className="flex min-h-16 items-center gap-4 px-4"><Link href="/dashboard" aria-label="AN Logistics dashboard" className="shrink-0 rounded-lg bg-white px-2 py-0.5 shadow-sm"><Image src="/an-group-logistics.png" alt="AN Logistics" width={100} height={64} className="h-10 w-auto object-contain" /></Link><div className="min-w-0 flex-1">{nav}</div><form action={signOutAction}><button type="submit" className="rounded-control p-2 text-ink-2 hover:bg-surface-2" title="Sign out"><LogOut className="size-4" /></button></form></div></header>
  </>;
}
