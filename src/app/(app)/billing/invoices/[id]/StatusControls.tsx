"use client";

import { useState, useTransition } from "react";
import { updateInvoiceStatusAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"] as const;
const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "warning",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "neutral",
};

export function StatusControls({ invoiceId, currentStatus }: { invoiceId: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  function handleSetStatus(status: string) {
    setError(null);
    setPendingStatus(status);
    const fd = new FormData();
    fd.set("invoiceId", invoiceId);
    fd.set("status", status);
    startTransition(async () => {
      try {
        await updateInvoiceStatusAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update status");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {STATUSES.map((status) => (
        <Button
          key={status}
          type="button"
          variant={status === currentStatus ? "primary" : "secondary"}
          size="sm"
          disabled={status === currentStatus}
          loading={pending && pendingStatus === status}
          onClick={() => handleSetStatus(status)}
          className={cn("justify-start", status === currentStatus && "cursor-default")}
        >
          {status}
        </Button>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2 text-xs text-ink-3 mt-1">
        Current: <Badge tone={TONE[currentStatus] ?? "neutral"}>{currentStatus}</Badge>
      </div>
    </div>
  );
}
