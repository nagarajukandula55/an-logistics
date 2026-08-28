"use client";

import { useEffect, useState, useTransition } from "react";
import { assignOrderToCourierAction, getQuotesForOrder, type CourierQuote } from "@/lib/actions/couriers";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

export function CourierAssignPanel({
  orderId,
  deliveryPincode,
}: {
  orderId: string;
  deliveryPincode: string | null;
}) {
  const [quotes, setQuotes] = useState<CourierQuote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningBranchId, setAssigningBranchId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!deliveryPincode) return;
    let cancelled = false;
    getQuotesForOrder(orderId)
      .then((result) => {
        if (!cancelled) setQuotes(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load courier quotes");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, deliveryPincode]);

  if (!deliveryPincode) {
    return <p className="text-sm text-ink-3">Add a delivery pincode to the order to see serviceable courier branches.</p>;
  }

  if (loadError) {
    return <p className="text-sm text-danger">{loadError}</p>;
  }

  if (quotes === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-3">
        <Spinner className="size-4" /> Loading courier quotes…
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        No active courier branch services pincode <span className="tabular">{deliveryPincode}</span>.
      </p>
    );
  }

  function handleAssign(branchId: string) {
    setAssignError(null);
    setAssigningBranchId(branchId);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("courierBranchId", branchId);
    startTransition(async () => {
      try {
        await assignOrderToCourierAction(fd);
      } catch (err) {
        setAssignError(err instanceof Error ? err.message : "Could not assign courier");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="pb-2 pr-2 font-medium">Partner</th>
              <th className="pb-2 pr-2 font-medium">Zone</th>
              <th className="pb-2 pr-2 font-medium">Price</th>
              <th className="pb-2 pr-2 font-medium">Platform fee</th>
              <th className="pb-2 pr-2 font-medium">ETA</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.branchId} className="border-t border-border">
                <td className="py-2 pr-2 text-ink">
                  {q.partnerName}
                  <span className="block text-xs text-ink-3">{q.branchName}</span>
                </td>
                <td className="py-2 pr-2">
                  <Badge tone="info">{q.zone}</Badge>
                </td>
                <td className="py-2 pr-2 tabular text-ink">
                  {q.noRateCard ? (
                    <span className="text-ink-3">No rate card configured</span>
                  ) : (
                    `₹${q.price!.toFixed(2)}`
                  )}
                </td>
                <td className="py-2 pr-2 tabular text-ink-2">{q.platformFee != null ? `₹${q.platformFee.toFixed(2)}` : "—"}</td>
                <td className="py-2 pr-2 tabular text-ink-2">{q.etaDays != null ? `${q.etaDays}d` : "—"}</td>
                <td className="py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={pending && assigningBranchId === q.branchId}
                    disabled={pending}
                    onClick={() => handleAssign(q.branchId)}
                  >
                    Assign
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assignError && <p className="text-xs text-danger">{assignError}</p>}
    </div>
  );
}
