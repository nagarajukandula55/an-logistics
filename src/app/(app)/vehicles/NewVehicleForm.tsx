"use client";

import { useActionState, useRef, useEffect } from "react";
import { createVehicleAction, type ActionState } from "@/lib/actions/fleet";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };

export function NewVehicleForm() {
  const [state, formAction, pending] = useActionState(createVehicleAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <CardHeader>
        <h2 className="h-section">Add vehicle</h2>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Field label="Registration" htmlFor="registration" required>
            <Input id="registration" name="registration" placeholder="e.g. KA01AB1234" required />
          </Field>
          <Field label="Type" htmlFor="type" required>
            <Input id="type" name="type" placeholder="e.g. Van, Truck, Bike" required />
          </Field>
          <Field label="Capacity (kg)" htmlFor="capacityKg">
            <Input id="capacityKg" name="capacityKg" type="number" step="0.1" min="0" />
          </Field>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.ok && <p className="text-xs text-success">Vehicle added.</p>}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Add vehicle
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
