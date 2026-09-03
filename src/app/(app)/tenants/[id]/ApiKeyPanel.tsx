"use client";

import { useActionState, useState, useTransition } from "react";
import { createTenantApiKeyAction, revokeTenantApiKeyAction, type CreateApiKeyState } from "@/lib/actions/tenants";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Copy, Check } from "lucide-react";
import { format } from "date-fns";

type ApiKeyRow = {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

const initialState: CreateApiKeyState = { ok: false };

export function ApiKeyPanel({ tenantId, apiKeys }: { tenantId: string; apiKeys: ApiKeyRow[] }) {
  const [state, formAction, pending] = useActionState(createTenantApiKeyAction, initialState);
  const [copied, setCopied] = useState(false);
  const [revoking, startRevoke] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {apiKeys.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {apiKeys.map((key) => (
            <li key={key.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="text-ink">
                  {key.label} <span className="text-ink-3 tabular">({key.keyPrefix}…)</span>
                </p>
                <p className="text-xs text-ink-3">
                  Created {format(key.createdAt, "MMM d, yyyy")}
                  {key.lastUsedAt ? ` · last used ${format(key.lastUsedAt, "MMM d, yyyy")}` : " · never used"}
                </p>
              </div>
              {key.revokedAt ? (
                <Badge tone="neutral">Revoked</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  loading={revoking}
                  onClick={() => {
                    if (!confirm(`Revoke "${key.label}"? Any client using this key will lose access immediately.`)) return;
                    const fd = new FormData();
                    fd.set("apiKeyId", key.id);
                    fd.set("tenantId", tenantId);
                    startRevoke(() => revokeTenantApiKeyAction(fd));
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.ok && state.plaintextKey ? (
        <div className="rounded-control border border-border bg-surface-2 p-3 flex flex-col gap-2">
          <p className="text-sm text-ink">
            New key generated — copy it now, it won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2">
            <code className="tabular rounded-control bg-surface border border-border px-2 py-1 text-sm text-ink flex-1 overflow-x-auto">
              {state.plaintextKey}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(state.plaintextKey!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tenantId" value={tenantId} />
          <Field label="New key label" htmlFor="label" className="flex-1 min-w-[12rem]">
            <Input id="label" name="label" placeholder="e.g. angroup production" required />
          </Field>
          {state.error && <p className="text-xs text-danger w-full">{state.error}</p>}
          <Button type="submit" size="sm" loading={pending}>
            Generate key
          </Button>
        </form>
      )}
    </div>
  );
}
