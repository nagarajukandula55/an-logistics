"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, type ChangePasswordState } from "@/lib/actions/change-password";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ChangePasswordState, formData: FormData) => {
    const result = await changePasswordAction(prev, formData);
    if (!result.error) {
      router.push("/orders");
      router.refresh();
    }
    return result;
  }, initialState);

  return (
    <Card className="mt-6">
      <CardBody>
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Current password" htmlFor="currentPassword" required>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="New password" htmlFor="newPassword" required>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword" required>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          {state.error && (
            <p className="text-sm text-danger bg-danger-soft rounded-control px-3 py-2">{state.error}</p>
          )}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
