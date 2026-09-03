"use client";

import { useEffect, useState, useTransition } from "react";
import { assignOrderToCourierAction, getProviderQuotesForOrder, type ProviderQuoteGroup } from "@/lib/actions/couriers";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

export function CourierAssignPanel({
  orderId,
  deliveryPincode,
}: {
  orderId: string;
  deliveryPincode: string | null;
}) {
  const [groups, setGroups] = useState<ProviderQuoteGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!deliveryPincode) return;
    let cancelled = false;
    getProviderQuotesForOrder(orderId)
      .then((result) => {
        if (cancelled) return;
        setGroups(result);
        setActivePartnerId(result[0]?.partnerId ?? null);
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

  if (groups === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-3">
        <Spinner className="size-4" /> Loading courier quotes…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        No connected courier — ours or a partner's — services pincode <span className="tabular">{deliveryPincode}</span>.
      </p>
    );
  }

  const active = groups.find((g) => g.partnerId === activePartnerId) ?? groups[0];

  function handleAssign(branchId: string, providerCourierId: string | undefined, key: string) {
    setAssignError(null);
    setAssigningKey(key);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("courierBranchId", branchId);
    if (providerCourierId) fd.set("providerCourierId", providerCourierId);
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
      <div className="flex flex-wrap gap-1 border-b border-border">
        {groups.map((g) => (
          <button
            key={g.partnerId}
            type="button"
            onClick={() => setActivePartnerId(g.partnerId)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              g.partnerId === active.partnerId ? "border-accent text-accent" : "border-transparent text-ink-2 hover:text-ink"
            )}
          >
            {g.partnerName}
            {g.options.length > 1 && <span className="ml-1 text-xs text-ink-3">({g.options.length})</span>}
          </button>
        ))}
      </div>

      {active.options.length === 0 ? (
        <p className="text-sm text-ink-3 py-2">No quote available from {active.partnerName} for this route.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="pb-2 pr-2 font-medium">Option</th>
                <th className="pb-2 pr-2 font-medium">Zone</th>
                <th className="pb-2 pr-2 font-medium">Price</th>
                <th className="pb-2 pr-2 font-medium">Platform fee</th>
                <th className="pb-2 pr-2 font-medium">ETA</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {active.options.map((o) => {
                const key = `${active.branchId}:${o.providerCourierId ?? "default"}`;
                return (
                  <tr key={key} className="border-t border-border">
                    <td className="py-2 pr-2 text-ink">{o.label ?? active.partnerName}</td>
                    <td className="py-2 pr-2">
                      <Badge tone="info">{active.zone}</Badge>
                    </td>
                    <td className="py-2 pr-2 tabular text-ink">₹{o.price.toFixed(2)}</td>
                    <td className="py-2 pr-2 tabular text-ink-2">{o.platformFee != null ? `₹${o.platformFee.toFixed(2)}` : "—"}</td>
                    <td className="py-2 pr-2 tabular text-ink-2">{o.etaDays != null ? `${o.etaDays}d` : "—"}</td>
                    <td className="py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={pending && assigningKey === key}
                        disabled={pending}
                        onClick={() => handleAssign(active.branchId, o.providerCourierId, key)}
                      >
                        Assign
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {assignError && <p className="text-xs text-danger">{assignError}</p>}
    </div>
  );
}
