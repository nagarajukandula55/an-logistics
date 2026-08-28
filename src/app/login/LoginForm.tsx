"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Username" htmlFor="username" required>
            <Input id="username" name="username" type="text" autoComplete="username" required placeholder="admin" />
          </Field>
          <Field label="Password" htmlFor="password" required>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          {state.error && (
            <p className="text-sm text-danger bg-danger-soft rounded-control px-3 py-2">{state.error}</p>
          )}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Sign in
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
