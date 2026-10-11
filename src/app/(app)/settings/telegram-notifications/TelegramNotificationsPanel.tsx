"use client";

import { useState, useTransition } from "react";
import {
  saveTelegramNotificationChannelAction,
  removeTelegramNotificationChannelAction,
  testTelegramChatAction,
  discoverTelegramChatsAction,
} from "@/lib/actions/telegram-notifications";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Send, Search, Copy, Check } from "lucide-react";
import type { TelegramNotificationEvent } from "@prisma/client";

type Row = {
  event: TelegramNotificationEvent;
  label: string;
  description: string;
  groupChatId: string;
  isActive: boolean;
};

function EventRow({ row }: { row: Row }) {
  const [pending, startTransition] = useTransition();
  const [groupChatId, setGroupChatId] = useState(row.groupChatId);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSave(isActive: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("event", row.event);
        formData.set("groupChatId", groupChatId);
        formData.set("isActive", String(isActive));
        await saveTelegramNotificationChannelAction(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  function handleRemove() {
    setError(null);
    setTestResult(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("event", row.event);
      await removeTelegramNotificationChannelAction(formData);
      setGroupChatId("");
    });
  }

  function handleTest() {
    setError(null);
    setTestResult(null);
    startTransition(async () => {
      const result = await testTelegramChatAction(groupChatId);
      setTestResult({
        ok: result.ok,
        message: result.ok ? "Test message sent — check the group." : (result.error ?? "Could not reach that chat"),
      });
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-control border border-border px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-ink font-medium">{row.label}</p>
          <p className="text-xs text-ink-3">{row.description}</p>
        </div>
        <Badge tone={row.isActive && row.groupChatId ? "success" : "neutral"}>
          {row.isActive && row.groupChatId ? "Active" : "Not configured"}
        </Badge>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Group chat id" htmlFor={`groupChatId-${row.event}`} hint="e.g. -1001234567890">
            <Input
              id={`groupChatId-${row.event}`}
              value={groupChatId}
              onChange={(e) => setGroupChatId(e.target.value)}
              placeholder="-100…"
            />
          </Field>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={handleTest} loading={pending} disabled={!groupChatId}>
          <Send className="size-4" /> Test
        </Button>
        <Button type="button" size="sm" onClick={() => handleSave(true)} loading={pending} disabled={!groupChatId}>
          Save &amp; enable
        </Button>
        {row.isActive && (
          <Button type="button" size="sm" variant="secondary" onClick={() => handleSave(false)} loading={pending}>
            Pause
          </Button>
        )}
        {row.groupChatId && (
          <Button type="button" size="sm" variant="secondary" onClick={handleRemove} loading={pending}>
            Remove
          </Button>
        )}
      </div>
      {testResult && (
        <p className={`text-xs ${testResult.ok ? "text-success" : "text-danger"}`}>{testResult.message}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}

function DiscoverChats() {
  const [pending, startTransition] = useTransition();
  const [chats, setChats] = useState<{ id: string; title: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleDiscover() {
    setError(null);
    startTransition(async () => {
      const result = await discoverTelegramChatsAction();
      if (result.ok) {
        setChats(result.chats);
      } else {
        setError(result.error);
        setChats(null);
      }
    });
  }

  function handleCopy(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="rounded-control border border-border bg-surface-2 p-3 flex flex-col gap-2">
      <p className="text-sm text-ink">
        Don&apos;t know a group&apos;s chat id? Add the bot to it, send any message there, then fetch recently-seen
        groups below and copy the id into whichever event row needs it.
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={handleDiscover} loading={pending} className="self-start">
        <Search className="size-4" /> Fetch recent groups
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {chats && (
        chats.length === 0 ? (
          <p className="text-xs text-ink-3">No group messages seen recently — send a message in the group first.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {chats.map((chat) => (
              <li key={chat.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink">{chat.title}</span>
                <div className="flex items-center gap-2">
                  <code className="tabular text-xs text-ink-3">{chat.id}</code>
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleCopy(chat.id)}>
                    {copiedId === chat.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export function TelegramNotificationsPanel({ rows }: { rows: Row[] }) {
  return (
    <div className="flex flex-col gap-4">
      <DiscoverChats />
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <EventRow key={row.event} row={row} />
        ))}
      </ul>
    </div>
  );
}
