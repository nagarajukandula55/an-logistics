"use client";

import { useActionState, useState } from "react";
import { saveTenantWebhookAction, type SaveWebhookState } from "@/lib/actions/tenants";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Copy, Check } from "lucide-react";

const initialState: SaveWebhookState = { ok: false };

export function WebhookPanel({
  tenantId,
  webhookUrl,
  hasSecret,
}: {
  tenantId: string;
  webhookUrl: string | null;
  hasSecret: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveTenantWebhookAction, initialState);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(webhookUrl ?? "");
  const [regen, setRegen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-3">
        When an order&apos;s status changes, we POST it to this URL, HMAC-signed (SHA-256, header{" "}
        <code className="tabular">X-AN-Logistics-Signature</code>) with the secret below, so the receiver can
        verify the payload came from us. Delivery is best-effort (one retry) — the receiver can always fall back
        to polling <code className="tabular">GET /api/v1/shipments/:trackingCode</code>.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="regenerateSecret" value={regen ? "true" : "false"} />

        <Field label="Webhook URL" htmlFor="webhookUrl">
          <Input
            id="webhookUrl"
            name="webhookUrl"
            type="url"
            placeholder="https://example.com/api/webhooks/an-logistics"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>

        <div className="rounded-control border border-border bg-surface-2 p-3 flex flex-col gap-2">
          <p className="text-sm text-ink">
            {hasSecret ? "A webhook secret is already set for this tenant." : "No webhook secret set yet."}
            {" "}The secret is only ever shown once, right after it&apos;s (re)generated.
          </p>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={regen}
              onChange={(e) => setRegen(e.target.checked)}
              className="size-4"
            />
            {hasSecret ? "Generate a new secret (invalidates the current one)" : "Generate a secret now"}
          </label>
        </div>

        {state.error && <p className="text-xs text-danger">{state.error}</p>}

        <div>
          <Button type="submit" size="sm" loading={pending}>
            Save
          </Button>
        </div>
      </form>

      {state.ok && state.plaintextSecret && (
        <div className="rounded-control border border-border bg-surface-2 p-3 flex flex-col gap-2">
          <p className="text-sm text-ink">
            New webhook secret generated — copy it now and put it in the receiver&apos;s environment
            (e.g. <code className="tabular">AN_LOGISTICS_WEBHOOK_SECRET</code>). It won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2">
            <code className="tabular rounded-control bg-surface border border-border px-2 py-1 text-sm text-ink flex-1 overflow-x-auto">
              {state.plaintextSecret}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(state.plaintextSecret!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
