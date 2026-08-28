"use client";

import { useState, useTransition } from "react";
import { createOrUpdateApiConfigAction } from "@/lib/actions/couriers";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type ApiConfig = {
  provider: string;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
  webhookUrl: string | null;
  isActive: boolean;
} | null;

export function ApiConfigPanel({ courierPartnerId, config }: { courierPartnerId: string; config: ApiConfig }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    formData.set("courierPartnerId", courierPartnerId);
    startTransition(async () => {
      try {
        await createOrUpdateApiConfigAction(formData);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save API config");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-ink-3">
        Configure this only once the courier supports real API integration. Manual/WhatsApp-coordinated partners can leave this blank.
      </p>
      <Field label="Provider" htmlFor="provider" required>
        <Input id="provider" name="provider" defaultValue={config?.provider ?? ""} placeholder="e.g. shiprocket, delhivery" required />
      </Field>
      <Field label="Base URL" htmlFor="baseUrl" hint="Optional">
        <Input id="baseUrl" name="baseUrl" type="url" defaultValue={config?.baseUrl ?? ""} />
      </Field>
      <Field label="API key" htmlFor="apiKeyEncrypted" hint="Stored as-is for now — not yet encrypted at rest">
        <Input id="apiKeyEncrypted" name="apiKeyEncrypted" type="password" defaultValue={config?.apiKeyEncrypted ?? ""} />
      </Field>
      <Field label="Webhook URL" htmlFor="webhookUrl" hint="Optional">
        <Input id="webhookUrl" name="webhookUrl" type="url" defaultValue={config?.webhookUrl ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" name="isActive" value="true" defaultChecked={config?.isActive ?? false} className="rounded border-border" />
        Active
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && !error && <p className="text-xs text-success">Saved.</p>}
      <Button type="submit" size="sm" loading={pending}>
        Save API config
      </Button>
    </form>
  );
}
