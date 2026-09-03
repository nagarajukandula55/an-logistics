"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTenantAction, type ActionState } from "@/lib/actions/tenants";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };

export function NewTenantForm() {
  const [state, formAction, pending] = useActionState(createTenantAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <CardHeader>
        <h2 className="h-section">Add tenant</h2>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Field label="Name" htmlFor="name" required>
            <Input id="name" name="name" required placeholder="e.g. DTDC Direct" />
          </Field>
          <Field label="Slug" htmlFor="slug" required hint="Lowercase, used in URLs and API introspection">
            <Input id="slug" name="slug" required placeholder="e.g. dtdc" pattern="[a-z0-9-]+" />
          </Field>
          <Field label="Type" htmlFor="type" required>
            <Select id="type" name="type" defaultValue="CLIENT" required>
              <option value="CLIENT">Client — brings their own order volume</option>
              <option value="INTERNAL">Internal — our own business</option>
              <option value="MARKETPLACE">Marketplace — public aggregator bucket</option>
            </Select>
          </Field>
          <Field label="Billing email" htmlFor="billingEmail">
            <Input id="billingEmail" name="billingEmail" type="email" />
          </Field>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.ok && <p className="text-xs text-success">Tenant created.</p>}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Add tenant
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
