"use client";

import { useActionState, useState } from "react";
import { createManagedUserAction, type ActionState } from "@/lib/actions/users";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const initialState: ActionState = { ok: false };

export function CreateUserForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createManagedUserAction, initialState);
  const [show, setShow] = useState(false);

  if (!show) return <Button type="button" onClick={() => setShow(true)}>Add staff or collaborator</Button>;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <Field label="Name" htmlFor="new-user-name" required><Input id="new-user-name" name="name" required /></Field>
        <Field label="Email / username" htmlFor="new-user-email" required><Input id="new-user-email" name="email" type="email" required /></Field>
        <Field label="Login type" htmlFor="new-user-role" required>
          <select id="new-user-role" name="role" defaultValue="STAFF" className="h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-ink">
            <option value="STAFF">Staff</option><option value="COLLABORATOR">Collaborator</option>
            <option value="DISPATCHER">Dispatcher</option><option value="DRIVER">Driver</option><option value="WAREHOUSE">Warehouse</option>
          </select>
        </Field>
        <Field label="Tenant / client" htmlFor="new-user-tenant" hint="Leave blank for your tenant">
          <select id="new-user-tenant" name="tenantId" className="h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-ink">
            <option value="">Current tenant</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-2"><Button type="submit" loading={pending}>Create login</Button><Button type="button" variant="secondary" onClick={() => setShow(false)}>Cancel</Button></div>
      </form>
      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
      {state.ok && state.tempPassword && <p className="mt-3 text-sm text-ink">Login created. Temporary password: <code className="rounded bg-surface-2 px-2 py-1">{state.tempPassword}</code> — share it securely; the user must change it on first login.</p>}
    </div>
  );
}
