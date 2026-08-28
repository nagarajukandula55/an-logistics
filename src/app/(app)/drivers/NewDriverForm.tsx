"use client";

import { useActionState, useRef, useEffect } from "react";
import { createDriverAction, type ActionState } from "@/lib/actions/fleet";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };

export function NewDriverForm() {
  const [state, formAction, pending] = useActionState(createDriverAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <CardHeader>
        <h2 className="h-section">Add driver</h2>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Field label="Full name" htmlFor="name" required>
            <Input id="name" name="name" required />
          </Field>
          <Field label="Login email" htmlFor="email" required>
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="Temporary password" htmlFor="password" required hint="At least 8 characters">
            <Input id="password" name="password" type="password" minLength={8} required />
          </Field>
          <Field label="Phone" htmlFor="phone" required>
            <Input id="phone" name="phone" required />
          </Field>
          <Field label="License number" htmlFor="licenseNo" required>
            <Input id="licenseNo" name="licenseNo" required />
          </Field>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.ok && <p className="text-xs text-success">Driver added.</p>}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Add driver
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
