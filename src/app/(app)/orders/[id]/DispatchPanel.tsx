"use client";

import { useState, useTransition } from "react";
import { assignDriverVehicleAction } from "@/lib/actions/orders";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type Driver = { id: string; user: { name: string }; phone: string };
type Vehicle = { id: string; registration: string; type: string };

export function DispatchPanel({ orderId, drivers, vehicles }: { orderId: string; drivers: Driver[]; vehicles: Vehicle[] }) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (drivers.length === 0 || vehicles.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        {drivers.length === 0 ? "No drivers available. " : ""}
        {vehicles.length === 0 ? "No vehicles available." : ""}
      </p>
    );
  }

  function handleAssign() {
    setError(null);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("driverId", driverId);
    fd.set("vehicleId", vehicleId);
    startTransition(async () => {
      try {
        await assignDriverVehicleAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Driver" htmlFor="driverId">
        <Select id="driverId" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.user.name} · {d.phone}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Vehicle" htmlFor="vehicleId">
        <Select id="vehicleId" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registration} ({v.type})
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button onClick={handleAssign} loading={pending} className="w-full">
        Assign
      </Button>
    </div>
  );
}
