"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Field";

export function OrderSearchForm({ defaultValue, status }: { defaultValue: string; status?: string }) {
  const router = useRouter();

  return (
    <form
      className="relative w-full max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (q && String(q).trim()) params.set("q", String(q).trim());
        router.push(`/orders${params.toString() ? `?${params.toString()}` : ""}`);
      }}
    >
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-3" />
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder="Search tracking code or customer…"
        className="pl-8"
      />
    </form>
  );
}
