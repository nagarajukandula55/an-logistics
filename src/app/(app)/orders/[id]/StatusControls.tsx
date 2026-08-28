"use client";

import { useState, useTransition } from "react";
import { OrderStatus } from "@prisma/client";
import { advanceOrderStatusAction, ORDER_NEXT_STATUS } from "@/lib/actions/orders";
import { Button } from "@/components/ui/Button";
import { orderStatusLabel } from "@/components/ui/Badge";

export function StatusControls({ orderId, currentStatus }: { orderId: string; currentStatus: OrderStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = ORDER_NEXT_STATUS[currentStatus] ?? [];

  if (next.length === 0) {
    return <p className="text-sm text-ink-3">No further actions.</p>;
  }

  function handleAdvance(status: OrderStatus) {
    setError(null);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("status", status);
    startTransition(async () => {
      try {
        await advanceOrderStatusAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update status");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {next.map((status) => (
        <Button
          key={status}
          variant={status === "CANCELLED" || status === "FAILED" ? "danger" : "primary"}
          onClick={() => handleAdvance(status)}
          loading={pending}
        >
          Mark {orderStatusLabel(status)}
        </Button>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
