"use client";

import { useState, useTransition } from "react";
import { assignOrderToCourierAction } from "@/lib/actions/couriers";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type Branch = {
  id: string;
  name: string;
  city: string;
  courierPartner: { id: string; name: string; commissionType: string; commissionValue: number };
};

export function CourierAssignPanel({
  orderId,
  branches,
  deliveryPincode,
}: {
  orderId: string;
  branches: Branch[];
  deliveryPincode: string | null;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!deliveryPincode) {
    return <p className="text-sm text-ink-3">Add a delivery pincode to the order to see serviceable courier branches.</p>;
  }

  if (branches.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        No active courier branch services pincode <span className="tabular">{deliveryPincode}</span>.
      </p>
    );
  }

  function handleAssign() {
    setError(null);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("courierBranchId", branchId);
    startTransition(async () => {
      try {
        await assignOrderToCourierAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign courier");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Courier branch" htmlFor="courierBranchId" hint={`Serviceable for ${deliveryPincode}`}>
        <Select id="courierBranchId" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.courierPartner.name} · {b.name} ({b.city})
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="button" variant="secondary" onClick={handleAssign} loading={pending} className="w-full">
        Route to courier
      </Button>
    </div>
  );
}
