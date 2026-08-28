"use client";

import { useActionState, useState, useTransition } from "react";
import {
  updateDriverAction,
  deactivateDriverAction,
  reactivateDriverAction,
  type ActionState,
} from "@/lib/actions/fleet";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge, fleetStatusTone } from "@/components/ui/Badge";
import { Pencil, X } from "lucide-react";
import { DriverStatus } from "@prisma/client";

type DriverRowData = {
  id: string;
  phone: string;
  licenseNo: string;
  status: DriverStatus;
  user: { name: string; isActive: boolean };
  vehicle: { registration: string } | null;
};

const initialState: ActionState = { ok: false };

export function DriverRow({ driver }: { driver: DriverRowData }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateDriverAction, initialState);
  const [transitioning, startTransition] = useTransition();

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0 bg-surface-2">
        <td className="px-4 py-3 text-ink" colSpan={6}>
          <form
            action={(fd) => {
              formAction(fd);
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="driverId" value={driver.id} />
            <span className="text-sm font-medium text-ink self-center pr-2">{driver.user.name}</span>
            <Field label="Phone" htmlFor={`phone-${driver.id}`} className="w-36">
              <Input id={`phone-${driver.id}`} name="phone" defaultValue={driver.phone} required />
            </Field>
            <Field label="License" htmlFor={`license-${driver.id}`} className="w-36">
              <Input id={`license-${driver.id}`} name="licenseNo" defaultValue={driver.licenseNo} required />
            </Field>
            <Field label="Status" htmlFor={`status-${driver.id}`} className="w-36">
              <Select id={`status-${driver.id}`} name="status" defaultValue={driver.status}>
                {Object.values(DriverStatus).map((s) => (
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
      <td className="px-4 py-3 text-ink">
        {driver.user.name}
        {!driver.user.isActive && (
          <Badge tone="neutral" className="ml-2">
            Deactivated
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-ink-2">{driver.phone}</td>
      <td className="px-4 py-3 text-ink-2 tabular">{driver.licenseNo}</td>
      <td className="px-4 py-3 text-ink-2">{driver.vehicle?.registration ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge tone={fleetStatusTone(driver.status)}>{driver.status.replace("_", " ")}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          {driver.user.isActive ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              loading={transitioning}
              onClick={() => {
                if (!confirm(`Deactivate ${driver.user.name}? This disables their login.`)) return;
                startTransition(() => {
                  deactivateDriverAction(driver.id);
                });
              }}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={transitioning}
              onClick={() => {
                startTransition(() => {
                  reactivateDriverAction(driver.id);
                });
              }}
            >
              Reactivate
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
