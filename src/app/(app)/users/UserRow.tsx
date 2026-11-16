"use client";

import { useActionState, useState, useTransition } from "react";
import { adminResetPasswordAction, setUserCourierAssignmentsAction, toggleCourierCostPermissionAction, toggleUserActiveAction, type ActionState } from "@/lib/actions/users";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { KeyRound, X, Copy, Check } from "lucide-react";
import { UserRole } from "@prisma/client";

type UserRowData = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  canManageCourierCosts: boolean;
};

const initialState: ActionState = { ok: false };

export function UserRow({
  user,
  currentUserId,
  tenantName,
  couriers,
  assignedCourierIds,
}: {
  user: UserRowData;
  currentUserId: string;
  tenantName?: string;
  couriers: { id: string; name: string }[];
  assignedCourierIds: string[];
}) {
  const [resetting, setResetting] = useState(false);
  const [state, formAction, pending] = useActionState(adminResetPasswordAction, initialState);
  const [transitioning, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedCourierIds, setSelectedCourierIds] = useState<string[]>(assignedCourierIds);

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-4 py-3 text-ink">{user.name}</td>
        {tenantName !== undefined && <td className="px-4 py-3 text-ink-2">{tenantName}</td>}
        <td className="px-4 py-3 text-ink-2">{user.email}</td>
        <td className="px-4 py-3">
          <Badge tone="neutral">{user.role}</Badge>
        </td>
        <td className="px-4 py-3">
          <Badge tone={user.isActive ? "success" : "neutral"}>{user.isActive ? "Active" : "Deactivated"}</Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center justify-end gap-2">
              {(user.role === "STAFF" || user.role === "COLLABORATOR") && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setAssigning((v) => !v)}>
                  {assigning ? "Close couriers" : "Assign couriers"}
                </Button>
              )}
              {user.role !== "ADMIN" && user.role !== "CUSTOMER" && (
                <Button type="button" size="sm" variant="ghost" loading={transitioning} onClick={() => startTransition(async () => {
                  const result = await toggleCourierCostPermissionAction(user.id);
                  if (!result.ok) setRowError(result.error ?? "Could not update cost-card permission");
                })}>
                  {user.canManageCourierCosts ? "Remove cost access" : "Allow cost cards"}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => setResetting((v) => !v)}>
                <KeyRound className="size-4" /> Reset password
              </Button>
              <Button
                type="button"
                size="sm"
                variant={user.isActive ? "danger" : "secondary"}
                loading={transitioning}
                disabled={user.id === currentUserId}
                title={user.id === currentUserId ? "You cannot deactivate your own account" : undefined}
                onClick={() => {
                  if (user.isActive && !confirm(`Deactivate ${user.name}? They will not be able to sign in.`)) return;
                  setRowError(null);
                  startTransition(async () => {
                    const result = await toggleUserActiveAction(user.id);
                    if (!result.ok) setRowError(result.error ?? "Could not update user");
                  });
                }}
              >
                {user.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
            {rowError && <p className="text-xs text-danger">{rowError}</p>}
          </div>
        </td>
      </tr>
      {assigning && (user.role === "STAFF" || user.role === "COLLABORATOR") && (
        <tr className="border-b border-border bg-surface-2">
          <td colSpan={tenantName !== undefined ? 6 : 5} className="px-4 py-3">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-ink">Couriers available to this {user.role === "STAFF" ? "staff" : "collaborator"} account</p>
              {couriers.length === 0 ? <p className="text-xs text-ink-3">No courier partners have been onboarded yet.</p> : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {couriers.map((courier) => {
                    const checked = selectedCourierIds.includes(courier.id);
                    return <label key={courier.id} className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink">
                      <input type="checkbox" checked={checked} onChange={() => setSelectedCourierIds((prev) => checked ? prev.filter((id) => id !== courier.id) : [...prev, courier.id])} />
                      {courier.name}
                    </label>;
                  })}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" loading={transitioning} onClick={() => startTransition(async () => {
                  const result = await setUserCourierAssignmentsAction(user.id, selectedCourierIds);
                  if (!result.ok) setRowError(result.error ?? "Could not save courier assignments");
                  else setAssigning(false);
                })}>Save courier access</Button>
                <p className="text-xs text-ink-3">Only assigned courier rate cards and booking options are available to this account.</p>
              </div>
            </div>
          </td>
        </tr>
      )}
      {resetting && (
        <tr className="border-b border-border last:border-0 bg-surface-2">
          <td colSpan={tenantName !== undefined ? 6 : 5} className="px-4 py-3">
            {state.ok && state.tempPassword ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink">
                  Temporary password for <span className="font-medium">{user.name}</span>:
                </p>
                <code className="tabular rounded-control bg-surface border border-border px-2 py-1 text-sm text-ink">
                  {state.tempPassword}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(state.tempPassword!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
                </Button>
                <p className="text-xs text-ink-3">
                  They&apos;ll be required to set a new password on next sign-in. Share this securely.
                </p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setResetting(false)}>
                  <X className="size-4" /> Close
                </Button>
              </div>
            ) : (
              <form action={formAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="userId" value={user.id} />
                <p className="text-sm text-ink-2">
                  Reset the login password for <span className="font-medium text-ink">{user.name}</span>. Leave
                  blank to generate a random temporary password.
                </p>
                {state.error && <p className="text-xs text-danger w-full">{state.error}</p>}
                <div className="flex gap-2 ml-auto">
                  <Button type="submit" size="sm" loading={pending}>
                    Generate & reset
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setResetting(false)}>
                    <X className="size-4" /> Cancel
                  </Button>
                </div>
              </form>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
