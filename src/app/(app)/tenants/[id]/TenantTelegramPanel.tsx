"use client";

import { useState, useTransition } from "react";
import { toggleTenantTelegramAction, unlinkTenantTelegramAction } from "@/lib/actions/tenants";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Copy, Check } from "lucide-react";

export function TenantTelegramPanel({
  tenantId,
  connectLink,
  groupChatId,
  groupTitle,
  enabled,
}: {
  tenantId: string;
  connectLink: string | null;
  groupChatId: string | null;
  groupTitle: string | null;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleToggle(next: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("enabled", String(next));
      await toggleTenantTelegramAction(formData);
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      await unlinkTenantTelegramAction(formData);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-3">
        The same status-change stream as the webhook above, pushed into this tenant&apos;s own Telegram group instead —
        plus <code className="tabular">/shipments</code> and <code className="tabular">/documents &lt;tracking code&gt;</code>{" "}
        commands scoped to all of their orders, once the bot&apos;s added to their group.
      </p>

      {groupChatId ? (
        <div className="rounded-control border border-border bg-surface-2 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink">
                Connected to <b>{groupTitle ?? groupChatId}</b>
              </p>
              <p className="text-xs text-ink-3 tabular">{groupChatId}</p>
            </div>
            <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Paused"}</Badge>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => handleToggle(!enabled)} loading={pending}>
              {enabled ? "Pause notifications" : "Resume notifications"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={handleUnlink} loading={pending}>
              Unlink group
            </Button>
          </div>
        </div>
      ) : connectLink ? (
        <div className="rounded-control border border-border bg-surface-2 p-3 flex flex-col gap-2">
          <p className="text-sm text-ink">No group connected yet. Send this link to the client — tapping it prompts them to add the bot to their group:</p>
          <div className="flex items-center gap-2">
            <code className="tabular rounded-control bg-surface border border-border px-2 py-1 text-sm text-ink flex-1 overflow-x-auto">
              {connectLink}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(connectLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-danger">
          TELEGRAM_BOT_USERNAME isn&apos;t configured — set it before a connect link can be generated.
        </p>
      )}
    </div>
  );
}
