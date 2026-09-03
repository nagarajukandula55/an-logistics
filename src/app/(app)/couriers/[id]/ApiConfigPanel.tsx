"use client";

import { useState, useTransition } from "react";
import { createOrUpdateApiConfigAction } from "@/lib/actions/couriers";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const SHIPROCKET_DEFAULT_BASE_URL = "https://apiv2.shiprocket.in/v1/external";

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
  const [provider, setProvider] = useState(config?.provider ?? "");
  const isShiprocket = provider.trim().toUpperCase() === "SHIPROCKET";

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
        <Input
          id="provider"
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="e.g. SHIPROCKET, DELHIVERY"
          required
        />
      </Field>
      <Field label="Base URL" htmlFor="baseUrl" hint="Optional">
        <Input
          id="baseUrl"
          name="baseUrl"
          type="url"
          defaultValue={config?.baseUrl ?? (isShiprocket ? SHIPROCKET_DEFAULT_BASE_URL : "")}
        />
      </Field>
      {isShiprocket ? (
        <>
          <Field label="Shiprocket email" htmlFor="shiprocketEmail" hint="Leave blank to keep the stored credentials.">
            <Input id="shiprocketEmail" name="shiprocketEmail" type="email" placeholder={config?.apiKeyEncrypted ? "•••••••• (unchanged)" : ""} />
          </Field>
          <Field label="Shiprocket password" htmlFor="shiprocketPassword" hint="Encrypted at rest.">
            <Input id="shiprocketPassword" name="shiprocketPassword" type="password" placeholder={config?.apiKeyEncrypted ? "•••••••• (unchanged)" : ""} />
          </Field>
        </>
      ) : (
        <Field
          label="API key"
          htmlFor="apiKeyEncrypted"
          hint={config?.apiKeyEncrypted ? "Encrypted at rest. Leave blank to keep the current key." : "Encrypted at rest."}
        >
          <Input
            id="apiKeyEncrypted"
            name="apiKeyEncrypted"
            type="password"
            placeholder={config?.apiKeyEncrypted ? "•••••••• (unchanged)" : ""}
          />
        </Field>
      )}
      {config?.apiKeyEncrypted && (
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="clearApiKey" value="true" className="rounded border-border" />
          Clear the stored API key
        </label>
      )}
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
