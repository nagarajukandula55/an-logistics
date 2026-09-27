"use client";

import { useActionState } from "react";
import { saveTenantPickupDetailsAction, type SavePickupDetailsState } from "@/lib/actions/tenants";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const initialState: SavePickupDetailsState = { ok: false };

export function PickupDetailsPanel({
  tenantId,
  pickupAddress,
  pickupPincode,
  pickupContactName,
  pickupContactPhone,
}: {
  tenantId: string;
  pickupAddress: string | null;
  pickupPincode: string | null;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveTenantPickupDetailsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />

      <p className="text-sm text-ink-3">
        Default pickup point used when this tenant books a shipment via{" "}
        <code className="tabular">POST /api/v1/shipments</code> without its own pickup fields. Read back over{" "}
        <code className="tabular">GET /api/v1/tenant</code> so the calling app never has to duplicate this in its
        own config.
      </p>

      <Field label="Pickup address" htmlFor="pickupAddress">
        <Input id="pickupAddress" name="pickupAddress" defaultValue={pickupAddress ?? ""} placeholder="Warehouse / origin address" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Pickup pincode" htmlFor="pickupPincode">
          <Input id="pickupPincode" name="pickupPincode" defaultValue={pickupPincode ?? ""} placeholder="560001" />
        </Field>
        <Field label="Contact phone" htmlFor="pickupContactPhone">
          <Input id="pickupContactPhone" name="pickupContactPhone" defaultValue={pickupContactPhone ?? ""} placeholder="9000000000" />
        </Field>
      </div>

      <Field label="Contact name" htmlFor="pickupContactName">
        <Input id="pickupContactName" name="pickupContactName" defaultValue={pickupContactName ?? ""} placeholder="Warehouse Manager" />
      </Field>

      {state.error && <p className="text-xs text-danger">{state.error}</p>}

      <div>
        <Button type="submit" size="sm" loading={pending}>
          Save
        </Button>
        {state.ok && <span className="ml-3 text-xs text-success">Saved.</span>}
      </div>
    </form>
  );
}
