"use client";

import { useActionState, useRef, useEffect } from "react";
import { generateInvoiceAction, type ActionState } from "@/lib/actions/billing";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };

export function NewInvoiceForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(generateInvoiceAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <CardHeader>
        <h2 className="h-section">Generate invoice</h2>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Field label="Tenant" htmlFor="tenantId" required>
            <Select id="tenantId" name="tenantId" required defaultValue="">
              <option value="" disabled>
                Select a tenant
              </option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
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
          {state.ok && <p className="text-xs text-success">Invoice generated.</p>}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Generate
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
