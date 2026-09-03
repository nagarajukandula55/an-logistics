import Link from "next/link";
import { cn } from "@/lib/cn";

export function Tabs({ active }: { active: "invoices" | "settlements" }) {
  const tabs = [
    { key: "invoices", label: "Invoices", href: "/billing/invoices" },
    { key: "settlements", label: "Settlements", href: "/billing/settlements" },
  ] as const;

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
            active === t.key ? "border-accent text-accent" : "border-transparent text-ink-2 hover:text-ink"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
