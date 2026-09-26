"use client";

import { useActionState } from "react";
import { signupCustomerAction, type SignupState } from "@/lib/actions/customer-signup";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import Link from "next/link";

const initialState: SignupState = { ok: false };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupCustomerAction, initialState);

  if (state.ok) {
    return (
      <Card>
        <CardBody className="text-center flex flex-col gap-3">
          <p className="text-ink">Account created.</p>
          <Link href="/login" className="text-accent text-sm">
            Sign in →
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="name" required>
            <Input id="name" name="name" required autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="email" required>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Phone" htmlFor="phone" required>
            <Input id="phone" name="phone" required autoComplete="tel" />
          </Field>
          <Field label="Password" htmlFor="password" required>
            <Input id="password" name="password" type="password" required autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword" required>
            <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
          </Field>
          {state.error && <p className="text-sm text-danger bg-danger-soft rounded-control px-3 py-2">{state.error}</p>}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Create account
          </Button>
          <p className="text-xs text-ink-3 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-accent">
              Sign in
            </Link>
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
