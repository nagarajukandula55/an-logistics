"use client";

import { useActionState, useState, useTransition } from "react";
import { updateVehicleAction, deactivateVehicleAction, type ActionState } from "@/lib/actions/fleet";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge, fleetStatusTone } from "@/components/ui/Badge";
import { Pencil, X } from "lucide-react";
import { VehicleStatus } from "@prisma/client";

type VehicleRowData = {
  id: string;
  registration: string;
  type: string;
  capacityKg: number | null;
  status: VehicleStatus;
};

const initialState: ActionState = { ok: false };

export function VehicleRow({ vehicle }: { vehicle: VehicleRowData }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateVehicleAction, initialState);
  const [transitioning, startTransition] = useTransition();

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0 bg-surface-2">
        <td className="px-4 py-3 text-ink" colSpan={5}>
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="vehicleId" value={vehicle.id} />
            <span className="text-sm font-medium text-ink tabular self-center pr-2">{vehicle.registration}</span>
            <Field label="Type" htmlFor={`type-${vehicle.id}`} className="w-36">
              <Input id={`type-${vehicle.id}`} name="type" defaultValue={vehicle.type} required />
            </Field>
            <Field label="Capacity (kg)" htmlFor={`capacity-${vehicle.id}`} className="w-32">
              <Input
                id={`capacity-${vehicle.id}`}
                name="capacityKg"
                type="number"
                step="0.1"
                min="0"
                defaultValue={vehicle.capacityKg ?? ""}
              />
            </Field>
            <Field label="Status" htmlFor={`status-${vehicle.id}`} className="w-36">
              <Select id={`status-${vehicle.id}`} name="status" defaultValue={vehicle.status}>
                {Object.values(VehicleStatus).map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            {state.error && <p className="text-xs text-danger w-full">{state.error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={pending}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="size-4" /> Cancel
              </Button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 text-ink tabular">{vehicle.registration}</td>
      <td className="px-4 py-3 text-ink-2">{vehicle.type}</td>
      <td className="px-4 py-3 text-ink-2 tabular">{vehicle.capacityKg ? `${vehicle.capacityKg} kg` : "—"}</td>
      <td className="px-4 py-3">
        <Badge tone={fleetStatusTone(vehicle.status)}>{vehicle.status.replace("_", " ")}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          {vehicle.status !== VehicleStatus.INACTIVE && (
            <Button
              type="button"
              size="sm"
              variant="danger"
              loading={transitioning}
              onClick={() => {
                if (!confirm(`Deactivate vehicle ${vehicle.registration}?`)) return;
                startTransition(() => {
                  deactivateVehicleAction(vehicle.id);
                });
              }}
            >
              Deactivate
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
