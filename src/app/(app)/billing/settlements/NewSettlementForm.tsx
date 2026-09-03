"use client";

import { useActionState, useRef, useEffect } from "react";
import { generateSettlementAction, type ActionState } from "@/lib/actions/billing";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };

export function NewSettlementForm({ partners }: { partners: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(generateSettlementAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <CardHeader>
        <h2 className="h-section">Generate settlement</h2>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Field label="Courier partner" htmlFor="courierPartnerId" required>
            <Select id="courierPartnerId" name="courierPartnerId" required defaultValue="">
              <option value="" disabled>
                Select a partner
              </option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Period start" htmlFor="periodStart" required>
            <Input id="periodStart" name="periodStart" type="date" required />
          </Field>
          <Field label="Period end" htmlFor="periodEnd" required>
            <Input id="periodEnd" name="periodEnd" type="date" required />
          </Field>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.ok && <p className="text-xs text-success">Settlement generated.</p>}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Generate
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
